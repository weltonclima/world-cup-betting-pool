# SCREEN SPEC — TASK-13: Componente de Chave Interativa (Bracket)

## Platform: web (mobile-first → desktop)
> Spec: `ai/spec/palpites-massa-task-13.md` · Design: `design-system/MASTER.md` + `ai/screen/palpites-massa-task-06.md`
> Ferramenta ui-ux-pro-max (Python) indisponível — direção derivada de MASTER + wireframes PRD03-07..11.

## Visual Analysis (wireframes PRD03-07..11)
- Cada fase = pilha de "cartões de confronto". Cada confronto: dois times empilhados
  (mandante em cima, visitante embaixo) com bandeira + nome à esquerda e input de placar
  à direita; uma linha "x"/"vs" separando. Header verde da área.
- Desktop: confrontos distribuídos em colunas (chave horizontal). Mobile: pilha vertical.
- Vencedor destacado (cor da identidade verde / negrito). Final + 3º lugar na mesma tela.

## Layout dos componentes

### BracketMatchup (cartão de confronto)
- `rounded-xl border border-border bg-card p-3 shadow-sm flex flex-col gap-2`.
- Linha home: `[bandeira] [nome flex-1] [CompactScoreInput]` (`items-center gap-2`).
- Separador "x" centralizado `text-xs text-muted-foreground`.
- Linha away: mesmo layout.
- Vencedor: nome em `font-semibold text-win` + ícone `Crown`/`Check`(size 14) + sr-text "Vence".
- Empate: `<p role="status" className="text-xs text-muted-foreground">` com aviso.
- Locked: passa `locked` ao CompactScoreInput; chip "Encerrado" com `Lock` 12.

### Bracket
- Container `flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4`.
- `role="list"`; cada matchup em `role="listitem"`.
- `title` opcional renderiza `<h2 className="text-lg font-semibold text-foreground">`.

## Estados
| Estado | Tratamento |
|---|---|
| vazio (sem matchups) | Bracket não renderiza lista; tela exibe empty (TASK-14) |
| placeholder (TBD) | rótulo humano "2º Grupo A", sem bandeira, input habilitado |
| preenchido c/ vencedor | lado vencedor realçado (ícone+texto+token) |
| empate | hint inline role=status; sem realce de vencedor |
| locked | inputs disabled, chip Encerrado |

## Acessibilidade
- `aria-label` por input (`Gols <rótulo>`).
- Cor não-exclusiva (ícone+texto em vencedor/empate).
- Touch ≥ 44px; gap ≥ 8px; foco visível herdado do CompactScoreInput.
- `motion-reduce` nas transições de cor.

## Tema
Tokens apenas; verde herdado de `.palpites-theme` (container da rota TASK-14).
