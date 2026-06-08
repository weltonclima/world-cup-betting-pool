# VERIFICATION

## 1. Task: TASK-10 – Tela 02: Meu Ranking

## 2. Must-have truths
- T-01: `/rankings/eu` renderiza `MyRanking` (stub TASK-07 substituído) — **VERIFIED**
- T-02: Header verde "Sua Posição Atual #N de M participantes" + badge "Você" — **VERIFIED**
- T-03: Grid 2×2 — Pontos, Acertos, Erros, Aproveitamento ("X de Y jogos") — **VERIFIED**
- T-04: Binário — Pontos e Acertos exibem o MESMO valor (`entry.points`) + microcopy — **VERIFIED**
- T-05: Mini-gráfico "Desempenho Geral" plota evolução (scope geral); vazio → "Sem histórico ainda" — **VERIFIED**
- T-06: Cards derivados "Melhor Posição #N (Rodada N)" + "Média de Pontos … por rodada"; "—" sem histórico — **VERIFIED**
- T-07: Estados loading/empty/error(retry das duas queries) ligados aos dois hooks — **VERIFIED**
- T-08: Link contextual `/rankings/evolucao` (next/link, ≥44px) — **VERIFIED**
- T-09: Derivações (§6.3) corretas: bestPosition=min+round, média=points/rounds pt-BR 1-dec / "—", filtro scope geral ordenado por `at` — **VERIFIED**
- T-10: Alternativa textual do gráfico (sr-only/aria) — **VERIFIED**
- T-11: Sem `any`, tsc strict, tokens sem hex/inline, Lucide named, suite verde — **VERIFIED**

## 3. Evidence per truth
- **T-01:** `src/app/(app)/rankings/eu/page.tsx` → `return <MyRanking />` (Server Component fino, importa de `@/features/rankings`). Substitui o stub da TASK-07.
- **T-02:** `MyRankingHeader` (`MyRanking.tsx:164-186`): `rounded-2xl bg-primary p-6 text-center text-primary-foreground`, `aria-label="Sua posição atual: número ${position} de ${total} participantes"`, label "Sua Posição Atual", `#{position}` em `text-4xl font-bold tabular-nums`, `<Badge>Você</Badge>` (textual), "de {total} participantes".
- **T-03:** Grid `grid grid-cols-2 gap-3` (`:110`) com 4 `StatCard`: "Pontos", "Acertos", "Erros", "Aproveitamento". Hint do Aproveitamento = `${correct} de ${playedGames} jogos` onde `playedGames = correct + (totalWrong ?? 0)` (`:96-97`) — denominador = acertos+erros (OQ1 default G3).
- **T-04:** `points = entry.points` (`:90`). Card "Pontos" e card "Acertos" recebem ambos `value={String(points)}` (`:111`,`:113`). Acertos carrega microcopy via `hint="Cada placar exato vale 1 ponto — pontos e acertos são o mesmo número."` (`:115`). Não soma/cruza os valores. (G1 default: dois cards mesmo valor + microcopy.)
- **T-05:** `evolution = toEvolutionPoints(geral)` (`:84`) passado a `<EvolutionLineChart data={evolution} />` (`:141`). `EvolutionLineChart` trata `data.length === 0` → `<p>Sem histórico ainda</p>` (`EvolutionLineChart.tsx:32-38`). `geralHistory` filtra `scope === "geral"` e ordena por `at.localeCompare` (`myRankingDerivations.ts:9-16`).
- **T-06:** Card "Melhor Posição" `value = best === null ? "—" : "#${best.position}"`, `hint = "Rodada ${best.round}"` (`:146-151`). Card "Média de Pontos" `value = average`, `hint="por rodada"` (`:152-157`). `average = averagePointsPerRound(entry.points, rounds)` → "—" quando rounds=0 (`myRankingDerivations.ts:66-69`).
- **T-07:** `if (myRanking.isLoading || profile.isLoading) return <RankingSkeleton rows={6}/>` (`:40-42`); `if (myRanking.isError || profile.isError) return <RankingErrorState onRetry={() => { void myRanking.refetch(); void profile.refetch(); }}/>` (`:44-53`, retry das DUAS); `if (!myRanking.data || !profile.data) return <RankingEmptyState message="Você ainda não está no ranking" subtitle="Faça seus palpites e volte após a apuração."/>` (`:55-62`).
- **T-08:** `<Link href="/rankings/evolucao" className="inline-flex min-h-11 items-center px-2 … focus-visible:ring-2 focus-visible:ring-ring">Ver evolução</Link>` (`:132-137`) — next/link, alvo ≥44px (`min-h-11`), foco visível.
- **T-09:** Derivações puras em `myRankingDerivations.ts`:
  - `geralHistory` — filtra `scope==="geral"`, `.slice().sort((a,b)=>a.at.localeCompare(b.at))` (imutável, ordenado por `at`).
  - `bestPosition` — `length===0 → null`; itera com `h.position <= best.position` (≤ ⇒ empate na MENOR posição resolve para a ocorrência mais recente, conforme §6.3); `round = h.round ?? i+1`.
  - `averagePointsPerRound` — `rounds===0 → "—"`, senão `Intl.NumberFormat("pt-BR",{maximumFractionDigits:1})` (ex.: 12/3 → "4"; 87/5 → "17,4").
  - `toEvolutionPoints` — `label = "R${h.round ?? i+1}"`, `position = h.position` (compat round opcional).
- **T-10:** Wrapper do gráfico `<div role="img" aria-label={evolutionSummary}>` com `<p className="sr-only">{evolutionSummary}</p>` (`:139-142`). `evolutionSummary` = "Posição por rodada: R1 #15, R2 #10, … ." ou "Sem histórico de posições ainda." (`:99-104`).
- **T-11:** tsc `--noEmit` exit 0 ("TypeScript compilation completed"). Sem `any` no arquivo (tipos explícitos `JSX.Element`, props tipadas, `LucideIcon`). Classes só tokens (`bg-primary`, `text-primary-foreground`, `border-border`, `bg-card`, `text-muted-foreground`, `text-primary`) — sem hex, sem `style=`. Ícones Lucide named (`Award`, `Percent`, `Target`, `TrendingUp`, `Trophy`, `XCircle`). Suite `MyRanking.test.tsx` 4/4 (cross-check JSON: total 4, passed 4, failed 0 — não é false-green).

## 4. Test correlation
- `MyRanking.test.tsx` (4, jsdom): (1) header `#4 / de 28 participantes / Você`; (2) Pontos+Acertos mesmo valor 12 (`getAllByText("12") >= 2`) + Aproveitamento 25% + "12 de 48 jogos"; (3) deriva Melhor Posição "Rodada 3" (#4 mín do geral) + Média "por rodada"; (4) empty quando `useMyRanking` = null. Mocka hooks via barrel + import direto do componente — assertam texto renderizado (comportamento), não mocks internos. O teste valida explicitamente a fronteira de escopo do filtro geral: o positionHistory inclui um snapshot `scope:"oitavas"` (#2) que NÃO deve virar a melhor posição — e o teste confirma "Rodada 3" (#4 geral), provando o filtro.
- Nenhum teste dedicado para `myRankingDerivations.ts` (lib helper). §9 marca testes como "leves/recomendados, não bloqueantes"; a math está coberta indiretamente pelo teste de componente (mín, média, filtro scope, empate). Gap menor — ver review WR-01.

## 5. Out-of-scope drift
none. Só a Tela 02 (Meu Ranking). Helper de derivação extraído para `lib/myRankingDerivations.ts` + barrel `lib/index.ts` (reutilizável pela Tela 04 Evolução — escopo correto, previsto na §5/§13 OQ4). Não refez recalc/serviços/hooks/gráfico/estados (TASK-03/04/05/06/07). Não tocou Tela 04 (TASK-11) — só o link contextual.

## 6. Findings
- BLOCKER: nenhum
- WARNING: ver `ai/review/ranking-task-10.md` (WR-01 lib helper sem teste dedicado — não-bloqueante; WR-02 dark-green carry-forward TASK-14).
  - Nota (G1): divergência consciente do mock 3/1/0 → sob binário Pontos===Acertos (mesmo valor + microcopy). Fiel ao sistema, não ao mock.
  - Nota (G3): denominador "X de Y jogos" = acertos + erros (default client); preferir `totalFinished` do recalc se exposto.
  - Nota (G4): `totalWrong` ausente → "—" (não 0), conforme default. Verificado em `:92`.

## 7. Verdict: goal-achieved
