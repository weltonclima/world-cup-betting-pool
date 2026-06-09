# VERIFICATION

## 1. Task: TASK-11 – Tela 04: Evolução no Ranking

## 2. Must-have truths
- T-01: `/rankings/evolucao` renderiza `Evolution` (stub substituído) — **VERIFIED**
- T-02: Header verde + `EvolutionLineChart` com posição por rodada do usuário logado — **VERIFIED**
- T-03: Lista recente→antiga com `#N` + indicador (ícone+texto) + delta — **VERIFIED**
- T-04: Badge "Atual" na rodada mais recente; rodada 1 (sem anterior) exibe "—" (manteve) — **VERIFIED**
- T-05: Legenda Subiu/Manteve/Caiu presente (ícone+texto) — **VERIFIED**
- T-06: Estados loading (skeleton) / empty ("Sem histórico ainda") / error (+retry) ligados ao hook — **VERIFIED**
- T-07: `positionHistory` filtrado ao escopo "geral" e ordenado por `at`; rótulo com fallback por índice — **VERIFIED**
- T-08: Sem `any`, tsc strict, tokens sem hex/inline, Lucide named, suite verde — **VERIFIED**

## 3. Evidence per truth
- **T-01:** `src/app/(app)/rankings/evolucao/page.tsx` → `return <Evolution />` (Server Component fino importando do barrel `@/features/rankings`). Barrel `src/features/rankings/components/index.ts:16` exporta `Evolution`.
- **T-02:** `Evolution.tsx:61-66` — `<section className="rounded-2xl bg-primary p-4 text-primary-foreground">` com `<h2>Sua evolução nas rodadas</h2>` e `<EvolutionLineChart data={chartData} />`. `chartData = toEvolutionPoints(geral)` (`Evolution.tsx:48`) → `{ label: "R"+round||índice, position }` (myRankingDerivations.ts:22-29). Eixo Y já invertido no chart (`YAxis reversed`, EvolutionLineChart.tsx:46).
- **T-03:** `EvolutionRow` (`Evolution.tsx:84-140`): esquerda `Rodada {round}`; direita `#{position}` (`text-base font-bold tabular-nums`) + indicador `flex items-center gap-1` com `<Icon size={16} aria-hidden />` + delta. Lista em `<ol className="divide-y ...">` (`Evolution.tsx:68-72`).
- **T-04:** `isCurrent: i === geral.length - 1` (`Evolution.tsx:55`) calculado em ordem ascendente; lista invertida `[...rowsAsc].reverse()` (`Evolution.tsx:57`) → mais recente no topo, badge "Atual" (`Evolution.tsx:115-119`). Rodada 1: `evolutionIndicator(geral[i-1]?.position, ...)` com `geral[-1]` indefinido → `evolutionIndicator(undefined, pos)` → `{direction:"same",delta:0}` (evolution.ts:16) → render "—" (`Evolution.tsx:134`).
- **T-05:** `EvolutionLegend` (`Evolution.tsx:143-163`) — `<ul>` com 3 `<li>`: `ArrowUp text-primary`+"Subiu", `Minus text-muted-foreground`+"Manteve", `ArrowDown text-destructive`+"Caiu". Cada item ícone + texto.
- **T-06:** `if (isLoading) return <RankingSkeleton/>` (`:35`); `if (isError) return <RankingErrorState onRetry={()=>void refetch()}/>` (`:36`); `geral.length===0 → <RankingEmptyState message="Sem histórico ainda" subtitle=...>` (`:39-46`). Hook `useParticipantProfile(uid)` com `uid = useAuth().firebaseUser?.uid` (`:32-33`).
- **T-07:** `geralHistory(data.positionHistory)` (`:38`) filtra `scope === "geral"` e ordena por `a.at.localeCompare(b.at)` (myRankingDerivations.ts:9-16). Rótulo `R${h.round ?? i+1}` (toEvolutionPoints) e `round: h.round ?? i+1` na linha (`Evolution.tsx:52`) — fallback por índice. Teste injeta ruído `scope:"oitavas"` que é ignorado.
- **T-08:** scan `any` → nenhum; `rtk tsc --noEmit` → "TypeScript compilation completed" (exit 0); classes só tokens (`bg-primary`, `bg-card`, `text-destructive`, `text-muted-foreground`, `divide-border` etc., sem hex/inline); `ArrowUp/ArrowDown/Minus` Lucide named; `.ranking-theme` herdado do layout (`src/app/(app)/rankings/layout.tsx:12`); vitest Evolution 3/3.

## 4. Test correlation
- `Evolution.test.tsx` (3, jsdom): (1) lista recente→antiga — assert `Rodada 4`/`Rodada 1`, badge `Atual`, `#4`/`#15`, `getByLabelText("manteve a posição")`, `subiu 5 posições`, e `getAllByLabelText("subiu 3 posições").length===2` (R3 10→7 e R4 7→4). Inclui ruído `scope:"oitavas"` provando o filtro. (2) `positionHistory:[]` → "Sem histórico ainda". (3) `isError` → "Tentar Novamente". Mock do hook via barrel + import por path direto do componente — assertam texto/aria renderizado, não internals.

## 5. Out-of-scope drift
none. Só Tela 04. Reusa `geralHistory`/`toEvolutionPoints` (TASK-10 lib), `evolutionIndicator` (TASK-02), `EvolutionLineChart` (TASK-06), `useParticipantProfile` (TASK-05), estados (TASK-07) — sem recriar. Nenhuma escrita (só leitura).

## 6. Findings
- BLOCKER: nenhum
- WARNING:
  - WR-01 (a11y, baixo): badge "Atual" é `<span>` estilizado, não o Shadcn `Badge` sugerido no /screen §5. Funcional e legível; divergência cosmética.
  - Nota (G2): contraste do gráfico no header verde resolvido aninhando o chart em superfície clara `bg-card` (`Evolution.tsx:63`) — opção (a) do /screen G2, AA-sound. Diverge do mock (linha branca sobre verde) mas fiel à intenção.

## 7. Verdict: goal-achieved
