# SPEC

## 1. Task: TASK-01 – Funções puras e constantes de `matches/lib`

## 2. Objective

Centralizar toda a lógica não-React da feature Jogos em `src/features/matches/lib/`, composta por funções puras testáveis em isolamento. A lib é a fundação de TASK-02 (hooks) e TASK-03 (componentes). Sem esta tarefa nenhuma tarefa downstream pode avançar.

## 3. In scope

- `src/features/matches/lib/matchesHelpers.ts` — 6 funções puras:
  1. `buildTeamMap(teams: TeamWithId[]): Map<string, TeamWithId>`
  2. `resolveTeam(teamId: string, teamMap: Map<string, TeamWithId>): ResolvedTeam`
  3. `groupMatchesByDay(matches: MatchWithId[], now: Date): MatchDaySection[]`
  4. `filterMatches(matches: MatchWithId[], filters: MatchFilters): MatchWithId[]`
  5. `searchMatchesByCountry(matches: MatchWithId[], teamMap: Map<string, TeamWithId>, query: string): MatchWithId[]`
  6. `deriveMatchPredictionStatus(match: MatchWithId, predictions: Prediction[], now: Date, globalLock?: boolean): MatchPredictionStatus`
  7. `deriveGameStatusLabel(status: MatchStatus): GameStatusLabel`
- `src/features/matches/lib/matchLabels.ts` — constantes de rótulo + cor para badges (sem hardcode disperso).
- `src/features/matches/lib/__tests__/matchesHelpers.test.ts` — suite Vitest completa cobrindo todos os casos de aresta definidos no plano.
- Tipos auxiliares de saída definidos em `matchesHelpers.ts` e reexportados.

## 4. Out of scope

- Nenhum hook React, componente ou página.
- Nenhuma alteração em services, schemas ou tipos existentes.
- Nenhum novo arquivo de schema Zod.
- Testes para `matchLabels.ts` (constantes estáticas, verificados por importação nos testes de helpers).
- Lógica de `useSystemSettings` / trava global — TASK-01 aceita `globalLock: boolean` como argumento simples (consumidor passa o valor; não faz query).

## 5. Main technical areas

| Arquivo | Ação |
|---|---|
| `src/features/matches/lib/matchesHelpers.ts` | Criar — funções puras + tipos de saída |
| `src/features/matches/lib/matchLabels.ts` | Criar — constantes de badge |
| `src/features/matches/lib/__tests__/matchesHelpers.test.ts` | Criar — suite TDD |
| `src/features/matches/lib/index.ts` | Criar — barrel de lib |

Molde de referência obrigatório: `src/features/home/lib/homeDashboardHelpers.ts` (padrão JSDoc pt-BR, injeção de `now: Date`, sem React/Firebase).

## 6. Business rules and behavior

### 6.1 buildTeamMap / resolveTeam

- `buildTeamMap`: itera `TeamWithId[]` e constrói `Map<string, TeamWithId>` (chave = `id`). Array vazio → Map vazio. Complexidade O(n) build + O(1) lookup.
- `resolveTeam`: busca no Map; se encontrado retorna `{ name, flagUrl }`. Se ausente (seed incompleto, doc deletado) retorna `{ name: teamId, flagUrl: undefined }` — nunca lança exceção.

### 6.2 groupMatchesByDay

- Input: `MatchWithId[]` (qualquer status) + `now: Date`.
- Ordena globalmente por `kickoffAt` ASC antes de agrupar.
- Agrupa por data local (extraída de `kickoffAt` convertido para data do torneio — UTC canônico).
- Rótulo de seção:
  - Mesmo dia de `now` (comparação yyyy-MM-dd UTC) → **"Hoje"**
  - Dia seguinte → **"Amanhã"**
  - Qualquer outro → data por extenso em pt-BR via `date-fns/format` com locale `ptBR` (ex.: "15 de junho de 2026").
- Dentro de cada seção, jogos ordenados por `kickoffAt` ASC.
- Sem jogos → retorna `[]`.

> **Timezone:** `kickoffAt` é UTC canônico (`isoDateTime` do schema). Comparação de dia usa a data UTC do kickoff vs a data UTC de `now` (sem conversão de fuso — consistência garantida).

### 6.3 filterMatches

- Input: `MatchWithId[]` + `MatchFilters` (todos opcionais).
- Filtros:
  - `stage?: Stage` — filtra por `match.stage === stage`.
  - `predictionStatus?: MatchPredictionStatus` — filtra por status derivado (requer que o chamador já tenha derivado os status; neste nível filtra por um campo `_predictionStatus` que o compositor injeta — **OU** esta função não deriva internamente). **Decisão:** `filterMatches` recebe `MatchWithId[]` + filters simples. Filtro por `predictionStatus` é aplicado **pelo compositor** (que já tem os status derivados). `filterMatches` aceita `matches` e filtra apenas por `stage` e `teamId`; filtro `predictionStatus` client-side é responsabilidade do compositor (TASK-02). Mantém a pureza e evita que `filterMatches` precise das predições.
  - `teamId?: string` — filtra partidas onde `homeTeamId === teamId` **OU** `awayTeamId === teamId`.
- Todos os filtros opcionais (omitido = sem filtro). Filtros combinados são AND.
- Retorna novo array (sem mutação).

> **Nota de escopo (A2 plano):** o filtro por `predictionStatus` é client-side mas exige predições; `filterMatches` em `lib/` só recebe dados já resolvidos. Assinatura final: `filterMatches(matches, { stage?, teamId? })`. O compositor de TASK-02 aplica `predictionStatus` depois de derivar os status.

### 6.4 searchMatchesByCountry

- Input: `MatchWithId[]` + `Map<string, TeamWithId>` + `query: string`.
- Normaliza `query`: trim + lowercase.
- Para cada partida resolve `homeTeam.name` e `awayTeam.name` via `resolveTeam`.
- Verifica se qualquer um contém `query` (case-insensitive, substring match via `toLowerCase().includes()`).
- `query` vazio (após trim) → retorna o array original sem filtrar.
- Case-insensitive: "brasil", "Brasil", "BRASIL" → mesmo resultado.

### 6.5 deriveMatchPredictionStatus — REGRA CRÍTICA

```
if (globalLock === true)             → "bloqueado"
else if (now >= new Date(kickoffAt)) → "bloqueado"
else if (match.status !== "scheduled") → "bloqueado"
else if (predictions.some(p => p.matchId === match.id)) → "enviado"
else → "pendente"
```

- `globalLock` é **opcional**, default `false`.
- `now` é injetado (nunca `new Date()` interno) — testabilidade.
- "Exatamente no kickoff" (`now.getTime() === new Date(kickoffAt).getTime()`) → **bloqueado** (operador `>=`).
- "1ms antes do kickoff" → **pendente** (se status === "scheduled" e sem prediction) ou **enviado**.
- `status === "live"`, `"finished"`, `"postponed"`, `"canceled"` → bloqueado (status !== "scheduled").
- Tem prediction mas `globalLock === true` → bloqueado (lock prevalece).
- Tem prediction mas kickoff passou → bloqueado (tempo prevalece).
- Predição de outro `matchId` não conta — comparação por `p.matchId === match.id`.

### 6.6 deriveGameStatusLabel

Mapeia `MatchStatus` → rótulo pt-BR (string literal). Tabela:

| status | rótulo |
|---|---|
| `"scheduled"` | `"Agendado"` |
| `"live"` | `"Ao Vivo"` |
| `"finished"` | `"Encerrado"` |
| `"postponed"` | `"Adiado"` |
| `"canceled"` | `"Cancelado"` |

Função pura, sem side effects. TypeScript deve garantir exhaustiveness (todos os valores de `MatchStatus`).

## 7. Contracts and interfaces

### Types definidos em `matchesHelpers.ts`

```typescript
/** Seleção resolvida a partir do teamMap (espelha ResolvedTeam de home). */
export interface ResolvedTeam {
  name: string;
  flagUrl: string | undefined;
}

/** Status de palpite por partida (distinção de derivePredictionStatus da home). */
export type MatchPredictionStatus = "enviado" | "pendente" | "bloqueado";

/** Rótulo do status do jogo em pt-BR. */
export type GameStatusLabel = "Agendado" | "Ao Vivo" | "Encerrado" | "Adiado" | "Cancelado";

/** Seção de jogos agrupados por dia. */
export interface MatchDaySection {
  label: string;       // "Hoje" | "Amanhã" | "15 de junho de 2026"
  date: string;        // "yyyy-MM-dd" UTC (chave estável para React key)
  matches: MatchWithId[];
}

/** Filtros aceitos por filterMatches. */
export interface MatchFilters {
  stage?: Stage;
  teamId?: string;
}
```

### Constants em `matchLabels.ts`

```typescript
export const PREDICTION_STATUS_LABEL: Record<MatchPredictionStatus, string>
export const PREDICTION_STATUS_COLOR: Record<MatchPredictionStatus, string>  // classes Tailwind
export const GAME_STATUS_LABEL: Record<MatchStatus, GameStatusLabel>
export const GAME_STATUS_COLOR: Record<MatchStatus, string>                  // classes Tailwind
```

Cores semânticas (Tailwind):
- `"enviado"` → verde (ex.: `"bg-green-500/20 text-green-700"`)
- `"pendente"` → âmbar (ex.: `"bg-amber-500/20 text-amber-700"`)
- `"bloqueado"` → cinza (ex.: `"bg-gray-500/20 text-gray-600"`)
- `"Encerrado"` / demais não-scheduled → cinza

### Imports permitidos

- `@/types` — `MatchWithId`, `TeamWithId`, `Prediction`, `Stage`, `MatchStatus`
- `date-fns` — `format`, `isToday`, `isTomorrow`, `startOfDay`, `parseISO` (ou equivalente)
- `date-fns/locale` — `ptBR`
- Nenhum import de React, Firebase, hooks ou services.

## 8. Data and persistence impact

Nenhum. Funções puras — sem I/O, sem side effects, sem estado externo.

## 9. Required tests

Arquivo: `src/features/matches/lib/__tests__/matchesHelpers.test.ts`

### buildTeamMap
- Array vazio → Map vazio
- 3 teams → Map com 3 entradas, chave = id
- Chaves únicas sem colisão

### resolveTeam
- Id presente → `{ name, flagUrl }` corretos
- Id ausente → `{ name: teamId, flagUrl: undefined }` (fallback)
- `flagUrl` undefined no schema → passado como undefined

### groupMatchesByDay
- Array vazio → `[]`
- 1 partida hoje → seção com label "Hoje"
- 1 partida amanhã → seção com label "Amanhã"
- 1 partida em data futura (> amanhã) → seção com data por extenso pt-BR
- Múltiplas partidas no mesmo dia → 1 seção
- Partidas de dias diferentes → seções separadas
- Ordenação por kickoffAt ASC dentro de cada seção
- Ordenação de seções por data ASC

### filterMatches
- Sem filtros → retorna array original
- Filtro `stage` → apenas partidas daquela fase
- Filtro `teamId` → partidas onde é mandante OU visitante
- Filtros combinados (`stage` + `teamId`) → AND lógico
- Filtro que não combina com nenhuma partida → `[]`

### searchMatchesByCountry
- Query vazia (e após trim) → retorna array original
- Query combina com mandante → inclui partida
- Query combina com visitante → inclui partida
- Query não combina → `[]`
- Case-insensitive: "brasil" combina "Brasil"

### deriveMatchPredictionStatus — casos de aresta obrigatórios
- `globalLock === true` + sem prediction → "bloqueado"
- `globalLock === true` + com prediction → "bloqueado" (lock prevalece)
- `now >= kickoffAt` (exatamente no horário) → "bloqueado"
- `now` 1ms antes do kickoff + scheduled + sem pred → "pendente"
- `now` 1ms antes do kickoff + scheduled + com pred → "enviado"
- `status === "live"` + `now < kickoffAt` → "bloqueado" (status !== scheduled)
- `status === "finished"` → "bloqueado"
- `status === "postponed"` → "bloqueado"
- `status === "canceled"` → "bloqueado"
- `status === "scheduled"` + `now < kickoffAt` + sem pred → "pendente"
- `status === "scheduled"` + `now < kickoffAt` + com pred → "enviado"
- Prediction de outro matchId + scheduled + `now < kickoffAt` → "pendente"
- `globalLock` omitido (default false) + scheduled + `now < kickoffAt` + sem pred → "pendente"

### deriveGameStatusLabel
- Cada um dos 5 status → rótulo correto

## 10. Acceptance criteria

1. `src/features/matches/lib/matchesHelpers.ts` existe, exporta as 6 funções e os tipos listados na seção 7.
2. `src/features/matches/lib/matchLabels.ts` existe, exporta as 4 constantes de badge sem hardcode disperso.
3. `src/features/matches/lib/index.ts` existe e reexporta tudo de `matchesHelpers` e `matchLabels`.
4. Todos os testes passam (`vitest run`) — zero falhas, zero skips.
5. `tsc --noEmit` sem erros (TypeScript strict, sem `any`).
6. Nenhum import de React, Firebase, hooks, services ou componentes nos arquivos de `lib/`.
7. Regra crítica de bloqueio: `now >= kickoffAt` resulta em "bloqueado" independente de prediction ou globalLock=false.
8. `globalLock === true` resulta em "bloqueado" independente de qualquer outro fator.
9. `groupMatchesByDay` com array vazio retorna `[]` sem lançar.
10. `resolveTeam` com id ausente retorna fallback sem lançar.
11. Rótulos em pt-BR correspondem exatamente à tabela da seção 6.6.

## 11. UI/Screen requirement

- **Requires screen:** no
- **Platform:** n/a
- **Screens involved:** none
- **Product type:** n/a
- **Recommended style:** n/a
- **Applicable UX domains:** n/a

### Accessibility requirements
N/A — funções puras sem output visual.

### Interaction requirements
N/A.

### UI states required
N/A.

## 12. Constraints

1. **TypeScript strict** — sem `any` em nenhuma linha.
2. **Sem React, Firebase, hooks ou services** nos arquivos de `lib/`.
3. **`now: Date` injetado** em toda função que compare com o tempo atual — nunca `new Date()` interno.
4. **date-fns pt-BR locale** para rótulos de data (`ptBR` de `date-fns/locale`).
5. **`kickoffAt` em UTC** — comparações de dia usam data UTC (sem conversão de fuso).
6. **Sem mutação de arrays** — todas as funções retornam novos arrays/objetos.
7. **Exaustividade no switch/map de status** — TypeScript deve capturar novo valor não mapeado em `deriveGameStatusLabel`.
8. **Rótulos e cores** somente em `matchLabels.ts` — sem strings de cor hardcodadas em outros arquivos.
9. Testes devem usar mocks inline (sem factory do Vitest ou `vi.mock`) — padrão do molde `homeDashboardHelpers.test.ts`.
10. **RTK prefix** para todos os comandos shell (ex.: `rtk vitest run`, `rtk tsc`).

## 13. Open questions

Nenhuma — todas as ambiguidades do PRD foram resolvidas no plan (seção §1, decisões travadas):
- Timezone: UTC canônico ✓
- Rótulos pt-BR: definidos na seção 6.6 ✓
- Busca: mandante **ou** visitante ✓
- `globalLock` opcional (default false) ✓
- `filterMatches`: stage + teamId; predictionStatus fica no compositor ✓
