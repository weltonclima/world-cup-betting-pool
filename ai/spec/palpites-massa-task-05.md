# SPEC — TASK-05: Service + Hooks de Batch, Rascunho Local e Agrupadores

> Feature slug: `palpites-massa`
> Task: TASK-05
> PRD: `ai/prd/palpites-massa.md` (§6.1 decisões A4/A5 + §6.2.1 D-OF2/D-OF3)
> Plan: `ai/plan/palpites-massa.md`
> Depends on: TASK-04 (`POST /api/predictions/batch` — `src/app/api/predictions/batch/route.ts`)
> Gerado: 2026-06-07

---

## 1. Objetivo

Expor ao lado client a tríade que as telas de palpite em massa (TASK-09, TASK-13, TASK-15) precisam:

1. **Service fn de batch** — `upsertPredictionsBatch` em `src/services/predictions.ts`: envia N palpites ao endpoint de TASK-04, mapeia resposta `{saved, rejected}` e erros HTTP para pt-BR.
2. **Mutation hook** — `useUpsertPredictionsBatch`: TanStack Query mutation que invalida o cache de predictions após sucesso parcial ou total.
3. **Draft store** — `usePredictionDraft`: persistência local (localStorage) com debounce; não bloqueia digitação; chave por uid; expõe `get/set/clear`.
4. **Hooks de agrupamento** — `useGroupMatches(groupId)` e `usePhaseMatches(stage)`: filtros derivados de `useMatches()` sem nova query de rede. Compositor `useGroupPredictions(groupId)`: une matches do grupo × draft × predictions salvas em um único view-model.

Sem escrita de produção nesta TASK — apenas `ai/spec/palpites-massa-task-05.md`.

---

## 2. Contexto e reutilização

### Peças existentes reutilizadas sem alteração

| Artefato | Caminho | Papel nesta TASK |
|---|---|---|
| `PredictionServiceError` | `src/services/predictions.ts` | Erro tipado com `status + message` pt-BR |
| `HTTP_ERROR_MESSAGES` | `src/services/predictions.ts` | Mapeamento status→mensagem pt-BR |
| `FALLBACK_HTTP_MESSAGE` | `src/services/predictions.ts` | Fallback para status não mapeado |
| `UpsertPredictionInput` | `src/services/predictions.ts` | Tipo de input unitário (reusar para batch) |
| `upsertPrediction` | `src/services/predictions.ts` | fn unitária; não alterada |
| `listPredictionsByUid` | `src/services/predictions.ts` | leitura Firestore; não alterada |
| `predictionsKeys` | `src/features/predictions/hooks/predictionsKeys.ts` | Factory de query keys |
| `usePredictions` | `src/features/predictions/hooks/usePredictions.ts` | Query de palpites do usuário |
| `useUpsertPrediction` | `src/features/predictions/hooks/useUpsertPrediction.ts` | Mutation unitária; não alterada |
| `useMatches` | `src/features/matches/hooks/useMatches.ts` | Query da lista completa de partidas |
| `useTeams` | `src/features/matches/hooks/useTeams.ts` | Query do cache de seleções |
| `buildTeamMap` | `src/features/matches/lib/matchesHelpers.ts` | Map teamId→TeamWithId |
| `resolveTeam` | `src/features/matches/lib/matchesHelpers.ts` | Resolução de nome/flagUrl |
| `isPredictionLocked` | `src/features/predictions/lib/predictionsHelpers.ts` | Verifica bloqueio por kickoffAt/status |

### Contrato do endpoint (TASK-04)

```
POST /api/predictions/batch
Body: { predictions: { matchId, homeScore, awayScore }[] }  (1–104 itens)
Response 200: { saved: SavedItem[], rejected: RejectedItem[] }
Erros de rota: 400 | 401 | 403 | 422 | 500 | 502 | 503 | 504
```

Onde `RejectedItem = { index: number; matchId: string | undefined; reason: "invalid"|"not_found"|"locked"; message: string }`.

### matchId scheme (D-OF2)

- Fase de grupos: slug determinístico `{date}-{slug(team1)}-{slug(team2)}`.
- Mata-mata: `m{num}` (ex.: `m73`).
- `groupId` vem de `match.groupId` populado pelo mapper openfootball (`"Group A"` → `"A"`).

---

## 3. Função de serviço: `upsertPredictionsBatch`

### 3.1 Localização

`src/services/predictions.ts` — adicionar após `upsertPrediction`, dentro do mesmo módulo. Reusar `PredictionServiceError`, `HTTP_ERROR_MESSAGES`, `FALLBACK_HTTP_MESSAGE`.

### 3.2 Tipos novos

```ts
/** Input de um item do lote (idêntico ao unitário — reusar UpsertPredictionInput). */
// Nenhum tipo novo necessário para o input; usar UpsertPredictionInput[].

/** Item gravado com sucesso pelo endpoint batch. */
export interface BatchSavedItem {
  id: string;       // docId Firestore: "${uid}_${matchId}"
  matchId: string;
  homeScore: number;
  awayScore: number;
  created: boolean; // true = create, false = update
}

/** Item rejeitado pelo endpoint batch. */
export interface BatchRejectedItem {
  index: number;                                      // índice original no array de input
  matchId: string | undefined;                        // undefined se o item era totalmente inválido
  reason: "invalid" | "not_found" | "locked";
  message: string;                                    // pt-BR do servidor
}

/** Resultado completo do upsert em lote. */
export interface BatchUpsertResult {
  saved: BatchSavedItem[];
  rejected: BatchRejectedItem[];
}
```

### 3.3 Assinatura

```ts
/**
 * Envia um lote de palpites ao Route Handler POST /api/predictions/batch.
 * Usa credentials: "same-origin" (cookie de sessão httpOnly).
 *
 * Retorna { saved, rejected } — o caller (useUpsertPredictionsBatch) é responsável
 * por exibir feedback agregado; rejeições parciais NÃO lançam exceção.
 *
 * @throws PredictionServiceError em erros de rota (401/403/422/500/502/503/504).
 * @throws Error em falha de rede (fetch rejeita).
 */
export async function upsertPredictionsBatch(
  inputs: UpsertPredictionInput[],
): Promise<BatchUpsertResult>
```

### 3.4 Implementação (lógica)

```
1. fetch("POST /api/predictions/batch", credentials: "same-origin",
         body: JSON.stringify({ predictions: inputs }))
2. Se !response.ok:
   message = HTTP_ERROR_MESSAGES[response.status] ?? FALLBACK_HTTP_MESSAGE
   throw new PredictionServiceError(response.status, message)
3. const result = await response.json()
4. return result as BatchUpsertResult
```

**Não** tentar tipar o JSON com Zod no client — confiar no contrato do servidor. O tipo `BatchUpsertResult` é suficiente para que a UI/hook opere.

### 3.5 Mapeamento de erros HTTP pt-BR

Reutilizar `HTTP_ERROR_MESSAGES` existente. Adicionar entradas faltantes para o batch:

| Status | Mensagem pt-BR |
|---|---|
| 401 | `"Você precisa estar autenticado para registrar palpites."` (já existe) |
| 403 | `"Seu acesso ainda não foi aprovado pelo administrador."` (já existe) |
| 404 | `"A partida solicitada não foi encontrada."` (já existe) |
| 422 | `"Os dados do palpite são inválidos."` (já existe) |
| 423 | `"O prazo para este jogo foi encerrado."` (já existe) |
| 500 | `"Erro ao salvar o palpite. Tente novamente."` (já existe) |
| 502 | `"Erro ao buscar dados da Copa. Tente novamente."` ← **novo** |
| 503 | `"Serviço de dados da Copa temporariamente indisponível."` ← **novo** |
| 504 | `"Tempo limite ao buscar dados da Copa. Tente novamente."` ← **novo** |

> Adicionar 502/503/504 no `HTTP_ERROR_MESSAGES` — usados pelo batch mas melhoram o unitário também (fallback genérico já cobre hoje, mas mensagens específicas são melhores UX).

---

## 4. Hook de mutation: `useUpsertPredictionsBatch`

### 4.1 Localização

`src/features/predictions/hooks/useUpsertPredictionsBatch.ts`

### 4.2 Assinatura

```ts
/**
 * Mutação TanStack Query para upsert de N palpites em lote (TASK-05).
 *
 * Chama upsertPredictionsBatch e, no sucesso (saved.length > 0 ou qualquer retorno
 * sem exceção), invalida predictionsKeys.all() para forçar refetch da lista.
 *
 * O hook NÃO emite toast internamente — delegar ao caller (TASK-09/15) para que
 * o feedback agregado (X gravados, Y rejeitados) seja contextual à tela.
 * Erros de rota (PredictionServiceError) propagam via onError para o caller.
 *
 * @param uid - UID do usuário autenticado (para invalida matchesKeys.predictions(uid)).
 */
export function useUpsertPredictionsBatch(
  uid: string,
): UseMutationResult<BatchUpsertResult, Error, UpsertPredictionInput[]>
```

### 4.3 Comportamento

```ts
useMutation<BatchUpsertResult, Error, UpsertPredictionInput[]>({
  mutationFn: upsertPredictionsBatch,
  onSuccess: (result) => {
    // Invalida predictions para refetch da lista de palpites.
    void queryClient.invalidateQueries({ queryKey: predictionsKeys.all() });
    // Invalida badges nos cards de Jogos (feature matches).
    void queryClient.invalidateQueries({ queryKey: matchesKeys.predictions(uid) });
    // homeKeys.predictions(uid) — opcional; invalidar se o Hub exibir badges.
    void queryClient.invalidateQueries({ queryKey: homeKeys.predictions(uid) });
    // NÃO emitir toast aqui — caller decide o feedback com base em result.saved/rejected
  },
  onError: (_error) => {
    // Propagar sem toast — caller (TASK-09) tem contexto para mensagem agregada.
    // Alternativa: toast.error(error.message) se nenhum caller implementar onError.
    // Decidir no TASK-09. Spec recomenda: sem toast aqui (mais flexível).
  },
})
```

**Decisão de design:** `onSuccess` invalida mesmo quando `result.rejected.length > 0` — palpites parcialmente gravados devem aparecer na lista imediatamente.

---

## 5. Draft store: `usePredictionDraft`

### 5.1 Localização

`src/features/predictions/hooks/usePredictionDraft.ts`

### 5.2 Motivação (decisão A4)

Auto-save local a cada alteração **sem** bloquear a digitação. O rascunho é persistido no localStorage com debounce. A persistência server ocorre apenas ao "Salvar Grupo" (batch), não por tecla.

### 5.3 Chave de localStorage

```ts
/** Chave de localStorage por usuário. */
function draftKey(uid: string): string {
  return `palpites-rascunho-${uid}`;
}
```

**Formato do valor:**

```ts
/** Mapa de matchId → {homeScore, awayScore} persistido por usuário. */
type DraftStore = Record<string, { homeScore: number; awayScore: number }>;
```

Serializado como JSON. Chave escolhida (`palpites-rascunho-{uid}`) é curta, sem colisão com outras chaves do projeto, e inclui o uid para isolamento entre usuários no mesmo browser.

### 5.4 SSR safety

`localStorage` não existe no servidor (Next.js App Router com componentes server). O hook usa um guard:

```ts
const isBrowser = typeof window !== "undefined";
```

- Leituras em SSR retornam `{}` (draft vazio).
- Escritas em SSR são no-ops.
- O hook deve ser marcado com `"use client"` — consumido apenas por Client Components.

### 5.5 Estado interno

```ts
// Estado React: cópia em memória do draft (evita parse de localStorage a cada render).
const [draft, setDraftState] = useState<DraftStore>(() => {
  if (!isBrowser) return {};
  try {
    const raw = localStorage.getItem(draftKey(uid));
    return raw ? (JSON.parse(raw) as DraftStore) : {};
  } catch {
    return {};
  }
});

// Ref para debounce timer.
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

### 5.6 Assinatura pública

```ts
export interface PredictionDraftAPI {
  /** Retorna o palpite em rascunho para um matchId, ou undefined se não existe. */
  getDraft(matchId: string): { homeScore: number; awayScore: number } | undefined;

  /** Atualiza o rascunho de um matchId (debounced para localStorage; síncrono para estado React). */
  setDraft(matchId: string, scores: { homeScore: number; awayScore: number }): void;

  /** Remove todos os rascunhos do usuário (localStorage + estado React). */
  clearDraft(): void;

  /** Mapa completo do rascunho (para inicializar formulários ou calcular progresso). */
  allDrafts: DraftStore;
}

/**
 * Store de rascunho local por usuário (TASK-05, A4).
 *
 * Persiste palpites não salvos em localStorage com chave por uid.
 * Escrita em localStorage é debounced (300ms) para não travar a digitação.
 * Estado React é atualizado síncronamente (sem debounce) — UI reflete imediatamente.
 *
 * SSR-safe: no-op e draft vazio quando window não existe.
 *
 * @param uid - UID do usuário autenticado. Obrigatório — muda a chave de storage.
 */
export function usePredictionDraft(uid: string): PredictionDraftAPI
```

### 5.7 Implementação (lógica)

```
setDraft(matchId, scores):
  1. setDraftState((prev) => ({ ...prev, [matchId]: scores }))  // síncrono
  2. Cancelar debounce pendente (clearTimeout(debounceRef.current))
  3. Agendar escrita em localStorage com setTimeout(300ms):
       localStorage.setItem(draftKey(uid), JSON.stringify(novoEstado))

getDraft(matchId):
  return draft[matchId]  // lê do estado React (em memória)

clearDraft():
  1. setDraftState({})
  2. localStorage.removeItem(draftKey(uid))  // síncrono

allDrafts:
  draft  // exposição direta do estado
```

**Debounce de 300ms**: intervalo suficiente para absorver digitação contínua sem acumular muitas escritas. Configurável como constante `DRAFT_DEBOUNCE_MS = 300`.

### 5.8 Ciclo de vida e limpeza

```ts
// useEffect para limpar o debounce no unmount.
useEffect(() => {
  return () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };
}, []);
```

**Pergunta em aberto OQ-1:** O draft deve ser limpo automaticamente após `upsertPredictionsBatch` bem-sucedido? Ver §9.

### 5.9 Reconciliação draft vs. predictions salvas

O hook `usePredictionDraft` não sabe quais palpites já estão salvos no servidor — ele só gerencia o localStorage. A reconciliação (`draft[matchId]` vs. `savedPrediction[matchId]`) é responsabilidade do compositor `useGroupPredictions` (§6.3).

---

## 6. Hooks de agrupamento

### 6.1 `useGroupMatches(groupId)`

#### Localização

`src/features/matches/hooks/useGroupMatches.ts`

#### Motivação

Derivar partidas de um grupo específico a partir do cache existente de `useMatches()` — sem query adicional.

#### Assinatura

```ts
/**
 * Filtra partidas do cache `useMatches()` pelo groupId informado.
 * Sem nova query de rede — deriva do cache existente.
 * Ordena por kickoffAt ASC.
 *
 * @param groupId - ID do grupo ("A"–"L"), conforme match.groupId populado pelo mapper openfootball.
 */
export function useGroupMatches(groupId: string): UseQueryResult<MatchWithId[]>
```

#### Implementação

```ts
// Usar select para filtrar/transformar o resultado de useMatches sem nova query.
return useQuery({
  queryKey: matchesKeys.group(groupId),  // ver §6.4
  queryFn: listMatches,                  // mesma fn de useMatches
  staleTime: STALE_TIME.jogoDia,
  select: (matches) =>
    matches
      .filter((m) => m.groupId === groupId)
      .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime()),
});
```

> **Alternativa:** usar `useMatches()` diretamente + `useMemo` para filtrar client-side. Preferir a abordagem com `select` em `useQuery` para que o resultado filtrado seja cacheado separadamente com a query key `matchesKeys.group(groupId)`. Isso permite invalidar apenas o grupo relevante se necessário.

**Nota importante:** `match.groupId` é `string | null | undefined` no schema (campo opcional). O filtro `m.groupId === groupId` exclui naturalmente partidas sem grupo (mata-mata) que têm `groupId: null` ou `undefined`.

### 6.2 `usePhaseMatches(stage)`

#### Localização

`src/features/matches/hooks/usePhaseMatches.ts`

#### Assinatura

```ts
/**
 * Filtra partidas do cache `useMatches()` pela fase (stage) informada.
 * Sem nova query de rede — deriva do cache existente.
 * Ordena por kickoffAt ASC.
 *
 * @param stage - Fase da Copa (Stage enum: "grupos" | "oitavas" | "quartas" | etc.)
 */
export function usePhaseMatches(stage: Stage): UseQueryResult<MatchWithId[]>
```

#### Implementação

```ts
return useQuery({
  queryKey: matchesKeys.phase(stage),  // ver §6.4
  queryFn: listMatches,
  staleTime: STALE_TIME.jogoDia,
  select: (matches) =>
    matches
      .filter((m) => m.stage === stage)
      .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime()),
});
```

### 6.3 Compositor `useGroupPredictions(groupId)`

#### Localização

`src/features/predictions/hooks/useGroupPredictions.ts`

#### Motivação

View-model para a tela de palpite em massa de um grupo (TASK-09). Une:
- Partidas do grupo (`useGroupMatches`)
- Palpites salvos do usuário (`usePredictions`)
- Rascunho local (`usePredictionDraft`)

#### Tipos de saída

```ts
/** Item de linha na tela de palpite em massa do grupo. */
export interface GroupPredictionItem {
  matchId: string;
  kickoffAt: string;
  homeTeam: ResolvedTeam;
  awayTeam: ResolvedTeam;
  /** Palpite atualmente ativo: draft tem prioridade sobre saved. */
  currentScores: { homeScore: number; awayScore: number } | undefined;
  /** Palpite salvo no servidor (se existir). */
  savedPrediction: { homeScore: number; awayScore: number } | undefined;
  /** Rascunho local não salvo (se existir). */
  draftPrediction: { homeScore: number; awayScore: number } | undefined;
  /** Partida bloqueada para novos palpites. */
  isLocked: boolean;
  /** true se o rascunho local difere do palpite salvo (indica pendência de save). */
  isDirty: boolean;
}

export interface GroupPredictionsData {
  items: GroupPredictionItem[];
  isLoading: boolean;
  isError: boolean;
  /** Quantidade de partidas com palpite preenchido (draft ou salvo). */
  filledCount: number;
  /** Total de partidas do grupo. */
  totalCount: number;
  refetch: () => void;
}
```

#### Assinatura

```ts
/**
 * Compositor de view-model para a tela de palpite em massa de um grupo (TASK-09).
 *
 * Orquestra useGroupMatches + useTeams + usePredictions + usePredictionDraft.
 * Regra de prioridade para currentScores:
 *   1. draftPrediction (rascunho local — alteração mais recente do usuário)
 *   2. savedPrediction (persistido no servidor)
 *   3. undefined (sem palpite)
 *
 * @param groupId - ID do grupo ("A"–"L").
 */
export function useGroupPredictions(groupId: string): GroupPredictionsData
```

#### Implementação (lógica)

```
1. uid ← useAuth().firebaseUser?.uid ?? null
2. matchesQuery ← useGroupMatches(groupId)
3. teamsQuery   ← useTeams()
4. predictionsQuery ← usePredictions(uid)
5. draft ← usePredictionDraft(uid ?? "")  // uid vazio = draft isolado, nenhum key colide
6. isLoading = any(matchesQuery, teamsQuery, predictionsQuery).isLoading
7. isError   = any(...).isError
8. uid === null → return { items: [], isLoading, isError, filledCount: 0, totalCount: 0, refetch }
9. matches     = matchesQuery.data ?? []
   teams       = teamsQuery.data ?? []
   predictions = predictionsQuery.data ?? []
10. teamMap = buildTeamMap(teams)
    now = new Date()
    predByMatchId = new Map(predictions.map(p => [p.matchId, p]))
11. items = matches.map(match => {
      const saved = predByMatchId.get(match.id)
        ? { homeScore: predByMatchId.get(match.id)!.homeScore,
            awayScore: predByMatchId.get(match.id)!.awayScore }
        : undefined
      const draftVal = draft.getDraft(match.id)
      const isLocked = isPredictionLocked(match, now)
      const currentScores = draftVal ?? saved
      const isDirty =
        draftVal !== undefined &&
        (saved === undefined ||
         draftVal.homeScore !== saved.homeScore ||
         draftVal.awayScore !== saved.awayScore)
      return {
        matchId: match.id,
        kickoffAt: match.kickoffAt,
        homeTeam: resolveTeam(match.homeTeamId, teamMap),
        awayTeam: resolveTeam(match.awayTeamId, teamMap),
        currentScores,
        savedPrediction: saved,
        draftPrediction: draftVal,
        isLocked,
        isDirty,
      }
    })
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime())
12. filledCount = items.filter(i => i.currentScores !== undefined).length
13. return { items, isLoading, isError, filledCount, totalCount: items.length, refetch }
```

**Regra `isDirty`:** um item é dirty quando existe rascunho E (não existe palpite salvo OU rascunho difere do salvo). Usado pela UI para destacar linhas não salvas e habilitar o CTA "Salvar Grupo".

### 6.4 Extensão de `matchesKeys`

Adicionar entradas novas na factory existente (`src/features/matches/hooks/matchesKeys.ts`):

```ts
export const matchesKeys = {
  // ... entradas existentes ...
  groups: () => [...matchesKeys.all(), "group"] as const,
  group: (groupId: string) => [...matchesKeys.groups(), groupId] as const,
  phases: () => [...matchesKeys.all(), "phase"] as const,
  phase: (stage: Stage) => [...matchesKeys.phases(), stage] as const,
} as const;
```

---

## 7. Arquivos a criar/modificar

| Arquivo | Ação | Descrição |
|---|---|---|
| `src/services/predictions.ts` | **Modificar** | Adicionar `upsertPredictionsBatch`, `BatchSavedItem`, `BatchRejectedItem`, `BatchUpsertResult`; adicionar 502/503/504 em `HTTP_ERROR_MESSAGES` |
| `src/features/predictions/hooks/useUpsertPredictionsBatch.ts` | **Criar** | Hook mutation batch |
| `src/features/predictions/hooks/usePredictionDraft.ts` | **Criar** | Draft store localStorage |
| `src/features/predictions/hooks/useGroupPredictions.ts` | **Criar** | Compositor grupo |
| `src/features/matches/hooks/useGroupMatches.ts` | **Criar** | Filtro por groupId |
| `src/features/matches/hooks/usePhaseMatches.ts` | **Criar** | Filtro por stage |
| `src/features/matches/hooks/matchesKeys.ts` | **Modificar** | Adicionar `.group()` e `.phase()` |
| `src/features/predictions/hooks/index.ts` | **Modificar** | Exportar novos hooks + tipos |
| `src/features/matches/hooks/index.ts` | **Modificar** | Exportar `useGroupMatches`, `usePhaseMatches` |
| `src/services/predictions.ts __tests__` | **Criar** | Testes da service fn batch |
| `src/features/predictions/hooks/__tests__/usePredictionDraft.test.ts` | **Criar** | Testes do draft store |

---

## 8. TDD recomendado

**Sim** para `upsertPredictionsBatch` (service) e `usePredictionDraft` (draft store). Os hooks de agrupamento e o compositor são derivações — cobertura via integration test ou teste do compositor é suficiente.

### 8.1 Testes de `upsertPredictionsBatch`

Localização sugerida: `src/services/__tests__/predictions.batch.test.ts`

```ts
// Padrão de mock: vi.stubGlobal("fetch", vi.fn())
```

| # | Caso | Expectativa |
|---|---|---|
| 1 | Resposta 200 com `{saved:[...], rejected:[]}` | Retorna `BatchUpsertResult` sem exceção |
| 2 | Resposta 200 com `rejected` não vazio | Retorna objeto com ambos os arrays preenchidos; sem exceção |
| 3 | Resposta 401 | Lança `PredictionServiceError(401, "Você precisa estar autenticado...")` |
| 4 | Resposta 403 | Lança `PredictionServiceError(403, "Seu acesso ainda não foi aprovado...")` |
| 5 | Resposta 422 | Lança `PredictionServiceError(422, "Os dados do palpite são inválidos.")` |
| 6 | Resposta 500 | Lança `PredictionServiceError(500, "Erro ao salvar o palpite...")` |
| 7 | Resposta 503 | Lança `PredictionServiceError(503, "Serviço de dados da Copa temporariamente indisponível.")` |
| 8 | Resposta 999 (status não mapeado) | Lança `PredictionServiceError(999, FALLBACK_HTTP_MESSAGE)` |
| 9 | Envia `credentials: "same-origin"` | Confirmar via `fetch.mock.calls[0][1].credentials` |
| 10 | Body serializado corretamente | `JSON.parse(fetch.mock.calls[0][1].body)` contém `{predictions: inputs}` |
| 11 | Falha de rede (fetch rejeita) | Propaga o erro original (não envolve em PredictionServiceError) |

### 8.2 Testes de `usePredictionDraft`

Localização: `src/features/predictions/hooks/__tests__/usePredictionDraft.test.ts`

Usar `renderHook` do `@testing-library/react` + fake timer (`vi.useFakeTimers`) para testar debounce.

| # | Caso | Expectativa |
|---|---|---|
| 1 | `getDraft("m1")` sem prévia → `undefined` | |
| 2 | `setDraft("m1", {0,1})` → `getDraft("m1")` retorna `{0,1}` imediatamente | Estado React atualizado síncronamente |
| 3 | `setDraft` → avança timer 300ms → `localStorage.getItem(key)` contém valor | Debounce persistiu |
| 4 | `setDraft` duas vezes em < 300ms → apenas 1 escrita em localStorage | Debounce cancelou a primeira |
| 5 | `clearDraft()` → `getDraft` retorna undefined + `localStorage.getItem` retorna null | |
| 6 | `allDrafts` reflete estado atual | |
| 7 | `localStorage` corrompido (JSON inválido) → inicia com `{}` sem exception | |
| 8 | SSR (window undefined) → `getDraft` retorna `undefined`; `setDraft` não lança | Mockar `window` via `vi.stubGlobal` ou `Object.defineProperty` |
| 9 | Trocar `uid` → draft não vaza entre usuários (keys diferentes) | |
| 10 | Unmount → timer cancelado (sem erro de atualização de estado desmontado) | |

### 8.3 Testes de `useGroupPredictions` (integração)

Localização: `src/features/predictions/hooks/__tests__/useGroupPredictions.test.ts`

Usar `renderHook` + wrapper QueryClient + mocks de `useGroupMatches`, `useTeams`, `usePredictions`, `usePredictionDraft`.

| # | Caso | Expectativa |
|---|---|---|
| 1 | Sem predictions salvas, sem draft → `currentScores: undefined`, `isDirty: false` | |
| 2 | Com prediction salva, sem draft → `currentScores === savedPrediction`, `isDirty: false` | |
| 3 | Com draft diferente do salvo → `currentScores === draftPrediction`, `isDirty: true` | |
| 4 | Com draft igual ao salvo → `isDirty: false` | |
| 5 | Com draft, sem prediction salva → `currentScores === draftPrediction`, `isDirty: true` | |
| 6 | Match bloqueado → `isLocked: true` | |
| 7 | `filledCount` conta draft + salvo sem duplicata | |
| 8 | `isLoading: true` quando qualquer query carregando | |

---

## 9. Perguntas em aberto

| # | Questão | Impacto | Recomendação |
|---|---|---|---|
| OQ-1 | **Draft deve ser limpo após batch save bem-sucedido?** `clearDraft()` chamado automaticamente em `onSuccess` de `useUpsertPredictionsBatch` (para todo o grupo) ou deixar o caller (TASK-09) decidir? Limpar automaticamente remove rascunhos de itens que foram rejeitados (locked). | UX da tela TASK-09; reconciliação de estado | **Recomendado:** não limpar automaticamente no hook de mutation. O caller (TASK-09) deve chamar `clearDraft` somente para os `matchIds` em `result.saved`, preservando rascunhos dos rejeitados para nova tentativa. |
| OQ-2 | **localStorage key schema:** `palpites-rascunho-{uid}` (um único JSON por usuário) vs. `palpites-rascunho-{uid}-{matchId}` (uma chave por jogo)? | Volume de operações de I/O; isolamento de falhas | **Recomendado:** um único JSON por usuário (simples, sem proliferação de keys). Risco: JSON grande (104 itens × ~30 bytes ≈ 3 KB — desprezível para localStorage). |
| OQ-3 | **Reconciliação draft vs. saved no reload:** ao montar o compositor, o draft local pode conter palpites que já foram salvos (sessão anterior). A regra atual (draft tem prioridade) pode exibir valor "stale" se o usuário alterou o palpite em outra sessão. Deve-se limpar o draft de itens com `savedPrediction` no mount? | Consistência cross-device (edge case) | **Recomendado:** não limpar automaticamente no mount (a outra sessão pode ter dados mais antigos). Exibir draft como "em edição" é intenção do usuário; ao salvar, o servidor decide a versão final. Documento open question para TASK-09. |
| OQ-4 | **SSR e hidratação:** `usePredictionDraft` lê localStorage no `useState` initializer. Em SSR o initializer roda no servidor (window undefined) → retorna `{}`. No client, a hidratação sobrescreve o estado com o valor do localStorage. Esse comportamento causa hydration mismatch? | Estabilidade do Next.js App Router | **Recomendado:** usar `useState({})` + `useEffect` para ler localStorage após mount (padrão seguro para SSR). Isso introduz um render extra mas garante zero hydration mismatch. Alternativa: `use client` + `initializer lazy` com guard `typeof window !== "undefined"` (funcionalmente equivalente se o componente que usa o hook for puramente client). Confirmar no TASK-09 qual abordagem o App Router espera. |
| OQ-5 | **`useGroupMatches` com `select` vs. `useMemo`:** usar `select` em `useQuery` gera uma query key separada (`matchesKeys.group(groupId)`), que pode não ter os dados cacheados se `useMatches` usou `matchesKeys.list()`. O TanStack Query não compartilha cache entre query keys diferentes — a query `matchesKeys.group(groupId)` faz uma chamada de rede separada. | Número de requests de rede | **Recomendado:** usar `useMatches()` + `useMemo` para filtrar — 1 request ao invés de 2. Isso simplifica e evita a extensão de `matchesKeys`. Alternativa com `select` só faz sentido com `initialData` preenchido a partir do cache de `useMatches`. Decidir antes de implementar. |

---

## 10. Notas de implementação

### 10.1 Ordem de implementação sugerida

1. Estender `HTTP_ERROR_MESSAGES` (502/503/504) + `BatchSavedItem`/`BatchRejectedItem`/`BatchUpsertResult` em `services/predictions.ts`.
2. Implementar e testar `upsertPredictionsBatch` (TDD — §8.1).
3. Implementar e testar `usePredictionDraft` (TDD — §8.2).
4. Estender `matchesKeys` com `.group()` e `.phase()`.
5. Implementar `useGroupMatches` e `usePhaseMatches` (simples, sem TDD obrigatório).
6. Implementar `useUpsertPredictionsBatch`.
7. Implementar `useGroupPredictions` + testes de integração (§8.3).
8. Atualizar barrels de export.

### 10.2 Tipagem estrita

- Nenhum `any` em nenhum arquivo novo.
- `BatchUpsertResult` não usa `unknown` internamente — usar os tipos declarados.
- `DraftStore = Record<string, { homeScore: number; awayScore: number }>` — não `Record<string, unknown>`.

### 10.3 Sem bloqueio de digitação

O debounce de 300ms em `setDraft` garante que a escrita em localStorage ocorre de forma assíncrona (setTimeout) e nunca na thread principal durante o evento de input. O estado React é atualizado síncronamente — a UI sempre reflete o valor atual sem atraso perceptível.

### 10.4 `useUpsertPredictionsBatch` — sem toast interno

O hook de mutation **não emite toast**. A tela de palpite em massa (TASK-09) precisa de feedback agregado ("6 palpites salvos, 1 bloqueado") — melhor composto na UI com acesso a `result.saved` e `result.rejected`. O padrão atual de `useUpsertPrediction` (toast no `onError`) pode ser mantido para o unitário, mas o batch adota feedback contextual.

### 10.5 Relação com TASK-02 (`computeProgress`)

`useGroupPredictions` expõe `filledCount` e `totalCount` por grupo. O progresso global (72/104) é computado em TASK-02 (`computeProgress`) consumindo todos os palpites + matches. TASK-05 não duplica essa lógica — apenas expõe o estado por grupo para a UI local.

### 10.6 Importações no compositor

`useGroupPredictions` importa de:
- `@/hooks/useAuth` — uid do usuário
- `@/features/matches/hooks` — `useTeams` + `useGroupMatches`
- `@/features/matches/lib` — `buildTeamMap`, `resolveTeam`
- `@/features/predictions/hooks` — `usePredictions` + `usePredictionDraft`
- `@/features/predictions/lib` — `isPredictionLocked`

Sem importações cruzadas entre `features/matches` e `features/predictions` além do padrão já estabelecido em `usePredictionsList`.

---

## 11. Requires screen

**Não.** TASK-05 é camada de dados/hooks pura. Sem saída visual.

## 12. Recommended TDD

**Sim** para:
- `upsertPredictionsBatch` (§8.1) — 11 casos de teste.
- `usePredictionDraft` (§8.2) — 10 casos de teste.

**Opcional (recomendado):**
- `useGroupPredictions` (§8.3) — 8 casos de integração.

**Não obrigatório:**
- `useGroupMatches`, `usePhaseMatches`, `useUpsertPredictionsBatch` — simples o suficiente para cobertura indireta via testes do compositor.
