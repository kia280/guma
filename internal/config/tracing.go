package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

const (
	TracingProtocolGRPC = "grpc"
	TracingProtocolHTTP = "http/protobuf"
)

// TracingConfig holds OpenTelemetry distributed tracing configuration
type TracingConfig struct {
	Enabled    bool    `mapstructure:"enabled"`
	Endpoint   string  `mapstructure:"endpoint"`
	Protocol   string  `mapstructure:"protocol"`
	Insecure   bool    `mapstructure:"insecure"`
	Headers    string  `mapstructure:"headers"`
	SampleRate float64 `mapstructure:"sample_rate"`
}

func setTracingDefaults(v *viper.Viper) {
	v.SetDefault("tracing.enabled", false)
	v.SetDefault("tracing.endpoint", "")
	v.SetDefault("tracing.protocol", TracingProtocolGRPC)
	v.SetDefault("tracing.insecure", false)
	v.SetDefault("tracing.headers", "")
	v.SetDefault("tracing.sample_rate", 1.0)
}

func bindTracingEnv(v *viper.Viper) {
	v.BindEnv("tracing.enabled", "TRACING_ENABLED")
	v.BindEnv("tracing.endpoint", "TRACING_ENDPOINT")
	v.BindEnv("tracing.protocol", "TRACING_PROTOCOL")
	v.BindEnv("tracing.insecure", "TRACING_INSECURE")
	v.BindEnv("tracing.headers", "TRACING_HEADERS")
	v.BindEnv("tracing.sample_rate", "TRACING_SAMPLE_RATE")
}

// Validate validates the tracing configuration
func (t TracingConfig) Validate() error {
	if !t.Enabled {
		return nil
	}

	switch t.Protocol {
	case TracingProtocolGRPC, TracingProtocolHTTP:
	default:
		return fmt.Errorf("invalid tracing protocol %q: must be %q or %q", t.Protocol, TracingProtocolGRPC, TracingProtocolHTTP)
	}

	if t.SampleRate < 0 || t.SampleRate > 1 {
		return fmt.Errorf("invalid tracing sample rate %v: must be between 0.0 and 1.0", t.SampleRate)
	}

	if _, err := t.ParsedHeaders(); err != nil {
		return err
	}

	return nil
}

// ParsedHeaders parses Headers in the OTLP "key1=value1,key2=value2" format
func (t TracingConfig) ParsedHeaders() (map[string]string, error) {
	headers := map[string]string{}
	for pair := range strings.SplitSeq(t.Headers, ",") {
		if strings.TrimSpace(pair) == "" {
			continue
		}
		key, value, ok := strings.Cut(pair, "=")
		key = strings.TrimSpace(key)
		if !ok || key == "" {
			return nil, fmt.Errorf("invalid tracing header %q: expected key=value", pair)
		}
		headers[key] = strings.TrimSpace(value)
	}
	return headers, nil
}
