package health

import (
	"context"
	"sync/atomic"

	"github.com/kia280/guma/internal/database"
)

const (
	LivenessService  = "liveness"
	ReadinessService = "readiness"
)

// Service provides health check functionality for Kubernetes probes
type Service struct {
	checker         *DependencyChecker
	startupComplete atomic.Bool
}

// NewService creates a new health check service
func NewService(pool *database.Pool) *Service {
	return &Service{checker: NewDependencyChecker(pool)}
}

func (s *Service) Ready(ctx context.Context) bool {
	return s.startupComplete.Load() && s.checker.CheckDatabase(ctx)
}

// MarkStartupComplete marks the application startup as complete
func (s *Service) MarkStartupComplete() {
	s.startupComplete.Store(true)
}
