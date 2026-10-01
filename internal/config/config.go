package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/spf13/viper"
)

// Config holds all configuration for the application
type Config struct {
	// Server configuration
	Server ServerConfig `mapstructure:"server"`

	// Database configuration
	Database DatabaseConfig `mapstructure:"database"`

	// Authentication configuration
	Auth AuthConfig `mapstructure:"auth"`

	// Logging configuration
	Logging LoggingConfig `mapstructure:"logging"`

	// CORS configuration
	CORS CORSConfig `mapstructure:"cors"`

	// Development tooling configuration
	Dev DevConfig `mapstructure:"dev"`

	// Background job scheduling configuration
	Scheduler SchedulerConfig `mapstructure:"scheduler"`

	Metrics MetricsConfig `mapstructure:"metrics"`

	// Distributed tracing configuration
	Tracing TracingConfig `mapstructure:"tracing"`
}

// ServerConfig holds server-specific configuration
type ServerConfig struct {
	Port        int    `mapstructure:"port"`
	Host        string `mapstructure:"host"`
	Environment string `mapstructure:"env"`
	GRPCPort    int    `mapstructure:"grpc_port"`
}

// DatabaseConfig holds database connection configuration
type DatabaseConfig struct {
	URL          string `mapstructure:"url"`
	MaxOpenConns int    `mapstructure:"max_open_conns"`
	MaxIdleConns int    `mapstructure:"max_idle_conns"`
}

// AuthConfig holds authentication configuration
type AuthConfig struct {
	KratosPublicURL string `mapstructure:"kratos_public_url"`
	KratosAdminURL  string `mapstructure:"kratos_admin_url"`
}

// DevConfig holds development-only tooling configuration
type DevConfig struct {
	AuthEnabled bool `mapstructure:"auth_enabled"`
}

// SchedulerConfig holds background job scheduling configuration
type SchedulerConfig struct {
	RaffleDrawInterval    time.Duration `mapstructure:"raffle_draw_interval"`
	AuctionSettleInterval time.Duration `mapstructure:"auction_settle_interval"`
}

type MetricsConfig struct {
	Enabled        bool          `mapstructure:"enabled"`
	Endpoint       string        `mapstructure:"endpoint"`
	Protocol       string        `mapstructure:"protocol"`
	Insecure       bool          `mapstructure:"insecure"`
	Headers        string        `mapstructure:"headers"`
	ExportInterval time.Duration `mapstructure:"export_interval"`
}

const (
	MetricsProtocolGRPC         = "grpc"
	MetricsProtocolHTTPProtobuf = "http/protobuf"
)

// LoggingConfig holds logging configuration
type LoggingConfig struct {
	Level  string `mapstructure:"level"`
	Format string `mapstructure:"format"`
}

// CORSConfig holds CORS configuration
type CORSConfig struct {
	AllowedOrigins []string `mapstructure:"allowed_origins"`
	AllowedMethods []string `mapstructure:"allowed_methods"`
	AllowedHeaders []string `mapstructure:"allowed_headers"`
}

// Load loads configuration from environment variables and config files
func Load() (*Config, error) {
	v := viper.New()

	// Set default values
	setDefaults(v)

	// Read from environment variables
	v.SetEnvPrefix("GUMA")
	v.AutomaticEnv()
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	// Allow environment variables without prefix for common vars
	v.BindEnv("database.url", "DATABASE_URL")
	v.BindEnv("database.max_open_conns", "DATABASE_MAX_OPEN_CONNS")
	v.BindEnv("database.max_idle_conns", "DATABASE_MAX_IDLE_CONNS")
	v.BindEnv("server.port", "PORT")
	v.BindEnv("server.host", "HOST")
	v.BindEnv("server.env", "ENV")
	v.BindEnv("logging.level", "LOG_LEVEL")
	v.BindEnv("logging.format", "LOG_FORMAT")
	v.BindEnv("cors.allowed_origins", "CORS_ALLOWED_ORIGINS")
	v.BindEnv("cors.allowed_methods", "CORS_ALLOWED_METHODS")
	v.BindEnv("cors.allowed_headers", "CORS_ALLOWED_HEADERS")
	v.BindEnv("dev.auth_enabled", "DEV_AUTH_ENABLED")
	v.BindEnv("scheduler.raffle_draw_interval", "SCHEDULER_RAFFLE_DRAW_INTERVAL")
	v.BindEnv("scheduler.auction_settle_interval", "SCHEDULER_AUCTION_SETTLE_INTERVAL")
	v.BindEnv("metrics.enabled", "METRICS_ENABLED")
	v.BindEnv("metrics.endpoint", "METRICS_ENDPOINT")
	v.BindEnv("metrics.protocol", "METRICS_PROTOCOL")
	v.BindEnv("metrics.insecure", "METRICS_INSECURE")
	v.BindEnv("metrics.headers", "METRICS_HEADERS")
	v.BindEnv("metrics.export_interval", "METRICS_EXPORT_INTERVAL")
	bindTracingEnv(v)

	// Try to read config file
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("./config")
	v.AddConfigPath("/etc/guma")

	// Config file is optional
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}
	}

	var config Config
	if err := v.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Validate required fields
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	return &config, nil
}

// setDefaults sets default configuration values
func setDefaults(v *viper.Viper) {
	// Server defaults
	v.SetDefault("server.port", 8080)
	v.SetDefault("server.host", "localhost")
	v.SetDefault("server.env", "development")
	v.SetDefault("server.grpc_port", 50051)

	// Database defaults
	v.SetDefault("database.max_open_conns", 25)
	v.SetDefault("database.max_idle_conns", 5)

	// Logging defaults
	v.SetDefault("logging.level", "info")
	v.SetDefault("logging.format", "json")

	// CORS defaults
	v.SetDefault("cors.allowed_origins", []string{"http://localhost:3000"})
	v.SetDefault("cors.allowed_methods", []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"})
	v.SetDefault("cors.allowed_headers", []string{"Content-Type", "Authorization"})

	v.SetDefault("scheduler.raffle_draw_interval", "15s")
	v.SetDefault("scheduler.auction_settle_interval", "15s")

	v.SetDefault("metrics.enabled", false)
	v.SetDefault("metrics.endpoint", "")
	v.SetDefault("metrics.protocol", MetricsProtocolGRPC)
	v.SetDefault("metrics.insecure", false)
	v.SetDefault("metrics.headers", "")
	v.SetDefault("metrics.export_interval", "15s")

	setTracingDefaults(v)
}

// Validate validates the configuration
func (c *Config) Validate() error {
	if c.Database.URL == "" {
		return fmt.Errorf("database URL is required")
	}

	if c.Server.Port < 1 || c.Server.Port > 65535 {
		return fmt.Errorf("invalid server port: %d", c.Server.Port)
	}

	if c.Server.GRPCPort < 1 || c.Server.GRPCPort > 65535 {
		return fmt.Errorf("invalid gRPC port: %d", c.Server.GRPCPort)
	}

	if err := c.CORS.Validate(); err != nil {
		return err
	}

	if c.Dev.AuthEnabled && !c.IsDevelopment() {
		return fmt.Errorf("dev auth can only be enabled when server.env is development, got %q", c.Server.Environment)
	}

	if err := c.Tracing.Validate(); err != nil {
		return err
	}

	return c.Metrics.Validate()
}

func (c CORSConfig) Validate() error {
	for _, origin := range c.AllowedOrigins {
		if origin == "*" {
			return fmt.Errorf("cors allowed origins must list explicit origins; %q is not allowed with credentialed requests", origin)
		}
	}
	return nil
}

func (m MetricsConfig) Validate() error {
	if !m.Enabled {
		return nil
	}

	switch m.Protocol {
	case MetricsProtocolGRPC, MetricsProtocolHTTPProtobuf:
	default:
		return fmt.Errorf("invalid metrics protocol %q: must be %q or %q", m.Protocol, MetricsProtocolGRPC, MetricsProtocolHTTPProtobuf)
	}

	if m.ExportInterval <= 0 {
		return fmt.Errorf("metrics export interval must be positive, got %s", m.ExportInterval)
	}

	return nil
}

// IsDevelopment returns true if running in development mode
func (c *Config) IsDevelopment() bool {
	return c.Server.Environment == "development"
}

// IsProduction returns true if running in production mode
func (c *Config) IsProduction() bool {
	return c.Server.Environment == "production"
}
