package telemetry

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/exaring/otelpgx"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	metricnoop "go.opentelemetry.io/otel/metric/noop"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.43.0"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/embedded"
	tracenoop "go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"

	"github.com/kia280/guma/internal/config"
)

const (
	healthServicePrefix = "grpc.health.v1.Health/"
	httpServerOperation = "http-gateway"
)

var probePaths = map[string]bool{"/livez": true, "/readyz": true}

// StartTracing installs the global OpenTelemetry tracer provider and propagators.
// The returned function flushes pending spans and must be called on shutdown.
func StartTracing(ctx context.Context, cfg config.TracingConfig, info ServiceInfo, logger zerolog.Logger) (ShutdownFunc, error) {
	if !cfg.Enabled {
		return func(context.Context) error { return nil }, nil
	}

	res, err := newResource(ctx, info)
	if err != nil {
		return nil, err
	}

	exporter, err := newTraceExporter(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create trace exporter: %w", err)
	}

	provider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(probeDroppingSampler{
			next: sdktrace.ParentBased(sdktrace.TraceIDRatioBased(cfg.SampleRate)),
		}),
	)

	otel.SetTracerProvider(provider)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))
	otel.SetErrorHandler(otel.ErrorHandlerFunc(func(err error) {
		logger.Warn().Err(err).Str("component", "telemetry").Msg("OpenTelemetry error")
	}))

	logger.Info().
		Str("component", "telemetry").
		Str("endpoint", cfg.Endpoint).
		Str("protocol", cfg.Protocol).
		Float64("sample_rate", cfg.SampleRate).
		Msg("OpenTelemetry tracing enabled")

	return provider.Shutdown, nil
}

type probeDroppingSampler struct {
	next sdktrace.Sampler
}

func (s probeDroppingSampler) ShouldSample(p sdktrace.SamplingParameters) sdktrace.SamplingResult {
	if isProbeSpan(p) {
		return sdktrace.SamplingResult{
			Decision:   sdktrace.Drop,
			Tracestate: trace.SpanContextFromContext(p.ParentContext).TraceState(),
		}
	}
	return s.next.ShouldSample(p)
}

func (s probeDroppingSampler) Description() string {
	return "ProbeDropping{" + s.next.Description() + "}"
}

func isProbeSpan(p sdktrace.SamplingParameters) bool {
	if strings.HasPrefix(p.Name, healthServicePrefix) {
		return true
	}
	for _, attr := range p.Attributes {
		if attr.Key == semconv.URLPathKey && probePaths[attr.Value.AsString()] {
			return true
		}
	}
	return false
}

func newTraceExporter(ctx context.Context, cfg config.TracingConfig) (*otlptrace.Exporter, error) {
	headers, err := cfg.ParsedHeaders()
	if err != nil {
		return nil, err
	}
	isURL := strings.Contains(cfg.Endpoint, "://")

	if cfg.Protocol == config.TracingProtocolHTTP {
		var opts []otlptracehttp.Option
		switch {
		case isURL:
			endpointURL, err := url.Parse(cfg.Endpoint)
			if err != nil {
				return nil, fmt.Errorf("invalid tracing endpoint: %w", err)
			}
			if endpointURL.Path == "" || endpointURL.Path == "/" {
				endpointURL.Path = "/v1/traces"
			}
			opts = append(opts, otlptracehttp.WithEndpointURL(endpointURL.String()))
		case cfg.Endpoint != "":
			opts = append(opts, otlptracehttp.WithEndpoint(cfg.Endpoint))
		}
		if cfg.Insecure {
			opts = append(opts, otlptracehttp.WithInsecure())
		}
		if len(headers) > 0 {
			opts = append(opts, otlptracehttp.WithHeaders(headers))
		}
		return otlptracehttp.New(ctx, opts...)
	}

	var opts []otlptracegrpc.Option
	switch {
	case isURL:
		opts = append(opts, otlptracegrpc.WithEndpointURL(cfg.Endpoint))
	case cfg.Endpoint != "":
		opts = append(opts, otlptracegrpc.WithEndpoint(cfg.Endpoint))
	}
	if cfg.Insecure {
		opts = append(opts, otlptracegrpc.WithInsecure())
	}
	if len(headers) > 0 {
		opts = append(opts, otlptracegrpc.WithHeaders(headers))
	}
	return otlptracegrpc.New(ctx, opts...)
}

// GRPCDialOptions returns the gRPC client options that propagate trace context to the gRPC server.
func GRPCDialOptions(cfg config.TracingConfig) []grpc.DialOption {
	if !cfg.Enabled {
		return nil
	}
	return []grpc.DialOption{grpc.WithStatsHandler(otelgrpc.NewClientHandler(
		otelgrpc.WithMeterProvider(metricnoop.NewMeterProvider()),
	))}
}

// HTTPHandler wraps handler so incoming HTTP requests record traces and metrics.
func HTTPHandler(handler http.Handler) http.Handler {
	instrumented := otelhttp.NewHandler(handler, httpServerOperation,
		otelhttp.WithSpanNameFormatter(httpSpanName),
	)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := context.WithValue(r.Context(), httpRouteKey{}, new(string))
		instrumented.ServeHTTP(w, r.WithContext(ctx))
	})
}

type httpRouteKey struct{}

func httpSpanName(_ string, r *http.Request) string {
	if route, ok := r.Context().Value(httpRouteKey{}).(*string); ok && *route != "" {
		return r.Method + " " + *route
	}
	return r.Method
}

// NameHTTPSpan names the current HTTP server span after the matched route template.
func NameHTTPSpan(ctx context.Context, method, route string) {
	if holder, ok := ctx.Value(httpRouteKey{}).(*string); ok {
		*holder = route
	}
	span := trace.SpanFromContext(ctx)
	if !span.IsRecording() {
		return
	}
	span.SetName(method + " " + route)
	span.SetAttributes(semconv.HTTPRoute(route))
}

// PgxTracer returns a pgx query tracer that records database spans inside existing traces.
// Queries without a parent span, such as background health checks, are not traced.
func PgxTracer(cfg config.TracingConfig) pgx.QueryTracer {
	if !cfg.Enabled {
		return nil
	}
	return otelpgx.NewTracer(
		otelpgx.WithTracerProvider(childSpanTracerProvider{provider: otel.GetTracerProvider()}),
		otelpgx.WithMeterProvider(metricnoop.NewMeterProvider()),
		otelpgx.WithSpanNameFunc(sqlSpanName),
	)
}

func sqlSpanName(stmt string) string {
	for line := range strings.Lines(stmt) {
		line = strings.TrimSpace(line)
		if name, ok := strings.CutPrefix(line, "-- name:"); ok {
			if fields := strings.Fields(name); len(fields) > 0 {
				return fields[0]
			}
		}
		if line == "" || strings.HasPrefix(line, "--") {
			continue
		}
		return strings.ToUpper(strings.Fields(line)[0])
	}
	return "query"
}

type childSpanTracerProvider struct {
	embedded.TracerProvider
	provider trace.TracerProvider
}

func (p childSpanTracerProvider) Tracer(name string, opts ...trace.TracerOption) trace.Tracer {
	return childSpanTracer{tracer: p.provider.Tracer(name, opts...)}
}

type childSpanTracer struct {
	embedded.Tracer
	tracer trace.Tracer
}

func (t childSpanTracer) Start(ctx context.Context, name string, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	if !trace.SpanContextFromContext(ctx).IsValid() {
		return tracenoop.NewTracerProvider().Tracer("").Start(ctx, name, opts...)
	}
	return t.tracer.Start(ctx, name, opts...)
}
