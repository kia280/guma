package grpc

import (
	"context"
	"fmt"
	"net"

	"github.com/rs/zerolog"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/config"
	"github.com/kia280/guma/internal/database"
	"github.com/kia280/guma/internal/router/grpc/handlers"
	"github.com/kia280/guma/internal/router/grpc/interceptors"
	"github.com/kia280/guma/internal/services/health"
)

// Server wraps the gRPC server with configuration
type Server struct {
	grpcServer    *grpc.Server
	listener      net.Listener
	logger        zerolog.Logger
	config        *config.Config
	healthService *health.Service
}

// NewServer creates and configures a new gRPC server
func NewServer(cfg *config.Config, db *database.Pool, logger zerolog.Logger) (*Server, error) {
	logger = logger.With().Str("component", "grpc-server").Logger()

	// Create gRPC server with interceptors
	grpcServer := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			interceptors.LoggingInterceptor(logger),
			interceptors.RecoveryInterceptor(logger),
			interceptors.ValidationInterceptor(),
		),
	)

	// Initialize service handlers
	gumaHandler := handlers.NewGumaService(logger)
	guildHandler := handlers.NewGuildService(db, logger)
	memberHandler := handlers.NewMemberService(logger)
	userHandler := handlers.NewUserService(db, cfg.Auth.KratosPublicURL, logger)
	checkinHandler := handlers.NewCheckInService(db, logger)
	walletHandler := handlers.NewWalletService(db, logger)
	auctionHandler := handlers.NewAuctionService(db, logger)
	eventHandler := handlers.NewEventService(db, logger)
	lotteryHandler := handlers.NewLotteryService(db, logger)
	bankHandler := handlers.NewBankService(db, logger)

	healthService := health.NewService(db)
	healthHandler := handlers.NewHealthServiceHandler(healthService, logger)

	// Register services
	gumav1.RegisterGumaServiceServer(grpcServer, gumaHandler)
	gumav1.RegisterGuildServiceServer(grpcServer, guildHandler)
	gumav1.RegisterMemberServiceServer(grpcServer, memberHandler)
	gumav1.RegisterUserServiceServer(grpcServer, userHandler)
	gumav1.RegisterCheckInServiceServer(grpcServer, checkinHandler)
	gumav1.RegisterWalletServiceServer(grpcServer, walletHandler)
	gumav1.RegisterAuctionServiceServer(grpcServer, auctionHandler)
	gumav1.RegisterEventServiceServer(grpcServer, eventHandler)
	gumav1.RegisterLotteryServiceServer(grpcServer, lotteryHandler)
	gumav1.RegisterBankServiceServer(grpcServer, bankHandler)
	gumav1.RegisterHealthServiceServer(grpcServer, healthHandler)

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

// HealthService returns the health service
func (s *Server) HealthService() *health.Service {
	return s.healthService
}
