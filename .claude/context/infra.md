# Infra — Bolão dos Parças

## Firebase project
- Prod project id: **`world-cup-betting-pool-8e93c`**.
- Services: Firestore (rules + indexes), Cloud Functions, Auth, App Hosting (Cloud Run, SSR).

## Firestore
Config in `firebase.json` → `firestore.rules`, `firestore.indexes.json`.

### Collections & access model (`firestore.rules`)
Two axes: **status** (`pending|approved|blocked`) + **role** (`participant|group_admin|super_admin`, legacy `user`/`admin` dual-compat). `isAdmin()` in rules = super_admin. Deny-by-default. **Rule of thumb:** anything write-`if false` = Admin SDK via Route Handler only.
| Collection | Read | Write |
|---|---|---|
| `users/{uid}` | owner or super_admin | self create forced pending/participant; self update can't change role/status; only super_admin changes role/status. |
| `predictions` | approved owner or admin | **`if false`** — Admin SDK (lock enforced server-side). |
| `bonus_predictions` | approved | approved owner CRUD. |
| `teams`,`groups`,`system_settings` | approved | super_admin. |
| `matches` | approved | **`if false`** — openfootball sync + manual edit via Admin SDK (PRD-11). |
| `pools/{poolId}` | approved AND `status=="active"` | **`if false`** — create(pending)/approve/block via Admin SDK (PRD-09). |
| `invites/{id}` | approved + active + own `groupId` claim | **`if false`** — Admin SDK (PRD-10). |
| `rankings/{scope}` | approved **only `grupo-*`** | **`if false`**. `geral`/phase/`pool-*` served via Route Handler (CR-04 closure). |
| `statistics`,`pool_stats` | approved | **`if false`** — only recalc Route Handlers. |
| `worldcup_cache` | **`if false`** | **`if false`** — server-side cache, client never touches. |
| `system_logs` | super_admin | super_admin create; append-only. |
| `sync_logs` | super_admin | **`if false`** — Admin SDK sync summary, append-only (PRD-11). |
| `notifications` | owner or admin | admin or owner create; immutable `userId`; no delete. |
| `notificationPreferences/{uid}` | owner | owner; no delete. |
| `webauthn_credentials/{id}` | approved owner or admin | **`if false`** — Admin SDK. |
| `webauthn_challenge_jti/{jti}` | **`if false`** | **`if false`** — server-side single-use store. |

> Rules are last line of defense — frontend never trusted. Admin SDK (Route Handlers / Functions) bypasses Rules by design. `pools`≠`groups`: `pools`=betting groups (multi-tenant), `groups`=Copa tournament groups A–L.

## Cloud Functions (`functions/`)
Separate package (own `package.json`, `tsconfig`, `vitest`). Triggers:
- `promoteFirstAdmin` — `onCreate users/{uid}`: first user → admin.
- `syncRoleClaimOnUserUpdate` — `onUpdate users/{uid}`: sync `role` custom claim.
- **Removed:** old Copa→Firestore sync (`syncTeams` callable + `scheduledSync` cron). Copa data now via Route Handlers + cache.

## GitHub Actions cron (PRD-15)
- `.github/workflows/score-cron.yml` — agendado (~30min), `POST /api/predictions/score` com header `x-cron-secret` (secret `SCORE_SECRET`). Não usa Firebase; é externo ao Spark tier. Dispara pipeline scoring → recalc → notificações automaticamente. `SCORE_SECRET` e `RANKINGS_SECRET` já suportados no código (`src/app/api/_lib/secret.ts`); precisam ser configurados nos secrets do repo.

## Deploy (npm scripts)
- `deploy:hosting`, `deploy:functions`, `deploy:rules` (firestore:rules,indexes), `deploy:all` — all target `world-cup-betting-pool-8e93c`. SSR runtime served by App Hosting.

## Local env / emulators
- `npm run emulators` → auth `9099`, firestore `8080`, functions `5001`, hosting `5000`, UI `4000`. Project `demo-bolao-dos-parcas`, `singleProjectMode`.
- `serviceAccountKey.json` present at root (gitignored — do not commit / log).

## Environment variables
- Client: `NEXT_PUBLIC_FIREBASE_*` (apiKey, projectId, …), `NEXT_PUBLIC_FIREBASE_USE_EMULATORS`.
- Server: `FIREBASE_SERVICE_ACCOUNT_KEY` (one-line JSON; else `applicationDefault()` on App Hosting), `COPA_DATA_USE_MOCK`.
- `.env.local` (+ `.example`), `.env.production.example`. Never log env vars.

## Testing
- `npm test` → **Vitest** over `src/**/*.test.{ts,tsx}`. Node env default; component tests opt into jsdom via `// @vitest-environment jsdom`. Alias `@`→`src` mirrored. Co-located `__tests__/`.
- `npm run test:rules` → `vitest.rules.config.ts` over `test/rules/**`, runs **inside Firestore emulator** (`@firebase/rules-unit-testing`, needs Java). Kept out of default `npm test` (must stay fast, no emulator).
- Gates: `lint` (ESLint 9 flat), `typecheck` (`tsc --noEmit`), `format:check` (Prettier).
- ⚠️ RTK vitest summary can show false-green on load-failure — verify via JSON when a run looks suspiciously clean.
