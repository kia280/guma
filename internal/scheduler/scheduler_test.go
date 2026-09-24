package scheduler

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/rs/zerolog"
)

func TestSchedulerRunsJobRepeatedlyUntilCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	var runs atomic.Int32
	s := New(zerolog.Nop(), Job{
		Name:     "count",
		Interval: 5 * time.Millisecond,
		Run: func(context.Context) error {
			if runs.Add(1) >= 3 {
				cancel()
			}
			return nil
		},
	})

	s.Start(ctx)
	waitOrFail(t, s)

	if got := runs.Load(); got < 3 {
		t.Fatalf("expected at least 3 runs, got %d", got)
	}
}

func TestSchedulerRunsImmediately(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	s := New(zerolog.Nop(), Job{
		Name:     "first",
		Interval: time.Hour,
		Run: func(context.Context) error {
			cancel()
			return nil
		},
	})

	s.Start(ctx)
	waitOrFail(t, s)
}

func TestSchedulerSurvivesErrorsAndPanics(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	var runs atomic.Int32
	s := New(zerolog.Nop(), Job{
		Name:     "flaky",
		Interval: 5 * time.Millisecond,
		Run: func(context.Context) error {
			switch runs.Add(1) {
			case 1:
				return errors.New("boom")
			case 2:
				panic("boom")
			default:
				cancel()
				return nil
			}
		},
	})

	s.Start(ctx)
	waitOrFail(t, s)

	if got := runs.Load(); got < 3 {
		t.Fatalf("expected job to keep running after failures, got %d runs", got)
	}
}

func TestSchedulerSkipsNonPositiveInterval(t *testing.T) {
	var runs atomic.Int32
	s := New(zerolog.Nop(), Job{
		Name:     "disabled",
		Interval: 0,
		Run: func(context.Context) error {
			runs.Add(1)
			return nil
		},
	})

	s.Start(context.Background())
	waitOrFail(t, s)

	if got := runs.Load(); got != 0 {
		t.Fatalf("expected disabled job not to run, got %d runs", got)
	}
}

func waitOrFail(t *testing.T, s *Scheduler) {
	t.Helper()
	done := make(chan struct{})
	go func() {
		s.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("scheduler did not stop")
	}
}
