package telemetry

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
	"go.opentelemetry.io/contrib/instrumentation/runtime"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/metric"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	semconv "go.opentelemetry.io/otel/semconv/v1.43.0"

	"github.com/kia280/guma/internal/config"
)

const (
	serviceName = "guma-backend"
	meterName   = "github.com/kia280/guma/internal/telemetry"
	poolName    = "guma"
)

type ServiceInfo struct {
	Version     string
	Environment string
}

type ShutdownFunc func(context.Context) error

func StartMetrics(ctx context.Context, cfg config.MetricsConfig, info ServiceInfo, pool *pgxpool.Pool, logger zerolog.Logger) (ShutdownFunc, error) {
	if !cfg.Enabled {
		return func(context.Context) error { return nil }, nil
	}

	res, err := newResource(ctx, info)
	if err != nil {
		return nil, err
	}

	exporter, err := newExporter(ctx, cfg)
	if err != nil {
		return nil, err
	}

	provider := sdkmetric.NewMeterProvider(
		sdkmetric.WithResource(res),
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(exporter, sdkmetric.WithInterval(cfg.ExportInterval))),
	)
	otel.SetMeterProvider(provider)

	if err := runtime.Start(runtime.WithMeterProvider(provider)); err != nil {
		_ = provider.Shutdown(ctx)
		return nil, fmt.Errorf("failed to start runtime metrics: %w", err)
	}

	if pool != nil {
		if err := registerPoolMetrics(provider.Meter(meterName), pool); err != nil {
			_ = provider.Shutdown(ctx)
			return nil, err
		}
	}

	logger.Info().
		Str("component", "telemetry").
		Str("endpoint", cfg.Endpoint).
		Str("protocol", cfg.Protocol).
		Dur("export_interval", cfg.ExportInterval).
		Msg("OpenTelemetry metrics enabled")

	return provider.Shutdown, nil
}

func newResource(ctx context.Context, info ServiceInfo) (*resource.Resource, error) {
	res, err := resource.New(ctx,
		resource.WithSchemaURL(semconv.SchemaURL),
		resource.WithTelemetrySDK(),
		resource.WithHost(),
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
			semconv.ServiceVersion(info.Version),
			semconv.DeploymentEnvironmentNameKey.String(info.Environment),
		),
		resource.WithFromEnv(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to build telemetry resource: %w", err)
	}
	return res, nil
}

func newExporter(ctx context.Context, cfg config.MetricsConfig) (sdkmetric.Exporter, error) {
	headers, err := parseHeaders(cfg.Headers)
	if err != nil {
		return nil, err
	}
	hasScheme := strings.Contains(cfg.Endpoint, "://")

	switch cfg.Protocol {
	case config.MetricsProtocolGRPC:
		var opts []otlpmetricgrpc.Option
		switch {
		case hasScheme:
			opts = append(opts, otlpmetricgrpc.WithEndpointURL(cfg.Endpoint))
		case cfg.Endpoint != "":
			opts = append(opts, otlpmetricgrpc.WithEndpoint(cfg.Endpoint))
		}
		if cfg.Insecure {
			opts = append(opts, otlpmetricgrpc.WithInsecure())
		}
		if len(headers) > 0 {
			opts = append(opts, otlpmetricgrpc.WithHeaders(headers))
		}
		exporter, err := otlpmetricgrpc.New(ctx, opts...)
		if err != nil {
			return nil, fmt.Errorf("failed to create OTLP gRPC metric exporter: %w", err)
		}
		return exporter, nil
	case config.MetricsProtocolHTTPProtobuf:
		var opts []otlpmetrichttp.Option
		switch {
		case hasScheme:
			opts = append(opts, otlpmetrichttp.WithEndpointURL(cfg.Endpoint))
		case cfg.Endpoint != "":
			opts = append(opts, otlpmetrichttp.WithEndpoint(cfg.Endpoint))
		}
		if cfg.Insecure {
			opts = append(opts, otlpmetrichttp.WithInsecure())
		}
		if len(headers) > 0 {
			opts = append(opts, otlpmetrichttp.WithHeaders(headers))
		}
		exporter, err := otlpmetrichttp.New(ctx, opts...)
		if err != nil {
			return nil, fmt.Errorf("failed to create OTLP HTTP metric exporter: %w", err)
		}
		return exporter, nil
	default:
		return nil, fmt.Errorf("unsupported metrics protocol %q", cfg.Protocol)
	}
}

func parseHeaders(raw string) (map[string]string, error) {
	headers := map[string]string{}
	for _, pair := range strings.Split(raw, ",") {
		pair = strings.TrimSpace(pair)
		if pair == "" {
			continue
		}
		key, value, ok := strings.Cut(pair, "=")
		key = strings.TrimSpace(key)
		if !ok || key == "" {
			return nil, fmt.Errorf("invalid metrics header %q: expected key=value", pair)
		}
		headers[key] = strings.TrimSpace(value)
	}
	return headers, nil
}

func registerPoolMetrics(meter metric.Meter, pool *pgxpool.Pool) error {
	poolAttr := attribute.String("db.client.connection.pool.name", poolName)
	idleAttrs := metric.WithAttributes(poolAttr, attribute.String("db.client.connection.state", "idle"))
	usedAttrs := metric.WithAttributes(poolAttr, attribute.String("db.client.connection.state", "used"))
	poolAttrs := metric.WithAttributes(poolAttr)

	connections, err := meter.Int64ObservableUpDownCounter("db.client.connection.count",
		metric.WithDescription("The number of connections that are currently in state described by the state attribute."),
		metric.WithUnit("{connection}"))
	if err != nil {
		return fmt.Errorf("failed to create pool connection metric: %w", err)
	}
	maxConnections, err := meter.Int64ObservableUpDownCounter("db.client.connection.max",
		metric.WithDescription("The maximum number of open connections allowed."),
		metric.WithUnit("{connection}"))
	if err != nil {
		return fmt.Errorf("failed to create pool max metric: %w", err)
	}
	acquires, err := meter.Int64ObservableCounter("pgxpool.acquire.count",
		metric.WithDescription("The cumulative count of successful connection acquires from the pool."),
		metric.WithUnit("{acquire}"))
	if err != nil {
		return fmt.Errorf("failed to create pool acquire metric: %w", err)
	}
	emptyAcquires, err := meter.Int64ObservableCounter("pgxpool.acquire.empty.count",
		metric.WithDescription("The cumulative count of acquires that waited because the pool was empty."),
		metric.WithUnit("{acquire}"))
	if err != nil {
		return fmt.Errorf("failed to create pool empty acquire metric: %w", err)
	}
	canceledAcquires, err := meter.Int64ObservableCounter("pgxpool.acquire.canceled.count",
		metric.WithDescription("The cumulative count of acquires canceled by a context."),
		metric.WithUnit("{acquire}"))
	if err != nil {
		return fmt.Errorf("failed to create pool canceled acquire metric: %w", err)
	}
	acquireDuration, err := meter.Float64ObservableCounter("pgxpool.acquire.duration",
		metric.WithDescription("The total time spent acquiring connections from the pool."),
		metric.WithUnit("s"))
	if err != nil {
		return fmt.Errorf("failed to create pool acquire duration metric: %w", err)
	}

	_, err = meter.RegisterCallback(func(_ context.Context, o metric.Observer) error {
		stat := pool.Stat()
		o.ObserveInt64(connections, int64(stat.IdleConns()), idleAttrs)
		o.ObserveInt64(connections, int64(stat.AcquiredConns()), usedAttrs)
		o.ObserveInt64(maxConnections, int64(stat.MaxConns()), poolAttrs)
		o.ObserveInt64(acquires, stat.AcquireCount(), poolAttrs)
		o.ObserveInt64(emptyAcquires, stat.EmptyAcquireCount(), poolAttrs)
		o.ObserveInt64(canceledAcquires, stat.CanceledAcquireCount(), poolAttrs)
		o.ObserveFloat64(acquireDuration, stat.AcquireDuration().Seconds(), poolAttrs)
		return nil
	}, connections, maxConnections, acquires, emptyAcquires, canceledAcquires, acquireDuration)
	if err != nil {
		return fmt.Errorf("failed to register pool metrics callback: %w", err)
	}
	return nil
}
