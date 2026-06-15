# Modules — Bolão dos Parças

> Domain map. Each `src/features/<x>` is a vertical slice: `components/`, `hooks/`, `lib/`.

## Feature slices (`src/features/*`)
| Feature | Domain |
|---|---|
| `auth` | Login, signup, forgot/reset password, pending-approval gate. **Signup dual-mode:** direct `/signup` (uses `GroupSelectField` — pool discovery); invite flow `/invite/[code]` (Server Component validates invite via Admin SDK via local `resolveInvite()`, renders `SignupForm` with `presetGroup`+`inviteCode` locked; on success calls `redeemInvite` which hits `POST /api/invite/[code]/redeem` to increment `usedCount`). `resolveInvite()` retorna `{ ok: true, invite }` ou `{ ok: false, reason, code: "expired" \| "generic" }` — discriminante "expired" aciona UI dedicada (Clock + mensagem "Este link expirou"). Login page **não** tem link de cadastro sem convite (removido). |
| `home` | Landing/dashboard for approved users. Compositor `useHomeDashboard` wires 9 resource hooks (ranking, statistics, poolStats, nextMatch, recentResults, teams, predictions, settings, **matchesList**); pure derivations in `lib/homeDashboardHelpers.ts` (cards are dumb). Cards post home-revamp: `HeroCard` (rank+percentile+sparkline), `OpenMatchesCard` (open bets + notices inline), `RaioXCard` (donut breakdown), `NextMatchCard`, `LastResultsCard`. Derivations: `deriveHeroSummary`, `deriveOpenMatches`, `derivePredictionBreakdown`, `deriveCurrentStage`, `deriveNotices`, `deriveRankingSummary`. Note: `usePoolStats` lives in `rankings/hooks` (not `home/hooks`). |
| `matches` | Match list (`/matches`), detail (`/matches/[id]`), predict entry. `MatchList` compositor: header+chips, **tabs temporais** (Anteriores\|Hoje\|Próximos — `TemporalBucket`), sheet de filtros avançados, pipeline de filtro client-side (busca + stage + teamId + predictionStatus + **bucket temporal como última etapa**), reagrupamento por dia. Troca de aba limpa filtros avançados. Default de aba derivado dos dados (Hoje→Próximos→Anteriores). `MatchCard`: 3 variantes (agendado/ao-vivo/encerrado) — badge status, palpite do usuário (prop `userPrediction`), borda ring em bandeiras, chevron. `useMatchesList`: orquestra `useMatches`+`useTeams`+`usePredictions` → `MatchListItem[]` com `predictionStatus` + **`userPrediction`** derivados. `matchesHelpers.ts` exporta `classifyDateKey(dateKey, todayKey): TemporalBucket` e `toUtcDateKey`. `groupMatchesByDay` agrupa por UTC date com labels pt-BR. |
| `predictions` | Palpites: per-match, group batch (mass score entry), bracket (chave/stage), best-thirds, summaries. Largest slice (~65 files). `lib`: `isPredictionLocked`, `predictionDocId`, `scorePrediction` (domain rule → `{status, points}`), `derivePredictionDisplayStatus` (combines score+lock → `PredictionDisplayStatus`), `predictionLabels` (exhaustive Records: label + color class per display status). `components/PredictionFilters.tsx` — chip filter bar (values: `PredictionDisplayStatus` union + `"all"`); `hooks/usePredictionsList.ts` — filters+sorts predictions list client-side. |
| `rankings` | Pool ranking, per-phase, evolution, my-rank, other-user profile. `lib/`: `rankingSort`, `accuracy`, `evolution`, `distribution`, `pagination`, `myRankingDerivations`. `hooks/`: `useRanking`, `usePoolRanking`, `useGroupRanking`, `useMyRanking`, `useParticipantProfile`, `rankingKeys`. PRD-14 adds: `lib/profilePredictionsGrouping`, `lib/bettorDna`, `lib/profileComparison`; `hooks/useProfilePredictions`; `components/profile/*` sub-components. New Route Handler `api/predictions/[uid]` (anti-cola, server-side filter `status===finished`). |
| `profile` | Edit profile, password, settings, history, personal stats. |
| `notifications` | List/detail + preferences. System notifications only (approval/blocking). |
| `admin` | (legacy super-admin surface) Dashboard, users, api-status, logs. |
| `superAdmin` | Global super_admin console (PRD-09/11): manage all pools, admins, worldcup sync, matches edit. |
| `groupAdmin` | Pool-scoped group_admin console (PRD-09/10): own pool members (approve/block/reject/remove/promote), invites (`GroupInvites.tsx` — generate/copy/share link), settings, recalc. |
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
| `invite/[code]/redeem` | `POST` — join a pool via invite code (auth = ID token, increments `usedCount` atomically). |
| `invite/[code]/resolve` | `GET` — **TASK-04 target, não existe ainda**. Endpoint público que resolve código → `{ groupId, groupName }` sem auth. Lógica extraída de `resolveInvite()` do Server Component para `src/server/invites/` (util compartilhado). |
| `admin/*` | **super_admin** global ops: `dashboard`, `users`(+`[uid]/group`), `admins`, `groups`(+`[id]/{status,admin,members}`), `matches`(+`[id]`), `worldcup/sync` (openfootball→Firestore). |

## Firebase wrappers (`src/firebase/*`)
`client.ts` (browser SDK) + barrel `index.ts` reexports **only** client (`firebaseApp`, `firebaseAuth`, `firestore`). `admin.ts` is server-only, NOT in barrel — import directly. `env.ts` validates `NEXT_PUBLIC_FIREBASE_*`.

## Providers (`src/providers/*`)
`AuthProvider` (Firebase auth state), `QueryProvider` (React Query). Composed in `index.tsx`.

## Cross-cutting
- `src/components/{ui,auth,layout}` — shared UI (incl. `AdminGuard`), `src/hooks`, `src/lib/utils.ts` (`cn`).
- Workflow tooling: `.claude/commands/*` slash commands + `ai/{prd,plan,spec,...}` artifacts (see root CLAUDE.md). Features tracked as PRD-NN / TASK-NN.
