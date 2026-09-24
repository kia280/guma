package gateway

import (
	"context"
	"fmt"
	"net/http"
	"time"

	healthpb "google.golang.org/grpc/health/grpc_health_v1"

	"github.com/kia280/guma/internal/services/health"
)

const probeTimeout = 3 * time.Second

func newProbeMux(client healthpb.HealthClient, next http.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("GET /livez", probeHandler(client, health.LivenessService))
	mux.Handle("GET /readyz", probeHandler(client, health.ReadinessService))
	mux.Handle("/", next)
	return mux
}

func probeHandler(client healthpb.HealthClient, service string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), probeTimeout)
		defer cancel()

		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")

		resp, err := client.Check(ctx, &healthpb.HealthCheckRequest{Service: service})
		if err != nil || resp.GetStatus() != healthpb.HealthCheckResponse_SERVING {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = fmt.Fprintf(w, "%s check failed\n", service)
			return
		}

		_, _ = fmt.Fprintln(w, "ok")
	}
}
