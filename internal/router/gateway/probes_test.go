package gateway

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"google.golang.org/grpc"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"

	"github.com/kia280/guma/internal/services/health"
)

type fakeHealthClient struct {
	healthpb.HealthClient
	statuses map[string]healthpb.HealthCheckResponse_ServingStatus
	err      error
}

func (f *fakeHealthClient) Check(_ context.Context, req *healthpb.HealthCheckRequest, _ ...grpc.CallOption) (*healthpb.HealthCheckResponse, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &healthpb.HealthCheckResponse{Status: f.statuses[req.GetService()]}, nil
}

func TestProbeMux(t *testing.T) {
	client := &fakeHealthClient{statuses: map[string]healthpb.HealthCheckResponse_ServingStatus{
		health.LivenessService:  healthpb.HealthCheckResponse_SERVING,
		health.ReadinessService: healthpb.HealthCheckResponse_NOT_SERVING,
	}}
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})
	mux := newProbeMux(client, next)

	tests := []struct {
		name   string
		method string
		path   string
		want   int
	}{
		{name: "live", method: http.MethodGet, path: "/livez", want: http.StatusOK},
		{name: "live head", method: http.MethodHead, path: "/livez", want: http.StatusOK},
		{name: "not ready", method: http.MethodGet, path: "/readyz", want: http.StatusServiceUnavailable},
		{name: "other paths pass through", method: http.MethodGet, path: "/v1/guilds", want: http.StatusTeapot},
		{name: "non-GET probe passes through", method: http.MethodPost, path: "/livez", want: http.StatusTeapot},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rr := httptest.NewRecorder()
			mux.ServeHTTP(rr, httptest.NewRequest(tt.method, tt.path, nil))

			if rr.Code != tt.want {
				t.Fatalf("expected status %d, got %d", tt.want, rr.Code)
			}
		})
	}
}

func TestProbeHandler_ClientError(t *testing.T) {
	handler := probeHandler(&fakeHealthClient{err: errors.New("unavailable")}, health.LivenessService)

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/livez", nil))

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503, got %d", rr.Code)
	}
	if got := rr.Header().Get("Cache-Control"); got != "no-store" {
		t.Fatalf("expected Cache-Control no-store, got %q", got)
	}
}
