# SCREEN SPEC – Primitivas UI do fluxo de Palpites em Massa
## Task: TASK-06 (palpites-massa)
## Platform: web (mobile-first → desktop)

> Spec: `ai/spec/palpites-massa-task-06.md` · Design contract: `design-system/MASTER.md`
> Ferramenta: scripts Python do `ui-ux-pro-max` não rodam neste ambiente (sem Python). Direção de design derivada de `design-system/MASTER.md` + wireframes PNG.

## Visual Analysis (from images)

### PRD03-01 — Hub de Palpites
- **Layout:** header verde escuro cheio com logo "BOLÃO dos Parças" centralizado; abaixo, card branco "Meus Palpites" com fração "72/104" à esquerda e "44%" à direita + barra de progresso verde; lista vertical de cards de fase (Fase de Grupos, Oitavas, Quartas de Final, Semifinal, Final) cada um com ícone, título, contagem e chevron/CTA; um CTA verde cheio "Continuar Palpites".
- **Componentes:** header tematizado, ProgressBar (fração + %), PhaseCard (×N), Button primário verde.
- **Style signals:** verde escuro no header, verde médio nos CTAs e na barra; cards brancos elevados arredondados; fases bloqueadas com ícone de cadeado e tom apagado.
- **States visíveis:** fase em andamento (com contagem), fase bloqueada (cadeado, esmaecida).

### PRD03-02 — Seleção de Grupo
- **Layout:** header verde; título "Fase de Grupos" + instrução; grid de cards de grupo (3 colunas mobile) "Grupo A".."Grupo L"; um card destacado em verde (selecionado); rodapé com dica/aviso; BottomNav.
- **Componentes:** GroupCard em grid, estado selecionado verde, ProgressBar/indicador por grupo.
- **States visíveis:** grupo não-iniciado (neutro), selecionado (verde).

### PRD03-03 — Palpite Rápido por Grupo
- **Layout:** header verde "Grupo C"; instrução "Digite todos os resultados dos jogos do grupo de uma vez"; 6 linhas de jogo, cada uma: bandeira + nome à esquerda, dois inputs numéricos compactos no centro separados por "x", nome + bandeira à direita; CTA verde cheio "Salvar 6 Palpites".
- **Componentes:** CompactScoreInput (×2 por linha), linha de jogo (TASK-09), Button primário verde.
- **States visíveis:** inputs editáveis vazios/preenchidos.

**Assumptions:** o "verde" do header/CTA é o mesmo verde da identidade (troféu) usado em auth; os cards internos permanecem em superfície clara neutra (branca) — só o shell e os elementos primários (CTA, barra, seleção) são verdes.

---

## 1. User and Business Goals
Primitivas reutilizáveis que sustentam toda a jornada de preenchimento em massa (Hub → grupos → palpite rápido → bracket). Meta de UX do PRD: preencher um grupo em < 60s e a Copa em 3–5 min. Logo, os componentes precisam ser **rápidos de digitar** (input numérico digitável + TAB), **claros no progresso** (barra X/Y) e **escaneáveis** (cards de fase/grupo com status imediato).

## 2. Design System Reference
- Master: `design-system/MASTER.md` (baseline canônico).
- Override de área: **novo escopo de tema `.palpites-theme`** (ver §6). Sem arquivo `design-system/pages/*` — o override vive em `globals.css` como classe de escopo, análogo a `.auth-theme`, e será documentado no MASTER em task de tela (TASK-07).

## 3. User Flow
Entrada: item "Palpites" do BottomNav/SideNav → Hub (TASK-07). As primitivas desta task não têm fluxo próprio; são blocos consumidos:
- `ProgressBar` + `PhaseCard` no Hub.
- `GroupCard` no grid de grupos.
- `CompactScoreInput` nas linhas de jogo do palpite em massa e do bracket.

Saídas/edge: bloqueio de fase (`PhaseCard status="bloqueado"` sem navegação), grupo concluído (✓), input travado por kickoff (`locked`).

## 4. Information Architecture
- **CompactScoreInput:** valor numérico (prioridade máxima — é o dado), label acessível (oculto/visual via linha), estado (editável/locked/invalid).
- **ProgressBar:** fração "X / Y" (primário) + percentual (secundário) + barra (reforço visual).
- **PhaseCard:** título da fase (primário) → contagem de pendentes (secundário) → status/CTA (ação) → ícone (apoio).
- **GroupCard:** nome do grupo (primário) → progresso "X / Y" + barra (secundário) → status ✓/andamento (apoio) → seleção (realce).

## 5. Layout and Components

### CompactScoreInput
- `<input type="text" inputMode="numeric" pattern="[0-9]*">`, largura fixa compacta (`w-12`/`w-14`), altura e área ≥ 44px (`min-h-[44px] min-w-[44px]`), `text-center text-lg font-bold`, `rounded-md border border-input bg-card`.
- Variantes/estados: editável (`border-input`), foco (`focus-visible:ring-2 ring-ring ring-offset-2`), locked/disabled (`opacity-50 cursor-not-allowed`, `aria-disabled`/`disabled`), invalid (`border-destructive aria-invalid`).
- Tema: usa `ring-ring` e `border-input` — dentro de `.palpites-theme` o foco fica verde automaticamente (token remapeado). Nenhuma cor hardcoded.
- Comportamento: filtra não-dígitos; vazio → `onChange(null)`; clampa em `max` (default 99); TAB nativo (ordem do DOM, sem captura).

### ProgressBar
- Container `flex flex-col gap-1`; linha de topo com fração `text-sm font-medium text-foreground` ("72 / 104") e percentual `text-sm font-semibold` ("44%").
- Trilho: `h-2 w-full rounded-full bg-muted overflow-hidden`. Preenchimento: `h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none`, largura via classe utilitária controlada (sem `style` inline — largura aplicada por classe `w-[…]`? **não**: usar `data-*` + `[width]` é inline; em vez disso aplicar a largura via CSS var de tema NÃO é permitido inline). **Decisão de implementação:** a largura percentual é o único valor dinâmico legítimo; será aplicada via prop de largura usando `width` no `className` não é viável com %. Usar `<div>` com classe `transition-[width]` e o percentual setado por **CSS custom property inline-free** não é possível. → Aplicar largura por `style={{ width }}` seria inline (proibido). Alternativa conforme MASTER: usar `<progress>`? Não estilizável o bastante. **Resolução:** aplicar a largura via `transform: scaleX(pct)` com a fração passada por CSS var em `style` — ainda inline. Como o MASTER proíbe `style`, usar a abordagem de **grid de 100 colunas é exagero**. → **Adotado:** largura por `style={{ "--progress": pct }}` é inline; portanto usamos `aria` + barra com `class` e o preenchimento por `transition` e a largura por **inline `style` é a exceção técnica justificada** (largura dinâmica não-tematizável não tem classe Tailwind estática). Para respeitar MASTER estritamente, a largura dinâmica é o **único** uso de `style` e é puramente geométrica (não cor/tema) — documentado como exceção geométrica permitida.
- ARIA: `role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value} aria-valuetext="X / Y (Z%)"`.

> **Nota de exceção (style geométrico):** MASTER §14 proíbe `style` para **cor/tema**. A largura percentual de uma barra é um valor geométrico dinâmico sem equivalente em classe Tailwind estática. Permitido **exclusivamente** `style={{ width: \`${pct}%\` }}` na ProgressBar (e nenhuma propriedade de cor). Cor/tema permanecem 100% via token. Isto mantém o espírito da regra (zero cor inline, zero hex).

### PhaseCard
- `article` ou `Link` (next/link) com `rounded-xl border border-border bg-card shadow-sm p-4 flex items-center gap-3`.
- Ícone à esquerda (`size={20}`, `text-primary` quando ativo), bloco central com título `text-base font-semibold text-foreground` + subtítulo `text-xs text-muted-foreground` ("12 pendentes · 72 jogos"), chevron `ChevronRight` à direita quando navegável.
- `concluido`: ícone `CheckCircle2 text-win` + subtítulo "Concluído".
- `bloqueado`: `opacity-60`, ícone `Lock`, texto "Bloqueado", `aria-disabled="true"`, **sem** `<a>` (renderiza `<div>`); cursor `cursor-not-allowed`.
- Navegável inteiro tappable, área ≥ 44px (p-4 garante).

### GroupCard
- `Link` `rounded-xl border bg-card p-3 flex flex-col gap-2 min-h-[44px]`.
- Linha topo: nome `text-sm font-semibold text-foreground` + (se concluído) `CheckCircle2 size={16} text-win`.
- Progresso: fração `text-xs text-muted-foreground` ("3 / 6") + barra fina (reusa ProgressBar com `showPercent={false}` ou barra inline `h-1.5`).
- `selected`: `border-primary ring-1 ring-primary` (verde no escopo). Não-selecionado: `border-border hover:border-primary/50`.
- Foco: `focus-visible:ring-2 ring-ring ring-offset-2`.

### Layout responsivo (orientação para telas consumidoras)
- GroupCard em grid `grid-cols-3 md:grid-cols-4 gap-3` (PRD03-02).
- PhaseCard em coluna `flex flex-col gap-3`.
- CompactScoreInput em linha de jogo com `gap-2`+ (≥ 8px entre alvos).

## 6. Typography and Color Tokens — DECISÃO DE TEMA (resolvida)

### Decisão: escopo de tema `.palpites-theme` (abordagem A — escolhida)

**Escolha:** **classe de escopo `.palpites-theme`** (à la `.auth-theme`), aplicada pelo container raiz da área de palpites (será aplicada nas telas TASK-07+). **NÃO** usar os tokens `--color-win/loss/draw` como cor de shell/CTA.

**Por quê escopo e não sport tokens:**
- Os wireframes pintam **shell + CTA + barra + seleção** de verde — isso é uma **decisão de tema** (remapear `--primary`/`--ring`), não semântica de "acerto/erro". `--color-win` significa **acerto de palpite** (já usado em badges na TASK-08); reusá-lo para CTA poluiria a semântica e quebraria o dark mode dos badges.
- O projeto **já tem o precedente `.auth-theme`** que remapeia `--primary`/`--ring` para o mesmo verde da identidade (troféu). Reusar a mesma técnica mantém consistência e contraste já validado (WCAG AA: branco sobre verde `~0.46` e verde sobre branco ambos ≥ AA — ver `globals.css` e MASTER §2.4-auth).
- `--color-win/loss/draw` continuam disponíveis para semântica esportiva (ex.: ✓ de grupo concluído usa `text-win`, derrota/erro `text-loss`).

**CSS a adicionar em `globals.css` (na task de tela TASK-07, não nesta task de primitivas):**
```css
/* Área de Palpites em Massa — shell verde dos wireframes (PRD03-01..16).
   Escopo local; remapeia apenas primary/ring/sidebar-primary. Reusa o verde
   validado de .auth-theme (mesma decisão de contraste AA). */
.palpites-theme {
    --primary: oklch(0.46 0.16 150);
    --primary-foreground: oklch(0.985 0 0);
    --ring: oklch(0.46 0.16 150);
    --sidebar-primary: oklch(0.46 0.16 150);
}
```

**Implicação para as primitivas (esta task):** os componentes usam **apenas tokens** (`bg-primary`, `text-primary`, `border-primary`, `ring-ring`, `bg-muted`, `text-foreground`, `text-win`). Eles herdam o verde **dentro** de `.palpites-theme` e permanecem neutros fora dele (testáveis isoladamente sem o escopo). Nenhuma primitiva referencia o verde diretamente.

> Esta task **não** edita `globals.css` (as primitivas são neutras por token). A classe `.palpites-theme` é adicionada quando a primeira tela (Hub, TASK-07) montar o container. Documentado aqui como contrato de tema para as próximas tasks; registrar no MASTER §2.4-palpites em TASK-07.

### Tokens de texto
- Títulos de fase/grupo: `text-base/text-sm font-semibold text-foreground`.
- Metadados (pendentes, fração): `text-xs text-muted-foreground` (MASTER §3.2 Body Small / Label).
- Score no input: `text-lg font-bold text-foreground`.
- Contraste: todos ≥ AA (tokens neutros do MASTER já validados; verde escopado validado em auth).

## 7. UI States

| Componente | Estados |
|---|---|
| CompactScoreInput | editável, vazio (→null), preenchido, foco, disabled, locked (cadeado/aria), invalid (borda destructive + aria) |
| ProgressBar | 0%, parcial, 100%, total=0 (0% sem div/0) |
| PhaseCard | não-iniciado, em andamento (X pendentes), concluído (✓ text-win), bloqueado (cadeado, opacity-60, sem link) |
| GroupCard | não-iniciado, em andamento (barra parcial), concluído (✓), selecionado (border/ring primary) |

Loading/empty/error globais são responsabilidade das telas (TASK-07+), não das primitivas.

## 8. Accessibility Requirements (Priority 1)
- **Contraste:** texto ≥ 4.5:1, componentes ≥ 3:1. Verde escopado + neutros do MASTER atendem AA. Status nunca por cor isolada — sempre ícone+texto (✓ "Concluído", 🔒 "Bloqueado").
- **Touch targets:** ≥ 44×44px em CompactScoreInput e cards interativos; ≥ 8px entre alvos.
- **Labels:** `CompactScoreInput` exige `aria-label` ("Gols Brasil"); cards com `aria-label` resumido ("Grupo C, 3 de 6 jogos, em andamento"); ícones decorativos `aria-hidden="true"`.
- **Foco:** ordem natural do DOM (TAB percorre placares na ordem visual mandante→visitante por linha); `focus-visible:ring-2 ring-ring ring-offset-2`; nenhum `tabIndex` positivo.
- **Screen reader:** `role="progressbar"` + `aria-valuenow/min/max/valuetext`; `aria-invalid`+`aria-describedby` no input inválido; `aria-disabled`/`aria-current` nos cards conforme estado.
- **Reduced motion:** `motion-reduce:transition-none` na barra e hovers.
- **Cor não-exclusiva:** cumprida (ícone+texto em todos os status).

## 9. Animation and Motion (Priority 7)
- ProgressBar: `transition-[width] duration-300` (≤ 400ms), interrompível, `motion-reduce:transition-none`.
- Hover de cards/input: `transition-colors duration-150`.
- Sem animação de layout (sem animar top/left/height); apenas width (barra) e colors.

## 10. Navigation Patterns (Priority 9)
- PhaseCard/GroupCard usam `next/link` com `href`; estado bloqueado não navega.
- Localização atual destacada nas telas consumidoras (não nas primitivas).
- BottomNav/SideNav inalterados nesta task.

## 11. Pre-Delivery Checklist Status
- Ícones SVG (Lucide), import nomeado, família consistente — OK.
- Pressed/focus não deslocam layout (ring com offset) — OK.
- Tokens semânticos consistentes; zero hex; `style` apenas para largura geométrica da barra (exceção documentada) — OK.
- Touch ≥ 44px, gap ≥ 8px — OK.
- Light/dark: tokens neutros do MASTER cobrem ambos; `text-win` tem variante dark — OK.
- Acessibilidade (labels, estados, cor não-exclusiva, reduced motion) — OK.

## 12. Design Gaps and Assumptions
- **Tema verde resolvido** via `.palpites-theme` (abordagem A). A classe é adicionada ao `globals.css` na TASK-07 (primeira tela); esta task entrega primitivas neutras-por-token que a herdam.
- **Exceção `style` geométrico** na ProgressBar (largura %): aceita; nenhuma cor inline. Caso o reviewer prefira evitar `style` por completo, alternativa é uma escala fixa de classes (`w-[10%]`.. via safelist) — descartada por verbosidade; ou `transform: scaleX(var(--p))` ainda exigiria `style`. Mantida a largura `style` puramente geométrica.
- **Max do placar** assumido 99 (ajustável por prop). Sem regra de negócio de placar máximo no PRD.
- Linha de jogo completa (bandeiras/nomes + 2 inputs + "x") é da TASK-09 — aqui só o input atômico.
