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
	if cfg.Scheduler.RaffleDrawInterval != 15*time.Second {
		t.Fatalf("expected default raffle draw interval 15s, got %s", cfg.Scheduler.RaffleDrawInterval)
	}
	if !slices.Contains(cfg.CORS.AllowedMethods, "PATCH") {
		t.Fatalf("expected PATCH in default CORS methods, got %v", cfg.CORS.AllowedMethods)
	}

	t.Setenv("SCHEDULER_RAFFLE_DRAW_INTERVAL", "1m")
	cfg, err = Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if cfg.Scheduler.RaffleDrawInterval != time.Minute {
		t.Fatalf("expected env override 1m, got %s", cfg.Scheduler.RaffleDrawInterval)
	}
}

func TestLoad_MetricsDefaultsAndEnv(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/guma")
	t.Setenv("ENV", "development")
	t.Chdir(t.TempDir())

	cfg, err := Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if cfg.Metrics.Enabled {
		t.Fatal("expected metrics to be disabled by default")
	}
	if cfg.Metrics.Protocol != MetricsProtocolGRPC {
		t.Fatalf("expected default metrics protocol grpc, got %q", cfg.Metrics.Protocol)
	}
	if cfg.Metrics.ExportInterval != 15*time.Second {
		t.Fatalf("expected default metrics export interval 15s, got %s", cfg.Metrics.ExportInterval)
	}

	t.Setenv("METRICS_ENABLED", "true")
	t.Setenv("METRICS_ENDPOINT", "otel-collector:4318")
	t.Setenv("METRICS_PROTOCOL", "http/protobuf")
	t.Setenv("METRICS_INSECURE", "true")
	t.Setenv("METRICS_HEADERS", "api-key=secret")
	t.Setenv("METRICS_EXPORT_INTERVAL", "30s")
	cfg, err = Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	want := MetricsConfig{
		Enabled:        true,
		Endpoint:       "otel-collector:4318",
		Protocol:       MetricsProtocolHTTPProtobuf,
		Insecure:       true,
		Headers:        "api-key=secret",
		ExportInterval: 30 * time.Second,
	}
	if cfg.Metrics != want {
		t.Fatalf("expected metrics config %+v, got %+v", want, cfg.Metrics)
	}
}

func TestValidate_Metrics(t *testing.T) {
	valid := MetricsConfig{Enabled: true, Protocol: MetricsProtocolGRPC, ExportInterval: 15 * time.Second}
	if err := valid.Validate(); err != nil {
		t.Fatalf("expected valid metrics config: %v", err)
	}

	badProtocol := valid
	badProtocol.Protocol = "http/json"
	if err := badProtocol.Validate(); err == nil {
		t.Fatal("expected error for unsupported protocol")
	}

	badInterval := valid
	badInterval.ExportInterval = 0
	if err := badInterval.Validate(); err == nil {
		t.Fatal("expected error for non-positive export interval")
	}

	disabled := MetricsConfig{Protocol: "bogus"}
	if err := disabled.Validate(); err != nil {
		t.Fatalf("expected disabled metrics to skip validation: %v", err)
	}
}
