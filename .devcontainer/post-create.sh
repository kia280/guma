#!/bin/bash

# Post-create script for dev container setup

set -e

echo "🚀 Setting up Guma development environment in dev container..."

# Make scripts executable
chmod +x scripts/*.sh

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
fi

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if PostgreSQL is ready
echo "🐘 Checking PostgreSQL connection..."
until pg_isready -h postgres -p 5432 -U guma; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done

# Check if Redis is ready
echo "🔴 Checking Redis connection..."
until redis-cli -h redis -p 6379 ping; do
    echo "Waiting for Redis..."
    sleep 2
done

echo "✅ Dev container setup complete!"
echo ""
echo "🎯 Quick start commands:"
echo "  make serve    # Start backend server"
echo "  make web-dev  # Start frontend development server"
echo "  make test     # Run tests"
echo "  make help     # Show all available commands"
echo ""
echo "🌐 Forwarded ports:"
echo "  2345 - Delve Debugger"
echo "  3000 - Frontend (Next.js)"
echo "  8080 - Backend (Go)"
echo "  5432 - PostgreSQL"
echo "  6379 - Redis"
echo "  9000 - MinIO API"
echo "  9001 - MinIO Console"
