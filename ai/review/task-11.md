# Revisão de Código — TASK-11: App Shell + Layout Base (Mobile-First)

> **Veredicto:** `approved with adjustments`
> **Data:** 2026-06-05
> **Revisor:** Claude (gsd-code-reviewer + gsd-ui-auditor, modo deep)
> **Arquivos revisados:** 19 arquivos de implementação
> **Gates executados:** `tsc --noEmit` ✅ | `npm run lint` ✅ | `npm run build` ✅

---

## Resumo Executivo

A implementação da TASK-11 está **sólida e bem estruturada**. Todos os gates CI passam sem erros. A máquina de estados do `AuthGuard` está correta, o design system é respeitado (sem `any`, sem estilos inline, sem valores hexadecimais hardcoded), os componentes são totalmente tipados e a estrutura de rotas corresponde à especificação.

Foram identificados **0 BLOCKERs** e **5 WARNINGs** — todos não bloqueantes, ajustáveis antes ou durante o próximo PRD. O ponto mais relevante é um comportamento de `signOut` silencioso em caso de falha de rede.

---

## Findings

### WR-01 — `handleSignOut` não trata erros de rede (WARNING)

**Arquivos:**
- `src/components/layout/PendingApprovalScreen.tsx:14-15`
- `src/components/layout/BlockedScreen.tsx:14-15`

**Issue:** `handleSignOut` chama `firebaseAuth.signOut()` sem `try/catch`. Se a operação falhar por problema de rede ou SDK, a promise rejeita silenciosamente (o `void` suprime o aviso mas não trata o erro). O usuário clica em "Sair" e não recebe feedback, permanecendo preso na tela.

**Fix:**
```tsx
async function handleSignOut() {
  try {
    await firebaseAuth.signOut();
  } catch {
    // PRD-01: exibir toast de erro via Sonner
    console.error("Erro ao efetuar logout");
  }
}
```
> PRD-01, ao adicionar `Sonner`, deve substituir o `console.error` por `toast.error(...)`.

---

### WR-02 — `(auth)/layout.tsx` não trata `status === null` com usuário autenticado (WARNING)

**Arquivo:** `src/app/(auth)/layout.tsx:43-56`

**Issue:** A spec define que `(auth)/layout.tsx` deve tratar o estado `status === "blocked"` (✓ implementado). Porém, quando `firebaseUser !== null` e `status === null` (casos `"not-found"`, `"parse-error"`, `"fetch-error"` do `AuthProvider`), o layout renderiza `{children}` — ou seja, o usuário com perfil corrompido/ausente vê a tela de login. Embora não seja um problema de segurança (o `AuthGuard` de `(app)` bloqueará o acesso), causa uma experiência confusa: o usuário está "logado" (Firebase Auth tem sessão) mas vê o formulário de login.

A spec não especifica explicitamente este estado para `(auth)`, mas a tabela de estados da spec para `(app)` e a filosofia de "fail-safe" sugerem que `status === null` + `firebaseUser !== null` deveria redirecionar para `BlockedScreen` também no `(auth)`.

**Fix:**
```tsx
// Após o check de blocked:
if (firebaseUser && status === null) {
  return <BlockedScreen />;
}
```

---

### WR-03 — `SideNav`: itens não têm `min-h-[44px]` explícito (WARNING)

**Arquivo:** `src/components/layout/SideNav.tsx:38`

**Issue:** Cada item da `SideNav` usa `p-3` (12px × 4 lados) + ícone 20px = 44px total na dimensão vertical (`20 + 24 = 44px`). O touch target mínimo de 44px é atingido matematicamente, mas sem garantia explícita via `min-h-[44px]`. O `BottomNav` usa `min-h-[44px] min-w-[44px]` explicitamente (correto). A inconsistência pode causar regressões se o padding for ajustado no futuro.

**Fix:** Adicionar `min-h-[44px] min-w-[44px]` à className dos itens da SideNav para tornar o contrato visual explícito:
```tsx
"flex items-center justify-center p-3 rounded-lg min-h-[44px] min-w-[44px] transition-colors duration-150 motion-reduce:transition-none"
```

---

### WR-04 — `AppShell`: `pt-14` aplicado no wrapper interno, não no `<main>` (WARNING leve)

**Arquivo:** `src/components/layout/AppShell.tsx:32`

**Issue:** O spec e o screen contract especificam classes de `<main>` como `flex-1 px-4 py-4 pb-20 md:pb-4`. A implementação coloca `pt-14` no wrapper `<div className="flex flex-1 pt-14">` ao invés de usar `pt-14` no `<main>`. Funcionalmente correto (o header fixo de `h-14` é compensado), mas **diverge da arquitetura de referência** do spec — o spec mostra o `<main>` como único elemento que gerencia seu próprio espaçamento vertical. A abordagem atual é defensável, mas quebra a semântica esperada e pode causar confusão em implementações futuras quando `SideNav` tiver height dinâmica.

**Fix sugerido:** Mover `pt-14` para o `<main>`:
```tsx
<div className="flex flex-1">
  <SideNav />
  <main id="main-content" tabIndex={-1}
    className="flex-1 px-4 pt-14 py-4 pb-20 md:pb-4">
```
> Nota: a abordagem atual (`pt-14` no wrapper) também funciona corretamente — o ajuste é de conformidade arquitetural, não de bug.

---

### WR-05 — `Header`: slot direito sem `tabIndex` ou elemento semântico (WARNING cosmético)

**Arquivo:** `src/components/layout/Header.tsx:18`

**Issue:** O slot direito é `<div aria-label="Ações do usuário" />` — um `<div>` vazio com `aria-label`. Um `aria-label` em elemento não-interativo e não-landmark é ignorado por leitores de tela e inválido semanticamente (per ARIA spec: `aria-label` em `div` sem `role` não tem efeito). Não causa problemas agora (está vazio), mas é um antipadrão que PRD-01 herdará.

**Fix:** Mudar para `<div aria-hidden="true" />` enquanto estiver vazio, ou remover o atributo. PRD-01 adicionará o componente real com `aria-label` no elemento correto.

---

## Checklist de Conformidade

### Spec TASK-11

| Critério | Status | Observação |
|---|---|---|
| `AppShell` com Header + SideNav + BottomNav | ✅ | Implementado corretamente |
| `AuthGuard` — máquina de estados completa | ✅ | Todos os 6 estados cobertos |
| `LoadingScreen` com `animate-spin` + `motion-reduce` | ✅ | Conforme spec §3.7 e §6.5 |
| `PendingApprovalScreen` com botão "Sair" | ✅ | Variante `outline` conforme screen |
| `BlockedScreen` com botão "Sair" | ✅ | Variante `destructive` conforme screen |
| `(app)/layout.tsx` com `"use client"` | ✅ | Correto |
| `(auth)/layout.tsx` com guarda inversa | ✅ | Parcialmente (ver WR-02) |
| Root `page.tsx` redireciona para `/home` | ✅ | Usa `redirect()` server-side — correto |
| Estrutura de rotas completa (9 rotas) | ✅ | Todos os placeholders criados |
| Skip link no `AppShell` | ✅ | `sr-only focus:not-sr-only` conforme spec §6.1 |
| `useRouter().push()` em `useEffect` (não `redirect()`) | ✅ | Correto em Client Components |
| Sem `any`, sem estilos inline, sem hex hardcoded | ✅ | Verificado por grep |
| `tsc --noEmit` 0 erros | ✅ | Passou |
| `npm run lint` 0 erros | ✅ | Passou |
| `npm run build` sucesso | ✅ | 11 rotas geradas |

### Design System / Screen Contract

| Critério | Status | Observação |
|---|---|---|
| Tokens semânticos apenas (`bg-background`, `text-foreground` etc.) | ✅ | Sem hex, sem oklch literal |
| `BottomNav` `h-16`, `fixed bottom-0`, `md:hidden` | ✅ | Conforme spec |
| `SideNav` `w-16`, `sticky top-14`, `hidden md:flex` | ✅ | Conforme spec |
| `Header` `h-14`, `fixed top-0`, `z-50` | ✅ | Conforme spec |
| `<main>` `id="main-content"` `tabIndex={-1}` | ✅ | Conforme spec §6.1 |
| `max-w-4xl mx-auto` no conteúdo | ✅ | Implementado no wrapper interno |
| Tooltips no SideNav via Shadcn | ✅ | Base UI Tooltip, `TooltipProvider` no `Providers` |
| 5 itens de navegação corretos | ✅ | Home/Matches/Predictions/Rankings/Profile |
| `aria-current="page"` no item ativo | ✅ | Via `usePathname().startsWith()` |
| `text-primary` / `bg-sidebar-primary` no item ativo | ✅ | Conforme screen §6.3 e §7.3 |
| Ícones Lucide named import | ✅ | Correto |
| `role="banner"` no Header | ✅ | |
| `role="navigation"` em ambas as navs | ✅ | |
| `role="status"` + `aria-live="polite"` no LoadingScreen | ✅ | |
| `role="main"` em PendingApproval e Blocked | ✅ | |
| `motion-reduce:transition-none` nas transições de nav | ✅ | |

### Acessibilidade (Priority 1-2 — UI/UX Checklist)

| Item | Status |
|---|---|
| Skip link visível ao foco | ✅ |
| Tab order: skip link → Header → SideNav → main | ✅ (estrutural) |
| `aria-label` descritivo em itens de nav | ✅ |
| `aria-current="page"` no item ativo | ✅ |
| `aria-hidden="true"` em ícones decorativos | ✅ |
| Touch targets ≥ 44px BottomNav | ✅ (`min-h-[44px] min-w-[44px]` explícito) |
| Touch targets ≥ 44px SideNav | ⚠️ Implícito mas não explícito (WR-03) |
| Contraste: apenas tokens Shadcn (WCAG AA) | ✅ |
| Reduced motion no spinner | ✅ (`motion-reduce:animate-none`) |
| Foco ring nos itens interativos | ✅ (herda do tema Shadcn) |

---

## Revisão UI/UX — Pontuação por Pilar

| Pilar | Pontuação | Achado Principal |
|---|---|---|
| 1. Copywriting | 4/4 | Textos em pt-BR, específicos e contextuais |
| 2. Visuais | 4/4 | Hierarquia clara, tokens semânticos, ícones Lucide consistentes |
| 3. Cores | 4/4 | 100% tokens de tema; nenhum hex ou oklch literal |
| 4. Tipografia | 4/4 | Escala consistente com design system; 4 tamanhos, 3 pesos |
| 5. Espaçamento | 4/4 | Escala 4px Tailwind; pb-20/pb-4 mobile/desktop correto |
| 6. Experience Design | 3/4 | Loading/pending/blocked cobertos; signOut sem tratamento de erro (WR-01) |

**Total: 23/24**

---

## Top 3 Prioridades de Ajuste

1. **Tratar erro em `handleSignOut`** (WR-01) — Impacto direto ao usuário: sem feedback ao falhar o logout em rede instável. Fix: `try/catch` com fallback para toast no PRD-01.

2. **Adicionar `status === null` ao `(auth)/layout.tsx`** (WR-02) — Experiência confusa para usuários com perfil corrompido que veem a tela de login mesmo autenticados. Fix: adicionar guard extra antes do `return children`.

3. **Tornar explícito `min-h-[44px]` nos itens da SideNav** (WR-03) — Previne regressão de acessibilidade se padding for ajustado futuramente. Fix: adicionar as classes ao className da tag `<Link>`.

---

## Arquivos Revisados

| Arquivo | Status |
|---|---|
| `src/components/layout/AppShell.tsx` | ✅ aprovado (1 warning menor) |
| `src/components/layout/Header.tsx` | ✅ aprovado (1 warning cosmético) |
| `src/components/layout/BottomNav.tsx` | ✅ aprovado |
| `src/components/layout/SideNav.tsx` | ✅ aprovado (1 warning) |
| `src/components/layout/AuthGuard.tsx` | ✅ aprovado |
| `src/components/layout/LoadingScreen.tsx` | ✅ aprovado |
| `src/components/layout/PendingApprovalScreen.tsx` | ✅ aprovado (1 warning) |
| `src/components/layout/BlockedScreen.tsx` | ✅ aprovado (1 warning) |
| `src/components/layout/nav-items.ts` | ✅ aprovado |
| `src/components/layout/index.ts` | ✅ aprovado |
| `src/app/(app)/layout.tsx` | ✅ aprovado |
| `src/app/(auth)/layout.tsx` | ✅ aprovado (1 warning) |
| `src/app/page.tsx` | ✅ aprovado |
| `src/app/(app)/home/page.tsx` | ✅ aprovado |
| `src/app/(auth)/login/page.tsx` | ✅ aprovado |
| `src/app/(auth)/pending/page.tsx` | ✅ aprovado |
| `src/app/(app)/matches/page.tsx` | ✅ aprovado |
| `src/app/(app)/rankings/page.tsx` | ✅ aprovado |
| `src/components/ui/tooltip.tsx` | ✅ aprovado |
| `src/providers/index.tsx` | ✅ aprovado |

---

## Notas de Segurança

- Nenhuma secret ou credencial hardcoded detectada.
- `AuthGuard` nunca renderiza `{children}` antes de `loading === false && status === "approved"` — sem risco de FOUC de conteúdo protegido.
- `status === null` com `firebaseUser !== null` corretamente tratado como `<BlockedScreen />` no `AuthGuard` — comportamento fail-safe conforme spec §4 (T6).
- `redirect()` server-side usado apenas em `src/app/page.tsx` (Server Component) — correto. Client Components usam `useRouter().push()` em `useEffect`.

---

_Revisado em: 2026-06-05_
_Revisor: Claude (gsd-code-reviewer + gsd-ui-auditor)_
_Profundidade: deep_
