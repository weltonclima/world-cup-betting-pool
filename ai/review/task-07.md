# Review — TASK-07: Modelo de dados Firestore (tipos + schemas Zod)

> Revisor: Staff Engineer (adversarial)
> Data: 2026-06-05
> Veredicto: **APROVADO COM AJUSTES**

---

## Sumário Executivo

A implementação entrega o contrato completo da TASK-07: 9 coleções com schemas Zod 4 corretos, tipos derivados exclusivamente via `z.infer`, 85 testes de schema (de 97 totais), nenhum `any`, nenhum tipo manual, enums compartilhados sem redefinição, e todos os schemas com `.strict()`. O toolchain `test` e `typecheck` (sobre `src/`) passa limpo.

Foram identificados **zero BLOCKERs** e **três WARNINGs** — todos não impeditivos para as tarefas imediatas (TASK-08, TASK-09), mas com potencial de propagação se não tratados.

---

## Resultado dos Comandos de Verificação

| Comando | Resultado |
|---|---|
| `npm run test` (vitest run) | **VERDE** — 97/97 passes; 85 são de schema |
| `tsc --noEmit` (sobre `src/`) | **VERDE** — 0 erros em `src/` |
| `next lint --dir src/schemas --dir src/types` | **VERDE** — 0 warnings/erros |
| `next build` | **FALHA** por stale `.next/types/` — *pré-existente, fora do escopo desta task* |

> **Nota sobre o build:** o erro `TS6053: File '.next/types/app/.../page.ts' not found` é causado por artefatos `.next/` obsoletos de um `next build` anterior incompleto. Nenhum arquivo de `src/schemas/` ou `src/types/` é referenciado nos erros. Rodar `next build` do zero (após deletar `.next/`) resolve. Não é regressão desta task.

---

## Achados

### WARNING-01 — Refinement de `matches`: status `live` bloqueia placares parciais (decisão questionável)

**Classificação:** WARNING

**Localização:** `src/schemas/matches.ts` linhas 26–41

**Problema:**
O refinement atual impõe a regra `if NOT finished → ambos null`. Isso significa que uma partida com `status: "live"` com `homeScore: 1, awayScore: 0` é **rejeitada pelo schema**. Verificado em execução:

```
live homeScore=1 awayScore=null → rejeitado ✓ (correto: assimétrico)
live homeScore=1 awayScore=0   → rejeitado ✗ (discutível: placar real em tempo real)
postponed com placares          → rejeitado ✓ (correto)
```

**Impacto real:** A API-Football atualiza placares durante a partida. Se a TASK-09 (Cloud Functions/ingestão) gravar o documento como `{status:"live", homeScore:1, awayScore:0}`, o `safeParse` rejeitará o documento, causando falha silenciosa ou necessidade de relaxar o schema.

**Contraponto:** A spec (§4.4) documenta explicitamente o refinement como *assumido* e instrui cobrir os 3 estados em teste. A regra implementada é a mais conservadora (placares só existem no estado final). É uma decisão de negócio, não um bug técnico.

**Ação recomendada:** Antes de TASK-09, confirmar com o produto se o Firestore armazenará placares parciais em tempo real ou apenas o resultado final. Se sim, o refinement precisará mudar para: `finished → ambos number; outros → qualquer combinação ou ambos null`. Registrar como decisão explícita.

---

### WARNING-02 — `teams.ts`: `z.string().length(3)` não exige letras maiúsculas (código FIFA pode entrar como `"bra"`)

**Classificação:** WARNING

**Localização:** `src/schemas/teams.ts` linha 9

**Problema:**
```ts
code: z.string().length(3),
```
O schema aceita `"bra"`, `"br1"`, `"B  "` — qualquer sequência de 3 chars. O domínio são códigos FIFA (`"BRA"`, `"ARG"`, `"FRA"`), sempre maiúsculos. A ausência de `.toUpperCase()` ou `.regex(/^[A-Z]{3}$/)` deixa a validação incompleta.

**Impacto:** Inconsistência de dados se a ingestão API-Football (TASK-09) não normalizar o campo antes de gravar. Código `"BRA"` e `"bra"` seriam dois valores distintos em queries/regras.

**Ação recomendada:** Adicionar `z.string().regex(/^[A-Z]{3}$/)` (ou `z.string().length(3).toUpperCase()` via `.transform`). Preferir regex para manter o schema sem side-effects.

---

### WARNING-03 — `statistics.ts`: `percentageSchema` permite float; `accuracy` pode divergir de inteiros calculados

**Classificação:** WARNING

**Localização:** `src/schemas/statistics.ts` linha 23 + `src/schemas/shared.ts` linha 39

**Problema:**
```ts
export const percentageSchema = z.number().min(0).max(100);
accuracy: z.number().min(0).max(100),  // duplicado — usa expressão inline, não percentageSchema
```

Dois sub-problemas:
1. `accuracy` em `statisticsSchema` usa `z.number().min(0).max(100)` **inline** em vez de importar e usar `percentageSchema` — violação menor da fonte única de verdade para primitivos. (Verificado: `src/schemas/statistics.ts` linha 23 usa a expressão inline; `percentageSchema` está importada mas aparentemente não aplicada lá.)
2. `percentageSchema` (e a expressão inline) aceita floats como `75.5`. Se o sistema de cálculo produzir `Math.round(...)`, o tipo deveria ser `z.int()` com intervalo 0–100. Se produzir divisão real, float é correto.

**Ação recomendada:**
- Corrigir para usar `percentageSchema` (já importada, mas inlinada acidentalmente).
- Decidir e documentar se `accuracy` é inteiro ou float; ajustar `percentageSchema` com `z.int()` se for o caso.

> **Nota:** Re-lendo `statistics.ts` com atenção, a linha 23 usa `z.number().min(0).max(100)` diretamente em vez de `percentageSchema`. `percentageSchema` é importada do shared mas não usada no campo `accuracy`.

---

## Checklist Completo vs. Spec

| Critério da Spec | Status |
|---|---|
| 9 schemas implementados em `src/schemas/` | PASS |
| `shared.ts` com enums + primitivos, sem redefinição | PASS |
| Todos os tipos via `z.infer` (zero manual) | PASS |
| `users`: `uid,name,nickname,email,role,status` obrigatórios | PASS |
| `z.email()` para e-mail (API Zod 4) | PASS |
| `z.iso.datetime()` para datas (API Zod 4) | PASS |
| `z.int().min(0)` para placares (API Zod 4) | PASS |
| `z.url()` para flagUrl (API Zod 4) | PASS |
| `z.partialRecord(stageSchema, ...)` para correctByStage | PASS |
| Todos os schemas com `.strict()` | PASS |
| Zero `any` em schemas e types | PASS |
| Barrels `src/schemas/index.ts` e `src/types/index.ts` corretos | PASS |
| Vitest instalado, `npm run test` verde | PASS |
| 85 testes de schema nos 97 totais | PASS |
| Cobertura: parse válido, enum inválido, refinement numérico, e-mail, string vazia, campo extra, inferência de tipo | PASS |
| Cobertura: refinement placar×status (scheduled/finished) | PASS |
| `tsc` sobre `src/` sem erros | PASS |
| `next lint` sobre `src/schemas + src/types` sem erros | PASS |
| Sem lógica de negócio (cálculo de pontos) | PASS |
| Sem `FirestoreDataConverter` (fora do escopo) | PASS |
| Nomes de arquivo camelCase para `bonus_predictions` → `bonusPredictions.ts` | PASS |
| `percentageSchema` usada em `accuracy` | FAIL (inline) |
| Cobertura: status `live` com placares em `matches.test.ts` | FAIL (não testado) |

---

## Análise das 13 Suposições (§10 da Spec)

| # | Suposição | Avaliação |
|---|---|---|
| A1 | Timestamps como string ISO 8601 | Razoável. Mantém schemas isomórficos e testáveis fora do Firebase. |
| A2 | `createdAt`/`updatedAt` opcionais | Razoável para MVP. |
| A3 | Enum em slug inglês minúsculo | Razoável. Segue convenção do Firebase/internacionalização. |
| A4 | `uid` no payload de `users` | Correto — Firebase Auth exige uid como chave conhecida. |
| A5 | `teams`: `name,code,flagUrl?,groupId?` | Razoável. **Risco:** `code` sem validação de maiúsculas (WARNING-02). |
| A6 | `groups`: `name + teamIds[]` sem standings | Razoável. Standings são dinâmicos (API-Football). |
| A7 | `matches`: placares `null` até finalizar; refinement placar×status | Razoável, mas **questionável para `live`** (WARNING-01). |
| A8 | Unicidade `(uid,matchId)` via id doc + rules | Correto — não pertence ao schema Zod. |
| A9 | `rankings`: doc por escopo com `entries[]` | Razoável para <100 usuários. Otimização para leitura rápida. |
| A10 | `statistics`: `correctByStage` como partialRecord | Correto — `z.partialRecord` é a API Zod 4 exata para chaves opcionais de enum. |
| A11 | `bonus_predictions`: artilheiro como string livre | Aceitável para MVP sem coleção de jogadores. |
| A12 | `system_settings`: doc único com flags admin | Razoável e extensível. |
| A13 | Sem `FirestoreDataConverter` nesta task | Correto — pertence a `services/`. |

**Suposições com risco moderado:** A7 (refinement live), A5 (código FIFA sem regex).

---

## Qualidade dos Testes

**Pontos fortes:**
- Cobertura completa dos 8 cenários exigidos pela spec (§7.2) para todas as coleções.
- `expectTypeOf` do Vitest usado corretamente para asserções de tipo em compile-time.
- Uso de `as const` nos objetos de teste para preservar literais (boa prática).
- Testes de objetos aninhados (`rankingEntrySchema`, `positionHistoryEntrySchema`) testados diretamente, não apenas através do schema pai.

**Lacunas menores:**
- `matches.test.ts` não cobre `status: "live"` com placares preenchidos. O refinement rejeita esse caso, mas não há teste explícito documentando a decisão (WARNING-01 seria capturado por um teste).
- `teams.test.ts` não testa `code: "bra"` (minúsculo) — passa quando deveria falhar se a decisão for validar maiúsculas (WARNING-02).
- Nenhum teste verifica `z.url()` com URL sem protocolo (ex.: `www.example.com`) — comportamento da Zod 4 aceita ou rejeita? Baixo risco dado que é campo opcional.

---

## Itens Fora do Escopo (Não Cobrados)

Os seguintes itens foram corretamente excluídos e não devem ser penalizados:
- `services/` com leitura/escrita Firestore
- `FirestoreDataConverter`
- Security Rules (TASK-08)
- Mapeamento API-Football (TASK-09)
- Lógica de cálculo de pontuação/ranking

---

## Veredicto Final

**APROVADO COM AJUSTES**

Nenhum BLOCKER identificado. A implementação está correta, completa e segura para consumo imediato por TASK-08 e TASK-09. Os três WARNINGs são ajustes de baixo custo que devem ser resolvidos antes de TASK-09 (que toca diretamente `teams` e `matches`) para evitar propagação.

### Ações Prioritárias (em ordem)

1. **(WARNING-03)** Substituir `z.number().min(0).max(100)` inline em `statistics.ts` campo `accuracy` por `percentageSchema` (já importado).
2. **(WARNING-02)** Adicionar `.regex(/^[A-Z]{3}$/)` ao campo `code` em `teams.ts` + teste.
3. **(WARNING-01)** Antes de TASK-09: confirmar com o produto a regra de placares em `live`; adicionar teste documentando o comportamento atual.
