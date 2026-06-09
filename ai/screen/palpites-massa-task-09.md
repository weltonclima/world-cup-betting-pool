# SCREEN SPEC – Palpite em Massa do Grupo
## Task: TASK-09 (palpites-massa)
## Platform: web (mobile-first → desktop)

> Spec: `ai/spec/palpites-massa-task-09.md` · Design contract: `design-system/MASTER.md` + `ai/screen/palpites-massa-task-06.md`
> Ferramenta: scripts Python do `ui-ux-pro-max` não rodam neste ambiente (sem Python). Direção de design derivada de `design-system/MASTER.md` + primitivas TASK-06 + wireframe PNG.

## Visual Analysis (from image)
- Source: `docs/prd-03-1/PRD03-03-Palpite-Rapido-Grupo.png`
- Layout: header verde escuro com título "Grupo C"; abaixo, instrução em uma linha ("Digite todos os resultados dos jogos do grupo de uma vez"); subtítulo "Preencha os palpites"; lista vertical de 6 linhas de jogo; CTA verde cheio "Salvar 6 Palpites" no rodapé do conteúdo.
- Components: linha de jogo = [bandeira + nome do país à esquerda] · [input numérico] · "x" · [input numérico] · [nome do país + bandeira à direita]; botão primário verde.
- Style signals: shell verde (header + CTA + barra/seleção), superfície de conteúdo branca/neutra, cards/linhas com leve separação, números em destaque (bold) nos inputs.
- States visible: inputs editáveis (vazios/preenchidos).
- Assumptions: bandeiras renderizadas via `flagUrl`; o "x" é separador decorativo; nomes truncam em telas estreitas; jogos encerrados (não visíveis no wireframe — sem jogos passados) recebem tratamento `locked` derivado do spec.

## 1. User and Business Goals
Usuário aprovado quer registrar rapidamente os 6 placares de um grupo numa só tela (meta UX do PRD: grupo em < 60s). Precisa digitar números com fluência (teclado numérico no mobile, TAB no desktop), ver o que já preencheu, e salvar tudo de uma vez com feedback claro. Negócio: maximizar taxa de conclusão dos palpites.

## 2. Design System Reference
- Master: `design-system/MASTER.md` (baseline canônico).
- Tema de área: escopo `.palpites-theme` (já em `globals.css`, definido na TASK-07) — remapeia `--primary`/`--ring`/`--sidebar-primary` para o verde da identidade. O container da rota aplica a classe; os componentes usam só tokens e herdam o verde.
- Primitivas reutilizadas (TASK-06): `CompactScoreInput` (input digitável, TAB, ≥44px, locked/invalid). Sem `design-system/pages/*` novo.

## 3. User Flow
Entrada: a partir do grid de grupos (`/predictions/grupos`, TASK-08) ao tocar num `GroupCard` → `/predictions/grupos/[groupId]`. Também acessível por deep-link.

```
Grid de grupos ──tap GroupCard──▶ /predictions/grupos/{id}
                                     │
       ┌── loading (skeleton) ───────┤
       ├── error (alert + retry) ────┤
       ├── empty (sem jogos) ── link ▶ volta ao grid
       └── populated ─ digita placares ─(auto-save local)─▶ "Salvar Grupo"
                                                              │
                                       ┌── sucesso ──▶ toast.success
                                       ├── parcial ──▶ toast.warning
                                       ├── nada salvo ▶ toast.error
                                       └── erro rota ─▶ toast.error
```
Saída: permanece na tela após salvar (estado preservado); navegação de volta ao grid pelo header/BottomNav. A seção de Classificação Prevista (TASK-10) é integrada nesta rota como etapa pós-save.

Edge: uid ausente → tratado como loading; jogo encerrado → linha travada; par de placar incompleto → não entra no save.

## 4. Information Architecture
1. **Título do grupo** (primário) — "Grupo {id}".
2. **Instrução** (secundário) — "Digite todos os resultados dos jogos do grupo de uma vez."
3. **Lista de linhas de jogo** (núcleo da tarefa) — por linha: dado primário = os 2 placares (inputs); apoio = nomes+bandeiras dos times; estado = locked.
4. **CTA "Salvar Grupo"** (ação principal) — fixa ao fim do conteúdo.
5. **Voltar** — via header/BottomNav existentes (não recriar).

## 5. Layout and Components

### Container da rota (page.tsx)
- `div.palpites-theme mx-auto flex max-w-2xl flex-col pb-20 md:pb-4` (mesmo padrão de `/predictions` e `/predictions/grupos`).

### GroupQuickFill (apresentacional)
- Cabeçalho: `h1 text-2xl font-semibold text-foreground` ("Grupo {id}") + `p text-sm text-muted-foreground` (instrução).
- Lista: `ul flex flex-col gap-2` (≥8px entre linhas). Cada `li` → `GroupMatchRow`.
- CTA: `Button` (variant default, size lg) `min-h-[44px] w-full md:w-auto md:self-end`, texto "Salvar Grupo" / "Salvando…" (isPending). `disabled` quando salvando ou sem item preenchido+desbloqueado.
- Espaçamento vertical entre seções: `gap-4`.

### GroupMatchRow
- Container: `flex items-center gap-2 rounded-xl border border-border bg-card p-3 min-h-[44px]`.
- Lado mandante: `flex items-center gap-2 flex-1 min-w-0 justify-end` → bandeira `<img class="h-4 w-6 rounded-sm object-cover" alt="" aria-hidden>` (se `flagUrl`) + `span text-sm font-medium text-foreground truncate`.
- Centro: `flex items-center gap-1 shrink-0` → `CompactScoreInput` (mandante) + `span aria-hidden text-muted-foreground` "x" + `CompactScoreInput` (visitante).
- Lado visitante: `flex items-center gap-2 flex-1 min-w-0` → `span truncate` + bandeira.
- Locked: ambos inputs `locked`; marcador `span text-xs text-muted-foreground inline-flex items-center gap-1` com `Lock size={12} aria-hidden` + "Encerrado", posicionado abaixo dos nomes ou ao lado (não depender só de cor).
- aria-label dos inputs: `Gols {homeTeam.name}` / `Gols {awayTeam.name}`.

### Estados auxiliares (dentro de GroupQuickFill)
- **Skeleton:** `div role=status aria-live=polite` + 6 blocos `h-16 rounded-xl bg-muted animate-pulse motion-reduce:animate-none` (espelha grid/Hub).
- **Error:** `div role=alert` + `p text-sm text-destructive` + botão "Tentar novamente" (`buttonVariants outline lg`, `min-h-[44px]`) → `onRetry`.
- **Empty:** `p text-sm text-muted-foreground` ("Os jogos deste grupo ainda não estão disponíveis.") + `Link` para `/predictions/grupos` ("Voltar para os grupos").

### Responsividade
- Mobile (375): linha em grid flexível; nomes `truncate`; inputs `w-12` (44px). "x" mantém 1ch.
- ≥768 (md): mesma linha, mais respiro; CTA alinha à direita (`md:self-end`).
- Conteúdo limitado a `max-w-2xl` centralizado; sem scroll horizontal.

## 6. Typography and Color Tokens
- Título: `text-2xl font-semibold text-foreground`.
- Instrução / metadados: `text-sm`/`text-xs text-muted-foreground`.
- Nome de time: `text-sm font-medium text-foreground`.
- Placar (input): `text-lg font-bold text-foreground` (de `CompactScoreInput`).
- Separador "x": `text-muted-foreground`.
- CTA: `bg-primary text-primary-foreground` (verde no escopo).
- Locked: `text-muted-foreground` + ícone (cor não-exclusiva).
- Erro: `text-destructive`.
- Contraste: tokens neutros do MASTER + verde escopado já validados AA; nenhum hex.

## 7. UI States

| Estado | Tratamento visual |
|---|---|
| Loading | `role=status` + 6 skeletons pulsantes (motion-reduce desliga) |
| Empty | mensagem + link "Voltar para os grupos" |
| Populated | linhas editáveis; CTA habilitado se houver item preenchido+desbloqueado |
| Saving (isPending) | CTA `disabled` + texto "Salvando…" |
| Success | `toast.success("{n} palpites salvos.")` |
| Partial | `toast.warning("{s} salvos, {r} não salvos (jogos encerrados ou inválidos).")` |
| Error (rota) | `toast.error(message)`; estado da tela preservado |
| Error (load) | `role=alert` + "Tentar novamente" |
| Locked (linha) | inputs `disabled`/`aria-disabled` + `Lock`+"Encerrado" |
| Disabled (CTA) | sem item preenchido+desbloqueado ou durante save; `opacity`/`cursor-not-allowed` herdados do Button |

## 8. Accessibility Requirements (Priority 1)
- **Contraste:** texto ≥4.5:1, componentes ≥3:1 (tokens MASTER + verde escopado AA).
- **Touch targets:** `CompactScoreInput` e CTA ≥44×44px; gap ≥8px (`gap-2` nas linhas, `gap-1` entre os 2 inputs ainda mantém alvos ≥44px — usar `gap-2` se necessário para garantir 8px entre os dois inputs).
- **Labels:** cada input com `aria-label` "Gols {time}"; bandeiras `alt=""`+`aria-hidden`; "x" `aria-hidden`.
- **Foco / TAB:** ordem natural do DOM — mandante→visitante por linha, depois próxima linha. Nenhum `tabIndex` positivo, sem captura de teclado. Foco visível `focus-visible:ring-2 ring-ring ring-offset-2` (da primitiva).
- **Heading:** `h1` único por tela (título do grupo). Sem pular níveis.
- **Cor não-exclusiva:** locked sempre com ícone+texto.
- **Reduced motion:** skeleton e transições com `motion-reduce`.
- **Escape:** voltar via header/BottomNav; link de volta no estado vazio.
- **Screen reader:** loading `aria-live=polite`; error `role=alert`; toasts pelo provedor Sonner (já com região live).
- **Dynamic type:** unidades relativas (text-sm/lg) escalam.

## 9. Animation and Motion (Priority 7)
- CTA/linha hover: `transition-colors duration-150 motion-reduce:transition-none`.
- Skeleton: `animate-pulse motion-reduce:animate-none`.
- Sem animação de layout (sem width/height/top/left). Sem transições de entrada custosas — foco na velocidade de digitação.

## 10. Navigation Patterns (Priority 9)
- Entrada por `GroupCard` (next/link). Saída por header/BottomNav existentes (não recriar nesta task).
- Deep-link suportado por rota dinâmica.
- Localização atual: o item "Palpites" do nav permanece destacado (responsabilidade do shell, não desta tela).
- Empty state oferece `Link` explícito de retorno ao grid.

## 11. Pre-Delivery Checklist Status
- Ícones SVG (Lucide `Lock`), import nomeado — OK.
- Pressed/focus não deslocam layout (ring com offset) — OK.
- Tokens semânticos; zero hex; sem `style` inline (ProgressBar não usado aqui) — OK.
- Touch ≥44px (input/CTA), gap ≥8px — OK (usar `gap-2` entre os dois inputs centrais para garantir 8px).
- Light/dark: tokens neutros + `text-muted-foreground`/`text-destructive` cobrem ambos — OK.
- Acessibilidade (labels, TAB order explícito, cor não-exclusiva, reduced motion, live regions) — OK.
- Todos os estados definidos (loading/empty/populated/saving/success/partial/error/locked/disabled) — OK.

## 12. Design Gaps and Assumptions
- **Par incompleto:** decisão do spec (R3) — draft/payload só com par completo; o lado vazio não vira placar. Assunção conservadora (não inventar 0).
- **Bandeiras ausentes:** fallback sem imagem (nome do país basta); sem placeholder visual obrigatório.
- **Posição do CTA:** wireframe mostra rótulo "Salvar 6 Palpites"; adotado "Salvar Grupo" (contagem variável `items.length` evita hardcode de 6). Se o número for desejado, pode-se usar "Salvar {n} Palpites" sem mudança estrutural.
- **Seção Classificação Prevista (TASK-10):** integrada nesta rota como toggle/etapa pós-save — layout detalhado no screen spec da TASK-10.
- **Gap entre os 2 inputs centrais:** wireframe usa "x" colado; para WCAG 2.5.8/8px entre alvos, usar `gap-2` (8px) ao redor do "x".
