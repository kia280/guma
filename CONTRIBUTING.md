# Contributing to Guma

Thank you for your interest in improving Guma. This guide explains how to set up
the project, the conventions changes should follow, and the terms under which
contributions are accepted.

## License of contributions

Guma is licensed under the [Elastic License 2.0](LICENSE) (Elastic-2.0). It is a
source-available license, not an open source license.

By submitting a contribution (for example a pull request, patch, or issue
attachment), you agree that:

- You wrote the contribution yourself, or otherwise have the right to submit it
  under these terms.
- Your contribution is licensed to the project and its users under the Elastic
  License 2.0.
- You also grant K1a, the project owner, a perpetual, worldwide, non-exclusive,
  royalty-free, irrevocable license to use, copy, modify, distribute, sublicense,
  and relicense your contribution under any terms, including future versions of
  the project's license.
- You do not include code that is incompatible with these terms, such as code
  copied from projects under copyleft licenses.

Sign off each commit to confirm this agreement:

```bash
git commit -s
```

This adds a `Signed-off-by: Your Name <you@example.com>` line to the commit
message. Pull requests with unsigned commits cannot be merged.

## Getting started

Guma has a Go backend and a Next.js frontend in `web/`. The backend exposes gRPC
on port 50051 and an HTTP/JSON gateway on port 8080; the frontend runs on port
3000. See the [README](README.md) for prerequisites and setup.

The recommended environment is the devcontainer:

```bash
make devcontainer
```

## Workflow

1. Open an issue first for larger changes so the approach can be agreed on.
2. Create a feature branch from `main`.
3. Keep each pull request focused on a single change and leave unrelated code
   untouched.
4. Run the relevant checks listed below.
5. Open a pull request that describes what changed, why, and how you verified
   it. Include screenshots for visible UI changes.

## Conventions

- Use English in source code, documentation, and commit messages.
- Keep transport concerns in gRPC handlers, business rules in
  `internal/services/`, and data access in sqlc queries.
- Edit source definitions, never generated code. After changing `.proto` files,
  run `make proto`; after changing `internal/db/queries/*.sql` or the schema, run
  `make sqlc`. Commit the regenerated outputs.
- Add a new forward migration in `migrations/` for schema changes instead of
  editing an existing one.
- Keep API changes synchronized across protobuf definitions, handlers, services,
  and frontend types.
- Frontend user-facing strings belong in the `next-intl` catalogs in
  `web/messages/`. Follow `web/DESIGN.md` for colors and surfaces, and use HeroUI
  v3 APIs.
- Format Go code with `gofmt` and follow the existing TypeScript and React
  style.
- Never commit secrets or local values from `config.yaml` or environment files.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) with a scope
where it helps, for example:

```text
feat(api): add roll call export endpoint
fix(web): keep the wallet balance visible on phones
refactor(go): move bank validation into the service layer
```

## Checks

Run the narrowest checks that cover your change:

```bash
# Backend
go test ./...
make fmt
make vet

# Frontend
cd web && npm run lint
cd web && npm run build

# Generated code
make proto-lint
make proto
make sqlc
```

`make check` runs formatting, `go vet`, `go mod tidy`, and tests. It may modify
files, so review its changes before committing.

## Reporting security issues

Do not open a public issue for security vulnerabilities. Contact the maintainer
privately through GitHub instead.
