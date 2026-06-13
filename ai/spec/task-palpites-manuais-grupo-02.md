# SPEC

## 1. Task id and title
- Task: TASK-02
- Title: Endpoint `POST /api/group/predictions` — palpite manual do admin de grupo (núcleo de segurança)

## 2. Objective
Criar Route Handler que permite a um **group_admin** gravar/sobrescrever o palpite de um **participante aprovado do seu próprio grupo** para um **jogo bloqueado** (encerrado/ao vivo/kickoff passado), com autorização escopada, override controlado do lock, auditoria com valor anterior→novo e recalc de ranking in-process. Endpoint **isolado** — não reusa `/api/predictions` (cujos invariantes — uid-da-sessão + lock-bloqueia — são exatamente o que precisa ser invertido aqui, de forma segura).

## 3. In scope
- `src/app/api/group/predictions/route.ts` (`runtime="nodejs"`, `dynamic="force-dynamic"`), exportando `POST`.
- Toda a lógica testável dentro do handler (mockável), espelhando o padrão de `_moderation.ts`.
- Autorização via `authorizeGroupAdminOfPool()` (role + `groupId` da sessão).
- Validação de body com `groupManualPredictionInputSchema` (TASK-01).
- Escopo fail-closed do alvo + override de lock + write + audit + recalc.
- Testes de rota (`__tests__/route.test.ts`) com mocks (mesmo estilo de `moderation.test.ts`).

## 4. Out of scope
- Serviço cliente / hooks (TASK-03).
- Tela / UI / navegação (TASK-04).
- Badge de origem (TASK-05).
- Qualquer alteração em `/api/predictions`, `recalcRankings`, `scorePrediction`, schemas (TASK-01 já entregou o contrato).
- Notificar o participante (fora de escopo PRD-12, A7).

## 5. Main technical areas involved
- `src/app/api/group/predictions/route.ts` (novo).
- Reuso: `authorizeGroupAdminOfPool` (`@/app/api/group/_authorize`), `getAdminFirestore` (`@/server/firebaseAdmin`), `fetchAllMatches` (`@/server/copaData`), `isPredictionLocked` + `predictionDocId` (`@/features/predictions/lib`), `recalcRankingsBestEffort` (`@/server/rankings/recalc`), `writeAuditLog` (`@/server/admin/auditLog`), `groupManualPredictionInputSchema` + `roleSchema` + `userStatusSchema` + `isSuperAdminRole` (`@/schemas`), `copaDataErrorResponse` (`../../_lib/copaDataError` — confirmar caminho relativo correto a partir de `group/predictions`).

## 6. Business rules and behavior
Ordem de avaliação (fail-closed, barra antes de qualquer escrita):
1. **Auth:** `authorizeGroupAdminOfPool()` → 401/403 se inválido. Devolve `{ uid: adminUid, groupId: sessionGroupId, role }`.
2. **Body:** parse `groupManualPredictionInputSchema`. JSON malformado → 400; inválido → 422. Extrai `{ targetUid, matchId, homeScore, awayScore }`.
3. **Escopo do alvo (fail-closed):** ler `users/{targetUid}`. Inexistente → 404. Exigir `status === "approved"` (senão 403) **e** `targetUser.groupId === sessionGroupId` (senão 403, alvo de outro pool é invisível). Se alvo for `super_admin` (`isSuperAdminRole`) → 403 (intocável). Espelha `loadTarget` de `_moderation.ts`.
4. **Jogo + override de lock (A1):** `fetchAllMatches()` (erro de fonte → `copaDataErrorResponse`), achar por id; inexistente → 404. Exigir `isPredictionLocked(match, now) === true`; se o jogo **não** está bloqueado (futuro/scheduled antes do kickoff) → **409** (lançar palpite manual em jogo aberto não é papel do admin; o participante palpita normalmente).
5. **A2 — read-before-write:** `get` do doc `predictions/${predictionDocId(targetUid, matchId)}` **antes** de gravar; capturar placar anterior (se existir) para a auditoria.
6. **Write:** `set(payload, { merge: true })` via Admin SDK. `payload` contém **somente** chaves declaradas em `predictionSchema` (`.strict()`):
   `{ uid: targetUid, matchId, homeScore, awayScore, editedBy: adminUid, editedByRole: role, editedAt: nowIso, updatedAt: nowIso }` + `createdAt: nowIso` se for create. **`editedByRole` = role da sessão (group_admin/super_admin)** — não persistir role de participante.
7. **Audit (best-effort):** `writeAuditLog({ type: "group_admin_manual_prediction", actorUid: adminUid, targetUid, message })` onde `message` cita matchId, placar **anterior→novo** (usando o capturado em #5). Nunca derruba a ação.
8. **Recalc:** após o write, `recalcRankingsBestEffort(getAdminFirestore())` **in-process** (espelha `_moderation.ts:152`). **NÃO** encadear `/api/predictions/score` — `recalcRankings()` re-pontua dos raw `predictions` internamente. Jogo `finished` → palpite pontua já neste recalc; jogo bloqueado-não-finalizado → gravado e simplesmente ainda não pontuado (recalc filtra `status==="finished"`), sem erro.
9. **Resposta:** 200 `{ saved: { id, uid, matchId, homeScore, awayScore, editedBy, editedByRole, editedAt } }`. (Não diferenciar 201/200 — operação é "lançar/sobrescrever", idempotente; 200 simples.)

**Invariante de segurança:** `adminUid`/`role`/`groupId` SEMPRE da sessão (via `authorizeGroupAdminOfPool`); `targetUid` é do body mas só identifica o alvo — nunca usado para autorização. O alvo nunca contamina a identidade da sessão.

## 7. Contracts and interfaces
- **Request body:** `groupManualPredictionInputSchema` = `{ targetUid, matchId, homeScore, awayScore }`.
- **Doc gravado:** subconjunto/superset exato de `predictionSchema` com `editedBy/editedByRole/editedAt` preenchidos (contrato travado em TASK-01).
- **Audit:** `SystemLogInput` com `type: "group_admin_manual_prediction"`.
- **Respostas HTTP:** 200 sucesso; 400 JSON malformado; 401 não-autenticado; 403 escopo (role/pool/super_admin alvo/não-aprovado); 404 alvo ou jogo inexistente; 409 jogo não-bloqueado; 422 body inválido; 500 falha de escrita; erro de fonte de dados → `copaDataErrorResponse`.

## 8. Data and persistence impact
- Escreve em `predictions/{targetUid}_{matchId}` (Admin SDK, bypassa Rules por design — Rules negam write client em `predictions`).
- Dispara writes de recalc em `rankings/*`, `statistics/*`, `pool_stats/current` (via `recalcRankingsBestEffort`).
- Escreve `system_logs/{id}` (best-effort).
- Sem migração. Idempotente (merge + recalc puro).

## 9. Required tests
`src/app/api/group/predictions/__tests__/route.test.ts` (mocks: `server-only`, `authorizeGroupAdminOfPool`, `getAdminFirestore`, `@/server/copaData` (`fetchAllMatches`), `@/server/rankings/recalc` (`recalcRankingsBestEffort`), `@/server/admin/auditLog` (`writeAuditLog`); `groupManualPredictionInputSchema`/helpers REAIS). Casos:
- **403** quando não autorizado (gate barra antes do Firestore).
- **400** JSON malformado.
- **422** body inválido (sem `targetUid` / placar inválido).
- **404** alvo inexistente.
- **403** alvo de outro pool (`groupId` ≠ sessão); **sem** write.
- **403** alvo não-aprovado (`status !== approved`); **sem** write.
- **403** alvo é `super_admin`; **sem** write.
- **404** jogo inexistente.
- **409** jogo não-bloqueado (futuro/scheduled, `isPredictionLocked===false`); **sem** write.
- **200** sucesso jogo encerrado: grava doc com `editedBy=adminUid`, `editedByRole=group_admin`, `uid=targetUid`; payload **só** com chaves de `predictionSchema` (round-trip: `predictionSchema.safeParse(payload)` success — guard contra descarte no recalc); `recalcRankingsBestEffort` chamado.
- **200** jogo bloqueado-não-finalizado (ao vivo): grava sem erro (sem pontuar).
- **A2 read-before-write:** sobrescrita lê doc anterior e a `message` de auditoria contém placar anterior→novo.
- **uid da sessão nunca contaminado:** payload.uid === targetUid e editedBy === adminUid (distintos).
- audit best-effort: falha em `writeAuditLog` não derruba o 200.

## 10. Acceptance criteria
- Todos os testes acima verdes (`pnpm vitest run` no arquivo).
- `tsc` sem erros novos em `src/`.
- Payload gravado passa `predictionSchema.safeParse` (não-descarte comprovado em teste).
- Recalc disparado in-process; `/api/predictions/score` **não** referenciado.
- Auth/escopo fail-closed: nenhuma escrita ocorre em qualquer ramo de rejeição.

## 11. Constraints
- Não reusar `/api/predictions`. Não usar `any`. `import "server-only"`.
- `groupId`/`role`/`adminUid` só da sessão (D2). `targetUid` nunca para autorização.
- Não persistir chave fora de `predictionSchema` (`.strict()` → descarte no recalc).
- Recalc só via `recalcRankingsBestEffort` in-process.
- Erros não vazam dados sensíveis; mensagens pt-BR.
- Esta task **não pode mergear antes de TASK-01** (depende do contrato de campo).

## 12. Execution cost profile
- tdd: sonnet/high
- implement: sonnet/high
- test: sonnet/high
- review: opus/high

## 13. Frontend indicator
- is_frontend: false
- reason: Route Handler server-side puro. Sem UI.

## 14. Open questions
Nenhuma. Decisões A1/A2/A4/A6 travadas no plano/PRD; mecanismo de recalc e contrato de campo resolvidos em TASK-01.
