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
		Keto:     KetoConfig{ReadAddr: "keto:4466", WriteAddr: "keto:4467", OutboxSweepInterval: time.Second},
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

func TestLoad_TracingDefaultsAndEnv(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/guma")
	t.Setenv("ENV", "development")
	t.Chdir(t.TempDir())

	cfg, err := Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if cfg.Tracing.Enabled {
		t.Fatal("expected tracing to be disabled by default")
	}
	if cfg.Tracing.Protocol != TracingProtocolGRPC {
		t.Fatalf("expected default tracing protocol %q, got %q", TracingProtocolGRPC, cfg.Tracing.Protocol)
	}
	if cfg.Tracing.SampleRate != 1 {
		t.Fatalf("expected default sample rate 1, got %v", cfg.Tracing.SampleRate)
	}

	t.Setenv("TRACING_ENABLED", "true")
	t.Setenv("TRACING_ENDPOINT", "http://collector:4318")
	t.Setenv("TRACING_PROTOCOL", TracingProtocolHTTP)
	t.Setenv("TRACING_INSECURE", "true")
	t.Setenv("TRACING_HEADERS", "authorization=Bearer token, x-tenant = guma")
	t.Setenv("TRACING_SAMPLE_RATE", "0.25")

	cfg, err = Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	want := TracingConfig{
		Enabled:    true,
		Endpoint:   "http://collector:4318",
		Protocol:   TracingProtocolHTTP,
		Insecure:   true,
		Headers:    "authorization=Bearer token, x-tenant = guma",
		SampleRate: 0.25,
	}
	if cfg.Tracing != want {
		t.Fatalf("expected tracing config %+v, got %+v", want, cfg.Tracing)
	}
	headers, err := cfg.Tracing.ParsedHeaders()
	if err != nil {
		t.Fatalf("parse headers: %v", err)
	}
	if headers["authorization"] != "Bearer token" || headers["x-tenant"] != "guma" || len(headers) != 2 {
		t.Fatalf("unexpected parsed headers %v", headers)
	}

	t.Setenv("TRACING_SAMPLE_RATE", "1.5")
	if _, err := Load(); err == nil {
		t.Fatal("expected error for out-of-range sample rate")
	}
}

func TestValidate_Tracing(t *testing.T) {
	valid := TracingConfig{Enabled: true, Protocol: TracingProtocolGRPC, SampleRate: 0.5}

	tests := []struct {
		name    string
		mutate  func(*TracingConfig)
		wantErr bool
	}{
		{name: "valid grpc", mutate: func(*TracingConfig) {}},
		{name: "valid http", mutate: func(c *TracingConfig) { c.Protocol = TracingProtocolHTTP }},
		{name: "sample rate zero", mutate: func(c *TracingConfig) { c.SampleRate = 0 }},
		{name: "sample rate one", mutate: func(c *TracingConfig) { c.SampleRate = 1 }},
		{name: "negative sample rate", mutate: func(c *TracingConfig) { c.SampleRate = -0.1 }, wantErr: true},
		{name: "sample rate above one", mutate: func(c *TracingConfig) { c.SampleRate = 1.1 }, wantErr: true},
		{name: "unknown protocol", mutate: func(c *TracingConfig) { c.Protocol = "http/json" }, wantErr: true},
		{name: "malformed header", mutate: func(c *TracingConfig) { c.Headers = "authorization" }, wantErr: true},
		{name: "empty header key", mutate: func(c *TracingConfig) { c.Headers = "=value" }, wantErr: true},
		{name: "disabled skips validation", mutate: func(c *TracingConfig) {
			c.Enabled = false
			c.Protocol = ""
			c.SampleRate = 2
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := Config{
				Server:   ServerConfig{Port: 8080, GRPCPort: 50051, Environment: "production"},
				Database: DatabaseConfig{URL: "postgres://localhost/guma"},
				Keto:     KetoConfig{ReadAddr: "keto:4466", WriteAddr: "keto:4467", OutboxSweepInterval: time.Second},
				Tracing:  valid,
			}
			tt.mutate(&cfg.Tracing)
			err := cfg.Validate()
			if tt.wantErr && err == nil {
				t.Fatal("expected validation error")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("unexpected validation error: %v", err)
			}
		})
	}
}

func TestLoad_KetoDefaultsAndEnv(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/guma")
	t.Chdir(t.TempDir())

	cfg, err := Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if cfg.Keto.ReadAddr != "localhost:4466" || cfg.Keto.WriteAddr != "localhost:4467" {
		t.Fatalf("unexpected default keto addresses %q, %q", cfg.Keto.ReadAddr, cfg.Keto.WriteAddr)
	}
	if cfg.Keto.OutboxSweepInterval != 5*time.Second {
		t.Fatalf("expected default outbox sweep interval 5s, got %s", cfg.Keto.OutboxSweepInterval)
	}

	t.Setenv("KETO_READ_ADDR", "keto:4466")
	t.Setenv("KETO_WRITE_ADDR", "keto:4467")
	t.Setenv("KETO_OUTBOX_SWEEP_INTERVAL", "1m")
	cfg, err = Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if cfg.Keto.ReadAddr != "keto:4466" || cfg.Keto.WriteAddr != "keto:4467" || cfg.Keto.OutboxSweepInterval != time.Minute {
		t.Fatalf("expected env overrides, got %+v", cfg.Keto)
	}
}

func TestKetoConfigValidate(t *testing.T) {
	valid := KetoConfig{ReadAddr: "keto:4466", WriteAddr: "keto:4467", OutboxSweepInterval: time.Second}
	if err := valid.Validate(); err != nil {
		t.Fatalf("expected valid config: %v", err)
	}
	for name, cfg := range map[string]KetoConfig{
		"missing read":  {WriteAddr: "keto:4467", OutboxSweepInterval: time.Second},
		"missing write": {ReadAddr: "keto:4466", OutboxSweepInterval: time.Second},
		"zero interval": {ReadAddr: "keto:4466", WriteAddr: "keto:4467"},
	} {
		if err := cfg.Validate(); err == nil {
			t.Errorf("%s: expected validation error", name)
		}
	}
}
