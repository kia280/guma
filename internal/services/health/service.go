package health

import (
	"context"
	"sync"
	"time"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/database"
)

// Service provides health check functionality for Kubernetes probes
type Service struct {
	checker         *DependencyChecker
	startupComplete bool
	startupMutex    sync.RWMutex
}

// NewService creates a new health check service
func NewService(pool *database.Pool) *Service {
	checker := NewDependencyChecker(pool)
	return &Service{
		checker:         checker,
		startupComplete: false,
	}
}

// CheckReadiness checks if application is ready to serve traffic
// Returns 200 if all dependencies are available, 503 if any dependency is down
func (s *Service) CheckReadiness(ctx context.Context) (*gumav1.CheckResponse, error) {
	db := s.checker.CheckDatabase(ctx)
	// redis := s.checker.CheckRedis(ctx)

	s.startupMutex.RLock()
	startupComplete := s.startupComplete
	s.startupMutex.RUnlock()

	// Ready only if all dependencies are available AND startup is complete
	status := gumav1.StatusCode_STATUS_CODE_SERVING

	// TODO: add redis when implemented
	if !db || !startupComplete {
		status = gumav1.StatusCode_STATUS_CODE_NOT_READY
	}

	return &gumav1.CheckResponse{
		Status:          status,
		Database:        db,
		Redis:           false,
		StartupComplete: startupComplete,
		Timestamp:       time.Now().UnixNano(),
	}, nil
}

// CheckLiveness checks if application process is responsive
// Returns 200 if process is responsive (minimal check, no dependency verification)
func (s *Service) CheckLiveness(ctx context.Context) (*gumav1.CheckResponse, error) {
	// Liveness probe is just checking if the process is responsive
	// We don't check dependencies for liveness - just return SERVING if we can execute this
	s.startupMutex.RLock()
	startupComplete := s.startupComplete
	s.startupMutex.RUnlock()

	return &gumav1.CheckResponse{
		Status:          gumav1.StatusCode_STATUS_CODE_SERVING,
		Database:        false,
		Redis:           false,
		StartupComplete: startupComplete,
		Timestamp:       time.Now().UnixNano(),
	}, nil
}

// MarkStartupComplete marks the application startup as complete
func (s *Service) MarkStartupComplete() {
	s.startupMutex.Lock()
	defer s.startupMutex.Unlock()
	s.startupComplete = true
}

// MarkStartupFailed marks the application startup as failed
func (s *Service) MarkStartupFailed() {
	s.startupMutex.Lock()
	defer s.startupMutex.Unlock()
	s.startupComplete = false
}

// IsStartupComplete returns whether startup is complete
func (s *Service) IsStartupComplete() bool {
	s.startupMutex.RLock()
	defer s.startupMutex.RUnlock()
	return s.startupComplete
}
