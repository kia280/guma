package handlers

import (
	"context"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/status"

	"github.com/kia280/guma/internal/services/health"
)

type stubReadiness struct {
	ready bool
}

func (s *stubReadiness) Ready(context.Context) bool {
	return s.ready
}

func checkStatus(t *testing.T, h *HealthHandler, service string) healthpb.HealthCheckResponse_ServingStatus {
	t.Helper()
	resp, err := h.server.Check(context.Background(), &healthpb.HealthCheckRequest{Service: service})
	require.NoError(t, err)
	return resp.GetStatus()
}

func TestHealthHandler_InitialStatus(t *testing.T) {
	h := NewHealthHandler(&stubReadiness{ready: true}, time.Second, zerolog.Nop())

	assert.Equal(t, healthpb.HealthCheckResponse_SERVING, checkStatus(t, h, health.LivenessService))
	assert.Equal(t, healthpb.HealthCheckResponse_NOT_SERVING, checkStatus(t, h, health.ReadinessService))
	assert.Equal(t, healthpb.HealthCheckResponse_NOT_SERVING, checkStatus(t, h, ""))
}

func TestHealthHandler_RefreshTracksReadiness(t *testing.T) {
	checker := &stubReadiness{ready: true}
	h := NewHealthHandler(checker, time.Second, zerolog.Nop())

	h.Refresh(context.Background())
	assert.Equal(t, healthpb.HealthCheckResponse_SERVING, checkStatus(t, h, health.ReadinessService))
	assert.Equal(t, healthpb.HealthCheckResponse_SERVING, checkStatus(t, h, ""))

	checker.ready = false
	h.Refresh(context.Background())
	assert.Equal(t, healthpb.HealthCheckResponse_NOT_SERVING, checkStatus(t, h, health.ReadinessService))
	assert.Equal(t, healthpb.HealthCheckResponse_NOT_SERVING, checkStatus(t, h, ""))
	assert.Equal(t, healthpb.HealthCheckResponse_SERVING, checkStatus(t, h, health.LivenessService))
}

func TestHealthHandler_ShutdownStopsServing(t *testing.T) {
	h := NewHealthHandler(&stubReadiness{ready: true}, time.Second, zerolog.Nop())
	h.Refresh(context.Background())

	h.Shutdown()
	h.Refresh(context.Background())

	assert.Equal(t, healthpb.HealthCheckResponse_NOT_SERVING, checkStatus(t, h, health.LivenessService))
	assert.Equal(t, healthpb.HealthCheckResponse_NOT_SERVING, checkStatus(t, h, health.ReadinessService))
	assert.Equal(t, healthpb.HealthCheckResponse_NOT_SERVING, checkStatus(t, h, ""))
}

func TestHealthHandler_UnknownService(t *testing.T) {
	h := NewHealthHandler(&stubReadiness{}, time.Second, zerolog.Nop())

	_, err := h.server.Check(context.Background(), &healthpb.HealthCheckRequest{Service: "unknown"})
	assert.Equal(t, codes.NotFound, status.Code(err))
}
