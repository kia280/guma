.PHONY: help setup dev build test clean docker-up docker-down migrate-up migrate-down proto

# Default target
help: ## Show this help message
	@echo "Guma - Guild Management Application"
	@echo ""
	@echo "Available targets:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Setup development environment
	@chmod +x scripts/setup-dev.sh
	@./scripts/setup-dev.sh

devcontainer: ## Build and start devcontainer
	@echo "Building and starting devcontainer..."
	@devcontainer up --workspace-folder .

serve-debug: ## Start backend with debugger (dlv headless)
	@echo "Starting backend with Delve debugger on :2345..."
	@dlv debug ./cmd/serve.go --headless --listen=:2345 --api-version=2

web-dev: ## Start frontend development server
	@cd web && npm run dev

build-backend: ## Build the application
	@CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o build/guma .

build-frontend: ## Build the frontend
	@cd web && npm run build && npm run export

test: ## Run tests
	@echo "Running Go tests..."
	@go test ./...
	@echo "Running frontend tests..."
	@cd web && npm test 2>/dev/null || echo "No frontend tests configured"

clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	@rm -rf build/
	@rm -rf web/.next/
	@rm -rf web/out/
	@echo "Build artifacts cleaned"

docker-up: ## Start Docker services
	@echo "Starting Docker services..."
	@docker-compose -f docker/docker-compose.dev.yml up -d
	@echo "Waiting for services to be ready..."
	@sleep 5

docker-down: ## Stop Docker services
	@echo "Stopping Docker services..."
	@docker-compose -f docker/docker-compose.dev.yml down

docker-logs: ## View Docker service logs
	@docker-compose -f docker/docker-compose.dev.yml logs -f

migrate-up: ## Run database migrations up
	@echo "Running database migrations..."
	@migrate -path ./migrations -database "$(DATABASE_URL)" up

migrate-down: ## Run database migrations down
	@echo "Rolling back database migrations..."
	@migrate -path ./migrations -database "$(DATABASE_URL)" down 1

migrate-reset: ## Reset database (down then up)
	@make migrate-down
	@make migrate-up

proto: ## Generate protobuf files
	@echo "Generating protobuf files..."
	@buf generate

sqlc: ## Generate sqlc typed queries from internal/db/queries
	@echo "Generating sqlc code..."
	@sqlc generate

proto-lint: ## Lint protobuf files
	@echo "Linting protobuf files..."
	@buf lint

proto-format: ## Format protobuf files
	@echo "Formatting protobuf files..."
	@buf format --write

proto-breaking: ## Check for breaking changes in protobuf files
	@echo "Checking for breaking changes..."
	@buf breaking --against '.git#branch=main'

deps: ## Download dependencies
	@echo "Downloading Go dependencies..."
	@go mod download
	@echo "Installing frontend dependencies..."
	@cd web && npm install

fmt: ## Format code
	@echo "Formatting Go code..."
	@go fmt ./...
	@echo "Formatting frontend code..."
	@cd web && npm run lint --fix 2>/dev/null || echo "Frontend formatting not available"

vet: ## Run go vet
	@echo "Running go vet..."
	@go vet ./...

tidy: ## Run go mod tidy
	@echo "Running go mod tidy..."
	@go mod tidy

check: fmt vet tidy test ## Run all checks

install-tools: ## Install development tools
	@echo "Installing development tools..."
	@chmod +x scripts/install-tools.sh
	@./scripts/install-tools.sh
	@echo "Tools installed"

health: ## Check service health
	@echo "Checking service health..."
	@curl -fs http://localhost:8080/livez >/dev/null && echo "✓ Backend live" || echo "✗ Backend not live"
	@curl -fs http://localhost:8080/readyz >/dev/null && echo "✓ Backend ready" || echo "✗ Backend not ready"
	@curl -f http://localhost:3000 2>/dev/null && echo "✓ Frontend healthy" || echo "✗ Frontend unhealthy"

logs: ## View application logs
	@echo "Viewing logs..."
	@tail -f *.log 2>/dev/null || echo "No log files found"

# Development workflow targets
dev-reset: docker-down docker-up migrate-reset ## Reset development environment

dev-fresh: clean docker-down docker-up deps migrate-up ## Fresh development setup
