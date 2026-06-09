# Modules — Bolão dos Parças

> Domain map. Each `src/features/<x>` is a vertical slice: `components/`, `hooks/`, `lib/`.

## Feature slices (`src/features/*`)
| Feature | Domain |
|---|---|
| `auth` | Login, signup, forgot/reset password, pending-approval gate. |
| `home` | Landing/dashboard for approved users. |
| `matches` | Match list + detail + predict entry. |
| `predictions` | Palpites: per-match, group batch (mass score entry), bracket (chave/stage), best-thirds, summaries. Largest slice (~65 files). `lib`: `isPredictionLocked`, `predictionDocId`. |
| `rankings` | Pool ranking, per-phase, evolution, my-rank, other-user profile. |
| `profile` | Edit profile, password, settings, history, personal stats. |
| `notifications` | List/detail + preferences. System notifications only (approval/blocking). |
| `admin` | Dashboard, users (pending/approved/blocked), api-status, logs. |
| `statistics` | Pool-wide stats (small). |

## Services (`src/services/*`) — data access
`auth`, `matches`, `predictions` (+`predictions.batch`), `rankings`, `statistics`, `notifications`, `users`, `teams`, `systemLogs`, `systemSettings`. Shared HTTP helpers in `_apiClient.ts` (`parseWithId`, `buildHttpError`, `API_BASE`). Typed errors map HTTP status → pt-BR message (UI never sees HTTP codes), e.g. `PredictionServiceError`.

## Schemas & Types
- `src/schemas/*` (Zod) — **contract source of truth**, each with `__tests__`. Covers: predictions, bonusPredictions, groups, matches, notifications, notificationPreferences, rankings, statistics, systemLogs, systemSettings, teams, users, userStatusTransition, shared.
- `src/types/*` — TS types derived from schemas.

## Server-only (`src/server/*`)
- `firebaseAdmin.ts` — Admin SDK singleton. Creds resolved: emulator → `FIREBASE_SERVICE_ACCOUNT_KEY` JSON → `applicationDefault()` (App Hosting). Exposes `getAdminApp/Auth/Firestore`.
- `auth/` — `sessionCookie` (cookie name, shared edge+node), `verifySession` (jose edge verify), `googleCerts`.
- `copaData/` — openfootball client/mock/mapper/config/teamRegistry (Copa data). See architecture.md.
- `apiFootball/` — legacy api-football.com client (superseded).
- `cache/tiers.ts` — `REVALIDATE` (s) / `STALE_TIME` (ms) cache tiers.
- `mappers/` — `matchMapper`, `teamMapper` (API → domain).

## API Route Handlers (`src/app/api/*`)
| Route | Purpose |
|---|---|
| `auth/session` | Mint/clear `__session` cookie from Firebase ID token. |
| `matches`, `matches/[id]` | Serve Copa matches (from copaData). |
| `teams`, `standings` | Teams / group standings. |
| `predictions` | POST upsert palpite (auth → approved → validate → lock check → Admin write). |
| `predictions/batch` | Bulk group predictions. |
| `predictions/score` | Scoring. |
| `rankings/recalc` | Recompute rankings/statistics/pool_stats (Admin SDK). |

## Firebase wrappers (`src/firebase/*`)
`client.ts` (browser SDK) + barrel `index.ts` reexports **only** client (`firebaseApp`, `firebaseAuth`, `firestore`). `admin.ts` is server-only, NOT in barrel — import directly. `env.ts` validates `NEXT_PUBLIC_FIREBASE_*`.

## Providers (`src/providers/*`)
`AuthProvider` (Firebase auth state), `QueryProvider` (React Query). Composed in `index.tsx`.

## Cross-cutting
- `src/components/{ui,auth,layout}` — shared UI (incl. `AdminGuard`), `src/hooks`, `src/lib/utils.ts` (`cn`).
- Workflow tooling: `.claude/commands/*` slash commands + `ai/{prd,plan,spec,...}` artifacts (see root CLAUDE.md). Features tracked as PRD-NN / TASK-NN.
