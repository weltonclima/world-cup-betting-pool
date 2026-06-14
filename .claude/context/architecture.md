# Architecture — Bolão dos Parças

> World Cup 2026 betting pool (prognósticos). **Multi-tenant** since PRD-09: many `pools` (betting groups), 3-level roles. Stable engineering context. Keep lightweight.

## Stack
- **Next.js 15** (App Router) + **React 19**, **TypeScript strict** (no `any`).
- **SSR runtime** — NOT static export. Route Handlers (`src/app/api/*`) and `middleware.ts` need a server. (`firebase.json` `hosting.public: "out"` is stale legacy; ignore it.)
- **Deploy:** Firebase App Hosting (Cloud Run). `apphosting.yaml`.
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

## Copa tournament data (openfootball base + Firestore overlay)
- **Base source: openfootball** fetched in `src/server/copaData` (HTTP client + mock via `COPA_DATA_USE_MOCK`). `fetchAllMatches()`, `fetchAllTeams()`. Teams derived from group matches via `teamRegistry`. Legacy `src/server/apiFootball` removed (commit 5fdcf39).
- **Overlay persistence (PRD-11):** `getEffectiveMatches()` (`src/server/copaData/matchSource.ts`) = openfootball base with manual overrides applied from the `matches/{id}` Firestore collection (only docs with `isManualOverride === true` win). Empty collection → identical to base. Resilient: Firestore read failure falls back to live base. Sync/edit via `/api/admin/worldcup/sync` + `/api/admin/matches/[id]` (Admin SDK only). **Cache bust pattern:** admin PUT/DELETE on matches calls `revalidatePath` for `/api/matches`, `/api/matches/[id]`, plus worldcup_cache bust — ensuring manual edits surface immediately. `/api/matches/[id]` (GET) uses `getEffectiveMatches()` (same overlay as the list). So `matches` IS now in Firestore, but as a corrections overlay — not the primary read path.
- **Derived payloads cache (`src/server/worldcup/`):** groups standings + bracket are computed server-side and cached in Firestore `worldcup_cache/{groups|bracket}` (Admin SDK only). Dynamic TTL: 60s if a live group match, else 24h (`cache.ts`). Served by `/api/worldcup/{groups,bracket}`.
- **Cache tiers** (`src/server/cache/tiers.ts`) — single source shared server↔client: `REVALIDATE` (s, Next `fetch`) mirrored to `STALE_TIME` (ms, React Query). Tiers: grupos/seleções 24h, jogoFuturo 6h, jogoDia 30m, jogoAoVivo 1m, jogoEncerrado 5m.

## Auth & authorization (defense-in-depth, 4 layers)
1. **Edge middleware** (`middleware.ts`) — guards admin areas. Reads `__session` httpOnly cookie, verifies signature+claims with **jose** (firebase-admin can't run on edge). `role`/`groupId` claims may be ~1h stale, so not sole authority.
2. **API Routes** — Admin SDK `verifySessionCookie`/`verifyIdToken` in Node runtime; re-check `users/{uid}.status === "approved"`.
3. **Firestore Rules** — last line of defense (see infra.md).
4. **Client guards** — `AdminGuard` hides panel in browser.
- Session cookie name = `SESSION_COOKIE_NAME` from `@/server/auth/sessionCookie` (shared edge+route, no Node deps). `__session` is the only cookie App Hosting CDN forwards to backend.
- User lifecycle: signup → `status: pending`, `role: participant` (can't self-promote). Group admin / super admin approves/blocks/promotes.
- **Roles (3-level, PRD-09)** — canonical in `src/schemas/shared.ts`: `participant` < `group_admin` < `super_admin`. **Legacy dual-compat:** old `user`≈`participant`, `admin`≈`super_admin` accepted during transition (physical remap = TASK-12). Always classify via helpers `isSuperAdminRole`/`isGroupAdminRole`/`isParticipantRole` (fail-closed on unknown) — never compare role strings raw. Normalize untrusted input (JWT claim, body) with `roleSchema.safeParse` first.
- **Multi-tenancy:** each user belongs to one pool via `users.groupId` (optional in transition, required post-backfill TASK-12); mirrored to a `groupId` custom claim used by Rules (`invites` isolation) and Route Handlers (pool-scoped ranking closure). `super_admin` = global (all pools, tournament data); `group_admin` = scoped to own pool.
- **Client persistence:** `getAuth(firebaseApp)` uses Firebase's default **`browserLocalPersistence`** (no explicit `setPersistence` call) — auth state survives reload/tab-close. Server `__session` cookie TTL = 5 days. No "remember me" toggle. Web stack → biometric/facial login = **WebAuthn/Passkeys** (platform authenticator), not a native API; Firebase has no native WebAuthn primary-login, so it requires a custom-token/Cloud-Function bridge.

## Conventions
- Import alias `@/*` → `src/*`. No inline styles (Tailwind only). Comments/domain in pt-BR.
- `src/services/_apiClient.ts`: `parseWithId` validates network items preserving Zod `.refine` (do NOT use `z.intersection`/`.and` — refine is dropped in Zod 4).
