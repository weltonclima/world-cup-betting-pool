# SPEC

## 1. Task: TASK-01 – Estender schemas de ranking e estatísticas

## 2. Objective

Modelar em Zod os dados que as 6 telas do PRD-05 consomem, sob pontuação **binária 1/0**, **sem quebrar** o contrato já consumido por `getGeneralRanking` / card da Home. Zod é fonte única de tipos (`z.infer`).

## 3. In scope

1. Estender `rankingEntrySchema` com campos de exibição: `name`, `wrong`, `accuracy`.
2. Definir `groupRankingSchema` (ranking por grupo individual A–L) — doc `rankings/grupo-{groupId}`.
3. Criar `poolStatsSchema` (estatísticas gerais do bolão — Tela 06).
4. Estender `statisticsSchema` / `positionHistoryEntrySchema` p/ Telas 02/05 (erros, rótulo de rodada).
5. Reexportar tudo em `src/schemas/index.ts` e tipos em `src/types/rankings.ts` + `src/types` (statistics já reexportado? confirmar barrel).
6. Atualizar/expandir `__tests__`.

## 4. Out of scope

- Lógica de cálculo (helpers → TASK-02), gravação (recalc → TASK-03), leitura (serviços → TASK-04).
- Pontuação 3/1/0, `correctWinners` (descartados — binário).
- Migração de granularidade do enum `stageSchema`.

## 5. Main technical areas

`src/schemas/rankings.ts`, `src/schemas/statistics.ts`, `src/schemas/shared.ts`, `src/types/rankings.ts`, `src/schemas/index.ts`, `src/schemas/__tests__/rankings.test.ts`, `src/schemas/__tests__/statistics.test.ts` (criar se inexistente).

## 6. Business rules and behavior

- **Binário:** `points` = total de acertos exatos no escopo (já é `z.int().min(0)`). **`points === acertos`** — NÃO adicionar campo `correct` redundante; `points` é a métrica única de pontos/acertos.
- **`wrong`** = nº de palpites de partidas finalizadas (no escopo) que não acertaram o placar exato.
- **`accuracy`** = aproveitamento 0–100 (`percentageSchema`). Denominador = partidas finalizadas elegíveis ao escopo (definição operacional fica na TASK-02; schema só guarda o número).
- **`name`** = nome completo desnormalizado (Tela 01 mostra Nome + Apelido). Origem: `users.name`, gravado pelo recalc.
- **Compatibilidade retroativa (OBRIGATÓRIA):** `name`, `wrong`, `accuracy` são **`.optional()`** — docs `rankings` no formato atual `{uid,nickname,position,points}` continuam passando `.parse`. UI faz fallback quando ausentes. Recalc (TASK-03) passa a gravá-los sempre.
- **Por grupo:** doc separado por grupo, identificado por `groupId` (string, ex.: `"A"`…`"L"` — alinhar com `match.groupId`). Reaproveita `rankingEntrySchema`.
- **Pool stats:** distribuição em 5 faixas fixas conforme imagem Tela 06.
- Todos os schemas mantêm `.strict()` (padrão do projeto).

## 7. Contracts and interfaces

### 7.1 `rankingEntrySchema` (estendido) — `src/schemas/rankings.ts`
| Campo | Tipo | Obrig. | Notas |
|---|---|---|---|
| `uid` | `nonEmptyString` | sim | inalterado |
| `nickname` | `nonEmptyString` | sim | inalterado |
| `name` | `nonEmptyString` | **não** (`.optional()`) | desnormalizado de `users.name` |
| `position` | `z.int().min(1)` | sim | inalterado |
| `points` | `z.int().min(0)` | sim | acertos = pontos (binário) |
| `wrong` | `z.int().min(0)` | **não** | erros |
| `accuracy` | `percentageSchema` | **não** | 0–100 |

`.strict()` mantido.

### 7.2 `rankingSchema` — inalterado
`{ scope: rankingScopeSchema, updatedAt: isoDateTime, entries: rankingEntrySchema[] }`. Continua válido (entries herdam campos opcionais).

### 7.3 `groupRankingSchema` (novo) — `src/schemas/rankings.ts`
| Campo | Tipo | Notas |
|---|---|---|
| `groupId` | `nonEmptyString` | id do grupo (A–L) — doc id `grupo-{groupId}` |
| `updatedAt` | `isoDateTime` | recálculo |
| `entries` | `rankingEntrySchema[]` | ranking do grupo |

`.strict()`. Exportar tipo `GroupRanking`.

### 7.4 `poolStatsSchema` (novo) — `src/schemas/statistics.ts`
| Campo | Tipo | Notas |
|---|---|---|
| `updatedAt` | `isoDateTime` | recálculo |
| `totalParticipants` | `z.int().min(0)` | só `approved` |
| `highestPoints` | `z.int().min(0)` | maior pontuação |
| `highestPointsName` | `nonEmptyString.optional()` | nome do líder (Tela 06) |
| `lowestPoints` | `z.int().min(0)` | menor pontuação |
| `averagePoints` | `z.number().min(0)` | média geral (pode ser fracionária) |
| `totalCorrect` | `z.int().min(0)` | total de placares exatos do bolão |
| `distribution` | `z.array(distributionBucketSchema)` | faixas |

`distributionBucketSchema` (novo, mesmo arquivo):
| Campo | Tipo | Notas |
|---|---|---|
| `label` | `nonEmptyString` | ex.: `"90-100 pts"` |
| `min` | `z.int().min(0)` | limite inferior (inclusive) |
| `max` | `z.int().min(0)` | limite superior (inclusive) |
| `count` | `z.int().min(0)` | participantes na faixa |

Faixas fixas (geradas no recalc, não no schema): 0–39, 40–59, 60–79, 80–89, 90–100. Doc único: `statistics/_pool` (ou coleção dedicada — decidir na TASK-03; schema é agnóstico ao path).

### 7.5 `positionHistoryEntrySchema` (estendido) — `src/schemas/statistics.ts`
Adicionar `round` opcional p/ rótulo de evolução (Telas 02/04: "R1", "Rodada 5"):
| Campo | Tipo | Obrig. | Notas |
|---|---|---|---|
| `at` | `isoDateTime` | sim | inalterado |
| `scope` | `rankingScopeSchema` | sim | inalterado |
| `position` | `z.int().min(1)` | sim | inalterado |
| `round` | `z.int().min(1)` | **não** | nº/rótulo da execução de recalc |

### 7.6 `statisticsSchema` (estendido) — `src/schemas/statistics.ts`
Adicionar `totalWrong` opcional (Telas 02/05 mostram "Erros"):
- `totalWrong: z.int().min(0).optional()` — total de palpites errados (partidas finalizadas).
- Demais campos inalterados (`totalCorrect`, `accuracy`, `longestStreak`, `correctByStage`, `positionHistory`).
- "Melhor posição" e "média por rodada" das telas são **derivadas** de `positionHistory` + `totalCorrect` (não viram campos).

### 7.7 Tipos — `src/types/rankings.ts`
Adicionar `export type GroupRanking = z.infer<typeof groupRankingSchema>`. Tipos de pool stats podem morar em `src/types/statistics.ts` (criar reexport se necessário) ou `src/types/rankings.ts` — manter coerência com barrels.

## 8. Data and persistence impact

- Coleção `rankings`: continua doc-por-escopo. Novos docs `rankings/grupo-{groupId}`.
- Coleção `statistics`: docs `statistics/{uid}` ganham campos opcionais; doc agregado `statistics/_pool` (path final confirmado na TASK-03).
- **Sem migração destrutiva:** campos opcionais ⇒ docs antigos seguem válidos. Recalc (TASK-03) reescreve com shape completo.

## 9. Required tests

`src/schemas/__tests__/rankings.test.ts` (estender) + `statistics.test.ts` (criar/estender). Casos:
- Entry no formato **antigo** `{uid,nickname,position,points}` ainda passa (compat retroativa — caso explícito).
- Entry no formato **completo** (com `name`/`wrong`/`accuracy`) passa.
- `accuracy` fora de 0–100 rejeitado; `wrong`/`points` negativos ou não-inteiros rejeitados.
- Campo extra rejeitado (`.strict`) em entry, groupRanking, poolStats, distributionBucket.
- `groupRankingSchema`: válido com `groupId`; rejeita sem `groupId`.
- `poolStatsSchema`: válido; `distribution` vazio aceito; bucket com `count` negativo rejeitado.
- `positionHistoryEntrySchema`: válido sem `round` (compat) e com `round`.
- Inferência de tipos (`expectTypeOf`) p/ `GroupRanking` e pool stats.

## 10. Acceptance criteria

- [ ] `rankingEntrySchema` aceita formato antigo e formato completo; `name`/`wrong`/`accuracy` opcionais.
- [ ] `getGeneralRanking` (`src/services/rankings.ts`) e `useGeneralRanking` continuam compilando e passando nos testes existentes **sem alteração de runtime**.
- [ ] `groupRankingSchema`, `poolStatsSchema`, `distributionBucketSchema` criados, `.strict`, exportados nos barrels.
- [ ] `positionHistoryEntrySchema` com `round` opcional; `statisticsSchema` com `totalWrong` opcional.
- [ ] Tipos derivados exportados; `tsc` strict sem erros; sem `any`.
- [ ] Suite de schemas verde (incl. caso de compat retroativa).

## 11. UI/Screen requirement

- Requires screen: **no**
- Platform: n/a
- Screens involved: none
- Product type: n/a
- Recommended style: n/a
- Applicable UX domains: n/a

(Tarefa puramente de schema/tipos — sem saída visual.)

## 12. Constraints

- Sem `any`; TypeScript strict.
- Manter `.strict()` em todos os schemas.
- Não duplicar `points`/`correct` — `points` é a métrica única.
- Não alterar `rankingScopeSchema` (por-grupo usa doc próprio, não escopo).
- Não tocar lógica de pontuação de predictions (PRD-04 / binário) — apenas schema de ranking.
- Reexportar via barrels (`schemas/index.ts`, `types/index.ts`).

## 13. Open questions

- **OQ1:** Path do doc agregado de pool stats — `statistics/_pool` vs coleção `pool_stats/current`. Resolver na TASK-03 (não bloqueia o schema, que é agnóstico ao path).
- **OQ2:** `groupId` canônico (`"A"` vs `"group-a"`) deve casar com `match.groupId` real da API-Football. Confirmar na TASK-02/03 ao cruzar partidas. Schema só exige `nonEmptyString`.
