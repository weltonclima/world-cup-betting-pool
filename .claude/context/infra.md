# Infra — Bolão dos Parças

## Firebase project
- Prod project id: **`world-cup-betting-pool-8e93c`**.
- Services: Firestore (rules + indexes), Cloud Functions, Auth, App Hosting (Cloud Run, SSR).

## Firestore
Config in `firebase.json` → `firestore.rules`, `firestore.indexes.json`.

### Collections & access model (`firestore.rules`)
Two axes: **status** (`pending|approved|blocked`) + **role** (`user|admin`). Deny-by-default.
| Collection | Read | Write |
|---|---|---|
| `users/{uid}` | owner or admin | self create forced pending/user; self update can't change role/status; only admin changes role/status. |
| `predictions` | approved owner or admin | **`if false`** — Admin SDK via Route Handler only. |
| `bonus_predictions` | approved | approved owner CRUD. |
| `teams`,`groups`,`matches`,`system_settings` | approved | admin. |
| `rankings`,`statistics`,`pool_stats` | approved | **`if false`** — only `/api/rankings/recalc` (Admin SDK). |
| `system_logs` | admin | admin create; append-only (no update/delete). |
| `notifications` | owner or admin | admin or owner create; immutable `userId`; no delete. |
| `notificationPreferences/{uid}` | owner | owner; no delete. |

> Rules are last line of defense — frontend never trusted. Admin SDK (Route Handlers / Functions) bypasses Rules by design.

## Cloud Functions (`functions/`)
Separate package (own `package.json`, `tsconfig`, `vitest`). Triggers:
- `promoteFirstAdmin` — `onCreate users/{uid}`: first user → admin.
- `syncRoleClaimOnUserUpdate` — `onUpdate users/{uid}`: sync `role` custom claim.
- **Removed:** old Copa→Firestore sync (`syncTeams` callable + `scheduledSync` cron). Copa data now via Route Handlers + cache. Ranking recalc cron (daily 02:00) planned to return without reintroducing matches/teams writes.

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
