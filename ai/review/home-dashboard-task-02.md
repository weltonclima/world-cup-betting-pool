# Review — Home Dashboard TASK-02: Mapeadores API-Football → Domínio

**Data:** 2026-06-07
**Commit:** 69d00c6 (`feat(lib): mapeadores API-Football -> dominio (TASK-02)`)
**Branch:** feat/prd-01-auth
**Revisor:** Staff Engineer (adversarial)
**Profundidade:** deep — correctness vs contrato PRD Apêndice A, type safety, edge cases, cobertura de testes
**Veredicto:** `aprovado`

---

## Escopo revisado

| Arquivo | Tipo | Linhas |
|---|---|---|
| `src/lib/apiFootball/mappers.ts` | Implementação (novo) | 120 |
| `src/lib/apiFootball/index.ts` | Barrel (novo) | 5 |
| `src/lib/apiFootball/__tests__/mappers.test.ts` | Testes (novo) | 216 |

**Referências consultadas:**
- `ai/prd/home-dashboard.md` §7b + Apêndice A (contrato de mapeamento)
- `ai/plan/home-dashboard.md` §3 TASK-02
- `src/schemas/shared.ts` (fonte de verdade dos enums de domínio)
- `src/types/shared.ts` (tipos derivados)
- `tsconfig.json` (flags strict)

---

## Análise de correctude vs Apêndice A

### Mapa `status.short` → `matchStatusSchema`

O PRD Apêndice A define o contrato:
`NS,TBD`→`scheduled` · `1H,HT,2H,ET,BT,P,LIVE,SUSP,INT`→`live` · `FT,AET,PEN`→`finished` · `PST`→`postponed` · `CANC,ABD,WO,AWD`→`canceled`

Total: **19 códigos**.

Contagem em `STATUS_MAP`: NS, TBD (2) + 1H, HT, 2H, ET, BT, P, LIVE, SUSP, INT (9) + FT, AET, PEN (3) + PST (1) + CANC, ABD, WO, AWD (4) = **19 códigos**. Mapeamento exato com o Apêndice A. ✓

> Nota documental: o plan (TASK-02) menciona "16 status" e o commit message replica "16 codigos". Trata-se de imprecisão nos textos de documentação — o PRD Apêndice A é a fonte autoritativa e lista 19 códigos, correspondendo exatamente à implementação. Sem impacto funcional.

### Mapa `league.round` → `stageSchema`

O PRD Apêndice A define:
`Group Stage`→`grupos` · `Round of 16`→`oitavas` · `Quarter-finals`→`quartas` · `Semi-finals`→`semifinal` · `3rd Place Final`→`terceiro` · `Final`→`final`

Implementação:
- `GROUP_STAGE_REGEX = /^Group Stage - (\d+)$/` captura "Group Stage - N" → `stage:"grupos"`, `round:N`. Correto — o valor real da API é "Group Stage - 2", não "Group Stage" puro. ✓
- `ROUND_LABEL_MAP` contém exatamente os 5 rótulos de mata-mata com os mapeamentos corretos. ✓
- `"3rd Place Final"` → `"terceiro"` está presente e correto (critério mais crítico do Apêndice A — stage novo). ✓

---

## Análise de type safety

**`noUncheckedIndexedAccess: true`** ativo no `tsconfig.json`.

Com esse flag, `STATUS_MAP[short]` retorna `MatchStatus | undefined` (não apenas `MatchStatus`). O guard `if (status === undefined)` é portanto necessário e correto. O TypeScript confirma — `tsc --noEmit` sai com exit 0. ✓

Mesmo raciocínio para `ROUND_LABEL_MAP[leagueRound]` → `Stage | undefined`. Guard `if (stage !== undefined)` correto. ✓

A notação `groupMatch[1] ?? ""` em `parseRound` é necessária porque `RegExpExecArray[number]` tem tipo `string | undefined` no TypeScript mesmo quando o grupo de captura sempre participa do match. A operação `??` é um acerto — parseInt de string vazia retorna NaN, mas o guard `round < 1` não capturaria NaN (NaN < 1 é false). Na prática, `groupMatch[1]` nunca é `undefined` quando o regex com `(\d+)` faz match, mas a presença do `??` é a solução correta para satisfazer o strict type system. ✓

**Sem `any` em nenhum dos três arquivos.** ✓

---

## Análise de lógica de borda

### `parseRound` — guard de round < 1

- `"Group Stage - 0"` → regex captura "0" → `parseInt("0", 10) = 0` → `0 < 1` → `TypeError`. Correto. ✓
- `"Group Stage - 48"` (máximo Copa 2026 com 48 seleções) → round 48 retornado. Sem upper-bound guard — não requerido pelo spec (o spec define somente `≥ 1`). Comportamento aceitável. ✓
- String com lowercase ("group stage - 1") → não faz match no regex (case-sensitive) → não está no `ROUND_LABEL_MAP` → lança `TypeError`. Correto para entrada inválida. ✓
- String com espaços extras ("  Group Stage - 1  ") → não faz match (âncoras `^$`) → lança `TypeError`. Correto. ✓
- `mapMatchStatus("ns")` (lowercase) → não está no `STATUS_MAP` → lança `TypeError`. Correto e testado. ✓
- String vazia em ambas as funções → lança `TypeError`. Correto e testado. ✓

### Pureza das funções

Ambas as funções são puras: sem I/O, sem efeitos colaterais, sem estado mutável. As lookup tables são `const ... as const` e `Readonly<>`. A `GROUP_STAGE_REGEX` é constante de módulo. ✓

---

## Análise de cobertura de testes

### `mapMatchStatus` — 23 casos

| Categoria | Códigos testados | Count |
|---|---|---|
| scheduled | NS, TBD | 2/2 ✓ |
| live | 1H, HT, 2H, ET, BT, P, LIVE, SUSP, INT | 9/9 ✓ |
| finished | FT, AET, PEN | 3/3 ✓ |
| postponed | PST | 1/1 ✓ |
| canceled | CANC, ABD, WO, AWD | 4/4 ✓ |
| erros | código desconhecido, lowercase, string vazia | 3 ✓ |
| tipo | `expectTypeOf` → `MatchStatus` | 1 ✓ |

**Total: 23 testes. Todos os 19 códigos do Apêndice A cobertos individualmente.** ✓

### `parseRound` — 12 casos

| Categoria | Valores testados | Count |
|---|---|---|
| fase de grupos | "Group Stage - 1", "Group Stage - 2", "Group Stage - 48" | 3 ✓ |
| mata-mata | Round of 16, Quarter-finals, Semi-finals, 3rd Place Final, Final | 5/5 ✓ |
| erros | string desconhecida, string vazia, "Group Stage - 0" | 3 ✓ |
| tipo | `expectTypeOf` → `ParsedRound` | 1 ✓ |

**Total: 12 testes. Todos os labels do Apêndice A cobertos.** ✓

**Total geral: 35 testes — todos passando (verificado com `node_modules/.bin/vitest run`).** ✓

---

## Análise de arquitetura e maintainability

- **Lookup tables imutáveis:** escolha correta — evita duplicação de string literals da API, concentra o contrato em um único local por função, facilita auditoria futura. ✓
- **Barrel `index.ts`:** exporta apenas a superfície pública (2 funções + 1 tipo). Internos (constantes, regex) não vazam. ✓
- **JSDoc:** presente em todas as exportações públicas com `@param`, `@returns`, `@throws`. ✓
- **Comentários inline:** seções com separadores visuais e labels descritivos. ✓
- **Naming:** `mapMatchStatus` / `parseRound` seguem convenção verbo-substantivo; `STATUS_MAP` / `ROUND_LABEL_MAP` / `GROUP_STAGE_REGEX` seguem convenção SCREAMING_SNAKE_CASE para constantes de módulo. ✓
- **`ParsedRound.groupId`:** sempre `null` neste parser (correto — vem de `standings[].group`, não de `league.round`). Campo incluído para compatibilidade de shape com `matchSchema`. A decisão está documentada no JSDoc. ✓
- **Reusabilidade:** módulo declarado como reaproveitável pelo script de ingestão Node + Admin SDK (sem dependências de runtime do browser). Pureza e ausência de I/O garantem isso. ✓

---

## Verificações de toolchain

```
node_modules/.bin/vitest run src/lib/apiFootball/__tests__/mappers.test.ts
  Test Files  1 passed (1)
       Tests  35 passed (35)
    Duration  404ms

node_modules/.bin/tsc --noEmit --pretty false
  EXIT_CODE=0
```

---

## Achados

Nenhum BLOCKER. Nenhum WARNING de substância.

**Observação documental (sem classificação — sem impacto funcional):**
O commit message e o plan dizem "16 codigos/status" mas o PRD Apêndice A e a implementação listam corretamente 19. Não é um defeito de código. Seria desejável corrigir o plan, mas está fora do escopo desta tarefa.

---

## Veredicto final

**`aprovado`**

A implementação cumpre integralmente o contrato do Apêndice A: todos os 19 códigos de status mapeados corretamente, todos os 5 labels de mata-mata mais o regex de fase de grupos implementados corretamente, `"3rd Place Final"→"terceiro"` presente, throw em entrada desconhecida como estratégia de falha ruidosa, funções puras sem I/O, sem `any`, sem string literals dispersas, `noUncheckedIndexedAccess` tratado corretamente, 35 testes cobrindo cada código e cada label individualmente, TypeScript strict passa sem erros.
