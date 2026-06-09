# SPEC — TASK-03: Lib pura da chave derivada dos fixtures de mata-mata

> PRD: `ai/prd/palpites-massa.md` | Plano: `ai/plan/palpites-massa.md` | Branch: `feat/integracao-api-football`
> Tipo: domain | SP: 3 | Criticidade: high | Risco técnico: medium
> TDD recomendado: yes. Screen: no — n/a.
> Depende de: TASK-02 (`standings.ts`: `GroupStandingEntry`, `rankBestThirds`, `deriveWinner`), TASK-17 (`mapper.ts`: `MatchWithId` com `homeTeamId`/`awayTeamId` = placeholder literal quando TBD).

---

## 1. Objetivo

Implementar quatro funções puras (sem React, sem Firebase) que:

1. Constroem a estrutura de slots da chave eliminatória a partir dos fixtures de mata-mata reais do openfootball (Round of 32 → Final), preservando os placeholders de seeding (`"2A"`, `"1E"`, `"W74"`, `"L101"`, `"3ABC"`) como referência de slot.
2. Resolvem um placeholder para o `teamId` previsto a partir das classificações calculadas pelo usuário (TASK-02) e dos vencedores já definidos na chave.
3. Projetam a próxima fase a partir dos vencedores previstos (usando `deriveWinner` da TASK-02).
4. Detectam se um id é placeholder ou teamId real.

Decisão D-BRACKET (PRD §6.2.1): a estrutura da chave vem dos **fixtures de mata-mata do openfootball** (campo `num` 73–104, `homeTeamId`/`awayTeamId` = placeholder literal). TASK-03 parseia esses placeholders para projetar a chave a partir das previsões do usuário; o palpite pontuável é o placar exato por `matchId` (A1/A3).

Decisão D-OF4 (PRD §6.2.1): placeholders preservados em `homeTeamId`/`awayTeamId` do `MatchWithId` gerado pelo mapper da TASK-17. `buildBracketFromFixtures` consome `MatchWithId[]` filtrado para `stage !== "grupos"`.

---

## 2. Investigação: estado atual dos arquivos

### 2.1 TASK-17 mapper — como chega o MatchWithId de mata-mata

`src/server/copaData/mapper.ts` — `mapOpenFootballMatch`:

- Partidas com `num` (mata-mata) recebem `matchId = m{num}` (ex.: `"m73"`, `"m104"`).
- `team1`/`team2` do openfootball são passados por `resolveTeamId(name)`:
  - Se `name` bate em `/^(\d[A-Z]+|[WL]\d+)$/` → retorna o literal (ex.: `"2A"`, `"W74"`, `"3ABC"`).
  - Caso contrário → resolve via `teamRegistry` e retorna o código FIFA (ex.: `"BRA"`).
- Portanto, `MatchWithId.homeTeamId` e `MatchWithId.awayTeamId` em mata-mata são:
  - O código FIFA quando o time está definido (improvável antes da Copa).
  - O literal do placeholder quando ainda não está definido (caso normal pré-Copa).

Fixtures confirmados (de `openfootballFixtures.ts`):

```
{ round:"Round of 32",           num:73, team1:"2A",   team2:"2B"  }  → m73
{ round:"Round of 32",           num:75, team1:"1E",   team2:"3ABC" } → m75
{ round:"Round of 16",           num:89, team1:"W73",  team2:"W74" }  → m89
{ round:"Quarter-final",         num:97, team1:"W89",  team2:"W90" }  → m97
{ round:"Semi-final",            num:101,team1:"W97",  team2:"W98" }  → m101
{ round:"Match for third place", num:103,team1:"L101", team2:"L102"}  → m103
{ round:"Final",                 num:104,team1:"W101", team2:"W102"}  → m104
```

### 2.2 TASK-02 standings — tipos e funções disponíveis

`src/features/predictions/lib/standings.ts` — exporta:

- `GroupStandingEntry` — linha de tabela de classificação (`teamId`, `points`, `goalDifference`, `goalsFor`, `position: 1–4`, etc.)
- `GroupStandings = GroupStandingEntry[]`
- `AllGroupStandings = Record<string, GroupStandings>` — indexada por groupId (ex.: `"A"`)
- `rankBestThirds(allGroupStandings): GroupStandingEntry[]` — retorna os 8 melhores 3ºs ordenados
- `deriveWinner(homeTeamId, awayTeamId, homeScore, awayScore): WinnerResult`

### 2.3 Tipos existentes de `@/types`

`MatchWithId = Match & { id: string }` onde `Match = z.infer<typeof matchSchema>`.

Campos relevantes para mata-mata:
- `id: string` — `"m{num}"`
- `homeTeamId: string` — teamId real ou placeholder
- `awayTeamId: string` — teamId real ou placeholder
- `stage: Stage` — `"dezesseis-avos" | "oitavas" | "quartas" | "semifinal" | "terceiro" | "final"`
- `status: MatchStatus`

### 2.4 Arquivos novos a criar

| Arquivo | Ação |
|---|---|
| `src/features/predictions/lib/bracket.ts` | **Criar** — 4 funções + tipos |
| `src/features/predictions/lib/__tests__/bracket.test.ts` | **Criar** — suite TDD completa |
| `src/features/predictions/lib/index.ts` | **Modificar** — adicionar `export * from "./bracket"` |

### 2.5 Modelo de arquivo para estilo

`src/features/predictions/lib/standings.ts` — funções puras, JSDoc pt-BR, TypeScript strict, sem `any`, sem React, sem Firebase. Funções helper internas não exportadas.

---

## 3. Escopo

### 3.1 Dentro do escopo

| Arquivo | Ação |
|---|---|
| `src/features/predictions/lib/bracket.ts` | **Criar** — 4 funções + tipos exportados |
| `src/features/predictions/lib/__tests__/bracket.test.ts` | **Criar** — suite TDD completa |
| `src/features/predictions/lib/index.ts` | **Modificar** — adicionar barrel para `bracket` |

### 3.2 Fora do escopo

- Nenhum componente React, hook, serviço ou Route Handler.
- Nenhuma chamada ao Firestore ou Firebase.
- Não persiste picks de bracket — persistência é responsabilidade da TASK-05/13 via `predictions`.
- Não implementa lógica de UI de empate em eliminatória — sinalizar `isDraw=true` é suficiente (tratamento na TASK-13).
- Tabela de seeding FIFA hardcoded — a estrutura vem dos fixtures reais; apenas os placeholders `3XYZ` exigem lógica de mapeamento (ver §5.3 e §9).
- Não faz fetch de dados — recebe `MatchWithId[]` como parâmetro.

---

## 4. Tipos exportados

Todos os tipos abaixo são exportados de `bracket.ts` e reexportados pelo barrel `index.ts`.

```ts
import type { Stage } from "@/types";

/**
 * Origem de um slot na chave.
 * - "group-winner"   → 1º do grupo (ex.: placeholder "1A")
 * - "group-runner-up"→ 2º do grupo (ex.: placeholder "2B")
 * - "best-third"     → melhor 3º de um conjunto de grupos (ex.: placeholder "3ABC")
 * - "match-winner"   → vencedor do jogo num (ex.: placeholder "W74")
 * - "match-loser"    → perdedor do jogo num (ex.: placeholder "L101") — usado em terceiro lugar
 * - "resolved"       → teamId real já conhecido (sem ambiguidade)
 */
export type SlotOrigin =
  | "group-winner"
  | "group-runner-up"
  | "best-third"
  | "match-winner"
  | "match-loser"
  | "resolved";

/**
 * Slot de um time numa posição da chave.
 * Antes da resolução: teamId = placeholder literal ("2A", "W74", "3ABC").
 * Após resolução: teamId = código FIFA real ("BRA").
 */
export interface BracketSlot {
  /** Placeholder original do openfootball ou teamId real pós-resolução. */
  teamId: string;
  /** Como este slot foi preenchido/deriva. */
  origin: SlotOrigin;
  /**
   * Metadados de origem:
   * - Para "group-winner"/"group-runner-up": { groupId: "A" }
   * - Para "best-third": { candidateGroups: ["A","B","C"] }
   * - Para "match-winner"/"match-loser": { matchNum: 74 }
   * - Para "resolved": {}
   */
  meta: BracketSlotMeta;
}

export type BracketSlotMeta =
  | { groupId: string }
  | { candidateGroups: string[] }
  | { matchNum: number }
  | Record<string, never>;

/**
 * Confronto da chave: um jogo de mata-mata com seus dois slots e o matchId real.
 */
export interface BracketMatchup {
  /** matchId do fixture real (ex.: "m73"). Liga ao palpite pontuável. */
  matchId: string;
  /** Fase do torneio. */
  stage: Stage;
  /** Slot do time mandante (home). */
  home: BracketSlot;
  /** Slot do time visitante (away). */
  away: BracketSlot;
}

/**
 * Estrutura completa da chave, agrupada por fase.
 * Chaves do Record = Stage (ex.: "dezesseis-avos", "oitavas", ...).
 */
export type BracketStructure = Partial<Record<Stage, BracketMatchup[]>>;

/**
 * Resultado de vencedor/perdedor já resolvido numa rodada da chave.
 * Usado como entrada de advanceBracket.
 */
export interface RoundWinner {
  /** matchId do confronto (ex.: "m73"). */
  matchId: string;
  /** teamId real do vencedor (derivado de deriveWinner). null se empate. */
  winnerId: string | null;
  /** teamId real do perdedor (derivado de deriveWinner). null se empate. */
  loserId: string | null;
}
```

---

## 5. Especificação das funções

### 5.1 `isPlaceholderId`

```ts
/**
 * Retorna true se o id é um placeholder de seeding do openfootball,
 * false se é um teamId real (código FIFA, ex.: "BRA").
 *
 * Formatos de placeholder reconhecidos:
 * - "1A" … "1L"   → 1º do grupo (dígito 1 + letra maiúscula)
 * - "2A" … "2L"   → 2º do grupo (dígito 2 + letra maiúscula)
 * - "3ABC" etc.   → melhor 3º de grupos (dígito 3 + 2+ letras maiúsculas)
 * - "W73"…"W104"  → vencedor do jogo num
 * - "L101"…"L104" → perdedor do jogo num (disputa do 3º lugar)
 *
 * Resolve OQ-1 da TASK-17: detectar placeholder vs teamId real.
 *
 * @param id - String a testar.
 * @returns true se placeholder; false se teamId real.
 */
export function isPlaceholderId(id: string): boolean
```

**Algoritmo:**

```
regex: /^(\d[A-Z]+|[WL]\d+)$/
retornar regex.test(id)
```

**Exemplos:**

| id | resultado |
|---|---|
| `"2A"` | `true` |
| `"1E"` | `true` |
| `"3ABC"` | `true` |
| `"W74"` | `true` |
| `"L101"` | `true` |
| `"BRA"` | `false` |
| `"ARG"` | `false` |
| `"m73"` | `false` |
| `""` | `false` |

**Nota:** A regex é idêntica à usada em `resolveTeamId` do mapper da TASK-17 — reutilizar o mesmo padrão garante consistência.

---

### 5.2 `buildBracketFromFixtures`

```ts
/**
 * Constrói a estrutura de slots da chave eliminatória a partir dos fixtures reais.
 *
 * Consome MatchWithId[] filtrado para partidas de mata-mata (stage !== "grupos").
 * Para cada partida, cria um BracketMatchup com:
 * - matchId real (ex.: "m73")
 * - home e away slots com placeholder ou teamId resolvido
 *
 * Os placeholders ("2A", "1E", "W74", "L101", "3ABC") são preservados como
 * referência de slot — eles codificam o seeding FIFA e serão resolvidos por
 * resolveSlotTeam quando as classificações do usuário estiverem disponíveis.
 *
 * Não filtra internamente por stage — o chamador deve passar apenas fixtures
 * de mata-mata (stage !== "grupos"). Partidas de grupos são ignoradas se passadas
 * (homeTeamId/awayTeamId de grupos são teamIds reais, não placeholders, mas a
 * função não as rejeita explicitamente — apenas produz slots com origin "resolved").
 *
 * @param matches - Array de MatchWithId de mata-mata (stage !== "grupos").
 *                  Geralmente obtido de useMatches() filtrado pelo chamador.
 * @returns BracketStructure agrupada por stage, ordenada por matchId numérico dentro de cada fase.
 */
export function buildBracketFromFixtures(
  matches: MatchWithId[],
): BracketStructure
```

**Algoritmo:**

1. Para cada `match` em `matches`:
   a. Criar `home = parsePlaceholder(match.homeTeamId)` → `BracketSlot`.
   b. Criar `away = parsePlaceholder(match.awayTeamId)` → `BracketSlot`.
   c. Criar `BracketMatchup { matchId: match.id, stage: match.stage, home, away }`.
2. Agrupar por `match.stage` em `BracketStructure` (Partial Record).
3. Dentro de cada fase, ordenar os matchups por `matchNum` extraído do `matchId` (`"m73"` → `73`) crescente.
4. Retornar a estrutura.

**Função auxiliar interna `parsePlaceholder(raw: string): BracketSlot`:**

```
se isPlaceholderId(raw) === false:
  → retornar { teamId: raw, origin: "resolved", meta: {} }

se raw bate /^1([A-Z])$/:
  → { teamId: raw, origin: "group-winner", meta: { groupId: capture[1] } }

se raw bate /^2([A-Z])$/:
  → { teamId: raw, origin: "group-runner-up", meta: { groupId: capture[1] } }

se raw bate /^3([A-Z]{2,})$/:
  → { teamId: raw, origin: "best-third", meta: { candidateGroups: [...capture[1]] } }
  // "3ABC" → candidateGroups: ["A","B","C"]

se raw bate /^W(\d+)$/:
  → { teamId: raw, origin: "match-winner", meta: { matchNum: Number(capture[1]) } }

se raw bate /^L(\d+)$/:
  → { teamId: raw, origin: "match-loser", meta: { matchNum: Number(capture[1]) } }

// Fallback (não deve ocorrer se isPlaceholderId for consistente):
→ { teamId: raw, origin: "resolved", meta: {} }
```

**Invariantes:**
- Retorna sempre um `BracketStructure` (pode ser `{}` se `matches` for vazio).
- Não lança exceções — placeholders desconhecidos caem no fallback "resolved".
- Puro: mesmo input → mesmo output.
- Ordena matchups por `matchNum` crescente dentro de cada fase.

---

### 5.3 `resolveSlotTeam`

```ts
/**
 * Resolve um placeholder de slot para o teamId previsto pelo usuário.
 *
 * Usa as classificações calculadas pelo usuário (TASK-02) e os vencedores
 * já decididos na chave (bracketResults) para substituir o placeholder
 * pelo teamId real previsto.
 *
 * Se o placeholder não puder ser resolvido (ex.: grupo ainda incompleto,
 * confronto predecesssor ainda sem vencedor), retorna null — a UI exibe
 * o placeholder como rótulo humano ("2º do Grupo A").
 *
 * Decisão A6 do PRD: fases futuras bloqueadas até completar a anterior.
 * Esta função é permissiva — retorna null quando não tem dados suficientes,
 * sem lançar erro.
 *
 * @param placeholder     - Placeholder literal (ex.: "2A", "W74", "3ABC").
 *                          Se não for um placeholder (isPlaceholderId = false),
 *                          retorna o próprio id como está (já resolvido).
 * @param standings       - Classificações previstas de todos os grupos
 *                          (AllGroupStandings da TASK-02, indexado por groupId "A"…"L").
 * @param bestThirds      - Os 8 melhores terceiros ordenados (saída de rankBestThirds).
 *                          Necessário para resolver placeholders "3XYZ".
 * @param bracketResults  - Map de matchId → RoundWinner para confrontos já resolvidos
 *                          (vencedores/perdedores previstos pelo usuário via deriveWinner).
 * @returns teamId real previsto (ex.: "BRA"), ou null se não resolvível ainda.
 */
export function resolveSlotTeam(
  placeholder: string,
  standings: AllGroupStandings,
  bestThirds: GroupStandingEntry[],
  bracketResults: Map<string, RoundWinner>,
): string | null
```

**Algoritmo:**

```
se isPlaceholderId(placeholder) === false:
  → retornar placeholder  // já é teamId real

se placeholder bate /^1([A-Z])$/ (groupId = capture[1]):
  standings = standings[groupId]
  entry = standings?.find(e => e.position === 1)
  → retornar entry?.teamId ?? null

se placeholder bate /^2([A-Z])$/ (groupId = capture[1]):
  standings = standings[groupId]
  entry = standings?.find(e => e.position === 2)
  → retornar entry?.teamId ?? null

se placeholder bate /^3([A-Z]{2,})$/ (candidateLetters = capture[1]):
  // "3ABC" → o 3º que classificar ENTRE os grupos A, B e C
  // bestThirds já está ordenado (melhor → pior) por rankBestThirds
  // Encontrar o primeiro bestThird cujo teamId está na classificação de
  // um dos grupos candidatos
  candidateGroupIds = Set([...candidateLetters]) // ex.: {"A","B","C"}
  para cada third em bestThirds:
    groupId_of_third = encontrar em standings qual groupId contém third.teamId
      (iterar standings: standings[gId].some(e => e.teamId === third.teamId && e.position === 3))
    se groupId_of_third está em candidateGroupIds:
      → retornar third.teamId
  → retornar null  // nenhum 3º dos grupos candidatos classificou

se placeholder bate /^W(\d+)$/ (matchNum = Number(capture[1])):
  result = bracketResults.get("m" + matchNum)
  → retornar result?.winnerId ?? null

se placeholder bate /^L(\d+)$/ (matchNum = Number(capture[1])):
  result = bracketResults.get("m" + matchNum)
  → retornar result?.loserId ?? null

→ retornar null  // placeholder não reconhecido
```

**Nota sobre `3XYZ` (ver §9 — open question OQ-THIRD):**

O openfootball codifica o placeholder `"3ABC"` listando os grupos candidatos. A regra FIFA completa de qual 3º ocupa qual slot do Round of 32 depende de uma matriz combinatória (quais 8 dos 12 grupos terceiros se classificam, e qual slot cada um ocupa). A implementação acima usa uma **aproximação documentada**: o melhor 3º presente entre os grupos candidatos recebe o slot. Isso é correto para o uso visual (projeção da chave) e está flagged em OQ-THIRD (§9).

---

### 5.4 `advanceBracket`

```ts
/**
 * Projeta a próxima fase da chave a partir dos vencedores previstos de uma rodada.
 *
 * Dado um array de BracketMatchup de uma fase e os vencedores/perdedores previstos
 * (via deriveWinner), retorna um Map de placeholder → teamId resolvido para montar
 * os slots da fase seguinte.
 *
 * Usado pela UI para exibir a chave projetada enquanto o fixture real ainda não
 * tem os times definidos (A6 do PRD). Não persiste nada — é uma projeção em memória.
 *
 * @param round   - Os confrontos da fase atual (ex.: todos os dezesseis-avos).
 * @param winners - Vencedores/perdedores de cada confronto (Map matchId → RoundWinner).
 *                  Obtido via deriveWinner(homeTeamId, awayTeamId, homeScore, awayScore)
 *                  para cada confronto onde o usuário preencheu o placar.
 * @returns Map<string, string> de placeholder → teamId resolvido.
 *          Ex.: { "W73": "BRA", "W74": "ARG", "L73": ... }
 *          Confrontos sem vencedor (isDraw ou sem palpite) não aparecem no Map.
 */
export function advanceBracket(
  round: BracketMatchup[],
  winners: Map<string, RoundWinner>,
): Map<string, string>
```

**Algoritmo:**

```
result = new Map<string, string>()

para cada matchup em round:
  winner = winners.get(matchup.matchId)
  se winner === undefined: continuar (sem palpite)

  matchNum = extrair número de matchup.matchId (ex.: "m73" → 73)

  se winner.winnerId !== null:
    result.set("W" + matchNum, winner.winnerId)   // ex.: "W73" → "BRA"

  se winner.loserId !== null:
    result.set("L" + matchNum, winner.loserId)    // ex.: "L73" → "ARG"

retornar result
```

**Invariantes:**
- Confrontos com `isDraw = true` (empate) → `winnerId = null` → `"W{num}"` não entra no Map. A UI deve sinalizar esse estado (slot ainda indeterminado).
- Puro: sem side effects, sem mutação dos parâmetros.
- Retorna Map vazio se `winners` for vazio ou nenhum confronto tiver vencedor.

---

## 6. Implementação: `bracket.ts`

### 6.1 Estrutura do arquivo

```ts
/**
 * Lib pura da chave eliminatória derivada dos fixtures de mata-mata (TASK-03).
 * Sem React, sem Firebase — testável em isolamento.
 *
 * Consome MatchWithId[] com placeholders openfootball preservados em
 * homeTeamId/awayTeamId (D-OF4 do PRD) e ClassificaçõesPrevistas (TASK-02)
 * para projetar a chave a partir das previsões do usuário.
 *
 * Consumida pelas telas PRD03-07…12 (bracket interativo) e PRD03-06 (TASK-12: CTA gerar chave).
 */

import type { MatchWithId, Stage } from "@/types";
import type {
  AllGroupStandings,
  GroupStandingEntry,
} from "./standings";

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

export type SlotOrigin = ...
export interface BracketSlot { ... }
export type BracketSlotMeta = ...
export interface BracketMatchup { ... }
export type BracketStructure = Partial<Record<Stage, BracketMatchup[]>>;
export interface RoundWinner { ... }

// ---------------------------------------------------------------------------
// Helpers internos (não exportados)
// ---------------------------------------------------------------------------

/** Extrai número do matchId "m{num}" → number. Retorna NaN se não bater. */
function extractMatchNum(matchId: string): number { ... }

/** Parseia um team string do openfootball em BracketSlot. */
function parsePlaceholder(raw: string): BracketSlot { ... }

// ---------------------------------------------------------------------------
// Funções exportadas
// ---------------------------------------------------------------------------

export function isPlaceholderId(id: string): boolean { ... }
export function buildBracketFromFixtures(matches: MatchWithId[]): BracketStructure { ... }
export function resolveSlotTeam(
  placeholder: string,
  standings: AllGroupStandings,
  bestThirds: GroupStandingEntry[],
  bracketResults: Map<string, RoundWinner>,
): string | null { ... }
export function advanceBracket(
  round: BracketMatchup[],
  winners: Map<string, RoundWinner>,
): Map<string, string> { ... }
```

### 6.2 Imports

```ts
import type { MatchWithId, Stage } from "@/types";
import type { AllGroupStandings, GroupStandingEntry } from "./standings";
```

Sem outros imports externos. Sem `date-fns`, sem Firebase, sem React.

### 6.3 Atualização do barrel `index.ts`

```ts
export * from "./predictionsHelpers";
export * from "./predictionLabels";
export * from "./standings"; // TASK-02: classificação, terceiros, progresso
export * from "./bracket";   // TASK-03: chave derivada dos fixtures de mata-mata
```

---

## 7. Testes TDD (RED → GREEN)

Arquivo: `src/features/predictions/lib/__tests__/bracket.test.ts`

### 7.1 Imports e helpers de fixture

```ts
import { describe, expect, it } from "vitest";
import type { MatchWithId } from "@/types";
import type { AllGroupStandings, GroupStandingEntry } from "@/features/predictions/lib/standings";
import {
  isPlaceholderId,
  buildBracketFromFixtures,
  resolveSlotTeam,
  advanceBracket,
} from "@/features/predictions/lib/bracket";
import type { BracketMatchup, RoundWinner } from "@/features/predictions/lib/bracket";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Cria MatchWithId de mata-mata com placeholders */
function makeKnockoutMatch(
  num: number,
  team1: string,
  team2: string,
  stage: "dezesseis-avos" | "oitavas" | "quartas" | "semifinal" | "terceiro" | "final",
): MatchWithId {
  return {
    id: `m${num}`,
    homeTeamId: team1,
    awayTeamId: team2,
    kickoffAt: "2026-06-28T18:00:00+00:00",
    stage,
    round: null,
    groupId: null,
    venue: null,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
  };
}

/** Cria GroupStandings mínima para um grupo de 4 times */
function makeGroupStandings(
  groupId: string,
  teamIds: [string, string, string, string], // posições 1..4
): GroupStandingEntry[] {
  return teamIds.map((teamId, i) => ({
    teamId,
    played: 3,
    wins: 3 - i,
    draws: 0,
    losses: i,
    goalsFor: 6 - i * 2,
    goalsAgainst: i * 2,
    goalDifference: 6 - i * 4,
    points: (3 - i) * 3,
    position: i + 1,
  }));
}

/** Cria AllGroupStandings para N grupos */
function makeAllGroupStandings(
  groups: Record<string, [string, string, string, string]>,
): AllGroupStandings {
  const result: AllGroupStandings = {};
  for (const [groupId, teams] of Object.entries(groups)) {
    result[groupId] = makeGroupStandings(groupId, teams);
  }
  return result;
}

// ─── Fixtures de mata-mata (espelhando openfootball real) ────────────────────

const ROUND32_MATCHES: MatchWithId[] = [
  makeKnockoutMatch(73,  "2A",  "2B",  "dezesseis-avos"),
  makeKnockoutMatch(74,  "1C",  "3DEF","dezesseis-avos"),
  makeKnockoutMatch(75,  "1E",  "3ABC","dezesseis-avos"),
  makeKnockoutMatch(76,  "1D",  "2E",  "dezesseis-avos"),
];

const ROUND16_MATCHES: MatchWithId[] = [
  makeKnockoutMatch(89, "W73", "W74", "oitavas"),
  makeKnockoutMatch(90, "W75", "W76", "oitavas"),
];

const QF_MATCHES: MatchWithId[] = [
  makeKnockoutMatch(97, "W89", "W90", "quartas"),
];

const SF_MATCHES: MatchWithId[] = [
  makeKnockoutMatch(101, "W97", "W98", "semifinal"),
];

const THIRD_MATCH: MatchWithId[] = [
  makeKnockoutMatch(103, "L101", "L102", "terceiro"),
];

const FINAL_MATCH: MatchWithId[] = [
  makeKnockoutMatch(104, "W101", "W102", "final"),
];

const ALL_KNOCKOUT_MATCHES: MatchWithId[] = [
  ...ROUND32_MATCHES,
  ...ROUND16_MATCHES,
  ...QF_MATCHES,
  ...SF_MATCHES,
  ...THIRD_MATCH,
  ...FINAL_MATCH,
];
```

### 7.2 Suíte `isPlaceholderId`

```ts
describe("isPlaceholderId", () => {
  it.each([
    ["2A",   true],
    ["1E",   true],
    ["1L",   true],
    ["3ABC", true],
    ["3ABCD",true],
    ["W73",  true],
    ["W104", true],
    ["L101", true],
    ["L102", true],
  ])("placeholder '%s' → true", (id, expected) => {
    expect(isPlaceholderId(id)).toBe(expected);
  });

  it.each([
    ["BRA",  false],
    ["ARG",  false],
    ["m73",  false],
    ["",     false],
    ["1",    false],
    ["A",    false],
    ["w73",  false],  // lowercase w
    ["l101", false],  // lowercase l
  ])("teamId '%s' → false", (id, expected) => {
    expect(isPlaceholderId(id)).toBe(expected);
  });
});
```

### 7.3 Suíte `buildBracketFromFixtures`

```ts
describe("buildBracketFromFixtures", () => {
  it("array vazio → estrutura vazia {}", () => {
    const result = buildBracketFromFixtures([]);
    expect(result).toEqual({});
  });

  it("agrupa matchups pela fase correta", () => {
    const result = buildBracketFromFixtures(ALL_KNOCKOUT_MATCHES);
    expect(result["dezesseis-avos"]).toHaveLength(4);
    expect(result["oitavas"]).toHaveLength(2);
    expect(result["quartas"]).toHaveLength(1);
    expect(result["semifinal"]).toHaveLength(1);
    expect(result["terceiro"]).toHaveLength(1);
    expect(result["final"]).toHaveLength(1);
  });

  it("matchId é preservado corretamente", () => {
    const result = buildBracketFromFixtures(ROUND32_MATCHES);
    const matchIds = result["dezesseis-avos"]!.map((m) => m.matchId);
    expect(matchIds).toContain("m73");
    expect(matchIds).toContain("m75");
  });

  it("ordena por matchNum crescente dentro de cada fase", () => {
    // Passar na ordem invertida para testar a ordenação
    const reversed = [...ROUND32_MATCHES].reverse();
    const result = buildBracketFromFixtures(reversed);
    const matchNums = result["dezesseis-avos"]!.map((m) =>
      parseInt(m.matchId.slice(1), 10),
    );
    expect(matchNums).toEqual([...matchNums].sort((a, b) => a - b));
  });

  it("placeholder '2A' → home slot com origin 'group-runner-up', groupId 'A'", () => {
    const result = buildBracketFromFixtures(ROUND32_MATCHES);
    const m73 = result["dezesseis-avos"]!.find((m) => m.matchId === "m73")!;
    expect(m73.home.origin).toBe("group-runner-up");
    expect(m73.home.teamId).toBe("2A");
    expect((m73.home.meta as { groupId: string }).groupId).toBe("A");
  });

  it("placeholder '3ABC' → slot com origin 'best-third', candidateGroups ['A','B','C']", () => {
    const result = buildBracketFromFixtures(ROUND32_MATCHES);
    const m75 = result["dezesseis-avos"]!.find((m) => m.matchId === "m75")!;
    expect(m75.away.origin).toBe("best-third");
    expect(m75.away.teamId).toBe("3ABC");
    const meta = m75.away.meta as { candidateGroups: string[] };
    expect(meta.candidateGroups).toEqual(["A","B","C"]);
  });

  it("placeholder 'W73' → slot com origin 'match-winner', matchNum 73", () => {
    const result = buildBracketFromFixtures(ROUND16_MATCHES);
    const m89 = result["oitavas"]!.find((m) => m.matchId === "m89")!;
    expect(m89.home.origin).toBe("match-winner");
    expect((m89.home.meta as { matchNum: number }).matchNum).toBe(73);
  });

  it("placeholder 'L101' → slot com origin 'match-loser', matchNum 101", () => {
    const result = buildBracketFromFixtures(THIRD_MATCH);
    const m103 = result["terceiro"]![0]!;
    expect(m103.home.origin).toBe("match-loser");
    expect((m103.home.meta as { matchNum: number }).matchNum).toBe(101);
  });

  it("placeholder '1E' → slot com origin 'group-winner', groupId 'E'", () => {
    const result = buildBracketFromFixtures(ROUND32_MATCHES);
    const m75 = result["dezesseis-avos"]!.find((m) => m.matchId === "m75")!;
    expect(m75.home.origin).toBe("group-winner");
    expect((m75.home.meta as { groupId: string }).groupId).toBe("E");
  });

  it("teamId real → slot com origin 'resolved'", () => {
    const matchWithRealTeam = makeKnockoutMatch(73, "BRA", "ARG", "dezesseis-avos");
    const result = buildBracketFromFixtures([matchWithRealTeam]);
    const m73 = result["dezesseis-avos"]![0]!;
    expect(m73.home.origin).toBe("resolved");
    expect(m73.home.teamId).toBe("BRA");
    expect(m73.away.origin).toBe("resolved");
  });

  it("idempotência: mesmo input → mesmo output", () => {
    const r1 = buildBracketFromFixtures(ALL_KNOCKOUT_MATCHES);
    const r2 = buildBracketFromFixtures(ALL_KNOCKOUT_MATCHES);
    expect(r1).toEqual(r2);
  });
});
```

### 7.4 Suíte `resolveSlotTeam`

```ts
describe("resolveSlotTeam", () => {
  const standings = makeAllGroupStandings({
    A: ["BRA","ARG","BOL","CHI"],
    B: ["MEX","USA","CAN","JAM"],
    C: ["FRA","ENG","ESP","POR"],
    D: ["GER","ITA","NED","BEL"],
    E: ["URU","COL","PAR","ECU"],
  });

  // bestThirds simulados: 3ºs de A, B, C (BOL, CAN, ESP, ...apenas 3 grupos)
  const bestThirds: GroupStandingEntry[] = [
    standings["A"]!.find((e) => e.position === 3)!,  // BOL
    standings["B"]!.find((e) => e.position === 3)!,  // CAN
    standings["C"]!.find((e) => e.position === 3)!,  // ESP
  ];

  const noResults = new Map<string, RoundWinner>();

  it("id já resolvido (teamId real) → retorna o próprio id", () => {
    expect(resolveSlotTeam("BRA", standings, bestThirds, noResults)).toBe("BRA");
  });

  it("'1A' → 1º do grupo A (BRA)", () => {
    expect(resolveSlotTeam("1A", standings, bestThirds, noResults)).toBe("BRA");
  });

  it("'2A' → 2º do grupo A (ARG)", () => {
    expect(resolveSlotTeam("2A", standings, bestThirds, noResults)).toBe("ARG");
  });

  it("'2B' → 2º do grupo B (USA)", () => {
    expect(resolveSlotTeam("2B", standings, bestThirds, noResults)).toBe("USA");
  });

  it("'1E' → 1º do grupo E (URU)", () => {
    expect(resolveSlotTeam("1E", standings, bestThirds, noResults)).toBe("URU");
  });

  it("grupo inexistente → null", () => {
    expect(resolveSlotTeam("1Z", standings, bestThirds, noResults)).toBeNull();
  });

  it("'3ABC' → melhor 3º entre grupos A, B, C (BOL, primeiro na lista bestThirds)", () => {
    // bestThirds[0] = BOL (grupo A) — BOL está em candidateGroups {A,B,C}
    const result = resolveSlotTeam("3ABC", standings, bestThirds, noResults);
    expect(result).toBe("BOL");
  });

  it("'3ABC' → null quando nenhum 3º de A/B/C está em bestThirds", () => {
    // bestThirds contendo apenas 3ºs de grupos D, E (não A/B/C)
    const otherThirds: GroupStandingEntry[] = [
      standings["D"]!.find((e) => e.position === 3)!, // NED
      standings["E"]!.find((e) => e.position === 3)!, // PAR
    ];
    const result = resolveSlotTeam("3ABC", standings, otherThirds, noResults);
    expect(result).toBeNull();
  });

  it("'W73' → vencedor do jogo m73 de bracketResults", () => {
    const results = new Map<string, RoundWinner>([
      ["m73", { matchId: "m73", winnerId: "BRA", loserId: "ARG" }],
    ]);
    expect(resolveSlotTeam("W73", standings, bestThirds, results)).toBe("BRA");
  });

  it("'L73' → perdedor do jogo m73 de bracketResults", () => {
    const results = new Map<string, RoundWinner>([
      ["m73", { matchId: "m73", winnerId: "BRA", loserId: "ARG" }],
    ]);
    expect(resolveSlotTeam("L73", standings, bestThirds, results)).toBe("ARG");
  });

  it("'W73' sem jogo m73 em bracketResults → null", () => {
    expect(resolveSlotTeam("W73", standings, bestThirds, noResults)).toBeNull();
  });

  it("'W73' com isDraw (winnerId null) → null", () => {
    const results = new Map<string, RoundWinner>([
      ["m73", { matchId: "m73", winnerId: null, loserId: null }],
    ]);
    expect(resolveSlotTeam("W73", standings, bestThirds, results)).toBeNull();
  });

  it("'L101' → perdedor de semifinal m101", () => {
    const results = new Map<string, RoundWinner>([
      ["m101", { matchId: "m101", winnerId: "FRA", loserId: "GER" }],
    ]);
    expect(resolveSlotTeam("L101", standings, bestThirds, results)).toBe("GER");
  });

  it("placeholder '3DEF' → melhor 3º entre grupos D, E, F", () => {
    const standingsDEF = makeAllGroupStandings({
      D: ["GER","ITA","NED","BEL"],
      E: ["URU","COL","PAR","ECU"],
      F: ["JPN","KOR","AUS","NZL"],
    });
    const thirdsAll: GroupStandingEntry[] = [
      standingsDEF["D"]!.find((e) => e.position === 3)!, // NED
      standingsDEF["E"]!.find((e) => e.position === 3)!, // PAR
      standingsDEF["F"]!.find((e) => e.position === 3)!, // AUS
    ];
    const result = resolveSlotTeam("3DEF", standingsDEF, thirdsAll, noResults);
    // Primeiro da lista (melhor 3º) que pertence a D, E ou F
    expect(result).toBe("NED");
  });
});
```

### 7.5 Suíte `advanceBracket`

```ts
describe("advanceBracket", () => {
  // Bracket de dezesseis-avos: m73(2A vs 2B) e m74(1C vs 3DEF)
  const round: BracketMatchup[] = [
    {
      matchId: "m73",
      stage: "dezesseis-avos",
      home: { teamId: "BRA", origin: "resolved", meta: {} },
      away: { teamId: "ARG", origin: "resolved", meta: {} },
    },
    {
      matchId: "m74",
      stage: "dezesseis-avos",
      home: { teamId: "FRA", origin: "resolved", meta: {} },
      away: { teamId: "GER", origin: "resolved", meta: {} },
    },
  ];

  it("vencedores resolvidos → Map com 'W{num}' e 'L{num}'", () => {
    const winners = new Map<string, RoundWinner>([
      ["m73", { matchId: "m73", winnerId: "BRA", loserId: "ARG" }],
      ["m74", { matchId: "m74", winnerId: "GER", loserId: "FRA" }],
    ]);
    const result = advanceBracket(round, winners);
    expect(result.get("W73")).toBe("BRA");
    expect(result.get("L73")).toBe("ARG");
    expect(result.get("W74")).toBe("GER");
    expect(result.get("L74")).toBe("FRA");
    expect(result.size).toBe(4);
  });

  it("confronto com isDraw (winnerId null) → 'W{num}'/'L{num}' NÃO entram no Map", () => {
    const winners = new Map<string, RoundWinner>([
      ["m73", { matchId: "m73", winnerId: null, loserId: null }],
    ]);
    const result = advanceBracket(round, winners);
    expect(result.has("W73")).toBe(false);
    expect(result.has("L73")).toBe(false);
    expect(result.size).toBe(0);
  });

  it("confronto sem palpite (não está em winners) → não entra no Map", () => {
    const result = advanceBracket(round, new Map());
    expect(result.size).toBe(0);
  });

  it("apenas m73 resolvido → apenas W73/L73 no Map (m74 ausente)", () => {
    const winners = new Map<string, RoundWinner>([
      ["m73", { matchId: "m73", winnerId: "BRA", loserId: "ARG" }],
    ]);
    const result = advanceBracket(round, winners);
    expect(result.get("W73")).toBe("BRA");
    expect(result.get("L73")).toBe("ARG");
    expect(result.has("W74")).toBe(false);
    expect(result.size).toBe(2);
  });

  it("round vazio → Map vazio", () => {
    const result = advanceBracket([], new Map());
    expect(result.size).toBe(0);
  });

  it("idempotência: mesmo input → mesmo output", () => {
    const winners = new Map<string, RoundWinner>([
      ["m73", { matchId: "m73", winnerId: "BRA", loserId: "ARG" }],
    ]);
    const r1 = advanceBracket(round, winners);
    const r2 = advanceBracket(round, winners);
    expect([...r1.entries()]).toEqual([...r2.entries()]);
  });

  it("jogo m103 (terceiro) com L101/L102 → resolve perdedores de semifinal", () => {
    // advanceBracket do round de semifinal gera L101/L102
    const sfRound: BracketMatchup[] = [
      {
        matchId: "m101",
        stage: "semifinal",
        home: { teamId: "BRA", origin: "resolved", meta: {} },
        away: { teamId: "FRA", origin: "resolved", meta: {} },
      },
      {
        matchId: "m102",
        stage: "semifinal",
        home: { teamId: "GER", origin: "resolved", meta: {} },
        away: { teamId: "ARG", origin: "resolved", meta: {} },
      },
    ];
    const sfWinners = new Map<string, RoundWinner>([
      ["m101", { matchId: "m101", winnerId: "BRA", loserId: "FRA" }],
      ["m102", { matchId: "m102", winnerId: "ARG", loserId: "GER" }],
    ]);
    const result = advanceBracket(sfRound, sfWinners);
    expect(result.get("W101")).toBe("BRA");
    expect(result.get("L101")).toBe("FRA");
    expect(result.get("W102")).toBe("ARG");
    expect(result.get("L102")).toBe("GER");
  });
});
```

---

## 8. Contrato de imports e convenções

```ts
// bracket.ts — imports permitidos
import type { MatchWithId, Stage } from "@/types";
import type { AllGroupStandings, GroupStandingEntry } from "./standings";

// Proibido:
// import React from "react";
// import { db } from "@/firebase";
// import { ... } from "firebase/firestore";
// any
// style={{ ... }}
// Math.random()
```

- Todas as funções exportadas têm JSDoc em pt-BR (conforme padrão de `standings.ts`).
- Funções helper internas (`parsePlaceholder`, `extractMatchNum`) NÃO são exportadas.
- Sem `Math.random()` — funções são puras e determinísticas.
- Sem mutação de parâmetros.

---

## 9. Arquivos afetados (resumo)

| Arquivo | Ação | Criticidade |
|---|---|---|
| `src/features/predictions/lib/bracket.ts` | **Criar** — 4 funções + tipos | Alta |
| `src/features/predictions/lib/__tests__/bracket.test.ts` | **Criar** — suite TDD completa | Alta |
| `src/features/predictions/lib/index.ts` | **Modificar** — adicionar `export * from "./bracket"` | Média |

---

## 10. Decisões e rationale

| Decisão | Rationale |
|---|---|
| `isPlaceholderId` usa mesma regex do mapper TASK-17 (`/^(\d[A-Z]+\|[WL]\d+)$/`) | Consistência: se o mapper reconhece o placeholder, esta lib também reconhece. Evitar divergência silenciosa. |
| `buildBracketFromFixtures` não filtra internamente por stage | Single responsibility: o chamador filtra. Facilita testes com subconjuntos; evita acoplamento com a definição de "o que é grupo". |
| Placeholders preservados em `BracketSlot.teamId` (não substituídos) | Permite a UI exibir rótulo humano ("2º do Grupo A") sem perder a referência ao placeholder original. `resolveSlotTeam` faz a substituição sob demanda. |
| `resolveSlotTeam` retorna `null` em vez de lançar erro | Filosofia permissiva: dados incompletos são esperados (fase anterior não concluída). A UI exibe estado "indeterminado" graciosamente. |
| `3XYZ` resolvido por primeiro `bestThird` cujo time está no grupo candidato | Aproximação documentada (OQ-THIRD). Suficiente para projeção visual; a regra FIFA completa (matriz combinatória de 8 de 12 grupos) não tem impacto em pontuação (A2: classificação visual). |
| `advanceBracket` retorna `Map<string, string>` (não modifica BracketStructure) | Imutabilidade: evita mutação dos slots existentes. Chamador decide se e como aplicar o Map aos slots da fase seguinte. |
| Ordenação por `matchNum` crescente dentro de cada fase | Apresentação visual consistente (m73 antes de m74 antes de m75…). |
| `RoundWinner` com `loserId` separado de `winnerId` | Necessário para disputa do 3º lugar (L101/L102 são os perdedores das semis). Reutiliza a estrutura de `advanceBracket` sem caso especial. |

---

## 11. Open Questions

| # | Questão | Impacto | Proposta |
|---|---|---|---|
| **OQ-THIRD** | A regra FIFA completa de qual 3º ocupa qual slot do Round of 32 é combinatória: depende de quais 8 dos 12 grupos produziram os melhores terceiros (ex.: se A/B/C/D/E/F/G/H classificam seus terceiros, a tabela FIFA pré-determinada diz qual vai para m75 vs m76 etc.). A implementação atual usa aproximação: primeiro `bestThird` cujo grupo está entre os candidatos do placeholder. | Baixo para projeção visual (A2: classificação não pontuada). Médio se a UI quiser mostrar o slot correto antes de todos os 12 grupos estarem completos. | Implementar a aproximação e documentar. Criar uma constante `BEST_THIRD_ASSIGNMENT_MATRIX` (Record de combinação de grupos classificados → slot por placeholder) em iteração futura se necessário. |
| **OQ-STAGE-FILTER** | Deve `buildBracketFromFixtures` filtrar internamente `stage !== "grupos"` ou delegar ao chamador? | Baixo — preferência de design. | Delegar ao chamador (mais flexível). Documentar na JSDoc. |
| **OQ-LOSER-NULL** | `advanceBracket` coloca `L{num}` no Map apenas se `loserId !== null`. Se houver empate (isDraw), `loserId` é null. Mas a disputa do 3º lugar usa `L101`/`L102` — se ambas as semis empatam, o 3º lugar não tem times. A UI deve tratar este caso? | Baixo (empate em semi é estado inválido que a UI já deve prevenir — ver TASK-13). | Deixar como null, UI previne empate via validação de placar. |
