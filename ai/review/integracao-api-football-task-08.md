---
task: TASK-08 — Custom claim `role` no Firebase Auth
commit: 0e2b890
spec: ai/spec/integracao-api-football-task-08.md
reviewed: 2026-06-07
reviewer: Staff Engineer (review adversarial de segurança — gsd-code-reviewer + gsd-security-auditor)
depth: deep
mode: read-only
files_reviewed:
  - functions/src/functions/syncRoleClaim.ts
  - functions/src/functions/syncRoleClaimOnUserUpdate.ts
  - functions/src/functions/promoteFirstAdmin.ts
  - functions/src/index.ts
findings:
  blocker: 0
  warning: 3
verdict: APROVADO COM RESSALVAS
---

# Review TASK-08 — Custom claim `role`

## Veredito: APROVADO COM RESSALVAS

A cadeia de sincronização claim↔doc está correta e fail-safe nos pontos críticos de
segurança. Não há vetor de forja de `role` e o rebaixamento remove o privilégio.
Três WARNINGs (não-bloqueantes) sobre robustez operacional.

## Checks de segurança críticos (resultado)

| Check | Resultado | Evidência |
|---|---|---|
| Claim reflete `users.role` corretamente | OK | `syncRoleClaim.ts:46` admin→`{role:"admin"}`, user→`{role:null}`. Trigger onUpdate (`syncRoleClaimOnUserUpdate.ts:50-57`) só sincroniza com Role válido. |
| Rebaixamento remove privilégio | OK | `admin→user` grava `{role:null}` (`syncRoleClaim.ts:46`); o verificador (`verifySession.normalizeRole`) trata `null`/ausente como não-admin. |
| Falha de `setCustomUserClaims` tratada | PARCIAL (WR-01) | `promoteFirstAdmin.ts:107-113` faz try/catch + log SEM retry; `syncRoleClaimOnUserUpdate.ts:80-88` relança → retry do Functions. Inconsistência justificada no spec, mas o caminho onCreate fica sem auto-recuperação. |
| Alguém pode forjar `role`? | NÃO | Único caminho de escrita do claim é Admin SDK server-side. Client não escreve claim (não tem como). Doc `users.role` protegido por `firestore.rules:39-52` (auto-promoção impossível). Fonte de verdade é o doc; claim apenas reflete. |

## Warnings

### WR-01 — onCreate sem retry em falha de claim (assimetria de robustez)
**Arquivo:** `functions/src/functions/promoteFirstAdmin.ts:102-113`
**Issue:** Se `setCustomUserClaims` falhar após o doc já estar `role:"admin"`, o trigger
onCreate apenas loga (não relança) — o token do primeiro admin nunca recebe `role=admin`
e NÃO há trigger onUpdate disparando (foi um create, e o doc não muda depois). O sistema
fica com o único admin sem privilégio no token até uma regravação manual do doc. O
caminho onUpdate, ao contrário, relança e deixa o Functions retentar. O spec documenta
isso (§6.2) como decisão consciente, mas para o bootstrap do PRIMEIRO admin (sem outro
admin para corrigir) o risco operacional é maior do que o spec sugere.
**Fix sugerido:** relançar também no onCreate (Functions retenta a chamada de claim que
é idempotente) OU, após falha, regravar o doc `users/{uid}` (touch em `updatedAt`) para
acionar o onUpdate como rede de segurança.

### WR-02 — `throw` no onUpdate retenta a função inteira, não só a chamada de claim
**Arquivo:** `functions/src/functions/syncRoleClaimOnUserUpdate.ts:87`
**Issue:** Relançar faz o Cloud Functions reexecutar o handler inteiro com o mesmo evento.
Como `decideClaimSync` é determinística e `setCustomUserClaims` é idempotente, o retry é
seguro, mas se a falha for permanente (ex.: uid sem conta de Auth correspondente — doc
existe mas usuário foi deletado do Auth) o evento entra em loop de retry até esgotar a
política de retentativa, gerando ruído e custo. Não é bypass de segurança.
**Fix sugerido:** distinguir erro transitório (relançar) de permanente (`auth/user-not-found`
→ logar e retornar sem relançar).

### WR-03 — Shape `{ role: null }` deixa um claim presente com valor null
**Arquivo:** `functions/src/functions/syncRoleClaim.ts:46-47`
**Issue:** O rebaixamento grava `{ role: null }` em vez de remover a chave. É seguro (o
verificador trata `null` como não-admin via `normalizeRole`), e o spec justifica o shape
estável. Apenas observar que qualquer consumidor futuro do claim DEVE checar valor
(`=== "admin"`), nunca presença da chave (`"role" in claims`), senão um rebaixado
pareceria ainda ter o claim. O `verifySession` atual faz a checagem por valor (correto).
**Fix sugerido:** nenhum código a mudar; manter a convenção documentada para consumidores
futuros (já está no comentário de `syncRoleClaim.ts:20-23`).

## Verificação
- `cd functions && npx tsc --noEmit`: **sem erros** (exit 0).
- Nenhum segredo hardcoded; nenhum `any`; sem estilo inline (N/A backend).
