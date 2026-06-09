# SPEC — TASK-01: Schema da fase "dezesseis-avos"

> PRD: `ai/prd/palpites-massa.md` | Plano: `ai/plan/palpites-massa.md` | Branch: `feat/integracao-api-football`
> Tipo: domain (schema) | SP: 3 | Criticidade: high | Risco técnico: medium
> TDD recomendado: yes. Screen: no — n/a.
> Depende de: nenhuma.

---

## 1. Objetivo

Incluir o valor `"dezesseis-avos"` no enum `stageSchema` para suportar a fase de 16 avos do formato 48-seleções da Copa 2026.

A Copa 2026 tem 48 seleções e introduz uma rodada extra entre a fase de grupos e as oitavas: "Round of 32" na API-Football (16 confrontos = 32 seleções). O `stageSchema` atual em `src/schemas/shared.ts` começa em `"oitavas"` — o que causaria `ZodError` ou erro de `mapRoundToStage` ao processar fixtures dessa fase.

Escopo mínimo e cirúrgico: adicionar o valor no enum, mapear o rótulo da API-Football, adicionar o rótulo pt-BR onde os demais já existem, e **não** criar ranking próprio de 16 avos (ver §6 — decisão documentada).

---

## 2. Investigação: estado atual dos arquivos

### 2.1 `src/schemas/shared.ts` — `stageSchema`

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

Valor `"dezesseis-avos"` **ausente**. Qualquer fixture com `league.round = "Round of 32"` chega ao `mapRoundToStage` e lança `Error: Round não reconhecido`.

### 2.2 `src/schemas/shared.ts` — `rankingScopeSchema`

```ts
export const rankingScopeSchema = z.enum([
  "geral",
  "grupos",
  "oitavas",
  "quartas",
  "semifinal",
  "final",
]);
```

Já exclui `"terceiro"` (sem ranking de 3º lugar). **Decisão desta task: não incluir `"dezesseis-avos"` no `rankingScopeSchema`** — ver §6.

### 2.3 `src/schemas/statistics.ts` — `correctByStage`

```ts
correctByStage: z.partialRecord(stageSchema, z.int().min(0)),
```

Usa `stageSchema` diretamente. Ao adicionar `"dezesseis-avos"` ao enum, `correctByStage` passa a aceitar e validar esse stage automaticamente. **Sem alteração necessária no arquivo**.

### 2.4 `src/schemas/matches.ts`

```ts
stage: stageSchema,
```

Usa `stageSchema` por referência. Sem alteração necessária — expandir o enum já resolve.

### 2.5 `src/schemas/rankings.ts`

```ts
scope: rankingScopeSchema,
```

Usa `rankingScopeSchema`. Não é alterado (ver §6).

### 2.6 `src/server/mappers/matchMapper.ts` — `ROUND_TO_STAGE_MAP`

```ts
const ROUND_TO_STAGE_MAP: Record<string, Stage> = {
  "Group Stage": "grupos",
  "Round of 16": "oitavas",
  "Quarter-finals": "quartas",
  "Semi-finals": "semifinal",
  "3rd Place Final": "terceiro",
  Final: "final",
};
```

`"Round of 32"` → **ausente**. Adicionar entrada `"Round of 32": "dezesseis-avos"`.

### 2.7 `src/lib/apiFootball/mappers.ts` — `ROUND_LABEL_MAP`

```ts
const ROUND_LABEL_MAP: Readonly<Record<string, Stage>> = {
  "Round of 16": "oitavas",
  "Quarter-finals": "quartas",
  "Semi-finals": "semifinal",
  "3rd Place Final": "terceiro",
  Final: "final",
} as const;
```

Arquivo legado (pré-`matchMapper.ts`). Ainda referenciado em `src/lib/apiFootball/__tests__/mappers.test.ts`. Adicionar `"Round of 32": "dezesseis-avos"` para manter consistência.

### 2.8 Rótulos pt-BR espalhados em componentes de UI

Quatro locais usam `Record<Stage, string>` ou `Record<string, string>` com os rótulos hardcoded. Todos precisam de entrada para `"dezesseis-avos"`:

| Arquivo | Estrutura | Rótulo existente mais próximo |
|---|---|---|
| `src/features/home/components/CurrentStageCard.tsx` | `const STAGE_LABEL: Record<Stage, string>` | `oitavas: "Oitavas de Final"` |
| `src/features/matches/components/MatchDetail.tsx` | `const STAGE_LABELS: Record<Stage, string>` | `oitavas: "Oitavas de Final"` |
| `src/features/matches/components/MatchCard.tsx` | `const STAGE_LABEL: Record<string, string>` (sem tipagem exaustiva) | `oitavas: "Oitavas de Final"` |
| `src/features/matches/components/MatchFiltersSheet.tsx` | `const STAGE_OPTIONS: { value: Stage; label: string }[]` | `{ value: "oitavas", label: "Oitavas" }` |
| `src/features/matches/components/MatchListHeader.tsx` | `const STAGE_OPTIONS: { value: Stage; label: string }[]` | `{ value: "oitavas", label: "Oitavas" }` |

**Nota:** `CurrentStageCard.tsx` e `MatchDetail.tsx` usam `Record<Stage, string>` — TypeScript acusará erro de compilação após adicionar `"dezesseis-avos"` ao enum se não houver entrada correspondente. Isso é **desejável**: o compilador guia o implementador a atualizar todos os mapeamentos.

### 2.9 Testes existentes que falharão

Após adicionar `"dezesseis-avos"` ao enum, os seguintes testes verificam literalmente os valores do enum e precisarão ser atualizados:

| Arquivo | Teste | Motivo |
|---|---|---|
| `src/schemas/__tests__/shared.test.ts` | `it("stageSchema aceita as 6 fases...")` | Conta 6 fases; nova enum tem 7 |
| `src/schemas/__tests__/shared.test.ts` | `it("tipos derivados batem com os enums")` → `expectTypeOf<Stage>()...` | Union type muda |
| `src/features/home/components/__tests__/CurrentStageCard.test.tsx` | `EXPECTED_LABELS` (espelho de `STAGE_LABEL`) | Novo stage não mapeado |

Testes do mapper (`matchMapper.test.ts`, `mappers.test.ts`) precisarão de **novo caso de teste** para `"Round of 32" → dezesseis-avos` (RED → GREEN TDD).

---

## 3. Escopo

### 3.1 Dentro do escopo

| Arquivo | Ação |
|---|---|
| `src/schemas/shared.ts` | **Modificar** — adicionar `"dezesseis-avos"` em `stageSchema`; **NÃO** alterar `rankingScopeSchema` |
| `src/server/mappers/matchMapper.ts` | **Modificar** — adicionar `"Round of 32": "dezesseis-avos"` em `ROUND_TO_STAGE_MAP` |
| `src/lib/apiFootball/mappers.ts` | **Modificar** — adicionar `"Round of 32": "dezesseis-avos"` em `ROUND_LABEL_MAP` |
| `src/features/home/components/CurrentStageCard.tsx` | **Modificar** — adicionar `dezesseis-avos: "Dezesseis Avos de Final"` em `STAGE_LABEL` |
| `src/features/matches/components/MatchDetail.tsx` | **Modificar** — adicionar entrada em `STAGE_LABELS` |
| `src/features/matches/components/MatchCard.tsx` | **Modificar** — adicionar entrada em `STAGE_LABEL` local |
| `src/features/matches/components/MatchFiltersSheet.tsx` | **Modificar** — adicionar opção `{ value: "dezesseis-avos", label: "16 Avos" }` em `STAGE_OPTIONS` |
| `src/features/matches/components/MatchListHeader.tsx` | **Modificar** — idem `MatchFiltersSheet` |
| `src/schemas/__tests__/shared.test.ts` | **Modificar** — atualizar contagem + union type |
| `src/server/mappers/__tests__/matchMapper.test.ts` | **Modificar** — adicionar caso `"Round of 32" → dezesseis-avos` |
| `src/lib/apiFootball/__tests__/mappers.test.ts` | **Modificar** — adicionar caso `"Round of 32"` em `parseRound` |
| `src/features/home/components/__tests__/CurrentStageCard.test.tsx` | **Modificar** — adicionar entrada `dezesseis-avos` em `EXPECTED_LABELS` |

### 3.2 Fora do escopo

- `rankingScopeSchema` — **não alterar** (ver §6).
- `src/schemas/rankings.ts`, `src/schemas/statistics.ts` — sem alteração de schema.
- Novos componentes, hooks ou serviços.
- Qualquer tela de UI nova (essa task é puramente de schema/dados).
- `src/features/matches/components/MatchFiltersSheet.tsx` e `MatchListHeader.tsx` — a entrada é adicionada, mas a **ordem de exibição** dos filtros pode ser ajustada em task de UI posterior. Ordem recomendada nesta task: inserir `"dezesseis-avos"` entre `"grupos"` e `"oitavas"` para refletir a ordem cronológica do torneio.

---

## 4. Implementação detalhada

### 4.1 `src/schemas/shared.ts` — alteração no `stageSchema`

**Antes:**
```ts
export const stageSchema = z.enum([
  "grupos",
  "oitavas",
  "quartas",
  "semifinal",
  "terceiro",
  "final",
]);
```

**Depois:**
```ts
export const stageSchema = z.enum([
  "grupos",
  "dezesseis-avos", // 16 avos de final — formato Copa 2026 (48 seleções); API-Football: "Round of 32"
  "oitavas",
  "quartas",
  "semifinal",
  "terceiro",       // disputa do 3º lugar (API: "3rd Place Final")
  "final",
]);
```

**`rankingScopeSchema` permanece intacto** — ver §6.

### 4.2 `src/server/mappers/matchMapper.ts` — `ROUND_TO_STAGE_MAP`

Adicionar a entrada antes de `"Round of 16"`:

```ts
const ROUND_TO_STAGE_MAP: Record<string, Stage> = {
  "Group Stage": "grupos",
  "Round of 32": "dezesseis-avos", // Copa 2026: 16 avos de final
  "Round of 16": "oitavas",
  "Quarter-finals": "quartas",
  "Semi-finals": "semifinal",
  "3rd Place Final": "terceiro",
  Final: "final",
};
```

### 4.3 `src/lib/apiFootball/mappers.ts` — `ROUND_LABEL_MAP`

```ts
const ROUND_LABEL_MAP: Readonly<Record<string, Stage>> = {
  "Round of 32": "dezesseis-avos", // Copa 2026: 16 avos de final
  "Round of 16": "oitavas",
  "Quarter-finals": "quartas",
  "Semi-finals": "semifinal",
  "3rd Place Final": "terceiro",
  Final: "final",
} as const;
```

### 4.4 Rótulos pt-BR nos componentes

Rótulo canônico: **`"Dezesseis Avos de Final"`** (forma longa, para componentes que usam rótulo completo).  
Rótulo curto: **`"16 Avos"`** (para filtros com espaço limitado).

#### `CurrentStageCard.tsx`

```ts
const STAGE_LABEL: Record<Stage, string> = {
  grupos: "Fase de Grupos",
  "dezesseis-avos": "Dezesseis Avos de Final",
  oitavas: "Oitavas de Final",
  quartas: "Quartas de Final",
  semifinal: "Semifinal",
  terceiro: "Disputa do 3º Lugar",
  final: "Final",
};
```

#### `MatchDetail.tsx`

```ts
const STAGE_LABELS: Record<Stage, string> = {
  grupos: "Fase de Grupos",
  "dezesseis-avos": "Dezesseis Avos de Final",
  oitavas: "Oitavas de Final",
  quartas: "Quartas de Final",
  semifinal: "Semifinal",
  terceiro: "Disputa do 3º Lugar",
  final: "Final",
};
```

#### `MatchCard.tsx`

```ts
const STAGE_LABEL: Record<string, string> = {
  grupos: "Fase de Grupos",
  "dezesseis-avos": "Dezesseis Avos de Final",
  oitavas: "Oitavas de Final",
  quartas: "Quartas de Final",
  semifinal: "Semifinal",
  terceiro: "Disputa do 3º Lugar",
  final: "Final",
};
```

#### `MatchFiltersSheet.tsx`

```ts
const STAGE_OPTIONS: { value: Stage; label: string }[] = [
  { value: "grupos", label: "Fase de Grupos" },
  { value: "dezesseis-avos", label: "16 Avos" },
  { value: "oitavas", label: "Oitavas" },
  { value: "quartas", label: "Quartas" },
  { value: "semifinal", label: "Semifinal" },
  { value: "terceiro", label: "3º Lugar" },
  { value: "final", label: "Final" },
];
```

#### `MatchListHeader.tsx`

Idem `MatchFiltersSheet.tsx` — mesma estrutura `STAGE_OPTIONS`, mesma entrada.

### 4.5 Tipo derivado `Stage` em `src/types/shared.ts`

O arquivo `src/types/shared.ts` usa `z.infer<typeof stageSchema>` — **sem alteração necessária**. O tipo TypeScript `Stage` é derivado automaticamente ao mudar o enum.

---

## 5. Testes (TDD — RED → GREEN)

### 5.1 Ordem de execução TDD

1. **RED:** Escrever/atualizar testes que falham com o estado atual.
2. **GREEN:** Fazer as mínimas mudanças no código para os testes passarem.
3. **REFACTOR:** Limpar duplicações, se houver.

### 5.2 `src/schemas/__tests__/shared.test.ts` — atualizações

#### Teste: `stageSchema aceita as N fases e rejeita fora do enum`

```ts
it("stageSchema aceita as 7 fases e rejeita fora do enum", () => {
  for (const s of [
    "grupos",
    "dezesseis-avos",
    "oitavas",
    "quartas",
    "semifinal",
    "terceiro",
    "final",
  ]) {
    expect(stageSchema.safeParse(s).success).toBe(true);
  }
  expect(stageSchema.safeParse("terceiro_lugar").success).toBe(false);
  expect(stageSchema.safeParse("geral").success).toBe(false);
  expect(stageSchema.safeParse("round-of-32").success).toBe(false); // slug inválido
});
```

#### Teste: `tipos derivados batem com os enums`

```ts
expectTypeOf<Stage>().toEqualTypeOf<
  | "grupos"
  | "dezesseis-avos"
  | "oitavas"
  | "quartas"
  | "semifinal"
  | "terceiro"
  | "final"
>();
```

#### Teste: `rankingScopeSchema NÃO inclui dezesseis-avos`

Adicionar asserção explícita documentando a decisão:

```ts
it("rankingScopeSchema não inclui dezesseis-avos (sem ranking de 16 avos)", () => {
  expect(rankingScopeSchema.safeParse("dezesseis-avos").success).toBe(false);
});
```

### 5.3 `src/server/mappers/__tests__/matchMapper.test.ts` — novo caso

Adicionar fixture `fixtureDezsseisAvos` em `fixtures/apiFixtureFixtures.ts` (seguindo o padrão das demais, com `league.round = "Round of 32"`) e o teste:

```ts
it("M-NOVO: round 'Round of 32' mapeia para stage dezesseis-avos", () => {
  const r = mapApiFixtureToFirestore(fixtureDezesseisAvos, TEST_TEAM_ID_MAP);
  expect(r.stage).toBe("dezesseis-avos");
  expect(r.round).toBeNull();   // fase única, sem número de rodada
  expect(r.groupId).toBeNull(); // não é fase de grupos
});
```

Também adicionar teste unitário de `mapRoundToStage`:

```ts
it("mapRoundToStage: 'Round of 32' → dezesseis-avos", () => {
  expect(mapRoundToStage("Round of 32")).toBe("dezesseis-avos");
});
```

### 5.4 `src/lib/apiFootball/__tests__/mappers.test.ts` — novo caso

```ts
it('"Round of 32" → dezesseis-avos, round null, groupId null', () => {
  expect(parseRound("Round of 32")).toEqual({
    stage: "dezesseis-avos",
    round: null,
    groupId: null,
  });
});
```

### 5.5 `src/features/home/components/__tests__/CurrentStageCard.test.tsx` — atualização

Adicionar ao `EXPECTED_LABELS`:

```ts
const EXPECTED_LABELS: Record<string, string> = {
  grupos: "Fase de Grupos",
  "dezesseis-avos": "Dezesseis Avos de Final",
  oitavas: "Oitavas de Final",
  quartas: "Quartas de Final",
  semifinal: "Semifinal",
  terceiro: "Disputa do 3º Lugar",
  final: "Final",
};
```

---

## 6. Decisão: `rankingScopeSchema` — sem `"dezesseis-avos"`

**Decisão: NÃO adicionar `"dezesseis-avos"` ao `rankingScopeSchema`.**

**Racional:**
- O PRD (`ai/prd/palpites-massa.md`) lista rankings por fase nos PRDs PRD-02/04. O plan não menciona ranking de 16 avos como requisito.
- O padrão existente já exclui `"terceiro"` do `rankingScopeSchema` (jogo único sem fase ranqueada própria). A mesma lógica se aplica à fase de 16 avos: os usuários acompanham o progresso pelo ranking geral, não por fase específica.
- Adicionar `"dezesseis-avos"` ao `rankingScopeSchema` criaria a expectativa de um ranking de fase que não tem Cloud Function de cálculo, não tem tela de exibição e não consta em nenhum PRD.
- **Quando reverter:** se um PRD futuro incluir ranking de 16 avos, adicionar na hora com a respectiva tela e Cloud Function. Adicionar agora seria YAGNI.

**Documentação no código:** Comentário acima de `rankingScopeSchema` em `shared.ts`:

```ts
// Escopo de ranking: "geral" + as 5 fases de ranking.
// Exclui "terceiro" (disputa do 3º lugar, jogo único sem ranking próprio)
// e "dezesseis-avos" (Copa 2026 — sem ranking de fase previsto no PRD).
export const rankingScopeSchema = z.enum([
  "geral",
  "grupos",
  "oitavas",
  "quartas",
  "semifinal",
  "final",
]);
```

---

## 7. Arquivos afetados (resumo)

| Arquivo | Ação | Criticidade da mudança |
|---|---|---|
| `src/schemas/shared.ts` | Adicionar `"dezesseis-avos"` em `stageSchema`; atualizar comentário de `rankingScopeSchema` | Alta |
| `src/server/mappers/matchMapper.ts` | Adicionar `"Round of 32": "dezesseis-avos"` em `ROUND_TO_STAGE_MAP` | Alta |
| `src/lib/apiFootball/mappers.ts` | Adicionar `"Round of 32": "dezesseis-avos"` em `ROUND_LABEL_MAP` | Média |
| `src/features/home/components/CurrentStageCard.tsx` | Adicionar `"dezesseis-avos"` em `STAGE_LABEL` | Média (TypeScript força) |
| `src/features/matches/components/MatchDetail.tsx` | Adicionar `"dezesseis-avos"` em `STAGE_LABELS` | Média (TypeScript força) |
| `src/features/matches/components/MatchCard.tsx` | Adicionar `"dezesseis-avos"` em `STAGE_LABEL` | Baixa (sem tipagem exaustiva) |
| `src/features/matches/components/MatchFiltersSheet.tsx` | Adicionar opção `"dezesseis-avos"` em `STAGE_OPTIONS` | Baixa |
| `src/features/matches/components/MatchListHeader.tsx` | Adicionar opção `"dezesseis-avos"` em `STAGE_OPTIONS` | Baixa |
| `src/schemas/__tests__/shared.test.ts` | Atualizar contagem de fases e union type | Média |
| `src/server/mappers/__tests__/matchMapper.test.ts` | Novo caso `"Round of 32"` + fixture | Média |
| `src/lib/apiFootball/__tests__/mappers.test.ts` | Novo caso `parseRound("Round of 32")` | Baixa |
| `src/features/home/components/__tests__/CurrentStageCard.test.tsx` | Adicionar `"dezesseis-avos"` em `EXPECTED_LABELS` | Baixa |

---

## 8. Contrato de imports

Nenhum novo import é introduzido — todos os arquivos já importam de `@/schemas/shared` (via barrel `@/schemas`) ou de `@/types/shared`. O tipo `Stage` é derivado automaticamente via `z.infer`.

**Proibições:**
- Sem `any`.
- Sem estilos inline `style={{}}`.
- Sem valores hexadecimais.
- Não alterar `rankingScopeSchema`.
- Não criar arquivos novos além de fixture de teste.

---

## 9. Critérios de aceitação

- [ ] `stageSchema.safeParse("dezesseis-avos").success === true`.
- [ ] `stageSchema.safeParse("round-of-32").success === false` (slug inválido rejeitado).
- [ ] `rankingScopeSchema.safeParse("dezesseis-avos").success === false` (não adicionado ao ranking scope).
- [ ] `mapRoundToStage("Round of 32")` retorna `"dezesseis-avos"` (sem lançar Error).
- [ ] `parseRound("Round of 32")` retorna `{ stage: "dezesseis-avos", round: null, groupId: null }`.
- [ ] `mapApiFixtureToFirestore(fixtureDezesseisAvos, ...)` produz `stage: "dezesseis-avos"`, `round: null`, `groupId: null`.
- [ ] `matchSchema.parse({ ...validMatch, stage: "dezesseis-avos" })` não lança ZodError.
- [ ] `statisticsSchema.parse({ ..., correctByStage: { "dezesseis-avos": 3 } })` não lança ZodError.
- [ ] `CurrentStageCard.tsx` exibe `"Dezesseis Avos de Final"` quando `stage === "dezesseis-avos"`.
- [ ] `MatchDetail.tsx`, `MatchCard.tsx` exibem o rótulo correto.
- [ ] `MatchFiltersSheet.tsx` e `MatchListHeader.tsx` incluem opção `"dezesseis-avos"` com label `"16 Avos"`.
- [ ] `rtk tsc` sem erros após implementação (TypeScript strict).
- [ ] Todos os testes listados em §5 passando (RED → GREEN confirmado).
- [ ] Sem regressão nos testes existentes.

---

## 10. O que esta tarefa NÃO faz

- Não cria telas de UI para a fase de 16 avos (TASK-07 a TASK-14).
- Não cria ranking de 16 avos (decisão documentada em §6).
- Não implementa lógica de classificação ou seeding de 16 avos (TASK-02/03).
- Não cria endpoint batch (TASK-04).
- Não altera `predictionSchema`, `groupSchema`, `teamSchema` ou `bonusPredictionSchema`.
- Não altera Security Rules ou Cloud Functions.
- Não cria fixture de teste de integração contra a API-Football real.
