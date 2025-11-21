package services

import (
	"context"
	"net/http"

	"github.com/rs/zerolog"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
)

// HealthServiceChecker defines the interface for health service operations
type HealthServiceChecker interface {
	CheckReadiness(ctx context.Context) (*gumav1.CheckResponse, error)
	CheckLiveness(ctx context.Context) (*gumav1.CheckResponse, error)
	MarkStartupComplete()
	MarkStartupFailed()
	IsStartupComplete() bool
}

// HealthServiceHandler implements the HealthService gRPC service
type HealthServiceHandler struct {
	gumav1.UnimplementedHealthServiceServer
	healthService HealthServiceChecker
	logger        zerolog.Logger
}

// NewHealthServiceHandler creates a new HealthService handler
func NewHealthServiceHandler(healthService HealthServiceChecker, logger zerolog.Logger) *HealthServiceHandler {
	return &HealthServiceHandler{
		healthService: healthService,
		logger:        logger.With().Str("service", "health").Logger(),
	}
}

// CheckReady checks if the application is ready to serve traffic
func (s *HealthServiceHandler) CheckReady(ctx context.Context, req *gumav1.CheckReadyRequest) (*gumav1.CheckResponse, error) {
	logger := s.logger.With().
		Str("operation", "checkReady").
		Logger()

	logger.Debug().Msg("readiness probe received")

	// Perform the readiness check
	response, err := s.healthService.CheckReadiness(ctx)
	if err != nil {
		logger.Error().Err(err).Msg("readiness check failed")
		return &gumav1.CheckResponse{
			Status:          gumav1.StatusCode_STATUS_CODE_UNKNOWN,
			Database:        false,
			Redis:           false,
			StartupComplete: false,
			Timestamp:       0,
		}, status.Error(codes.Internal, "readiness check failed")
	}

	httpStatus := getReadyHTTPStatus(response)

	logger.Debug().
		Str("status", response.Status.String()).
		Int("http_status", httpStatus).
		Bool("database", response.Database).
		Bool("redis", response.Redis).
		Bool("startup_complete", response.StartupComplete).
		Msg("readiness check completed")

	// Set HTTP status code in gRPC response metadata (for JSON transcoding)
	if err := grpc.SetHeader(ctx, metadata.Pairs("http-status", string(rune(httpStatus)))); err != nil {
		logger.Debug().Err(err).Msg("failed to set HTTP status header")
	}

	return response, nil
}

// CheckLive checks if the application process is responsive
func (s *HealthServiceHandler) CheckLive(ctx context.Context, req *gumav1.CheckLiveRequest) (*gumav1.CheckResponse, error) {
	logger := s.logger.With().
		Str("operation", "checkLive").
		Logger()

	logger.Debug().Msg("liveness probe received")

	// Perform the liveness check
	response, err := s.healthService.CheckLiveness(ctx)
	if err != nil {
		logger.Error().Err(err).Msg("liveness check failed")
		return &gumav1.CheckResponse{
			Status:          gumav1.StatusCode_STATUS_CODE_UNKNOWN,
			Database:        false,
			Redis:           false,
			StartupComplete: false,
			Timestamp:       0,
		}, status.Error(codes.Internal, "liveness check failed")
	}

	httpStatus := getLiveHTTPStatus()

	logger.Debug().
		Str("status", response.Status.String()).
		Int("http_status", httpStatus).
		Bool("startup_complete", response.StartupComplete).
		Msg("liveness check completed")

	// Set HTTP status code in gRPC response metadata (for JSON transcoding)
	if err := grpc.SetHeader(ctx, metadata.Pairs("http-status", string(rune(httpStatus)))); err != nil {
		logger.Debug().Err(err).Msg("failed to set HTTP status header")
	}

	return response, nil
}

// getReadyHTTPStatus returns HTTP status for readiness probe
func getReadyHTTPStatus(response *gumav1.CheckResponse) int {
	// Readiness: 200 if ready, 503 if not ready
	if response.Status == gumav1.StatusCode_STATUS_CODE_SERVING {
		return http.StatusOK
	}
	return http.StatusServiceUnavailable
}

// getLiveHTTPStatus returns HTTP status for liveness probe
func getLiveHTTPStatus() int {
	// Liveness: Always 200 if we get here (process is responsive)
	return http.StatusOK
}
