# SPEC

## 1. Task: TASK-10 – Tela 02: Meu Ranking

## 2. Objective

Exibir o **resumo do desempenho pessoal** do usuário logado: header verde de destaque com a posição atual ("Sua Posição Atual #N de M participantes" + badge "Você"), grid de métricas (Pontos, Acertos, Erros, Aproveitamento), mini-gráfico de linha "Desempenho Geral" (evolução de posição por rodada) e cards derivados "Melhor Posição" e "Média de Pontos". Tela de auto-acompanhamento, alcançada pela sub-nav (item "Meu Ranking", rota `/rankings/eu`).

## 3. In scope

1. Componente client `MyRanking` (`src/features/rankings/components/`) consumindo `useMyRanking()` (posição/linha) + `useParticipantProfile(uid)` (estatísticas) — uid via `useAuth().firebaseUser?.uid`.
2. Subcomponentes internos: `MyRankingHeader` (header verde de posição), `StatCard` (card de métrica reutilizável do grid), uso de `EvolutionLineChart` (TASK-06) para o "Desempenho Geral".
3. Grid 2×2 de métricas: **Pontos**, **Acertos**, **Erros**, **Aproveitamento** ("X de Y jogos") — ver regra de binário em §6.
4. Mini-gráfico "Desempenho Geral" derivado de `statistics.positionHistory` (escopo `geral`).
5. Cards derivados: **Melhor Posição** (#N + "Rodada N") e **Média de Pontos** ("por rodada"), ambos derivados de dados já carregados (ver §6).
6. Link contextual para a Evolução completa (`/rankings/evolucao`) a partir do mini-gráfico/seção (alcance da Tela 04 conforme TASK-07 screen).
7. Estados loading/empty/error ligados às duas queries, usando componentes da TASK-07 (`RankingSkeleton`/`RankingEmptyState`/`RankingErrorState`).
8. Montar em `src/app/(app)/rankings/eu/page.tsx` (substituir stub da TASK-07).

## 4. Out of scope

- Tela de Evolução completa (TASK-11) — só link contextual aqui.
- Perfil de outro participante (TASK-12), Ranking Geral/Fase/Grupo (TASK-08/09), Estatísticas Gerais (TASK-13).
- Recalc/serviços/hooks/gráfico (prontos em TASK-03/04/05/06). Sub-nav e estados (TASK-07).
- Cálculo no servidor de "média por rodada"/"melhor posição" (derivados no client a partir dos dados já carregados — ver §6 OQ).

## 5. Main technical areas

`src/features/rankings/components/MyRanking.tsx` (+ subcomponentes `MyRankingHeader`, `StatCard`), `src/app/(app)/rankings/eu/page.tsx` (Server Component fino → renderiza `MyRanking`), barrel `src/features/rankings/components/index.ts`. Usa: `useMyRanking` + `useParticipantProfile` (`@/features/rankings`), `useAuth` (`@/hooks/useAuth`), `EvolutionLineChart` (`@/features/rankings` charts), Shadcn `badge`/`button`, Lucide (`Trophy`, `Target`, `XCircle`, `Percent`, `Award`, `TrendingUp`/`LineChart`), `next/link`, estados TASK-07, helper de derivação (opcional, em `src/features/rankings/lib/` se extraído).

## 6. Business rules and behavior

### 6.1 Decisão sensível — Pontos vs Acertos sob pontuação binária
- **Binário (D1 do PRD): `points === acertos exatos`.** Logo, na fonte de dados, **Pontos e Acertos são o MESMO número** (`entry.points` === `statistics.totalCorrect`). A imagem do mock mostra `Pontos 87` e `Acertos 12` como números diferentes **porque o mock assumia 3/1/0** (descartado). Sob binário esses dois cards exibiriam o número idêntico.
- **Decisão para esta tela:** manter os **dois rótulos** ("Pontos" e "Acertos") por fidelidade ao layout do mock e clareza para o usuário, **exibindo o mesmo valor** (`entry.points`). Acrescentar microcopy/tooltip explicando a equivalência ("No bolão, cada placar exato vale 1 ponto — pontos e acertos são o mesmo número") para não parecer bug. **Alternativa** (decidir no `/screen`): substituir o card "Acertos" por outra métrica útil (ex.: "Maior Sequência" via `statistics.longestStreak`) e deixar só "Pontos". **Default: dois cards com mesmo valor + microcopy.** `/screen` é a autoridade final sobre o layout do grid.
- Garantir que, se algum dia divergirem (dados legados), a tela use `entry.points` para "Pontos" e `statistics.totalCorrect` para "Acertos" sem quebrar (não somar/cruzar).

### 6.2 Mapeamento de dados (fontes prontas)
| Campo da tela | Fonte | Observação |
|---|---|---|
| Posição "#N" | `useMyRanking().data.entry.position` | header verde |
| "de M participantes" | `useMyRanking().data.total` | total no ranking geral |
| Badge "Você" | sempre (é o próprio usuário) | textual, não só cor |
| Pontos | `entry.points` | binário |
| Acertos | `entry.points` (= `statistics.totalCorrect`) | mesmo valor; ver §6.1 |
| Erros | `statistics.totalWrong` | `totalWrong` é **opcional** → fallback "—" ou 0 (decidir no /screen; default "—" quando undefined) |
| Aproveitamento | `entry.accuracy` (fallback `statistics.accuracy`) | "%"; `entry.accuracy` opcional → usar `statistics.accuracy` |
| "X de Y jogos" | X = `statistics.totalCorrect`; Y = `totalCorrect + (totalWrong ?? 0)` | denominador = palpites de partidas finalizadas (acertos+erros) — ver OQ1 |
| Gráfico "Desempenho Geral" | `statistics.positionHistory` filtrado por `scope === "geral"` → `{label: round?→"R{n}"/data, position}` | passar a `EvolutionLineChart` |
| Melhor Posição "#N (Rodada N)" | min(`position`) em `positionHistory` (scope geral) + seu `round` | derivação client; ver OQ2 |
| Média de Pontos "por rodada" | `entry.points / nº de rodadas (geral)` | nº de rodadas = contagem de pontos em `positionHistory` (scope geral); 1 casa decimal; divisor 0 → "—" |

### 6.3 Derivações (documentadas)
- **Mini-gráfico:** mapear `positionHistory` (apenas `scope: "geral"`, ordenado por `at`) para `EvolutionPoint[] = { label, position }`. `label` = `round` formatado como `"R{round}"` quando presente, senão índice sequencial `"R{i+1}"` (compat: `round` é opcional). O `EvolutionLineChart` já inverte o eixo Y (posição menor = melhor = topo) e já trata `data.length === 0` com alternativa textual "Sem histórico ainda".
- **Nota sobre o mock:** os números 15/10/7/5/4 acima dos pontos no mock são **posições** (não pontos) — coerente com o `EvolutionLineChart` que plota `position`. A linha desce numericamente mas representa **melhora** (subir no ranking); o eixo invertido do gráfico já comunica isso visualmente.
- **Melhor Posição:** `min(positionHistory[scope=geral].position)`; o "Rodada N" é o `round` (ou índice) do snapshot dessa posição mínima. Se houver empate, usar a ocorrência mais recente.
- **Média de Pontos por rodada:** `entry.points / rounds`, onde `rounds = positionHistory[scope=geral].length`. Formatar com `Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 })` (ex.: `17,4`). Se `rounds === 0`, exibir "—".

### 6.4 Estados e habilitação
- Ambas as queries dependem do uid logado (`enabled: Boolean(uid)`). Loading enquanto qualquer uma `isLoading`. Error se qualquer uma `isError` → `RankingErrorState` com `onRetry` que dispara `refetch` das duas.
- **Empty:** `useMyRanking` retorna `null` quando o usuário ainda não está no ranking (recalc não rodou / sem palpites pontuados) → `RankingEmptyState` ("Você ainda não está no ranking", subtítulo orientativo). Idem se `participantProfile` for `null`.
- **Empty parcial do gráfico:** `positionHistory` vazio → `EvolutionLineChart` já mostra "Sem histórico ainda"; cards "Melhor Posição"/"Média" exibem "—" (R6 do PLAN: sem histórico retroativo).

## 7. Contracts and interfaces

```tsx
// MyRanking.tsx — sem props (consome hooks + auth)
export function MyRanking(): JSX.Element;

// Subcomponentes internos (não precisam ser exportados):
// MyRankingHeader({ position: number; total: number })
// StatCard({ label: string; value: string; hint?: string; icon: LucideIcon })
```
Consome:
- `useMyRanking()` → `UseQueryResult<UserRankingResult | null>` onde `UserRankingResult = { entry: RankingEntry; total: number }`.
- `useParticipantProfile(uid)` → `UseQueryResult<Statistics | null>` (`Statistics` = `{ uid, totalCorrect, totalWrong?, accuracy, longestStreak, correctByStage, positionHistory[] }`).
- `RankingEntry` (TASK-01): `{ uid, nickname, name?, position, points, wrong?, accuracy? }`.
- `PositionHistoryEntry`: `{ at, scope, position, round? }`.
- `EvolutionLineChart({ data: { label, position }[], className? })` (TASK-06).

## 8. Data and persistence impact

Nenhum. Leitura via hooks (Client SDK, somente leitura). Sem escrita. Derivações (melhor posição, média por rodada, mapeamento do gráfico) são puramente client-side a partir dos dados já carregados.

## 9. Required tests

Recommended TDD: **no**. Testes leves (recomendados, não bloqueantes):
- Helper puro de derivação (se extraído para `lib/`): `min position` + `round`, `média = points/rounds`, mapeamento `positionHistory → EvolutionPoint[]` (filtra scope geral, ordena por `at`, rotula `round`). Determinístico, fácil de testar.
- Componente: render com `QueryClientProvider` mockando os hooks → header mostra `#N de M`; grid mostra valores; gráfico recebe os pontos certos; estado empty quando `useMyRanking` = `null`. Seguir padrão jsdom (`// @vitest-environment jsdom`). Não testar markup do Recharts.

## 10. Acceptance criteria

- [ ] `/rankings/eu` mostra header verde "Sua Posição Atual #N de M participantes" + badge "Você".
- [ ] Grid de métricas: Pontos, Acertos, Erros, Aproveitamento ("X de Y jogos").
- [ ] **Sob binário, Pontos e Acertos exibem o mesmo número, com microcopy explicando** (ou layout alternativo aprovado no /screen) — sem parecer bug.
- [ ] Mini-gráfico "Desempenho Geral" plota a evolução de posição (scope geral); vazio → "Sem histórico ainda".
- [ ] Cards "Melhor Posição #N (Rodada N)" e "Média de Pontos … por rodada" derivados corretamente; "—" quando sem histórico.
- [ ] Estados loading (skeleton), empty ("Você ainda não está no ranking"), error (+ retry) ligados às duas queries.
- [ ] Link contextual para `/rankings/evolucao`.
- [ ] tsc strict, sem `any`, sem hex/inline; Lucide named; suite verde; `/screen` (ai/screen/ranking-task-10.md) consumido.

## 11. UI/Screen requirement

- Requires screen: **yes** — `/screen` antes do `/implement`.
- Platform: web (mobile-first)
- Screens involved: Tela 02 Meu Ranking (`docs/prd-05/PRD05-02-Meu-Ranking.png`)
- Product type: leaderboard/stats dashboard (consumer, mobile-first)
- Recommended style: tema verde escopo (`.ranking-theme`), header de destaque `bg-primary text-primary-foreground`, cards Shadcn brancos, números `text-3xl font-bold tabular-nums`, mini-gráfico com `--chart-1` verde.
- Applicable UX domains: style, typography, chart, layout, ux

### Accessibility requirements
- **Enhanced.** Gráfico com **alternativa textual** (o próprio `EvolutionLineChart` já trata vazio; para populado, fornecer resumo textual/aria — ex.: "Posição: R1 #15, R2 #10 … R5 #4" via `sr-only` ou aria-label no container). Contraste do header verde + texto branco ≥ AA (já validado). Badge "Você" é textual (cor não é único indicador). Números com `tabular-nums`. Foco visível em links/botões; ordem de tab = visual. Alvos ≥44px no link "Ver evolução". `prefers-reduced-motion`: gráfico/transições sem animação supérflua. Suporte a text scaling (sem truncar números grandes). Headings sequenciais (h1 da seção → labels dos cards).

### Interaction requirements
- Tap como interação primária; feedback de press 80–150ms no link de evolução; ≥8px entre alvos; loading via skeleton (>300ms); erro com retry. Sem hover-dependência (tooltip do gráfico tem alternativa textual).

### UI states required
- loading (`RankingSkeleton`), empty (`RankingEmptyState` "Você ainda não está no ranking"), error (`RankingErrorState` + retry), populated (header + grid + gráfico + cards derivados), gráfico vazio ("Sem histórico ainda" + cards derivados "—").

## 12. Constraints

- Sem `any`; TS strict; Tailwind tokens (sem hex/inline); Lucide named; `next/link`.
- Reusar Shadcn `badge`/`button`, estados TASK-07, hooks TASK-05, `EvolutionLineChart` TASK-06. Não refazer cálculo do servidor — derivar só o que falta no client.
- `"use client"` no componente (usa hooks/auth).
- Mobile-first; grid 2×2 no mobile (1 ou 2 colunas conforme largura); não esconder atrás do Bottom Tab Bar (layout já tem `pb-20`).
- Container raiz da seção `/rankings` já recebe `.ranking-theme` (TASK-07) — não reaplicar.

## 13. Open questions (resolver no /screen)

- **OQ1 (Pontos vs Acertos):** manter dois cards com mesmo valor + microcopy (default) **ou** trocar "Acertos" por "Maior Sequência"/outra métrica e deixar só "Pontos"? — **ponto sensível desta tela**, decisão final no `/screen` contra a imagem.
- **OQ2 (denominador do Aproveitamento):** "X de Y jogos" — Y = acertos+erros (palpites finalizados, default disponível no client) vs Y = total de partidas finalizadas elegíveis (A2 do PRD, exige dado extra do recalc). Default: usar o que está em `statistics` (acertos+erros); se o recalc expuser `totalFinished`, preferir. Confirmar no /screen.
- **OQ3 ("Erros" quando `totalWrong` ausente):** exibir "—" (default) vs 0. Doc legado pode não ter `totalWrong`.
- **OQ4 (Melhor Posição / Média):** derivar no client (default, dados já carregados) vs exigir campo dedicado do recalc (TASK-03). Default client; se virar custoso/instável, promover para o recalc.
