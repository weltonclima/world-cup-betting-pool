# Architecture — Bolão dos Parças

> World Cup 2026 betting pool (prognósticos). Stable engineering context. Keep lightweight.

## Stack
- **Next.js 15** (App Router) + **React 19**, **TypeScript strict** (no `any`).
- **SSR runtime** — NOT static export. Route Handlers (`src/app/api/*`) and `middleware.ts` need a server. (`firebase.json` `hosting.public: "out"` is stale legacy; ignore it.)
- **Deploy:** Firebase App Hosting (Cloud Run). `apphosting.yaml` + `API_FOOTBALL_KEY` secret historically pending — verify before relying.
- UI: Tailwind v4, shadcn + `@base-ui/react`, lucide, recharts, motion, sonner. Forms: react-hook-form + Zod resolver. Data: `@tanstack/react-query` + `react-table`.

## Layering (top → bottom)
1. **Routes** `src/app/(app)/*`, `src/app/(auth)/*` — pages, route groups. `(app)` = authed area, `(auth)` = login/signup/reset. App in pt-BR.
2. **Features** `src/features/<domain>/{components,hooks,lib}` — vertical slices, the bulk of UI + domain logic.
3. **Services** `src/services/*` — data-access layer called by hooks. Two paths (see Read/Write split).
4. **Schemas** `src/schemas/*` (Zod) = contract source of truth; **Types** `src/types/*` derived from them.
5. **Server-only** `src/server/*` — `import "server-only"`; Admin SDK, Copa data, auth verify, cache tiers, mappers.
6. **API Route Handlers** `src/app/api/*` — `runtime = "nodejs"`, mostly `dynamic = "force-dynamic"`.

## Read/Write split (CRITICAL pattern)
- **Reads:** Firebase **Client SDK** direct from browser, gated by Firestore Security Rules.
- **Writes:** go through **Route Handlers + Admin SDK** (server-side). Admin SDK bypasses Rules by design and applies authoritative checks (e.g. prediction time-lock). Client-direct write to `predictions`/`rankings`/`statistics`/`pool_stats` is **denied to everyone, incl. admin** (`allow write: if false`).
- Reason predictions write is server-only: matches are NOT in Firestore (served via Route Handlers), so Rules can't read `kickoffAt` to enforce the lock.

## Copa tournament data (NOT in Firestore)
- Source: **openfootball** fetched in `src/server/copaData` (HTTP client + mock via `COPA_DATA_USE_MOCK`). Public API: `fetchAllMatches()`, `fetchAllTeams()`. Teams derived from group matches via `teamRegistry`.
- **Cache tiers** (`src/server/cache/tiers.ts`) — single source shared server↔client: `REVALIDATE` (seconds, for Next `fetch` `revalidate`) mirrored to `STALE_TIME` (ms, for React Query). Tiers: grupos/seleções 24h, jogoFuturo 6h, jogoDia 30m, jogoAoVivo 1m, jogoEncerrado 5m.
- Legacy `src/server/apiFootball` (api-football.com client) superseded by copaData but still present.

## Auth & authorization (defense-in-depth, 4 layers)
1. **Edge middleware** (`middleware.ts`) — guards `/admin/*`. Reads `__session` httpOnly cookie, verifies signature+claims with **jose** (firebase-admin can't run on edge). `role` claim may be ~1h stale, so not sole authority.
2. **API Routes** — Admin SDK `verifySessionCookie`/`verifyIdToken` in Node runtime; re-check `users/{uid}.status === "approved"`.
3. **Firestore Rules** — last line of defense (see infra.md).
4. **Client guards** — `AdminGuard` hides panel in browser.
- Session cookie name = `SESSION_COOKIE_NAME` from `@/server/auth/sessionCookie` (shared edge+route, no Node deps). `__session` is the only cookie App Hosting CDN forwards to backend.
- User lifecycle: signup → `status: pending`, `role: user` (can't self-promote). Admin approves/blocks/promotes.

## Conventions
- Import alias `@/*` → `src/*`. No inline styles (Tailwind only). Comments/domain in pt-BR.
- `src/services/_apiClient.ts`: `parseWithId` validates network items preserving Zod `.refine` (do NOT use `z.intersection`/`.and` — refine is dropped in Zod 4).
