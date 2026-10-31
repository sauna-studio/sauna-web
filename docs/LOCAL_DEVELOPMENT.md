# Local development

## Stack

Bun 1.4.4, SvelteKit 3 / Svelte 5 Runes, strict TypeScript, Vite, Tailwind CSS v4, shadcn-svelte, Lucide Svelte, Superforms + Zod, openapi-fetch, Vitest, Playwright, ESLint and Prettier. Exact versions and the frozen dependency graph are in package.json and bun.lock. The official adapter-bun builds and runs using Bun.

```sh
export PATH="$PWD/../.tools/bun:$PATH"
bun install --frozen-lockfile
bun run check
bun run lint
bun run test:unit
bun run build
bun run start
```

Open http://localhost:5173. The listener binds only to 127.0.0.1. `bun run dev` starts the dev server; `bun run start` runs the production build. Authentication requires the canonical localhost hostname and port, not its numeric IP alias.

The canonical origin is compiled with Kit `paths.origin` in vite.config.ts. adapter-bun 1.0 does not read adapter-node's runtime `ORIGIN` variable and defaults to HTTPS origin normalization when this option is absent. Keep the BFF's original Host validation. Never disable CSRF or widen trusted origins to bypass an origin mismatch.

## Checks

```sh
bun --bun playwright install chromium
bun run test:e2e
bun run api:generate
# With the local API/PostgreSQL running, and this Web port free:
bun run build
bun run test:auth
# Public health/version diagnostic only:
bun run api:smoke
```

The normal E2E suite covers the public shell and synthetic unsupported/cancelled/expired authentication states without a live API. The separate auth suite starts the Web server on canonical localhost:5173 and accesses the fixed local API at 127.0.0.1:8080 through the allowlisted same-origin BFF. It uses only a CDP resident/UV virtual authenticator, never real TouchID or a password manager. Local temporary keys were authorized by the user; they must not be used for production or real accounts. Trace/video/screenshots/HAR/storage-state recording and credential/cookie/CSRF/private-key logging are prohibited.

OpenAPI snapshots come from sauna-api/Sources/SaunaAPIContract/openapi.yaml. Regenerate types with api:generate rather than editing generated code. Public health/version diagnostics are server-only and do not gate the public page.

## Scope and review gates

Customers can register and then sign in using a signed assertion; registration alone creates no session. Staff UI permits login only and denies anonymous enrollment. Workspace membership, facility management authorization, booking and payment remain unimplemented. Authentication does not unlock those operations. In-memory session metadata is cleared on expiry.

See LOCAL_VALIDATION.md for actual local test evidence, including three successful real-browser repetitions per profile. Mobile Playwright means Chromium viewport emulation, not Safari/iOS validation. Safari MCP is not connected, and real platform authenticators remain unverified. Production deployment and external API authorization have not been performed.

Use branches and PRs. Current latest-head GitHub Codex reviews failed due to an account usage limit; passing CI and independent local reviews do not permit merging. Resume a single latest-head review after capacity is restored, resolve findings, and merge only when all gates pass.
