# SPEC — TASK-08: Custom claim `role` no Firebase Auth

> Plan: `ai/plan/integracao-api-football.md` (TASK-08) · Type: integration · Criticality: high
> Objetivo: o token do usuário carrega `role` para decisão de acesso server-side sem I/O no edge — base para o session cookie (TASK-09) e o middleware `/admin/*` (TASK-10).

## 1. Fluxo atual mapeado (antes da TASK-08)

Investiguei onde `role`/`status` mudam em `users`:

| Local | O que altera | Observação |
|---|---|---|
| `src/services/auth.ts` (`signUp`) | grava `role:"user"`, `status:"pending"` no cadastro (client) | Security Rules forçam esses valores; client nunca grava `admin`/`approved`. |
| `functions/src/functions/promoteFirstAdmin.ts` (trigger onCreate `users/{uid}`) | promove o **primeiro** usuário a `role:"admin"`, `status:"approved"` (Admin SDK, dentro de transação sobre `system_settings/bootstrap`) | **Único** ponto que grava `role:"admin"` hoje. |
| `src/services/users.ts` (`updateUserStatus`) + `src/features/admin/hooks/useUpdateUserStatus.ts` | painel admin altera **apenas** `status` (+`updatedAt`) | **NÃO altera `role`.** Aprovar/bloquear ≠ promover a admin. |
| `src/providers/AuthProvider.tsx` | deriva `role`/`status` do **doc Firestore** (`getDoc users/{uid}`), não do ID token | O client hoje NÃO lê o claim; `AdminGuard`/`Header` usam `role` do doc. |

Achados-chave:
- **Não existia nenhum uso de `setCustomUserClaims`** no repo. O claim `role` simplesmente não existia nos tokens.
- `functions/src/functions/syncTeams.ts` já tinha um TODO explícito aguardando esta task (`request.auth.token.role === "admin"` quando claims existirem).
- A promoção a admin é **server-side e rara** (bootstrap). Qualquer fluxo admin futuro de promoção/rebaixamento também mexerá apenas no doc `users/{uid}` (padrão atual do painel).

## 2. Abordagem escolhida

Dupla cobertura, com a fonte de verdade sendo `users/{uid}.role`:

1. **Estender `promoteFirstAdmin`**: após o commit da transação, se promovido, chamar `syncRoleClaim(uid, "admin")`. Feito FORA da transação (claims do Auth não participam de transação Firestore). Falha é logada como erro (doc já consistente).

2. **Novo trigger `onUpdate` `syncRoleClaimOnUserUpdate`** em `users/{uid}`: detecta mudança de `role` (no-op se `role` inalterado — caso comum do painel que só muda `status`) e reflete no claim via `setCustomUserClaims`. **Cobre qualquer fluxo futuro de promoção/rebaixamento** sem acoplar a um endpoint específico — é a opção robusta recomendada no enunciado da task.

Por que onUpdate (e não só estender um endpoint admin): hoje **não existe** endpoint/callable admin que mude `role`. Amarrar o claim a um trigger sobre o doc garante convergência claim↔doc independentemente de quem alterou (callable futura, console Firebase, script de manutenção). A escrita do claim não modifica o doc, então não há loop.

### Convenção do claim
- `role === "admin"` → `setCustomUserClaims(uid, { role: "admin" })`
- `role === "user"` → `setCustomUserClaims(uid, { role: null })` (remove/zera o privilégio; shape estável `{ role }` para o verificador de token).

## 3. Arquivos

Criados:
- `functions/src/functions/syncRoleClaim.ts` — helper `syncRoleClaim(uid, role)` + `type Role`.
- `functions/src/functions/syncRoleClaimOnUserUpdate.ts` — trigger onUpdate + decisão pura `decideClaimSync(before, after)`.
- `functions/src/__tests__/syncRoleClaim.test.ts`
- `functions/src/__tests__/syncRoleClaimOnUserUpdate.test.ts`

Alterados:
- `functions/src/functions/promoteFirstAdmin.ts` — chama `syncRoleClaim(uid,"admin")` pós-commit (com try/catch + log).
- `functions/src/index.ts` — exporta `syncRoleClaimOnUserUpdate`.

NÃO tocados (TASK-09/10): `src/server/**`, `src/app/api/**`, `next.config`, `firebase.json`, `middleware`.

## 4. Refresh do token no client (dependência TASK-09/10)

O ID token em cache no client mantém o claim antigo até expirar (~1h). Para o claim novo valer imediatamente o client deve chamar `getIdToken(true)`.

**Decisão:** NÃO há ponto de refresh óbvio no fluxo client atual, porque o `AuthProvider` deriva `role` do **doc Firestore**, não do token — o refresh do claim só importa para consumidores server-side do token (session cookie TASK-09, middleware TASK-10). Portanto:
- O `getIdToken(true)` deve ser disparado quando o **session cookie** for criado/renovado (TASK-09), trocando um ID token já atualizado por um session cookie com o claim correto.
- Documentado aqui como **dependência da TASK-09**: após mudança de role do próprio usuário logado, forçar `getIdToken(true)` antes de (re)criar o session cookie. Nenhuma mudança de client nesta task.

## 5. Casos de teste (todos verdes)

`syncRoleClaim` (mock de `firebase-admin/auth` e `../firebase/admin`):
- S1: admin → `setCustomUserClaims(uid,{role:"admin"})`.
- S2: user → `setCustomUserClaims(uid,{role:null})`.
- S3: erro de I/O do Auth propaga.

`decideClaimSync` (pura):
- U1: user→admin sincroniza "admin".
- U2: admin→user sincroniza "user".
- U3/U4: role inalterado → no-op.
- U5: doc deletado (after undefined) → no-op.
- U6: novo role inválido/ausente → no-op (defensivo).

`promoteFirstAdminTx`: 5 testes existentes seguem verdes (a chamada de claim é no handler, fora do núcleo transacional — não afeta os testes da Tx).

## 6. Riscos / dependências

1. **TASK-09/10 dependem deste claim** — o middleware lê `role` do session token. Sem refresh (TASK-09), mudança de role demora até ~1h para refletir no token de quem já estava logado.
2. **Falha de claim no `promoteFirstAdmin`**: se `setCustomUserClaims` falhar após o doc já estar `admin`, o token não terá `role=admin` (logado como erro). Mitigação: o trigger onUpdate cobre mudanças posteriores; uma regravação manual do doc (ou re-set do claim) recupera. Não há retry automático no onCreate (a chamada é após a transação).
3. **`syncTeams` TODO**: agora pode passar a checar `request.auth.token.role === "admin"`. Fora do escopo desta task (não alterei `syncTeams`), mas o claim já habilita isso.
4. **Emulador local**: `getAuth().setCustomUserClaims` exige o Auth emulator quando rodando local; em produção usa a service account do App Hosting/Functions.
5. **`engines.node:"18"`** no `functions/package.json` — triggers v2 ok; sem mudança de runtime.

## 7. Resultado de verificação

- `npx vitest run` (functions): **58 passed / 0 failed**, 0 suites com falha. Novos: `syncRoleClaim.test.ts` (3), `syncRoleClaimOnUserUpdate.test.ts` (6), `promoteFirstAdmin.test.ts` (5, mantidos).
- `npx tsc --noEmit` (functions): **sem erros**.
