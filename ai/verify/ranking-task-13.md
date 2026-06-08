# VERIFICATION

## 1. Task: TASK-13 – Tela 06: Estatísticas Gerais

## 2. Must-have truths
- T-01: `/rankings/estatisticas` renderiza `PoolStatsScreen` (stub substituído) — **VERIFIED**
- T-02: Header verde "Visão Geral do Bolão" + `totalParticipants` pt-BR + "Participantes" — **VERIFIED**
- T-03: Grid 2×2 — Maior (highestPoints + highestPointsName‖"Participante"), Menor (lowestPoints/"Participante"), Média (averagePoints pt-BR "56,4"), Total (totalCorrect/"placares exatos") — **VERIFIED**
- T-04: Seção `h2` "Distribuição de Pontuação" consome `DistributionBars buckets={distribution}` as-is — **VERIFIED**
- T-05: `distribution` vazio (com participantes) → seção oculta; cards permanecem — **VERIFIED**
- T-06: Empty quando `data===null/undefined` OU `totalParticipants===0` → `RankingEmptyState` (cópia fixa) — **VERIFIED**
- T-07: Estados loading (skeleton) / error (retry=refetch) ligados ao hook — **VERIFIED**
- T-08: pt-BR via `Intl.NumberFormat` (não hardcode); `tabular-nums`; sem any/hex/inline; Lucide; tsc 0; suite verde — **VERIFIED**

## 3. Evidence per truth
- **T-01:** `src/app/(app)/rankings/estatisticas/page.tsx` → `return <PoolStatsScreen />` (import do barrel `@/features/rankings`). Server Component fino; client vive no componente.
- **T-02:** `PoolStatsScreen.tsx:58-64` `<header className="rounded-2xl bg-primary p-6 text-center text-primary-foreground">` com `<p>Visão Geral do Bolão</p>` → `<p className="text-4xl font-bold tabular-nums">{integerFormatter.format(data.totalParticipants)}</p>` → `<p>Participantes</p>`. `integerFormatter = new Intl.NumberFormat("pt-BR")` (L12).
- **T-03:** `PoolStatsScreen.tsx:66-87` grid `grid grid-cols-1 gap-4 sm:grid-cols-2`. Quatro `StatCard`: Maior `value=format(highestPoints)` `sublabel={data.highestPointsName ?? "Participante"}` (L70); Menor `value=format(lowestPoints)` sublabel fixo "Participante" (L75); Média `value=averageFormatter.format(averagePoints)` sublabel "pontos" (L79); Total `value=format(totalCorrect)` sublabel "placares exatos" (L84). `averageFormatter` = `Intl.NumberFormat("pt-BR",{min/maxFractionDigits:1})` (L13-16) → "56,4". `StatCard` (L19-37): valor `text-3xl font-bold tabular-nums text-primary`, label `text-sm text-muted-foreground`, sublinha `text-xs text-muted-foreground`.
- **T-04:** `PoolStatsScreen.tsx:89-96` `<section>` com `<h2 className="text-lg font-medium text-foreground">Distribuição de Pontuação</h2>` + `<DistributionBars buckets={data.distribution} />`. `DistributionBars.tsx` consumido sem modificação (props `{buckets, className?}` conforme contrato; label + barra + count textual).
- **T-05:** `const showDistribution = data.distribution.length > 0` (L54); seção renderiza só sob `{showDistribution && (...)}` (L89). Cards e header fora do guard → permanecem. (G2/OQ2: ocultar seção, manter cards.)
- **T-06:** `if (data === null || data === undefined || data.totalParticipants === 0) return <RankingEmptyState message="Sem estatísticas ainda" subtitle="As estatísticas aparecem após o primeiro recálculo." />` (L45-52). Guarda `null` E `undefined` (hook tipado `PoolStats | null`, mas React Query entrega `undefined` antes do 1º fetch — guard correto). Cópia bate com spec §10 / screen §5.
- **T-07:** `if (isLoading) return <RankingSkeleton />` (L43); `if (isError) return <RankingErrorState onRetry={() => void refetch()} />` (L44). `RankingErrorState` (TASK-07) renderiza `<Button>Tentar Novamente</Button>` (`min-h-11`, aria-label). Hook `usePoolStats()` → `{data,isLoading,isError,refetch}`.
- **T-08:** scan `any` no arquivo novo → nenhum (`grep` confirma só os formatters tipados e props inline tipadas). Sem `style=`/hex no `PoolStatsScreen.tsx` (única exceção `style={{width}}` está em `DistributionBars`, pré-existente/permitida). Lucide: o novo arquivo não importa ícones diretamente (empty/error usam `Users`/`AlertTriangle` named via TASK-07). `tabular-nums` no header (L60) e em cada `StatCard` (L31). `tsc --noEmit` exit 0. Vitest 3/3 (raw JSON confirma `numTotal 3 pass 3 fail 0` — sem false-green).

## 4. Test correlation
- `PoolStatsScreen.test.tsx` (3, jsdom, hook mockado via `vi.mock` no path direto + import por path direto p/ não cair no barrel):
  - Populado: assert `"Visão Geral do Bolão"`, `"28"`, os 4 rótulos de card, `"56,4"` (pt-BR real), `"Joao Silva"` (highestPointsName). Assertam texto renderizado real, não mocks internos.
  - Empty: `totalParticipants: 0` → assert `"Sem estatísticas ainda"`.
  - Error: `isError:true, data:undefined` → assert `"Tentar Novamente"`.
- Cobertura adequada para tela de apresentação (TDD não obrigatório per §9). Fallback `highestPointsName` undefined não tem teste dedicado mas a lógica `?? "Participante"` é trivial e coberta pelo schema (`highestPointsName` optional, com teste no `statistics.test.ts`).

## 5. Out-of-scope drift
none. Só Tela 06. Reusa `DistributionBars` (TASK-06) e estados (TASK-07) sem recriar. Não duplica `.ranking-theme`/header/sub-nav (vêm do layout). `updatedAt` não exibido (G4/OQ3, fora do contrato visual). Nenhuma primitiva nova.

## 6. Findings
- BLOCKER: nenhum
- WARNING: nenhum
  - Nota (G2/OQ4): Menor Pontuação usa sublinha "Participante" fixa (schema não tem `lowestPointsName`). Intencional/documentado.
  - Nota (G3): tons de verde por barra do mock simplificados para `bg-primary` uniforme no `DistributionBars` pronto; cor não é portadora semântica (count textual sempre visível). Aceito.

## 7. Verdict: goal-achieved
