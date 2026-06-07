# SCREEN SPEC — Tela Ranking dos Melhores Terceiros
## Task: TASK-12 (palpites-massa) — PRD03-06
## Platform: web (mobile-first → desktop)

> Spec: `ai/spec/palpites-massa-task-12.md` · Design contract: `design-system/MASTER.md` (§2.4-palpites)
> Wireframe: `docs/prd-03-1/PRD03-06-Melhores-Terceiros.png`
> Ferramenta: scripts Python do `ui-ux-pro-max` indisponíveis neste ambiente — direção derivada do MASTER + wireframe PNG.

## Visual Analysis (do wireframe PRD03-06)

- **Layout:** header verde "Melhores Terceiros" com voltar; título/subtítulo "Confira os 8 melhores terceiros que avançam para os 16 avos"; **tabela** com colunas Pos | Seleção (bandeira + nome) | Pts | (Saldo/GP recortados na imagem); 8 linhas ranqueadas 1–8; uma linha de status verde com ✓ "Classificados para os 16 avos"; CTA verde cheio "Gerar 16 Avos" no rodapé; BottomNav abaixo.
- **Componentes:** tabela ranqueada, badge de posição, bandeira+nome por linha, faixa de status (ícone+texto), Button primário verde.
- **Style signals:** verde no header e CTA; tabela clara com zebra/linhas sutis; números tabulares; primeiras posições levemente destacadas.

**Assumptions:** o verde do shell/CTA é o `.palpites-theme` (mesmo verde da identidade, já em `globals.css`). Cards/tabela permanecem em superfície clara neutra. Colunas completas adotadas: Pos, Seleção, Grupo, Pts, SG, GP (SG/GP úteis para entender o desempate FIFA; "Grupo" ajuda a localizar a seleção entre os 12 grupos).

---

## 1. User and Business Goals

Penúltima etapa antes da chave: o usuário confere quais 8 terceiros (dos 12 grupos) avançam, segundo o critério FIFA já implementado em `rankBestThirds` (TASK-02). É uma **conferência visual não pontuada** (A2). O objetivo de UX é: ranking escaneável (1→8, melhor no topo), clareza dos critérios (Pts/SG/GP visíveis) e um CTA inequívoco que só libera quando todos os grupos estão prontos (A6).

## 2. Design System Reference

- Master: `design-system/MASTER.md` (baseline canônico).
- Tema de área: `.palpites-theme` (MASTER §2.4-palpites — já em `globals.css`). Componente neutro-por-token herda o verde dentro do escopo.
- Reuso de padrões já estabelecidos pela feature: tabela acessível e badge de posição como em `PredictedStandings` (TASK-10); estados loading/error/empty como em `GroupSelectionGrid` (TASK-08).

## 3. User Flow

Entrada: vinda do Resumo dos 12 grupos (TASK-11) ou direto do Hub. Saída: CTA "Gerar 16 Avos" → `/predictions/chave/dezesseis-avos` (TASK-13/14). Edge: grupos incompletos → CTA desabilitado com contagem; sem palpites → estado vazio.

## 4. Information Architecture

- **Ranking (primário):** lista ordenada 1→8 de seleções (posição, bandeira+nome, grupo, Pts/SG/GP).
- **Status de classificação (secundário):** faixa "Classificados para os 16 avos" (ícone+texto).
- **CTA (ação):** "Gerar 16 Avos" — habilitado só com 12 grupos completos.
- **Apoio:** contagem "X de Y grupos completos" quando bloqueado.

## 5. Layout and Components

### BestThirdsRanking (componente apresentacional)
- Cabeçalho de seção: `h1 text-2xl font-semibold` "Melhores Terceiros" + `p text-sm text-muted-foreground` com a explicação.
- **Tabela** `w-full border-collapse text-sm`:
  - `caption sr-only` "Ranking dos 8 melhores terceiros colocados".
  - `thead`: Pos | Seleção | Grupo | Pts | SG (`abbr`) | GP (`abbr`), todos `th scope="col"`.
  - `tbody`: uma linha por terceiro, na ordem do ranking. Badge de posição circular (`inline-flex h-6 w-6 rounded-full`), top-8 com `bg-win-bg text-win`; bandeira `h-4 w-6 rounded-sm` + nome `truncate`; Grupo como chip `text-xs text-muted-foreground` ("A"); números `tabular-nums`; SG com sinal.
- **Faixa de status:** `div` com `CheckCircle2 text-win` + "Os 8 melhores terceiros avançam para os 16 avos."
- **CTA:**
  - Habilitado (`allGroupsComplete`): `<Link href={bracketHref}>` estilizado via `buttonVariants({ variant: "default", size: "lg" })`, `min-h-[44px] w-full md:w-auto`, ícone `Trophy`, "Gerar 16 Avos", `aria-label`.
  - Desabilitado: `<button disabled aria-disabled="true">` mesmo estilo, ícone `Lock`, "Gerar 16 Avos"; abaixo `p text-xs text-muted-foreground` "Complete os 12 grupos para gerar a chave — X de Y".

### Estados
- **loading:** `role="status"` + `sr-only` "Carregando ranking" + skeleton de linhas (`h-10 bg-muted rounded-md animate-pulse motion-reduce:animate-none`).
- **error:** `role="alert"` + texto destrutivo + botão "Tentar novamente" (`outline`, `min-h-[44px]`).
- **empty:** `thirds.length === 0` → `p text-center text-sm text-muted-foreground` "Preencha os jogos dos grupos para ver o ranking dos melhores terceiros." (sem tabela).

### Layout responsivo
- Container da rota: `mx-auto flex max-w-2xl flex-col gap-6 pb-20 md:pb-4` + `.palpites-theme` (espelha as demais telas da feature).
- Tabela rola horizontalmente só se necessário (mobile estreito); colunas numéricas compactas via `tabular-nums` e padding reduzido.

## 6. Typography and Color Tokens

- Título: `text-2xl font-semibold text-foreground`. Subtítulo/auxiliar: `text-sm`/`text-xs text-muted-foreground`.
- Pts em destaque: `font-semibold tabular-nums text-foreground`.
- Badge top-8: `bg-win-bg text-win` (semântica de "classificado/acerto" — coerente com `PredictedStandings`). Verde de shell/CTA via `.palpites-theme` (`bg-primary`/`text-primary`).
- Todos ≥ AA (tokens neutros do MASTER + verde escopado validado em auth).

## 7. UI States

| Estado | Render |
|---|---|
| loading | skeleton (role=status) |
| error | alerta + retry |
| empty (0 terceiros) | mensagem orientando preencher grupos |
| parcial (1..7 terceiros, grupos incompletos) | tabela com os existentes + CTA desabilitado + contagem |
| completo (8 terceiros, 12 grupos completos) | tabela 1–8 + CTA habilitado |

## 8. Accessibility Requirements

- Tabela com `caption` sr-only, `th scope="col"`; badge de posição com `aria-label` ("1º melhor terceiro").
- Bandeira `alt="" aria-hidden`; nome textual ao lado.
- CTA desabilitado: `disabled` + `aria-disabled` + texto explicativo (cor não-exclusiva: ícone Lock + texto).
- Toque ≥ 44px no CTA e no retry. Focus ring herdado (`ring-ring`, verde no escopo).
- `motion-reduce:animate-none` no skeleton.

## 9. Animation and Motion

- Apenas `animate-pulse` no skeleton (com `motion-reduce`). Sem animação de layout. Hover do CTA: transição de cor herdada do `buttonVariants`.

## 10. Navigation Patterns

- CTA usa `next/link` (`href={bracketHref}`) somente quando habilitado; desabilitado não navega.
- BottomNav/SideNav inalterados (responsabilidade do AppShell).

## 11. Pre-Delivery Checklist

- Ícones Lucide named (`CheckCircle2`, `Lock`, `Trophy`) — OK.
- Tokens semânticos, zero hex, zero `style` — OK.
- Touch ≥ 44px, gap ≥ 8px — OK.
- Light/dark via tokens; `text-win`/`bg-win-bg` têm variante dark — OK.
- A11y (tabela scope, caption, cor não-exclusiva, reduced motion) — OK.

## 12. Design Gaps and Assumptions

- Colunas SG/GP recortadas no PNG — adotadas por consistência com `PredictedStandings` e por explicarem o desempate FIFA.
- Coluna "Grupo" adicionada (não explícita no PNG) para localizar a seleção entre os 12 grupos — `text-xs text-muted-foreground`, baixo peso visual.
- CTA "Gerar 16 Avos" linka para `/predictions/chave/dezesseis-avos` (tela ainda não implementada — TASK-13/14). Navegação válida assim que a rota existir; até lá o link aponta para a rota planejada.
