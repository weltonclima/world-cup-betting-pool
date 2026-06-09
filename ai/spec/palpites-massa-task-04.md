# SPEC — TASK-04: Endpoint POST /api/predictions/batch

> Feature slug: `palpites-massa`
> Task: TASK-04
> PRD: `ai/prd/palpites-massa.md` (§6.1 A4/A5 + §6.2)
> Plan: `ai/plan/palpites-massa.md`
> Depends on: none (espelha `src/app/api/predictions/route.ts`)
> Gerado: 2026-06-07

---

## 1. Objetivo

Criar `POST /api/predictions/batch` — Route Handler que persiste **N palpites em uma única requisição**, reutilizando exatamente o mesmo fluxo de autenticação, autorização e lock-por-item do handler unitário existente (`src/app/api/predictions/route.ts`).

A resposta é **sempre 200** com um corpo estruturado por item, distinguindo gravados de rejeitados. Itens rejeitados (locked, not-found, schema inválido) **não derrubam o lote** — só produzem entradas no array `rejected`.

---

## 2. Contrato HTTP

### Request

```
POST /api/predictions/batch
Content-Type: application/json
Cookie: __session=<httpOnly session cookie>
```

```jsonc
{
  "predictions": [
    { "matchId": "1001", "homeScore": 2, "awayScore": 1 },
    { "matchId": "1002", "homeScore": 0, "awayScore": 0 }
    // … até 104 itens
  ]
}
```

**Campos aceitos no body:**
| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `predictions` | `PredictionInput[]` | sim | array com 1–104 elementos |
| `predictions[n].matchId` | `string` | sim | `predictionInputSchema` (non-empty string) |
| `predictions[n].homeScore` | `number` | sim | `scoreSchema` (inteiro ≥ 0) |
| `predictions[n].awayScore` | `number` | sim | `scoreSchema` (inteiro ≥ 0) |

> **Campos proibidos (stripped silencioso):** `uid`, `status`, `points` — se presentes no body são ignorados pelo schema Zod; NUNCA persistidos.

**Limites:**
- `predictions.length < 1` → 422
- `predictions.length > 104` → 422 (cap: 104 = total de jogos da Copa 2026)

### Response — sucessos e parciais (sempre 200 quando o lote é aceito)

```jsonc
{
  "saved": [
    {
      "id": "uid-abc123_1001",
      "matchId": "1001",
      "homeScore": 2,
      "awayScore": 1,
      "created": true   // true = create, false = update
    }
  ],
  "rejected": [
    {
      "matchId": "1002",
      "reason": "locked",       // "locked" | "not_found" | "invalid"
      "message": "O prazo para palpites nesta partida foi encerrado."
    }
  ]
}
```

**Tipo `reason`:**
| Valor | Causa |
|---|---|
| `"locked"` | `isPredictionLocked(match, now) === true` |
| `"not_found"` | `matchId` não existe em `fetchAllMatches()` |
| `"invalid"` | item falha na validação do `predictionInputSchema` |

### Response — erros de rota (corpo `{ error: string }`)

| Situação | Status | `error` |
|---|---|---|
| Body não é JSON válido | 400 | `"Corpo da requisição inválido (JSON esperado)."` |
| Cookie ausente | 401 | `"Não autenticado."` |
| `verifySessionCookie` lança | 401 | `"Não autenticado."` |
| `users/{uid}` não existe | 401 | `"Não autenticado."` |
| `users/{uid}.status !== "approved"` | 403 | `"Acesso não autorizado."` |
| Schema do body inválido (predictions faltando, array vazio, cap excedido) | 422 | `"Dados de entrada inválidos."` + `issues` |
| `fetchAllMatches` lança `ApiFootballQuotaError` | 503 | via `apiFootballErrorResponse` |
| `fetchAllMatches` lança `ApiFootballAuthError` | 502 | via `apiFootballErrorResponse` |
| `fetchAllMatches` lança `ApiFootballTimeoutError` | 504 | via `apiFootballErrorResponse` |
| `batch.commit()` lança | 500 | `"Erro ao salvar o lote de palpites."` |

---

## 3. Fluxo de implementação

Seguir exatamente a ordem do handler unitário existente, estendida para N itens.

```
1. Ler e verificar session cookie  → 401 se ausente ou inválido
2. Buscar users/{uid}              → 401 se doc não existe; 403 se status !== "approved"
3. Parsear body                    → 400 se JSON inválido
4. Validar body com batchInputSchema (ver §4)
                                   → 422 se inválido (predictions ausente, array fora de [1..104])
5. Chamar fetchAllMatches()        → erros via apiFootballErrorResponse (502/503/504/500)
6. Capturar `now = new Date()`
7. Para cada predictions[i]:
   a. Validar item com predictionInputSchema
      → se inválido: push para rejected com reason="invalid"
   b. Buscar match em matchesMap (por matchId)
      → se não encontrado: push para rejected com reason="not_found"
   c. Verificar isPredictionLocked(match, now)
      → se true: push para rejected com reason="locked"
   d. Determinar isCreate (via docRef.get())
      → montar payload (uid da sessão, matchId, homeScore, awayScore, updatedAt; createdAt se isCreate)
      → batch.set(docRef, payload, { merge: true })
      → push para saved
8. Chamar batch.commit()           → 500 se lança
9. Retornar 200 { saved, rejected }
```

**Nota sobre WriteBatch vs leitura de existência:** O Firestore Admin `WriteBatch` agrupa escritas, mas não leituras. As leituras de `docRef.get()` para detectar create vs update devem ser feitas **antes** de montar o batch — em paralelo com `Promise.all` para minimizar latência.

---

## 4. Schemas Zod a definir

### `batchInputSchema` (no arquivo da rota ou em `src/schemas/predictions.ts`)

```ts
import { z } from "zod";
import { predictionInputSchema } from "@/schemas";

export const BATCH_MAX_SIZE = 104; // total de jogos da Copa 2026

export const batchInputSchema = z.object({
  predictions: z
    .array(predictionInputSchema)
    .min(1, "O lote deve conter pelo menos 1 palpite.")
    .max(BATCH_MAX_SIZE, `O lote não pode exceder ${BATCH_MAX_SIZE} palpites.`),
});

export type BatchInput = z.infer<typeof batchInputSchema>;
```

> `batchInputSchema` valida a **estrutura do body** (campo `predictions` e limites de tamanho). A validação item a item com `predictionInputSchema` ocorre na etapa 7a do loop — erros individuais vão para `rejected`, não derrubam o body todo.

---

## 5. Payload gravado por item (Firestore)

```ts
// Create
{
  uid,        // string — da sessão, nunca do body
  matchId,    // string
  homeScore,  // number (inteiro ≥ 0)
  awayScore,  // number (inteiro ≥ 0)
  createdAt,  // string ISO — APENAS no create
  updatedAt,  // string ISO
}

// Update (merge: true)
{
  uid,
  matchId,
  homeScore,
  awayScore,
  updatedAt,  // atualiza; createdAt NÃO incluído → preservado pelo merge
}
```

**Campos NUNCA gravados:** `status`, `points` (responsabilidade do handler de pontuação, não deste).

**`docId`** = `predictionDocId(uid, matchId)` = `"${uid}_${matchId}"` — idêntico ao handler unitário.

**`batch.set(docRef, payload, { merge: true })`** — mesmo contrato do handler unitário.

---

## 6. Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `src/app/api/predictions/batch/route.ts` | **Criar** — Route Handler (único export `POST`) |
| `src/app/api/predictions/batch/__tests__/route.test.ts` | **Criar** — suite de testes (TDD recomendado) |

**Opcional (se batchInputSchema for extraído):**
| Arquivo | Ação |
|---|---|
| `src/schemas/predictions.ts` | **Modificar** — adicionar `batchInputSchema` e `BATCH_MAX_SIZE` |

> Preferência: definir `batchInputSchema` localmente no `route.ts` para manter o handler auto-contido; mover para `src/schemas` somente se TASK-05 precisar reusar o schema no lado client.

---

## 7. Padrões de mock para os testes

Replicar **exatamente** os padrões de `src/app/api/predictions/__tests__/route.test.ts`:

```ts
// 1. vi.hoisted — mocks obrigatórios (mesmos 5)
const {
  verifySessionCookieMock,
  getFirestoreMock,
  fetchAllMatchesMock,
  cookiesMock,
  isPredictionLockedMock,
} = vi.hoisted(() => ({ ... }));

// 2. vi.mock — mesmos 5 módulos
vi.mock("@/server/firebaseAdmin", ...)
vi.mock("next/headers", ...)
vi.mock("../../_lib/apiFootballData", ...)  // caminho relativo ao batch/route.ts
vi.mock("@/features/predictions/lib", async () => {
  const actual = await vi.importActual(...);
  return { ...actual, isPredictionLocked: isPredictionLockedMock };
});
vi.mock("server-only", () => ({}));
```

**Diferença principal para o batch:** `getFirestoreMock` deve retornar um objeto Firestore com **`batch()`** além de `collection()`.

```ts
function makeFirestoreMockBatch({
  commitThrows = false,
  existingDocIds = [] as string[], // docIds que já existem (isCreate=false)
} = {}) {
  const commitMock = commitThrows
    ? vi.fn().mockRejectedValue(new Error("Firestore commit failed"))
    : vi.fn().mockResolvedValue(undefined);

  const setMock = vi.fn();  // WriteBatch.set — síncrono

  const batchMock = vi.fn().mockReturnValue({
    set: setMock,
    commit: commitMock,
  });

  const getMock = vi.fn().mockImplementation((/* docRef */) =>
    Promise.resolve({ exists: existingDocIds.includes(/* docId */ "") })
  );

  // ... collection mock igual ao unitário para users/{uid}
  return { commitMock, setMock, batchMock, getMock };
}
```

> O mock de `batch().set()` é **síncrono** (sem retorno) — igual à API real do Admin SDK. O `commit()` é **assíncrono** (Promise).

---

## 8. Casos de teste obrigatórios

### 8.1 Autenticação (401)
1. Cookie ausente → 401
2. `verifySessionCookie` lança → 401
3. `users/{uid}` não existe → 401

### 8.2 Autorização (403)
4. `users/{uid}.status === "pending"` → 403
5. `users/{uid}.status === "blocked"` → 403

### 8.3 Validação do body (400 / 422)
6. Body não-JSON → 400
7. `predictions` ausente no body → 422
8. `predictions` array vazio → 422
9. `predictions` com 105 itens → 422 (cap excedido)
10. Body com campo `uid` injetado → ignorado (uid da sessão prevalece); teste garante que `batch.set()` usa uid da sessão

### 8.4 fetchAllMatches — erros de upstream (502/503/504/500)
11. `fetchAllMatches` lança `ApiFootballQuotaError` → 503
12. (Recomendado) `fetchAllMatches` lança `ApiFootballAuthError` → 502

### 8.5 Processamento por item — resposta 200 com saved/rejected
13. Lote de 1 item válido, match aberto, doc não existe → `saved[0].created === true`
14. Lote de 1 item válido, match aberto, doc já existe → `saved[0].created === false`
15. Item com `matchId` inexistente → `rejected[n].reason === "not_found"`
16. Item com match bloqueado (`isPredictionLocked` retorna true) → `rejected[n].reason === "locked"`
17. Item com schema inválido (ex.: `homeScore: -1`) → `rejected[n].reason === "invalid"`
18. Lote misto (3 items: 1 válido + 1 locked + 1 not_found) → `saved.length === 1`, `rejected.length === 2`
19. `uid` nunca vem do body — `batch.set()` recebe payload com uid da sessão

### 8.6 Payload gravado
20. `batch.set()` chamado com `{ merge: true }` por item gravado
21. Payload de create contém `createdAt` e `updatedAt`; nenhum dos dois contém `status` ou `points`
22. Payload de update contém `updatedAt` mas **não** `createdAt`; nenhum contém `status` ou `points`
23. `docId` = `${uid}_${matchId}` — confirmar via `batch.set.mock.calls[0][0]` (referência do doc)

### 8.7 Erro de commit (500)
24. `batch.commit()` lança → 500, body `{ error: "Erro ao salvar o lote de palpites." }`

---

## 9. Segurança — checklist obrigatório

| Requisito | Como garantir |
|---|---|
| `uid` SEMPRE da sessão | `uid = decodedToken.uid` (Admin SDK); `predictionInputSchema` não tem campo `uid`; `batchInputSchema` também não |
| NUNCA gravar `status` nem `points` | Payload construído manualmente: `{ uid, matchId, homeScore, awayScore, updatedAt, [createdAt] }` — sem spread do body |
| Cap de itens | `batchInputSchema` com `.max(104)` → 422 se excedido |
| Rejeição de body malformado | JSON.parse com try/catch → 400 |
| Não autenticado → 401 | Fluxo idêntico ao handler unitário (cookie ausente + verifySessionCookie lançando) |
| Não aprovado → 403 | `users/{uid}.status === "approved"` obrigatório |
| Payload inválido → 422 | `batchInputSchema.safeParse()` |
| Erros de item não derrubam o lote | Loop com try/catch por item; só `batch.commit()` pode retornar 500 |
| Sem vazamento de detalhes internos | Mensagens de erro em pt-BR, sem stack traces no response body |

---

## 10. Notas de implementação

### Paralelismo nas leituras de existência
Para N itens válidos e não-bloqueados, ler a existência de cada doc **antes** de montar o batch evita múltiplas viagens serializadas. Usar:

```ts
const existenceChecks = await Promise.all(
  itemsToWrite.map(async (item) => {
    const docId = predictionDocId(uid, item.matchId);
    const snap = await db.collection("predictions").doc(docId).get();
    return { ...item, docId, isCreate: !snap.exists };
  })
);
```

### Timestamp único por requisição
`now = new Date()` capturado **uma vez** antes do loop — garante que todos os itens do mesmo lote tenham o mesmo `updatedAt`.

### Relação com o handler unitário
O handler unitário (`POST /api/predictions`) não é alterado. O batch é um handler independente — sem importação entre eles. Código compartilhado vem dos módulos já existentes: `getAdminAuth`, `getAdminFirestore`, `SESSION_COOKIE_NAME`, `predictionInputSchema`, `isPredictionLocked`, `predictionDocId`, `fetchAllMatches`, `apiFootballErrorResponse`.

### Runtime e dynamic
```ts
export const runtime = "nodejs";   // firebase-admin + cookies() exigem Node
export const dynamic = "force-dynamic"; // lê cookies e grava no Firestore
```

---

## 11. Perguntas em aberto

| # | Questão | Impacto |
|---|---|---|
| Q1 | `batchInputSchema` deve ir em `src/schemas/predictions.ts` (para reuso em TASK-05/client) ou ficar localizado no `route.ts`? | Estrutura de arquivos; TASK-05 pode precisar do tipo `BatchInput` |
| Q2 | Leituras de existência (create vs update) devem ser omitidas para economizar uma viagem por item? (gravar sempre como update com `merge:true` e omitir `createdAt` se já existir, ou gravar `createdAt` sempre e aceitar sobrescrita) | Trade-off performance vs. fidelidade ao contrato do handler unitário |
| Q3 | Items com schema inválido devem ser incluídos em `rejected` com `reason:"invalid"` ou retornar 422 para o lote todo? O spec opta por `rejected`, mas o caller deve confirmar se esse comportamento é aceitável para TASK-05/UI | Comportamento de UX no TASK-09 |
| Q4 | A resposta de `rejected` deve incluir o índice original do item no array para o client facilitar a reconciliação com o rascunho local? | Conveniência de TASK-05 |

> **Recomendação para Q3:** manter `reason:"invalid"` em `rejected` (não derruba o lote) — consistente com a decisão A4/A5 do PRD (auto-save resiliente). Q4: incluir `index` é baixo custo e simplifica TASK-05; recomendado.

---

## 12. Requires screen

**Não.** TASK-04 é API pura, sem saída visual.

## 13. Recommended TDD

**Sim.** Escrever `__tests__/route.test.ts` completo (casos §8) **antes** de implementar `route.ts`. A rota não existe — todos os testes devem falhar (red) no import. Seguir o mesmo comentário de cabeçalho do arquivo de testes do handler unitário documentando cada caso numerado.
