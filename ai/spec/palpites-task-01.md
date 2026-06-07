# SPEC — TASK-01: Contrato de dados de `predictions` (schema + tipos)

> PRD: `ai/prd/palpites.md` | Plano: `ai/plan/palpites.md` | Branch: `feat/integracao-api-football`
> Tipo: persistence | SP: 2 | Criticidade: high | Risco técnico: low
> Sem TDD (schema; testes de validação entram no `/test`). Sem tela.

---

## 1. Objetivo

Estender o contrato de palpite — `predictionSchema` + tipos derivados — para suportar:

1. **`status`** e **`points`** opcionais, gravados exclusivamente pelo servidor (Route Handlers com Admin SDK).
2. **`predictionInputSchema`** — schema separado para validar o body do cliente no Route Handler de upsert (uid não vai no body; vem da sessão).
3. **`predictionDocId(uid, matchId)`** — helper puro de id determinístico.
4. **`predictionStatusSchema`** no barrel de shared para consumo por TASK-02, TASK-03, TASK-04.

Não quebrar `listPredictionsByUid` (leitura atual com `.parse`): campos novos devem ser opcionais.

---

## 2. Contexto e estado atual

| Arquivo | Estado atual |
|---|---|
| `src/schemas/shared.ts` | Tem `roleSchema`, `userStatusSchema`, `matchStatusSchema`, `scoreSchema`, `isoDateTime`, `nonEmptyString`, `percentageSchema`, `stageSchema`, `rankingScopeSchema`. **Não tem** `predictionStatusSchema`. |
| `src/schemas/predictions.ts` | `predictionSchema` `.strict()` com `uid`, `matchId`, `homeScore`, `awayScore`, `createdAt?`, `updatedAt?`. **Não tem** `status`, `points`, nem `predictionInputSchema`. |
| `src/types/predictions.ts` | `Prediction = z.infer<typeof predictionSchema>`. Um único export. |
| `src/types/shared.ts` | `Role`, `UserStatus`, `Stage`, `RankingScope`, `MatchStatus`. **Não tem** `PredictionStatus`. |
| `src/schemas/index.ts` | Barrel completo reexportando todas as coleções + shared. Já inclui `./predictions`. |
| `src/types/index.ts` | Barrel completo reexportando todos os tipos. Já inclui `./predictions`. |
| `src/features/predictions/index.ts` | Barrel vazio (`export {}`). |
| `src/lib/index.ts` | Barrel vazio (`export {}`). |

---

## 3. Decisões travadas (não reabrir)

- **Pontuação binária:** `points` é `0 | 1` — `z.literal(0).or(z.literal(1))`. Não usar `z.int().min(0).max(1)` (permite valores intermediários via coerção externa; literal é mais preciso).
- **`status`/`points` nunca enviados pelo cliente.** O `predictionInputSchema` expõe somente `matchId`, `homeScore`, `awayScore`. O uid vem da sessão autenticada no Route Handler.
- **Sem delete.** Schema e tipos não expõem nenhum campo para essa operação.
- **`.strict()` mantido em `predictionSchema`.** Novos campos `status` e `points` entram no mesmo objeto `.strict()`, como opcionais.
- **Id do doc:** `predictionDocId(uid, matchId)` retorna `${uid}_${matchId}`. Puro (sem side effects). Vive em `src/features/predictions/lib/predictionHelpers.ts`.
- **Naming do código existente tem precedência** sobre o texto do PRD: `uid` (não `userId`), `homeScore`/`awayScore` (não `homeScorePrediction`/`awayScorePrediction`), `matchId` (não `fixtureId`).

---

## 4. Alterações por arquivo

### 4.1 `src/schemas/shared.ts` — adicionar `predictionStatusSchema`

Inserir após `matchStatusSchema` (linha 35 do estado atual), seguindo o padrão de comentário dos outros enums:

```ts
export const predictionStatusSchema = z.enum([
  "pending",   // palpite registrado, partida não finalizada
  "correct",   // placar exato acertado (gravado pelo servidor)
  "wrong",     // placar errado (gravado pelo servidor)
  "locked",    // partida iniciada antes da finalização (não pontuada ainda)
]);
```

Nenhuma alteração nos demais exports do arquivo.

### 4.2 `src/schemas/predictions.ts` — estender schema + novo input schema

**Substituir** o arquivo completo para:

```ts
import { z } from "zod";

import {
  isoDateTime,
  nonEmptyString,
  predictionStatusSchema,
  scoreSchema,
} from "@/schemas/shared";

// ---------------------------------------------------------------------------
// Schema completo do doc Firestore (coleção `predictions`).
// Os campos `status` e `points` são gravados EXCLUSIVAMENTE pelo servidor
// (Route Handler com Admin SDK). O cliente NUNCA os envia.
// ---------------------------------------------------------------------------
export const predictionSchema = z
  .object({
    uid: nonEmptyString,           // autor do palpite — referência users.uid
    matchId: nonEmptyString,       // partida alvo — API-Football fixture id
    homeScore: scoreSchema,        // placar previsto mandante (inteiro ≥ 0)
    awayScore: scoreSchema,        // placar previsto visitante (inteiro ≥ 0)
    createdAt: isoDateTime.optional(),
    updatedAt: isoDateTime.optional(),
    // Gravados somente pelo Route Handler de pontuação (Admin SDK):
    status: predictionStatusSchema.optional(),
    points: z.literal(0).or(z.literal(1)).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Schema de input do cliente — body do POST /api/predictions.
// `uid` é omitido (vem da sessão no servidor, não do body).
// `status` e `points` são omitidos (nunca aceitos do cliente).
// ---------------------------------------------------------------------------
export const predictionInputSchema = z.object({
  matchId: nonEmptyString,
  homeScore: scoreSchema,
  awayScore: scoreSchema,
});
```

Pontos importantes:
- `.strict()` é mantido em `predictionSchema` — doc completo do Firestore não aceita campos extras.
- `predictionInputSchema` **não** usa `.strict()` (evitar quebra em caso de campos extras não maliciosos no body; o Route Handler decide o que usar).
- O comentário de "Unicidade (uid, matchId)" da versão anterior pode ser removido; a unicidade é garantida pelo `predictionDocId` helper, não por schema.

### 4.3 `src/features/predictions/lib/predictionHelpers.ts` — helper de id (novo arquivo)

Criar `src/features/predictions/lib/predictionHelpers.ts`:

```ts
/**
 * Gera o id determinístico do doc `predictions/${uid}_${matchId}`.
 * Garante unicidade (uid, matchId) sem query extra.
 * Puro — sem side effects.
 */
export function predictionDocId(uid: string, matchId: string): string {
  return `${uid}_${matchId}`;
}
```

Regras:
- Sem imports externos.
- Sem `any`.
- Exportado como named export (não default).
- Sem validação Zod aqui — validação fica no schema; aqui é só string concat determinística.

### 4.4 `src/features/predictions/lib/index.ts` — barrel de lib (novo arquivo)

Criar `src/features/predictions/lib/index.ts`:

```ts
export * from "./predictionHelpers";
```

### 4.5 `src/features/predictions/index.ts` — atualizar barrel da feature

Substituir `export {}` para reexportar o lib:

```ts
export * from "./lib";
```

### 4.6 `src/types/predictions.ts` — adicionar tipos derivados

Substituir o arquivo completo para:

```ts
import type { z } from "zod";

import type {
  predictionInputSchema,
  predictionSchema,
} from "@/schemas/predictions";

export type Prediction = z.infer<typeof predictionSchema>;
export type PredictionInput = z.infer<typeof predictionInputSchema>;
```

- `Prediction` agora inclui `status?: PredictionStatus` e `points?: 0 | 1` (derivados automaticamente do schema estendido).
- `PredictionInput` é o tipo do body esperado pelo Route Handler de upsert.

### 4.7 `src/types/shared.ts` — adicionar `PredictionStatus`

Inserir import e export de `PredictionStatus` seguindo o padrão existente:

```ts
import type { z } from "zod";

import type {
  matchStatusSchema,
  predictionStatusSchema,
  rankingScopeSchema,
  roleSchema,
  stageSchema,
  userStatusSchema,
} from "@/schemas/shared";

// Tipos derivados dos enums compartilhados (z.infer — sem duplicação manual).
export type Role = z.infer<typeof roleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type Stage = z.infer<typeof stageSchema>;
export type RankingScope = z.infer<typeof rankingScopeSchema>;
export type MatchStatus = z.infer<typeof matchStatusSchema>;
export type PredictionStatus = z.infer<typeof predictionStatusSchema>;
```

### 4.8 `src/schemas/index.ts` e `src/types/index.ts` — barrels

**Nenhuma alteração necessária.** Ambos já reexportam `./predictions` e `./shared` com `export *`. Os novos exports (`predictionStatusSchema`, `predictionInputSchema`, `PredictionInput`, `PredictionStatus`) serão automaticamente incluídos ao compilar.

Verificar que não há colisão de nomes nos barrels (nenhum outro arquivo exporta `predictionStatusSchema`, `PredictionStatus`, `predictionInputSchema`, `PredictionInput` — confirmado pelo estado atual).

---

## 5. Estrutura de arquivos resultante

```
src/
├── schemas/
│   ├── shared.ts              # + predictionStatusSchema
│   └── predictions.ts         # + status/points em predictionSchema; + predictionInputSchema
├── types/
│   ├── shared.ts              # + PredictionStatus
│   └── predictions.ts         # + PredictionInput
└── features/
    └── predictions/
        ├── index.ts            # export * from "./lib"  (era export {})
        └── lib/
            ├── index.ts        # NOVO: barrel
            └── predictionHelpers.ts  # NOVO: predictionDocId
```

---

## 6. Contrato público após TASK-01

Os seguintes símbolos devem ser consumíveis via barrels:

| Símbolo | De onde importar | Consumidor principal |
|---|---|---|
| `predictionStatusSchema` | `@/schemas/shared` ou `@/schemas` | TASK-02 (lib pura), TASK-03 (Route Handler) |
| `predictionSchema` | `@/schemas/predictions` ou `@/schemas` | `listPredictionsByUid` (já usa), TASK-03, TASK-04 |
| `predictionInputSchema` | `@/schemas/predictions` ou `@/schemas` | TASK-03 (validação do body) |
| `PredictionStatus` | `@/types/shared` ou `@/types` | TASK-02 (tipo de retorno de helpers) |
| `Prediction` | `@/types/predictions` ou `@/types` | TASK-02, TASK-06, UI |
| `PredictionInput` | `@/types/predictions` ou `@/types` | TASK-03, TASK-06 |
| `predictionDocId` | `@/features/predictions` ou `@/features/predictions/lib` | TASK-03, TASK-06 |

---

## 7. Compatibilidade retroativa

`listPredictionsByUid` em `src/services/predictions.ts` chama `.parse(doc)` com `predictionSchema`. Como `status` e `points` são opcionais, docs antigos (sem esses campos) continuam válidos — `.parse` não lança. Nenhuma migração de dados é necessária.

Verificar: se `listPredictionsByUid` usa `.strict()` no schema, docs **com** campos extras no Firestore (ex.: um campo legado) lançariam erro. Isso já era o comportamento antes desta tarefa. A extensão não muda esse comportamento.

---

## 8. Restrições de implementação

1. **Sem `any`** em nenhum dos arquivos (regra global do projeto).
2. **Sem estilos inline** (não aplicável a esta tarefa — sem UI).
3. **Sem hardcode de valores** fora das constantes Zod (os valores do enum são as constantes).
4. `predictionDocId` deve ser uma função pura: entrada `(uid: string, matchId: string)`, saída `string`. Sem validação interna (confia que quem chama já validou via schema).
5. Os schemas Zod são a **fonte única de verdade** dos tipos — nunca duplicar interfaces manualmente.
6. `predictionInputSchema` **não** inclui `uid` — essa é uma decisão de segurança (evitar que o cliente informe uid arbitrário). O Route Handler lê o uid da sessão e o injeta antes de gravar.

---

## 9. Critérios de aceitação

- [ ] `predictionStatusSchema` exportado de `src/schemas/shared.ts` com valores `"pending" | "correct" | "wrong" | "locked"`.
- [ ] `predictionSchema` `.strict()` inclui `status: predictionStatusSchema.optional()` e `points: z.literal(0).or(z.literal(1)).optional()`.
- [ ] `predictionSchema` mantém todos os campos anteriores com o mesmo naming (`uid`, `matchId`, `homeScore`, `awayScore`, `createdAt`, `updatedAt`).
- [ ] `predictionInputSchema` exportado com campos `matchId`, `homeScore`, `awayScore` — sem `uid`, `status`, `points`.
- [ ] `Prediction` (tipo derivado) inclui `status?: "pending" | "correct" | "wrong" | "locked"` e `points?: 0 | 1`.
- [ ] `PredictionInput` (tipo derivado) exportado de `src/types/predictions.ts`.
- [ ] `PredictionStatus` exportado de `src/types/shared.ts`.
- [ ] `predictionDocId("abc", "123")` retorna `"abc_123"`.
- [ ] `predictionDocId` exportado via `src/features/predictions/lib/index.ts` e `src/features/predictions/index.ts`.
- [ ] Barrels `src/schemas/index.ts` e `src/types/index.ts` expõem todos os novos símbolos sem alteração direta.
- [ ] `listPredictionsByUid` (serviço existente) não quebra — nenhuma alteração necessária nele para esta tarefa.
- [ ] `rtk tsc` sem erros após as alterações.
- [ ] Sem `any` introduzido.

---

## 10. O que esta tarefa NÃO faz

- Não implementa `isPredictionLocked`, `scorePrediction`, `derivePredictionDisplayStatus` — TASK-02.
- Não cria o Route Handler de upsert `/api/predictions` — TASK-03.
- Não cria o Route Handler de pontuação `/api/predictions/score` — TASK-04.
- Não altera Security Rules — TASK-05.
- Não cria hooks de mutação — TASK-06.
- Não cria nenhuma tela ou componente de UI.
- Não escreve testes automatizados (testes de schema entram no `/test` da feature em tarefa posterior).
- Não altera `src/services/predictions.ts` (leitura existente permanece intacta).
