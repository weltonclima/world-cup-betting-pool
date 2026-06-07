# SCREEN SPEC – Resumo Final + Estado Enviado
## Task: TASK-15 (palpites-massa)
## Platform: web (mobile-first → desktop)

> Spec: `ai/spec/palpites-massa-task-15.md` · Design contract: `design-system/MASTER.md` (§2.4-palpites)
> Ferramenta: scripts Python do `ui-ux-pro-max` indisponíveis (sem Python). Direção derivada de MASTER + wireframes PRD03-12, PRD03-15.

## Visual Analysis (from images)

### PRD03-12 — Resumo Final
- Header verde "Resumo Final"; card "Campeão" (bandeira grande + nome) em destaque; card "Vice-Campeão" abaixo; linha com dois cards lado a lado "3º Lugar" / "4º Lugar"; CTA verde cheio "Confirmar Palpites"; BottomNav.

### PRD03-15 — Estado Enviado
- Header verde "Meus Palpites"; bloco central com troféu grande + confete; título "Palpites enviados!"; subtítulo "Todos os seus 104 palpites foram enviados com sucesso."; card "Total de Palpites 104/104 100%" com ProgressBar cheia; CTA "Ver Resumo Final".

## 1. Goals
Fechar a jornada: confirmar visualmente os finalistas previstos e enviar tudo num clique; após envio, dar feedback de conclusão claro e motivador.

## 2. Design System Reference
- Master canônico; herda `.palpites-theme` (verde) aplicado pelo container `/predictions/resumo`. Componentes neutros-por-token.

## 3. Layout and Components
- **FinalSummary** (apresentacional):
  - Header `h1 text-xl font-semibold text-foreground` "Resumo Final".
  - **Campeão:** card `rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col items-center gap-2`; ícone `Crown size={24} text-primary`; flag (h-8 w-12 rounded-sm) ou fallback sem flag; rótulo `text-xs font-medium uppercase tracking-wide text-muted-foreground` "Campeão"; nome `text-lg font-bold text-foreground`.
  - **Vice:** mesmo card, ícone `Medal`; rótulo "Vice-Campeão".
  - **3º/4º:** grid `grid-cols-2 gap-3`, cards menores `p-3`; rótulos "3º Lugar" / "4º Lugar".
  - Slot sem definição: nome "A definir" `text-muted-foreground`, sem flag.
  - **CTA** "Confirmar e Enviar" → `Button size="lg"` full-width `min-h-[44px]`, ícone `Send`; desabilitado quando `!hasPending` (texto "Tudo enviado"); `isSaving` → "Enviando…".
- **Estado Enviado** (isComplete): `section role="status"` centralizado: `Trophy size={48} text-primary`; `PartyPopper` decorativo; título `text-lg font-semibold` "Palpites enviados!"; subtítulo `text-sm text-muted-foreground`; card de contagem com `ProgressBar value={total} total={total}`; CTA secundário `Link` "Voltar ao Hub" (`buttonVariants outline`).

## 4. UI States
| Estado | Tratamento |
|---|---|
| loading | skeleton (barra + 4 blocos `animate-pulse`) `role="status"` |
| error | bloco `role="alert"` + botão "Tentar novamente" |
| populated | resumo de finalistas + contagem + CTA |
| pending-empty | CTA desabilitado "Tudo enviado" |
| saving | CTA "Enviando…" desabilitado |
| enviado | painel PRD03-15 |

## 5. Accessibility
- Cards de finalista `aria-label` ("Campeão: Brasil" / "Campeão: a definir"); flags `alt="" aria-hidden`.
- CTA ≥ 44px; foco `ring-2 ring-ring ring-offset-2`.
- Estado enviado `role="status" aria-live="polite"`; ícones decorativos `aria-hidden`.
- Contraste ≥ AA; status nunca só por cor (sempre rótulo textual).
- `motion-reduce` no pulse e na barra (já no ProgressBar/skeleton).

## 6. Tokens
- Apenas tokens (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `text-primary`). Verde herdado no escopo. Zero hex, zero `style` (largura da barra é exceção já documentada no ProgressBar).

## 7. Gaps/Assumptions
- Confete representado por ícone `PartyPopper` (sem lib de animação dedicada — escopo enxuto).
- "Confirmar e Enviar" envia rascunho local pendente (A4/A5); itens já salvos não são reenviados.
