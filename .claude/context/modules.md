# Modules — Bolão dos Parças

> Domain map. Each `src/features/<x>` is a vertical slice: `components/`, `hooks/`, `lib/`.

## Feature slices (`src/features/*`)
| Feature | Domain |
|---|---|
| `auth` | Login, signup, forgot/reset password, pending-approval gate. |
| `home` | Landing/dashboard for approved users. Compositor `useHomeDashboard` wires 9 resource hooks (ranking, statistics, poolStats, nextMatch, recentResults, teams, predictions, settings, **matchesList**); pure derivations in `lib/homeDashboardHelpers.ts` (cards are dumb). Cards post home-revamp: `HeroCard` (rank+percentile+sparkline), `OpenMatchesCard` (open bets + notices inline), `RaioXCard` (donut breakdown), `NextMatchCard`, `LastResultsCard`. Derivations: `deriveHeroSummary`, `deriveOpenMatches`, `derivePredictionBreakdown`, `deriveCurrentStage`, `deriveNotices`, `deriveRankingSummary`. Note: `usePoolStats` lives in `rankings/hooks` (not `home/hooks`). |
| `matches` | Match list + detail + predict entry. |
| `predictions` | Palpites: per-match, group batch (mass score entry), bracket (chave/stage), best-thirds, summaries. Largest slice (~65 files). `lib`: `isPredictionLocked`, `predictionDocId`. |
| `rankings` | Pool ranking, per-phase, evolution, my-rank, other-user profile. |
| `profile` | Edit profile, password, settings, history, personal stats. |
| `notifications` | List/detail + preferences. System notifications only (approval/blocking). |
| `admin` | (legacy super-admin surface) Dashboard, users, api-status, logs. |
| `superAdmin` | Global super_admin console (PRD-09/11): manage all pools, admins, worldcup sync, matches edit. |
| `groupAdmin` | Pool-scoped group_admin console (PRD-09/10): own pool members (approve/block/reject/remove/promote), invites, settings, recalc. |
| `groups` | Pool discovery/join: search active pools, create pool, join via invite. `schemas.ts` local. |
| `worldcup` | Tournament views (groups standings, bracket) — consumes `/api/worldcup/*`. |
| `passkeys` | WebAuthn/passkey biometric login (register/login flows, credential mgmt). API under `api/auth/webauthn/*`. |
| `statistics` | Pool-wide stats (small). |

## Services (`src/services/*`) — data access
`auth`, `matches`, `predictions` (+`predictions.batch`), `rankings`, `statistics`, `notifications`, `users`, `teams`, `systemLogs`, `systemSettings`, `webauthn`, `worldcup`, and the multi-tenant set: `pools`, `invites`, `group` (group_admin ops), `superAdmin` (global ops). Shared HTTP helpers in `_apiClient.ts` (`parseWithId`, `buildHttpError`, `API_BASE`). Typed errors map HTTP status → pt-BR message (UI never sees HTTP codes), e.g. `PredictionServiceError`.

## Schemas & Types
- `src/schemas/*` (Zod) — **contract source of truth**, each with `__tests__`. Covers: predictions, bonusPredictions, groups, matches, notifications, notificationPreferences, rankings, statistics, systemLogs, systemSettings, teams, users, userStatusTransition, **pools, poolStatusTransition, invites**, shared.
- `src/schemas/shared.ts` = single source for enums: `roleSchema` (3-level + legacy), `userStatusSchema`, `stageSchema`, `rankingScopeSchema`, `matchStatusSchema`, `predictionStatusSchema` + role-classification helpers.
- `src/types/*` — TS types derived from schemas (adds `pools`, `invites`, `matches`, `worldcup`).

## Server-only (`src/server/*`)
- `firebaseAdmin.ts` — Admin SDK singleton. Creds resolved: emulator → `FIREBASE_SERVICE_ACCOUNT_KEY` JSON → `applicationDefault()` (App Hosting). Exposes `getAdminApp/Auth/Firestore`.
- `auth/` — `sessionCookie` (cookie name, shared edge+node), `verifySession` (jose edge verify), `googleCerts`.
- `copaData/` — openfootball client/mock/mapper/config/teamRegistry + `matchSource.ts` (`getEffectiveMatches` overlay, PRD-11). See architecture.md.
- `worldcup/` — `standings`, `bracket` (derived payloads) + `cache.ts` (Firestore `worldcup_cache` w/ dynamic TTL).
- `rankings/` — `recalc.ts` (recompute rankings/statistics/pool_stats, pool-scoped), `avatarBudget.ts`.
- `admin/` — server helpers for super_admin/group_admin Route Handlers: `adminUsers`, `adminPools`, `adminAdmins`, `adminMatches`, `dashboardStats`, `auditLog`.
- `cache/tiers.ts` — `REVALIDATE` (s) / `STALE_TIME` (ms) cache tiers.
- `mappers/` — `matchMapper`, `teamMapper` (API → domain).

## API Route Handlers (`src/app/api/*`)
| Route | Purpose |
|---|---|
| `auth/session` | Mint/clear `__session` cookie from Firebase ID token. |
| `auth/webauthn/*` | Passkey register/login options+verify, credential mgmt (Admin SDK). |
| `matches`, `matches/[id]` | Serve Copa matches (`getEffectiveMatches` overlay). |
| `teams`, `standings` | Teams / group standings. |
| `worldcup/groups`, `worldcup/bracket` | Cached derived standings/bracket payloads. |
| `predictions` (+`/batch`,`/score`) | Upsert/bulk/score palpites (auth → approved → lock → Admin write). |
| `rankings/recalc` | Recompute rankings/statistics/pool_stats (Admin SDK). |
| `rankings/[scope]`, `rankings/pool` | **Server-scoped ranking reads** — `geral`/`pool-{id}-geral` & phase scopes no longer client-readable; closure scoped by session/`groupId`. |
| `group/*` | **group_admin** pool ops: `dashboard`, `settings`, `predictions`, `rankings/recalc`, `invites`(+`[id]`), `users/{pending,approved,blocked,approve,reject,block,unblock,promote,remove}`. |
| `groups`, `groups/[id]`, `groups/search` | Pool discovery (approved, status=active). |
| `invite/[code]/redeem` | Join a pool via invite code. |
| `admin/*` | **super_admin** global ops: `dashboard`, `users`(+`[uid]/group`), `admins`, `groups`(+`[id]/{status,admin,members}`), `matches`(+`[id]`), `worldcup/sync` (openfootball→Firestore). |

## Firebase wrappers (`src/firebase/*`)
`client.ts` (browser SDK) + barrel `index.ts` reexports **only** client (`firebaseApp`, `firebaseAuth`, `firestore`). `admin.ts` is server-only, NOT in barrel — import directly. `env.ts` validates `NEXT_PUBLIC_FIREBASE_*`.

## Providers (`src/providers/*`)
`AuthProvider` (Firebase auth state), `QueryProvider` (React Query). Composed in `index.tsx`.

## Cross-cutting
- `src/components/{ui,auth,layout}` — shared UI (incl. `AdminGuard`), `src/hooks`, `src/lib/utils.ts` (`cn`).
- Workflow tooling: `.claude/commands/*` slash commands + `ai/{prd,plan,spec,...}` artifacts (see root CLAUDE.md). Features tracked as PRD-NN / TASK-NN.
