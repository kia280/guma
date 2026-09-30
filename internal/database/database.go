package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

// Pool wraps pgxpool.Pool with additional functionality
type Pool struct {
	*pgxpool.Pool
	logger zerolog.Logger
}

// Config holds database configuration
type Config struct {
	URL          string
	MaxOpenConns int32
	MaxIdleConns int32
	Logger       zerolog.Logger
	Tracer       pgx.QueryTracer
}

// NewPool creates a new database connection pool
func NewPool(ctx context.Context, cfg Config) (*Pool, error) {
	logger := cfg.Logger.With().Str("component", "database").Logger()

	// Parse connection string
	config, err := pgxpool.ParseConfig(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	// Set connection pool limits
	config.MaxConns = cfg.MaxOpenConns
	config.MinConns = cfg.MaxIdleConns

	// Set connection timeouts
	config.ConnConfig.ConnectTimeout = 10 * time.Second
	config.ConnConfig.Tracer = cfg.Tracer

	// Create connection pool
	logger.Info().
		Int32("max_conns", cfg.MaxOpenConns).
		Int32("min_conns", cfg.MaxIdleConns).
		Msg("creating database connection pool")

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Verify connectivity
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	logger.Info().Msg("database connection established")

	return &Pool{
		Pool:   pool,
		logger: logger,
	}, nil
}

// Health checks the database connection health
func (p *Pool) Health(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := p.Ping(ctx); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}

	stats := p.Stat()
	p.logger.Debug().
		Int32("total_conns", stats.TotalConns()).
		Int32("idle_conns", stats.IdleConns()).
		Int32("acquired_conns", stats.AcquiredConns()).
		Msg("database connection pool stats")

	return nil
}

// Close closes the database connection pool
func (p *Pool) Close() {
	p.logger.Info().Msg("closing database connection pool")
	p.Pool.Close()
}

// Stats returns connection pool statistics
func (p *Pool) Stats() *pgxpool.Stat {
	return p.Pool.Stat()
}
