package cmd

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rs/zerolog"
	"github.com/spf13/cobra"

	"github.com/kia280/guma/internal/config"
	"github.com/kia280/guma/internal/database"
	"github.com/kia280/guma/internal/events"
	"github.com/kia280/guma/internal/router/gateway"
	"github.com/kia280/guma/internal/router/grpc"
	"github.com/kia280/guma/internal/scheduler"
	lotterysvc "github.com/kia280/guma/internal/services/lottery"
)

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start the Guma server",
	Long:  `Start the Guma gRPC and HTTP gateway servers`,
	Run:   runServe,
}

func init() {
	rootCmd.AddCommand(serveCmd)
}

func runServe(cmd *cobra.Command, args []string) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		logger := initLogger(&config.Config{
			Logging: config.LoggingConfig{Level: "info"},
		})
		logger.Fatal().Err(err).Msg("failed to load configuration")
		return
	}

	// Initialize logger
	logger := initLogger(cfg)
	logger.Info().Msg("starting Guma server")

	// Initialize database
	db, err := database.NewPool(ctx, database.Config{
		URL:          cfg.Database.URL,
		MaxOpenConns: int32(cfg.Database.MaxOpenConns),
		MaxIdleConns: int32(cfg.Database.MaxIdleConns),
		Logger:       logger,
	})
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to connect to database")
		return
	}
	defer db.Close()

	logger.Info().Msg("database connection established")

	broker := events.NewBroker()
	go events.Listen(ctx, db, broker, logger)

	// Create gRPC server
	grpcServer, err := grpc.NewServer(cfg, db, broker, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to create gRPC server")
		return
	}

	// Start gRPC server in background
	go func() {
		if err := grpcServer.Start(); err != nil {
			logger.Fatal().Err(err).Msg("gRPC server failed")
		}
	}()

	// Get gRPC address for gateway
	grpcAddr := grpcServer.Address()

	// Create HTTP gateway
	gw, err := gateway.NewGateway(ctx, cfg, db, grpcAddr, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to create HTTP gateway")
		return
	}

	// Start HTTP gateway in background
	go func() {
		if err := gw.Start(); err != nil {
			logger.Fatal().Err(err).Msg("HTTP gateway failed")
		}
	}()

	logger.Info().Msg("servers started successfully")
	logger.Info().Msg("gRPC server listening on " + grpcAddr)
	logger.Info().Msg("HTTP gateway listening on " + gw.Address())

	// Mark health service startup as complete
	grpcServer.MarkStartupComplete()
	go grpcServer.RunHealthChecks(ctx)
	logger.Info().Msg("health service startup marked as complete")

	lotteries := lotterysvc.New(db, logger)
	jobs := scheduler.New(logger, scheduler.Job{
		Name:     "lottery-draw",
		Interval: cfg.Scheduler.LotteryDrawInterval,
		Run: func(ctx context.Context) error {
			_, err := lotteries.DrawDueLotteries(ctx)
			return err
		},
	})
	jobs.Start(ctx)

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info().Msg("shutting down servers")
	grpcServer.MarkShuttingDown()

	cancel()
	broker.Close()
	jobs.Wait()

	// Graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	// Shutdown HTTP gateway
	if err := gw.Stop(shutdownCtx); err != nil {
		logger.Error().Err(err).Msg("HTTP gateway shutdown error")
	}

	// Shutdown gRPC server
	if err := grpcServer.Stop(shutdownCtx); err != nil {
		logger.Error().Err(err).Msg("gRPC server shutdown error")
	}

	logger.Info().Msg("servers stopped")
}

func initLogger(cfg *config.Config) zerolog.Logger {
	level, err := zerolog.ParseLevel(cfg.Logging.Level)
	if err != nil {
		level = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(level)

	var logger zerolog.Logger
	if cfg.IsDevelopment() {
		logger = zerolog.New(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339}).
			Level(level).
			With().
			Timestamp().
			Caller().
			Str("service", "guma-backend").
			Logger()
	} else {
		logger = zerolog.New(os.Stdout).
			Level(level).
			With().
			Timestamp().
			Str("service", "guma-backend").
			Str("version", "1.0.0").
			Str("environment", cfg.Server.Environment).
			Logger()
	}

	return logger
}
