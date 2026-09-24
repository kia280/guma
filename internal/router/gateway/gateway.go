package gateway

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/rs/zerolog"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/config"
	"github.com/kia280/guma/internal/database"
	"github.com/kia280/guma/internal/router/gateway/middleware"
	"github.com/kia280/guma/internal/services/devauth"
	"github.com/kia280/guma/internal/session"
)

// Gateway wraps the HTTP gateway server
type Gateway struct {
	server     *http.Server
	healthConn *grpc.ClientConn
	logger     zerolog.Logger
	config     *config.Config
}

// NewGateway creates and configures a new HTTP gateway
func NewGateway(ctx context.Context, cfg *config.Config, db *database.Pool, grpcAddr string, logger zerolog.Logger) (*Gateway, error) {
	logger = logger.With().Str("component", "http-gateway").Logger()

	// Create gRPC-Gateway mux
	mux := newServeMux(logger)

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

	if err := gumav1.RegisterUserServiceHandlerFromEndpoint(ctx, mux, grpcAddr, opts); err != nil {
		return nil, fmt.Errorf("failed to register user gateway: %w", err)
	}

	if err := gumav1.RegisterWalletServiceHandlerFromEndpoint(ctx, mux, grpcAddr, opts); err != nil {
		return nil, fmt.Errorf("failed to register wallet gateway: %w", err)
	}

	if err := gumav1.RegisterAuctionServiceHandlerFromEndpoint(ctx, mux, grpcAddr, opts); err != nil {
		return nil, fmt.Errorf("failed to register auction gateway: %w", err)
	}

	if err := gumav1.RegisterEventServiceHandlerFromEndpoint(ctx, mux, grpcAddr, opts); err != nil {
		return nil, fmt.Errorf("failed to register event gateway: %w", err)
	}

	if err := gumav1.RegisterCheckInServiceHandlerFromEndpoint(ctx, mux, grpcAddr, opts); err != nil {
		return nil, fmt.Errorf("failed to register checkin gateway: %w", err)
	}

	if err := gumav1.RegisterCheckInTemplateServiceHandlerFromEndpoint(ctx, mux, grpcAddr, opts); err != nil {
		return nil, fmt.Errorf("failed to register checkin template gateway: %w", err)
	}

	if err := gumav1.RegisterLotteryServiceHandlerFromEndpoint(ctx, mux, grpcAddr, opts); err != nil {
		return nil, fmt.Errorf("failed to register lottery gateway: %w", err)
	}

	if err := gumav1.RegisterBankServiceHandlerFromEndpoint(ctx, mux, grpcAddr, opts); err != nil {
		return nil, fmt.Errorf("failed to register bank gateway: %w", err)
	}

	if err := gumav1.RegisterNotificationServiceHandlerFromEndpoint(ctx, mux, grpcAddr, opts); err != nil {
		return nil, fmt.Errorf("failed to register notification gateway: %w", err)
	}

	if err := gumav1.RegisterStreamServiceHandlerFromEndpoint(ctx, mux, grpcAddr, opts); err != nil {
		return nil, fmt.Errorf("failed to register stream gateway: %w", err)
	}

	logger.Info().Msg("gRPC-Gateway handlers registered")

	// Create HTTP handler with middleware
	var handler http.Handler = mux

	// Apply middleware
	handler = middleware.KratosSessionMiddleware(cfg.Auth.KratosPublicURL, logger)(handler)
	if cfg.Dev.AuthEnabled {
		logger.Warn().Msg("DEV AUTH ENABLED: requests can impersonate any user; never enable this outside local development")
		handler = middleware.DevSessionMiddleware()(handler)

		devMux := http.NewServeMux()
		devMux.Handle(devRoutePrefix, newDevAuthHandler(devauth.New(db), logger))
		devMux.Handle("/", handler)
		handler = devMux
	}
	handler = eventStreamMiddleware(handler)
	handler = middleware.SecurityHeadersMiddleware()(handler)
	handler = middleware.CORSMiddleware(
		cfg.CORS.AllowedOrigins,
		cfg.CORS.AllowedMethods,
		cfg.CORS.AllowedHeaders,
	)(handler)

	healthConn, err := grpc.NewClient(grpcAddr, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create health client: %w", err)
	}
	handler = newProbeMux(healthpb.NewHealthClient(healthConn), handler)

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
		server:     server,
		healthConn: healthConn,
		logger:     logger,
		config:     cfg,
	}, nil
}

// Start starts the HTTP gateway server
func newServeMux(logger zerolog.Logger) *runtime.ServeMux {
	jsonMarshaler := &runtime.JSONPb{
		MarshalOptions: protojson.MarshalOptions{
			UseProtoNames:   true,
			EmitUnpopulated: false,
			UseEnumNumbers:  false,
		},
		UnmarshalOptions: protojson.UnmarshalOptions{
			DiscardUnknown: true,
		},
	}

	return runtime.NewServeMux(
		runtime.WithErrorHandler(customErrorHandler(logger)),
		runtime.WithMarshalerOption(runtime.MIMEWildcard, jsonMarshaler),
		runtime.WithMarshalerOption(mimeEventStream, &sseMarshaler{Marshaler: jsonMarshaler}),
		runtime.WithIncomingHeaderMatcher(customHeaderMatcher),
		runtime.WithOutgoingHeaderMatcher(outgoingHeaderMatcher),
		runtime.WithMetadata(session.Annotator),
	)
}

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

	if err := g.healthConn.Close(); err != nil {
		g.logger.Warn().Err(err).Msg("health client close error")
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
		const fallback = `{"error":"internal server error"}`

		st := status.Convert(err)
		httpStatus := runtime.HTTPStatusFromCode(st.Code())

		payload := map[string]any{
			"error": st.Message(),
			"code":  st.Code().String(),
		}

		if details := st.Details(); len(details) > 0 {
			payload["details"] = details
		}

		body, marshalErr := json.Marshal(payload)
		if marshalErr != nil {
			logger.Error().
				Err(marshalErr).
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Msg("failed to marshal gateway error response")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(httpStatus)
			_, _ = w.Write([]byte(fallback))
			return
		}

		logger.Error().
			Err(err).
			Str("method", r.Method).
			Str("path", r.URL.Path).
			Str("grpc_code", st.Code().String()).
			Int("http_status", httpStatus).
			Msg("gateway error")

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(httpStatus)
		if _, writeErr := w.Write(body); writeErr != nil {
			logger.Error().
				Err(writeErr).
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Msg("failed to write gateway error response")
		}
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
