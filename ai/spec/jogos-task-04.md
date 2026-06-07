# Spec — TASK-04: Página Lista de Jogos (`/matches`)

> PRD: `ai/prd/jogos.md` · Plan: `ai/plan/jogos.md` · Branch: `feat/integracao-api-football`
> Dependências: TASK-01 (lib pura), TASK-02 (hooks), TASK-03 (componentes base)
> Saída: `src/app/(app)/matches/page.tsx`, `src/features/matches/components/MatchList.tsx`, `src/features/matches/components/MatchListHeader.tsx`

---

## 1. Objetivo

Substituir o placeholder de `/matches` pela lista real de jogos da Copa 2026, agrupada por dia, com header de busca, chips de filtro rápido e estados loading/empty/error. O filtro avançado (sheet) é preparado na TASK-05 — este spec inclui apenas o botão e o estado `filtersOpen`.

---

## 2. Arquivos a criar / modificar

| Arquivo | Ação |
|---|---|
| `src/app/(app)/matches/page.tsx` | **Substituir** placeholder |
| `src/features/matches/components/MatchList.tsx` | **Criar** — compositor da lista |
| `src/features/matches/components/MatchListHeader.tsx` | **Criar** — header com busca + botão filtros + chips |
| `src/features/matches/components/__tests__/MatchList.test.tsx` | **Criar** — testes co-localizados |
| `src/features/matches/components/__tests__/MatchListHeader.test.tsx` | **Criar** — testes co-localizados |

### NÃO modificar
- `src/features/matches/components/index.ts` — barrel protegido
- `src/features/matches/index.ts` — barrel top-level protegido
- Qualquer arquivo de TASK-01, TASK-02, TASK-03

---

## 3. Comportamento esperado

### 3.1 page.tsx
- Server Component (sem `"use client"`).
- Importa e renderiza `<MatchList />` diretamente.
- AuthGuard + AppShell já aplicados pelo layout pai.
- Padrão espelhado de `src/app/(app)/home/page.tsx`.

### 3.2 MatchListHeader

Props:
```ts
interface MatchListHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedStage: Stage | undefined;
  onStageChange: (stage: Stage | undefined) => void;
  selectedPredictionStatus: MatchPredictionStatus | undefined;
  onPredictionStatusChange: (status: MatchPredictionStatus | undefined) => void;
  onFiltersOpen: () => void;   // abre sheet (TASK-05 implementa); aqui só seta state
  filtersCount: number;        // número de filtros avançados ativos (0 = sem badge)
}
```

Elementos:
1. **Título "Jogos"** — `text-2xl font-semibold text-foreground`
2. **Input de busca** — shadcn `<Input>`, placeholder "Buscar por seleção", `aria-label="Buscar jogos por seleção"`, ícone `Search` à esquerda (Lucide), `value={searchQuery}`, `onChange`.
3. **Botão de filtros** — shadcn `<Button variant="outline" size="icon">`, ícone `SlidersHorizontal` (Lucide), `aria-label="Abrir filtros avançados"`, badge numérica se `filtersCount > 0`.
4. **Chips de filtro rápido** — linha horizontal scrollável (overflow-x-auto, sem scrollbar visível):
   - Chip "Fase": dropdown simples ou chips clicáveis por fase. Implementação: botões com variante "outline" quando não selecionado, "default" quando selecionado.
   - Chip "Todos" (status de palpite — padrão selecionado).
   - Chip "Todas as seleções" — liga/desliga filtro de time.
   - Referência visual: PRD03-01 (linha de chips com "Fase de Grupos ▾", "Todos ▾", "Todas as seleções ▾").

Chips concretos (mapeados do PRD):
- **Fase** (Stage): "Fase de Grupos", "Oitavas", "Quartas", "Semifinal", "3º Lugar", "Final". Chip singular — seleção exclusiva (um ou nenhum).
- **Status do Palpite**: "Todos", "Enviados", "Pendentes", "Bloqueados". Chip "Todos" = `undefined` (sem filtro).

### 3.3 MatchList

Props: nenhuma (vai ao hook internamente).

Lógica interna:
1. `useMatchesList()` → `{ groups, flatList, isLoading, isError, refetch }`.
2. Estado local: `searchQuery: string`, `selectedStage: Stage | undefined`, `selectedPredictionStatus: MatchPredictionStatus | undefined`, `filtersOpen: boolean`.
3. **Pipeline de filtro** (aplicado sobre `flatList`, resultado re-agrupado):
   a. `searchMatchesByCountry(flatList, teamMap, searchQuery)` — mas `teamMap` não está exposto pelo hook. Solução: usar `flatList` com `homeTeam.name` e `awayTeam.name` já resolvidos (busca por nome, não por id).
   b. Filtro de `selectedStage`: `.filter(item => !selectedStage || item.stage === selectedStage)`.
   c. Filtro de `selectedPredictionStatus`: `.filter(item => !selectedPredictionStatus || item.predictionStatus === selectedPredictionStatus)`.
   d. Re-agrupar a `filteredList` em seções de dia (usando a mesma lógica de `groupMatchesByDay`, mas sobre `MatchListItem[]` — criar helper local `regroupByDate` ou reusar os `groups` originais filtrando cada seção).
4. Estado de busca sobre o view-model (`MatchListItem`) usando `homeTeam.name` / `awayTeam.name` (já resolvidos pelo compositor).
5. `filtersCount` = quantidade de filtros avançados ativos (neste momento: 0, pois sheet é TASK-05).

Renderização:
- `isLoading` → `<MatchListSkeleton count={5} />`
- `isError && !isLoading` → `<MatchesErrorState onRetry={refetch} />`
- `filteredGroups.length === 0` (sem loading/erro) → `<MatchesEmptyState />`
- Senão → seções por dia: cabeçalho de seção + lista de `<MatchCard>`.

Seção por dia:
```tsx
<section key={group.date} aria-labelledby={`section-${group.date}`}>
  <h2 id={`section-${group.date}`} className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
    {group.label}
  </h2>
  <div className="flex flex-col gap-4">
    {group.matches.map(item => (
      <MatchCard
        key={item.id}
        match={/* MatchWithId reconstructed */}
        homeTeam={item.homeTeam}
        awayTeam={item.awayTeam}
        predictionStatus={item.predictionStatus}
        detailHref={`/matches/${item.id}`}
      />
    ))}
  </div>
</section>
```

> MatchCard recebe `match: MatchWithId` — o `MatchListItem` tem os campos necessários (id, kickoffAt, stage, round, groupId, venue, status, homeScore, awayScore). Passar o item como `match` com cast satisfying `MatchWithId` — ou criar adapter inline. Ver §6 (Considerações técnicas).

### 3.4 Placeholder para o Sheet (TASK-05)

Em `MatchList`:
```tsx
{/* TODO TASK-05: MatchFiltersSheet */}
{/* filtersOpen state pronto; sheet será montado em TASK-05 */}
```

O botão `onFiltersOpen` em `MatchListHeader` deve apenas chamar `setFiltersOpen(true)`.

---

## 4. Lógica de re-agrupamento

Após filtrar o `flatList` em `filteredList: MatchListItem[]`, re-agrupar por `kickoffAt` (os 10 primeiros caracteres, UTC):

```ts
function regroupItems(items: MatchListItem[], originalGroups: MatchListItemDaySection[]): MatchListItemDaySection[] {
  // Preservar label e date das seções originais; filtrar matches
  return originalGroups
    .map(group => ({
      ...group,
      matches: group.matches.filter(m => items.some(fi => fi.id === m.id)),
    }))
    .filter(group => group.matches.length > 0);
}
```

Isso evita recalcular labels de data ("Hoje"/"Amanhã") — preserva as seções originais do hook.

---

## 5. Interface de busca local (sem teamMap)

`MatchListItem` já expõe `homeTeam.name` e `awayTeam.name` (strings resolvidas). Portanto, a busca por seleção opera diretamente sobre esses campos — sem necessidade de rexpor `teamMap` ou chamar `searchMatchesByCountry` (que recebe `MatchWithId[]`).

Implementar como função pura co-localizada:
```ts
function searchItems(items: MatchListItem[], query: string): MatchListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    item =>
      item.homeTeam.name.toLowerCase().includes(q) ||
      item.awayTeam.name.toLowerCase().includes(q),
  );
}
```

---

## 6. Considerações técnicas

### 6.1 MatchCard recebe `match: MatchWithId`

`MatchListItem` tem todos os campos de `MatchWithId` mais os campos derivados (`homeTeam`, `awayTeam`, `predictionStatus`). Para passar ao MatchCard, extrair os campos `MatchWithId`-compatíveis inline:

```tsx
<MatchCard
  match={{
    id: item.id,
    kickoffAt: item.kickoffAt,
    stage: item.stage,
    round: item.round,
    groupId: item.groupId,
    venue: item.venue,
    status: item.status,
    homeScore: item.homeScore,
    awayScore: item.awayScore,
    homeTeamId: "",   // não usado pelo card (já resolvido)
    awayTeamId: "",   // não usado pelo card (já resolvido)
  } as MatchWithId}
  ...
/>
```

Melhor: verificar se `MatchCard` aceita um objeto que satisfaz `MatchWithId` — sem `homeTeamId`/`awayTeamId` usados internamente no card. Se o card usa esses campos, adaptar conforme necessário. O `MatchListItem` tem todos os campos exceto `homeTeamId`/`awayTeamId` — esses são IDs brutos, não usados na renderização do card (o card usa `homeTeam: ResolvedTeam`).

Opção mais limpa: estender `MatchListItem` para incluir `homeTeamId`/`awayTeamId` no hook (TASK-02 já os tem no `match` bruto). Checar `useMatchesList` — a `MatchListItem` não inclui `homeTeamId`/`awayTeamId`. Solução definitiva: no `MatchList`, ao montar o `match` prop, passar valores placeholder para campos não usados pelo card, ou verificar exatamente quais campos do `match: MatchWithId` o card consome internamente.

Olhando o `MatchCard.tsx`: o card usa `match.groupId`, `match.round`, `match.stage`, `match.status`, `match.homeScore`, `match.awayScore`, `match.kickoffAt`, `match.venue`. Não usa `homeTeamId`/`awayTeamId`. Portanto, o cast com strings vazias é seguro.

### 6.2 TypeScript strict

- Nenhum `any`.
- Chips de Stage: `Stage` vem de `@/types` (re-exportado de `schemas/shared.ts`).
- `MatchPredictionStatus` vem de `@/features/matches/lib/matchesHelpers`.

### 6.3 Layout geral de MatchList

```
<div className="flex flex-col gap-4 pb-20">     ← pb-20 para BottomNav
  <MatchListHeader ... />
  {/* conteúdo: skeleton | error | empty | seções */}
  <div className="flex flex-col gap-6">
    {filteredGroups.map(group => <section>...)}
  </div>
</div>
```

---

## 7. Acessibilidade

- Input de busca: `aria-label`, `htmlFor` com `<label>` explícita (ou aria-label no input).
- Botão filtros: `aria-label="Abrir filtros avançados"`.
- Chips: `role="group" aria-label="Filtros rápidos"`, cada botão com texto descritivo.
- Seções: `<section aria-labelledby>` com `<h2>`.
- Focus rings visíveis em todos os elementos interativos.
- Área de toque mínima 44px para chips e botão filtros.

---

## 8. Testes co-localizados

### MatchListHeader.test.tsx
- Renderiza título "Jogos".
- Input de busca com aria-label correto.
- Botão filtros com aria-label correto.
- `onSearchChange` chamado ao digitar.
- `onFiltersOpen` chamado ao clicar no botão filtros.
- Chip de fase selecionado muda variant visual; `onStageChange` chamado.
- Chip "Todos" (predictionStatus) `onPredictionStatusChange(undefined)` chamado.

### MatchList.test.tsx
- Renderiza `MatchListSkeleton` quando `isLoading=true` (mock hook).
- Renderiza `MatchesErrorState` quando `isError=true, isLoading=false`.
- Renderiza `MatchesEmptyState` quando lista vazia.
- Renderiza seções com cabeçalhos de dia e cards quando há dados.
- Filtro de stage funciona: ao selecionar stage, apenas cards da fase aparecem.
- Filtro de predictionStatus funciona.
- Busca por nome de time filtra os cards.
- `detailHref` dos cards aponta para `/matches/{id}`.

---

## 9. Restrições

- **NÃO** criar `src/app/(app)/matches/[id]/` (TASK-06).
- **NÃO** modificar barrels `index.ts`.
- **NÃO** implementar o Sheet interno — apenas placeholder comentado.
- Importar componentes TASK-03 via caminho direto: `@/features/matches/components/MatchCard`, etc.
- Importar hook via caminho direto: `@/features/matches/hooks/useMatchesList`.
