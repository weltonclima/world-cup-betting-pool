# SPEC — TASK-01 · Alinhar schemas à API-Football (PRD-02)

> Origem: `ai/plan/home-dashboard.md` §3 TASK-01 · PRD: `ai/prd/home-dashboard.md` §7b/Apêndice A
> Tipo: persistence (schema) · SP: 2 · Criticality: high · Risk: medium · TDD: yes · Screen: no

## 1. Objetivo

Alinhar os schemas Zod às estruturas reais da API-Football v3 que o script de seed/ingestão gravará no Firestore. Duas mudanças de schema, tipos derivados automáticos e ajustes de testes.

### Mudanças em resumo

| Arquivo | O que muda |
|---------|------------|
| `src/schemas/shared.ts` | `stageSchema` ganha valor `"terceiro"` |
| `src/schemas/matches.ts` | Adiciona `venueSchema` (objeto aninhado) e campo `round` |
| `src/schemas/__tests__/shared.test.ts` | Atualiza assertions de `stageSchema` e inferência de `Stage` |
| `src/schemas/__tests__/matches.test.ts` | Atualiza fixtures base (`scheduled`/`finished`); adiciona casos `venue`/`round`; corrige assertion de inferência de `Match["stage"]` |

Arquivos que **não mudam** (tipos derivam automaticamente por `z.infer`):
- `src/types/shared.ts` — `Stage` passa a incluir `"terceiro"` sem toque manual
- `src/types/matches.ts` — `Match` absorve `venue` e `round` automaticamente
- `src/schemas/statistics.ts` — `correctByStage` usa `z.partialRecord(stageSchema, ...)` → aceita a nova chave `"terceiro"` sem alteração
- `src/schemas/__tests__/statistics.test.ts` — **nenhum ajuste necessário**: testes existentes usam `correctByStage: { grupos: 8 }` (parcial) e não enumeravam o conjunto completo de estágios válidos

## 2. Decisões de design

### 2.1 `venue`: nullable + optional

`venue` é derivado de `fixture.venue.name`/`.city` da API. Em jogos cujo local ainda não está definido (TBD) ou cancelados, a API pode retornar `null` ou omitir o campo. Para não bloquear o refinement de placar (que opera apenas em `status`/`homeScore`/`awayScore`), `venue` é declarado como `.nullable().optional()`.

```
venue?: { name: string; city: string } | null
```

Isso cobre: campo presente com valor, campo `null` (TBD), e campo ausente. O objeto interno **não** é nullable individualmente — se `venue` está presente e não é `null`, ambos `name` e `city` são não-vazios.

### 2.2 `round`: nullable + optional, inteiro ≥ 1

`round` vem do parse de `league.round` (ex.: `"Group Stage - 2"` → `2`). Em jogos de rodada única (Final, 3rd Place Final) a API retorna o nome sem número explicitamente parseável; o script de seed pode gravar `null` nesses casos. Para fases de grupos/mata-mata com rodada definida, `round` é inteiro ≥ 1.

```
round?: number | null  // inteiro ≥ 1 quando presente e não-null
```

Modelo: `z.int().min(1).nullable().optional()`.

### 2.3 `.strict()` mantido

Ambos os schemas (`venueSchema` interno e `matchSchema`) permanecem com `.strict()`. O `venueSchema` interno é um objeto `.strict()` próprio; `matchSchema` já é `.strict()` e continua — os campos novos são adicionados dentro do `.object({})` antes do `.strict()`.

### 2.4 `rankingScopeSchema` NÃO recebe `"terceiro"`

O ranking do bolão não tem escopo de 3º lugar. `rankingScopeSchema` permanece com os valores atuais: `["geral","grupos","oitavas","quartas","semifinal","final"]`. A adição de `"terceiro"` é **exclusiva** de `stageSchema`.

### 2.5 `statistics.correctByStage` aceita `"terceiro"` automaticamente

O campo usa `z.partialRecord(stageSchema, z.int().min(0))`. Como `stageSchema` é a fonte de verdade, o novo valor `"terceiro"` passa a ser uma chave válida em `correctByStage` sem nenhuma alteração em `statistics.ts`. Efeito aceitável (conforme PRD §TASK-01 "acceptable").

### 2.6 Refinement de placar não é tocado

O refinement existente opera sobre `{ status, homeScore, awayScore }` — nenhum dos campos novos (`venue`, `round`) é referenciado. O comportamento atual é preservado integralmente.

## 3. Arquivos e mudanças detalhadas

### 3.1 `src/schemas/shared.ts` — adicionar `"terceiro"` ao `stageSchema`

Localizar:

```ts
export const stageSchema = z.enum([
  "grupos",
  "oitavas",
  "quartas",
  "semifinal",
  "final",
]);
```

Substituir por:

```ts
export const stageSchema = z.enum([
  "grupos",
  "oitavas",
  "quartas",
  "semifinal",
  "terceiro", // disputa do 3º lugar (API: "3rd Place Final")
  "final",
]);
```

> Ordem: `"terceiro"` entre `"semifinal"` e `"final"` (cronológica no torneio).

### 3.2 `src/schemas/matches.ts` — adicionar `venueSchema` e campo `round`

```ts
import { z } from "zod";

import {
  isoDateTime,
  matchStatusSchema,
  nonEmptyString,
  scoreSchema,
  stageSchema,
} from "@/schemas/shared";

// Estádio do jogo (origem: fixture.venue da API-Football).
// Nullable/optional: pode ser TBD em jogos ainda não confirmados.
const venueSchema = z
  .object({
    name: nonEmptyString, // nome do estádio
    city: nonEmptyString, // cidade
  })
  .strict();

// Coleção `matches` (partidas).
// Refinement (assumido): placares são `null` enquanto a partida não está finalizada;
// quando `status === "finished"`, ambos os placares devem ser inteiros ≥ 0.
export const matchSchema = z
  .object({
    homeTeamId: nonEmptyString,                      // seleção mandante
    awayTeamId: nonEmptyString,                      // seleção visitante
    kickoffAt: isoDateTime,                          // data/hora do jogo
    stage: stageSchema,                              // fase do torneio
    round: z.int().min(1).nullable().optional(),     // número da rodada (ex.: 2 em "Group Stage - 2"); null em fases únicas
    groupId: nonEmptyString.nullable().optional(),   // (assumido) só na fase de grupos
    venue: venueSchema.nullable().optional(),        // estádio; null/ausente quando TBD
    status: matchStatusSchema,                       // situação
    homeScore: scoreSchema.nullable(),               // (assumido) null enquanto não finalizado
    awayScore: scoreSchema.nullable(),               // (assumido) null enquanto não finalizado
  })
  .strict()
  .refine(
    (match) => {
      const { status, homeScore, awayScore } = match;
      const ambosNumeros = homeScore !== null && awayScore !== null;
      const ambosNulos = homeScore === null && awayScore === null;

      if (status === "finished") {
        // Finalizada → ambos os placares devem estar presentes.
        return ambosNumeros;
      }
      if (status === "live") {
        // Em andamento → placares parciais permitidos (ambos presentes) ou ainda null (início do tempo).
        // Placar assimétrico (um null, outro não) nunca é válido.
        return ambosNumeros || ambosNulos;
      }
      // scheduled, postponed, canceled → nenhum placar (ambos null).
      return ambosNulos;
    },
    {
      message:
        "Placares: obrigatórios quando 'finished'; permitidos (ambos) ou null quando 'live'; null obrigatório para 'scheduled', 'postponed' e 'canceled'.",
      path: ["homeScore"],
    },
  );
```

**Campos novos adicionados antes de `status` na lista de propriedades** (posição sugerida — qualquer ordem funciona com Zod, mas manter agrupamento lógico: metadados do jogo juntos):
- `round` — após `stage` (mesma "dimensão" de classificação)
- `venue` — após `groupId` (agrupamento de contexto geográfico/torneio)

### 3.3 `src/schemas/__tests__/shared.test.ts` — dois ajustes

#### Ajuste 1 — caso do `stageSchema` (aceitar as 6 fases)

Localizar:

```ts
it("stageSchema aceita as 5 fases e rejeita fora do enum", () => {
  for (const s of ["grupos", "oitavas", "quartas", "semifinal", "final"]) {
    expect(stageSchema.safeParse(s).success).toBe(true);
  }
  expect(stageSchema.safeParse("terceiro_lugar").success).toBe(false);
  expect(stageSchema.safeParse("geral").success).toBe(false);
});
```

Substituir por:

```ts
it("stageSchema aceita as 6 fases e rejeita fora do enum", () => {
  for (const s of ["grupos", "oitavas", "quartas", "semifinal", "terceiro", "final"]) {
    expect(stageSchema.safeParse(s).success).toBe(true);
  }
  expect(stageSchema.safeParse("terceiro_lugar").success).toBe(false);
  expect(stageSchema.safeParse("geral").success).toBe(false);
});
```

> Nota: o assert `"terceiro_lugar"` é rejeitado permanece — é um valor inválido distinto de `"terceiro"`.

#### Ajuste 2 — inferência de tipo `Stage` no describe de inferência

Localizar:

```ts
expectTypeOf<Stage>().toEqualTypeOf<
  "grupos" | "oitavas" | "quartas" | "semifinal" | "final"
>();
```

Substituir por:

```ts
expectTypeOf<Stage>().toEqualTypeOf<
  "grupos" | "oitavas" | "quartas" | "semifinal" | "terceiro" | "final"
>();
```

### 3.4 `src/schemas/__tests__/matches.test.ts` — quatro ajustes

#### Ajuste 1 — fixtures base: adicionar campos obrigatórios ausentes

As fixtures `scheduled` e `finished` usadas em todos os testes existentes não terão `venue` nem `round` (ambos `optional`) — o schema aceita ausência desses campos. **Nenhuma alteração nas fixtures base é obrigatória** para os testes atuais continuarem passando.

Contudo, a fixture `scheduled` e `finished` devem continuar funcionando com o schema `.strict()` após a adição dos novos campos opcionais. Como `.strict()` rejeita campos desconhecidos mas não exige opcionais, as fixtures existentes passam inalteradas.

#### Ajuste 2 — corrigir assertion de inferência de `Match["stage"]`

Localizar:

```ts
it("inferência de tipo", () => {
  expectTypeOf<Match["stage"]>().toEqualTypeOf<
    "grupos" | "oitavas" | "quartas" | "semifinal" | "final"
  >();
  expectTypeOf<Match["homeScore"]>().toEqualTypeOf<number | null>();
});
```

Substituir por:

```ts
it("inferência de tipo", () => {
  expectTypeOf<Match["stage"]>().toEqualTypeOf<
    "grupos" | "oitavas" | "quartas" | "semifinal" | "terceiro" | "final"
  >();
  expectTypeOf<Match["homeScore"]>().toEqualTypeOf<number | null>();
  expectTypeOf<Match["round"]>().toEqualTypeOf<number | null | undefined>();
  expectTypeOf<Match["venue"]>().toEqualTypeOf<
    { name: string; city: string } | null | undefined
  >();
});
```

#### Ajuste 3 — caso: rejeita stage `"terceiro_lugar"` (já existe, permanece)

O teste `it("rejeita stage fora do enum", ...)` usa `stage: "terceiro_lugar"` — valor inválido mesmo após a mudança. **Nenhum ajuste** neste caso.

#### Ajuste 4 — novos casos de teste para `venue` e `round`

Adicionar ao describe `"matches"`:

```ts
it("aceita venue presente (name + city)", () => {
  expect(
    matchSchema.safeParse({
      ...scheduled,
      venue: { name: "Estádio Nacional", city: "Brasília" },
    }).success,
  ).toBe(true);
});

it("aceita venue null (TBD)", () => {
  expect(
    matchSchema.safeParse({ ...scheduled, venue: null }).success,
  ).toBe(true);
});

it("aceita venue ausente (campo omitido)", () => {
  // scheduled já não tem venue → passa pelo optional
  expect(matchSchema.safeParse(scheduled).success).toBe(true);
});

it("rejeita venue com name vazio", () => {
  expect(
    matchSchema.safeParse({
      ...scheduled,
      venue: { name: "", city: "São Paulo" },
    }).success,
  ).toBe(false);
});

it("rejeita venue com campo extra (.strict interno)", () => {
  expect(
    matchSchema.safeParse({
      ...scheduled,
      venue: { name: "Maracanã", city: "Rio de Janeiro", country: "Brasil" },
    }).success,
  ).toBe(false);
});

it("aceita round presente (inteiro ≥ 1)", () => {
  expect(
    matchSchema.safeParse({ ...scheduled, round: 2 }).success,
  ).toBe(true);
});

it("aceita round null (fase sem número, ex.: Final)", () => {
  expect(
    matchSchema.safeParse({ ...finished, stage: "final", round: null }).success,
  ).toBe(true);
});

it("aceita round ausente (campo omitido)", () => {
  // scheduled já não tem round → passes pelo optional
  expect(matchSchema.safeParse(scheduled).success).toBe(true);
});

it("rejeita round 0 (< 1)", () => {
  expect(
    matchSchema.safeParse({ ...scheduled, round: 0 }).success,
  ).toBe(false);
});

it("rejeita round fracionário", () => {
  expect(
    matchSchema.safeParse({ ...scheduled, round: 1.5 }).success,
  ).toBe(false);
});

it("aceita stage 'terceiro' (disputa 3º lugar)", () => {
  expect(
    matchSchema.safeParse({
      ...finished,
      stage: "terceiro",
      groupId: null,
    }).success,
  ).toBe(true);
});
```

## 4. Impacto em arquivos dependentes (sem alteração necessária)

| Arquivo | Impacto | Ação |
|---------|---------|------|
| `src/types/shared.ts` | `Stage` passa a incluir `"terceiro"` via `z.infer` | Nenhuma — automático |
| `src/types/matches.ts` | `Match` absorve `venue` e `round` via `z.infer` | Nenhuma — automático |
| `src/schemas/statistics.ts` | `correctByStage: z.partialRecord(stageSchema, ...)` aceita `"terceiro"` | Nenhuma — automático |
| `src/schemas/__tests__/statistics.test.ts` | Testes usam `correctByStage` parcial; não enumeravam estágios válidos | Nenhuma — continua passando |
| Outros schemas (`predictions`, `rankings`, `teams`, `groups`, `users`, `bonusPredictions`, `systemSettings`) | Não referenciam `stageSchema` diretamente ou não são afetados | Nenhuma |

## 5. Restrições do projeto (obrigatórias)

- TypeScript strict, **sem `any`** — `venueSchema` e campo `round` têm tipos explícitos derivados de Zod.
- **Sem estilos inline** — não aplicável (task de schema puro).
- **Sem hardcode de dados** — valores em constantes Zod; rótulos pt-BR ficam na UI (não aqui).
- Todo schema usa Zod como **fonte única de verdade**; tipos em `src/types/` derivam de `z.infer` (sem duplicação manual).
- `.strict()` mantido em `matchSchema` e no `venueSchema` interno.
- Refinement de placar não é alterado — campos novos estão fora de seu escopo.

## 6. Critérios de aceite

1. `src/schemas/shared.ts`: `stageSchema` contém exatamente os valores `["grupos","oitavas","quartas","semifinal","terceiro","final"]`.
2. `src/schemas/shared.ts`: `rankingScopeSchema` permanece inalterado (`["geral","grupos","oitavas","quartas","semifinal","final"]`).
3. `src/schemas/matches.ts`: `matchSchema` aceita um objeto com `venue: { name, city }` presente, `null` e ausente; `round` inteiro ≥ 1, `null` e ausente.
4. `matchSchema` **rejeita**: `venue` com `name` vazio; `venue` com campo extra; `round: 0`; `round: 1.5`.
5. `matchSchema` aceita `stage: "terceiro"` (jogo de 3º lugar finalizado com placares).
6. O refinement de placar permanece íntegro: todos os testes existentes de `scheduled`/`finished`/`live`/`postponed`/`canceled` continuam passando.
7. `.strict()` em `matchSchema` rejeita campo extra no raiz (teste existente permanece verde).
8. `src/types/shared.ts`: `Stage` (via `z.infer`) inclui `"terceiro"` sem alteração manual do arquivo.
9. `src/types/matches.ts`: `Match["venue"]` e `Match["round"]` são inferidos corretamente (testes de `expectTypeOf` verdes).
10. Suíte completa verde: `rtk vitest run` sem falhas em `src/schemas/__tests__/`.
11. `rtk tsc` sem erros novos.

## 7. Plano de teste (TDD — conforme recomendação do plano)

Ordem de execução sugerida para TDD:

1. **Red** — escrever casos novos em `matches.test.ts` (venue/round/terceiro) e ajustar assertions de inferência; rodar: falham (campos ausentes do schema).
2. **Green** — aplicar mudanças em `shared.ts` (adicionar `"terceiro"`) e `matches.ts` (adicionar `venueSchema` + campos); rodar: novos casos passam.
3. **Refactor** — ajustar `shared.test.ts` (enumeração das 6 fases + inferência de `Stage`); verificar que **nenhum** teste existente regrediu.
4. Rodar `rtk vitest run` para a suíte completa de schemas.
5. Rodar `rtk tsc` para garantir que inferências de tipo compilam.

> Caso a suíte de `statistics.test.ts` falhe inesperadamente (regressão), investigar se o `z.partialRecord` com a chave nova introduziu incompatibilidade (não esperado, mas verificar).
