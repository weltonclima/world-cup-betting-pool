# SPEC

## 1. Task id and title
- Task: TASK-01
- Title: Schemas e types do contrato worldcup

## 2. Objective
Criar os contratos Zod (fonte de verdade) e types TS derivados para as respostas de `/api/worldcup/groups` e `/api/worldcup/bracket`: `GroupStanding`, `KnockoutMatch` e os shapes de resposta `GroupsResponse`/`BracketResponse`.

## 3. In scope
- `src/schemas/worldcup.ts` com:
  - `qualificationSchema` — enum `["classificado", "possivel", "eliminado", "indefinido"]`.
  - `standingTeamSchema` — `{ id, name, code, flagUrl? }` (subset de team; sem `groupId` — o grupo é o agrupador externo). Reusar `nonEmptyString` e o regex de `code` no padrão de `src/schemas/teams.ts`.
  - `groupStandingSchema` — `{ position (int ≥1), team: standingTeamSchema, played, wins, draws, losses, goalsFor, goalsAgainst (todos int ≥0), goalDifference (int, pode ser negativo), points (int ≥0), qualification: qualificationSchema }`. `.strict()`.
  - `groupTableSchema` — `{ groupId: nonEmptyString, standings: groupStandingSchema[] }`.
  - `knockoutPhaseSchema` — enum reusando slugs do `stageSchema` existente, subconjunto mata-mata: `["dezesseis-avos", "oitavas", "quartas", "semifinal", "terceiro", "final"]`.
  - `knockoutSideSchema` — `{ name: nonEmptyString, code?, flagUrl?, defined: boolean }` (`defined: false` → `name` é rótulo de placeholder pt-BR, ex. "2º Grupo A", "Vencedor Jogo 74").
  - `knockoutMatchSchema` — `{ id: nonEmptyString, phase: knockoutPhaseSchema, homeTeam: knockoutSideSchema, awayTeam: knockoutSideSchema, homeScore?, awayScore? (int ≥0), status: enum ["aguardando", "definido", "encerrado"] }`. `.strict()` + refine: `status === "encerrado"` → ambos scores presentes; `status !== "encerrado"` → ambos ausentes; `status === "aguardando"` ↔ pelo menos um lado `defined: false`.
  - `groupsResponseSchema` — `{ groups: groupTableSchema[], hasLiveGroupMatch: boolean }`.
  - `bracketResponseSchema` — `{ roundOf32, roundOf16, quarterFinals, semiFinals, thirdPlace, final: knockoutMatchSchema[] cada }`.
- `src/types/worldcup.ts` — types derivados via `z.infer` (padrão `src/types/teams.ts`): `Qualification`, `StandingTeam`, `GroupStanding`, `GroupTable`, `KnockoutPhase`, `KnockoutSide`, `KnockoutMatch`, `KnockoutMatchStatus`, `GroupsResponse`, `BracketResponse`.
- Exports nos barrels se existirem (`src/types/index.ts` — verificar padrão).

## 4. Out of scope
- Cálculo de standings (TASK-02) e derivação de bracket (TASK-03).
- Rotas API (TASK-04), service/hooks (TASK-05), qualquer UI.
- Alterar `stageSchema`, `teamSchema` ou `src/schemas/shared.ts` (somente reuso/import).

## 5. Main technical areas involved
- `src/schemas/worldcup.ts` (novo) + `src/schemas/__tests__/worldcup.test.ts`.
- `src/types/worldcup.ts` (novo).
- Leitura de referência: `src/schemas/{shared,teams,matches}.ts`.

## 6. Business rules and behavior
- Slugs de fase idênticos aos do `stageSchema` (não criar enum paralelo com outros nomes).
- `qualification` reflete decisão travada do PRD §6.3: `indefinido` enquanto grupo incompleto; `classificado` (1º/2º), `possivel` (3º), `eliminado` (4º) quando completo.
- Placar só em confronto `encerrado` (consistente com refine de `matchSchema`).
- Comentários em pt-BR (convenção do projeto).

## 7. Contracts and interfaces
- `GroupsResponse`: `{ groups: [{ groupId: "A", standings: GroupStanding[] }], hasLiveGroupMatch: boolean }` — ordenado por `groupId`; `standings` ordenado por `position` (1–4).
- `BracketResponse`: `{ roundOf32: KnockoutMatch[], roundOf16: [], quarterFinals: [], semiFinals: [], thirdPlace: [], final: [] }` — arrays ordenados por número do jogo; `thirdPlace`/`final` com no máx. 1 item.
- Nenhum endpoint implementado nesta task — só os shapes.

## 8. Data and persistence impact
Nenhum. Sem Firestore, sem migration. Contratos de transporte apenas.

## 9. Required tests
`src/schemas/__tests__/worldcup.test.ts` (padrão dos schemas existentes):
- parse válido de `groupStandingSchema` completo.
- rejeição: position 0, ints negativos, campo extra (strict), qualification inválida.
- `knockoutMatchSchema`: válido nos 3 status; rejeição de score em `aguardando`/`definido`; rejeição de `encerrado` sem score; rejeição de `aguardando` com ambos os lados `defined: true`.
- `goalDifference` negativo aceito.
- responses: parse de `groupsResponseSchema` e `bracketResponseSchema` mínimos válidos.

## 10. Acceptance criteria
- `npm test` verde incluindo os novos testes.
- `npx tsc --noEmit` sem erros.
- Types exportados consumíveis (`import type { GroupStanding } from "@/types/worldcup"`).
- Zero `any`; `.strict()` em todos os objetos; refine preservado (sem `z.intersection`).

## 11. Constraints
- Zod 4 — não usar `.and`/`z.intersection` (dropa refine; regra do projeto).
- Slugs ingleses/estáveis p/ armazenamento, rótulos pt-BR ficam na UI (convenção `shared.ts`).
- Import alias `@/*`.

## 12. Execution cost profile
- tdd: n/a
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/medium

## 13. Frontend indicator
- is_frontend: false
- reason: contratos/schemas puros, sem UI.

## 14. Open questions
Nenhuma — decisões do PRD §6 cobrem os pontos ambíguos.
