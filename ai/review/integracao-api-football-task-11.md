# REVIEW ADVERSARIAL — TASK-11 (remover sync Firestore obsoleto / código morto)

> Commit: `d0a615a` · Spec: `ai/spec/integracao-api-football-task-11.md` · Plano: `ai/plan/integracao-api-football.md` (TASK-11; A7)
> Stance: adversarial / FORCE · Tarefa **destrutiva** (remoção) → checagem crítica de imports/índices órfãos vs. ainda usados · READ-ONLY

## Escopo revisado (20 arquivos, +102 / -1462)

Removidos: `functions/src/functions/{syncTeams,scheduledSync}.ts`, `functions/src/firestore/writer.ts`, `functions/src/apiFootball/{client,config,factory,mock,types}.ts`, `functions/src/mappers/{matchMapper,teamMapper}.ts`, `functions/src/shared/schemas.ts`, 6 testes/fixtures órfãos. Editados: `functions/src/index.ts`, `firestore.indexes.json`. Adicionado: a própria spec.

## Verificações críticas (remoção)

### 1. Sobrou import quebrado em `functions/`? — NÃO.
Grep por `apiFootball|mappers|firestore/writer|shared/schemas|syncTeams|scheduledSync` em `functions/src` → única ocorrência é o **comentário** documental no `index.ts` (benigno). Árvore restante: `firebase/admin.ts`, `functions/{promoteFirstAdmin,syncRoleClaim,syncRoleClaimOnUserUpdate}.ts`, 3 testes, `index.ts`. Cluster removido era fechado e autossuficiente, como a spec afirma.

### 2. `index.ts` exporta só as funções retidas? — SIM.
`export { promoteFirstAdmin }` + `export { syncRoleClaimOnUserUpdate }`. Exatamente os dois. `syncRoleClaim` (helper) é importado internamente por `syncRoleClaimOnUserUpdate` — corretamente **não** é export de topo. (Nota: a spec lista "syncRoleClaim" entre as retidas; isso se refere ao módulo helper, não a um export de CF — imprecisão de redação, não defeito.)

### 3. Teste remanescente referencia arquivo removido? — NÃO.
Restam 3 testes (`promoteFirstAdmin`, `syncRoleClaim`, `syncRoleClaimOnUserUpdate`), todos de funções retidas. Os 6 testes/fixtures que cobriam código morto foram removidos no mesmo commit.

### 4. Removeu índice Firestore ainda usado? — NÃO. Remoção correta.
Removidos os 2 índices compostos de `matches` (`status ASC, kickoffAt ASC/DESC`).
- `src/services/matches.ts` é 100% `fetch('/api/matches...')` — **zero** `where/orderBy` Firestore; `getNextScheduledMatch`/`getRecentFinishedMatches` derivados client-side de `listMatches()`. Índices de matches eram órfãos. ✔
- Índices de `predictions`/`rankings`: **não existiam** no arquivo — nada removido indevidamente. As queries atuais são single-field (`predictions: where(uid==)`; `rankings: where(scope=='geral')+limit(1)`) → não exigem índice composto. ✔
- Índice de `users` (`status ASC, createdAt ASC`) **mantido** — ainda usado por `users.ts` (`where(status==)+orderBy(createdAt)`, composto). ✔

### 5. Algo em `src/` dependia do removido? — NÃO.
Grep por `functions/src`, `../../functions`, `from '...functions'` em `src/` → 0 ocorrências. App nunca importou de `functions/`; client/mappers já tinham cópia em `src/server/` (T01/T02).

### 6. CF de ranking futura (A7) documentada? — SIM.
Comentário no `index.ts` registra que `scheduledSync` foi removido e que a CF de ranking (cron 02:00) será reintroduzida no PRD de ranking via cópia controlada do client de resultados, sem reintroduzir gravação de matches/teams.

### 7. Compilação e testes (BLOCKER se falhar)
- `npx tsc --noEmit` em `functions/` → **exit 0** (sem erros). ✔
- `npx vitest run` em `functions/` (executado direto, não via rtk — confirma passes reais, sem load-failure/false-green) → **3 arquivos / 14 testes passando, exit 0**. ✔

## Achados

Nenhum BLOCKER. Nenhum WARNING material.

| ID | Sev | Achado |
|---|---|---|
| I-01 | INFO | Spec lista "syncRoleClaim" entre funções retidas; é módulo helper, não export de CF. Redação imprecisa, sem impacto no código. |

## Verdict

**APROVADO.** Remoção limpa e completa: cluster morto eliminado, nenhum import/índice órfão sobrando, nada em `src/` afetado, índice `users` corretamente preservado, índices `matches` corretamente removidos, A7 documentada. `tsc` limpo e 14 testes verdes (verificação direta, sem false-green). Spec fielmente seguida.

---
_Reviewer: Claude (review adversarial)_ · _Modo: standard + cross-file_
