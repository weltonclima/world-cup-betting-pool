# SPEC

## 1. Task: TASK-03 – Route Handler de recálculo `/api/rankings/recalc`

## 2. Objective

Endpoint server-only que recalcula, de forma **idempotente**, todos os rankings (geral + 5 fases + por grupo), as `statistics/{uid}` (com snapshot de evolução) e as estatísticas agregadas do bolão, a partir das `predictions` cruzadas com as partidas finalizadas. Espelha o padrão de `POST /api/predictions/score`.

## 3. In scope

1. `POST /api/rankings/recalc` (Node runtime, dynamic) com **autorização dupla**: header `x-cron-secret === process.env.RANKINGS_SECRET` **ou** sessão admin (`__session` cookie → role admin).
2. Agregação por usuário aprovado, derivando correção via `scorePrediction` (não depende do score route ter gravado).
3. Gravação de: `rankings/{scope}` (geral + grupos/oitavas/quartas/semifinal/final), `rankings/grupo-{groupId}`, `statistics/{uid}`, `pool_stats/current`.
4. Append de snapshot em `statistics/{uid}.positionHistory` (evolução).
5. Resposta JSON com contadores; testes de rota.

## 4. Out of scope

- Firestore Rules / encadeamento cron (TASK-14).
- Pontuação por palpite individual (PRD-04 `scorePrediction`) — reutilizada, não reimplementada.
- Leitura para UI (TASK-04/05) e telas.
- Bônus (`bonus_predictions`).

## 5. Main technical areas

`src/app/api/rankings/recalc/route.ts` (novo) + `src/app/api/rankings/recalc/__tests__/route.test.ts`. Reutiliza: `getAdminFirestore`/`getAdminAuth` (`@/server/firebaseAdmin`), `SESSION_COOKIE_NAME` (`@/server/auth/sessionCookie`), `fetchAllMatches` (`@/server/copaData`), `scorePrediction` (`@/features/predictions/lib`), helpers de TASK-02 (`rankParticipants`, `computeAccuracy`, `buildDistribution`), schemas TASK-01 (`predictionSchema`, `userSchema`, `rankingSchema`, `groupRankingSchema`, `statisticsSchema`, `poolStatsSchema`), `copaDataErrorResponse` (`../../_lib/copaDataError` — confirmar path relativo a partir de `rankings/recalc`).

## 6. Business rules and behavior

### 6.1 Autorização
Idêntica ao score route: (A) header secret (`RANKINGS_SECRET`) p/ cron externo; (B) fallback sessão admin (verifySessionCookie → users/{uid}.role === "admin"). 401 sem auth, 403 se não-admin.

### 6.2 Conjunto de partidas e escopos
- `finished = matches.filter(status==="finished")`.
- Mapa `matchId → Match`.
- **Escopo "geral"**: todas as `finished`.
- **Escopos de fase** (5): `finished` com `match.stage === scope` para `scope ∈ {grupos,oitavas,quartas,semifinal,final}`. `dezesseis-avos` e `terceiro` **não** têm ranking de fase (contam só no geral e em `correctByStage`).
- **Por grupo**: `finished` com `match.stage==="grupos"` agrupadas por `match.groupId` (ignora `groupId` nulo).
- `finishedEligible(scope)` = nº de partidas finalizadas no escopo (denominador do aproveitamento — A2: finalizadas, não só palpitadas).

### 6.3 Usuários elegíveis
Só `users.status === "approved"`. `blocked`/`pending` **excluídos** de todos os rankings/stats (regra de negócio PRD-05). Pool stats conta só aprovados.

### 6.4 Agregação por usuário (derivação de correção)
Para cada usuário aprovado, para cada `prediction` dele cujo `match` exista e esteja `finished`:
- `{ status, points } = scorePrediction(prediction, match)` (função pura PRD-04; idempotente; não depende de writes do score route).
- Acumular por escopo aplicável (geral + fase do match + grupo do match):
  - `points += points` (acertos exatos, binário);
  - `wrong += (status === "wrong" ? 1 : 0)`.
- `firstPredictionAt` = menor `prediction.createdAt` do usuário (global; tie-break). Ausente se sem `createdAt`.
- `accuracy(scope) = computeAccuracy(points(scope), finishedEligible(scope))`.

### 6.5 Montagem dos rankings
Para cada escopo/grupo: montar `RankableParticipant[]` (uid, points, accuracy, wrong, firstPredictionAt) **incluindo aprovados sem pontos** (points 0) — ranking lista todos os aprovados (telas mostram todos). `rankParticipants(...)` → posições. Mapear p/ `RankingEntry`: `{ uid, nickname, name, position, points, wrong, accuracy }` (name/nickname desnormalizados de `users`). Gravar:
- `rankings/{scope}` = `{ scope, updatedAt, entries }` (valida `rankingSchema`).
- `rankings/grupo-{groupId}` = `{ groupId, updatedAt, entries }` (valida `groupRankingSchema`).

### 6.6 Statistics por usuário
Para cada aprovado:
- `totalCorrect` = points(geral); `totalWrong` = wrong(geral); `accuracy` = accuracy(geral).
- `correctByStage` = points por stage **das 6 fases** (incl. dezesseis-avos/terceiro), parcial (só fases com partida finalizada).
- `longestStreak` = maior sequência de acertos consecutivos das predictions do usuário em partidas finalizadas, **ordenadas por `match.kickoffAt`** (status "correct" mantém a sequência; "wrong" zera).
- `positionHistory`: **ler doc atual** `statistics/{uid}` → append `{ at: nowIso, scope: "geral", position: posiçãoGeralDoUsuário, round: (maxRoundAnterior ?? 0) + 1 }`. Preserva histórico (set merge ou leitura+escrita do array completo). `nowIso = new Date().toISOString()`.
- Gravar `statistics/{uid}` validando `statisticsSchema`.

### 6.7 Pool stats (`pool_stats/current`)
A partir dos `points(geral)` de todos os aprovados:
- `totalParticipants` = nº aprovados.
- `highestPoints` / `highestPointsName` (líder); `lowestPoints`; `averagePoints` = média (fracionária); `totalCorrect` = soma dos points(geral).
- `distribution = buildDistribution(listaDePontosGeral, maxFinishedGeral)` (cobre >100).
- `updatedAt = nowIso`. Valida `poolStatsSchema`. Lista vazia (0 aprovados) → highest/lowest/average 0, distribution com counts 0.

### 6.8 Idempotência
Re-rodar com os mesmos dados produz os mesmos `rankings`/`pool_stats` (derivado de funções puras + `set`). **Exceção consciente:** `positionHistory` cresce a cada execução (cada recalc = uma "rodada"/jornada — A4). Documentar; não é violação de idempotência dos rankings, e sim o registro de evolução por design.

### 6.9 Performance / robustez
- <100 usuários, ~104 partidas. Paralelizar leituras/escritas com `Promise.all`.
- Docs `prediction`/`user` malformados: `safeParse` → `console.warn` e ignora (padrão do score route). Não derrubar o recálculo inteiro.

## 7. Contracts and interfaces

```
POST /api/rankings/recalc
Headers: x-cron-secret?: string   (ou cookie __session de admin)
200 → {
  scopes: number,            // docs de escopo gravados (1 geral + N fases)
  groups: number,            // docs rankings/grupo-* gravados
  participants: number,      // aprovados processados
  finishedMatches: number,   // partidas finalizadas consideradas
  statisticsUpdated: number  // docs statistics/{uid} gravados
}
401 → { error } (sem auth) · 403 → { error } (não-admin) · 5xx → copaDataErrorResponse
```
- `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `import "server-only"`.

## 8. Data and persistence impact

- **Escrita** (server, Admin SDK): `rankings/{scope}`, `rankings/grupo-{groupId}`, `statistics/{uid}`, `pool_stats/current`.
- **Leitura**: `predictions` (todas), `users` (status==approved), `statistics/{uid}` (p/ append de histórico), `fetchAllMatches()`.
- Nova coleção `pool_stats` (doc `current`). Rules em TASK-14.
- `positionHistory` cresce por execução (limitado: poucas jornadas × <100 users).

## 9. Required tests

`__tests__/route.test.ts` (mockar `firebaseAdmin`, `fetchAllMatches`, `cookies` — padrão do score route test):
- **Auth:** sem secret e sem sessão → 401; sessão não-admin → 403; secret correto → 200; sessão admin → 200.
- **Exclusão:** usuário `blocked`/`pending` não aparece em nenhum ranking nem em pool stats.
- **Pontuação binária:** placar exato → +1 em geral, na fase e no grupo; errado → wrong +1, points 0.
- **Escopos:** partida `oitavas` conta em geral + ranking "oitavas", **não** em "grupos"; partida `dezesseis-avos`/`terceiro` conta no geral e em `correctByStage` mas **não** gera ranking de fase.
- **Por grupo:** partidas de grupos agrupadas por `groupId`; doc `rankings/grupo-A` correto.
- **Aproveitamento:** `accuracy` = points/finishedEligible (denominador = finalizadas no escopo).
- **Posição/desempate:** ordem reflete `rankParticipants` (reuso TASK-02).
- **positionHistory:** append incrementa `round` e preserva histórico anterior (mockar doc existente).
- **Idempotência:** rodar 2× → mesmos `rankings`/`pool_stats` (exceto crescimento de positionHistory).
- **Pool stats:** highest/lowest/average/distribution corretos; 0 aprovados → zeros.
- **Doc malformado:** prediction inválida ignorada (warn), recálculo prossegue.

Verificar via JSON do vitest (memory rtk-vitest-false-green).

## 10. Acceptance criteria

- [ ] Endpoint com auth dupla (secret/admin), Node runtime, server-only.
- [ ] Grava rankings por escopo + por grupo, statistics/{uid}, pool_stats/current — todos validados pelos schemas TASK-01.
- [ ] Correção derivada por `scorePrediction` (binário; sem dependência de writes prévios).
- [ ] Exclui `blocked`/`pending`.
- [ ] Escopos de fase corretos (5 rankings; dezesseis-avos/terceiro só geral+correctByStage).
- [ ] `accuracy` com denominador = finalizadas elegíveis; `longestStreak` por ordem cronológica.
- [ ] positionHistory faz append idempotente-de-rodada (round incrementa).
- [ ] Idempotente para rankings/pool_stats.
- [ ] tsc strict, sem `any`; suite verde; testes de rota cobrem os casos da §9.

## 11. UI/Screen requirement

- Requires screen: **no**
- Platform: n/a · Screens: none · Product type / style / UX domains: n/a

(Backend puro — Route Handler. Sem saída visual.)

## 12. Constraints

- `import "server-only"`; `runtime="nodejs"`; `dynamic="force-dynamic"`.
- **Nunca** chamar API-Football/Firestore do client (CLAUDE.md). Pontuação só server-side.
- Sem `any`; TypeScript strict. Sem Cloud Functions (Route Handler + cron externo — ver memory architecture-copa-data).
- Reutilizar `scorePrediction` e helpers TASK-02; não duplicar lógica de pontuação/ordenação.
- `set` com `merge` onde precisar preservar campos (statistics/positionHistory).
- Validar todo doc lido com schema (safeParse) antes de usar.

## 13. Open questions (resolvidas por decisão)

- **OQ1 (path pool stats):** RESOLVIDO → coleção dedicada `pool_stats`, doc `current` (separa do per-uid `statistics`; rules próprias em TASK-14).
- **OQ2 (groupId canônico):** usar `match.groupId` como vem do mapper copaData (ex.: "A".."L" ou "Group A" — confirmar no mapper durante implementação; doc id `grupo-{groupId}` normalizado para minúsculas/slug se necessário).
- **OQ3 (env secret):** `RANKINGS_SECRET` próprio (não reutiliza `SCORE_SECRET`) p/ permitir rotação independente; cron de TASK-14 injeta.
