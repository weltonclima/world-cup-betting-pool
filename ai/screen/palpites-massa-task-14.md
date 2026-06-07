# SCREEN SPEC — TASK-14: Telas das fases eliminatórias

## Platform: web (mobile-first → desktop)
> Spec: `ai/spec/palpites-massa-task-14.md` · Design: MASTER + `ai/screen/palpites-massa-task-13.md`
> Wireframes: PRD03-07 (16 avos), -08 (oitavas), -09 (quartas), -10 (semis), -11 (final+3º).
> ui-ux-pro-max (Python) indisponível — direção via MASTER + wireframes.

## Visual Analysis (PRD03-07..11)
- Header verde com título da fase. Abaixo, instrução curta. Lista/colunas de cartões de
  confronto (componente Bracket/BracketMatchup da TASK-13). CTA verde "Salvar Fase".
  Navegação entre fases (anterior/próxima) ao rodapé.
- PRD03-11: duas seções na mesma tela — "Final" e "Disputa de 3º lugar".
- Mobile: pilha vertical. Desktop: confrontos em grid de colunas (já no Bracket).

## Layout (KnockoutPhaseScreen)
- Container raiz da rota: `palpites-theme mx-auto flex max-w-3xl flex-col gap-6 pb-20 md:pb-4`.
- Header: `<h1 className="text-2xl font-semibold text-foreground">` (rótulo da fase) +
  `<p className="text-sm text-muted-foreground">` (instrução).
- Seções: 1+ `Bracket` (final tem 2 — "Final" e "Disputa de 3º lugar" via `title`).
- CTA "Salvar Fase": `buttonVariants({ variant: "default", size: "lg" })`, `min-h-[44px]`,
  `w-full md:w-auto md:self-end`, "Salvando…" enquanto pending, disabled sem salvável.
- Navegação: linha com link "← <fase anterior>" e "<próxima fase> →" (next/link),
  `min-h-[44px]`, foco visível.

## Estados
| Estado | UI |
|---|---|
| loading | skeleton (cartões pulsantes) role=status |
| error | role=alert + "Tentar novamente" |
| empty | "Os jogos desta fase ainda não estão disponíveis." + link voltar |
| bloqueado (A6) | bloco centralizado: Lock 24, "Fase bloqueada", "Conclua <fase anterior> primeiro.", CTA link para a fase anterior |
| populated | Bracket(s) + CTA Salvar + navegação |

## Acessibilidade
- Heading hierárquico (h1 tela, h2 por Bracket).
- Estado bloqueado: ícone + texto (cor não-exclusiva); CTA navegável.
- Touch >=44px; foco visível; motion-reduce nas transições.

## Tema
`.palpites-theme` no container. Tokens apenas; verde herdado.
