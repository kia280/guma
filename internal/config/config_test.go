package config

import "testing"

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
