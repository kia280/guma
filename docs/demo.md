# Demo mode

Demo mode is a static, frontend-only build of the Guma web app. It uses the existing mock data from `web/src/lib/guma/mock`, so it needs no Go backend, Kratos, Keto, PostgreSQL, Redis, or MinIO. Visitors pick a guild role on the login page and can switch roles at any time.

## Build and serve

```bash
cd web
npm ci
npm run build:demo   # static site in web/out-demo
npm run serve:demo -- -l tcp://0.0.0.0:3000
```

Or from the repository root:

```bash
make web-demo            # builds, then serves on 0.0.0.0:3000
PORT=4000 make web-demo  # pick another port
```

`npm run dev:demo` starts a development server in demo mode.

`web/out-demo` is plain HTML, JavaScript, and assets. Any static host can serve it, such as GitHub Pages, Cloudflare Pages, S3, or nginx. Pages are exported as `<route>/index.html` (`trailingSlash: true`), and unknown paths should fall back to `404.html`.

No environment variables are needed. `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_KRATOS_URL` are ignored.

## How it works

- **Build-time flag.** `NEXT_PUBLIC_DEMO_MODE=true` is read by `web/next.config.ts` and inlined into the bundle. Demo mode cannot be turned on by a cookie, a query parameter, or anything else a visitor controls. Normal builds define the flag as `false`, so every `process.env.NEXT_PUBLIC_DEMO_MODE === 'true'` branch and its imports are removed at build time.
- **Static export.** Demo builds use `output: 'export'` and write to `web/out-demo`, so they never touch a normal `web/.next` build. Images are served unoptimized.
- **Mock data.** Demo builds force `NEXT_PUBLIC_USE_MOCK` on, so the API client uses the in-memory mock client. Actions such as checking in, bidding, or creating a roll call work as they do in the dev mock. Everything resets when the page reloads.
- **Roles.** The login page lists the four guild roles. The chosen role is stored in `localStorage` (`guma-demo-role`) and returned by the mock client's `getMe`. The **Demo** menu in the header switches roles and reloads the page. Logging out clears the role and returns to the picker.
- **No dev tools.** Demo builds force `NEXT_PUBLIC_DEV_TOOLS` off. The dev panel, dev login, and dev impersonation indicator are not bundled.
- **Locale.** A static page cannot read cookies on the server, so pages are prerendered in the default locale. In demo builds, `DemoLocaleProvider` reads the `NEXT_LOCALE` cookie in the browser and switches the messages, so the language setting on the Preference page still works. UI strings for the demo are in the `demo` namespace of `web/messages/*.json`.

## Changes that static export requires

- **Intercepting routes.** Static export does not support them. The detail modals in `web/src/app/dashboard/@modal` are named `page.modal.tsx`. Normal builds add `modal.tsx` to `pageExtensions`, so they still register as pages. Demo builds leave it out, so clicking a card opens the full detail page instead of a modal.
- **Dynamic routes.** The `[id]` routes for roll calls, auctions, raffles, and announcements have a `layout.tsx` that exports `generateStaticParams` in demo builds only. It lists the mock ids from `web/src/lib/demo/static-params.ts`. Normal builds do not export it, so those routes stay dynamic.
- **Request config.** `web/src/i18n/request.ts` skips `cookies()` in demo builds.
- **Proxy, redirects, and headers.** Static export ignores `web/src/proxy.ts` and the `redirects()` and `headers()` in `next.config.ts`. The build prints warnings for them, and `npm run dev:demo` logs that middleware cannot be used with `output: 'export'`. Both are expected.

## Limitations

- Items created during a visit (for example a new roll call) have no prerendered detail page. Opening one shows the 404 page.
- Changes are kept in memory only and reset on reload or when switching roles.
- Pages are prerendered in Traditional Chinese. With the language set to English, the first paint shows Traditional Chinese briefly before the page switches.
- Icons come from the Iconify CDN (`api.iconify.design`), like in the normal app. This is the only request that leaves the demo host.
