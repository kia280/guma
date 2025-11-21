package health

import (
	"context"
	"time"

	"github.com/kia280/guma/internal/database"
)

// DependencyChecker provides methods to check health of application dependencies
type DependencyChecker struct {
	dbPool       *database.Pool
	dbTimeout    time.Duration
	redisTimeout time.Duration
}

// NewDependencyChecker creates a new DependencyChecker
func NewDependencyChecker(dbPool *database.Pool) *DependencyChecker {
	return &DependencyChecker{
		dbPool:       dbPool,
		dbTimeout:    2 * time.Second,
		redisTimeout: 2 * time.Second,
	}
}

// CheckDatabase checks if PostgreSQL database is accessible
func (dc *DependencyChecker) CheckDatabase(ctx context.Context) bool {
	if dc.dbPool == nil {
		return false
	}

	ctx, cancel := context.WithTimeout(ctx, dc.dbTimeout)
	defer cancel()

	// Simple connectivity check - execute SELECT 1
	var result int
	err := dc.dbPool.QueryRow(ctx, "SELECT 1").Scan(&result)
	return err == nil && result == 1
}

// SetDatabaseTimeout sets the timeout for database checks
func (dc *DependencyChecker) SetDatabaseTimeout(timeout time.Duration) {
	dc.dbTimeout = timeout
}
