# SPEC — TASK-02: Lib pura de classificação de grupo, melhores terceiros e progresso

> PRD: `ai/prd/palpites-massa.md` | Plano: `ai/plan/palpites-massa.md` | Branch: `feat/integracao-api-football`
> Tipo: domain | SP: 5 | Criticidade: high | Risco técnico: medium
> TDD recomendado: yes. Screen: no — n/a.
> Depende de: nenhuma (usa tipos `MatchWithId`/`Prediction` existentes em `@/types`).

---

## 1. Objetivo

Implementar quatro funções puras (sem React, sem Firebase) que derivam classificação prevista por grupo, ranking dos 8 melhores terceiros colocados pelo critério FIFA, vencedor de um confronto a partir do placar previsto e métricas de progresso de preenchimento de palpites.

Estas funções são a base de cálculo visual da feature `palpites-massa` (decisão A2 do PRD: classificação e terceiros são **visuais, não pontuados**). Serão consumidas pelas telas PRD03-04 (Classificação Prevista), PRD03-06 (Melhores Terceiros), PRD03-07 (vencedor derivado em eliminatórias) e PRD03-01/Hub (progresso).

---

## 2. Investigação: estado atual dos arquivos

### 2.1 Arquivos de referência de estilo

`src/features/predictions/lib/predictionsHelpers.ts` é o modelo de estilo:
- Funções puras, sem side effects.
- `now: Date` injetado como parâmetro — nunca `new Date()` interno.
- JSDoc em pt-BR em todas as funções exportadas.
- Sem `any`; TypeScript strict.
- Sem imports de React ou Firebase.
- Tipos de retorno explícitos em todos os casos não-triviais.

`src/features/predictions/lib/index.ts` usa barrel de reexportações:
```ts
export * from "./predictionsHelpers";
export * from "./predictionLabels";
```

### 2.2 Tipos existentes em `@/types`

`MatchWithId` = `Match & { id: string }` — `Match` vem de `z.infer<typeof matchSchema>`.
Campos relevantes: `homeTeamId`, `awayTeamId`, `groupId` (nullable/optional), `stage`, `homeScore` (nullable), `awayScore` (nullable), `status`, `kickoffAt`.

`Prediction` = `z.infer<typeof predictionSchema>`.
Campos relevantes: `uid`, `matchId`, `homeScore: number` (inteiro ≥ 0), `awayScore: number` (inteiro ≥ 0).

`Stage` = union dos valores de `stageSchema`: `"grupos" | "dezesseis-avos" | "oitavas" | "quartas" | "semifinal" | "terceiro" | "final"`.

### 2.3 Arquivos novos a criar

| Arquivo | Ação |
|---|---|
| `src/features/predictions/lib/standings.ts` | **Criar** — implementação das 4 funções |
| `src/features/predictions/lib/__tests__/standings.test.ts` | **Criar** — testes TDD RED → GREEN |
| `src/features/predictions/lib/index.ts` | **Modificar** — adicionar `export * from "./standings"` |

### 2.4 Arquivos de teste existentes para modelo

`src/features/predictions/lib/__tests__/predictionsHelpers.test.ts` — modelo de estrutura (helper `makeScheduledMatch`, `makeFinishedMatch`, `makePrediction`; `describe`/`it` com nomes descritivos pt-BR/inglês).

---

## 3. Escopo

### 3.1 Dentro do escopo

| Arquivo | Ação |
|---|---|
| `src/features/predictions/lib/standings.ts` | **Criar** — 4 funções + tipos de retorno |
| `src/features/predictions/lib/__tests__/standings.test.ts` | **Criar** — suite TDD completa |
| `src/features/predictions/lib/index.ts` | **Modificar** — adicionar barrel para `standings` |

### 3.2 Fora do escopo

- Nenhum componente React, hook, serviço, Route Handler.
- Nenhuma chamada ao Firestore ou Firebase.
- Lógica de seeding da chave de eliminatórias — pertence à TASK-03 (`bracket.ts`).
- Lógica de empate por critério de fair play (cartões) — sem dados disponíveis; usar sorteio determinístico.
- Ajuste manual de classificação pelo usuário — decisão A7 do PRD proíbe.

---

## 4. Tipos de saída exportados

Todos os tipos abaixo são exportados de `standings.ts` (e reexportados pelo barrel `index.ts`).

```ts
/** Linha de uma tabela de classificação prevista de grupo. */
export interface GroupStandingEntry {
  /** ID do time (teamId, igual a homeTeamId/awayTeamId em MatchWithId). */
  teamId: string;
  /** Jogos disputados (com palpite preenchido pelo usuário). */
  played: number;
  /** Vitórias previstas. */
  wins: number;
  /** Empates previstos. */
  draws: number;
  /** Derrotas previstas. */
  losses: number;
  /** Gols pró (marcados pelo time nos palpites do usuário). */
  goalsFor: number;
  /** Gols contra (sofridos pelo time nos palpites do usuário). */
  goalsAgainst: number;
  /** Saldo de gols (goalsFor - goalsAgainst). */
  goalDifference: number;
  /** Pontos (vitória=3, empate=1, derrota=0). */
  points: number;
  /** Posição final na tabela (1-based, pós-ordenação). */
  position: number;
}

/** Tabela de classificação prevista de um grupo (4 times, ordenada). */
export type GroupStandings = GroupStandingEntry[];

/**
 * Tabela de todos os grupos, indexada por groupId.
 * Ex.: { "group-a": [...4 entries], "group-b": [...4 entries], ... }
 */
export type AllGroupStandings = Record<string, GroupStandings>;

/**
 * Resultado de deriveWinner.
 * Em eliminatórias, empate requer tratamento especial na UI.
 */
export interface WinnerResult {
  /** ID do time vencedor, ou null em caso de empate. */
  winnerId: string | null;
  /** ID do time perdedor, ou null em caso de empate. */
  loserId: string | null;
  /** true quando homeScore === awayScore (empate de placar previsto). */
  isDraw: boolean;
  /** Placar previsto do mandante. */
  homeScore: number;
  /** Placar previsto do visitante. */
  awayScore: number;
}

/**
 * Métricas de progresso de preenchimento de palpites.
 * "preenchido" = prediction existe para o matchId (via predictions array).
 */
export interface ProgressMetrics {
  /** Número de palpites preenchidos no escopo. */
  filled: number;
  /** Total de partidas no escopo. */
  total: number;
  /** Percentual de preenchimento (0–100, arredondado para 1 casa decimal). */
  percentage: number;
}

/**
 * Progresso global + por fase.
 * A chave "global" agrega todas as partidas; as demais são valores de Stage.
 */
export interface ComputeProgressResult {
  /** Progresso agregando todas as partidas da lista `matches`. */
  global: ProgressMetrics;
  /** Progresso por fase (stage). Inclui apenas fases com ao menos 1 partida. */
  byStage: Partial<Record<Stage, ProgressMetrics>>;
}
```

---

## 5. Especificação das funções

### 5.1 `computeGroupStandings`

```ts
/**
 * Calcula a tabela de classificação prevista de um grupo a partir dos palpites do usuário.
 *
 * Usa os placares PREVISTOS (prediction.homeScore / prediction.awayScore),
 * não os resultados reais. Partidas sem palpite são ignoradas (não contam pontos).
 *
 * Desempate (ordem de aplicação — critério FIFA padrão, A7 do PRD):
 * 1. Pontos (decrescente)
 * 2. Saldo de gols (decrescente)
 * 3. Gols pró (decrescente)
 * 4. Confronto direto — pontos entre os times empatados nos critérios 1-3
 *    (se mais de 2 times empatados: saldo entre eles → gols pró entre eles)
 * 5. Sorteio determinístico: ordenar por teamId ASC (estabilidade entre renders)
 *
 * @param matches    - Todas as partidas do grupo (stage === "grupos", mesmo groupId).
 *                     Deve conter apenas partidas do grupo em questão.
 * @param predictions - Palpites do usuário (podem cobrir qualquer matchId;
 *                      a função filtra os relevantes pelo matchId das partidas).
 * @returns Tabela ordenada com posição 1–4 atribuída (position = índice + 1).
 */
export function computeGroupStandings(
  matches: MatchWithId[],
  predictions: Prediction[],
): GroupStandings
```

**Algoritmo detalhado:**

1. **Coletar times:** extrair `homeTeamId` e `awayTeamId` de cada partida; deduplificar → set de teamIds do grupo.
2. **Inicializar entradas:** para cada teamId, `{ teamId, played:0, wins:0, draws:0, losses:0, goalsFor:0, goalsAgainst:0, goalDifference:0, points:0, position:0 }`.
3. **Indexar palpites:** `Map<matchId, Prediction>` a partir de `predictions` (usar `prediction.matchId` como chave). Se houver duplicados de matchId no array (improvável mas possível), prevalece o último.
4. **Iterar partidas:** para cada `match` em `matches`:
   - Buscar palpite no Map pelo `match.id`.
   - Se não encontrado: **ignorar** (time não ganha pontos por jogo sem palpite).
   - Se encontrado: aplicar regras de pontuação (vitória=3, empate=1, derrota=0) sobre `prediction.homeScore` e `prediction.awayScore`.
   - Atualizar `played`, `wins`/`draws`/`losses`, `goalsFor`, `goalsAgainst`, `goalDifference` de ambos os times.
5. **Ordenação:** implementar comparador multi-critério (ver abaixo).
6. **Atribuir `position`:** após ordenar, `entry.position = index + 1`.

**Comparador de ordenação (decrescente = melhor para pior):**

```
comparar(a, b):
  1. b.points - a.points              → desempate por pontos (decrescente)
  2. b.goalDifference - a.goalDifference  → saldo de gols
  3. b.goalsFor - a.goalsFor          → gols pró
  4. confronto direto (ver abaixo)
  5. a.teamId.localeCompare(b.teamId)  → sorteio determinístico (ASC)
```

**Confronto direto (critério 4):**

O confronto direto é calculado apenas entre os times empatados nos critérios 1–3 (mesmo bloco). Na implementação do comparador para Array.sort(), quando os critérios 1–3 são iguais entre `a` e `b`:

- Buscar no array de `matches` as partidas entre `a.teamId` e `b.teamId`.
- Para cada partida encontrada, verificar se há palpite no Map.
- Calcular pontos/saldo/gols-pró apenas entre esses dois times nesses confrontos diretos.
- Comparar `pontosA - pontosB` → se diferente, usar.
- Comparar `saldoA - saldoB` → se diferente, usar.
- Comparar `goalsProA - goalsProB` → se diferente, usar.
- Se ainda empatados → critério 5 (teamId).

> Nota de implementação: `Array.sort` em JavaScript é estável (ES2019+) — ok para o critério 5.

**Invariantes:**
- Retorna sempre exatamente `n` entradas, onde `n` = número de times únicos nas partidas.
- Para um grupo padrão de 4 times, retorna 4 entradas com `position` 1, 2, 3, 4.
- Partidas sem palpite não afetam a tabela (time permanece com 0 pontos nessa partida).
- Função é **pura**: mesmo input → mesmo output. Sem `Math.random()`.

---

### 5.2 `rankBestThirds`

```ts
/**
 * Seleciona e ordena os 8 melhores terceiros colocados (posição 3 de cada grupo)
 * a partir das tabelas de todos os grupos. Critério FIFA Copa 2026.
 *
 * Critério de ordenação (decrescente — melhor 3º primeiro):
 * 1. Pontos (decrescente)
 * 2. Saldo de gols (decrescente)
 * 3. Gols pró (decrescente)
 * 4. Sorteio determinístico: teamId ASC (estabilidade entre renders)
 *
 * Decisão A2 do PRD: esta classificação é VISUAL, não pontuada.
 * Decisão A7: sem fair play e sem ajuste manual.
 *
 * @param allGroupStandings - Tabelas de todos os grupos (Record<groupId, GroupStandings>).
 *                            Espera-se uma tabela ordenada por grupo (pós-computeGroupStandings).
 * @returns Array de 8 GroupStandingEntry (ou menos se houver < 8 grupos com 3º colocado),
 *          ordenado do melhor ao pior terceiro. Cada entry mantém os campos originais
 *          (points, goalDifference, goalsFor, teamId).
 */
export function rankBestThirds(
  allGroupStandings: AllGroupStandings,
): GroupStandingEntry[]
```

**Algoritmo detalhado:**

1. Extrair o 3º colocado (`position === 3`) de cada grupo em `allGroupStandings`.
2. Se um grupo não tiver entrada com `position === 3` (ex.: grupo incompleto / < 3 times), ignorar.
3. Ordenar o array de terceiros pelo mesmo multi-critério de `computeGroupStandings` (pontos → saldo → gols pró → teamId ASC).
4. Retornar os primeiros 8 (`slice(0, 8)`).

**Invariantes:**
- Se `allGroupStandings` tiver 12 grupos, retorna exatamente 8 entradas (os 8 melhores terceiros).
- Se tiver < 8 grupos, retorna todos os terceiros disponíveis (< 8 itens).
- Puro: sem side effects.

---

### 5.3 `deriveWinner`

```ts
/**
 * Deriva o vencedor de um confronto eliminatório a partir do placar previsto.
 *
 * Usado nas telas de bracket (PRD03-07…11) para projetar o avanço na chave.
 * Em caso de empate, retorna winnerId: null e isDraw: true — a UI deve exigir
 * que o usuário ajuste o placar (placares empatados são inválidos em eliminatórias).
 *
 * Decisão A1 do PRD: eliminatória pontua placar exato; vencedor é DERIVADO do placar.
 *
 * @param homeTeamId  - ID do time mandante.
 * @param awayTeamId  - ID do time visitante.
 * @param homeScore   - Placar previsto do mandante (inteiro ≥ 0).
 * @param awayScore   - Placar previsto do visitante (inteiro ≥ 0).
 * @returns WinnerResult com winnerId, loserId, isDraw e os placares.
 */
export function deriveWinner(
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number,
): WinnerResult
```

**Algoritmo:**

```
se homeScore > awayScore:
  → winnerId = homeTeamId, loserId = awayTeamId, isDraw = false
se awayScore > homeScore:
  → winnerId = awayTeamId, loserId = homeTeamId, isDraw = false
se homeScore === awayScore:
  → winnerId = null, loserId = null, isDraw = true
```

**Invariante:** Função é pura; retorna `WinnerResult` completo sempre. Não lança exceção para empate — delega o tratamento à UI.

> **Sobrecarga de conveniência para `Prediction` + `MatchWithId`:**
>
> ```ts
> /**
>  * Sobrecarga conveniente: recebe um palpite e a partida correspondente.
>  * Equivalente a chamar deriveWinner(match.homeTeamId, match.awayTeamId, pred.homeScore, pred.awayScore).
>  */
> export function deriveWinnerFromPrediction(
>   prediction: Prediction,
>   match: MatchWithId,
> ): WinnerResult
> ```
>
> Implementação: delega para `deriveWinner(match.homeTeamId, match.awayTeamId, prediction.homeScore, prediction.awayScore)`.

---

### 5.4 `computeProgress`

```ts
/**
 * Calcula métricas de preenchimento de palpites: global e por fase (stage).
 *
 * "Preenchido" = existe ao menos um Prediction no array com matchId === match.id.
 * Partidas de qualquer stage são consideradas; a função não filtra por groupId.
 *
 * @param predictions - Array de palpites do usuário (de qualquer partida).
 * @param matches     - Array de partidas a considerar (escopo total ou filtrado pelo chamador).
 * @returns ComputeProgressResult com global e byStage.
 */
export function computeProgress(
  predictions: Prediction[],
  matches: MatchWithId[],
): ComputeProgressResult
```

**Algoritmo:**

1. Construir `Set<string>` de `matchId` a partir de `predictions` (O(n) lookup).
2. Para cada `match` em `matches`:
   - Incrementar contadores globais (`total++`; `filled++` se `matchId` está no Set).
   - Incrementar contadores por `match.stage`.
3. Calcular `percentage = total > 0 ? Math.round((filled / total) * 1000) / 10 : 0` (1 casa decimal).
4. Incluir em `byStage` apenas stages com `total > 0`.
5. Retornar `{ global, byStage }`.

**Invariantes:**
- `percentage` está no intervalo [0, 100].
- Se `matches` for vazio, retorna `{ global: { filled: 0, total: 0, percentage: 0 }, byStage: {} }`.
- Se `predictions` for vazio, `filled === 0` em todos os escopos.
- Puro: sem side effects.

---

## 6. Implementação: `standings.ts`

### 6.1 Estrutura do arquivo

```ts
/**
 * Lib pura de classificação de grupo, melhores terceiros e progresso (TASK-02).
 * Sem React, sem Firebase — testável em isolamento.
 * Consumida pelas telas PRD03-01 (Hub), PRD03-04 (classificação),
 * PRD03-06 (melhores terceiros) e pela lib de bracket (TASK-03).
 */

import type { MatchWithId, Prediction, Stage } from "@/types";

// ---------------------------------------------------------------------------
// Tipos de saída (exportados)
// ---------------------------------------------------------------------------

export interface GroupStandingEntry { ... }
export type GroupStandings = GroupStandingEntry[];
export type AllGroupStandings = Record<string, GroupStandings>;
export interface WinnerResult { ... }
export interface ProgressMetrics { ... }
export interface ComputeProgressResult { ... }

// ---------------------------------------------------------------------------
// Helpers internos (não exportados)
// ---------------------------------------------------------------------------

/** Inicializa uma entrada de tabela zerada para um time. */
function initEntry(teamId: string): GroupStandingEntry { ... }

/** Aplica o resultado de uma partida prevista às entradas de dois times. */
function applyResult(
  home: GroupStandingEntry,
  away: GroupStandingEntry,
  homeScore: number,
  awayScore: number,
): void { ... }

/**
 * Calcula pontos, saldo e gols pró do confronto direto entre dois times,
 * dado o array de todas as partidas e o Map de palpites.
 */
function headToHead(
  teamA: string,
  teamB: string,
  matches: MatchWithId[],
  predMap: Map<string, Prediction>,
): { pointsA: number; pointsB: number; gdA: number; gdB: number; gfA: number; gfB: number } { ... }

/** Comparador de tabela multi-critério (pontos → saldo → gols pró → h2h → teamId). */
function standingsComparator(
  a: GroupStandingEntry,
  b: GroupStandingEntry,
  matches: MatchWithId[],
  predMap: Map<string, Prediction>,
): number { ... }

/** Calcula ProgressMetrics a partir de contadores. */
function toMetrics(filled: number, total: number): ProgressMetrics { ... }

// ---------------------------------------------------------------------------
// Funções exportadas
// ---------------------------------------------------------------------------

export function computeGroupStandings(...): GroupStandings { ... }
export function rankBestThirds(...): GroupStandingEntry[] { ... }
export function deriveWinner(...): WinnerResult { ... }
export function deriveWinnerFromPrediction(...): WinnerResult { ... }
export function computeProgress(...): ComputeProgressResult { ... }
```

### 6.2 Imports

```ts
import type { MatchWithId, Prediction, Stage } from "@/types";
```

Sem outros imports externos. Sem `date-fns`, sem Firebase, sem React.

### 6.3 Atualização do barrel `index.ts`

```ts
export * from "./predictionsHelpers";
export * from "./predictionLabels";
export * from "./standings"; // TASK-02: classificação, terceiros, progresso
```

---

## 7. Testes TDD (RED → GREEN)

Arquivo: `src/features/predictions/lib/__tests__/standings.test.ts`

### 7.1 Helpers de fixture

```ts
import { describe, expect, it } from "vitest";
import type { MatchWithId, Prediction } from "@/types";
import {
  computeGroupStandings,
  computeProgress,
  deriveWinner,
  deriveWinnerFromPrediction,
  rankBestThirds,
} from "@/features/predictions/lib";

// Helper: cria partida de grupo entre dois times
function makeGroupMatch(
  id: string,
  homeTeamId: string,
  awayTeamId: string,
  groupId = "group-a",
  overrides: Partial<MatchWithId> = {},
): MatchWithId {
  return {
    id,
    homeTeamId,
    awayTeamId,
    kickoffAt: "2026-06-20T18:00:00.000Z",
    stage: "grupos",
    round: 1,
    groupId,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    venue: null,
    ...overrides,
  };
}

// Helper: cria palpite
function makePred(
  matchId: string,
  homeScore: number,
  awayScore: number,
  uid = "user-01",
): Prediction {
  return { uid, matchId, homeScore, awayScore };
}

// 4 times do Grupo A para os testes
const T1 = "team-bra";
const T2 = "team-arg";
const T3 = "team-fra";
const T4 = "team-ger";

// 6 partidas do Grupo A (round-robin 4 times)
const GROUP_A_MATCHES: MatchWithId[] = [
  makeGroupMatch("m01", T1, T2), // BRA x ARG
  makeGroupMatch("m02", T3, T4), // FRA x GER
  makeGroupMatch("m03", T1, T3), // BRA x FRA
  makeGroupMatch("m04", T2, T4), // ARG x GER
  makeGroupMatch("m05", T1, T4), // BRA x GER
  makeGroupMatch("m06", T2, T3), // ARG x FRA
];
```

### 7.2 Suíte `computeGroupStandings`

```ts
describe("computeGroupStandings", () => {
  it("sem palpites → todos com 0 pontos, ordenados por teamId", () => {
    const result = computeGroupStandings(GROUP_A_MATCHES, []);
    expect(result).toHaveLength(4);
    expect(result.every((e) => e.points === 0)).toBe(true);
    // Critério 5 (teamId ASC): team-arg < team-bra < team-fra < team-ger
    expect(result.map((e) => e.teamId)).toEqual([T2, T1, T3, T4]);
    expect(result[0].position).toBe(1);
    expect(result[3].position).toBe(4);
  });

  it("um time com vitórias em todas as partidas → 1º lugar com pontos máximos", () => {
    // BRA vence todos (3+3+3 = 9 pts); os outros variam
    const predictions: Prediction[] = [
      makePred("m01", 2, 0), // BRA 2×0 ARG → BRA 3pts
      makePred("m03", 1, 0), // BRA 1×0 FRA → BRA 3pts
      makePred("m05", 3, 1), // BRA 3×1 GER → BRA 3pts
    ];
    const result = computeGroupStandings(GROUP_A_MATCHES, predictions);
    expect(result[0].teamId).toBe(T1); // BRA é 1º
    expect(result[0].points).toBe(9);
    expect(result[0].played).toBe(3);
    expect(result[0].wins).toBe(3);
    expect(result[0].goalsFor).toBe(6);
    expect(result[0].goalsAgainst).toBe(1);
    expect(result[0].goalDifference).toBe(5);
    expect(result[0].position).toBe(1);
  });

  it("desempate por saldo de gols (pontos iguais)", () => {
    // ARG e FRA com mesmos pontos, ARG com melhor saldo
    const predictions: Prediction[] = [
      makePred("m01", 0, 2), // ARG 2×0 BRA → ARG 3pts, +2
      makePred("m06", 1, 0), // ARG 1×0 FRA → ARG 3pts, FRA 0pts
      makePred("m02", 2, 0), // FRA 2×0 GER → FRA 3pts, +2
      makePred("m04", 0, 2), // GER 2×0 ARG → GER 3pts, ARG -2 total
    ];
    const result = computeGroupStandings(GROUP_A_MATCHES, predictions);
    // ARG: 3+0 = 3pts, +2-2 = 0 saldo
    // FRA: 0+3 = 3pts, +2-1 = +1 saldo  → FRA acima de ARG
    const fraPos = result.find((e) => e.teamId === T3)!.position;
    const argPos = result.find((e) => e.teamId === T2)!.position;
    expect(fraPos).toBeLessThan(argPos);
  });

  it("desempate por gols pró (pontos e saldo iguais)", () => {
    // Dois times com 3pts e saldo 0, mas um com mais gols pró
    const predictions: Prediction[] = [
      makePred("m01", 2, 1), // BRA vence ARG 2×1 → BRA 3pts, saldo +1
      makePred("m02", 1, 2), // GER vence FRA 2×1 → GER 3pts, saldo +1
      makePred("m03", 0, 1), // FRA vence BRA 1×0 → FRA 3pts, BRA 3pts total
      makePred("m04", 1, 0), // ARG vence GER 1×0 → ARG 3pts, GER 3pts total
      // BRA: 3+0=3pts, +1-1=0 saldo, gols pró: 2+0=2
      // GER: 0+3=3pts, +1-1=0 saldo, gols pró: 2+0=2  → mesmo; teamId desempata
    ];
    const result = computeGroupStandings(GROUP_A_MATCHES, predictions);
    // Teste de estabilidade: teamId ASC desempata quando tudo mais é igual
    const braPos = result.find((e) => e.teamId === T1)!.position;
    const gerPos = result.find((e) => e.teamId === T4)!.position;
    expect(braPos).not.toBe(gerPos);
  });

  it("desempate por confronto direto (pontos e saldo e gols pró iguais entre 2 times)", () => {
    // BRA e ARG com pontos/saldo/gols-pró idênticos contra os outros dois,
    // mas BRA venceu o confronto direto
    const predictions: Prediction[] = [
      makePred("m01", 1, 0), // BRA 1×0 ARG → BRA vence confronto direto
      makePred("m03", 1, 0), // BRA 1×0 FRA
      makePred("m05", 0, 1), // GER 1×0 BRA
      makePred("m02", 0, 1), // GER 1×0 FRA
      makePred("m04", 0, 1), // GER 1×0 ARG ... mas ARG perdeu
      makePred("m06", 1, 0), // ARG 1×0 FRA
      // BRA: vitórias sobre ARG e FRA (6pts de confrontos com FRA e ARG); derrota para GER
      // ARG: vitória sobre FRA (3pts); derrota BRA e GER
      // BRA deve estar acima de ARG pelo confronto direto
    ];
    const result = computeGroupStandings(GROUP_A_MATCHES, predictions);
    const braPos = result.find((e) => e.teamId === T1)!.position;
    const argPos = result.find((e) => e.teamId === T2)!.position;
    expect(braPos).toBeLessThan(argPos);
  });

  it("partidas sem palpite não contam pontos (time fica em 0 nessa partida)", () => {
    // Só um palpite: BRA 1×0 ARG
    const predictions: Prediction[] = [makePred("m01", 1, 0)];
    const result = computeGroupStandings(GROUP_A_MATCHES, predictions);
    const bra = result.find((e) => e.teamId === T1)!;
    expect(bra.played).toBe(1); // só 1 jogo com palpite
    expect(bra.points).toBe(3);
    const fra = result.find((e) => e.teamId === T3)!;
    expect(fra.played).toBe(0); // FRA não tem palpites nas suas partidas ainda
    expect(fra.points).toBe(0);
  });

  it("position é 1-based e contínuo (sem buracos)", () => {
    const result = computeGroupStandings(GROUP_A_MATCHES, []);
    const positions = result.map((e) => e.position).sort((a, b) => a - b);
    expect(positions).toEqual([1, 2, 3, 4]);
  });

  it("empate técnico completo → desempate por teamId ASC (determinístico)", () => {
    // Sem palpites: todos com 0 pts, 0 saldo, 0 gols pró
    const result = computeGroupStandings(GROUP_A_MATCHES, []);
    const teamIds = result.map((e) => e.teamId);
    // teamId ASC: arg < bra < fra < ger
    expect(teamIds).toEqual(
      [...teamIds].sort((a, b) => a.localeCompare(b)),
    );
  });

  it("idempotência: mesmo input → mesmo output", () => {
    const preds = [makePred("m01", 2, 1), makePred("m02", 0, 0)];
    const r1 = computeGroupStandings(GROUP_A_MATCHES, preds);
    const r2 = computeGroupStandings(GROUP_A_MATCHES, preds);
    expect(r1).toEqual(r2);
  });
});
```

### 7.3 Suíte `rankBestThirds`

```ts
describe("rankBestThirds", () => {
  // Helper: cria GroupStandings simulada com 4 entries
  function makeStandings(
    groupId: string,
    entries: Array<{ teamId: string; points: number; gd: number; gf: number }>,
  ): GroupStandings {
    return entries.map((e, i) => ({
      teamId: e.teamId,
      played: 3,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: e.gf,
      goalsAgainst: e.gf - e.gd,
      goalDifference: e.gd,
      points: e.points,
      position: i + 1,
    }));
  }

  it("extrai o 3º colocado de cada grupo e retorna os 8 melhores", () => {
    const allStandings: Record<string, GroupStandings> = {};
    for (let i = 0; i < 12; i++) {
      const gId = `group-${String.fromCharCode(97 + i)}`;
      allStandings[gId] = makeStandings(gId, [
        { teamId: `t${i}-1`, points: 9, gd: 6, gf: 8 },
        { teamId: `t${i}-2`, points: 6, gd: 2, gf: 5 },
        { teamId: `t${i}-3`, points: 3, gd: i, gf: i + 1 }, // gd varia por grupo
        { teamId: `t${i}-4`, points: 0, gd: -8, gf: 0 },
      ]);
    }
    const result = rankBestThirds(allStandings);
    expect(result).toHaveLength(8);
    // Os 8 com maior gd (0..11) → grupos k(10), l(11) e os 6 seguintes
    const topGds = result.map((e) => e.goalDifference).sort((a, b) => b - a);
    expect(topGds[0]).toBeGreaterThanOrEqual(topGds[1]);
  });

  it("ordena por pontos → saldo → gols pró → teamId", () => {
    const allStandings: Record<string, GroupStandings> = {
      "group-a": makeStandings("group-a", [
        { teamId: "t-a1", points: 9, gd: 5, gf: 7 },
        { teamId: "t-a2", points: 6, gd: 2, gf: 4 },
        { teamId: "t-a3-melhor", points: 4, gd: 2, gf: 6 }, // 3º - melhor gols pró
        { teamId: "t-a4", points: 0, gd: -9, gf: 0 },
      ]),
      "group-b": makeStandings("group-b", [
        { teamId: "t-b1", points: 9, gd: 5, gf: 7 },
        { teamId: "t-b2", points: 6, gd: 2, gf: 4 },
        { teamId: "t-b3-pior", points: 4, gd: 2, gf: 3 }, // 3º - menos gols pró
        { teamId: "t-b4", points: 0, gd: -9, gf: 0 },
      ]),
    };
    const result = rankBestThirds(allStandings);
    expect(result[0].teamId).toBe("t-a3-melhor");
    expect(result[1].teamId).toBe("t-b3-pior");
  });

  it("com < 8 grupos → retorna todos os terceiros disponíveis (< 8)", () => {
    const allStandings: Record<string, GroupStandings> = {
      "group-a": makeStandings("group-a", [
        { teamId: "ta1", points: 9, gd: 5, gf: 7 },
        { teamId: "ta2", points: 6, gd: 2, gf: 4 },
        { teamId: "ta3", points: 3, gd: 0, gf: 2 },
        { teamId: "ta4", points: 0, gd: -7, gf: 0 },
      ]),
    };
    const result = rankBestThirds(allStandings);
    expect(result).toHaveLength(1);
    expect(result[0].teamId).toBe("ta3");
  });

  it("desempate final por teamId ASC (determinístico)", () => {
    // Dois terceiros com exatamente os mesmos stats
    const allStandings: Record<string, GroupStandings> = {
      "group-a": makeStandings("group-a", [
        { teamId: "ta1", points: 9, gd: 5, gf: 7 },
        { teamId: "ta2", points: 6, gd: 2, gf: 4 },
        { teamId: "zzz", points: 3, gd: 0, gf: 2 }, // teamId > "aaa"
        { teamId: "ta4", points: 0, gd: -7, gf: 0 },
      ]),
      "group-b": makeStandings("group-b", [
        { teamId: "tb1", points: 9, gd: 5, gf: 7 },
        { teamId: "tb2", points: 6, gd: 2, gf: 4 },
        { teamId: "aaa", points: 3, gd: 0, gf: 2 }, // teamId < "zzz"
        { teamId: "tb4", points: 0, gd: -7, gf: 0 },
      ]),
    };
    const result = rankBestThirds(allStandings);
    // "aaa" < "zzz" → "aaa" fica em 1º no desempate por teamId ASC
    expect(result[0].teamId).toBe("aaa");
  });
});
```

### 7.4 Suíte `deriveWinner`

```ts
describe("deriveWinner", () => {
  it("mandante vence → winnerId = homeTeamId, isDraw = false", () => {
    const r = deriveWinner("bra", "arg", 2, 0);
    expect(r.winnerId).toBe("bra");
    expect(r.loserId).toBe("arg");
    expect(r.isDraw).toBe(false);
    expect(r.homeScore).toBe(2);
    expect(r.awayScore).toBe(0);
  });

  it("visitante vence → winnerId = awayTeamId, isDraw = false", () => {
    const r = deriveWinner("bra", "arg", 0, 1);
    expect(r.winnerId).toBe("arg");
    expect(r.loserId).toBe("bra");
    expect(r.isDraw).toBe(false);
  });

  it("empate → winnerId = null, loserId = null, isDraw = true", () => {
    const r = deriveWinner("bra", "arg", 1, 1);
    expect(r.winnerId).toBeNull();
    expect(r.loserId).toBeNull();
    expect(r.isDraw).toBe(true);
  });

  it("0×0 → empate (isDraw = true)", () => {
    const r = deriveWinner("bra", "arg", 0, 0);
    expect(r.isDraw).toBe(true);
    expect(r.winnerId).toBeNull();
  });

  it("placar grande → vencedor correto", () => {
    const r = deriveWinner("bra", "arg", 7, 1);
    expect(r.winnerId).toBe("bra");
    expect(r.isDraw).toBe(false);
  });
});

describe("deriveWinnerFromPrediction", () => {
  it("delega corretamente para deriveWinner com homeTeamId/awayTeamId da partida", () => {
    const match: MatchWithId = {
      id: "m01",
      homeTeamId: "bra",
      awayTeamId: "arg",
      kickoffAt: "2026-06-20T18:00:00.000Z",
      stage: "oitavas",
      round: null,
      groupId: null,
      status: "scheduled",
      homeScore: null,
      awayScore: null,
      venue: null,
    };
    const prediction: Prediction = {
      uid: "user-01",
      matchId: "m01",
      homeScore: 2,
      awayScore: 1,
    };
    const r = deriveWinnerFromPrediction(prediction, match);
    expect(r.winnerId).toBe("bra");
    expect(r.isDraw).toBe(false);
    expect(r.homeScore).toBe(2);
    expect(r.awayScore).toBe(1);
  });
});
```

### 7.5 Suíte `computeProgress`

```ts
describe("computeProgress", () => {
  const matchGrupos1 = makeGroupMatch("m01", "bra", "arg", "group-a");
  const matchGrupos2 = makeGroupMatch("m02", "fra", "ger", "group-a");
  const matchOitavas: MatchWithId = {
    ...makeGroupMatch("m10", "bra", "ger"),
    stage: "oitavas",
    groupId: null,
  };

  it("sem partidas → global { filled:0, total:0, percentage:0 }, byStage vazio", () => {
    const r = computeProgress([], []);
    expect(r.global).toEqual({ filled: 0, total: 0, percentage: 0 });
    expect(r.byStage).toEqual({});
  });

  it("sem palpites, com 2 partidas → filled=0, total=2, percentage=0", () => {
    const r = computeProgress([], [matchGrupos1, matchGrupos2]);
    expect(r.global.filled).toBe(0);
    expect(r.global.total).toBe(2);
    expect(r.global.percentage).toBe(0);
    expect(r.byStage.grupos?.total).toBe(2);
    expect(r.byStage.grupos?.filled).toBe(0);
  });

  it("1 de 2 palpites preenchidos → percentage = 50", () => {
    const preds = [makePred("m01", 1, 0)];
    const r = computeProgress(preds, [matchGrupos1, matchGrupos2]);
    expect(r.global.filled).toBe(1);
    expect(r.global.total).toBe(2);
    expect(r.global.percentage).toBe(50);
  });

  it("todos preenchidos → percentage = 100", () => {
    const preds = [makePred("m01", 1, 0), makePred("m02", 2, 1)];
    const r = computeProgress(preds, [matchGrupos1, matchGrupos2]);
    expect(r.global.percentage).toBe(100);
    expect(r.global.filled).toBe(2);
  });

  it("separa progresso por stage corretamente", () => {
    const preds = [makePred("m01", 1, 0), makePred("m10", 2, 1)];
    const matches = [matchGrupos1, matchGrupos2, matchOitavas];
    const r = computeProgress(preds, matches);
    expect(r.global.total).toBe(3);
    expect(r.global.filled).toBe(2);
    expect(r.byStage.grupos?.total).toBe(2);
    expect(r.byStage.grupos?.filled).toBe(1);
    expect(r.byStage.oitavas?.total).toBe(1);
    expect(r.byStage.oitavas?.filled).toBe(1);
    expect(r.byStage.oitavas?.percentage).toBe(100);
  });

  it("byStage exclui stages sem partidas", () => {
    const r = computeProgress([], [matchGrupos1]);
    expect(Object.keys(r.byStage)).toEqual(["grupos"]);
    expect(r.byStage.oitavas).toBeUndefined();
  });

  it("percentage arredonda para 1 casa decimal (ex.: 1/3 ≈ 33.3)", () => {
    const m1 = makeGroupMatch("mx1", "t1", "t2");
    const m2 = makeGroupMatch("mx2", "t3", "t4");
    const m3 = makeGroupMatch("mx3", "t1", "t3");
    const preds = [makePred("mx1", 1, 0)];
    const r = computeProgress(preds, [m1, m2, m3]);
    expect(r.global.percentage).toBe(33.3);
  });

  it("palpites extras (matchId não em matches) são ignorados na contagem", () => {
    const preds = [makePred("m01", 1, 0), makePred("m99", 0, 0)]; // m99 não existe em matches
    const r = computeProgress(preds, [matchGrupos1]);
    expect(r.global.total).toBe(1);
    expect(r.global.filled).toBe(1);
  });
});
```

---

## 8. Contrato de imports e convenções

```ts
// standings.ts — imports permitidos
import type { MatchWithId, Prediction, Stage } from "@/types";

// Proibido:
// import React from "react";
// import { db } from "@/firebase";
// import { ... } from "firebase/firestore";
// any
// style={{ ... }}
```

Todas as funções exportadas têm JSDoc em pt-BR (conforme padrão de `predictionsHelpers.ts`).

Funções helper internas (`initEntry`, `applyResult`, `headToHead`, `standingsComparator`, `toMetrics`) NÃO são exportadas — ficam no módulo sem export.

Sem `Math.random()` em nenhum ponto — determinismo garantido pelo critério 5 (`teamId.localeCompare`).

---

## 9. Arquivos afetados (resumo)

| Arquivo | Ação | Criticidade |
|---|---|---|
| `src/features/predictions/lib/standings.ts` | **Criar** — 4 funções + tipos | Alta |
| `src/features/predictions/lib/__tests__/standings.test.ts` | **Criar** — suite TDD completa | Alta |
| `src/features/predictions/lib/index.ts` | **Modificar** — adicionar `export * from "./standings"` | Média |

---

## 10. Decisões e rationale

| Decisão | Rationale |
|---|---|
| Desempate determinístico por `teamId ASC` (critério 5) | Evita `Math.random()` e garante resultado estável entre renders. Fair play e critérios FIFA adicionais não têm dados disponíveis. Decisão A7 do PRD. |
| Partidas sem palpite ignoradas (não adicionam `played`) | Só contam jogos onde o usuário expressou uma intenção. Evita distorções na tabela por partidas futuras. |
| `deriveWinner` recebe parâmetros primitivos (não Prediction+Match) | API mais genérica, reusável por TASK-03 (bracket) sem dependência de `MatchWithId`. `deriveWinnerFromPrediction` é a sobrecarga de conveniência. |
| `percentage` arredondado para 1 casa decimal | Alinhado com exibição na UI (ex.: "66.7%"); evita "66.666...7%" no label. |
| `byStage` é `Partial<Record<Stage, ProgressMetrics>>` | Não inclui stages sem partidas, evitando iteração desnecessária na UI. |
| Confronto direto calculado em tempo de sort | Evita pré-computação de uma matriz O(n²) de confrontos quando o critério só é necessário para pares empatados. |
| Sem export do `headToHead` (interno) | Encapsulamento; TASK-03 que precisar de confronto direto deve usar `computeGroupStandings` ou reimplementar se necessário. |

---

## 11. Critérios de aceitação

- [ ] `computeGroupStandings(GROUP_A_MATCHES, [])` retorna 4 entradas com position 1–4 e todos com 0 pontos.
- [ ] Time com 3 vitórias fica em 1º com 9 pontos; `played=3`, `wins=3`.
- [ ] Desempate por saldo de gols funciona corretamente (time com maior saldo sobe).
- [ ] Desempate por confronto direto funciona quando pontos/saldo/gols-pró são iguais.
- [ ] Desempate por `teamId ASC` é determinístico (chamadas repetidas retornam mesma ordem).
- [ ] Partidas sem palpite não adicionam pontos ao time.
- [ ] `rankBestThirds` com 12 grupos retorna exatamente 8 entradas.
- [ ] `rankBestThirds` ordena por pontos → saldo → gols pró → teamId.
- [ ] `rankBestThirds` com < 8 grupos retorna todos os terceiros disponíveis.
- [ ] `deriveWinner("bra","arg",2,0)` → `winnerId="bra"`, `isDraw=false`.
- [ ] `deriveWinner("bra","arg",1,1)` → `winnerId=null`, `isDraw=true`.
- [ ] `computeProgress([], [])` → `{ global:{filled:0,total:0,percentage:0}, byStage:{} }`.
- [ ] `computeProgress` separa por stage corretamente.
- [ ] `percentage` para 1/3 de partidas = `33.3`.
- [ ] `byStage` não inclui stages sem partidas.
- [ ] `index.ts` exporta todos os símbolos de `standings.ts` via barrel.
- [ ] `rtk tsc` sem erros TypeScript após implementação.
- [ ] Todos os testes do arquivo `standings.test.ts` passam (GREEN).
- [ ] Sem regressão nos testes existentes de `predictionsHelpers.test.ts`.
- [ ] Nenhum `any`, nenhum `Math.random()`, nenhum import de React ou Firebase.

---

## 12. O que esta tarefa NÃO faz

- Não implementa lógica de seeding da chave eliminatória (TASK-03, `bracket.ts`).
- Não cria componentes React (`PredictedStandings`, `BestThirdsRanking` — TASK-10/12).
- Não cria hooks (`useGroupPredictions`, `useProgress` — TASK-05).
- Não altera schemas Zod, Firestore rules ou Route Handlers.
- Não persiste a classificação prevista (A2: visual, não pontuada).
- Não lida com empate em eliminatória além de sinalizar `isDraw=true` — o tratamento de UX (exigir placar não-empatado) fica em TASK-13.
