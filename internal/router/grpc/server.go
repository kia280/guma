package grpc

import (
	"context"
	"fmt"
	"net"
	"time"

	"buf.build/go/protovalidate"
	grpcprotovalidate "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/protovalidate"
	"github.com/rs/zerolog"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/config"
	"github.com/kia280/guma/internal/database"
	"github.com/kia280/guma/internal/events"
	"github.com/kia280/guma/internal/router/grpc/handlers"
	"github.com/kia280/guma/internal/router/grpc/interceptors"
	"github.com/kia280/guma/internal/services/health"
	usersvc "github.com/kia280/guma/internal/services/user"
)

// Server wraps the gRPC server with configuration
type Server struct {
	grpcServer    *grpc.Server
	listener      net.Listener
	logger        zerolog.Logger
	config        *config.Config
	healthService *health.Service
	healthHandler *handlers.HealthHandler
}

const healthCheckInterval = 5 * time.Second

// NewServer creates and configures a new gRPC server
func NewServer(cfg *config.Config, db *database.Pool, az authz.Authorizer, broker *events.Broker, logger zerolog.Logger) (*Server, error) {
	logger = logger.With().Str("component", "grpc-server").Logger()

	validator, err := protovalidate.New()
	if err != nil {
		return nil, fmt.Errorf("failed to create request validator: %w", err)
	}

	// Create gRPC server with interceptors
	grpcServer := grpc.NewServer(
		grpc.StatsHandler(otelgrpc.NewServerHandler()),
		grpc.ChainUnaryInterceptor(
			interceptors.ErrorSanitizerInterceptor(),
			interceptors.LoggingInterceptor(logger),
			interceptors.RecoveryInterceptor(logger),
			grpcprotovalidate.UnaryServerInterceptor(validator),
		),
		grpc.ChainStreamInterceptor(
			interceptors.StreamErrorSanitizerInterceptor(logger),
			interceptors.StreamRecoveryInterceptor(logger),
			grpcprotovalidate.StreamServerInterceptor(validator),
		),
	)

	// Initialize service handlers
	gumaHandler := handlers.NewGumaService(logger)
	guildHandler := handlers.NewGuildService(db, az, logger)
	memberHandler := handlers.NewMemberService(db, az, logger)
	userHandler := handlers.NewUserService(db, cfg.Auth.KratosPublicURL, logger,
		usersvc.WithDevAuth(cfg.Dev.AuthEnabled),
		usersvc.WithKratosAdminURL(cfg.Auth.KratosAdminURL),
	)
	rollCallHandler := handlers.NewRollCallService(db, logger)
	rollCallTemplateHandler := handlers.NewRollCallTemplateService(db, logger)
	itemTemplateHandler := handlers.NewItemTemplateService(db, logger)
	walletHandler := handlers.NewWalletService(db, logger)
	auctionHandler := handlers.NewAuctionService(db, az, logger)
	eventHandler := handlers.NewEventService(db, logger)
	raffleHandler := handlers.NewRaffleService(db, logger)
	bankHandler := handlers.NewBankService(db, az, logger)
	notificationHandler := handlers.NewNotificationService(db, logger)
	preferenceHandler := handlers.NewPreferenceService(db, logger)
	announcementHandler := handlers.NewAnnouncementService(db, az, logger)
	streamHandler := handlers.NewStreamService(broker, events.MemberGuildIDs(db), logger)

	healthService := health.NewService(db)
	healthHandler := handlers.NewHealthHandler(healthService, healthCheckInterval, logger)

	// Register services
	gumav1.RegisterGumaServiceServer(grpcServer, gumaHandler)
	gumav1.RegisterGuildServiceServer(grpcServer, guildHandler)
	gumav1.RegisterMemberServiceServer(grpcServer, memberHandler)
	gumav1.RegisterUserServiceServer(grpcServer, userHandler)
	gumav1.RegisterRollCallServiceServer(grpcServer, rollCallHandler)
	gumav1.RegisterRollCallTemplateServiceServer(grpcServer, rollCallTemplateHandler)
	gumav1.RegisterItemTemplateServiceServer(grpcServer, itemTemplateHandler)
	gumav1.RegisterWalletServiceServer(grpcServer, walletHandler)
	gumav1.RegisterAuctionServiceServer(grpcServer, auctionHandler)
	gumav1.RegisterEventServiceServer(grpcServer, eventHandler)
	gumav1.RegisterRaffleServiceServer(grpcServer, raffleHandler)
	gumav1.RegisterBankServiceServer(grpcServer, bankHandler)
	gumav1.RegisterNotificationServiceServer(grpcServer, notificationHandler)
	gumav1.RegisterPreferenceServiceServer(grpcServer, preferenceHandler)
	gumav1.RegisterAnnouncementServiceServer(grpcServer, announcementHandler)
	gumav1.RegisterStreamServiceServer(grpcServer, streamHandler)
	healthHandler.Register(grpcServer)

	// Enable reflection for debugging (disable in production)
	if cfg.IsDevelopment() {
		reflection.Register(grpcServer)
		logger.Info().Msg("gRPC reflection enabled")
	}

	// Create listener
	grpcAddr := fmt.Sprintf(":%d", cfg.Server.GRPCPort)
	lis, err := net.Listen("tcp", grpcAddr)
	if err != nil {
		return nil, fmt.Errorf("failed to listen on %s: %w", grpcAddr, err)
	}

	logger.Info().Str("address", grpcAddr).Msg("gRPC server initialized")

	return &Server{
		grpcServer:    grpcServer,
		listener:      lis,
		logger:        logger,
		config:        cfg,
		healthService: healthService,
		healthHandler: healthHandler,
	}, nil
}

// Start starts the gRPC server
func (s *Server) Start() error {
	s.logger.Info().Str("address", s.listener.Addr().String()).Msg("starting gRPC server")

	if err := s.grpcServer.Serve(s.listener); err != nil {
		return fmt.Errorf("gRPC server failed: %w", err)
	}

	return nil
}

// Stop gracefully stops the gRPC server
func (s *Server) Stop(ctx context.Context) error {
	s.logger.Info().Msg("stopping gRPC server")

	// Graceful stop
	stopped := make(chan struct{})
	go func() {
		s.grpcServer.GracefulStop()
		close(stopped)
	}()

	// Wait for graceful stop or context timeout
	select {
	case <-ctx.Done():
		s.logger.Warn().Msg("forcing gRPC server stop")
		s.grpcServer.Stop()
		return ctx.Err()
	case <-stopped:
		s.logger.Info().Msg("gRPC server stopped gracefully")
		return nil
	}
}

// Address returns the server's listening address
func (s *Server) Address() string {
	return s.listener.Addr().String()
}

func (s *Server) MarkStartupComplete() {
	s.healthService.MarkStartupComplete()
}

func (s *Server) RunHealthChecks(ctx context.Context) {
	s.healthHandler.Run(ctx)
}

func (s *Server) MarkShuttingDown() {
	s.healthHandler.Shutdown()
}
