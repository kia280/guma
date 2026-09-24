package scheduler

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

type Job struct {
	Name     string
	Interval time.Duration
	Run      func(ctx context.Context) error
}

type Scheduler struct {
	logger zerolog.Logger
	jobs   []Job
	wg     sync.WaitGroup
}

func New(logger zerolog.Logger, jobs ...Job) *Scheduler {
	return &Scheduler{logger: logger.With().Str("component", "scheduler").Logger(), jobs: jobs}
}

func (s *Scheduler) Start(ctx context.Context) {
	for _, job := range s.jobs {
		if job.Interval <= 0 {
			s.logger.Warn().Str("job", job.Name).Msg("job disabled: non-positive interval")
			continue
		}
		s.wg.Add(1)
		go func(job Job) {
			defer s.wg.Done()
			s.loop(ctx, job)
		}(job)
		s.logger.Info().Str("job", job.Name).Dur("interval", job.Interval).Msg("job scheduled")
	}
}

func (s *Scheduler) Wait() {
	s.wg.Wait()
}

func (s *Scheduler) loop(ctx context.Context, job Job) {
	ticker := time.NewTicker(job.Interval)
	defer ticker.Stop()
	for {
		s.runOnce(ctx, job)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (s *Scheduler) runOnce(ctx context.Context, job Job) {
	if ctx.Err() != nil {
		return
	}
	defer func() {
		if r := recover(); r != nil {
			s.logger.Error().Str("job", job.Name).Str("panic", fmt.Sprint(r)).Msg("job panicked")
		}
	}()
	if err := job.Run(ctx); err != nil && ctx.Err() == nil {
		s.logger.Error().Err(err).Str("job", job.Name).Msg("job failed")
	}
}
