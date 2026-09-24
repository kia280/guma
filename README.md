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

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run `make check` to verify code quality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
