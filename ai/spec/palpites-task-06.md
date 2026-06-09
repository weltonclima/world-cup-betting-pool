# SPEC — TASK-06: Client service (fetch) + hooks de mutação

> PRD: `ai/prd/palpites.md` | Plano: `ai/plan/palpites.md` | Branch: `feat/integracao-api-football`
> Tipo: application | SP: 3 | Criticidade: high | Risco técnico: medium
> TDD recomendado: no (hooks testados no /test). Sem tela.
> Depende de: TASK-01 (schema + tipos), TASK-03 (Route Handler POST /api/predictions concluído)

---

## 1. Objetivo

Expor à UI uma API client-side de **escrita de palpite** via `fetch` ao Route Handler criado na TASK-03, integrando com o cache TanStack Query e garantindo que o badge de palpite nos cards de Jogos e Home atualize automaticamente após cada upsert (R5 do PRD).

Artefatos desta tarefa:
- `src/services/predictions.ts` — adicionar `upsertPrediction`
- `src/features/predictions/hooks/predictionsKeys.ts` — namespace próprio
- `src/features/predictions/hooks/usePredictions.ts` — hook de leitura da feature
- `src/features/predictions/hooks/useUpsertPrediction.ts` — hook de mutação
- `src/features/predictions/hooks/index.ts` — barrel

---

## 2. Investigação: mecanismos existentes

### (a) Padrão dos hooks `usePredictions` e assinatura de `.predictions(uid)` nos key factories

**`features/matches/hooks/usePredictions.ts` (linha 22-28):**
```ts
export function usePredictions(uid: string | null): UseQueryResult<Prediction[]> {
  return useQuery({
    queryKey: matchesKeys.predictions(uid ?? ""),
    queryFn: () => listPredictionsByUid(uid!),
    enabled: uid !== null,
  });
}
```
- Recebe `uid: string | null` — null desabilita a query (`enabled: uid !== null`).
- Herda `staleTime`/`gcTime` do QueryClient global (30min/24h) — sem override local.
- Usa o namespace da própria feature (`matchesKeys`), nunca `homeKeys`.
- Importa `listPredictionsByUid` de `@/services` (barrel global de services).
- Importa o tipo `Prediction` de `@/types`.

**`features/home/hooks/usePredictions.ts` (linha 15-21):**
Padrão idêntico — só difere no key factory (`homeKeys.predictions(uid ?? "")`).

**`matchesKeys.predictions(uid)` — `src/features/matches/hooks/matchesKeys.ts:24`:**
```ts
predictions: (uid: string) => [...matchesKeys.all(), "predictions", uid] as const,
// Resultado: ["matches", "predictions", uid]
```

**`homeKeys.predictions(uid)` — `src/features/home/hooks/homeKeys.ts:12`:**
```ts
predictions: (uid: string) => ["home", "predictions", uid] as const,
```

**Padrão a espelhar na feature predictions:**
- `predictionsKeys.all` → `["predictions"] as const`
- `predictionsKeys.item(matchId)` → `["predictions", "item", matchId] as const`
- `usePredictions(uid: string | null)` → UseQueryResult sem override de staleTime

### (b) Como o uid do usuário autenticado é obtido no client

**`src/hooks/useAuth.ts` (linha 9-14):**
```ts
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error("useAuth deve ser usado dentro de <AuthProvider>.");
  return ctx;
}
```

**`src/providers/AuthProvider.tsx` — `AuthContextValue` (linhas 23-41):**
```ts
export interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: User | null;
  status: UserStatus | null;
  role: Role | null;
  loading: boolean;
  error: AuthProfileError | null;
  refreshProfile: () => Promise<void>;
}
```

O `uid` não está diretamente em `AuthContextValue`. O caller usa `firebaseUser.uid`:
```ts
const { firebaseUser } = useAuth();
const uid = firebaseUser?.uid ?? null;
```

Os hooks `usePredictions` existentes recebem `uid: string | null` como parâmetro — o componente consumidor chama `useAuth()` para obter o uid e o passa explicitamente. O hook de mutação `useUpsertPrediction` **não** precisa do uid no hook (o Route Handler extrai o uid do cookie de sessão).

### (c) Padrão de erro tipado/serviço existente e uso de Sonner toast

**Padrão de erro tipado no projeto:**

Não existe uma classe de erro genérica para serviços HTTP. O projeto tem dois padrões:
1. `src/features/auth/errors.ts` — função pura `mapAuthError(code)` que converte código de FirebaseError em string pt-BR.
2. `src/features/admin/components/userActionErrors.ts` — função pura `mapUserActionError(error: unknown)` que converte instanceof checks em string pt-BR.

Para HTTP fetch, o padrão a adotar (novo neste projeto) é uma **classe de erro tipada** com `status` HTTP e `message` pt-BR já mapeada, encapsulada no service — evitando que a UI precise conhecer códigos HTTP.

**Uso de Sonner toast:**
- Import: `import { toast } from "sonner"` (linha 7 de `LoginForm.tsx`, linha 5 de `UserActions.tsx`).
- Chamada: `toast.error("mensagem pt-BR")` — sempre string direta.
- O `<Toaster>` está em `src/providers/index.tsx:32` (posição `"top-center"`, `richColors`).
- O hook de mutação chama `toast.error(...)` no `onError` callback — padrão de `useUpdateUserStatus.ts` (tratamento no caller do componente via `UserActions.tsx`). Para `useUpsertPrediction`, o toast de erro fica **dentro do hook** (no `onError`) — decisão do plano: "toast de erro via Sonner" é responsabilidade do hook.

---

## 3. Escopo

### Dentro do escopo

- `src/services/predictions.ts` — adicionar `upsertPrediction`, manter `listPredictionsByUid` intacto.
- `src/features/predictions/hooks/predictionsKeys.ts` — factory de keys da feature.
- `src/features/predictions/hooks/usePredictions.ts` — hook de leitura (espelha matches/home).
- `src/features/predictions/hooks/useUpsertPrediction.ts` — hook de mutação com invalidação cruzada e toast.
- `src/features/predictions/hooks/index.ts` — barrel.

### Fora do escopo

- Componentes de UI ou formulário — TASK-07/08/09.
- Route Handler `POST /api/predictions` — TASK-03 (já concluído, consumido aqui).
- Security Rules — TASK-05.
- `listPredictionsByUid` (não modifica).
- Testes unitários automáticos — `/test` separado (conforme plano).
- Helper `requireApprovedUser` server-side — TASK-03/04 (YAGNI no client).

---

## 4. Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/services/predictions.ts` | **Modificar** — adicionar `upsertPrediction` + `PredictionServiceError` |
| `src/features/predictions/hooks/predictionsKeys.ts` | **Criar** |
| `src/features/predictions/hooks/usePredictions.ts` | **Criar** |
| `src/features/predictions/hooks/useUpsertPrediction.ts` | **Criar** |
| `src/features/predictions/hooks/index.ts` | **Criar** |

Nenhum outro arquivo existente é modificado por esta tarefa. O barrel global de features (`src/features/predictions/index.ts`) já re-exporta de `./lib` — o barrel de hooks será acessível via `@/features/predictions/hooks`.

---

## 5. Implementação detalhada

### 5.1 `src/services/predictions.ts` — adicionar `upsertPrediction`

#### 5.1.1 Classe de erro tipada

```ts
/**
 * Erro tipado para respostas HTTP de erro do Route Handler de palpites.
 * Encapsula status HTTP e mensagem pt-BR mapeada — a UI nunca lida com códigos HTTP.
 */
export class PredictionServiceError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "PredictionServiceError";
    this.status = status;
  }
}
```

#### 5.1.2 Mapeamento de erros HTTP → mensagem pt-BR

```ts
const HTTP_ERROR_MESSAGES: Record<number, string> = {
  401: "Você precisa estar autenticado para registrar palpites.",
  403: "Seu acesso ainda não foi aprovado pelo administrador.",
  404: "A partida solicitada não foi encontrada.",
  422: "Os dados do palpite são inválidos.",
  423: "O prazo para este jogo foi encerrado.",
  500: "Erro ao salvar o palpite. Tente novamente.",
};

const FALLBACK_HTTP_MESSAGE = "Ocorreu um erro inesperado. Tente novamente.";
```

**Justificativas:**
- `401` → usuário não autenticado ou sessão expirada.
- `403` → usuário pending/blocked (não aprovado ainda).
- `404` → `matchId` inválido ou partida removida do cache.
- `422` → validação de `predictionInputSchema` falhou no servidor (homeScore negativo, matchId vazio, etc.).
- `423` → `isPredictionLocked` retornou true no servidor — jogo já iniciou.
- `500` → erro de escrita no Firestore (Admin SDK).
- Outros status (ex.: 503 de quota da API-Football) → fallback genérico.

#### 5.1.3 Input type

```ts
export interface UpsertPredictionInput {
  matchId: string;
  homeScore: number;
  awayScore: number;
}
```

O `uid` **não** é passado como input — o Route Handler extrai o uid do cookie de sessão httpOnly. O cliente nunca envia uid no body (respeita o design do TASK-03).

#### 5.1.4 Função `upsertPrediction`

```ts
/**
 * Envia um palpite (create ou update) ao Route Handler POST /api/predictions.
 * Usa credentials: "same-origin" para incluir o cookie de sessão httpOnly.
 *
 * Não usa Firebase Client SDK — escrita via Route Handler (Admin SDK no servidor).
 * Mapeia respostas de erro HTTP para PredictionServiceError com mensagem pt-BR.
 *
 * @param input - { matchId, homeScore, awayScore }
 * @throws PredictionServiceError em caso de erro HTTP (401/403/404/422/423/500).
 * @throws Error genérico em caso de falha de rede.
 */
export async function upsertPrediction(
  input: UpsertPredictionInput,
): Promise<void> {
  const response = await fetch("/api/predictions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message =
      HTTP_ERROR_MESSAGES[response.status] ?? FALLBACK_HTTP_MESSAGE;
    throw new PredictionServiceError(response.status, message);
  }
}
```

**Decisões:**
- `credentials: "same-origin"` — inclui o cookie `__session` httpOnly sem expor credenciais cross-origin.
- Retorno `void` — o cliente não precisa dos dados de volta (o cache é invalidado e relido via React Query).
- Não parseia o body de sucesso — simplifica e evita acoplamento ao shape de resposta do handler (`{ prediction: { id, uid, matchId, homeScore, awayScore } }`). Se futuras versões precisarem do `id`, o retorno pode ser extendido sem quebrar callers atuais.
- `!response.ok` captura qualquer status >= 400.

#### 5.1.5 Arquivo completo resultante

```ts
import { collection, getDocs, query, where } from "firebase/firestore";

import { firestore } from "@/firebase";
import { predictionSchema } from "@/schemas";
import type { Prediction } from "@/types";

/**
 * Camada de serviço de palpites (PRD-04).
 *
 * Leitura: listPredictionsByUid — Firebase Client SDK (direto, permitido pelas Rules).
 * Escrita: upsertPrediction — fetch ao Route Handler POST /api/predictions (Admin SDK server-side).
 *
 * NÃO usar Firebase Client SDK para escrita — Rules negam write client-direto (TASK-05).
 */

// ─── Erro tipado de HTTP ────────────────────────────────────────────────────

/**
 * Erro tipado para respostas HTTP de erro do Route Handler de palpites.
 * Encapsula status HTTP e mensagem pt-BR mapeada — a UI nunca lida com códigos HTTP.
 */
export class PredictionServiceError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "PredictionServiceError";
    this.status = status;
  }
}

const HTTP_ERROR_MESSAGES: Record<number, string> = {
  401: "Você precisa estar autenticado para registrar palpites.",
  403: "Seu acesso ainda não foi aprovado pelo administrador.",
  404: "A partida solicitada não foi encontrada.",
  422: "Os dados do palpite são inválidos.",
  423: "O prazo para este jogo foi encerrado.",
  500: "Erro ao salvar o palpite. Tente novamente.",
};

const FALLBACK_HTTP_MESSAGE = "Ocorreu um erro inesperado. Tente novamente.";

// ─── Leitura ────────────────────────────────────────────────────────────────

/**
 * Lista todos os palpites do usuário com o dado `uid`.
 * (Mantido intacto — leitura via Firebase Client SDK.)
 */
export async function listPredictionsByUid(uid: string): Promise<Prediction[]> {
  const q = query(
    collection(firestore, "predictions"),
    where("uid", "==", uid),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => predictionSchema.parse(d.data()));
}

// ─── Escrita ─────────────────────────────────────────────────────────────────

export interface UpsertPredictionInput {
  matchId: string;
  homeScore: number;
  awayScore: number;
}

/**
 * Envia um palpite (create ou update) ao Route Handler POST /api/predictions.
 * Usa credentials: "same-origin" para incluir o cookie de sessão httpOnly.
 *
 * @throws PredictionServiceError em caso de erro HTTP (401/403/404/422/423/500).
 * @throws Error genérico em caso de falha de rede.
 */
export async function upsertPrediction(
  input: UpsertPredictionInput,
): Promise<void> {
  const response = await fetch("/api/predictions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message =
      HTTP_ERROR_MESSAGES[response.status] ?? FALLBACK_HTTP_MESSAGE;
    throw new PredictionServiceError(response.status, message);
  }
}
```

---

### 5.2 `src/features/predictions/hooks/predictionsKeys.ts`

```ts
/**
 * Factory de query-keys da feature predictions (TASK-06).
 *
 * Hierarquia estável para invalidação granular (queryClient.invalidateQueries).
 * Segue o padrão de matchesKeys/homeKeys: funções que retornam arrays `as const`.
 *
 * - `all`        — raiz de toda a feature (invalida todas as queries de predictions).
 * - `item(matchId)` — palpite específico por partida.
 *
 * Namespace "predictions" é independente de "matches" e "home".
 * A invalidação cruzada (matchesKeys.predictions / homeKeys.predictions) ocorre
 * em useUpsertPrediction — não aqui.
 */
export const predictionsKeys = {
  all: () => ["predictions"] as const,
  item: (matchId: string) => [...predictionsKeys.all(), "item", matchId] as const,
} as const;
```

**Nota:** `all` é função (não propriedade estática) para consistência com `matchesKeys.all()` e para evitar referências mutáveis.

---

### 5.3 `src/features/predictions/hooks/usePredictions.ts`

```ts
"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { listPredictionsByUid } from "@/services";
import type { Prediction } from "@/types";

import { predictionsKeys } from "./predictionsKeys";

/**
 * Hook TanStack Query para os palpites do usuário autenticado — escopo predictions (TASK-06).
 *
 * Espelha usePredictions de features/matches e features/home, mas usa o namespace
 * `predictionsKeys` — evita acoplamento cross-feature.
 *
 * - `queryKey: predictionsKeys.all()` → `["predictions"]`
 * - `enabled: uid !== null` — sem uid, sem query (edge case de segurança).
 * - Sem redefinição de staleTime/gcTime — herda do QueryClient global (30min/24h).
 *
 * @param uid - UID do Firebase Auth. Null desabilita a query.
 */
export function usePredictions(uid: string | null): UseQueryResult<Prediction[]> {
  return useQuery({
    queryKey: predictionsKeys.all(),
    queryFn: () => listPredictionsByUid(uid!),
    enabled: uid !== null,
  });
}
```

**Decisão — `predictionsKeys.all()` vs `predictionsKeys.item(matchId)`:**

A query de leitura retorna **todos** os palpites do uid (via `listPredictionsByUid` — sem filtro por matchId no Firestore). Portanto o queryKey correto é `predictionsKeys.all()`, não `item(matchId)`. O `item(matchId)` existe para invalidação granular futura (ex.: se uma query por item for adicionada).

**Por que não reusar o `usePredictions` de matches ou home:**
- Acoplamento cross-feature: a feature predictions não deve importar de `features/matches/hooks` ou `features/home/hooks`.
- Namespace próprio: `predictionsKeys.all()` permite invalidar só as queries da feature predictions, sem afetar os caches de matches/home (que têm seus próprios namespaces para os badges dos cards).
- Os três hooks (`predictions.usePredictions`, `matches.usePredictions`, `home.usePredictions`) fazem a mesma query ao Firestore, mas registram em namespaces independentes — é intencional (R5: invalidação cruzada garante que todos atualizam).

---

### 5.4 `src/features/predictions/hooks/useUpsertPrediction.ts`

```ts
"use client";

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { upsertPrediction, type UpsertPredictionInput } from "@/services/predictions";

import { matchesKeys } from "@/features/matches/hooks/matchesKeys";
import { homeKeys } from "@/features/home/hooks/homeKeys";

import { predictionsKeys } from "./predictionsKeys";

/**
 * Mutação de upsert de palpite (TASK-06).
 *
 * Chama upsertPrediction (fetch POST /api/predictions) e, no sucesso, invalida
 * três namespaces de cache para garantir que o badge de palpite atualize em:
 *   1. Feature predictions: predictionsKeys.all()
 *   2. Feature matches: matchesKeys.predictions(uid) — badge nos cards de Jogos
 *   3. Feature home: homeKeys.predictions(uid) — badge nos cards da Home
 *
 * Erros do service (PredictionServiceError) são exibidos via toast.error (Sonner).
 * O chamador não precisa tratar erros — o hook centraliza o feedback.
 *
 * @param uid - UID do usuário autenticado (necessário para invalidar as keys corretas).
 */
export function useUpsertPrediction(
  uid: string,
): UseMutationResult<void, Error, UpsertPredictionInput> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, UpsertPredictionInput>({
    mutationFn: upsertPrediction,
    onSuccess: () => {
      // 1. Invalida palpites da feature predictions (lista /predictions).
      void queryClient.invalidateQueries({
        queryKey: predictionsKeys.all(),
      });
      // 2. Invalida badge nos cards de Jogos (feature matches).
      void queryClient.invalidateQueries({
        queryKey: matchesKeys.predictions(uid),
      });
      // 3. Invalida badge nos cards da Home (feature home).
      void queryClient.invalidateQueries({
        queryKey: homeKeys.predictions(uid),
      });
    },
    onError: (error) => {
      // Exibe mensagem pt-BR já mapeada pelo service.
      toast.error(error.message);
    },
  });
}
```

**Decisões de design:**

**D1 — `uid` como parâmetro do hook, não obtido internamente via `useAuth`:**
O hook recebe `uid: string` (não null — presume-se que o caller já verificou autenticação antes de habilitar o formulário). Isso mantém o hook puro de dependências de contexto e facilita testes (sem mock de AuthContext). O componente chamador (`PredictionForm` na TASK-07) já tem acesso ao uid via `useAuth`.

**D2 — `onError` dentro do hook (não no caller):**
Diferente de `useUpdateUserStatus` (que delega o toast ao `UserActions.tsx`), aqui o toast fica no hook por consistência com o plano ("toast de erro via Sonner" é escopo desta tarefa). O caller pode ignorar o erro — o feedback já foi dado.

**D3 — `matchesKeys` e `homeKeys` importados de seus respectivos módulos:**
Sem barrel intermediário — importação direta de `@/features/matches/hooks/matchesKeys` e `@/features/home/hooks/homeKeys`. Isso é acoplamento intencional e explícito (documentado como cross-feature no plano). Não cria dependência circular (predictions → matches/home; não o contrário).

**D4 — Não usar `queryClient.invalidateQueries({ queryKey: predictionsKeys.all() })` com partial matching em `matchesKeys.predictions(uid)`:**
`invalidateQueries` com `queryKey: matchesKeys.predictions(uid)` invalida a query exata `["matches","predictions",uid]` — correto, pois o uid é necessário para não invalidar palpites de outros usuários em cache (edge case irrelevante com < 100 usuários, mas correto em princípio).

**D5 — Retorno `void` de `upsertPrediction`:**
O caller (`PredictionForm`) não precisa dos dados de volta — só precisa saber se teve sucesso (para navegar ao estado de confirmação). O sucesso é detectado via `onSuccess` callback ou `mutation.isSuccess` na UI.

---

### 5.5 `src/features/predictions/hooks/index.ts`

```ts
// Barrel de hooks da feature predictions (TASK-06).
export { predictionsKeys } from "./predictionsKeys";
export { usePredictions } from "./usePredictions";
export { useUpsertPrediction } from "./useUpsertPrediction";
```

---

## 6. Contrato de imports

### `src/services/predictions.ts`
```ts
import { collection, getDocs, query, where } from "firebase/firestore";
import { firestore } from "@/firebase";
import { predictionSchema } from "@/schemas";
import type { Prediction } from "@/types";
// (sem imports de firebase-admin — este arquivo é client-only)
```

### `usePredictions.ts`
```ts
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { listPredictionsByUid } from "@/services";      // barrel global
import type { Prediction } from "@/types";
import { predictionsKeys } from "./predictionsKeys";
```

### `useUpsertPrediction.ts`
```ts
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { toast } from "sonner";
import { upsertPrediction, type UpsertPredictionInput } from "@/services/predictions";
import { matchesKeys } from "@/features/matches/hooks/matchesKeys";
import { homeKeys } from "@/features/home/hooks/homeKeys";
import { predictionsKeys } from "./predictionsKeys";
```

**Proibições:**
- `import ... from "@/firebase/admin"` — nunca no client.
- `import { usePredictions } from "@/features/matches/hooks"` dentro da feature predictions — cross-feature de hooks (permitido apenas para `matchesKeys`/`homeKeys`, não para hooks inteiros).
- `import "server-only"` — este arquivo é client-side (`"use client"`).

---

## 7. Mapeamento de erros HTTP → mensagem pt-BR

| Status HTTP | `PredictionServiceError.message` (pt-BR) |
|---|---|
| `401` | `"Você precisa estar autenticado para registrar palpites."` |
| `403` | `"Seu acesso ainda não foi aprovado pelo administrador."` |
| `404` | `"A partida solicitada não foi encontrada."` |
| `422` | `"Os dados do palpite são inválidos."` |
| `423` | `"O prazo para este jogo foi encerrado."` |
| `500` | `"Erro ao salvar o palpite. Tente novamente."` |
| outros | `"Ocorreu um erro inesperado. Tente novamente."` |

---

## 8. Estrutura de arquivos resultante

```
src/
├── services/
│   └── predictions.ts           # MODIFICADO — adiciona upsertPrediction + PredictionServiceError
└── features/
    └── predictions/
        ├── index.ts              # já existe — não modifica (re-exporta ./lib)
        ├── lib/                  # já existe — não toca
        └── hooks/
            ├── predictionsKeys.ts      # CRIAR
            ├── usePredictions.ts       # CRIAR
            ├── useUpsertPrediction.ts  # CRIAR
            └── index.ts               # CRIAR (barrel)
```

---

## 9. Fluxo de dados

```
Componente (TASK-07)
  └── useAuth() → { firebaseUser } → uid
  └── useUpsertPrediction(uid)
        └── mutate({ matchId, homeScore, awayScore })
              └── upsertPrediction(input)
                    └── fetch POST /api/predictions
                          ├── OK → void (onSuccess dispara)
                          └── !ok → throw PredictionServiceError(status, msg)
        └── onSuccess
              ├── invalidate predictionsKeys.all()     → refetch usePredictions (feature predictions)
              ├── invalidate matchesKeys.predictions(uid) → refetch usePredictions (feature matches)
              └── invalidate homeKeys.predictions(uid)    → refetch usePredictions (feature home)
        └── onError
              └── toast.error(error.message)           → Sonner richColors top-center
```

---

## 10. Critérios de aceitação

- [ ] `upsertPrediction` faz `fetch('/api/predictions', { method: 'POST', credentials: 'same-origin' })`.
- [ ] Body do fetch é `JSON.stringify({ matchId, homeScore, awayScore })` — sem uid.
- [ ] Header `Content-Type: application/json` presente.
- [ ] Resposta `!ok` lança `PredictionServiceError(status, mensagem_pt_BR)`.
- [ ] Status 401 → `"Você precisa estar autenticado para registrar palpites."`.
- [ ] Status 403 → `"Seu acesso ainda não foi aprovado pelo administrador."`.
- [ ] Status 404 → `"A partida solicitada não foi encontrada."`.
- [ ] Status 422 → `"Os dados do palpite são inválidos."`.
- [ ] Status 423 → `"O prazo para este jogo foi encerrado."`.
- [ ] Status 500 → `"Erro ao salvar o palpite. Tente novamente."`.
- [ ] Status desconhecido → `"Ocorreu um erro inesperado. Tente novamente."`.
- [ ] `listPredictionsByUid` continua intacto e funcional.
- [ ] `predictionsKeys.all()` retorna `["predictions"]`.
- [ ] `predictionsKeys.item("123")` retorna `["predictions", "item", "123"]`.
- [ ] `usePredictions(null)` tem `enabled: false` (sem query disparada).
- [ ] `usePredictions("uid")` usa `queryKey: predictionsKeys.all()`.
- [ ] `useUpsertPrediction(uid)` invalida `predictionsKeys.all()` no `onSuccess`.
- [ ] `useUpsertPrediction(uid)` invalida `matchesKeys.predictions(uid)` no `onSuccess`.
- [ ] `useUpsertPrediction(uid)` invalida `homeKeys.predictions(uid)` no `onSuccess`.
- [ ] `useUpsertPrediction(uid)` chama `toast.error(error.message)` no `onError`.
- [ ] Barrel `hooks/index.ts` exporta `predictionsKeys`, `usePredictions`, `useUpsertPrediction`.
- [ ] Nenhum `any` introduzido.
- [ ] `rtk tsc` sem erros após implementação.
- [ ] Sem import de Firebase Admin SDK em arquivos client.
- [ ] Sem `import "server-only"` em hooks ou services client.

---

## 11. O que esta tarefa NÃO faz

- Não cria componentes de UI — TASK-07/08/09.
- Não modifica Security Rules — TASK-05.
- Não cria o Route Handler — TASK-03.
- Não extrai `uid` internamente via `useAuth` dentro do hook — responsabilidade do caller.
- Não cria hook compositor `usePredictionsList` (join com matches/teams) — TASK-08.
- Não grava `status` nem `points` — esses campos são exclusivos do Route Handler de pontuação (TASK-04).
- Não configura cron externo — infra (R7 do PRD).
- Não cria testes automáticos nesta tarefa — `/test` separado conforme plano.
