# SPEC — TASK-03: Route Handler de upsert de palpite (`POST /api/predictions`)

> PRD: `ai/prd/palpites.md` | Plano: `ai/plan/palpites.md` | Branch: `feat/integracao-api-football`
> Tipo: api | SP: 5 | Criticidade: critical | Risco técnico: high
> TDD recomendado: yes (testes via `/tdd` separado). Sem tela.
> Depende de: TASK-01 (schema + tipos concluídos) | TASK-02 (lib pura concluída — `isPredictionLocked`, `predictionDocId`)

---

## 1. Objetivo

Criar `src/app/api/predictions/route.ts` com um único handler `POST` que realiza o **upsert de palpite** (create + update unificado) de forma autoritativa no servidor. A motivação central é que as Security Rules do Firestore **não conseguem ler `kickoffAt`** (partidas vivem na API-Football/cache Next, não no Firestore — arquitetura PRD-07 v2.0), portanto o bloqueio temporal seguro **só pode ser verificado no servidor**.

O handler:
1. Lê e valida o session cookie httpOnly via Admin SDK (`verifySessionCookie`) — obtém `uid`.
2. Busca o `status` do usuário no Firestore via Admin SDK — rejeita `403` se não-aprovado.
3. Valida o body com `predictionInputSchema` — rejeita `422` se inválido.
4. Busca a partida no cache de servidor (`fetchAllMatches`) — rejeita `404` se inexistente.
5. Verifica bloqueio via `isPredictionLocked` (importado de `@/features/predictions/lib`) — rejeita `423` se travado.
6. Grava via Admin SDK em `predictions/${predictionDocId(uid, matchId)}` com `set({ merge: true })` — grava `uid/matchId/homeScore/awayScore/updatedAt` + `createdAt` apenas no create. **Nunca grava `status` nem `points`** (esses pertencem ao TASK-04).

---

## 2. Investigação: mecanismos existentes

### (a) Sessão server-side: como obter `uid` no Route Handler

**Arquivo principal:** `src/server/firebaseAdmin.ts`

O projeto usa **session cookies httpOnly do Firebase** (`__session` — `SESSION_COOKIE_NAME` em `src/server/auth/sessionCookie.ts:12`). O fluxo de criação está em `src/app/api/auth/session/route.ts`.

**No middleware** (`src/middleware.ts` — runtime edge), a verificação usa `jose` + `verifySession` (`src/server/auth/verifySession.ts`) porque o Admin SDK não roda no edge. O resultado exposto pelo middleware é `{ valid, role }` — **não expõe uid**.

**Em Route Handlers (runtime Node)**, o caminho correto é usar diretamente o **Admin SDK**:
```ts
// src/server/firebaseAdmin.ts:95-103
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getAdminApp());
}
```

O `Auth` do Admin SDK expõe `auth.verifySessionCookie(cookie, checkRevoked)` que retorna `DecodedIdToken` — o campo `uid` está nesse objeto. Exemplo de uso no Route Handler existente que já usa `getAdminAuth()`: `src/app/api/auth/session/route.ts:72` (`const auth = getAdminAuth()`).

**Padrão a adotar (novo — primeiro Route Handler autenticado além da própria rota de sessão):**
```ts
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookie";
import { getAdminAuth, getAdminFirestore } from "@/server/firebaseAdmin";

// Dentro do handler:
const cookieStore = await cookies();
const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
if (!sessionCookie) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

const auth = getAdminAuth();
let decodedToken: import("firebase-admin/auth").DecodedIdToken;
try {
  decodedToken = await auth.verifySessionCookie(sessionCookie, false); // checkRevoked=false (performance)
} catch {
  return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
}
const uid = decodedToken.uid;
```

**Verificação de `status === "approved"` no servidor:** o session cookie **não carrega `status`** — esse campo vive no Firestore, não em custom claims. Logo, após obter o `uid`, é necessário buscar o doc `users/{uid}` via Admin SDK e checar `data.status`:
```ts
const db = getAdminFirestore();
const userSnap = await db.collection("users").doc(uid).get();
if (!userSnap.exists) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
const userData = userSnap.data();
if (userData?.status !== "approved") {
  return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
}
```

O schema de `users` está em `src/schemas/users.ts` — campo `status: userStatusSchema` (valores: `"pending" | "approved" | "blocked"`).

---

### (b) Função de `apiFootballData` que retorna 1 partida por id

**Arquivo:** `src/app/api/_lib/apiFootballData.ts`

A função existente é `fetchAllMatches()` (`src/app/api/_lib/apiFootballData.ts:40-56`) — retorna `MatchWithId[]`. **Não há função `fetchMatchById`**. O padrão já estabelecido em `src/app/api/matches/[id]/route.ts:19-38` é filtrar a lista:

```ts
// src/app/api/matches/[id]/route.ts:25-33
const matches = await fetchAllMatches();
const match = matches.find((m) => m.id === id);

if (match === undefined) {
  return NextResponse.json(
    { error: "Partida não encontrada." },
    { status: 404 },
  );
}
```

O campo `id` de `MatchWithId` é `String(fixture.id)` da API-Football (`src/app/api/_lib/apiFootballData.ts:54`). A função `fetchAllMatches` já usa o cache ISR/fetch do Next.js (`revalidate = 60` na rota de matches), mas como o Route Handler de predictions tem `force-dynamic`, a chamada a `fetchAllMatches()` dentro dele pode ter TTL de cache próprio do `fetch` interno — não é problema para o bloqueio autoritativo, pois o cache está em memória do servidor.

**Resultado necessário de `MatchWithId`:** `kickoffAt` (string ISO 8601) + `status` (string enum) — ambos presentes em todo `MatchWithId` válido (sem optional).

---

### (c) Helper de resposta de erro consistente

**Arquivo:** `src/app/api/_lib/apiFootballError.ts`

A função `apiFootballErrorResponse(err: unknown): NextResponse` (`src/app/api/_lib/apiFootballError.ts:29-76`) é específica para erros de **integração com a API-Football** (quota, auth, timeout, ZodError de dados externos). **Não é genérica** para erros de negócio de Route Handlers de palpites.

**Shape de erro do projeto:** `{ error: string }` com status HTTP — padrão estabelecido em todas as rotas:
- `src/app/api/auth/session/route.ts:57-60`: `{ error: "Corpo da requisição inválido (JSON esperado)." }`
- `src/app/api/matches/[id]/route.ts:29-32`: `{ error: "Partida não encontrada." }`
- `src/app/api/_lib/apiFootballError.ts:34`: `{ error: "Cota da API de dados esgotada. Tente novamente mais tarde." }`

**Para o Route Handler de predictions**, os erros de negócio usam diretamente `NextResponse.json({ error: "..." }, { status: NNN })` — sem helper wrapper específico, seguindo o padrão já estabelecido no projeto.

Erros de upstream de `fetchAllMatches` (quota, auth, timeout) devem ser capturados e delegados para `apiFootballErrorResponse` (re-uso legítimo para esses casos específicos).

---

## 3. Escopo

### Dentro do escopo

- `src/app/api/predictions/route.ts` — handler `POST` (upsert de palpite).
- `src/app/api/predictions/__tests__/route.test.ts` — suite Vitest (criada via `/tdd`).
- `export const runtime = "nodejs"` e `export const dynamic = "force-dynamic"` no arquivo de rota.

### Fora do escopo

- `GET /api/predictions` — leitura de palpites é feita via Client SDK diretamente (`listPredictionsByUid`).
- `DELETE /api/predictions` — sem delete (A3 do PRD).
- `POST /api/predictions/score` — Route Handler de pontuação (TASK-04, arquivo separado).
- Security Rules (`firestore.rules`) — TASK-05.
- Hooks TanStack Query ou services de escrita no client — TASK-06.
- Qualquer componente de UI — TASK-07/08/09.
- Configuração de cron — infra externa, fora do código (R7 do PRD).

---

## 4. Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/app/api/predictions/route.ts` | **Criar** — handler POST (upsert) |
| `src/app/api/predictions/__tests__/route.test.ts` | **Criar** via `/tdd` |

Nenhum arquivo existente é modificado por esta tarefa.

---

## 5. Fluxo completo do handler `POST /api/predictions`

```
POST /api/predictions
  ├─ 1. Ler cookie __session (httpOnly)
  │     └─ Ausente → 401 "Não autenticado."
  ├─ 2. auth.verifySessionCookie(cookie)
  │     └─ Inválido/expirado → 401 "Não autenticado."
  │     └─ OK → uid = decodedToken.uid
  ├─ 3. db.collection("users").doc(uid).get()
  │     └─ Doc inexistente → 401 "Não autenticado."
  │     └─ status !== "approved" → 403 "Acesso não autorizado."
  │     └─ status === "approved" → continua
  ├─ 4. request.json() + predictionInputSchema.safeParse(body)
  │     └─ Parse falhou → 422 "Dados de entrada inválidos." + { issues }
  │     └─ OK → { matchId, homeScore, awayScore }
  ├─ 5. fetchAllMatches().find(m => m.id === matchId)
  │     └─ Não encontrada → 404 "Partida não encontrada."
  │     └─ fetchAllMatches() lança → apiFootballErrorResponse(err)
  │     └─ Encontrada → match (MatchWithId com kickoffAt + status)
  ├─ 6. isPredictionLocked(match, new Date())
  │     └─ true → 423 "O prazo para palpites nesta partida foi encerrado."
  │     └─ false → continua
  ├─ 7. Determinar se é create ou update
  │     └─ docRef = db.collection("predictions").doc(predictionDocId(uid, matchId))
  │     └─ snap = await docRef.get()
  │     └─ isCreate = !snap.exists
  ├─ 8. Gravar via Admin SDK (setDoc com merge)
  │     └─ Payload: { uid, matchId, homeScore, awayScore, updatedAt: now.toISOString() }
  │     └─ Se isCreate: adicionar { createdAt: now.toISOString() }
  │     └─ Usar merge=true para preservar campos existentes (status, points, createdAt)
  │     └─ Sucesso → 200 { prediction: { id, uid, matchId, homeScore, awayScore } }
  │     └─ Erro de escrita → 500 "Erro ao salvar o palpite."
```

---

## 6. Implementação detalhada

### 6.1 Configuração do arquivo

```ts
// src/app/api/predictions/route.ts

import "server-only"; // garante que não vaza para o bundle client

import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getAdminAuth, getAdminFirestore } from "@/server/firebaseAdmin";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookie";
import { predictionInputSchema } from "@/schemas";
import {
  isPredictionLocked,
  predictionDocId,
} from "@/features/predictions/lib";
import { fetchAllMatches } from "../_lib/apiFootballData";
import { apiFootballErrorResponse } from "../_lib/apiFootballError";

// Node runtime: firebase-admin + cookies() de next/headers exigem Node.
export const runtime = "nodejs";
// Force dynamic: lê cookies e grava no Firestore — sem cache.
export const dynamic = "force-dynamic";
```

### 6.2 Lógica de autenticação

A verificação do session cookie usa `auth.verifySessionCookie(sessionCookie, false)`:
- `checkRevoked: false` — performance (evita round-trip extra ao Firebase). Em revisão futura pode ser `true` para revogação imediata após logout.
- Em caso de exceção (token expirado, inválido, malformado) → catch → 401.

A verificação de status usa `db.collection("users").doc(uid).get()` via Admin SDK. O campo `status` no doc segue `userStatusSchema` (`"pending" | "approved" | "blocked"`). Apenas `"approved"` tem acesso.

**Não há helper existente** para essa verificação — é o **primeiro** Route Handler autenticado (além do próprio `/api/auth/session`). A lógica ficará inline no handler. Se futuros Route Handlers precisarem da mesma auth, extrair para `src/app/api/_lib/requireApprovedUser.ts` — mas não criar agora (YAGNI até TASK-04 precisar).

### 6.3 Validação do body

```ts
let json: unknown;
try {
  json = await request.json();
} catch {
  return NextResponse.json(
    { error: "Corpo da requisição inválido (JSON esperado)." },
    { status: 400 },
  );
}

const parsed = predictionInputSchema.safeParse(json);
if (!parsed.success) {
  return NextResponse.json(
    { error: "Dados de entrada inválidos.", issues: parsed.error.issues },
    { status: 422 },
  );
}
const { matchId, homeScore, awayScore } = parsed.data;
```

`predictionInputSchema` (`src/schemas/predictions.ts:34-38`) valida: `matchId: nonEmptyString`, `homeScore: scoreSchema` (int ≥ 0), `awayScore: scoreSchema` (int ≥ 0).

### 6.4 Busca de partida e verificação de lock

```ts
let matches: MatchWithId[];
try {
  matches = await fetchAllMatches();
} catch (err) {
  return apiFootballErrorResponse(err);
}

const match = matches.find((m) => m.id === matchId);
if (!match) {
  return NextResponse.json({ error: "Partida não encontrada." }, { status: 404 });
}

const now = new Date();
if (isPredictionLocked(match, now)) {
  return NextResponse.json(
    { error: "O prazo para palpites nesta partida foi encerrado." },
    { status: 423 },
  );
}
```

`isPredictionLocked` importado de `@/features/predictions/lib` (barrel, nunca path direto).

### 6.5 Gravação via Admin SDK

```ts
const db = getAdminFirestore();
const docId = predictionDocId(uid, matchId);
const docRef = db.collection("predictions").doc(docId);

const snap = await docRef.get();
const isCreate = !snap.exists;
const nowIso = now.toISOString();

const payload: Record<string, unknown> = {
  uid,
  matchId,
  homeScore,
  awayScore,
  updatedAt: nowIso,
};

if (isCreate) {
  payload.createdAt = nowIso;
}

await docRef.set(payload, { merge: true });
```

**Por que `set({ merge: true })`:** preserva campos existentes (`status`, `points`, `createdAt`) que não fazem parte do payload do cliente. Um `update()` falharia se o doc não existisse (create); `set({ merge: true })` é semanticamente equivalente a "upsert".

**Campos NUNCA gravados pelo cliente:** `status`, `points` — esses são responsabilidade exclusiva do Route Handler de pontuação (TASK-04).

### 6.6 Resposta de sucesso

```ts
return NextResponse.json(
  {
    prediction: {
      id: docId,
      uid,
      matchId,
      homeScore,
      awayScore,
    },
  },
  { status: isCreate ? 201 : 200 },
);
```

Usar `201 Created` para create e `200 OK` para update — semântica HTTP correta e útil para o client-side (`useUpsertPrediction` em TASK-06) distinguir o caso.

---

## 7. Mapeamento de erros HTTP

| Situação | Status | `error` (pt-BR) |
|---|---|---|
| Cookie ausente | 401 | `"Não autenticado."` |
| Cookie inválido/expirado | 401 | `"Não autenticado."` |
| Doc `users/{uid}` inexistente | 401 | `"Não autenticado."` |
| `status !== "approved"` | 403 | `"Acesso não autorizado."` |
| Body não é JSON | 400 | `"Corpo da requisição inválido (JSON esperado)."` |
| Body falha `predictionInputSchema` | 422 | `"Dados de entrada inválidos."` + `issues` |
| Partida não encontrada | 404 | `"Partida não encontrada."` |
| `fetchAllMatches` lança quota/auth/timeout | 503/502/504 | Delegado a `apiFootballErrorResponse` |
| `isPredictionLocked` retorna `true` | 423 | `"O prazo para palpites nesta partida foi encerrado."` |
| Erro de escrita no Firestore | 500 | `"Erro ao salvar o palpite."` |
| Create bem-sucedido | 201 | (sem `error`) → `{ prediction: { id, uid, matchId, homeScore, awayScore } }` |
| Update bem-sucedido | 200 | (sem `error`) → `{ prediction: { id, uid, matchId, homeScore, awayScore } }` |

**Shape de erro consistente:** `{ error: string }` — mesmo padrão de `src/app/api/auth/session/route.ts` e `src/app/api/matches/[id]/route.ts`. O campo `issues` no 422 é adicional (debug do client).

---

## 8. Estrutura de arquivos resultante

```
src/app/api/predictions/
├── route.ts                  # POST handler (este arquivo)
└── __tests__/
    └── route.test.ts         # suite Vitest (via /tdd)
```

A pasta `score/` (TASK-04) ficará em:
```
src/app/api/predictions/score/
└── route.ts
```

---

## 9. Contrato de imports

```ts
// Sessão e Admin SDK
import { cookies } from "next/headers";
import { getAdminAuth, getAdminFirestore } from "@/server/firebaseAdmin";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookie";

// Schema de input do body
import { predictionInputSchema } from "@/schemas";
// Equivalente (mesmo re-export): import { predictionInputSchema } from "@/schemas/predictions";

// Funções puras — SEMPRE via barrel, NUNCA path direto para arquivo
import { isPredictionLocked, predictionDocId } from "@/features/predictions/lib";

// Cache de partidas do servidor
import { fetchAllMatches } from "../_lib/apiFootballData";
// Equivalente absoluto: import { fetchAllMatches } from "@/app/api/_lib/apiFootballData";

// Helper de erros de integração com API-Football (reutilizado para erros de fetchAllMatches)
import { apiFootballErrorResponse } from "../_lib/apiFootballError";
```

**Proibições de import:**
- `import { isPredictionLocked } from "@/features/predictions/lib/predictionsHelpers"` — caminho direto, proibido.
- `import { predictionDocId } from "@/features/predictions/lib/predictionHelpers"` — arquivo não existe.
- Qualquer import de `@/firebase` (Client SDK) — este arquivo usa **exclusivamente Admin SDK**.
- `import "server-only"` é **obrigatório** no topo.

---

## 10. Casos de teste (para `/tdd`)

Os testes mockam:
- `@/server/firebaseAdmin` — `getAdminAuth` (retorna `{ verifySessionCookie: fn }`) + `getAdminFirestore` (retorna `{ collection: fn }` com chain `doc().get()` e `doc().set()`).
- `../../../_lib/apiFootballData` (ou caminho equivalente) — `fetchAllMatches`.
- `next/headers` — `cookies` (retorna `{ get: fn }` com o cookie simulado).
- `@/features/predictions/lib` — `isPredictionLocked` (quando testar comportamento de lock independentemente de data real).

### Casos obrigatórios:

| Caso | Input | Esperado |
|---|---|---|
| Sem cookie | cookie ausente | 401 `"Não autenticado."` |
| Cookie inválido | `verifySessionCookie` lança | 401 `"Não autenticado."` |
| Usuário não aprovado | status `"pending"` no Firestore | 403 `"Acesso não autorizado."` |
| Usuário bloqueado | status `"blocked"` no Firestore | 403 `"Acesso não autorizado."` |
| Body inválido — matchId vazio | `{ matchId: "", homeScore: 1, awayScore: 0 }` | 422 com `issues` |
| Body inválido — score negativo | `{ matchId: "123", homeScore: -1, awayScore: 0 }` | 422 com `issues` |
| Body inválido — score decimal | `{ matchId: "123", homeScore: 1.5, awayScore: 0 }` | 422 com `issues` |
| Partida inexistente | `matchId` não encontrado em `fetchAllMatches` | 404 `"Partida não encontrada."` |
| Partida bloqueada | `isPredictionLocked` → `true` | 423 `"O prazo para palpites nesta partida foi encerrado."` |
| Create bem-sucedido | doc não existe, dados válidos, não bloqueado | 201 `{ prediction: { id, uid, matchId, homeScore, awayScore } }` |
| Update bem-sucedido | doc já existe, dados válidos, não bloqueado | 200 `{ prediction: { id, uid, matchId, homeScore, awayScore } }` |
| `fetchAllMatches` lança quota | `ApiFootballQuotaError` | 503 |
| Erro de escrita no Firestore | `docRef.set()` lança | 500 `"Erro ao salvar o palpite."` |

### Padrão de mock (alinhado com `src/app/api/auth/session/__tests__/route.test.ts`):

```ts
const { verifySessionCookieMock, getFirestoreMock } = vi.hoisted(() => ({
  verifySessionCookieMock: vi.fn(),
  getFirestoreMock: vi.fn(),
}));

vi.mock("@/server/firebaseAdmin", () => ({
  getAdminAuth: () => ({ verifySessionCookie: verifySessionCookieMock }),
  getAdminFirestore: getFirestoreMock,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("../../../_lib/apiFootballData", () => ({
  fetchAllMatches: fetchAllMatchesMock,
}));
```

---

## 11. Decisões de design registradas

### D1 — `verifySessionCookie` vs re-uso de `verifySession` (jose)

O middleware usa `verifySession` (jose, edge-compatible) porque o Admin SDK não roda no edge. Route Handlers rodam em Node — usar `auth.verifySessionCookie()` do Admin SDK é o caminho correto, mais simples e sem dependência de `jose`. Não reutilizar o mecanismo do middleware em Route Handlers.

### D2 — `checkRevoked: false` em `verifySessionCookie`

Evita um round-trip extra ao Firebase Auth por requisição de escrita. Aceitável para o MVP (< 100 usuários, baixo risco de sessão revogada ativa). Pode ser promovido a `true` em revisão futura se necessário.

### D3 — Status `"approved"` lido do Firestore, não do token

O session cookie/ID token não carrega `status` como custom claim — esse campo vive exclusivamente em `users/{uid}` no Firestore. A leitura via Admin SDK tem custo de 1 read por request de palpite, mas é a fonte de verdade correta. Alternativa descartada: adicionar `status` como custom claim exigiria atualizar o claim em toda mudança de status de usuário (complexidade desnecessária para < 100 usuários).

### D4 — `set({ merge: true })` para upsert

`set({ merge: true })` cria o doc se não existir e mescla se existir — comportamento exato de upsert. Alternativas descartadas:
- `update()` — falha se doc não existe (só para update).
- `set()` sem merge — sobrescreve tudo, apagando `status`/`points`/`createdAt` gravados pelo TASK-04.

### D5 — Nunca gravar `status`/`points`

Separação de responsabilidades: TASK-03 = write do cliente (placar previsto); TASK-04 = write do servidor (resultado da comparação). O campo `status` do Firestore representa a pontuação calculada — não confundir com `status` do `users` doc.

### D6 — Auth inline (não extrair helper ainda)

YAGNI: extrair `requireApprovedUser()` para `src/app/api/_lib/` só quando TASK-04 precisar do mesmo padrão. Não antecipar abstração.

### D7 — Id determinístico `predictionDocId(uid, matchId)`

`uid_matchId` garante unicidade sem query de existência. `uid` do Firebase Auth nunca contém `_`; `matchId` é numérico — o separador `_` é inequívoco. Implementado em `src/features/predictions/lib/predictionsHelpers.ts:23-25`.

### D8 — `fetchAllMatches` no handler de POST com `force-dynamic`

`fetchAllMatches` faz fetch HTTP com ISR do Next.js; dentro de um route `force-dynamic`, o Next.js respeita o cache de fetch configurado na origem (o fetch interno de `getApiFootballClient` tem seu próprio cache). Isso é seguro para o bloqueio temporal: o `kickoffAt` é estável (não muda após criação da partida), então um valor em cache ainda é correto para verificação de lock.

---

## 12. Critérios de aceitação

- [ ] `POST /api/predictions` sem cookie retorna 401.
- [ ] `POST /api/predictions` com cookie inválido retorna 401.
- [ ] `POST /api/predictions` com usuário `"pending"` retorna 403.
- [ ] `POST /api/predictions` com usuário `"blocked"` retorna 403.
- [ ] Body com `matchId` vazio retorna 422.
- [ ] Body com `homeScore` negativo retorna 422.
- [ ] Body com `homeScore` decimal retorna 422.
- [ ] `matchId` não encontrado retorna 404.
- [ ] Partida bloqueada (`isPredictionLocked === true`) retorna 423.
- [ ] Create bem-sucedido retorna 201 com `{ prediction: { id, uid, matchId, homeScore, awayScore } }`.
- [ ] Update bem-sucedido retorna 200 com `{ prediction: { id, uid, matchId, homeScore, awayScore } }`.
- [ ] Doc id gerado é `${uid}_${matchId}` (verificável no mock do Firestore).
- [ ] Payload gravado contém `uid`, `matchId`, `homeScore`, `awayScore`, `updatedAt`.
- [ ] Payload de create adiciona `createdAt`; payload de update **não sobrescreve** `createdAt`.
- [ ] Payload gravado **nunca** contém `status` nem `points`.
- [ ] `set({ merge: true })` é chamado (não `update()` nem `set()` sem merge).
- [ ] `isPredictionLocked` é importado de `@/features/predictions/lib` (barrel).
- [ ] `predictionDocId` é importado de `@/features/predictions/lib` (barrel).
- [ ] `import "server-only"` está no topo do arquivo.
- [ ] `export const runtime = "nodejs"` presente.
- [ ] `export const dynamic = "force-dynamic"` presente.
- [ ] `rtk tsc` sem erros após implementação.
- [ ] Sem `any` introduzido.
- [ ] Todos os casos de teste da seção 10 cobertura verde.

---

## 13. O que esta tarefa NÃO faz

- Não cria `GET /api/predictions` — leitura é via Client SDK (`listPredictionsByUid`).
- Não cria `POST /api/predictions/score` — Route Handler de pontuação (TASK-04).
- Não modifica Security Rules (`firestore.rules`) — TASK-05.
- Não cria o service fetch do client (`upsertPrediction`) nem hooks TanStack Query — TASK-06.
- Não cria nenhum componente de UI ou página — TASK-07/08/09.
- Não grava `status` nem `points` em nenhuma circunstância.
- Não configura cron ou agendador externo — infra (R7 do PRD).
- Não extrai helper `requireApprovedUser` — YAGNI (aguardar TASK-04).
