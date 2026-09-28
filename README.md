# Guma - Guild Management Application

A comprehensive web application for managing gaming guilds with a modular plugin architecture.

## Architecture

- **Backend**: Go with ConnectRPC and Protocol Buffers
- **Frontend**: Next.js with React, HeroUI, and Tailwind CSS
- **Database**: PostgreSQL
- **Cache**: Redis
- **Containerization**: Docker

## Project Structure

```text
guma/
├── cmd/                    # Application entry points
│   └── server/            # Main server
├── internal/              # Private application code
│   ├── config/           # Configuration management
│   ├── database/         # Database connection and migrations
│   ├── middleware/       # HTTP middleware
│   ├── models/           # Data models
│   ├── services/         # Business logic
│   └── handlers/         # HTTP handlers
├── pkg/                   # Public library code
│   └── proto/            # Protocol buffer definitions
├── web/                   # Frontend Next.js application
├── migrations/            # Database migrations
├── docker/               # Docker configurations
└── plugins/              # Plugin system
```

## Quick Start

### Prerequisites

- Go 1.23+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose

### Development Setup

1. **Clone and setup**

```bash
git clone https://github.com/guma-org/guma.git
cd guma
make setup
```

2. **Start development environment**

```bash
# Start all services
make dev

# In separate terminals:
make serve    # Start backend on :8080
make web-dev  # Start frontend on :3000
```

3. **Access the application**

- Frontend: <http://localhost:3000>
- Backend: <http://localhost:8080>
- Liveness probe: <http://localhost:8080/livez>
- Readiness probe: <http://localhost:8080/readyz>
- gRPC health (`grpc.health.v1`): `localhost:50051`, services `liveness` and `readiness`

### Manual Setup

If you prefer manual setup:

```bash
# Copy environment file
cp .env.example .env

# Start dependencies
docker-compose -f docker/docker-compose.dev.yml up -d

# Run database migrations
go run cmd/migrate/main.go -direction=up

# Start backend
go run cmd/server/main.go

# Start frontend (in new terminal)
cd web && npm install && npm run dev
```

## API Services

The backend exposes ConnectRPC services:

- **Guild Service**: Guild management operations
- **Member Service**: Member and invitation management  
- **Event Service**: Event scheduling and RSVP management

### Example API Usage

```bash
# Create a guild
curl -X POST http://localhost:8080/guma.v1.GuildService/CreateGuild \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Guild",
    "description": "A test guild", 
    "settings": {
      "public": true,
      "max_members": 100,
      "timezone": "UTC",
      "tags": ["gaming", "mmo"]
    }
  }'

# Health checks
curl http://localhost:8080/livez
curl http://localhost:8080/readyz
go run main.go healthcheck --service readiness
```

## Development Commands

```bash
# Setup development environment
make setup

# Start services
make dev
make serve      # Backend only
make web-dev    # Frontend only

# Database operations  
make migrate-up
make migrate-down
make migrate-reset

# Docker services
make docker-up
make docker-down
make docker-logs

# Code quality
make test
make fmt
make vet
make check

# Build
make build
make clean
```

## Core Features Implemented

### Backend (Go + ConnectRPC)

- ✅ Guild management with settings and metadata
- ✅ Member management with role-based permissions
- ✅ Event scheduling with RSVP tracking
- ✅ Database migrations and connection pooling
- ✅ CORS middleware and configuration management
- ✅ Protocol buffer definitions for all services

### Frontend (Next.js + React)

- ✅ Responsive design with HeroUI components
- ✅ Guild listing and management interface
- ✅ TypeScript definitions for API types
- ✅ Modern React patterns with hooks

### Infrastructure

- ✅ Docker Compose for development dependencies
- ✅ Database schema with proper indexing
- ✅ Environment-based configuration
- ✅ Build and deployment scripts

## Plugin System (Planned)

The plugin architecture is designed to support:

- Hot-loading of plugins without server restart
- Sandboxed execution environment
- Database integration with migrations
- Frontend component integration
- API access control and permissions

## Database Schema

Core tables implemented:

- `users` - User accounts and profiles
- `guilds` - Guild information and settings  
- `members` - Guild membership and roles
- `invitations` - Guild invitation system
- `events` - Event scheduling and details
- `event_rsvps` - RSVP responses and tracking

See `migrations/` for complete schema definitions.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, conventions, checks, and the terms under which contributions are accepted.

## License

Copyright (C) 2026 K1a

This project is licensed under the Elastic License 2.0 (Elastic-2.0). See the [LICENSE](LICENSE) file for the full text.

The license does not allow providing the software to third parties as a hosted or managed service that gives them access to a substantial set of its features.

### Why the Elastic License 2.0

Guma is built for gaming guilds. The goal is for any guild to be able to read the source, run its own instance, and adapt it to how the guild works, without paying for it. At the same time, the project should not be taken as-is and turned into someone else's commercial product.

The Elastic License 2.0 fits that balance:

- Guilds may use, self-host, and modify Guma for free.
- No one may offer Guma to others as a hosted or managed service, such as a paid guild-management platform built on this code.
- Copyright and license notices must be kept, so the project's origin stays visible.

If you want to use Guma in a way the license does not allow, such as running it as a hosted service, contact the project owner to discuss a separate license.
