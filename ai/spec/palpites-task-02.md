# SPEC — TASK-02: Funções puras de palpites (lock, pontuação, status de exibição)

> PRD: `ai/prd/palpites.md` | Plano: `ai/plan/palpites.md` | Branch: `feat/integracao-api-football`
> Tipo: domain | SP: 3 | Criticidade: critical | Risco técnico: medium
> TDD recomendado: yes (via `/tdd` separado). Sem tela.
> Depende de: TASK-01 (já concluída — `PredictionStatus`, `Prediction`, `MatchWithId` disponíveis).

---

## 1. Objetivo

Centralizar toda a lógica não-React de palpites em `src/features/predictions/lib/`, composta por funções puras testáveis em isolamento. Esta lib é a **fonte única** de regras de lock e pontuação, consumida literalmente por:

- Route Handler de upsert (TASK-03) — `isPredictionLocked`
- Route Handler de pontuação (TASK-04) — `scorePrediction`
- Hook compositor da lista (TASK-08) — `derivePredictionDisplayStatus`
- Componente de detalhe (TASK-09) — `isPredictionLocked`

Zero React. Zero Firebase. Zero `any`.

---

## 2. Escopo

### Dentro do escopo

- `src/features/predictions/lib/predictionsHelpers.ts` — 3 funções puras + tipos auxiliares de saída.
- `src/features/predictions/lib/predictionLabels.ts` — constantes de rótulo + cor de status para badges.
- `src/features/predictions/lib/__tests__/predictionsHelpers.test.ts` — suite Vitest (criada via `/tdd`).
- Atualização de `src/features/predictions/lib/index.ts` — reexportar os dois novos módulos.

### Fora do escopo

- Nenhum hook React, componente ou página.
- Nenhuma alteração em schemas, serviços ou tipos existentes (consumidos apenas via import).
- Route Handlers (TASK-03, TASK-04).
- `predictionDocId` foi consolidado em `predictionsHelpers.ts` (ver seção 6) — não há arquivo separado `predictionHelpers.ts`.

---

## 3. Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/features/predictions/lib/predictionsHelpers.ts` | Criar — 3 funções puras + tipo `PredictionDisplayStatus` |
| `src/features/predictions/lib/predictionLabels.ts` | Criar — constantes de badge |
| `src/features/predictions/lib/index.ts` | Atualizar — reexportar novos módulos |
| `src/features/predictions/lib/__tests__/predictionsHelpers.test.ts` | Criar via `/tdd` |

Molde de referência obrigatório: `src/features/matches/lib/matchesHelpers.ts` + `matchLabels.ts` (padrão JSDoc, injeção de `now: Date`, Record de constantes tipadas).

---

## 4. Regras de negócio e comportamento

### 4.1 `isPredictionLocked(match, now)`

**Assinatura:**
```ts
function isPredictionLocked(match: MatchWithId, now: Date): boolean
```

**Regra (OR lógico):**
- `now.getTime() >= new Date(match.kickoffAt).getTime()` → `true`
- `match.status !== "scheduled"` → `true`
- Caso contrário → `false`

**Decisões de design:**
- Injeta `now: Date` — nunca chama `new Date()` internamente (testabilidade).
- `kickoffAt` é ISO 8601 com offset (validado por `isoDateTime` do schema); `new Date(match.kickoffAt)` é seguro.
- Retorna `boolean` simples — sem lançar exceção.
- "live", "finished", "postponed", "canceled" → todos resultam em `locked === true` (qualquer status diferente de "scheduled" bloqueia).
- `globalLock` (trava do sistema) é tratado por quem chama (UI/Route Handler), não por esta função. A função de lock é orthogonal à trava global.

**Casos de aresta obrigatórios nos testes:**
1. `now` exatamente igual a `kickoffAt` → `true` (borda: `>=` não `>`).
2. `now` 1 ms antes de `kickoffAt`, status `"scheduled"` → `false`.
3. `now` antes de `kickoffAt`, mas `status === "live"` → `true`.
4. `now` antes de `kickoffAt`, status `"finished"` → `true`.
5. `now` antes de `kickoffAt`, status `"postponed"` → `true`.
6. `now` antes de `kickoffAt`, status `"canceled"` → `true`.
7. `kickoffAt` com offset negativo (ex.: `"2026-06-14T13:00:00-03:00"`) — compara corretamente via `getTime()`.

---

### 4.2 `scorePrediction(prediction, match)`

**Assinatura:**
```ts
function scorePrediction(
  prediction: Prediction,
  match: MatchWithId,
): ScorePredictionResult
```

**Tipo de retorno:**
```ts
/** Resultado da pontuação de um palpite contra o resultado oficial. */
export interface ScorePredictionResult {
  status: "correct" | "wrong" | "pending";
  points: 0 | 1;
}
```

**Lógica (binária):**
1. Se `match.status !== "finished"` → `{ status: "pending", points: 0 }`. A partida não terminou; não pontua.
2. Se `match.status === "finished"`:
   - `homeScore` e `awayScore` do match são `number` (garantido pelo refinement do schema quando `finished`).
   - Placar exato: `prediction.homeScore === match.homeScore && prediction.awayScore === match.awayScore` → `{ status: "correct", points: 1 }`.
   - Qualquer outro resultado → `{ status: "wrong", points: 0 }`.

**Decisões de design:**
- Binário puro — sem acerto parcial, sem acerto de vencedor.
- Não recebe `now` — a temporalidade é responsabilidade de `isPredictionLocked`; aqui só importa o status da partida.
- `match.homeScore` e `match.awayScore` em um match `finished` são `number | null` pelo tipo TypeScript (o refinement Zod valida em runtime, mas o tipo em compilação é nullable). A implementação deve fazer type narrowing: verificar `match.homeScore !== null && match.awayScore !== null` antes da comparação, para satisfazer o TypeScript strict.
- Nunca lança exceção. Se `finished` mas scores forem null (inconsistência de dados) → tratar como `wrong` (conservador). Esse branch nunca deveria ocorrer com dados válidos do schema.
- `"pending"` é um valor de retorno válido para `status` aqui (partida não finalizada) — distinto de `PredictionStatus` que tem "locked". O tipo de retorno é específico desta função.

**Casos de aresta obrigatórios nos testes:**
1. Partida `finished`, placar exato acertado → `{ status: "correct", points: 1 }`.
2. Partida `finished`, gols corretos mas invertidos (2×1 previsto, 1×2 real) → `{ status: "wrong", points: 0 }`.
3. Partida `finished`, placar real 0×0, previsto 0×0 → `{ status: "correct", points: 1 }`.
4. Partida `finished`, placar errado → `{ status: "wrong", points: 0 }`.
5. Partida `scheduled` → `{ status: "pending", points: 0 }`.
6. Partida `live` → `{ status: "pending", points: 0 }`.
7. Partida `postponed` → `{ status: "pending", points: 0 }`.
8. Idempotência: chamar duas vezes com os mesmos dados retorna o mesmo resultado.

---

### 4.3 `derivePredictionDisplayStatus(prediction, match, now)`

**Assinatura:**
```ts
function derivePredictionDisplayStatus(
  prediction: Prediction,
  match: MatchWithId,
  now: Date,
): PredictionDisplayStatus
```

**Tipo próprio (definido no mesmo arquivo):**
```ts
/** Status de exibição de um palpite em pt-BR, para badges na Lista de Palpites. */
export type PredictionDisplayStatus = "pendente" | "acertou" | "errou" | "bloqueado";
```

**Lógica (ordem de avaliação — prioridade decrescente):**
1. `match.status === "finished"`:
   - Usa `scorePrediction(prediction, match)`.
   - `correct` → `"acertou"`.
   - `wrong` → `"errou"`.
2. `isPredictionLocked(match, now) === true` (partida iniciada, não finalizada — "live", "postponed", "canceled", ou agora >= kickoff com status scheduled):
   - → `"bloqueado"`.
3. Caso contrário (partida futura, status `"scheduled"`, sem lock):
   - → `"pendente"`.

**Decisão de design — por que `finished` tem prioridade sobre lock:**
Uma partida `finished` sempre passou pelo estado de "locked" antes. O resultado final (acertou/errou) é mais informativo para o usuário do que "bloqueado". Logo, partida encerrada → mostrar resultado, não lock.

**Casos de aresta obrigatórios nos testes:**
1. Partida `finished`, placar exato → `"acertou"`.
2. Partida `finished`, placar errado → `"errou"`.
3. Partida `live`, `now` antes de `kickoffAt` (edge race condition com status) → `"bloqueado"` (status `!== "scheduled"`).
4. Partida `scheduled`, `now >= kickoffAt` → `"bloqueado"`.
5. Partida `scheduled`, `now < kickoffAt` → `"pendente"`.
6. Partida `postponed` → `"bloqueado"`.
7. Partida `canceled` → `"bloqueado"`.

---

### 4.4 Constantes de rótulo e cor — `predictionLabels.ts`

Arquivo dedicado. Padrão idêntico a `matchLabels.ts`.

```ts
/** Rótulo em pt-BR para o status de exibição de palpite. */
export const PREDICTION_DISPLAY_STATUS_LABEL: Record<PredictionDisplayStatus, string> = {
  pendente:  "Pendente",
  acertou:   "Acertou",
  errou:     "Errou",
  bloqueado: "Bloqueado",
};

/** Classes Tailwind para badge de status de palpite na Lista de Palpites. */
export const PREDICTION_DISPLAY_STATUS_COLOR: Record<PredictionDisplayStatus, string> = {
  acertou:  "bg-win-bg text-win",
  errou:    "bg-loss-bg text-loss",
  pendente: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
  bloqueado:"bg-gray-500/20 text-gray-600 dark:text-gray-400",
};
```

**Tokens de cor (alinhados ao `globals.css` e ao padrão de `LastResultsCard.tsx`):**
- `acertou` → tokens semânticos win: `bg-win-bg text-win` (mapeados para `--color-win-bg` / `--color-win` em `:root` e `.dark` — dark mode automático, sem sufixo `dark:`).
- `errou` → tokens semânticos loss: `bg-loss-bg text-loss` (mapeados para `--color-loss-bg` / `--color-loss` — dark mode automático).
- `pendente` → âmbar: `bg-amber-500/20 text-amber-700 dark:text-amber-400` (sem token dedicado; consistente com `matchLabels.ts`).
- `bloqueado` → cinza: `bg-gray-500/20 text-gray-600 dark:text-gray-400` (sem token dedicado; consistente com `matchLabels.ts`).

**Dependência de import:**
`predictionLabels.ts` importa `PredictionDisplayStatus` de `./predictionsHelpers` (type-only, sem ciclo).
`predictionsHelpers.ts` NÃO importa `predictionLabels.ts` — sem ciclo de runtime.

---

## 5. Estrutura de arquivos resultante

```
src/features/predictions/lib/
├── predictionsHelpers.ts            # predictionDocId (consolidado de TASK-01) + isPredictionLocked, scorePrediction, derivePredictionDisplayStatus, tipos
├── predictionLabels.ts              # PREDICTION_DISPLAY_STATUS_LABEL, PREDICTION_DISPLAY_STATUS_COLOR
├── index.ts                         # barrel: reexporta predictionsHelpers + predictionLabels
└── __tests__/
    └── predictionsHelpers.test.ts   # suite Vitest
```

> Nota de naming e consolidação: **não existe** `predictionHelpers.ts` (singular) — o nome gerava confusão com `predictionsHelpers.ts` (plural). A função `predictionDocId` (originalmente TASK-01) foi consolidada diretamente em `predictionsHelpers.ts`, seguindo o padrão `matchesHelpers.ts` da feature Jogos. O barrel `index.ts` reexporta tudo via `export * from "./predictionsHelpers"`, tornando `predictionDocId` acessível através de `@/features/predictions/lib` sem caminho direto para arquivo.

---

## 6. Contrato de imports

> **Consolidação de barrel — leia antes de implementar TASK-03/04:**
> `predictionDocId` NÃO tem um arquivo dedicado `predictionHelpers.ts`. Ele vive em `predictionsHelpers.ts` e é reexportado pelo barrel `index.ts`. **Todo consumidor** (TASK-03, TASK-04 e demais) deve importar de `@/features/predictions/lib` — nunca de um caminho direto para arquivo (ex.: `@/features/predictions/lib/predictionHelpers` não existe e causará erro de compilação).

### `predictionsHelpers.ts` importa de:
```ts
import type { MatchWithId } from "@/types"; // Match + { id: string }
import type { Prediction }  from "@/types"; // z.infer<typeof predictionSchema>
```

Nenhum import de Firebase, React, ou módulos de servidor.

### `predictionLabels.ts` importa de:
```ts
import type { PredictionDisplayStatus } from "./predictionsHelpers";
```

### `index.ts` (estado atual) exporta:
```ts
export * from "./predictionsHelpers"; // predictionDocId + isPredictionLocked, scorePrediction, derivePredictionDisplayStatus, tipos
export * from "./predictionLabels";   // PREDICTION_DISPLAY_STATUS_LABEL, PREDICTION_DISPLAY_STATUS_COLOR
```

> Não existe `export * from "./predictionHelpers"` — esse arquivo foi removido intencionalmente na consolidação do TASK-02. Não recriar.

### Consumidores e import path:
| Símbolo | Importar de |
|---|---|
| `predictionDocId` | `@/features/predictions/lib` (via barrel — arquivo fonte: `predictionsHelpers.ts`) |
| `isPredictionLocked` | `@/features/predictions/lib` |
| `scorePrediction` | `@/features/predictions/lib` |
| `derivePredictionDisplayStatus` | `@/features/predictions/lib` |
| `PredictionDisplayStatus` | `@/features/predictions/lib` |
| `ScorePredictionResult` | `@/features/predictions/lib` |
| `PREDICTION_DISPLAY_STATUS_LABEL` | `@/features/predictions/lib` |
| `PREDICTION_DISPLAY_STATUS_COLOR` | `@/features/predictions/lib` |

---

## 7. Tipos auxiliares definidos nesta tarefa

### Em `predictionsHelpers.ts`:

```ts
/** Status de exibição de um palpite em pt-BR, para badges na Lista de Palpites.
 *  NÃO confundir com PredictionStatus (canônico @/types — "pending"|"correct"|"wrong"|"locked").
 *  Este tipo é exclusivo da camada de apresentação. */
export type PredictionDisplayStatus = "pendente" | "acertou" | "errou" | "bloqueado";

/** Resultado da pontuação de um palpite contra o resultado oficial.
 *  Retornado por scorePrediction; consumido pelo Route Handler de pontuação (TASK-04). */
export interface ScorePredictionResult {
  status: "correct" | "wrong" | "pending";
  points: 0 | 1;
}
```

**Por que `PredictionDisplayStatus` é um tipo próprio e não reutiliza `PredictionStatus`:**
- `PredictionStatus` (`@/types`) usa valores em inglês (`"pending"|"correct"|"wrong"|"locked"`) e é a chave de armazenamento canônica no Firestore.
- `PredictionDisplayStatus` usa labels pt-BR (`"pendente"|"acertou"|"errou"|"bloqueado"`) destinadas exclusivamente a badges de UI.
- Misturar os dois levaria a strings hardcodadas em pt-BR espalhadas pelo código de persistência ou a enums duplicados que divergem silenciosamente.

---

## 8. Implementação de `predictionsHelpers.ts` — esqueleto anotado

```ts
/**
 * Funções puras da feature Palpites (TASK-02).
 * Sem React, sem Firebase — testáveis em isolamento.
 * Consumidas pelos Route Handlers (TASK-03/04) e pela UI (TASK-07/08/09).
 */

import type { MatchWithId, Prediction } from "@/types";

// ---------------------------------------------------------------------------
// Tipos de saída (reexportados pelo barrel para uso no compositor e na UI)
// ---------------------------------------------------------------------------

/** Status de exibição de um palpite em pt-BR, para badges na Lista de Palpites.
 *  NÃO confundir com PredictionStatus canônico de @/types. */
export type PredictionDisplayStatus = "pendente" | "acertou" | "errou" | "bloqueado";

/** Resultado da pontuação de um palpite contra o resultado oficial. */
export interface ScorePredictionResult {
  status: "correct" | "wrong" | "pending";
  points: 0 | 1;
}

// ---------------------------------------------------------------------------
// 1. isPredictionLocked
// ---------------------------------------------------------------------------

/**
 * Verifica se um palpite está bloqueado para criação/edição.
 *
 * Bloqueado quando (OR lógico):
 * - agora >= kickoffAt (jogo iniciou)
 * - match.status !== "scheduled" (qualquer status diferente de agendado)
 *
 * @param match - Partida alvo.
 * @param now   - Data de referência (injetada — nunca new Date() interno).
 */
export function isPredictionLocked(match: MatchWithId, now: Date): boolean { ... }

// ---------------------------------------------------------------------------
// 2. scorePrediction
// ---------------------------------------------------------------------------

/**
 * Calcula o resultado binário de um palpite contra o placar oficial.
 * Só pontua quando match.status === "finished".
 * Pontuação binária: placar exato = 1; qualquer outro resultado = 0.
 *
 * @param prediction - Palpite do usuário.
 * @param match      - Partida com resultado oficial.
 */
export function scorePrediction(
  prediction: Prediction,
  match: MatchWithId,
): ScorePredictionResult { ... }

// ---------------------------------------------------------------------------
// 3. derivePredictionDisplayStatus
// ---------------------------------------------------------------------------

/**
 * Deriva o status de exibição em pt-BR para badges na Lista de Palpites.
 * Combina resultado (scorePrediction) + lock (isPredictionLocked).
 *
 * Prioridade (ordem de avaliação):
 * 1. match.status === "finished" → "acertou" | "errou"
 * 2. isPredictionLocked → "bloqueado"
 * 3. caso contrário → "pendente"
 *
 * @param prediction - Palpite do usuário.
 * @param match      - Partida alvo.
 * @param now        - Data de referência (injetada).
 */
export function derivePredictionDisplayStatus(
  prediction: Prediction,
  match: MatchWithId,
  now: Date,
): PredictionDisplayStatus { ... }
```

---

## 9. Restrições de implementação

1. **Sem `any`** — TypeScript strict em todo o projeto.
2. **Sem `new Date()` interno** — `now: Date` é sempre injetado (testabilidade com datas fixas).
3. **Sem React, Firebase ou dependências de servidor** — funções puras de domínio.
4. **Sem estilos inline** em `predictionLabels.ts` — usar apenas classes Tailwind string (sem `style={}`).
5. **Sem hardcode de rótulos fora de `predictionLabels.ts`** — toda string de badge referencia as constantes.
6. **Sem import circular** — `predictionLabels.ts` importa de `predictionsHelpers.ts`; o inverso é proibido.
7. **`scorePrediction` trata `match.homeScore`/`match.awayScore` como `number | null`** (tipo TypeScript) e faz narrowing explícito antes de comparar — não assumir que são `number` só porque `status === "finished"`.
8. **Comentários JSDoc em pt-BR** ou pt-BR/inglês misto (seguindo o padrão de `matchesHelpers.ts`).

---

## 10. Critérios de aceitação

- [ ] `isPredictionLocked(match, now)` retorna `true` quando `now >= kickoffAt`.
- [ ] `isPredictionLocked(match, now)` retorna `true` quando `match.status !== "scheduled"`, independentemente de `now`.
- [ ] `isPredictionLocked(match, now)` retorna `false` apenas quando `now < kickoffAt` E `match.status === "scheduled"`.
- [ ] `scorePrediction` retorna `{ status: "correct", points: 1 }` para placar exato em partida `finished`.
- [ ] `scorePrediction` retorna `{ status: "wrong", points: 0 }` para placar errado em partida `finished`.
- [ ] `scorePrediction` retorna `{ status: "pending", points: 0 }` para partida não-`finished`.
- [ ] `derivePredictionDisplayStatus` retorna `"acertou"` para partida `finished` com placar exato.
- [ ] `derivePredictionDisplayStatus` retorna `"errou"` para partida `finished` com placar errado.
- [ ] `derivePredictionDisplayStatus` retorna `"bloqueado"` para partida `live`/`postponed`/`canceled` (independente de now).
- [ ] `derivePredictionDisplayStatus` retorna `"bloqueado"` para partida `scheduled` com `now >= kickoffAt`.
- [ ] `derivePredictionDisplayStatus` retorna `"pendente"` para partida `scheduled` com `now < kickoffAt`.
- [ ] `PredictionDisplayStatus` exportado como tipo próprio de `predictionsHelpers.ts`.
- [ ] `ScorePredictionResult` exportado como interface de `predictionsHelpers.ts`.
- [ ] `PREDICTION_DISPLAY_STATUS_LABEL` e `PREDICTION_DISPLAY_STATUS_COLOR` exportados de `predictionLabels.ts` como `Record<PredictionDisplayStatus, string>`.
- [ ] Cores de badge: acertou=`bg-win-bg text-win`, errou=`bg-loss-bg text-loss`, pendente=âmbar, bloqueado=cinza (tokens semânticos de `globals.css`).
- [ ] `src/features/predictions/lib/index.ts` reexporta os 3 módulos (`predictionHelpers`, `predictionsHelpers`, `predictionLabels`).
- [ ] `rtk tsc` sem erros após as alterações.
- [ ] Sem `any` introduzido.
- [ ] Suite de testes cobre todos os casos de aresta listados nas seções 4.1–4.3.

---

## 11. O que esta tarefa NÃO faz

- Não cria Route Handler de upsert — TASK-03.
- Não cria Route Handler de pontuação — TASK-04.
- Não altera Security Rules — TASK-05.
- Não cria hooks TanStack Query ou services de escrita — TASK-06.
- Não cria nenhum componente de UI, formulário ou página — TASK-07/08/09.
- Não implementa `globalLock` (trava do sistema) — responsabilidade de quem chama `isPredictionLocked`.
- Não calcula rankings ou estatísticas — PRDs separados.
- Não altera `src/schemas/`, `src/types/` ou `src/services/` (apenas consome tipos já definidos em TASK-01).
