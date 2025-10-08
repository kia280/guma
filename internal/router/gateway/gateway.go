package gateway

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/rs/zerolog"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/encoding/protojson"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/config"
	"github.com/kia280/guma/internal/router/gateway/middleware"
)

// Gateway wraps the HTTP gateway server
type Gateway struct {
	server *http.Server
	logger zerolog.Logger
	config *config.Config
}

// NewGateway creates and configures a new HTTP gateway
func NewGateway(ctx context.Context, cfg *config.Config, grpcAddr string, logger zerolog.Logger) (*Gateway, error) {
	logger = logger.With().Str("component", "http-gateway").Logger()

	// Create gRPC-Gateway mux
	mux := runtime.NewServeMux(
		runtime.WithErrorHandler(customErrorHandler(logger)),
		runtime.WithMarshalerOption(runtime.MIMEWildcard, &runtime.JSONPb{
			MarshalOptions: protojson.MarshalOptions{
				UseProtoNames:   true,
				EmitUnpopulated: false,
				UseEnumNumbers:  false,
			},
			UnmarshalOptions: protojson.UnmarshalOptions{
				DiscardUnknown: true,
			},
		}),
		runtime.WithIncomingHeaderMatcher(customHeaderMatcher),
		runtime.WithOutgoingHeaderMatcher(outgoingHeaderMatcher),
	)

	// gRPC connection options
	opts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	}

	// Register gRPC-Gateway handlers
	if err := gumav1.RegisterGumaServiceHandlerFromEndpoint(ctx, mux, grpcAddr, opts); err != nil {
		return nil, fmt.Errorf("failed to register guma gateway: %w", err)
	}

	if err := gumav1.RegisterGuildServiceHandlerFromEndpoint(ctx, mux, grpcAddr, opts); err != nil {
		return nil, fmt.Errorf("failed to register guild gateway: %w", err)
	}

	if err := gumav1.RegisterMemberServiceHandlerFromEndpoint(ctx, mux, grpcAddr, opts); err != nil {
		return nil, fmt.Errorf("failed to register member gateway: %w", err)
	}

	logger.Info().Msg("gRPC-Gateway handlers registered")

	// Create HTTP handler with middleware
	var handler http.Handler = mux

	// Add health check endpoints
	healthMux := http.NewServeMux()
	healthMux.Handle("/", mux)
	healthMux.HandleFunc("/health", healthCheckHandler())
	healthMux.HandleFunc("/healthz", healthCheckHandler())
	healthMux.HandleFunc("/ready", readinessCheckHandler())

	handler = healthMux

	// Apply middleware
	handler = middleware.SecurityHeadersMiddleware()(handler)
	handler = middleware.CORSMiddleware(
		cfg.CORS.AllowedOrigins,
		cfg.CORS.AllowedMethods,
		cfg.CORS.AllowedHeaders,
	)(handler)

	// Create HTTP server
	httpAddr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	server := &http.Server{
		Addr:         httpAddr,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	logger.Info().Str("address", httpAddr).Msg("HTTP gateway initialized")

	return &Gateway{
		server: server,
		logger: logger,
		config: cfg,
	}, nil
}

// Start starts the HTTP gateway server
func (g *Gateway) Start() error {
	g.logger.Info().Str("address", g.server.Addr).Msg("starting HTTP gateway")

	if err := g.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("HTTP gateway failed: %w", err)
	}

	return nil
}

// Stop gracefully stops the HTTP gateway server
func (g *Gateway) Stop(ctx context.Context) error {
	g.logger.Info().Msg("stopping HTTP gateway")

	if err := g.server.Shutdown(ctx); err != nil {
		g.logger.Error().Err(err).Msg("HTTP gateway shutdown error")
		return err
	}

	g.logger.Info().Msg("HTTP gateway stopped")
	return nil
}

// Address returns the server's listening address
func (g *Gateway) Address() string {
	return g.server.Addr
}

// customErrorHandler handles errors from gRPC-Gateway
func customErrorHandler(logger zerolog.Logger) runtime.ErrorHandlerFunc {
	return func(ctx context.Context, mux *runtime.ServeMux, marshaler runtime.Marshaler, w http.ResponseWriter, r *http.Request, err error) {
		logger.Error().
			Err(err).
			Str("method", r.Method).
			Str("path", r.URL.Path).
			Msg("gateway error")

		runtime.DefaultHTTPErrorHandler(ctx, mux, marshaler, w, r, err)
	}
}

// customHeaderMatcher matches incoming HTTP headers to gRPC metadata
func customHeaderMatcher(key string) (string, bool) {
	switch key {
	case "Authorization", "X-Request-Id", "X-Forwarded-For":
		return key, true
	default:
		return runtime.DefaultHeaderMatcher(key)
	}
}

// outgoingHeaderMatcher matches outgoing gRPC metadata to HTTP headers
func outgoingHeaderMatcher(key string) (string, bool) {
	switch key {
	case "x-request-id":
		return "X-Request-Id", true
	default:
		return key, true
	}
}

// healthCheckHandler returns a simple health check
func healthCheckHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok","service":"guma-backend"}`))
	}
}

// readinessCheckHandler checks if the service is ready to serve traffic
func readinessCheckHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// TODO: Add database connectivity check
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ready"}`))
	}
}
