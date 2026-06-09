# SPEC

## 1. Task: TASK-06 – Infra de gráficos (shadcn Chart / Recharts)

## 2. Objective

Primitivos de gráfico reutilizáveis pelas telas 02/04/06: gráfico de linha (evolução) via shadcn Chart (Recharts) e barras de distribuição em Tailwind puro. Tema verde via CSS vars existentes (`--chart-1..5`, `--primary`).

## 3. In scope

1. Instalar `recharts` (dependency), versão compatível com React 19.2.7.
2. Adicionar `src/components/ui/chart.tsx` (componente shadcn: `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`/`ChartLegendContent` se aplicável, tipo `ChartConfig`) — padrão shadcn, usando `cn` de `@/lib/utils`.
3. `src/features/rankings/components/charts/EvolutionLineChart.tsx` — wrapper fino de linha (posição por rodada).
4. `src/features/rankings/components/charts/DistributionBars.tsx` — barras horizontais por faixa (Tailwind puro, sem Recharts).
5. Barrel `src/features/rankings/components/charts/index.ts`.

## 4. Out of scope

- Telas que consomem os gráficos (TASK-10/11/13) — só os primitivos aqui.
- Lógica de distribuição/evolução (TASK-02 já fornece `buildDistribution`/`evolutionIndicator`).

## 5. Main technical areas

`package.json`, `src/components/ui/chart.tsx`, `src/features/rankings/components/charts/*`. Usa `recharts`, `cn` (`@/lib/utils`), tipos `@/types` (`DistributionBucket`), CSS vars de `globals.css`.

## 6. Business rules and behavior

### 6.1 EvolutionLineChart
- Props: `data: Array<{ label: string; position: number }>` (label = "R1".."RN"; position 1-indexed). Opcional `className`.
- Eixo Y **invertido** (`reversed`) — posição menor (melhor) no topo, refletindo a imagem da Tela 04 (linha sobe quando melhora). Eixo X = `label`.
- Linha na cor `--chart-1`/`--primary` (tema verde via `ChartConfig`). Pontos com rótulo de posição (`#N`) quando couber.
- Tooltip com posição exata. `ChartContainer` provê responsividade (`ResponsiveContainer`).
- Estado vazio (`data.length === 0`) → render de fallback textual ("Sem histórico ainda") em vez do gráfico (alternativa textual = acessibilidade).

### 6.2 DistributionBars
- Props: `buckets: DistributionBucket[]` (de TASK-01). Opcional `className`.
- Cada linha: `label` (ex.: "90-100 pts") + barra horizontal proporcional ao `count` relativo ao maior `count` + valor `count` à direita.
- Tailwind puro (div com `width` percentual via style inline? NÃO — CLAUDE.md proíbe estilo inline). Largura proporcional via classes utilitárias dinâmicas NÃO é viável com %; usar `<div>` com `style={{ width }}` é proibido. **Solução:** usar grid/flex com a barra dimensionada por `style` é vedado → usar a abordagem de largura via CSS custom property aplicada por `className` + `[width:var(--bar)]`? Decisão: usar `style` apenas para a CSS variable `--bar-pct` é tecnicamente inline. Para respeitar CLAUDE.md, a barra usa `data-*` + classes não resolve %. **Resolução pragmática:** largura proporcional é dado dinâmico legítimo; aplicar via `style={{ ["--bar" as string]: \`${pct}%\` }}` numa CSS var consumida por classe Tailwind `w-[var(--bar)]`. Isso mantém a estilização (cor/altura/round) no Tailwind e usa `style` só para passar o valor de dado dinâmico (largura), padrão aceito em data-viz. Documentar como exceção justificada à regra de "sem estilos inline" (valor data-driven, não decisão de estilo).
- Cor da barra: `--primary` (verde). Faixa com `count` 0 → barra vazia + "0".
- Acessível: cada linha é texto legível (label + count) independentemente da barra (cor não é o único indicador).

## 7. Contracts and interfaces

```ts
// EvolutionLineChart.tsx
export interface EvolutionPoint { label: string; position: number; }
export interface EvolutionLineChartProps { data: EvolutionPoint[]; className?: string; }
export function EvolutionLineChart(props: EvolutionLineChartProps): JSX.Element;

// DistributionBars.tsx
import type { DistributionBucket } from "@/types";
export interface DistributionBarsProps { buckets: DistributionBucket[]; className?: string; }
export function DistributionBars(props: DistributionBarsProps): JSX.Element;

// ui/chart.tsx — API shadcn padrão (ChartContainer, ChartConfig, ChartTooltip, ChartTooltipContent)
```

## 8. Data and persistence impact

Nenhum. Componentes de apresentação puros (sem fetch). `package.json` ganha `recharts`.

## 9. Required tests

Recommended TDD: **no**. Testes leves opcionais: render de `DistributionBars` com buckets → mostra labels+counts; `EvolutionLineChart` com `data:[]` → render do fallback. Não obrigatórios; cobertura real vem nas telas. Evitar testes de snapshot frágeis de SVG do Recharts.

## 10. Acceptance criteria

- [ ] `recharts` instalado (compatível React 19); `src/components/ui/chart.tsx` adicionado (padrão shadcn).
- [ ] `EvolutionLineChart` e `DistributionBars` criados, tipados, com props claras; barrel exporta ambos.
- [ ] Tema verde via CSS vars (sem hex hardcoded em componente).
- [ ] `EvolutionLineChart` Y invertido + estado vazio textual; `DistributionBars` Tailwind (largura data-driven via CSS var documentada).
- [ ] tsc strict, sem `any`; suite verde; `next build`/lint sem erros novos.

## 11. UI/Screen requirement

- Requires screen: **no** (primitivos reutilizáveis; estilização final aplicada nas telas consumidoras 02/04/06, que rodam `/screen`)
- Platform: web · Screens: none (componentes de suporte)
- Product type: n/a · Recommended style: tema verde/card do app · UX domains: chart (referência)

(Não é uma tela; é infraestrutura visual. As telas que os usam passam por `/screen`.)

## 12. Constraints

- Sem `any`; TypeScript strict; `"use client"` nos componentes (Recharts é client-side).
- Tema via CSS vars/Tailwind — sem hex hardcoded. Exceção documentada: largura data-driven de barra via CSS var em `style` (valor de dado, não decisão de estilo).
- Ícones Lucide; sem emojis.
- Reusar `cn` (`@/lib/utils`) e padrão shadcn dos componentes existentes (`button.tsx` etc.).
- `DistributionBucket` de TASK-01 (não redefinir).

## 13. Open questions

- **OQ1 (resolvido):** Recharts via shadcn Chart confirmado pelo usuário. Versão: usar a estável compatível com React 19 (verificar no install; recharts ≥2.15 declara suporte a React 19). Se a `chart.tsx` do shadcn exigir API recharts 3, alinhar versão no install.
- **OQ2 (resolvido):** Distribuição em Tailwind puro (sem Recharts) — largura proporcional via CSS var em `style` (exceção data-driven justificada à regra de estilo inline).
