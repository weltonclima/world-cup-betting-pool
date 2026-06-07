# SCREEN — TASK-09: Tela "Aguardando Aprovação" (revisado p/ aguardando.png)

> Fonte de verdade: `docs/prd-01/aguardando.png`. Contrato: `design-system/MASTER.md`. Expande `src/components/layout/PendingApprovalScreen.tsx`. **Tema claro** de página inteira (`.auth-light` → `--primary` verde p/ o botão).

## Decisões (confirmadas)
- **Botão "Sair": REMOVIDO** (segue o mock).
- **Botão "Atualizar status": outline com texto/borda verde** (não preenchido).

## Layout (mobile-first, distribuição topo/meio/base)
```
[ .auth-light · role="main" aria-label="Aguardando aprovação"
  · min-h-screen · flex col · bg-background · px-6 py-10 ]
  ├─ <header> topo · text-center
  │    h1 "Aguardando Aprovação"  text-2xl font-semibold
  ├─ <div> centro (flex-1, items/justify-center, gap-6, text-center)
  │    ├─ Relógio em CÍRCULO  (div h-28 w-28 rounded-full bg-muted → Clock h-14 w-14 text-muted-foreground)
  │    └─ <div max-w-sm>
  │         p "Cadastro realizado!"  text-lg font-semibold text-foreground
  │         p "Seu acesso está aguardando aprovação do administrador."  text-sm text-muted-foreground
  │         p "Você receberá um email quando sua conta for liberada."   text-sm text-muted-foreground
  └─ Button "Atualizar status"  base · variant=outline · h-11 w-full
       · border-primary text-primary hover:bg-primary/10  (verde)
```

## Comportamento (inalterado — refresh não-racy)
`handleRefresh` → `setRefreshing(true)` → `await refreshProfile()` → bump `refreshTick` → `setRefreshing(false)`. Um `useEffect([refreshTick, status, error, router])` decide com estado JÁ commitado: `error`→toast.error; `approved`→`router.push("/home")`; senão toast.info "Ainda aguardando aprovação.". Não dispara na montagem (`refreshTick===0`). Guard de concorrência via geração no AuthProvider (TASK-04).

## A11y
- `role="main"` + `aria-label`; relógio `aria-hidden`; botão `aria-busy` no loading + spinner `motion-reduce:animate-none`; toque 44px (`h-11`); foco visível (ring).

## Divergências conhecidas vs mock
- Nenhuma de conteúdo. (Sair removido + botão verde-outline conforme decisão.)
