# UI-SPEC — TASK-04 · Tela Palpites Manuais (admin de grupo)

> Stack: Next.js 15 App Router + Tailwind/NativeWind. Autoridade de design: `design-system/MASTER.md` + `patterns/nextjs` (precedência sobre ui-ux-pro-max). **ui-ux-pro-max não invocado**: a tela é composta 100% de componentes/tokens já fixados (`ScoreInput`, `ConfirmActionDialog`, template `GroupPendingUsers`) — valor marginal ~zero.

## 1. Objetivo visual
Formulário enxuto em coluna única (mobile-first): admin escolhe participante → jogo bloqueado → placar → salva (com confirmação de sobrescrita). Mesma linguagem das telas `(app)/group/*` (neutro, light, tokens semânticos).

## 2. Estrutura (hierarquia de componentes)
```
page.tsx (server, thin)
└── GroupManualPredictions (client)
    ├── GroupAdminSubHeader  title="Palpites manuais" subtitle="Lance o palpite de um participante em jogo encerrado/bloqueado"
    ├── [estado: loading → ListSkeleton | error → ErrorState(retry) | empty → EmptyState]
    └── <form> (quando há participantes E jogos bloqueados)
        ├── Field "Participante"  → <select> nativo (aprovados)
        ├── Field "Jogo"          → <select> nativo (só bloqueados; rótulo "Casa x Fora" + placar real se finished)
        ├── ScoreRow              → ScoreInput(Mandante) + "x" + ScoreInput(Visitante)
        ├── Button submit "Salvar palpite" (full-width, primary, min-h-44)
        └── ConfirmActionDialog (overwrite, incondicional pré-submit)
```

## 3. Layout & espaçamento
- Container: `flex flex-col gap-4`, `mx-auto w-full max-w-md px-4 py-4` (form estreito, foco).
- Card do form: `rounded-xl border border-border bg-card p-4 flex flex-col gap-4`.
- ScoreRow: `flex items-end justify-center gap-3` — dois `ScoreInput` + separador `x` (`text-2xl font-bold text-muted-foreground self-center`).
- Botão submit: `w-full min-h-[44px] rounded-lg bg-primary text-primary-foreground font-medium`.

## 4. Campos (selects nativos)
Sem componente Select no projeto → `<select>` nativo estilizado, acessível.
- Wrapper field: `flex flex-col gap-1.5`.
- `<label htmlFor>` `text-sm font-medium text-foreground`.
- `<select>` `min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`.
- Placeholder option desabilitada (`value=""`, `disabled`): "Selecione…".
- Participante option: `{user.name}` (+ `@nickname` se útil).
- Jogo option: `${home.name} x ${away.name}` + ` (Hx A)` se `finished`.

## 5. Estados de interação
| Estado | Visual |
|---|---|
| default | selects vazios (placeholder), scores 0×0, submit habilitado só com participante+jogo escolhidos |
| loading (hooks) | `ListSkeleton` (animate-pulse, motion-reduce:none) |
| error (hooks) | `ErrorState` AlertCircle + msg + botão "Tentar novamente" → refetch |
| empty: sem aprovados | EmptyState "Nenhum participante aprovado no grupo." |
| empty: sem jogos bloqueados | EmptyState "Nenhum jogo bloqueado para lançar palpite." |
| submitting (`isPending`) | form + selects + ScoreInput + botão `disabled`; spinner `LoaderCircle animate-spin` no botão |
| sucesso | `toast.success("Palpite lançado.")`; reset (selects → "", scores → 0) |
| erro submit | toast (via hook `onError`); form permanece preenchido p/ retry |

Botão submit `disabled` quando: `!targetUid || !matchId || isPending`.

## 6. Diálogo de confirmação (sobrescrita — A2)
`ConfirmActionDialog`:
- `title`: "Confirmar palpite"
- `description`: "Você vai lançar **{novoPlacar}** para **{nomeParticipante}** no jogo **{Casa x Fora}**. Se já houver um palpite para este participante neste jogo, ele será sobrescrito."
- `confirmLabel`: "Lançar palpite" · `confirmVariant`: "default"
- `pending`: `mutation.isPending` · `onConfirm`: dispara `mutate`
- Abre ao clicar "Salvar palpite"; submit real só no confirm. (Confirmação incondicional — client não pode ler palpite anterior pelas Rules; transparência real na auditoria server-side.)

## 7. Acessibilidade
- Cada `<select>` com `<label htmlFor>` associado; placeholder option desabilitada.
- `ScoreInput` já WCAG (role=group, aria-live, 44px) — reuso intacto.
- Foco visível em todos os interativos (`focus-visible:ring-2 ring-ring`).
- Alvos ≥44px (selects, botões, steppers).
- Dialog já gerencia foco/Esc/backdrop (bloqueia close enquanto pending).
- `toast` (sonner) anuncia resultado.

## 8. Responsividade
- Mobile-first coluna única; `max-w-md` centraliza em telas largas (sem layout multi-coluna — form curto).
- ScoreRow mantém os dois steppers lado a lado (gap menor no mobile, herdado do `ScoreInput`: `gap-2 sm:gap-4`).

## 9. Navegação / entrada
- Card "Palpites manuais" nas Ações Rápidas do `GroupDashboard` → `<Link href="/group/predictions">` com ícone `Pencil` (lucide), mesmo estilo dos cards existentes (Pendentes/Convites/Configurações).

## 10. Tokens (semânticos — nunca hex)
- Superfícies: `bg-card`, `bg-background`, `border-border`.
- Texto: `text-foreground`, `text-muted-foreground`.
- Ação primária: `bg-primary text-primary-foreground`.
- Foco: `ring-ring`. Disabled: `opacity-50 cursor-not-allowed`.
- Spinner: `LoaderCircle` lucide `animate-spin`.

## 11. Animações
- Apenas `transition-colors duration-150 motion-reduce:transition-none` em hover/focus de botões/selects. Sem framer-motion (form simples).

## 12. Decisões fixadas
- `<select>` nativo (não há Select no design system; nativo é acessível e suficiente).
- Confirmação de sobrescrita **incondicional** (Rules impedem leitura client do palpite alvo).
- `now = new Date()` no client component (não em helper puro).
