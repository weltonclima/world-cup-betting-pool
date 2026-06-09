# SPEC

## 1. Task: TASK-06 – Primitivas UI: input de placar compacto + progress bar + cards

> Feature: `palpites-massa` · Plan: `ai/plan/palpites-massa.md` (TASK-06) · PRD: `ai/prd/palpites-massa.md`
> Design contract: `design-system/MASTER.md` · Wireframes: `docs/prd-03-1/PRD03-01..03`
> Gerado: 2026-06-07

## 2. Objective

Entregar quatro componentes base, reutilizáveis e totalmente tipados, consumidos por todas as telas do fluxo de palpites em massa (Hub, grid de grupos, palpite em massa, bracket). São primitivas visuais puras (sem data-fetching, sem React Query, sem Firebase): recebem dados e callbacks por props.

## 3. In scope

- `CompactScoreInput.tsx` — input numérico **digitável** de placar (variante do `ScoreInput` stepper). Navegação por TAB, teclado numérico mobile, validação inline, estados disabled/locked, alvo de toque ≥ 44px, labels acessíveis. É o input central da grade de preenchimento em massa do grupo (PRD03-03) e da chave.
- `ProgressBar.tsx` — barra de progresso percentual com label "X / Y" (ex.: "72 / 104"); acessível (`role="progressbar"`, `aria-valuenow/min/max/valuetext`).
- `PhaseCard.tsx` — card de fase do Hub (PRD03-01): título, contagem de jogos, contagem de pendentes, status, e CTA (Link) ou estado "Bloqueado".
- `GroupCard.tsx` — card de grupo do grid (PRD03-02): nome do grupo, progresso %, status (não-iniciado / andamento / concluído ✓).
- Exportar os quatro componentes e seus tipos públicos em `src/features/predictions/components/index.ts`.
- Testes de componente (render, estados, navegação por teclado do `CompactScoreInput`, ARIA) e `__tests__` correspondentes.

## 4. Out of scope

- Telas/rotas que consomem as primitivas (TASK-07/08/09 etc.).
- Hooks de dados, draft local, batch (`useGroupPredictions`, `useUpsertPredictionsBatch`) — TASK-05.
- Lógica de standings/progresso (`computeProgress`) — TASK-02 (a `ProgressBar` apenas recebe os números prontos).
- Bracket e linhas de jogo (`GroupMatchRow`, `BracketMatchup`) — TASK-09/13.

## 5. Main technical areas

- `src/features/predictions/components/CompactScoreInput.tsx`
- `src/features/predictions/components/ProgressBar.tsx`
- `src/features/predictions/components/PhaseCard.tsx`
- `src/features/predictions/components/GroupCard.tsx`
- `src/features/predictions/components/index.ts` (barrel)
- `src/features/predictions/components/__tests__/CompactScoreInput.test.tsx`
- `src/features/predictions/components/__tests__/ProgressBar.test.tsx`
- `src/features/predictions/components/__tests__/PhaseCard.test.tsx`
- `src/features/predictions/components/__tests__/GroupCard.test.tsx`
- Reuso: `cn` de `@/lib/utils`, `Button` de `@/components/ui/button`, ícones nomeados de `lucide-react`, `next/link`.

## 6. Business rules and behavior

### CompactScoreInput
- Campo `<input type="text" inputMode="numeric">` (não `number`, para controle de filtro e ausência de spinner nativo) com `pattern="[0-9]*"`.
- Aceita apenas dígitos; filtra não-dígitos na entrada. Vazio é estado válido transitório → emite `null` (placar não preenchido).
- Valor mínimo `0`; máximo configurável (default 99 — placar plausível, evita overflow visual). Clampa no `max`.
- `onChange(value: number | null)` — `null` quando o campo está vazio.
- Estados:
  - **default/editável** — borda `border-input`, texto `text-foreground`.
  - **disabled/locked** — `disabled`, `opacity-50`, `cursor-not-allowed`; ícone/aria de bloqueado quando `locked`.
  - **inválido** (`invalid`) — borda `border-destructive`, `aria-invalid="true"`, mensagem associada via `aria-describedby` quando `errorMessage` fornecido.
- Navegação TAB: o input é naturalmente tabável (sem `tabIndex` positivo). A ordem TAB segue a ordem do DOM (a tela orquestradora posiciona mandante→visitante por linha). Nenhuma captura de TAB.
- Alvo de toque: `min-h-[44px] min-w-[44px]` (WCAG 2.5.5).
- Acessibilidade: `aria-label` obrigatório (ex.: "Gols Brasil"); `inputMode="numeric"` abre teclado numérico no mobile.

### ProgressBar
- Props: `value` (preenchidos), `total`, `label?` (sobrescreve o "X / Y" default), `showFraction?` (default true).
- Percentual = `total > 0 ? round(value/total*100) : 0`, clampado em [0,100].
- `role="progressbar"`, `aria-valuemin={0}`, `aria-valuemax={total}`, `aria-valuenow={value}`, `aria-valuetext="X / Y (Z%)"`.
- Label textual "X / Y" e/ou "Z%" visível ao lado/acima da barra (ref. Hub mostra "72/104" + "44%").
- Barra: trilho `bg-muted`, preenchimento `bg-primary` (tema escopado → verde) com `transition-[width] duration-300 motion-reduce:transition-none`.

### PhaseCard
- Props: `title`, `gamesCount`, `pendingCount`, `status` (`bloqueado` | `nao-iniciado` | `andamento` | `concluido`), `href?` (destino do CTA), `icon?` (ícone Lucide opcional).
- Quando `status === "bloqueado"`: card com `opacity` reduzida, ícone `Lock`, texto "Bloqueado", **sem** Link/CTA navegável (`aria-disabled`).
- Quando navegável: o card inteiro é um `next/link` (ou contém CTA `Button`/`Link`) com `aria-label` descritivo (ex.: "Fase de Grupos, 12 pendentes de 72 jogos").
- `concluido`: badge/ícone `CheckCircle2` + classe `text-win`.
- Mostra "X pendentes" quando `pendingCount > 0`; "Concluído" quando `0` e status concluído.

### GroupCard
- Props: `name` (ex.: "Grupo C"), `filledCount`, `totalCount` (default 6), `status` (`nao-iniciado` | `andamento` | `concluido`), `href?`, `selected?`.
- Reusa `ProgressBar` internamente para o progresso do grupo (ou barra inline mínima).
- `concluido` → ícone `CheckCircle2` + `text-win`; `selected` → borda/realce `border-primary ring-1 ring-primary` (ref. wireframe PRD03-02 destaca o grupo selecionado em verde).
- Card inteiro navegável (`next/link`) com `aria-label` ("Grupo C, 3 de 6 jogos, em andamento").
- Touch target ≥ 44px (card já excede; garantir em qualquer botão interno).

## 7. Contracts and interfaces

```ts
// Status compartilhado de progresso (definido no componente, exportado)
export type FillStatus = "nao-iniciado" | "andamento" | "concluido";
export type PhaseStatus = FillStatus | "bloqueado";

export interface CompactScoreInputProps {
  label: string;                  // aria-label obrigatório
  value: number | null;           // null = vazio/não preenchido
  onChange: (value: number | null) => void;
  disabled?: boolean;
  locked?: boolean;               // jogo bloqueado por kickoff
  invalid?: boolean;
  errorMessage?: string;          // associado via aria-describedby
  min?: number;                   // default 0
  max?: number;                   // default 99
  id?: string;
  className?: string;
}

export interface ProgressBarProps {
  value: number;                  // preenchidos
  total: number;
  label?: string;                 // sobrescreve "X / Y"
  showFraction?: boolean;         // default true
  showPercent?: boolean;          // default true
  className?: string;
}

export interface PhaseCardProps {
  title: string;
  gamesCount: number;
  pendingCount: number;
  status: PhaseStatus;
  href?: string;                  // ausente/ignorado quando bloqueado
  icon?: LucideIcon;
  className?: string;
}

export interface GroupCardProps {
  name: string;
  filledCount: number;
  totalCount?: number;            // default 6
  status: FillStatus;
  href?: string;
  selected?: boolean;
  className?: string;
}
```

## 8. Data and persistence impact

Nenhum. Componentes puros de apresentação, sem leitura/escrita de dados.

## 9. Required tests

- **CompactScoreInput**: renderiza com aria-label; aceita dígitos e emite número; filtra não-dígitos; emite `null` quando esvaziado; clampa no `max`; `disabled`/`locked` impedem edição; `invalid` aplica `aria-invalid`; teclado — Tab move foco entre dois inputs em ordem do DOM (`userEvent.tab()`); `inputMode="numeric"` presente.
- **ProgressBar**: calcula percentual; `role="progressbar"` + `aria-valuenow/min/max`; renderiza "X / Y"; `total = 0` → 0% sem divisão por zero; clampa value > total.
- **PhaseCard**: navegável renderiza link com `href` e aria-label; `bloqueado` não renderiza link e mostra "Bloqueado"; `concluido` mostra ✓; pendingCount exibido.
- **GroupCard**: nome + "X / Y"; status concluído mostra ✓; `selected` aplica realce; link com aria-label.

## 10. Acceptance criteria

- Os quatro componentes existem, tipados sem `any`, exportados pelo barrel.
- `CompactScoreInput` é digitável, navegável por TAB, abre teclado numérico no mobile (`inputMode`), valida min/max e expõe estados disabled/locked/invalid acessíveis; alvo ≥ 44px.
- `ProgressBar` expõe ARIA de progressbar e label "X / Y".
- `PhaseCard`/`GroupCard` cobrem todos os estados de status e o estado bloqueado/selecionado.
- Tema verde dos wireframes resolvido (ver §11) e aplicado **somente via tokens Tailwind** (sem inline, sem hex).
- Testes scoped passam; `tsc` e `lint` limpos nos arquivos alterados.

## 11. UI/Screen requirement

- **Requires screen:** yes
- **Platform:** web (mobile-first → desktop)
- **Screens involved:** primitivas para PRD03-01 (Hub), PRD03-02 (Seleção de Grupo), PRD03-03 (Palpite em massa) — não são telas em si, mas seus blocos visuais.
- `/screen` deve ser executado antes de `/implement` (feito nesta task).
- **Product type:** Sports betting pool / bracket challenge (estilo FotMob/ESPN/Google Play Games), mobile-first.
- **Recommended style:** Esportivo limpo e funcional, consistente com `design-system/MASTER.md` (cards elevados `rounded-xl`, baixa distração, densidade média).
- **Applicable UX domains:** style, color, typography, ux, accessibility.

> Nota de ferramenta: scripts Python do `ui-ux-pro-max` não executam neste ambiente Windows (sem Python). Direção de design derivada de `design-system/MASTER.md` + wireframes PNG.

### Accessibility requirements
- Contraste ≥ 4.5:1 (texto) / ≥ 3:1 (componentes UI). Verde escopado (`--primary` ~0.46) sobre branco e branco sobre verde ≥ AA (mesma decisão validada para `.auth-theme`).
- Alvos de toque ≥ 44×44px em inputs e cards interativos.
- `aria-label` em `CompactScoreInput`; `aria-invalid` + `aria-describedby` no estado inválido.
- `role="progressbar"` + `aria-valuenow/min/max/valuetext` na `ProgressBar`.
- `aria-current`/`aria-disabled` conforme estado nos cards; ícones decorativos `aria-hidden`.
- Foco visível `focus-visible:ring-2 ring-ring ring-offset-2`; nenhum `tabIndex` positivo.
- `motion-reduce:transition-none` nas transições.

### Interaction requirements
- Feedback de toque/hover via `transition-colors duration-150`.
- Digitação no `CompactScoreInput` não deve travar (componente controlado leve, sem efeitos pesados).
- Erros inline próximos ao campo; recuperação imediata ao corrigir.
- Espaçamento ≥ 8px entre alvos de toque (`gap-2`+).

### UI states required
- CompactScoreInput: editável, vazio, preenchido, disabled, locked, invalid.
- ProgressBar: 0%, parcial, 100%, total=0 (sem dados).
- PhaseCard: bloqueado, não-iniciado, em andamento, concluído.
- GroupCard: não-iniciado, em andamento, concluído, selecionado.

## 12. Constraints

- Sem `any`; sem `style={{}}`; sem hex literais; tokens Tailwind apenas.
- Ícones Lucide com import nomeado.
- `next/link` para navegação interna.
- `"use client"` em `CompactScoreInput` (estado/eventos). Cards/ProgressBar podem ser server-safe, mas marcar `"use client"` se usarem handlers; preferir puros.
- TypeScript strict, interfaces explícitas.

## 13. Open questions

- **Resolvido em /screen (§ artifact):** tema verde dos wireframes vs. shell neutro do MASTER — escopo `.palpites-theme` (à la `.auth-theme`) ou tokens `--color-win/loss/draw`. **Decisão:** classe de escopo `.palpites-theme` que remapeia `--primary`/`--ring` para o verde (reusa os valores validados de `.auth-theme`), aplicada pelo container do fluxo de palpites; primitivas usam apenas `bg-primary`/`text-primary`/`ring-ring` e herdam o verde dentro do escopo, permanecendo neutras fora dele. Detalhado em `ai/screen/palpites-massa-task-06.md`.
