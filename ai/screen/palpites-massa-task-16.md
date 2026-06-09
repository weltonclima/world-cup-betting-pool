# SCREEN SPEC – Casca do Wizard + Modo Completar Copa + Navegação
## Task: TASK-16 (palpites-massa)
## Platform: web (mobile-first → desktop)

> Spec: `ai/spec/palpites-massa-task-16.md` · Design contract: `design-system/MASTER.md` (§2.4-palpites, §9 nav)
> Ferramenta: scripts Python do `ui-ux-pro-max` indisponíveis. Direção derivada de MASTER + wireframes PRD03-01..16 (CTA "Completar Copa" + fluxo contínuo).

## Visual Analysis
- Os wireframes mostram CTA verde "Completar Palpites/Continuar" no Hub e botões "Salvar"/"Continuar" no rodapé de cada etapa. O modo Completar Copa adiciona uma barra de progresso de etapas com Anterior/Próximo, mantendo o BottomNav.

## 1. Goals
Permitir completar a Copa num fluxo guiado contínuo, com orientação clara de "onde estou / quanto falta" e navegação previsível entre etapas, sem perder a navegação livre via Hub.

## 2. Design System Reference
- MASTER §9 (nav) + `.palpites-theme`. A barra do wizard usa tokens (verde herdado no escopo). Item de nav "Palpites" → Hub (MASTER §7 ícone PenLine).

## 3. Layout and Components
- **PredictionsWizard** (barra fixa de fluxo):
  - Container `nav` `fixed bottom-16 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm md:bottom-0` (acima do BottomNav mobile; no rodapé no desktop). `px-4 py-2 flex items-center justify-between gap-2`.
  - Esquerda: botão "Anterior" `buttonVariants ghost`, ícone `ChevronLeft`, `min-h-[44px]`; oculto na primeira etapa (render de espaçador para manter layout).
  - Centro: indicador `text-xs font-medium text-muted-foreground` "Etapa X de Y · {label}" com `aria-live="polite"`; badge "⚡ Completar Copa" (`Zap` + `text-primary`) quando ativo; link/botão "Sair" pequeno (`text-xs underline`).
  - Direita: botão "Próximo" `buttonVariants default`, ícone `ChevronRight`, `min-h-[44px]`; oculto na última etapa.
  - Só renderiza quando `active && stepIndex !== null`.
- **Layout `/predictions`**: wrapper `.palpites-theme` + `{children}` + `<PredictionsWizard/>` montado uma vez.
- **Hub CTA**: "Completar Copa" navega com `?wizard=1` (ativa o modo).

## 4. UI States
| Estado | Tratamento |
|---|---|
| oculto | fora do wizard ou modo inativo → barra não renderiza |
| ativo (meio) | Anterior + indicador + Próximo |
| primeira etapa | sem Anterior (espaçador) |
| última etapa | sem Próximo (espaçador) |

## 5. Accessibility
- `nav aria-label="Navegação do fluxo de palpites"`; botões ≥ 44px; `aria-label` claros ("Etapa anterior" / "Próxima etapa").
- Indicador textual + `aria-live="polite"`; ícones `aria-hidden`.
- Foco `ring-2 ring-ring ring-offset-2`; sem layout shift.
- Contraste ≥ AA (tokens + verde escopado).
- `motion-reduce` nas transições de cor.

## 6. Tokens
- Apenas tokens (`bg-background/95`, `border-border`, `text-muted-foreground`, `text-primary`). Zero hex, zero `style`.

## 7. Gaps/Assumptions
- A etapa "Grupos" agrega `/predictions/grupos` e `/predictions/grupos/[groupId]` (sub-navegação dos 12 grupos é da tela de seleção; o Próximo do wizard leva ao Resumo de Grupos).
- Bloqueio A6 permanece nas telas; o wizard não duplica a regra, apenas encadeia a ordem.
- Nav "Palpites" → `/predictions` já vigente (verificação de regressão, sem alteração de código).
