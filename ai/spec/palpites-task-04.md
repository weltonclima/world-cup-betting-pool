# SPEC — TASK-04: Route Handler de pontuação (`POST /api/predictions/score`)

> PRD: `ai/prd/palpites.md` | Plano: `ai/plan/palpites.md` | Branch: `feat/integracao-api-football`
> Tipo: api | SP: 5 | Criticidade: high | Risco técnico: high
> TDD recomendado: yes (testes via `/tdd` separado). Sem tela.
> Depende de: TASK-01 (schema + tipos concluídos) | TASK-02 (lib pura concluída — `scorePrediction`)

---

## 1. Objetivo

Criar `src/app/api/predictions/score/route.ts` com um único handler `POST` que calcula e grava `status`/`points` binários em todos os palpites das partidas finalizadas.

O handler:
1. É **protegido** — aceita chamada apenas de: (a) header `x-cron-secret` correspondente à env var `SCORE_SECRET`, **ou** (b) sessão admin (`role === "admin"` via cookie `__session`). Caso contrário → 401/403.
2. Busca **todas** as partidas via `fetchAllMatches()` e filtra as de `status === "finished"`.
3. Para cada partida `finished`, busca **todos** os palpites daquela `matchId` na coleção `predictions` via Admin SDK (query `where matchId == <matchId>`).
4. Para cada palpite encontrado, calcula `scorePrediction(prediction, match)` (importado do barrel `@/features/predictions/lib`) e grava `{ status, points }` via Admin SDK com `set({ merge: true })`.
5. É **idempotente** — re-rodar não altera o resultado (o mesmo `status`/`points` são gravados novamente via merge; sem efeito colateral adicional).
6. Responde com sumário `{ scoredMatches: number, updatedPredictions: number }`.
7. **Não** atualiza ranking — só grava `status`/`points` em cada doc de `predictions`.

---

## 2. Investigação: mecanismos existentes

### (a) Como o projeto lê variáveis de ambiente server-side / convenção de secret

**Conclusão:** O projeto usa `process.env["NOME_VAR"]` diretamente (sem wrapper) para segredos server-only. Não há um helper de leitura de env para segredos — o padrão é leitura literal + verificação em runtime.

Evidências:

- `src/server/firebaseAdmin.ts:44` — `process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true"`
- `src/server/firebaseAdmin.ts:51` — `process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `src/server/firebaseAdmin.ts:59` — `process.env.FIREBASE_SERVICE_ACCOUNT_KEY` (segredo server-only, sem prefixo `NEXT_PUBLIC_`)
- `src/server/apiFootball/config.ts:31` — `process.env["API_FOOTBALL_USE_MOCK"] === "true"`
- `src/firebase/env.ts:29-41` — schema Zod para vars `NEXT_PUBLIC_*` (apenas client SDK; vars de segredo não passam por este arquivo)
- `.env.local.example` e `functions/.env.example` — não há nenhuma variável de segredo para endpoint de scoring ainda

**Convenção de nome para a nova secret:**
O projeto usa `SNAKE_UPPER_CASE` sem prefixo para vars server-only (ex. `FIREBASE_SERVICE_ACCOUNT_KEY`, `API_FOOTBALL_KEY`). A nova variável será:

```
SCORE_SECRET=<valor-aleatorio-criptograficamente-seguro>
```

Leitura no handler:
```ts
const cronSecret = process.env["SCORE_SECRET"];
```

O header de chamada será `x-cron-secret` (convenção comum para chamadas de cron externo ao Next.js). O cliente (GitHub Actions / Cloud Scheduler) deve enviar:
```
POST /api/predictions/score
x-cron-secret: <valor-de-SCORE_SECRET>
```

**Os arquivos `.env.local.example` e `.env.production.example` devem ser atualizados** com a nova variável (documentação — não implementado nesta tarefa, mas mencionado nos critérios de aceitação).

---

### (b) Como verificar role admin server-side

**Conclusão:** O mecanismo é o mesmo da TASK-03 — session cookie httpOnly `__session` verificado via Admin SDK (`verifySessionCookie`) — mas há uma diferença importante: o campo `role` **não está no session cookie** como custom claim neste projeto (vem do Firestore). Portanto, a verificação de admin exige leitura do doc `users/{uid}` no Firestore, igual ao TASK-03, e checar `data.role === "admin"`.

**Evidências file:line:**

- `src/server/auth/verifySession.ts:100` — `return { valid: true, role: normalizeRole(payload.role) }` — no **middleware edge**, o `role` vem do JWT payload (custom claim). Porém o middleware usa `jose` para edge; Route Handlers usam Admin SDK.
- `src/server/auth/verifySession.ts:51-53` — `normalizeRole` aceita `"admin" | "user"` do payload JWT.
- `src/server/firebaseAdmin.ts:95-103` — `getAdminAuth()` e `getAdminFirestore()` usados em Route Handlers Node.
- `src/app/api/predictions/route.ts:54-67` — padrão estabelecido por TASK-03: `verifySessionCookie` → `uid`; depois `db.collection("users").doc(uid).get()` → `userData.status`. Para o admin check: adicionar `userData.role === "admin"` após obter o doc.
- `src/server/auth/sessionCookie.ts:12` — `SESSION_COOKIE_NAME = "__session"`.

**Observação sobre custom claims vs Firestore:** O middleware edge lê `role` do JWT claim (via `jose`), sugerindo que `role` pode estar definido como custom claim no token. No entanto, como a rota de score roda em Node runtime (não edge), o caminho mais confiável e consistente com TASK-03 é ler do Firestore. Se custom claims forem definitivamente configurados no projeto, o `decodedToken.role` do `verifySessionCookie` também funcionaria — mas isso não foi confirmado em código existente no server-side de Route Handlers. **Decisão:** usar Firestore (mesma fonte do TASK-03), verificando `userData.role === "admin"`.

**Fluxo de verificação admin no handler:**
```ts
const decodedToken = await auth.verifySessionCookie(sessionCookie, false);
const uid = decodedToken.uid;
const db = getAdminFirestore();
const userSnap = await db.collection("users").doc(uid).get();
if (!userSnap.exists) return 401;
const userData = userSnap.data();
if (userData?.role !== "admin") return 403;
```

---

## 3. Mecanismo de proteção duplo

O endpoint aceita chamadas de **duas fontes autorizadas**:

### Fonte A — Cron externo (header secret)
```
POST /api/predictions/score
x-cron-secret: <SCORE_SECRET>
Content-Type: application/json
```
Verificação: `request.headers.get("x-cron-secret") === process.env["SCORE_SECRET"]` (e `SCORE_SECRET` não pode ser `undefined` ou vazio).

### Fonte B — Administrador logado (sessão admin)
Admin abre o painel e dispara manualmente. Verificação: mesmo padrão de sessão do TASK-03, mas verificando `role === "admin"` ao invés de `status === "approved"`.

### Fluxo de decisão de proteção
```
1. Checar header x-cron-secret:
   └─ SCORE_SECRET definida E valor bate → autorizado (cron)
2. Se não autorizado por secret, checar cookie de sessão:
   └─ Cookie presente + verifySessionCookie OK + role === "admin" → autorizado (admin)
3. Nenhum dos dois → 401 "Não autorizado."
```

**Por que 401 (e não 403) para ausência total de credencial:** Ausência de token/secret é um caso de não-autenticado, mesmo num endpoint machine-to-machine.

---

## 4. Escopo

### Dentro do escopo
- `src/app/api/predictions/score/route.ts` — handler `POST`.
- `src/app/api/predictions/score/__tests__/route.test.ts` — suite Vitest (via `/tdd`).
- `export const runtime = "nodejs"` e `export const dynamic = "force-dynamic"`.

### Fora do escopo
- Configuração do cron externo (Cloud Scheduler, GitHub Actions) — infra externa (R7 do PRD).
- Atualização de ranking — PRD próprio.
- Endpoint `GET /api/predictions/score` — não existe.
- Qualquer componente de UI ou página.
- Botão admin na UI para acionar manualmente — TASK-07/08 ou painel admin.
- Extração de helper `requireApprovedUser` ou `requireAdmin` — YAGNI (inline no handler).

---

## 5. Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/app/api/predictions/score/route.ts` | **Criar** — handler POST (scoring) |
| `src/app/api/predictions/score/__tests__/route.test.ts` | **Criar** via `/tdd` |

Nenhum arquivo existente é modificado por esta tarefa.

---

## 6. Fluxo completo do handler `POST /api/predictions/score`

```
POST /api/predictions/score
  ├─ 1. Tentar autorização por header secret
  │     └─ SCORE_SECRET definida E header x-cron-secret == SCORE_SECRET → autorizado (cron)
  ├─ 2. (Se não autorizado por secret) Tentar autorização por sessão admin
  │     ├─ Cookie __session ausente → 401 "Não autorizado."
  │     ├─ verifySessionCookie lança → 401 "Não autorizado."
  │     ├─ users/{uid}.role !== "admin" → 403 "Acesso negado."
  │     └─ role === "admin" → autorizado (admin)
  ├─ 3. Buscar partidas via fetchAllMatches()
  │     └─ Lança (quota/auth/timeout) → apiFootballErrorResponse(err)
  ├─ 4. Filtrar partidas finished
  │     └─ matches.filter(m => m.status === "finished")
  │     └─ Nenhuma → retornar 200 { scoredMatches: 0, updatedPredictions: 0 }
  ├─ 5. Para cada partida finished:
  │     ├─ Buscar palpites: db.collection("predictions").where("matchId", "==", m.id).get()
  │     ├─ Para cada palpite no snapshot:
  │     │   ├─ Parsear com predictionSchema.safeParse(doc.data())
  │     │   ├─ Se parse falhar → log/skip (não lança)
  │     │   ├─ Chamar scorePrediction(prediction, match) → { status, points }
  │     │   └─ doc.ref.set({ status, points }, { merge: true }) → gravar/atualizar
  │     └─ Acumular contadores: scoredMatchesCount++, updatedPredictionsCount += docs.size
  ├─ 6. Retornar 200 { scoredMatches, updatedPredictions }
  └─ Qualquer erro não tratado → 500 "Erro interno ao calcular pontuação."
```

---

## 7. Implementação detalhada

### 7.1 Configuração do arquivo

```ts
// src/app/api/predictions/score/route.ts

import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getAdminAuth, getAdminFirestore } from "@/server/firebaseAdmin";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookie";
import { predictionSchema } from "@/schemas";
import { scorePrediction } from "@/features/predictions/lib";
import { fetchAllMatches } from "../../_lib/apiFootballData";
import { apiFootballErrorResponse } from "../../_lib/apiFootballError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

### 7.2 Lógica de autorização dupla

```ts
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ─── 1. Autorização: header secret (cron externo) ─────────────────────────
  const cronSecret = process.env["SCORE_SECRET"];
  const headerSecret = request.headers.get("x-cron-secret");

  let authorized = false;

  if (cronSecret && cronSecret.length > 0 && headerSecret === cronSecret) {
    authorized = true;
  }

  // ─── 2. Autorização: sessão admin (fallback) ──────────────────────────────
  if (!authorized) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const auth = getAdminAuth();
    let uid: string;
    try {
      const decodedToken = await auth.verifySessionCookie(sessionCookie, false);
      uid = decodedToken.uid;
    } catch {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const db = getAdminFirestore();
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const userData = userSnap.data();
    if (userData?.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    authorized = true;
  }
  // ... continua
```

### 7.3 Busca e filtragem de partidas

```ts
  // ─── 3. Buscar e filtrar partidas finished ────────────────────────────────
  let matches: Awaited<ReturnType<typeof fetchAllMatches>>;
  try {
    matches = await fetchAllMatches();
  } catch (err) {
    return apiFootballErrorResponse(err);
  }

  const finishedMatches = matches.filter((m) => m.status === "finished");

  if (finishedMatches.length === 0) {
    return NextResponse.json(
      { scoredMatches: 0, updatedPredictions: 0 },
      { status: 200 },
    );
  }
```

### 7.4 Loop de pontuação — query + set merge

```ts
  // ─── 4. Calcular e gravar pontuação ──────────────────────────────────────
  const db = getAdminFirestore();   // já declarado acima se path admin; reusar
  let scoredMatches = 0;
  let updatedPredictions = 0;

  for (const match of finishedMatches) {
    const snapshot = await db
      .collection("predictions")
      .where("matchId", "==", match.id)
      .get();

    if (snapshot.empty) continue;

    for (const docSnap of snapshot.docs) {
      const parsed = predictionSchema.safeParse(docSnap.data());
      if (!parsed.success) continue; // skip docs malformados

      const { status, points } = scorePrediction(parsed.data, match);

      // Idempotente: set({ merge: true }) sempre grava os mesmos valores
      await docSnap.ref.set({ status, points }, { merge: true });
      updatedPredictions++;
    }

    scoredMatches++;
  }

  return NextResponse.json({ scoredMatches, updatedPredictions }, { status: 200 });
}
```

**Nota sobre idempotência:** `set({ merge: true })` com `{ status, points }` sempre grava os mesmos valores derivados de `scorePrediction` — que é função pura. Re-rodar produz exatamente o mesmo resultado no Firestore (idempotente por construção).

**Nota sobre `db` reuso:** Se a autorização foi via sessão admin, `db` já foi declarado — extrair `getAdminFirestore()` para antes do bloco de autorização ou declarar novamente (o Admin SDK usa singleton, chamadas duplicadas a `getAdminFirestore()` retornam a mesma instância). Solução prática: declarar `db` na raiz do handler (antes do bloco de auth), pois `getAdminFirestore()` não tem efeito colateral e é lazy.

### 7.5 Estrutura limpa do handler (versão final)

```ts
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ─── Autorização ──────────────────────────────────────────────────────────
  const cronSecret = process.env["SCORE_SECRET"];
  const headerSecret = request.headers.get("x-cron-secret");
  let authorized = !!(cronSecret && cronSecret.length > 0 && headerSecret === cronSecret);

  const db = getAdminFirestore(); // singleton — seguro chamar antes da auth

  if (!authorized) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const auth = getAdminAuth();
    let uid: string;
    try {
      uid = (await auth.verifySessionCookie(sessionCookie, false)).uid;
    } catch {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const userData = userSnap.data();
    if (userData?.role !== "admin") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  // ─── Partidas finished ────────────────────────────────────────────────────
  let matches: Awaited<ReturnType<typeof fetchAllMatches>>;
  try {
    matches = await fetchAllMatches();
  } catch (err) {
    return apiFootballErrorResponse(err);
  }

  const finishedMatches = matches.filter((m) => m.status === "finished");

  if (finishedMatches.length === 0) {
    return NextResponse.json({ scoredMatches: 0, updatedPredictions: 0 });
  }

  // ─── Loop de pontuação ────────────────────────────────────────────────────
  let scoredMatches = 0;
  let updatedPredictions = 0;

  for (const match of finishedMatches) {
    const snapshot = await db
      .collection("predictions")
      .where("matchId", "==", match.id)
      .get();

    for (const docSnap of snapshot.docs) {
      const parsed = predictionSchema.safeParse(docSnap.data());
      if (!parsed.success) continue;
      const { status, points } = scorePrediction(parsed.data, match);
      await docSnap.ref.set({ status, points }, { merge: true });
      updatedPredictions++;
    }

    scoredMatches++;
  }

  return NextResponse.json({ scoredMatches, updatedPredictions });
}
```

---

## 8. Contrato de imports

```ts
// Segurança de bundle server
import "server-only";

// Next.js
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Admin SDK (via barrel server-only)
import { getAdminAuth, getAdminFirestore } from "@/server/firebaseAdmin";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookie";

// Schema para parsear docs do Firestore
import { predictionSchema } from "@/schemas";
// Equivalente: import { predictionSchema } from "@/schemas/predictions";

// Função pura de pontuação — SEMPRE via barrel, NUNCA path direto
import { scorePrediction } from "@/features/predictions/lib";

// Cache de partidas do servidor
import { fetchAllMatches } from "../../_lib/apiFootballData";
// Equivalente absoluto: import { fetchAllMatches } from "@/app/api/_lib/apiFootballData";

// Helper de erros de integração com API-Football
import { apiFootballErrorResponse } from "../../_lib/apiFootballError";
```

**Proibições de import:**
- `import { scorePrediction } from "@/features/predictions/lib/predictionsHelpers"` — path direto, proibido.
- Qualquer import de `@/firebase` (Client SDK) — este arquivo usa exclusivamente Admin SDK.
- `import "server-only"` é **obrigatório** no topo.
- `process.env.SCORE_SECRET` — usar `process.env["SCORE_SECRET"]` (subscript notation — padrão do projeto conforme `config.ts:31`).

---

## 9. Mapeamento de erros HTTP

| Situação | Status | Corpo |
|---|---|---|
| Secret ausente E sem cookie | 401 | `{ error: "Não autorizado." }` |
| Secret errado E cookie inválido | 401 | `{ error: "Não autorizado." }` |
| Secret errado E cookie válido, role != admin | 403 | `{ error: "Acesso negado." }` |
| `fetchAllMatches` lança quota/auth/timeout | 503/502/504 | Delegado a `apiFootballErrorResponse` |
| Nenhuma partida finished | 200 | `{ scoredMatches: 0, updatedPredictions: 0 }` |
| Sucesso | 200 | `{ scoredMatches: N, updatedPredictions: M }` |
| Erro interno não tratado | 500 | `{ error: "Erro interno ao calcular pontuação." }` |

---

## 10. Idempotência — análise formal

Dado o mesmo conjunto de partidas `finished` com os mesmos placares oficiais e o mesmo conjunto de palpites:

1. `scorePrediction(prediction, match)` é **função pura** — determinística, sem side effects.
2. `set({ status, points }, { merge: true })` grava exatamente os mesmos valores — a segunda execução não altera o doc além de reescrever os mesmos campos.
3. Os contadores `scoredMatches` e `updatedPredictions` podem diferir entre execuções se novos palpites forem criados entre as runs — mas o **estado dos docs existentes** é idempotente.

**Edge case:** Se um palpite for criado após a primeira run de scoring, ele será pontuado na segunda run — comportamento esperado e correto.

---

## 11. Decisões de design registradas

### D1 — Duplo mecanismo de proteção (secret + admin session)
Flexibilidade operacional: o cron externo usa o header secret (sem browser, sem sessão); o admin humano usa a sessão existente. Evitar um terceiro mecanismo ou API key separada.

### D2 — `SCORE_SECRET` via `process.env["SCORE_SECRET"]` (subscript notation)
Padrão do projeto (`src/server/apiFootball/config.ts:31` usa subscript para `"API_FOOTBALL_USE_MOCK"`). Evita lint warnings em strict TypeScript com template literals como chaves.

### D3 — Header `x-cron-secret` (não `Authorization: Bearer`)
Convenção comum para cron-to-Next.js calls (Next.js own docs usam `x-cron-secret`). Mais legível e explícito do que reutilizar o Bearer scheme.

### D4 — Verificar `role === "admin"` do Firestore (não do token)
Mesmo padrão do TASK-03 para consistência. O `role` pode estar em custom claims (evidenciado pelo middleware), mas a leitura do Firestore é a fonte de verdade usada nos Route Handlers do projeto.

### D5 — `scorePrediction` do barrel, não path direto
Contrato arquitetural: funções puras de `features/predictions/lib` são importadas sempre via barrel `@/features/predictions/lib`. Facilita mock nos testes e manutenção.

### D6 — `predictionSchema.safeParse` (não `.parse`) para docs do Firestore
Docs malformados no Firestore (ex: campo faltando por bug histórico) não devem travar o scoring inteiro. `safeParse` com `continue` no `if (!parsed.success)` é tolerante a falhas individuais sem comprometer os outros docs.

### D7 — Loop `for...of` (não `Promise.all`)
Para `< 100` usuários e `64` partidas, o overhead do loop serial é negligível. `Promise.all` em lote traria complexidade desnecessária e risco de concorrência de escrita. KISS para o MVP.

### D8 — `scoredMatches++` mesmo se o snapshot for vazio
Partida `finished` sem palpites ainda conta como "processada" no sentido de que foi inspecionada. Alternativamente, contar apenas partidas com palpites atualizados. Decisão: contar partidas inspecionadas (mais transparente no log de operação). Pode ser revisado se confuso.

### D9 — Sem YAGNI: não extrair `requireAdmin`
Como mencionado no TASK-03 (`spec D6`), a extração para `src/app/api/_lib/requireAdmin.ts` só vale quando um terceiro Route Handler precisar. Neste momento só TASK-03 (approved user) e TASK-04 (admin) — padrões similares mas não idênticos. Inline.

---

## 12. Estrutura de arquivos resultante

```
src/app/api/predictions/
├── route.ts                  # POST handler upsert (TASK-03 — já existe)
├── __tests__/
│   └── route.test.ts         # testes TASK-03
└── score/
    ├── route.ts              # POST handler scoring (este arquivo — TASK-04)
    └── __tests__/
        └── route.test.ts     # testes TASK-04 (via /tdd)
```

---

## 13. Casos de teste (para `/tdd`)

Os testes mockam:
- `@/server/firebaseAdmin` — `getAdminAuth` (retorna `{ verifySessionCookie: fn }`) + `getAdminFirestore` (retorna `{ collection: fn }` com chain `where().get()` + `doc().get()` + `ref.set()`).
- `../../_lib/apiFootballData` — `fetchAllMatches`.
- `next/headers` — `cookies`.
- `@/features/predictions/lib` — `scorePrediction` (spy ou mock controlado).
- `server-only` → `{}`.
- `process.env["SCORE_SECRET"]` — via `vi.stubEnv` ou mockReturnValue.

### Casos obrigatórios:

| # | Caso | Input | Esperado |
|---|---|---|---|
| 1 | Sem secret E sem cookie | `SCORE_SECRET` set, header ausente, cookie ausente | 401 |
| 2 | Secret errado E sem cookie | header `x-cron-secret: errado`, sem cookie | 401 |
| 3 | Secret errado E cookie válido, role != admin | header errado, cookie de user normal | 403 `"Acesso negado."` |
| 4 | Autorizado por secret — sucesso | header correto, partidas finished, palpites existentes | 200 `{ scoredMatches, updatedPredictions }` |
| 5 | Autorizado por sessão admin — sucesso | sem header, cookie admin válido | 200 `{ scoredMatches, updatedPredictions }` |
| 6 | Binário — placar exato → correct + points 1 | prediction(2,1) × match(2,1) | `status:"correct"`, `points:1` gravados |
| 7 | Binário — placar errado → wrong + points 0 | prediction(1,0) × match(2,1) | `status:"wrong"`, `points:0` gravados |
| 8 | Partida não-finished é ignorada | matches com `status:"scheduled"` | `scoredMatches:0`, `updatedPredictions:0` |
| 9 | Partida finished sem palpites → zero updates | snapshot vazio | `updatedPredictions:0`, `scoredMatches:1` |
| 10 | Idempotência — mesmos valores gravados na 2ª run | rodar 2x com mesmos dados | `set()` chamado com mesmos `{status, points}` |
| 11 | `fetchAllMatches` lança quota | `ApiFootballQuotaError` | 503 |
| 12 | Sumário correto | 3 partidas finished, 5 palpites total | `{ scoredMatches:3, updatedPredictions:5 }` |

---

## 14. Atualização necessária em `.env.local.example`

Adicionar ao `.env.local.example` (fora do escopo desta tarefa, mas necessário para onboarding):

```env
# --- SCORING ENDPOINT (SERVER-ONLY — segredo do cron externo) ---
# Gere um valor aleatório forte: openssl rand -base64 32
# Enviado como header: x-cron-secret: <valor>
SCORE_SECRET=
```

---

## 15. Critérios de aceitação

- [ ] `POST /api/predictions/score` sem header e sem cookie retorna 401.
- [ ] `POST /api/predictions/score` com header errado e sem cookie retorna 401.
- [ ] `POST /api/predictions/score` com header errado e sessão de user normal retorna 403.
- [ ] `POST /api/predictions/score` com `x-cron-secret` correto retorna 200.
- [ ] `POST /api/predictions/score` com sessão admin válida retorna 200.
- [ ] Palpite com placar exato → `status: "correct"`, `points: 1` gravados.
- [ ] Palpite com placar diferente → `status: "wrong"`, `points: 0` gravados.
- [ ] Partida com `status !== "finished"` é ignorada (não processada).
- [ ] Partida `finished` sem palpites → sem writes, `updatedPredictions` não incrementado.
- [ ] Re-rodar com mesmos dados → mesmos valores gravados (idempotente).
- [ ] Resposta inclui `{ scoredMatches, updatedPredictions }`.
- [ ] `scorePrediction` é importado de `@/features/predictions/lib` (barrel).
- [ ] `set({ merge: true })` é chamado com apenas `{ status, points }`.
- [ ] `import "server-only"` está no topo do arquivo.
- [ ] `export const runtime = "nodejs"` presente.
- [ ] `export const dynamic = "force-dynamic"` presente.
- [ ] `rtk tsc` sem erros após implementação.
- [ ] Sem `any` introduzido.
- [ ] Todos os casos de teste da seção 13 ficam verdes após implementação.

---

## 16. O que esta tarefa NÃO faz

- Não atualiza ranking — PRD próprio.
- Não configura cron externo — infra (R7 do PRD).
- Não cria botão admin na UI para acionar manualmente — TASK-07/08.
- Não modifica Security Rules — TASK-05.
- Não cria helpers reutilizáveis como `requireAdmin` — YAGNI.
- Não grava `kickoffAt`, `updatedAt`, `uid`, `matchId` ou outros campos além de `status`/`points`.
- Não lê o `SCORE_SECRET` em tempo de inicialização — lê em cada chamada via `process.env["SCORE_SECRET"]` (sem cache no módulo).
