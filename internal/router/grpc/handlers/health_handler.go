package handlers

import (
	"context"
	"time"

	"github.com/rs/zerolog"
	"google.golang.org/grpc"
	grpchealth "google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"

	"github.com/kia280/guma/internal/services/health"
)

type ReadinessChecker interface {
	Ready(ctx context.Context) bool
}

type HealthHandler struct {
	server    *grpchealth.Server
	checker   ReadinessChecker
	interval  time.Duration
	logger    zerolog.Logger
	lastReady *bool
}

func NewHealthHandler(checker ReadinessChecker, interval time.Duration, logger zerolog.Logger) *HealthHandler {
	server := grpchealth.NewServer()
	server.SetServingStatus(health.LivenessService, healthpb.HealthCheckResponse_SERVING)
	server.SetServingStatus(health.ReadinessService, healthpb.HealthCheckResponse_NOT_SERVING)
	server.SetServingStatus("", healthpb.HealthCheckResponse_NOT_SERVING)

	return &HealthHandler{
		server:   server,
		checker:  checker,
		interval: interval,
		logger:   logger.With().Str("service", "health").Logger(),
	}
}

func (h *HealthHandler) Register(registrar grpc.ServiceRegistrar) {
	healthpb.RegisterHealthServer(registrar, h.server)
}

func (h *HealthHandler) Run(ctx context.Context) {
	h.Refresh(ctx)

	ticker := time.NewTicker(h.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			h.Refresh(ctx)
		}
	}
}

func (h *HealthHandler) Refresh(ctx context.Context) {
	ready := h.checker.Ready(ctx)

	status := healthpb.HealthCheckResponse_NOT_SERVING
	if ready {
		status = healthpb.HealthCheckResponse_SERVING
	}
	h.server.SetServingStatus(health.ReadinessService, status)
	h.server.SetServingStatus("", status)

	if h.lastReady == nil || *h.lastReady != ready {
		h.logger.Info().Bool("ready", ready).Msg("readiness changed")
		h.lastReady = &ready
	}
}

func (h *HealthHandler) Shutdown() {
	h.server.Shutdown()
	h.logger.Info().Msg("health checks set to not serving")
}
