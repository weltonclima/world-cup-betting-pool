# Review — Home Dashboard TASK-03: Camada de Serviços Firestore (Home)

**Data:** 2026-06-07
**Commits:** e843758 (`feat(services): leituras Firestore da Home — TASK-03`) + estado atual de `src/services/matches.ts` e `src/services/teams.ts` (id injection incorporada pelo TASK-05, commit 7fac98a)
**Branch:** feat/prd-01-auth
**Revisor:** Staff Engineer (adversarial)
**Profundidade:** deep — correctude de queries, type safety, Firestore indexes, id-injection, cobertura de testes, conformidade com padrão `users.ts`
**Veredicto:** `aprovado`

---

## Escopo revisado

| Arquivo | Tipo | Situação |
|---|---|---|
| `src/services/rankings.ts` | Implementação (novo) | Revisado (estado atual) |
| `src/services/statistics.ts` | Implementação (novo) | Revisado (estado atual) |
| `src/services/matches.ts` | Implementação (novo + modificado em TASK-05) | Revisado (estado atual pós-7fac98a) |
| `src/services/teams.ts` | Implementação (novo + modificado em TASK-05) | Revisado (estado atual pós-7fac98a) |
| `src/services/predictions.ts` | Implementação (novo) | Revisado (estado atual) |
| `src/services/systemSettings.ts` | Implementação (novo) | Revisado (estado atual) |
| `src/services/index.ts` | Barrel (modificado) | Revisado |
| `src/services/__tests__/rankings.test.ts` | Testes (novo) | Revisado |
| `src/services/__tests__/statistics.test.ts` | Testes (novo) | Revisado |
| `src/services/__tests__/matches.test.ts` | Testes (novo) | Revisado |
| `src/services/__tests__/teams.test.ts` | Testes (novo) | Revisado |
| `src/services/__tests__/predictions.test.ts` | Testes (novo) | Revisado |
| `src/services/__tests__/systemSettings.test.ts` | Testes (novo) | Revisado |
| `firestore.indexes.json` | Configuração (modificado) | Revisado |

**Referências consultadas:**
- `ai/prd/home-dashboard.md` §3 + Apêndice A
- `ai/plan/home-dashboard.md` §3 TASK-03
- `src/services/users.ts` (padrão canônico)
- `src/schemas/{matches,teams,rankings,statistics,predictions,systemSettings,shared}.ts`
- `src/types/{matches,teams}.ts` (`MatchWithId` / `TeamWithId`)
- `.claude/CLAUDE.md` (regras de desenvolvimento)

---

## Análise de conformidade com o padrão `users.ts`

O padrão estabelecido em `src/services/users.ts` define:
1. Schema Zod validado via `.parse(d.data())` — sem fallback silencioso
2. Erros Firebase propagados crus (sem tradução de mensagem)
3. Sem React / sem cache — lógica TanStack fica nos hooks
4. JSDoc com `@throws ZodError` e `@throws FirebaseError`
5. Strict TypeScript sem `any`

Verificação serviço a serviço:

| Serviço | `.parse` | Erro cru | Sem React | JSDoc completo | Sem `any` |
|---|---|---|---|---|---|
| `rankings.ts` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `statistics.ts` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `matches.ts` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `teams.ts` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `predictions.ts` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `systemSettings.ts` | ✓ | ✓ | ✓ | ✓ | ✓ |

**Todos os serviços seguem o padrão `users.ts` integralmente.** Nenhum `as any`, nenhuma captura de erro silenciosa, nenhuma importação de React.

---

## Análise de queries Firestore (correctude + índices)

### `getGeneralRanking` — `rankings`
Query: `where("scope", "==", "geral") + limit(1)`

Análise: equality em um único campo + limit não requer índice composto no Firestore (index automático de campo simples cobre). Correto. ✓

Semântica: a coleção `rankings` armazena um doc por escopo; o doc "geral" existe ou não. Retornar `null` quando vazio é o comportamento correto — o spec do PRD §3 descreve exatamente isso. ✓

### `getStatistics` — `statistics/{uid}`
Query: `getDoc(doc(firestore, "statistics", uid))`

Análise: ponto de leitura por doc id — sem query, sem índice necessário. Correto. ✓

Semântica: `snap.exists()` guard com retorno `null` (usuário aprovado sem dados ainda) alinhado com o comentário de convenção. Correto. ✓

### `getNextScheduledMatch` — `matches`
Query: `where("status", "==", "scheduled") + orderBy("kickoffAt", "asc") + limit(1)`

Análise: `where` em um campo + `orderBy` em campo diferente = **índice composto obrigatório** no Firestore. O índice `{status ASC, kickoffAt ASC}` está registrado em `firestore.indexes.json` (linhas 11–18). ✓

Semântica: ordena por `kickoffAt` ascendente para obter o mais próximo; limit(1). Alinhado com A4/A5 do PRD. ✓

Id injection: `{ id: first.id, ...matchSchema.parse(first.data()) }` — id injetado APÓS o parse, sem afrouxar o schema `.strict()`. O tipo de retorno é `MatchWithId`, correto. ✓

### `getRecentFinishedMatches` — `matches`
Query: `where("status", "==", "finished") + orderBy("kickoffAt", "desc") + limit(5)`

Análise: `where` diferente de `orderBy` = índice composto obrigatório. O índice `{status ASC, kickoffAt DESC}` está registrado em `firestore.indexes.json` (linhas 19–27). ✓

Semântica: ordena por `kickoffAt` descendente para obter os mais recentes; limit(5). Alinhado com A4 do PRD. ✓

Id injection: mesmo padrão de `getNextScheduledMatch`. ✓

### `listAllTeams` — `teams`
Query: `getDocs(collection(firestore, "teams"))` — collection scan sem filtros

Análise: sem `where`/`orderBy` = sem índice composto necessário. Correto para uma coleção pequena (≤48 seleções). ✓

Id injection: `{ id: d.id, ...teamSchema.parse(d.data()) }` — padrão idêntico ao matches. ✓

### `listPredictionsByUid` — `predictions`
Query: `where("uid", "==", uid)` sem `orderBy`

Análise: equality em campo único = índice automático de campo simples (Firestore cria automaticamente). **Nenhum índice composto necessário**; corretamente ausente do `firestore.indexes.json`. ✓

Ausência de `orderBy`: a função documenta "sem ordenação explícita (a UI ordena client-side)". Alinhado com o design da PRD §3, que descreve o join client-side como estratégia. ✓

### `getSystemSettings` — `system_settings`
Query: `getDoc(doc(firestore, "system_settings", "global"))`

Análise: leitura por doc id fixo. Sem query, sem índice. Correto. ✓

Semântica: `snap.exists()` guard com retorno `null` quando o doc não existe. Correto e simétrico com `getStatistics`. ✓

---

## Análise de id-injection em `matches` e `teams`

O schema `matchSchema` usa `.strict()` e NÃO inclui `id`. O doc id da API-Football é o doc id do Firestore (decisão D3 do PRD). O id é injetado **após** o `.parse()`:

```ts
// matches.ts linha 51
return { id: first.id, ...matchSchema.parse(first.data()) };
```

Isso garante:
1. O schema permanece estrito — um doc com campo `id` extra no Firestore ainda falha o parse (`.strict()` rejeita campos desconhecidos). ✓
2. O tipo `MatchWithId = Match & { id: string }` é construído por interseção de tipos, sem afrouxar o schema. ✓
3. Simétrico em `teams.ts`. ✓

A nota no JSDoc de `matches.ts` ("o schema é `.strict()` e NÃO inclui o campo `id`") e a descrição do fluxo (`MatchWithId — TASK-05`) são corretas e educativas. ✓

---

## Análise de null/not-found handling

| Serviço | Condição not-found | Retorno | Correto? |
|---|---|---|---|
| `getGeneralRanking` | `snapshot.docs[0]` ausente | `null` | ✓ |
| `getStatistics` | `!snap.exists()` | `null` | ✓ |
| `getNextScheduledMatch` | `snapshot.docs[0]` ausente | `null` | ✓ |
| `getRecentFinishedMatches` | coleção vazia | `[]` | ✓ |
| `listAllTeams` | coleção vazia | `[]` | ✓ |
| `listPredictionsByUid` | coleção vazia para uid | `[]` | ✓ |
| `getSystemSettings` | `!snap.exists()` | `null` | ✓ |

Distinção entre "não existe" (null/[]) e erro (exceção propagada) é mantida corretamente em todos os serviços. Nenhum serviço silencia erros ou retorna dados inválidos em caso de falha de rede.

---

## Análise de type safety

- **Sem `any`:** confirmado por grep e por `tsc --noEmit` (exit 0). ✓
- **Tipos derivados dos schemas Zod:** todos os tipos de retorno (`Ranking`, `Statistics`, `MatchWithId`, `TeamWithId`, `Prediction`, `SystemSettings`) são `z.infer<typeof schema>` ou interseção com `{ id: string }`. ✓
- **`noUncheckedIndexedAccess`:** presente no `tsconfig.json`. O acesso `snapshot.docs[0]` pode ser `undefined` — ambas as funções que fazem esse acesso (rankings, matches) guardiam corretamente com `if (!first) return null`. ✓
- **Inferência de `MatchWithId`:** `{ id: first.id, ...matchSchema.parse(first.data()) }` produz `{ id: string } & Match` = `MatchWithId`. TypeScript resolve corretamente sem cast explícito. ✓

---

## Análise de cobertura de testes

### Padrão por serviço (5 cenários cada)

| Cenário | rankings | statistics | matches (×2 fn) | teams | predictions | systemSettings |
|---|---|---|---|---|---|---|
| Query correta (args) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Retorno validado (happy path) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Not-found → null / [] | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Doc malformado → ZodError | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Erro Firestore propaga cru | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Observações específicas:

- `matches.test.ts` cobre `getNextScheduledMatch` e `getRecentFinishedMatches` separadamente (10 cenários totais); inclui verificação de que o id do doc é injetado no objeto retornado. ✓
- `teams.test.ts` verifica id injection no array retornado. ✓
- `statistics.test.ts` testa `accuracy: 200` como doc malformado (fora de 0–100 — percentageSchema). ✓
- `matches.test.ts` testa `finished` sem placar como doc malformado (viola o refinement do schema). ✓
- `teams.test.ts` testa código FIFA de 2 letras como malformado (regex `^[A-Z]{3}$`). ✓
- `systemSettings.test.ts` inclui cenário de campos opcionais ausentes (`currentStage`/`updatedAt`). ✓

**Total: 36 testes. Todos passando (`vitest run` exit 0, PASS 36, FAIL 0).** ✓

---

## Análise de `firestore.indexes.json`

```json
{
  "indexes": [
    { "collectionGroup": "users", "fields": [{"status":"ASC"},{"createdAt":"ASC"}] },
    { "collectionGroup": "matches", "fields": [{"status":"ASC"},{"kickoffAt":"ASC"}] },
    { "collectionGroup": "matches", "fields": [{"status":"ASC"},{"kickoffAt":"DESC"}] }
  ],
  "fieldOverrides": []
}
```

Análise:

- `users (status ASC + createdAt ASC)`: suporta `listUsersByStatus` (PRD-01). Correto, não introduzido por esta tarefa, mas mantido corretamente. ✓
- `matches (status ASC + kickoffAt ASC)`: suporta `getNextScheduledMatch`. ✓
- `matches (status ASC + kickoffAt DESC)`: suporta `getRecentFinishedMatches`. ✓

**Nenhum índice single-field desnecessário registrado** (o commit message de e843758 menciona "single-field indexes already removed" — confirmado). Queries que não requerem composto (`rankings`, `statistics`, `teams`, `predictions`, `system_settings`) não possuem entradas, o que está correto. ✓

A ordem dos campos em `firestore.indexes.json` corresponde exatamente à ordem em que os constraints aparecem nas queries (equality primeiro, range/orderBy segundo) — exigência do Firestore para que o índice seja válido. ✓

---

## Análise de arquitetura e maintainability

- **Separação de responsabilidades:** cada serviço tem uma única responsabilidade (leitura de uma coleção). Nenhuma lógica de negócio ou join client-side nesta camada — correto para o padrão do projeto. ✓
- **Barrel `src/services/index.ts`:** exporta exatamente as funções públicas de cada serviço, sem vazar internals. Estrutura clara. ✓
- **JSDoc:** todos os serviços têm JSDoc de classe e de função com `@param`, `@returns`, `@throws` e contexto de decisão (quando relevante). A nota sobre a convenção `null` vs exceção em `statistics.ts` é particularmente útil. ✓
- **Comentário de índices em `matches.ts`:** o bloco de JSDoc referencia explicitamente os índices compostos necessários e os conecta a `firestore.indexes.json`. Facilita a auditoria futura. ✓
- **Naming:** `getGeneralRanking`, `getStatistics`, `getNextScheduledMatch`, `getRecentFinishedMatches`, `listAllTeams`, `listPredictionsByUid`, `getSystemSettings` — convenção verbo+substantivo consistente com o padrão do projeto (`listUsersByStatus`, `updateUserStatus`). ✓

---

## Verificações de toolchain

```
npx vitest run src/services/__tests__/*.test.ts
  Tests  36 passed (36)
  PASS (36) FAIL (0)

npx tsc --noEmit
  EXIT_CODE=0

mcp__ide__getDiagnostics (todos os arquivos da scope)
  Zero erros TypeScript nos arquivos de serviço.
  Único diagnóstico: tsconfig.json baseUrl deprecated (pré-existente, fora do escopo).
```

---

## Achados

**Nenhum BLOCKER. Nenhum WARNING.**

---

## Veredicto final

**`aprovado`**

A implementação da camada de serviços Firestore para a Home Dashboard (TASK-03) está correta em todos os critérios adversariais:

1. **Padrão `users.ts`:** espelhado integralmente em todos os 6 serviços — `.parse` sem fallback, erro cru, sem React, JSDoc completo, sem `any`.
2. **Queries Firestore:** semanticamente corretas para cada card conforme PRD §3; índices compostos obrigatórios registrados; ausência correta de índices desnecessários.
3. **Índices:** `firestore.indexes.json` contém exatamente os 2 índices compostos necessários para `matches` (status+kickoffAt ASC e DESC), sem single-field extras.
4. **Id-injection:** implementado em `matches.ts` e `teams.ts` com `{ id: d.id, ...schema.parse(d.data()) }` — schema `.strict()` não afrouxado, tipos `MatchWithId`/`TeamWithId` corretos por interseção.
5. **Null/not-found handling:** distinção clara entre ausência (null/[]) e erro (exceção) em todos os serviços; `noUncheckedIndexedAccess` tratado corretamente com guards explícitos.
6. **Type safety:** zero `any`, zero casts inseguros, TypeScript strict passa sem erros.
7. **Testes:** 36 cenários cobrindo happy path, not-found, doc malformado (por regra do schema) e erro Firestore para cada função; verificação de id-injection nos retornos.
