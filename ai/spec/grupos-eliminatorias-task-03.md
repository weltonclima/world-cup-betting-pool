# SPEC

## 1. Task id and title
- Task: TASK-03
- Title: Domínio — derivação do chaveamento (bracket)

## 2. Objective
Função pura `deriveBracket(matches, teams)` que produz o shape de `BracketResponse` (TASK-01) a partir dos jogos de mata-mata, com rótulos pt-BR para placeholders e estado por confronto.

## 3. In scope
- `src/server/worldcup/bracket.ts`:
  - `deriveBracket(matches: MatchWithId[], teams: TeamWithId[]): BracketPayload` onde `BracketPayload` = `{ roundOf32, roundOf16, quarterFinals, semiFinals, thirdPlace, final: KnockoutMatch[] }` (validável por `bracketResponseSchema`).
- `src/server/worldcup/__tests__/bracket.test.ts` — TDD.

## 4. Out of scope
- Rotas API/cache Firestore (TASK-04). Standings (TASK-02, fechada). UI. Avanço de times (openfootball atualiza team1/team2; não computamos quem avança).

## 5. Main technical areas involved
- Novo `src/server/worldcup/bracket.ts`. Consome `MatchWithId`/`TeamWithId`, produz `KnockoutMatch` (`@/types/worldcup`).
- Fatos do mapper (verificados em `src/server/copaData/mapper.ts`): mata-mata tem `stage ∈ {dezesseis-avos, oitavas, quartas, semifinal, terceiro, final}`, `id = "m{num}"` (73–104), `homeTeamId`/`awayTeamId` = id real do registry **ou** placeholder literal (`1A`/`2L`, `3A/B/C/D/F`, `W74`, `L101` — regex `/^(\d[A-Z]+(\/[A-Z]+)*|[WL]\d+)$/`); `status` só `scheduled|finished`; placares non-null só em finished.

## 6. Business rules and behavior
1. **Inclusão:** somente `stage !== "grupos"`. Agrupar por stage no bucket: `dezesseis-avos→roundOf32`, `oitavas→roundOf16`, `quartas→quarterFinals`, `semifinal→semiFinals`, `terceiro→thirdPlace`, `final→final`.
2. **Ordenação:** dentro de cada bucket, por número extraído do id (`"m73"` → 73) asc. Id sem padrão `m\d+` → ordenar ao final (defensivo, ordem estável).
3. **Lado (KnockoutSide):**
   - teamId presente em `teams` → `{ name, code, flagUrl? (spread condicional), defined: true }`.
   - placeholder → `{ name: rótulo pt-BR, defined: false }` (sem code/flagUrl):
     - `"1A"` → `"1º do Grupo A"`; `"2L"` → `"2º do Grupo L"`.
     - `"3A/B/C/D/F"` → `"3º do Grupo A/B/C/D/F"` (lista literal preservada).
     - `"W74"` → `"Vencedor Jogo 74"`; `"L101"` → `"Perdedor Jogo 101"`.
   - teamId que não é placeholder nem está em `teams` (corrompido) → tratar como placeholder genérico: `{ name: teamId, defined: false }` (defensivo, não lançar).
4. **Status do confronto:** ambos `defined` + match `finished` → `"encerrado"`; ambos `defined` + não finished → `"definido"`; qualquer lado não-defined → `"aguardando"` (consistente com refine do `knockoutMatchSchema`).
5. **Placares:** somente em `"encerrado"` (`homeScore`/`awayScore` do match — ft; et/pênaltis fora de escopo, mapper não expõe). Nos demais status, campos omitidos.
6. **Phase no item:** slug do stage (`"dezesseis-avos"` etc.) — `knockoutPhaseSchema`.
7. **Buckets vazios permitidos** (array vazio) — dados incompletos degradam graciosamente.

## 7. Contracts and interfaces
- Saída validável por `bracketResponseSchema.parse` (TASK-01).
- `id` do KnockoutMatch = id do MatchWithId (`"m73"`).

## 8. Data and persistence impact
Nenhum.

## 9. Required tests
TDD — antes da implementação; pela API pública:
1. Agrupamento: 6 stages → 6 buckets corretos; jogo de grupos excluído.
2. Ordenação por num (m75 antes de m89 no mesmo bucket; inserção fora de ordem).
3. Rótulos placeholder: `1A`, `2L`, `3A/B/C/D/F`, `W74`, `L101` → strings pt-BR exatas da regra 3.
4. Lado real: name/code/flagUrl de `teams`; flagUrl ausente → chave omitida.
5. Status: aguardando (1 placeholder), aguardando (2 placeholders), definido (2 reais não finished), encerrado (2 reais finished) — placares presentes só no encerrado.
6. Misto: um lado real + um placeholder → aguardando, sem placares.
7. teamId corrompido (não-placeholder, fora de teams) → defined:false com name cru, sem lançar.
8. Buckets vazios → arrays vazios.
9. Saída completa passa `bracketResponseSchema.parse`.

## 10. Acceptance criteria
- RED antes (suite falha por import), GREEN depois; commit único tests+impl.
- `npx vitest run` integral sem regressão; `npx tsc --noEmit` e eslint limpos.
- Função pura (sem I/O/Date.now).

## 11. Constraints
- TS strict, zero `any`, alias `@/*`, comentários pt-BR, sem dependência nova.
- Espelhar precedente de pureza de `standings.ts`/`mapper.ts` (sem `import "server-only"`).
- Não alterar TASK-01/02.

## 12. Execution cost profile
- tdd: sonnet/high
- implement: sonnet/high
- test: sonnet/medium
- review: opus/high

## 13. Frontend indicator
- is_frontend: false
- reason: domínio puro.

## 14. Open questions
Nenhuma.
