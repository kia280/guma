# Configuration

## Backend

The backend reads `config.yaml` from the working directory (or `./config/` or
`/etc/guma/`). Start from the example:

```bash
cp config.yaml.example config.yaml
```

Environment variables override the file: `GUMA_`-prefixed keys such as
`GUMA_SERVER_GRPC_PORT`, and plain variables such as `DATABASE_URL`,
`REDIS_URL`, `KRATOS_ADMIN_URL`, `PORT`, and `HOST`. See
[config.yaml.example](../config.yaml.example) for every setting.

The devcontainer also needs a Kratos config with your Discord client ID and
secret:

```bash
cp .devcontainer/config/kratos/kratos.yaml.example .devcontainer/config/kratos/kratos.yaml
```

Never commit `config.yaml`, `kratos.yaml`, or `.env` files.

## Frontend

Frontend variables (`NEXT_PUBLIC_*`) are listed in
[web/.env.example](../web/.env.example). Set `NEXT_PUBLIC_DEV_TOOLS=true` to
enable the dev panel, which switches to mock data, picks a mock role, and
previews color schemes and fonts.

## Observability

The backend can export OpenTelemetry metrics and traces over OTLP. Both are off
by default, so local development and tests need no collector.

- **Metrics** cover the gRPC server, the HTTP gateway, the Go runtime, and the
  database pool.
- **Traces** cover HTTP gateway requests, the gRPC calls they make, and the
  PostgreSQL queries issued while handling them. Context propagates with W3C
  `traceparent` and `baggage` headers, and gRPC request logs include a
  `trace_id` field.

### Metrics

| Setting (`config.yaml`) | Environment variable | Default | Description |
| --- | --- | --- | --- |
| `metrics.enabled` | `METRICS_ENABLED` | `false` | Turn metrics on |
| `metrics.endpoint` | `METRICS_ENDPOINT` | OTLP default | `host:port` or URL such as `localhost:4317` |
| `metrics.protocol` | `METRICS_PROTOCOL` | `grpc` | `grpc` or `http/protobuf` |
| `metrics.insecure` | `METRICS_INSECURE` | `false` | Use a plaintext connection to the collector |
| `metrics.headers` | `METRICS_HEADERS` | empty | Comma-separated `key=value` export headers |
| `metrics.export_interval` | `METRICS_EXPORT_INTERVAL` | `15s` | How often metrics are collected and exported |

### Tracing

| Setting (`config.yaml`) | Environment variable | Default | Description |
| --- | --- | --- | --- |
| `tracing.enabled` | `TRACING_ENABLED` | `false` | Turn tracing on |
| `tracing.endpoint` | `TRACING_ENDPOINT` | OTLP default | `host:port` or URL such as `http://otel-collector:4318` |
| `tracing.protocol` | `TRACING_PROTOCOL` | `grpc` | `grpc` or `http/protobuf` |
| `tracing.insecure` | `TRACING_INSECURE` | `false` | Disable TLS towards the collector |
| `tracing.headers` | `TRACING_HEADERS` | empty | Comma-separated `key=value` export headers |
| `tracing.sample_rate` | `TRACING_SAMPLE_RATE` | `1.0` | Ratio (0.0-1.0) of new traces to sample; parent decisions are respected |

`GUMA_TRACING_*` variables and the standard `OTEL_EXPORTER_OTLP_*` and
`OTEL_RESOURCE_ATTRIBUTES` variables are honored as well. The Helm chart
exposes the same settings under `metrics` and `tracing` in
[deploy/guma/values.yaml](../deploy/guma/values.yaml).
