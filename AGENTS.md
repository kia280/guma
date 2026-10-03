# AGENTS.md

## Project overview

Guma is a guild-management application with a Go backend and a Next.js frontend.
The backend exposes gRPC on port 50051 and an HTTP/JSON gateway on port 8080. The
frontend lives in `web/` and runs on port 3000. Authentication uses Ory Kratos and
guild authorization uses Ory Keto; PostgreSQL is accessed through `pgx` and
generated `sqlc` queries.

## Repository map

- `cmd/`: Cobra commands and application wiring.
- `internal/router/grpc/`: gRPC server, interceptors, and transport handlers.
- `internal/router/gateway/`: grpc-gateway setup and HTTP middleware.
- `internal/authz/`: guild authorization on Ory Keto. `namespaces.keto.ts` is the
  single source of truth for the fixed roles (owner, admin, moderator, member) and
  what each may do; `authz.go` holds the matching Go `Role` and `Permission`
  constants.
- `internal/services/`: business logic. Return sentinel errors from
  `internal/services/errs`; handlers translate them to gRPC status codes.
- `internal/db/queries/`: source SQL queries for sqlc.
- `internal/db/sqlc/`: generated sqlc code; do not edit by hand.
- `proto/guma/v1/`: source protobuf definitions.
- `gen/proto/guma/v1/`: generated protobuf and gateway code; do not edit by hand.
- `migrations/`: PostgreSQL migrations.
- `web/`: Next.js 16, React 19, TypeScript, HeroUI v3, and Tailwind CSS v4.
- `deploy/guma/`: Helm chart.

## Working conventions

- Use English only in source code, comments, documentation, commit messages, and
  agent responses.
- Preserve unrelated changes; this repository may have a dirty worktree.
- Develop in a git worktree, not the primary checkout, so feature work stays
  isolated from the working tree. Start every development task by creating a
  worktree on a new branch, and do all edits, generation, and checks there.
- Keep transport concerns in handlers, business rules in services, and data access
  in sqlc queries.
- Authorize guild actions only through the `authz` helpers; services never call
  `Checker.Can` directly and never compare role strings. Use `authz.Require` to
  reject the request, `authz.RequireOrNotFound` when a denial should hide that
  the resource exists, and `authz.Allowed` when a permission only changes what
  is shown. When the required permission depends on resource state (who owns
  it, its status), choose it in a pure policy function in the service package
  (for example `cancelPermission` in `internal/services/auction/policy.go`),
  cover it with a table test, and make a single helper call. To add a
  permission, add a permit to `internal/authz/namespaces.keto.ts` and a matching
  constant in `internal/authz/authz.go` (a test keeps them in sync).
- `interceptors.GuildMembershipInterceptor` rejects any unary RPC whose request
  has a `guild_id` unless the caller is a guild member (`authz.View`). RPCs
  without a `guild_id`, or that non-members must reach (such as joining a
  guild), must be listed in `MembershipExemptMethods`; a test fails otherwise.
  Services still make their own `authz` checks.
- Membership rows (`members`) are mirrored into Keto by a trigger-fed outbox. After
  committing a membership or role change, call `authz.SyncAfterCommit` so the
  caller's next request sees it; `go run main.go authz sync` repairs drift.
- Do not return raw service errors from gRPC handlers. Map known errors to an
  appropriate status code.
- Update source definitions rather than generated files, then regenerate outputs.
- Keep API changes synchronized across protobuf definitions, generated clients,
  gateway registration, handlers, services, and frontend types as applicable.
- Add or update focused tests with behavior changes.
- Do not write code comments unless the user explicitly asks for them. Leave
  existing comments in place. Good code should be self-contained: clear names and
  structure should make it understandable without comments.
- Use `gofmt` for Go and follow the existing TypeScript/React style.
- Never commit secrets or local values from `config.yaml` or environment files.

## Frontend guidance

- Read `web/DESIGN.md` before visual changes and follow its semantic color and
  surface rules. Avoid hardcoded colors and obsolete HeroUI v2 APIs or tokens.
- HeroUI in this project is v3. Before changing HeroUI components, consult the
  docs under `web/.heroui-docs/react/` and the index in `web/CLAUDE.md`; do not
  rely on remembered v2 APIs. The docs are git-ignored; if they are missing, run
  `npx heroui-cli agents-md --react --output CLAUDE.md` from `web/` first, then
  revert any `web/.gitignore` changes it makes.
- Preserve internationalization: user-facing strings should use the existing
  `next-intl` message catalogs in `web/messages/`.
- Prefer accessible components and retain keyboard, focus, label, loading, empty,
  and error states.

## Common commands

```bash
# Backend
go run main.go serve
go test ./...
go test ./internal/router/grpc/handlers/...
make build-backend
make fmt
make vet

# Frontend
make web-dev
cd web && npm run build
cd web && npm run lint

# Generation
make proto
make proto-lint
make sqlc

# Devcontainer (run from the host)
make devcontainer
docker compose -p guma_devcontainer ps
docker compose -p guma_devcontainer logs -f backend
docker compose -p guma_devcontainer logs -f --tail=200 kratos
docker compose -p guma_devcontainer restart backend
docker compose -p guma_devcontainer exec backend sh
docker compose -p guma_devcontainer exec postgres psql -U guma

# Full validation (may modify files via fmt/tidy)
make check
```

The devcontainer Compose project is `guma_devcontainer`. Its main services are
`devcontainer`, `backend`, `frontend`, `nginx`, `postgres`, `redis`, `minio`,
`kratos`, and `keto`. Run the Compose commands above from the host, not from
inside the devcontainer.

Run the narrowest relevant checks first. Before using `make check`, note that it
runs formatting and `go mod tidy`, so review its changes and do not discard work
that was already present.

## Database and generated code

- Create forward migrations for schema changes; do not rewrite an applied
  migration unless the task explicitly requires it.
- The `migrate` executable only exists inside the devcontainer, so the
  `make migrate-*` targets fail on the host. Run migrations from the host through
  the devcontainer:

  ```bash
  docker compose -p guma_devcontainer exec devcontainer \
      sh -c 'migrate -path ./migrations -database "$DATABASE_URL" up'

  docker compose -p guma_devcontainer exec devcontainer \
      sh -c 'migrate -path ./migrations -database "$DATABASE_URL" down 1'

  # Full reset: drops everything and re-applies all migrations, including seeds
  docker compose -p guma_devcontainer exec devcontainer \
      sh -c 'migrate -path ./migrations -database "$DATABASE_URL" down -all \
          && migrate -path ./migrations -database "$DATABASE_URL" up'
  ```
- After editing `.proto` files, run `make proto` and include the required generated
  outputs.
- After editing `internal/db/queries/*.sql` or the schema used by sqlc, run
  `make sqlc`.

## Validation expectations

- Go-only change: run focused package tests, then `go test ./...` when practical.
- Frontend-only change: run lint and, for meaningful UI or type changes, build.
- Protobuf or database change: run the relevant generator and validate consumers.
- If a check cannot run because a service or tool is unavailable, report exactly
  what was not verified.
