# SCREEN SPEC — Resumo dos 12 Grupos
## Task: TASK-11 (palpites-massa) · PRD03-05
## Platform: web (mobile-first → desktop)

> Spec: `ai/spec/palpites-massa-task-11.md` · Design contract: `design-system/MASTER.md` · Tema: `ai/screen/palpites-massa-task-06.md` (`.palpites-theme`)
> Ferramenta: scripts Python do `ui-ux-pro-max` indisponíveis neste ambiente. Direção derivada de MASTER + wireframe PNG.
> Wireframe: `docs/prd-03-1/PRD03-05-Resumo-12-Grupos.png`

## Visual Analysis (from wireframe)

- **Header verde** ("Resumo dos Grupos") — herdado do shell `.palpites-theme` (TASK-07); nesta tela o container raiz aplica o tema.
- **Lista vertical de cards de grupo**, cada card:
  - Linha de título "Grupo A" (semibold).
  - Duas linhas de classificado: "1º Brasil", "2º Holanda" (posição + nome).
  - Ícone ✓ verde à direita quando o grupo está concluído.
  - Separação leve entre grupos (cards/border).
- **CTA verde cheio** no rodapé: "Ver Melhores Terceiros".
- **BottomNav** abaixo (já parte do AppShell — não recriar).
- Cards brancos elevados, cantos arredondados; verde apenas no shell/CTA/✓ — consistente com a decisão `.palpites-theme`.

**Diferença vs wireframe (justificada):** o wireframe mostra só 1º/2º. O PRD/plan exige marcar o **3º como candidato a melhor terceiro** (entrada da próxima etapa). Adicionamos uma 3ª linha "3º <time>" com badge textual "candidato a melhor terceiro". Mantém o espírito do layout e cumpre o requisito do plan.

## 1. User & Business Goals
Consolidar visualmente os classificados antes da etapa de melhores terceiros, dando feedback claro de quais grupos faltam concluir. Bloquear o avanço enquanto incompleto evita uma chave inconsistente. Tela de leitura rápida (escaneável), sem edição.

## 2. Design System Reference
- Master: `design-system/MASTER.md`.
- Tema de área: `.palpites-theme` (globals.css, já presente conforme screen-06/TASK-07) aplicado no container raiz da rota.
- Nenhum novo token. Reusa `--color-win` (✓) e `--primary` (CTA/realce, verde no escopo).

## 3. User Flow
Entrada: vinda do fluxo de grupos (após classificação prevista, TASK-10) ou via Hub. Saída: CTA "Ver Melhores Terceiros" → `/predictions/melhores-terceiros` (TASK-12), **apenas** quando todos os 12 grupos estão concluídos. Estado bloqueado: CTA desabilitado + mensagem de orientação + contagem "X / 12".

## 4. Information Architecture
Por card de grupo (prioridade visual):
1. Nome do grupo ("Grupo A") — primário.
2. Classificados 1º/2º (nome) — conteúdo principal.
3. 3º (candidato a melhor terceiro) — secundário, com badge textual.
4. Status ✓ / progresso "X / 6" — apoio.

CTA (rodapé): ação primária; contagem de progresso global ("X / 12 grupos concluídos") como suporte.

## 5. Layout & Components

### Rota — `page.tsx`
- Client Component. `useAuth` → uid; `useMatches`, `usePredictions(uid)`, `useTeams`.
- Deriva `GroupsSummaryData` via `buildGroupsSummary(matches, predictions, teams)`.
- Container raiz: `<div className="palpites-theme mx-auto flex max-w-2xl flex-col pb-20 md:pb-4">`.
- Repassa estados loading/error (refetch) ao componente apresentacional.

### `GroupsSummary.tsx` (presentational)
- Props: `{ groups, allComplete, completeCount, continueHref, isLoading, isError, onRetry }`.
- Título de seção `text-xl font-semibold` "Resumo dos Grupos".
- Loading: bloco `role="status"` "Carregando resumo dos grupos" (skeleton com `animate-pulse`, `motion-reduce:animate-none`).
- Error: ícone/texto "Erro ao carregar o resumo dos grupos" + `Button` "Tentar novamente".
- Empty: "Nenhum grupo encontrado" + subtítulo.
- Sucesso: `<ul className="flex flex-col gap-3">` com um `<li>` por grupo → `GroupSummaryCard` interno.

### Card de grupo (interno ao arquivo)
- `<section aria-label="Grupo A">` `rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col gap-2`.
- Topo: nome `text-sm font-semibold text-foreground` + (se concluído) `CheckCircle2 size={18} text-win` com `aria-label="Concluído"`; se incompleto, chip `text-xs text-muted-foreground` "em andamento".
- Concluído: linhas de classificado, cada uma `flex items-center gap-2`:
  - posição `text-xs font-medium text-muted-foreground w-6` ("1º"),
  - bandeira opcional (`<img>` 16px, `alt=""`),
  - nome `text-sm text-foreground`.
  - 3º recebe badge `text-[0.625rem]`→ usar `text-xs` `bg-secondary text-secondary-foreground rounded-sm px-1.5 py-0.5` "candidato".
- Incompleto: progresso "X / 6" + barra fina (`h-1.5 bg-muted` + preenchimento `bg-primary`, largura % via `style` geométrico).

### CTA rodapé
- `Button` (Shadcn) `default` ocupando largura (`w-full`), `min-h-[44px]`, "Ver Melhores Terceiros".
- `disabled={!allComplete}`. Quando desabilitado: parágrafo auxiliar `text-xs text-muted-foreground` "Conclua todos os 12 grupos para continuar" + "X / 12 grupos concluídos".
- Quando habilitado: envolve em `next/link` para `continueHref`.

## 6. Typography & Color Tokens
- Título: `text-xl font-semibold text-foreground`.
- Grupo: `text-sm font-semibold text-foreground`.
- Posição/meta: `text-xs text-muted-foreground`.
- ✓: `text-win`. Badge candidato: `bg-secondary text-secondary-foreground`.
- CTA: `bg-primary text-primary-foreground` (verde via `.palpites-theme`).
- Zero hex; cor só por token.

## 7. UI States
| Estado | Render |
|---|---|
| Loading | skeleton `role="status"` |
| Error | mensagem + "Tentar novamente" (refetch) |
| Empty | "Nenhum grupo encontrado" + subtítulo |
| Grupo concluído | 1º/2º/3º(candidato) + ✓ |
| Grupo em andamento | progresso "X/6" + barra |
| CTA bloqueado | `disabled` + mensagem + "X / 12" |
| CTA liberado | link navegável |

## 8. Accessibility (standard+)
- Contraste ≥ AA (tokens neutros + verde `.palpites-theme` validado).
- Status nunca só por cor: ✓ com `aria-label`; "em andamento" textual; badge "candidato" textual.
- Lista semântica `<ul>/<li>`; `<section aria-label>` por grupo.
- CTA desabilitado com `disabled` + `aria-disabled`; mensagem visível explica o porquê.
- `role="status"` em loading/empty; botão retry com nome acessível.
- Touch ≥ 44px no CTA/retry; foco `focus-visible:ring-2 ring-ring ring-offset-2` (herdado de Button).
- `motion-reduce:animate-none` no skeleton e barra.

## 9. Animation
- Skeleton `animate-pulse` (≤ pulse padrão); `motion-reduce:animate-none`.
- Barra de progresso por grupo: `transition-[width] duration-300 motion-reduce:transition-none`.

## 10. Navigation
- `next/link` no CTA quando habilitado → `/predictions/melhores-terceiros`.
- BottomNav/SideNav inalterados (AppShell).

## 11. Pre-Delivery Checklist
- Lucide named imports (`CheckCircle2`, `AlertCircle`, `ListChecks`/similar) — OK.
- Tokens semânticos; zero hex; `style` só largura geométrica da barra — OK.
- Touch ≥ 44px; estados loading/error/empty — OK.
- Light/dark via tokens; `text-win` tem variante dark — OK.
- Cor não-exclusiva (ícone+texto) — OK.

## 12. Gaps & Assumptions
- 1º/2º/3º só consolidados com grupo completo (decisão de honestidade da tela — classificação parcial é instável). Documentado no spec §3.
- `continueHref` = `/predictions/melhores-terceiros` (rota da TASK-12, ainda não criada nesta task; link é estático e seguro).
- Bandeiras: usadas se `flagUrl` presente; ausência não quebra layout (nome textual é a informação).
- Exceção `style` geométrico (largura da barra) reusada de screen-06.
