# SPEC — TASK-08: Tela Lista de Palpites (`/predictions`) + nav

> PRD: `ai/prd/palpites.md` | Plano: `ai/plan/palpites.md` | Branch: `feat/integracao-api-football`
> Tipo: ui | SP: 5 | Criticidade: high | Risco técnico: medium
> TDD recomendado: no (hooks/componentes — testes via `/test`). Tela: yes.
> Depende de: TASK-02 (concluída — `derivePredictionDisplayStatus`, `predictionLabels` disponíveis), TASK-06 (concluída — `usePredictions`, `predictionsKeys` disponíveis).

---

## 1. Objetivo

Implementar a tela da aba "Palpites" (`/predictions`) com:
- Hook compositor `usePredictionsList` que une `usePredictions(uid)` × `useMatches` × `useTeams`, aplica `derivePredictionDisplayStatus`, ordena por `kickoffAt` ASC, e expõe apenas jogos com palpite do usuário.
- Componentes `PredictionListCard`, `PredictionFilters`, `PredictionList` e estados de loading/empty/error.
- Filtro por chips single-select com persistência em `localStorage`.
- O nav (BottomNav + SideNav) já tem o item "Palpites" com `href: "/predictions"` em `src/components/layout/nav-items.ts` — **nenhuma alteração necessária**.

---

## 2. Investigação do codebase (resultados)

### Nav — já implementado

O item "Palpites" **já existe** em `src/components/layout/nav-items.ts` (linha 26–31):

```ts
{
  label: "Palpites",
  href: "/predictions",
  icon: PenLine,
  ariaLabel: "Meus palpites",
},
```

`BottomNav` e `SideNav` consomem `NAV_ITEMS` automaticamente — **zero alteração de nav necessária**.

### Página placeholder

`src/app/(app)/predictions/page.tsx` existe como placeholder simples (sem `"use client"`). Será substituída.

### Hooks disponíveis

| Hook | Arquivo | Query key | Retorna |
|---|---|---|---|
| `usePredictions(uid)` | `src/features/predictions/hooks/usePredictions.ts` | `predictionsKeys.all()` = `["predictions"]` | `Prediction[]` |
| `useMatches()` | `src/features/matches/hooks/useMatches.ts` | `matchesKeys.list()` = `["matches","list"]` | `MatchWithId[]` |
| `useTeams()` | `src/features/matches/hooks/useTeams.ts` | `matchesKeys.teams()` = `["matches","teams"]` | `TeamWithId[]` |

### Funções puras disponíveis (TASK-02)

| Símbolo | Origem |
|---|---|
| `derivePredictionDisplayStatus(prediction, match, now)` | `src/features/predictions/lib` |
| `PREDICTION_DISPLAY_STATUS_LABEL` | `src/features/predictions/lib` |
| `PREDICTION_DISPLAY_STATUS_COLOR` | `src/features/predictions/lib` |
| `PredictionDisplayStatus` | `src/features/predictions/lib` |

### Helpers do codebase

| Símbolo | Arquivo | Linha |
|---|---|---|
| `buildTeamMap(teams)` | `src/features/matches/lib/matchesHelpers.ts` | L53 |
| `resolveTeam(teamId, teamMap)` | `src/features/matches/lib/matchesHelpers.ts` | L66 |
| `ResolvedTeam` | `src/features/matches/lib/matchesHelpers.ts` | L17 |

### uid via `useAuth`

`src/hooks/useAuth.ts` retorna `AuthContextValue`; o uid está em `useAuth().firebaseUser?.uid ?? null` (padrão confirmado em `useMatchesList` linha 87–88).

### localStorage — sem hook utilitário existente

O projeto **não tem** `useLocalStorage` hook. O padrão atual não usa localStorage em nenhum arquivo. Implementar inline na `PredictionFilters` com `try/catch` para SSR safety.

### Componentes de referência

| Padrão | Arquivo |
|---|---|
| Skeleton | `src/features/matches/components/MatchListSkeleton.tsx` |
| Empty state | `src/features/matches/components/MatchesEmptyState.tsx` |
| Error state | `src/features/matches/components/MatchesErrorState.tsx` |
| Card completo | `src/features/matches/components/MatchCard.tsx` |

### Compositor de referência

`src/features/matches/hooks/useMatchesList.ts` — padrão de join `useMatches × useTeams × usePredictions` com `buildTeamMap` + `resolveTeam`.

---

## 3. Escopo

### Dentro do escopo

- `src/features/predictions/hooks/usePredictionsList.ts` — hook compositor.
- `src/features/predictions/components/PredictionListCard.tsx` — card de palpite.
- `src/features/predictions/components/PredictionFilters.tsx` — chips de filtro.
- `src/features/predictions/components/PredictionList.tsx` — lista + estados.
- `src/app/(app)/predictions/page.tsx` — substituir placeholder.
- Atualizar `src/features/predictions/components/index.ts` — reexportar novos componentes.
- Atualizar `src/features/predictions/hooks/index.ts` — reexportar `usePredictionsList`.
- `src/features/predictions/components/__tests__/` — arquivos de teste (via `/test`).

### Fora do escopo

- Nav items — já implementados, sem alteração.
- `predictionLabels.ts`, `predictionsHelpers.ts` — já implementados (TASK-02).
- Route Handlers, services, Security Rules.
- Contadores nos chips (opcional, não implementar).

---

## 4. Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/features/predictions/hooks/usePredictionsList.ts` | Criar |
| `src/features/predictions/components/PredictionListCard.tsx` | Criar |
| `src/features/predictions/components/PredictionFilters.tsx` | Criar |
| `src/features/predictions/components/PredictionList.tsx` | Criar |
| `src/app/(app)/predictions/page.tsx` | Substituir |
| `src/features/predictions/components/index.ts` | Atualizar — adicionar exports |
| `src/features/predictions/hooks/index.ts` | Atualizar — adicionar export |

---

## 5. Hook compositor — `usePredictionsList`

### Arquivo

`src/features/predictions/hooks/usePredictionsList.ts`

### Tipos exportados

```ts
import type { PredictionDisplayStatus, ResolvedTeam } from "@/features/predictions/lib";

/** Item de palpite enriquecido para a lista de exibição. */
export interface PredictionListItem {
  /** Id da partida (usado como React key e para link de detalhe). */
  matchId: string;
  kickoffAt: string;
  homeTeam: ResolvedTeam;
  awayTeam: ResolvedTeam;
  /** Placar palpitado pelo usuário. */
  prediction: { homeScore: number; awayScore: number };
  /** Status derivado para badge (TASK-02). */
  displayStatus: PredictionDisplayStatus;
}

/** Dado exposto pelo compositor à UI. */
export interface PredictionsListData {
  items: PredictionListItem[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}
```

### Lógica

```ts
export function usePredictionsList(): PredictionsListData {
  // 1. uid
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  // 2. Queries
  const predictionsQuery = usePredictions(uid);       // ["predictions"]
  const matchesQuery     = useMatches();               // ["matches","list"]
  const teamsQuery       = useTeams();                 // ["matches","teams"]

  // 3. Estado agregado (igual ao padrão de useMatchesList)
  const isLoading = [predictionsQuery, matchesQuery, teamsQuery].some((q) => q.isLoading);
  const isError   = [predictionsQuery, matchesQuery, teamsQuery].some((q) => q.isError);

  // 4. refetch estável (useCallback)
  const refetch = useCallback(() => {
    void predictionsQuery.refetch();
    void matchesQuery.refetch();
    void teamsQuery.refetch();
  }, [predictionsQuery.refetch, matchesQuery.refetch, teamsQuery.refetch]);

  // 5. Guard: uid null → estado neutro
  if (uid === null) {
    return { items: [], isLoading, isError, refetch };
  }

  // 6. Dados brutos
  const predictions = predictionsQuery.data ?? [];
  const matches     = matchesQuery.data     ?? [];
  const teams       = teamsQuery.data       ?? [];

  // 7. Join: somente partidas COM palpite do usuário (A5)
  const teamMap = buildTeamMap(teams);
  const now     = new Date();

  // Indexar palpites por matchId para lookup O(1)
  const predByMatchId = new Map(predictions.map((p) => [p.matchId, p]));

  const items: PredictionListItem[] = matches
    .filter((match) => predByMatchId.has(match.id))
    .map((match) => {
      const prediction = predByMatchId.get(match.id)!;
      return {
        matchId: match.id,
        kickoffAt: match.kickoffAt,
        homeTeam: resolveTeam(match.homeTeamId, teamMap),
        awayTeam: resolveTeam(match.awayTeamId, teamMap),
        prediction: { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
        displayStatus: derivePredictionDisplayStatus(prediction, match, now),
      };
    })
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());

  return { items, isLoading, isError, refetch };
}
```

**Decisões:**
- `now` capturado uma vez por render (padrão `useMatchesList` linha 121).
- `uid === null` retorna `items: []` sem disparar queries — `usePredictions` já tem `enabled: uid !== null`.
- Ordenação `kickoffAt` ASC = próximos primeiro (A4 do PRD).
- Filtro por `PredictionDisplayStatus` é puro em memória — não ocorre aqui, mas na UI.

### Imports necessários

```ts
import { useCallback }           from "react";
import { useAuth }               from "@/hooks/useAuth";
import { useMatches, useTeams }  from "@/features/matches/hooks";
import { buildTeamMap, resolveTeam } from "@/features/matches/lib";
import { usePredictions }        from "./usePredictions";
import {
  derivePredictionDisplayStatus,
  type PredictionDisplayStatus,
} from "@/features/predictions/lib";
import type { ResolvedTeam }     from "@/features/matches/lib";
```

---

## 6. Componente `PredictionFilters`

### Arquivo

`src/features/predictions/components/PredictionFilters.tsx`

### Contrato

```ts
export type FilterChip = "todos" | PredictionDisplayStatus;
// = "todos" | "pendente" | "acertou" | "errou" | "bloqueado"

export interface PredictionFiltersProps {
  activeFilter: FilterChip;
  onChange: (filter: FilterChip) => void;
}
```

### Chips definidos

```ts
const CHIPS: { value: FilterChip; label: string }[] = [
  { value: "todos",     label: "Todos" },
  { value: "pendente",  label: "Pendentes" },
  { value: "acertou",   label: "Acertos" },
  { value: "errou",     label: "Erros" },
  { value: "bloqueado", label: "Bloqueados" },
];
```

### Persistência localStorage

- Key: `"predictions_filter"`.
- Leitura no mount (lazy initial state ou `useEffect` — preferir inicialização lazy com `useState(() => readFromStorage())`).
- Gravação no `onChange`.
- Sempre envolver acesso em `try/catch` para SSR safety (Next.js — `localStorage` não existe no servidor).

```ts
const STORAGE_KEY = "predictions_filter";

function readStoredFilter(): FilterChip {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "todos" || raw === "pendente" || raw === "acertou" || raw === "errou" || raw === "bloqueado") {
      return raw;
    }
  } catch {
    // SSR ou storage indisponível
  }
  return "todos";
}
```

### Acessibilidade

- Wrapper: `<div role="group" aria-label="Filtrar palpites">`.
- Cada chip: `<button type="button" aria-pressed={isActive}>`.
- Toque mínimo: `min-h-[44px] px-3`.
- Navegação por teclado: padrão nativo de `<button>` (Tab entre chips, Enter/Space para ativar).

### Visual (tokens design system)

- Chip inativo: `bg-secondary text-secondary-foreground rounded-full px-3 py-1.5 text-xs font-medium`.
- Chip ativo: `bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-xs font-semibold ring-2 ring-ring ring-offset-1`.
- Transição: `transition-colors duration-150 motion-reduce:transition-none`.

---

## 7. Componente `PredictionListCard`

### Arquivo

`src/features/predictions/components/PredictionListCard.tsx`

### Contrato

```ts
import type { PredictionListItem } from "../hooks/usePredictionsList";

export interface PredictionListCardProps {
  item: PredictionListItem;
}
```

### Layout (baseado em PRD04-01 + padrão MatchCard)

```
┌─────────────────────────────────────────┐
│  [bandeira] País  2 x 1  [bandeira] País│
│  15/06/2026 · 16:00                     │
│  ─────────────────────────────────────  │
│  Meu palpite: 2 × 1      [badge status] │
└─────────────────────────────────────────┘
```

- **Não é link** — é um card informacional puro (sem ação de navegação).
- Subcomponente `TeamFlag` (bandeira + fallback iniciais) — reusar lógica de `MatchCard`.
- Data e hora: `format(kickoffAt, "dd/MM/yyyy · HH:mm", { locale: ptBR })`.
- Placar palpitado: `{prediction.homeScore} × {prediction.awayScore}` em `font-bold`.
- Badge: usa `PREDICTION_DISPLAY_STATUS_LABEL[displayStatus]` + `PREDICTION_DISPLAY_STATUS_COLOR[displayStatus]` + ícone acessível.

### Badge de status

```tsx
<span
  className={cn("inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium", PREDICTION_DISPLAY_STATUS_COLOR[displayStatus])}
>
  {PREDICTION_DISPLAY_STATUS_LABEL[displayStatus]}
</span>
```

**Acessibilidade:** badge contém **texto**, não apenas cor (design system seção 10).

### Estrutura JSX (esqueleto)

```tsx
<article
  className="rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col gap-3"
  aria-label={`${item.homeTeam.name} vs ${item.awayTeam.name}`}
>
  {/* Times */}
  <div className="flex items-center justify-between gap-2">
    <TeamInfo team={item.homeTeam} />
    <ScoreDisplay prediction={item.prediction} />
    <TeamInfo team={item.awayTeam} />
  </div>

  {/* Data */}
  <p className="text-xs text-muted-foreground text-center">
    {format(new Date(item.kickoffAt), "dd/MM/yyyy · HH:mm", { locale: ptBR })}
  </p>

  {/* Divider + placar + badge */}
  <div className="border-t border-border pt-3 flex items-center justify-between">
    <span className="text-xs text-muted-foreground">
      Meu palpite:{" "}
      <span className="font-bold text-foreground">
        {item.prediction.homeScore} × {item.prediction.awayScore}
      </span>
    </span>
    <StatusBadge displayStatus={item.displayStatus} />
  </div>
</article>
```

---

## 8. Componente `PredictionList`

### Arquivo

`src/features/predictions/components/PredictionList.tsx`

### Contrato

```ts
export interface PredictionListProps {
  items: PredictionListItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}
```

### Lógica de renderização

1. `isLoading` → `<PredictionListSkeleton count={4} />` (skeleton inline ou reutilizando padrão do MatchListSkeleton).
2. `isError` → estado de erro com botão "Tentar novamente" (padrão `MatchesErrorState`).
3. `items.length === 0` → estado vazio "Nenhum palpite ainda" (com ícone `PenLine`).
4. Caso base → lista de `PredictionListCard`.

```tsx
<div className="flex flex-col gap-4">
  {items.map((item) => (
    <PredictionListCard key={item.matchId} item={item} />
  ))}
</div>
```

---

## 9. Página `/predictions`

### Arquivo

`src/app/(app)/predictions/page.tsx`

### Cabeçalho

```
"Meus Palpites" — text-2xl font-semibold text-foreground
```

### Estrutura

```tsx
"use client";

export default function PredictionsPage() {
  const { items, isLoading, isError, refetch } = usePredictionsList();
  const [activeFilter, setActiveFilter] = useState<FilterChip>("todos");

  // Filtro puro em memória
  const filteredItems = activeFilter === "todos"
    ? items
    : items.filter((item) => item.displayStatus === activeFilter);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-foreground">Meus Palpites</h1>

      {/* Chips de filtro — somente quando há dados ou carregando */}
      {!isError && (
        <PredictionFilters
          activeFilter={activeFilter}
          onChange={setActiveFilter}
        />
      )}

      <PredictionList
        items={filteredItems}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
      />
    </div>
  );
}
```

**Notas:**
- `"use client"` obrigatório (usa hooks).
- `activeFilter` state: inicializado a partir do `localStorage` — pode ser gerido dentro de `PredictionFilters` com callback `onChange`, ou na página. **Recomendado:** inicializar na página via lazy state lendo `localStorage` (mantém a página como controlador do estado, passando para `PredictionFilters`).
- Lista filtrada é computada na página (filtro puro em memória).

---

## 10. Skeleton para lista de palpites

Implementar `PredictionListSkeleton` inline em `PredictionList.tsx` (ou em arquivo separado seguindo o padrão `MatchListSkeleton`). Replicar o layout de `PredictionListCard`:

```tsx
function PredictionCardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando palpite"
      className="rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col gap-3"
    >
      {/* Times */}
      <div className="flex items-center justify-between gap-2" aria-hidden="true">
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-7 rounded-sm bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="h-3 w-14 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        </div>
        <div className="flex gap-1 items-center">
          <div className="h-8 w-6 rounded bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="h-4 w-3 rounded bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="h-8 w-6 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-7 rounded-sm bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="h-3 w-14 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        </div>
      </div>
      {/* Data */}
      <div aria-hidden="true" className="h-3 w-32 mx-auto rounded bg-muted animate-pulse motion-reduce:animate-none" />
      {/* Rodapé */}
      <div className="border-t border-border pt-3 flex justify-between" aria-hidden="true">
        <div className="h-4 w-28 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        <div className="h-5 w-20 rounded-sm bg-muted animate-pulse motion-reduce:animate-none" />
      </div>
    </div>
  );
}
```

---

## 11. Atualização dos barrels

### `src/features/predictions/hooks/index.ts` — adicionar

```ts
export { usePredictionsList } from "./usePredictionsList";
export type { PredictionListItem, PredictionsListData } from "./usePredictionsList";
```

### `src/features/predictions/components/index.ts` — adicionar

```ts
export { PredictionListCard } from "./PredictionListCard";
export { PredictionFilters }  from "./PredictionFilters";
export type { FilterChip, PredictionFiltersProps } from "./PredictionFilters";
export { PredictionList }     from "./PredictionList";
```

---

## 12. Contrato de imports

| Símbolo | Importar de |
|---|---|
| `usePredictions(uid)` | `@/features/predictions/hooks` |
| `useMatches()` | `@/features/matches/hooks` |
| `useTeams()` | `@/features/matches/hooks` |
| `buildTeamMap`, `resolveTeam`, `ResolvedTeam` | `@/features/matches/lib` |
| `derivePredictionDisplayStatus`, `PredictionDisplayStatus`, `PREDICTION_DISPLAY_STATUS_LABEL`, `PREDICTION_DISPLAY_STATUS_COLOR` | `@/features/predictions/lib` |
| `useAuth` | `@/hooks/useAuth` |
| `cn` | `@/lib/utils` |
| `format` | `date-fns` |
| `ptBR` | `date-fns/locale` |

---

## 13. Restrições de implementação

1. **Sem `any`** — TypeScript strict.
2. **Sem estilos inline** — apenas classes Tailwind.
3. **Sem `new Date()` hardcoded** — `now` injetado ou capturado no render (padrão do projeto).
4. **`localStorage` com `try/catch`** — SSR safety.
5. **Chips: `<button type="button">`** com `aria-pressed` — não usar radio inputs.
6. **Badge com texto** — nunca apenas cor.
7. **Toque mínimo 44×44px** em chips e botões de ação.
8. **Sem import de `useMatchesList`** — o compositor `usePredictionsList` é independente.
9. **`"use client"`** em todos os componentes interativos e na página.
10. **Sem contar itens nos chips** — optional não implementado (A4 do PRD diz "opcional").

---

## 14. Critérios de aceitação

- [ ] `usePredictionsList` retorna apenas itens de jogos com palpite do usuário.
- [ ] Itens ordenados por `kickoffAt` ASC.
- [ ] `displayStatus` derivado via `derivePredictionDisplayStatus` (TASK-02).
- [ ] Chip "Todos" selecionado por default; filtro persistido no `localStorage`.
- [ ] Chips: Todos · Pendentes · Acertos · Erros · Bloqueados.
- [ ] Filtro funciona em memória sem requisição extra.
- [ ] `PredictionListCard` exibe: bandeiras, nomes, data/hora, placar palpitado, badge de status.
- [ ] Badge usa `PREDICTION_DISPLAY_STATUS_LABEL` + `PREDICTION_DISPLAY_STATUS_COLOR` (TASK-02).
- [ ] Estado loading: skeletons com `aria-busy="true"`.
- [ ] Estado empty: "Nenhum palpite ainda" com ícone.
- [ ] Estado error: "Tentar novamente" com botão de retry.
- [ ] Página `/predictions` renderiza header "Meus Palpites".
- [ ] Nav já funciona (sem alteração necessária — item já existe em `nav-items.ts`).
- [ ] `rtk tsc` sem erros após as alterações.
- [ ] Sem `any` introduzido.
- [ ] Chips acessíveis: `role="group"` no wrapper, `aria-pressed` em cada chip, toque ≥ 44px.

---

## 15. O que esta tarefa NÃO faz

- Não altera `nav-items.ts` — item "Palpites" já existe.
- Não cria Route Handlers (TASK-03/04).
- Não altera Security Rules (TASK-05).
- Não cria o formulário de palpite (TASK-07).
- Não implementa integração no detalhe do jogo (TASK-09).
- Não calcula rankings ou estatísticas.
- Não adiciona contadores nos chips (feature opcional não solicitada).
