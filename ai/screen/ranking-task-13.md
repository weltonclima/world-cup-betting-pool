# SCREEN SPEC — Estatísticas Gerais (visão agregada do bolão)
## Task: TASK-13
## Platform: web (mobile-first, responsivo)

## Visual Analysis (de docs/prd-05/PRD05-06-Estatisticas-Gerais.png — fonte de verdade)
- Header de tela: barra de status mock (9:41), seta "voltar", título centralizado "Estatísticas Gerais". (No app real, o título "Ranking" + `RankingSubNav` vêm do `layout.tsx` da seção — não reproduzir o chrome do mock.)
- **Card header verde de destaque** (cantos arredondados, ocupa largura total): texto branco centralizado "Visão Geral do Bolão" (label menor) → número grande "28" (display, branco, negrito) → "Participantes" (label menor branco).
- **Grid 2×2 de cards brancos** abaixo do header verde:
  - Linha 1: **Maior Pontuação** `98` (verde, grande) + "João Silva" (auxiliar) · **Menor Pontuação** `12` (verde, grande) + "Participante" (auxiliar).
  - Linha 2: **Média Geral** `56,4` (verde, grande) + "pontos" (auxiliar) · **Total de Acertos** `438` (verde, grande) + "placares exatos" (auxiliar).
  - Cada card: rótulo no topo (cinza, pequeno), número de destaque (verde), sublinha auxiliar (cinza). Borda sutil, fundo branco, raio `lg`.
- **Seção "Distribuição de Pontuação"** (título de seção à esquerda) → lista de barras horizontais:
  - `90 - 100 pts` ▇▇ `3`
  - `80 - 89 pts` ▇▇▇ `5`
  - `70 - 79 pts` ▇▇▇▇ `7`
  - `40 - 59 pts` ▇▇▇▇▇ `9`
  - `0 - 39 pts` ▇▇ `4`
  - Cada linha: label da faixa (cinza, à esquerda) + barra verde (largura proporcional ao count) sobre trilho cinza claro + contagem (à direita). Larguras relativas ao maior count (9). Tons de verde variam levemente na imagem, mas o componente pronto usa `bg-primary` uniforme (aceito — cor não é indicador semântico aqui).
- Bottom Tab Bar fixo (Home/Jogos/Palpites/Ranking ativo/Perfil) — global, já existe no AppShell.
- States visible: apenas populado no mock → loading/empty/error derivados do padrão do app (TASK-07).
- Style signals: verde primário (header de destaque + barras + números de destaque), branco/cinza claro nos cards, números grandes em negrito, tipografia funcional.

## 1. User and Business Goals
Participante vê o **panorama do bolão**: quantos jogam, o teto e o piso de pontuação, a média da comunidade, o total de placares exatos acertados por todos, e como a pontuação se distribui em faixas. Permite situar o próprio desempenho no coletivo. Tela de leitura pura (sem inputs).

## 2. Design System Reference
- Master: `design-system/MASTER.md` (§2.4-ranking — escopo verde `.ranking-theme`; §3 tipografia; §4 espaçamento; §10 acessibilidade).
- Tema: `.ranking-theme` (aplicado no `layout.tsx` da seção, TASK-07) remapeia `--primary`/`--ring`/`--chart-1` p/ verde `oklch(0.46 0.16 150)`. Componentes usam tokens semânticos (`bg-primary`, `text-primary`, `text-primary-foreground`, `bg-card`, `border-border`, `text-muted-foreground`). Sem hex/inline (exceção: `width` de dado já isolada em `DistributionBars`).

## 3. User Flow
- Entrada: Bottom Tab Bar → Ranking → `RankingSubNav` → **Estatísticas** (`/rankings/estatisticas`).
- Conteúdo carrega via `usePoolStats()`: skeleton → populado (ou empty/error).
- Saída: trocar de aba na sub-nav ou no Bottom Tab Bar; back previsível (rota real).
- Edge: sem participantes/dados → empty; falha de fetch → error + "Tentar Novamente".

## 4. Information Architecture
1. (Layout, fora desta task) título "Ranking" + `RankingSubNav` com "Estatísticas" ativo.
2. **Card header verde** "Visão Geral do Bolão — N Participantes".
3. **Grid 2×2** de cards de métrica.
4. **Seção "Distribuição de Pontuação"** (heading `h2` + `DistributionBars`).
Estados (skeleton/empty/error) substituem do item 2 em diante conforme a query.

## 5. Layout and Components

### Container da tela (`PoolStatsScreen`, `"use client"`)
- `flex flex-col gap-4`. Largura herda do layout (`max-w` se aplicável já no AppShell). Padding horizontal vem do layout/AppShell — não duplicar.

### Header verde de destaque
- `rounded-2xl bg-primary text-primary-foreground p-6 text-center`.
- Estrutura vertical: label "Visão Geral do Bolão" (`text-sm font-medium opacity-90`) → número `totalParticipants` (`text-4xl font-bold tabular-nums`) → "Participantes" (`text-sm font-medium opacity-90`).
- Plural simples: sempre "Participantes" (cópia do mock); não pluralizar dinamicamente.

### Grid de cards (2×2)
- Wrapper: `grid grid-cols-1 gap-4 sm:grid-cols-2` (1 coluna mobile → 2 colunas a partir de `sm` 640px). Mantém 2×2 também em desktop (conteúdo enxuto).
- `StatCard` (subcomponente interno) por métrica:
  - `rounded-lg border border-border bg-card p-4 flex flex-col gap-1`.
  - Rótulo: `text-sm font-medium text-muted-foreground` (ex.: "Maior Pontuação").
  - Valor: `text-3xl font-bold text-primary tabular-nums` (ex.: "98", "56,4", "438").
  - Sublinha: `text-xs text-muted-foreground` (ex.: "João Silva", "Participante", "pontos", "placares exatos").
- Conteúdo dos 4 cards (mapeado de `PoolStats`, §6 do spec): Maior Pontuação=`highestPoints`/`highestPointsName`‖"Participante"; Menor Pontuação=`lowestPoints`/"Participante"; Média Geral=`averagePoints` pt-BR/"pontos"; Total de Acertos=`totalCorrect`/"placares exatos".

### Seção Distribuição de Pontuação
- Heading `h2` "Distribuição de Pontuação" (`text-lg font-medium text-foreground`) + `DistributionBars buckets={data.distribution}` (TASK-06, pronto).
- `DistributionBars` já renderiza: label `w-24 text-muted-foreground` + trilho `bg-muted rounded-full h-3` com barra `bg-primary` (largura proporcional ao maior count) + count `text-right font-medium tabular-nums`.
- Se `distribution` vazio: ocultar a seção inteira (default; ver OQ no spec).

### Formatação numérica (pt-BR)
- `Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(averagePoints)` → "56,4". Inteiros via `Intl.NumberFormat("pt-BR").format(n)` (separador de milhar pt-BR quando houver). Sem hardcode de vírgula/string.

### Estados (reuso TASK-07)
- `RankingSkeleton` (loading) — pode receber `rows` para simular cards/barras.
- `RankingEmptyState` (sem dados / `totalParticipants === 0`) — ícone `BarChart3` ou `Trophy`, título "Sem estatísticas ainda", subtítulo "As estatísticas aparecem após o primeiro recálculo."
- `RankingErrorState` (`onRetry={refetch}`) — "Erro ao carregar estatísticas" + "Tentar Novamente".

## 6. Typography and Color Tokens
- Número grande do header: `text-4xl font-bold tabular-nums text-primary-foreground` (branco sobre verde).
- Números dos cards: `text-3xl font-bold text-primary tabular-nums` (verde sobre card claro).
- Rótulos de card: `text-sm font-medium text-muted-foreground`. Sublinhas: `text-xs text-muted-foreground`.
- Heading de seção: `text-lg font-medium text-foreground`.
- Cores: `--primary` (verde escopo — header/barras/números), `--primary-foreground` (branco no header), `--card`/`--border`/`--muted`/`--muted-foreground`/`--foreground`. Sem hex.

## 7. UI States
| Estado | Tratamento |
|---|---|
| Loading | `RankingSkeleton` (>300ms) |
| Empty | `RankingEmptyState` (sem dados ou `totalParticipants === 0`) — "Sem estatísticas ainda" |
| Error | `RankingErrorState` + "Tentar Novamente" (`onRetry`=`refetch`) |
| Populated | header verde + grid 2×2 + distribuição |
| Distribuição vazia | seção de distribuição oculta; cards permanecem |

## 8. Accessibility Requirements (Priority 1) — Enhanced
- Contraste: header verde `--primary` (0.46) + branco ≥ AA (validado em auth/palpites); números verdes `text-primary` sobre card branco ≥ AA.
- **Distribuição legível sem cor:** cada barra tem label da faixa + contagem numérica textual (já no `DistributionBars`); a cor da barra não é o único portador de informação.
- Headings sequenciais: `h2` "Distribuição de Pontuação" abaixo do `h1` "Ranking" (layout). Header verde é conteúdo de destaque (não precisa ser heading; números têm contexto textual "Participantes").
- `tabular-nums` em todos os números para alinhamento e estabilidade em text-scaling.
- Foco visível (`ring-2 ring-ring`) no botão "Tentar Novamente". Suporte a zoom/text scaling (sem alturas fixas que cortem texto).
- Tela sem inputs → sem armadilhas de foco; ordem de leitura = ordem visual (header → cards → distribuição).

## 9. Animation and Motion (Priority 7)
- Skeleton `animate-pulse` com `motion-reduce:animate-none` (herdado de `RankingSkeleton`).
- Sem animação de entrada das barras (data-viz estática). Transições só de cor/foco onde aplicável (`transition-colors duration-150`).

## 10. Layout / Responsive (Priority — layout)
- Mobile (base): header full-width; cards em **1 coluna** empilhados; distribuição full-width.
- `sm` (≥640px) e acima: cards em **2 colunas** (grid 2×2). Header e distribuição permanecem full-width.
- Sem layout desktop especial além do `max-w` do AppShell. Não esconder atrás do Bottom Tab Bar (`pb-20` já no layout da seção).

## 11. Pre-Delivery Checklist Status
- Ícones Lucide named (sem emoji) ✓ · tokens semânticos / sem hex ✓ (exceção `width` de dado isolada em `DistributionBars`) · `tabular-nums` nos números ✓ · estados loading/empty/error definidos ✓ · reduced-motion ✓ · contraste header verde ≥ AA ✓ · formatação pt-BR via `Intl` ✓ · mobile-first (1→2 colunas) ✓ · reuso `DistributionBars`/estados ✓.

## 12. Design Gaps and Assumptions
- **G1:** Empty quando `totalParticipants === 0` → `RankingEmptyState` (decisão fixa do spec) em vez de painel de zeros. Cópia "Sem estatísticas ainda".
- **G2:** Card "Menor Pontuação" usa sublinha "Participante" fixa (schema não tem `lowestPointsName`); "Maior Pontuação" usa `highestPointsName` com fallback "Participante".
- **G3:** Tons de verde diferentes por barra no mock → simplificado para `bg-primary` uniforme (componente pronto; cor não é semântica). Diferença visual aceita.
- **G4:** `updatedAt` não exibido (fora do contrato visual da imagem) — reavaliar se produto pedir "Atualizado em…".
- **G5:** Grid mantém 2 colunas no desktop (não expande para 4) — conteúdo enxuto, fiel ao mock; reavaliar se ganhar mais métricas.
