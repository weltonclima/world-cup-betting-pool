# SPEC

## 1. Task: TASK-02 – Helpers puros de ranking

## 2. Objective

Funções **puras e determinísticas** (sem I/O, sem Firestore, sem React) que centralizam a lógica de ranking: ordenação+desempate, aproveitamento, indicador de evolução e distribuição de pontuação. Servem ao backend (recalc TASK-03) e às telas (TASK-08..13). Correção testável em isolamento.

## 3. In scope

1. `compareRanking(a, b)` + `rankParticipants(list)` — ordena e atribui posições por desempate.
2. `computeAccuracy(points, finishedEligible)` — aproveitamento 0–100.
3. `evolutionIndicator(previousPosition, currentPosition)` — `up|same|down` + delta.
4. `buildDistribution(pointsList, maxPoints?)` — `DistributionBucket[]` por faixas fixas.
5. Barrel `src/features/rankings/lib/index.ts` + testes co-locados.

## 4. Out of scope

- Leitura/gravação Firestore (TASK-03/04), hooks (TASK-05), UI (TASK-07+).
- Cálculo de `points`/`wrong` por palpite (já é PRD-04 / `scorePrediction`). Aqui só agregamos valores já calculados.
- Definição de "elegível ao escopo" em si (quais partidas) — o caller (TASK-03) passa os números prontos; aqui só a fórmula.

## 5. Main technical areas

`src/features/rankings/lib/rankingSort.ts`, `accuracy.ts`, `evolution.ts`, `distribution.ts`, `index.ts` + `__tests__/`. Tipos de `@/types` (`RankingEntry`, `DistributionBucket`).

## 6. Business rules and behavior

### 6.1 Ordenação + desempate (PRD-05 "Critérios de Desempate")
Ordem do PRD: maior pontuação → mais acertos exatos → maior aproveitamento → menos erros → data do 1º palpite → (fallback) uid.
**Sob binário `points === acertos exatos`**, logo o 2º critério é redundante com o 1º. Cadeia efetiva:
1. `points` DESC
2. `accuracy` DESC
3. `wrong` ASC
4. `firstPredictionAt` ASC (mais antigo primeiro; ISO comparável lexicograficamente)
5. `uid` ASC (`localeCompare`) — fallback estável total (garante determinismo)

`firstPredictionAt` ausente (sem palpites) ordena **depois** de quem tem data (trata como "infinito"). Empate total impossível (uid é único) → ordem total determinística.

### 6.2 Posições
Após ordenar, atribuir `position = índice + 1` (1-indexed sequencial). Como a cadeia é ordem total, não há posições repetidas (consistente com as telas #1,#2,#3…).

### 6.3 Aproveitamento
`computeAccuracy(points, finishedEligible)`:
- `finishedEligible <= 0` → retorna `0`.
- Senão `round((points / finishedEligible) * 100)` arredondado ao inteiro mais próximo, **clamp 0–100** (defensivo; `points` nunca > finalizadas no fluxo correto).
- Retorna número compatível com `percentageSchema` (0–100).

### 6.4 Indicador de evolução
`evolutionIndicator(previousPosition, currentPosition)` (posição menor = melhor):
- `previousPosition` `undefined`/`null` (primeira rodada) → `{ direction: "same", delta: 0 }`.
- `currentPosition < previousPosition` → `{ direction: "up", delta: previous - current }` (subiu).
- `currentPosition > previousPosition` → `{ direction: "down", delta: current - previous }` (caiu).
- igual → `{ direction: "same", delta: 0 }` (manteve).
`delta` sempre ≥ 0.

### 6.5 Distribuição de pontuação
`buildDistribution(pointsList, maxPoints?)`:
- Faixas fixas (inclusivas): `0–39`, `40–59`, `60–79`, `80–89`, `90–maxTop`.
- `maxTop = max(100, maxPoints ?? 100)` — cobre WC2026 (104 partidas ⇒ pontos podem passar de 100). Label do topo: `"90-100 pts"` se `maxTop === 100`, senão `"90+ pts"`.
- Cada bucket: `{ label, min, max, count }` (formato `DistributionBucketSchema`, `min ≤ max`).
- `count` = nº de valores em `pointsList` dentro de `[min, max]`. Valores negativos não ocorrem (defensivo: ignorar/contam em nenhum bucket).
- `pointsList` vazio → todos os buckets com `count: 0` (5 buckets sempre presentes).

## 7. Contracts and interfaces

```ts
// Entrada de ordenação — shape de domínio, NÃO persistido (firstPredictionAt não está em RankingEntry).
interface RankableParticipant {
  uid: string;
  points: number;       // acertos exatos (binário)
  accuracy: number;     // 0–100
  wrong: number;        // erros
  firstPredictionAt?: string; // ISO; ausente = sem palpites
}

interface RankedParticipant extends RankableParticipant {
  position: number;     // 1-indexed
}

export function compareRanking(a: RankableParticipant, b: RankableParticipant): number;
export function rankParticipants(list: RankableParticipant[]): RankedParticipant[]; // cópia ordenada + position

export function computeAccuracy(points: number, finishedEligible: number): number; // 0–100

export type EvolutionDirection = "up" | "same" | "down";
export interface EvolutionResult { direction: EvolutionDirection; delta: number; }
export function evolutionIndicator(previousPosition: number | undefined | null, currentPosition: number): EvolutionResult;

import type { DistributionBucket } from "@/types";
export function buildDistribution(pointsList: number[], maxPoints?: number): DistributionBucket[];
```

- `rankParticipants` NÃO muta a entrada (retorna cópia). `compareRanking` exportado p/ reuso/teste.
- Tipos de saída de distribuição = `DistributionBucket` (TASK-01) — coerência com persistência.

## 8. Data and persistence impact

Nenhum. Funções puras. O recalc (TASK-03) mapeia `RankedParticipant` → `RankingEntry` (adicionando `name`/`nickname` desnormalizados); este módulo não persiste.

## 9. Required tests

`__tests__/rankingSort.test.ts`, `accuracy.test.ts`, `evolution.test.ts`, `distribution.test.ts`:
- **Sort:** ordena por points DESC; desempate por accuracy quando points iguais; por wrong quando points+accuracy iguais; por firstPredictionAt (mais antigo primeiro); por uid quando tudo igual; `firstPredictionAt` ausente vai por último entre empatados; entrada não é mutada; `position` 1-indexed sequencial; lista vazia → `[]`.
- **Accuracy:** `computeAccuracy(12,48)===25`; arredondamento (`1/3*100→33`); denominador 0 → 0; clamp (points>denom defensivo → 100).
- **Evolution:** subiu (10→4 → up delta 6); caiu (4→7 → down delta 3); manteve (5→5 → same 0); previous undefined → same 0.
- **Distribution:** contagem correta por faixa; valor de fronteira (39 na 1ª, 40 na 2ª, 89/90); `pointsList` vazio → 5 buckets count 0; `maxPoints>100` → topo label "90+ pts" e captura ponto 104; soma dos counts === itens dentro do range.

Testes assertam **valores de retorno** (não chamadas/mocks). Verificar via JSON do vitest (memory rtk-vitest-false-green).

## 10. Acceptance criteria

- [ ] As 4 famílias de funções existem em `src/features/rankings/lib/` e são reexportadas no barrel.
- [ ] Funções puras (sem I/O, sem mutação de entrada) — verificável por teste.
- [ ] Desempate segue a cadeia da §6.1; ordem total determinística.
- [ ] `computeAccuracy` trata denominador 0 e clampa 0–100.
- [ ] `evolutionIndicator` cobre up/same/down + sem-previous.
- [ ] `buildDistribution` cobre pontos >100 (WC2026) sem perder ninguém.
- [ ] Saída de distribuição valida contra `distributionBucketSchema`.
- [ ] tsc strict sem erros, sem `any`; suite verde.

## 11. UI/Screen requirement

- Requires screen: **no**
- Platform: n/a
- Screens involved: none
- Product type / Recommended style / UX domains: n/a

(Lógica de domínio pura — sem saída visual.)

## 12. Constraints

- Sem `any`; TypeScript strict.
- Sem dependências externas além de tipos `@/types` (e, se útil, primitivos). Não importar Firestore/React.
- Não mutar argumentos.
- Estilo de comparador alinhado a `src/features/predictions/lib/standings.ts` (DESC/ASC explícito, `localeCompare` p/ string).
- Reusar `DistributionBucket` de TASK-01 (não redefinir tipo).

## 13. Open questions

- **OQ1:** Label/limite do bucket topo quando pontos passam de 100. Resolvido por design: `maxPoints` param + label `"90+ pts"`. Telas usam o `label` retornado (não hardcodam). Confirmar na TASK-13 que a UI consome o `label`.
- **OQ2:** "Elegível ao escopo" (quais partidas contam por fase/grupo) é responsabilidade do caller (TASK-03). Este módulo recebe `finishedEligible` pronto. Sem ambiguidade aqui.
