package config

import (
	"slices"
	"testing"
	"time"
)

func TestValidate_DevAuthRequiresDevelopment(t *testing.T) {
	base := Config{
		Server:   ServerConfig{Port: 8080, GRPCPort: 50051},
		Database: DatabaseConfig{URL: "postgres://localhost/guma"},
		Dev:      DevConfig{AuthEnabled: true},
	}

	for _, env := range []string{"production", "staging", ""} {
		cfg := base
		cfg.Server.Environment = env
		if err := cfg.Validate(); err == nil {
			t.Fatalf("expected error for dev auth with env %q", env)
		}
	}

	cfg := base
	cfg.Server.Environment = "development"
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected dev auth to be allowed in development: %v", err)
	}
}

func TestLoad_SchedulerAndCORSDefaults(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/guma")
	t.Setenv("ENV", "development")
	t.Chdir(t.TempDir())

	cfg, err := Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if cfg.Scheduler.LotteryDrawInterval != 15*time.Second {
		t.Fatalf("expected default lottery draw interval 15s, got %s", cfg.Scheduler.LotteryDrawInterval)
	}
	if !slices.Contains(cfg.CORS.AllowedMethods, "PATCH") {
		t.Fatalf("expected PATCH in default CORS methods, got %v", cfg.CORS.AllowedMethods)
	}

	t.Setenv("SCHEDULER_LOTTERY_DRAW_INTERVAL", "1m")
	cfg, err = Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if cfg.Scheduler.LotteryDrawInterval != time.Minute {
		t.Fatalf("expected env override 1m, got %s", cfg.Scheduler.LotteryDrawInterval)
	}
}
