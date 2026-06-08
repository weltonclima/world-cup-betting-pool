# SPEC

## 1. Task: TASK-13 – Tela 06: Estatísticas Gerais

## 2. Objective

Exibir a **visão agregada do bolão** (Tela 06): header verde "Visão Geral do Bolão — N Participantes", grid de cards de métricas (Maior Pontuação + nome do líder, Menor Pontuação, Média Geral, Total de Acertos) e seção "Distribuição de Pontuação" (barras horizontais por faixa). Tudo derivado de um único doc agregado via `usePoolStats()`, sob pontuação binária. Substitui o stub em `/rankings/estatisticas`.

## 3. In scope

1. Componente client `PoolStatsScreen` (`src/features/rankings/components/`) consumindo `usePoolStats()` (TASK-05).
2. Header de destaque verde "Visão Geral do Bolão" + número grande `totalParticipants` + "Participantes".
3. Grid 2×2 de cards de métricas (card-via-classes, padrão do app — não há `Card` Shadcn instalado):
   - **Maior Pontuação** → `highestPoints` + subtítulo `highestPointsName` (fallback "Participante" quando ausente).
   - **Menor Pontuação** → `lowestPoints` + subtítulo "Participante".
   - **Média Geral** → `averagePoints` formatado pt-BR (ex.: `56,4`) + subtítulo "pontos".
   - **Total de Acertos** → `totalCorrect` + subtítulo "placares exatos".
4. Seção "Distribuição de Pontuação" usando `DistributionBars({ buckets: distribution })` (TASK-06, já existe).
5. Estados ligados a `usePoolStats` (loading/empty/error) reusando componentes da TASK-07.
6. Montar em `src/app/(app)/rankings/estatisticas/page.tsx` (substituir stub).

## 4. Out of scope

- Demais telas (TASK-08..12). Sub-nav, header "Ranking" e wrapper `.ranking-theme` (já no `layout.tsx` da seção — TASK-07).
- Schema/serviço/hook de pool stats (prontos: TASK-01/04/05). Backend de agregação (TASK-03).
- Componente `DistributionBars` (pronto: TASK-06) — apenas consumir.
- Recharts (distribuição é Tailwind puro).

## 5. Main technical areas

`src/features/rankings/components/PoolStatsScreen.tsx` (+ subcomponente interno `StatCard` se útil), `src/app/(app)/rankings/estatisticas/page.tsx`, barrel `components/index.ts`. Usa `usePoolStats` (`@/features/rankings`), `DistributionBars` (`@/features/rankings/components/charts`), estados TASK-07 (`RankingSkeleton`/`RankingEmptyState`/`RankingErrorState`), `cn` (`@/lib/utils`), Lucide named (`BarChart3` para o ícone de empty/seção; opcional `TrendingUp`/`TrendingDown` nos cards). Formatação via `Intl.NumberFormat("pt-BR")`.

## 6. Business rules and behavior

- **Binário (pontos === acertos exatos):** "Maior/Menor Pontuação" e "Total de Acertos" são todos contagens de placares exatos; manter os rótulos da imagem (não renomear "pontuação" para "acertos"). Sem "vencedor"/acerto parcial.
- **Mapeamento direto de `PoolStats`** (sem cálculo no componente):
  | Campo na tela | Origem | Formatação |
  |---|---|---|
  | Header "N Participantes" | `totalParticipants` | inteiro pt-BR |
  | Maior Pontuação | `highestPoints` | inteiro |
  | Nome do líder | `highestPointsName` | string; fallback "Participante" se `undefined` |
  | Menor Pontuação | `lowestPoints` | inteiro |
  | Média Geral | `averagePoints` | `Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })` → `56,4` |
  | Total de Acertos | `totalCorrect` | inteiro |
  | Distribuição | `distribution` (`DistributionBucket[]`) | repassado direto a `DistributionBars` |
- **Formatação numérica pt-BR obrigatória** via `Intl.NumberFormat("pt-BR")` (não hardcodar vírgula/string). Números de destaque com `tabular-nums`.
- **Ordem da distribuição:** renderizar `distribution` na ordem recebida do doc (já vem ordenado do recalc, maior faixa primeiro: 90-100 → 0-39, conforme imagem). Não reordenar no componente.
- **Estados (ligados ao hook):**
  - `isLoading` → `RankingSkeleton` (skeleton de cards/barras).
  - `isError` → `RankingErrorState` com `onRetry={refetch}`.
  - **Empty:** `data === null` **ou** `totalParticipants === 0` → `RankingEmptyState` (mensagem "Sem estatísticas ainda", subtítulo "As estatísticas aparecem após o primeiro recálculo."). Decisão fixa: **mostrar EmptyState** quando não há participantes (preferível a um painel de zeros sem sentido). `/screen` confirma cópia.
  - `distribution` vazio (mas há participantes) → ocultar a seção "Distribuição de Pontuação" (ou exibir nota "Sem distribuição disponível"); cards continuam. `/screen` decide.
- **Compat doc antigo:** todos os campos numéricos têm default no schema; `highestPointsName` é `optional` → aplicar fallback. Não quebrar se algum campo vier ausente (o `.parse` no serviço já garante shape).

## 7. Contracts and interfaces

```tsx
// PoolStatsScreen.tsx — sem props (consome hook)
export function PoolStatsScreen(): JSX.Element;
// Subcomponente interno (não exportado):
// StatCard({ label: string; value: string; sublabel: string; })
```
Consome `PoolStats` (TASK-01): `{ updatedAt, totalParticipants, highestPoints, highestPointsName?, lowestPoints, averagePoints, totalCorrect, distribution: DistributionBucket[] }`. Hook `usePoolStats()` → `UseQueryResult<PoolStats | null>` (`{ data, isLoading, isError, refetch }`). `DistributionBars` props: `{ buckets: DistributionBucket[]; className? }`.

## 8. Data and persistence impact

Nenhum (leitura via hook). Sem escrita.

## 9. Required tests

Recommended TDD: **no** (`DistributionBars` já tem cobertura; tela é apresentação). Testes leves recomendados (não bloqueantes):
- Helper de formatação pt-BR (se extraído, ex.: `formatAverage(n)` → `"56,4"`) — teste puro.
- Componente (jsdom, `// @vitest-environment jsdom`, QueryClientProvider mockando o hook): estado populado renderiza os 4 cards com valores corretos + header com `totalParticipants`; estado empty (`totalParticipants: 0`) renderiza `RankingEmptyState`; estado error renderiza retry. Não testar markup frágil das barras.

## 10. Acceptance criteria

- [ ] `/rankings/estatisticas` mostra header verde "Visão Geral do Bolão" + N Participantes.
- [ ] Grid de cards: Maior Pontuação (+nome líder/fallback), Menor Pontuação, Média Geral (pt-BR `56,4`), Total de Acertos.
- [ ] Seção "Distribuição de Pontuação" renderiza `DistributionBars` com `distribution`.
- [ ] Estados loading (skeleton), empty (sem dados / 0 participantes → EmptyState), error (+ retry) ligados ao hook.
- [ ] Média formatada com `Intl.NumberFormat("pt-BR")` (vírgula decimal); números com `tabular-nums`.
- [ ] tsc strict, sem `any`, sem hex/inline (exceto `width` de dado em `DistributionBars`, já isolado no componente existente); Lucide named; suite verde. `/screen` (ai/screen/ranking-task-13.md) consumido.

## 11. UI/Screen requirement

- Requires screen: **yes** — `/screen` antes do `/implement`.
- Platform: web (mobile-first, responsivo até desktop).
- Screens involved: Tela 06 Estatísticas Gerais (`docs/prd-05/PRD05-06-Estatisticas-Gerais.png`).
- Product type: leaderboard & stats dashboard (consumer, mobile-first).
- Recommended style: tema verde escopo (`.ranking-theme`, já no layout); header de destaque `bg-primary text-primary-foreground`; cards claros via classes (`bg-card border border-border rounded-lg`); barras `bg-primary`; números `text-3xl/4xl font-bold tabular-nums`.
- Applicable UX domains: style, color, layout, chart.

### Accessibility requirements
- Distribuição: cada barra é label + barra + count textual legíveis **sem depender da cor** (count sempre visível — já garantido pelo `DistributionBars`). Contraste do header verde + branco ≥ AA (validado em auth/palpites). Headings sequenciais (`h2` seção "Distribuição"). Números com `tabular-nums`. Suporte a text scaling. Foco visível no botão "Tentar Novamente". Nível: **enhanced**.

### Interaction requirements
- Tela majoritariamente estática (sem inputs). Único alvo interativo: "Tentar Novamente" (error) ≥44px. Loading skeleton >300ms; reduced-motion respeitado (herdado dos componentes de estado).

### UI states required
- loading (`RankingSkeleton`), empty (`RankingEmptyState` — sem dados / 0 participantes), error (`RankingErrorState` + retry), populated (header + grid + distribuição), distribuição vazia (seção oculta/nota — `/screen` decide).

## 12. Constraints

- Sem `any`; TS strict; Tailwind tokens (sem hex/inline; exceção `width` de dado isolada em `DistributionBars` pronto). Lucide named.
- `"use client"` no `PoolStatsScreen` (usa hook React Query).
- Não duplicar wrapper `.ranking-theme`, header "Ranking" nem `RankingSubNav` (já no `layout.tsx` da seção).
- Reusar `DistributionBars` (TASK-06) e estados (TASK-07) — não recriar primitivas.
- Mobile-first; grid 1 coluna no mobile → 2 colunas a partir de `sm`. Layout já compensa o Bottom Tab Bar (`pb-20` no layout).
- Card via classes (sem `Card` Shadcn — não instalado), consistente com Home/Palpites.

## 13. Open questions (resolver no /screen)

- **OQ1:** Empty quando `totalParticipants === 0` → EmptyState (default fixo) vs painel de zeros. Default fixo: **EmptyState**. Confirmar cópia.
- **OQ2:** `distribution` vazio com participantes presentes → ocultar seção vs nota textual. Default: ocultar seção, manter cards.
- **OQ3:** Exibir `updatedAt` ("Atualizado em …", date-fns/`Intl`) como rodapé sutil? Não está na imagem. Default: **não exibir** (fora do contrato visual); reavaliar se útil.
- **OQ4:** Subtítulo dos cards Maior/Menor — imagem mostra nome ("João Silva") na Maior e "Participante" na Menor. Default: Maior usa `highestPointsName` (fallback "Participante"); Menor usa "Participante" fixo (não há `lowestPointsName` no schema).
