# UI-SPEC — TASK-08 · Botão "Entrar com biometria"

> Fonte: `ai/spec/login-biometrico-task-08.md`. Stack: **Next.js + shadcn/ui +
> Tailwind**. House rules (componentes passkey existentes) > ui-ux-pro-max. Artefato
> self-contained — `/implement` e `/ui-review` NÃO re-invocam ui-ux-pro-max.

## 1. Identity
- Name: `BiometricLoginButton`
- Type: Component (CTA secundário) + integração na `LoginPage`
- Tech: Next.js (App Router, client component), shadcn `Button`, lucide-react
- Complexity: Standard

## 2. Visual Structure (na auth-card, abaixo do LoginForm)
```
auth-card (rounded-t-3xl, bg-card, px-6)
┌──────────────────────────────────────────┐
│  [ LoginForm: e-mail + senha + Entrar ]   │  ← M3: sempre visível
│                                            │
│  ───────────────  ou  ───────────────      │  ← divisor (só se botão visível)
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │ (digital)  Entrar com biometria       │ │  ← variant=outline, h-11, w-full
│  └──────────────────────────────────────┘ │
│                                            │
│  [ WebView? nota "abrir no navegador" ]    │  ← A9, substitui o botão
│                                            │
│  Não tem conta? Cadastre-se                │
└──────────────────────────────────────────┘
```
Render condicional (de `usePasskeySupport`):
- `supported === null` → renderiza **nada** (resolvendo; sem flash).
- `supported === false` → renderiza **nada** (fallback e-mail+senha basta; não poluir
  login com aviso de não-suporte).
- `isWebView === true` → renderiza **`PasskeyUnsupportedNotice reason="webview"`** no
  lugar do botão (orienta abrir no Chrome/Safari). Sem divisor.
- `supported === true && !isWebView` → divisor "ou" + botão.

## 3. Component Breakdown
| Component | Type | Props | States | Notes |
|---|---|---|---|---|
| `BiometricLoginButton` | client wrapper | — (usa hooks internamente) | hidden / default / loading / webview | decide visibilidade; renderiza divisor + botão |
| `OrDivider` (inline) | presentational | — | — | linha + label "ou" centralizado |
| shadcn `Button` | UI | `variant="outline"`, `disabled`, `aria-busy` | default/loading/focus/disabled | CTA secundário |
| `Fingerprint` (lucide) | icon | `size={18}`, `aria-hidden` | — | ícone do botão (default) |
| `LoaderCircle` (lucide) | icon | `size={18}` `animate-spin motion-reduce:animate-none` | loading | substitui o ícone no loading |
| `PasskeyUnsupportedNotice` | reuse TASK-06 | `reason="webview"` | — | A9 |

## 4. Interaction States
| Element | Default | Active/Press | Focus | Disabled | Loading | Cancelled | Error |
|---|---|---|---|---|---|---|---|
| Botão biométrico | `variant=outline`, ícone `Fingerprint` + "Entrar com biometria" | leve `active:opacity-90` (sem shift de layout) | `focus-visible:ring-2 ring-ring` (default shadcn) | `opacity-50 cursor-not-allowed` | spinner + "Entrando com biometria…", `disabled`, `aria-busy` | — (não é estado do botão) | — |
| Feedback global | — | — | — | — | botão desabilitado | `toast.info` neutro (cancelou/timeout) | `toast.error` pt-BR genérico |

Regras:
- **Hierarquia (primary-action):** o "Entrar" (primário, `variant=default`, verde) é o
  único CTA primário. Biométrico = `variant="outline"` → secundário-mas-proeminente,
  não compete.
- **Cancelamento = neutro:** `NotAllowedError` → `toast.info("Login por biometria
  cancelado.")`. NUNCA `toast.error`.
- **Erro real:** mensagem pt-BR genérica (`PasskeyError.message`), sem detalhe técnico.
- **Gesto:** a cerimônia roda só no `onClick` (req. iOS Safari) — nunca em `useEffect`.

## 5. Data Binding
| Field | Source | Transform | Update Trigger |
|---|---|---|---|
| `supported`, `isWebView` | `usePasskeySupport()` | — | mount (async) |
| `isPending` | `useBiometricLogin()` (React Query mutation) | — | clique → mutação |
| redirect pós-login | `AuthLayout` (estado de auth) | — | `signInWithCustomToken` + cookie |

Sem navegação manual (contrato do AuthLayout, idêntico ao `signIn`).

## 6. Responsive (mobile-first)
| Breakpoint | Layout |
|---|---|
| base (mobile, prioridade) | botão `w-full h-11`; dentro de `max-w-sm` da auth-card; touch target ≥44px (h-11 = 44px) |
| ≥ sm | mantém `max-w-sm` centralizado (sem mudança estrutural) |

## 7. Accessibility
- [x] Touch target ≥44px (`h-11`).
- [x] `focus-visible:ring-2 ring-ring` (default do shadcn Button) — não remover.
- [x] `Fingerprint`/`LoaderCircle` com `aria-hidden="true"`; texto do botão é o rótulo.
- [x] `aria-busy={isPending}` no loading; botão `disabled` impede duplo disparo.
- [x] Toasts (sonner) `aria-live` polite (não roubam foco).
- [x] Contraste: `variant=outline` (texto `foreground` sobre `card`) ≥4.5:1; divisor
      `border` visível em light/dark.
- [x] `motion-reduce:animate-none` no spinner.
- [x] Ordem de leitura: form e-mail+senha → divisor → botão biométrico (fallback primeiro).

## 8. Animation
| Trigger | Animation | Duration | Easing |
|---|---|---|---|
| loading | spinner `animate-spin` (transform) | contínuo | linear (spinner) |
| press | `active:opacity-90` (opacity, sem reflow) | ~150ms | ease-out |
Nada que cause CLS/reflow.

## 9. Edge Cases
| Case | Condition | Behavior |
|---|---|---|
| Sem suporte | `supported===false` | oculta botão+divisor; fallback e-mail+senha |
| Resolvendo | `supported===null` | nada (sem flash) |
| WebView (A9) | `isWebView===true` | `PasskeyUnsupportedNotice reason="webview"` |
| Cancelou | `NotAllowedError` | `toast.info` neutro; botão volta ao default |
| Sem credencial / falha | `verify`/`options` !ok | `toast.error` genérico pt-BR |
| Duplo clique | mutação em andamento | botão `disabled` (idempotente) |

## 10. Tech-Specific Notes (patterns/nextjs — house rules)
- `"use client"` no componente e no hook.
- Botão = shadcn `Button` existente (`@/components/ui/button`), `variant="outline"
  className="h-11 w-full"`. Não criar variante nova.
- Hook `useBiometricLogin` espelha `useRegisterPasskey` (React Query `useMutation` +
  sonner toast; `"cancelled"` → `toast.info`).
- Reusar `usePasskeySupport` e `PasskeyUnsupportedNotice` da TASK-06 (não duplicar).
- Ícone `Fingerprint` (lucide-react). Spinner `LoaderCircle` (consistente com
  `AddPasskeyButton`/`LoginForm`).
- Divisor "ou": `flex items-center gap-3 text-xs text-muted-foreground` com dois
  `<span className="h-px flex-1 bg-border" />` ladeando o label.
- pt-BR; serviços (`loginWithPasskey`/`signInWithBiometricToken`) sem dependência de UI.

## 11. Files to Create/Modify
```
src/
├── features/auth/
│   ├── BiometricLoginButton.tsx            (novo)
│   └── hooks/useBiometricLogin.ts          (novo)
├── services/
│   ├── webauthn.ts                         (add loginWithPasskey)
│   └── auth.ts                             (add signInWithBiometricToken)
└── app/(auth)/login/page.tsx               (integra <BiometricLoginButton/> após <LoginForm/>)
test:
├── features/auth/__tests__/BiometricLoginButton.test.tsx   (novo)
└── services/__tests__/webauthn.login.test.ts               (novo)
```

## 12. Acceptance Criteria (UI)
- [ ] Botão só aparece com `supported===true && !isWebView`; WebView mostra a nota.
- [ ] Fallback e-mail+senha SEMPRE presente (M3), independente do suporte.
- [ ] CTA primário "Entrar" permanece o único primário; biométrico = outline.
- [ ] Loading desabilita + spinner + texto; cancelamento = info neutro; erro = toast pt-BR.
- [ ] Touch ≥44px, focus-visible ring, `motion-reduce` no spinner.
- [ ] Sem navegação manual; AuthLayout redireciona.
- [ ] Sem CLS; divisor visível em light/dark.
