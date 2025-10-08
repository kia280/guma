#!/bin/bash

# Build script for Guma

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BUILD_DIR="build"
VERSION=${VERSION:-"dev"}
COMMIT=${COMMIT:-$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")}
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo -e "${BLUE}🔨 Building Guma...${NC}"
echo -e "${YELLOW}Version: ${VERSION}${NC}"
echo -e "${YELLOW}Commit: ${COMMIT}${NC}"
echo -e "${YELLOW}Build Time: ${BUILD_TIME}${NC}"

# Create build directory
mkdir -p $BUILD_DIR

# Build flags
LDFLAGS="-s -w"
LDFLAGS="$LDFLAGS -X main.version=$VERSION"
LDFLAGS="$LDFLAGS -X main.commit=$COMMIT"
LDFLAGS="$LDFLAGS -X main.buildTime=$BUILD_TIME"

# Build server
echo -e "${YELLOW}Building server...${NC}"
CGO_ENABLED=0 go build \
    -ldflags "$LDFLAGS" \
    -o $BUILD_DIR/server \
    .

echo -e "${GREEN}✓ Server built successfully${NC}"

# Build migrate tool
echo -e "${YELLOW}Building migrate tool...${NC}"
CGO_ENABLED=0 go build \
    -ldflags "$LDFLAGS" \
    -o $BUILD_DIR/migrate \
    ./cmd/migrate

echo -e "${GREEN}✓ Migrate tool built successfully${NC}"

# Build frontend
echo -e "${YELLOW}Building frontend...${NC}"
cd web
npm run build
cd ..

echo -e "${GREEN}✓ Frontend built successfully${NC}"

# Copy migrations
echo -e "${YELLOW}Copying migrations...${NC}"
cp -r migrations $BUILD_DIR/
echo -e "${GREEN}✓ Migrations copied${NC}"

# Copy frontend build
echo -e "${YELLOW}Copying frontend build...${NC}"
cp -r web/out $BUILD_DIR/web 2>/dev/null || cp -r web/.next $BUILD_DIR/web
echo -e "${GREEN}✓ Frontend build copied${NC}"

echo -e "${GREEN}🎉 Build complete!${NC}"
echo -e "${BLUE}Output directory: ${BUILD_DIR}${NC}"
echo -e "${BLUE}Binaries:${NC}"
echo -e "  • ${BUILD_DIR}/server"
echo -e "  • ${BUILD_DIR}/migrate"
echo -e "${BLUE}Assets:${NC}"
echo -e "  • ${BUILD_DIR}/migrations/"
echo -e "  • ${BUILD_DIR}/web/"
