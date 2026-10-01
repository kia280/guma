# Guma web

The Guma frontend: Next.js 16, React 19, TypeScript, HeroUI v3, Tailwind CSS v4,
and `next-intl`. See the [root README](../README.md) for the product overview,
architecture, and full development setup, and [AGENTS.md](../AGENTS.md) for
conventions.

## Scripts

Run these from `web/`:

```bash
npm install
npm run dev                 # next dev on :3000
npm run lint                # eslint
npm run lint:fix
npm run format              # prettier
npx next build --webpack    # production build (npm run build uses Turbopack)
npm run dev:demo            # dev server in static demo mode
npm run build:demo          # static demo export into out-demo
npm run serve:demo          # serve out-demo
```

In the devcontainer the `frontend` service already runs `npm run dev`. On a
shared development machine, bind to all interfaces with
`npx next dev -H 0.0.0.0 -p 3000`.

## Environment

Copy [.env.example](.env.example) to `.env.local` and adjust it. The main
variables are `NEXT_PUBLIC_API_URL` (the HTTP gateway), `NEXT_PUBLIC_KRATOS_URL`
(the Kratos public URL, served through nginx in the devcontainer), and
`NEXT_PUBLIC_DEV_TOOLS`. All variables are read in `src/lib/env.ts`.

## Mock mode

The UI can run without a backend or Kratos, using an in-memory mock client in
`src/lib/guma/mock/`:

- `NEXT_PUBLIC_USE_MOCK=true` always uses mock data.
- With `NEXT_PUBLIC_DEV_TOOLS=true`, the dev panel (bottom left) can switch mock
  data on for your browser, choose the mock guild role (owner, admin, moderator,
  or member), and preview color palettes and fonts. The panel lives in
  `src/components/dev/`.

```bash
NEXT_PUBLIC_DEV_TOOLS=true NEXT_PUBLIC_USE_MOCK=true npm run dev
```

Mutations update the in-memory store, so flows such as check-in, bidding, and
gold distribution behave realistically until the page reloads.

## Static demo

`npm run build:demo` builds a static, frontend-only demo on the mock data, with a
role picker instead of Discord login and no dev panel. It is controlled by the
build-time flag `NEXT_PUBLIC_DEMO_MODE`. See [docs/demo.md](../docs/demo.md) for
the design, its limitations, and how to host it.

## Layout

| Path | Contents |
| --- | --- |
| `src/app/` | App Router routes: `login`, `dashboard` (user and admin pages), and modal routes |
| `src/components/` | Feature components and the dev panel |
| `src/lib/guma/` | API client, transforms, money helpers, and the mock client |
| `src/lib/dashboard-nav.ts` | Sidebar sections, admin tabs, and keyboard shortcuts |
| `src/i18n/` | Locale and time zone resolution |
| `messages/` | Message catalogs: `en.json` and `zht.json` |

## Internationalization

The supported locales are Traditional Chinese (`zht`, the default) and English
(`en`), chosen by the `NEXT_LOCALE` cookie. Every user-facing string goes through
`next-intl`; add each new key to both `messages/en.json` and `messages/zht.json`.

## Design system

Read [DESIGN.md](DESIGN.md) before visual changes. It defines the typography
roles and the semantic color and surface tokens; avoid hardcoded colors.
HeroUI here is v3, so check its documentation rather than v2 APIs. The agent docs
index is in [CLAUDE.md](CLAUDE.md).
