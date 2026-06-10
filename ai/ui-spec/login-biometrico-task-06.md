# UI-SPEC — Tela Segurança / Biometria (TASK-06)

> Design auto-contido. `/implement` e `/ui-review` consomem ESTE artefato — não reinvocar ui-ux-pro-max. House rules do projeto (componentes existentes) têm precedência; tokens reais de `globals.css`.

## 1. Identidade
- Name: `SecurityPage` + slice `features/passkeys`
- Type: Screen (com lista, fluxo de registro, diálogo de remoção)
- Tech: Next.js 15 (App Router) + React 19 + Tailwind v4 + shadcn/ui + sonner + lucide
- Complexity: Standard+ (múltiplos estados: empty / unsupported / webview / loading / error / success)

## 2. Estrutura visual (mobile-first, 1 coluna)
```
(app)/profile/seguranca  — dentro do layout de perfil existente
┌─ ProfileSubHeader "Segurança" (back) ───────────────┐
│                                                      │
│  SECTION "Login por biometria"  (label uppercase)    │
│  ┌────────────────────────────────────────────────┐ │
│  │ [shield]  Biometria neste dispositivo          │ │  ← AddPasskeyButton (primary CTA)
│  │           Face ID / Touch ID / digital      →  │ │     (card row, accent verde)
│  └────────────────────────────────────────────────┘ │
│  helper: "Entre mais rápido usando a biometria do    │
│           seu celular. Sua senha continua válida."   │
│                                                      │
│  SECTION "Dispositivos cadastrados"                  │
│  ┌────────────────────────────────────────────────┐ │
│  │ [fingerprint] iPhone do Welton                 │ │  ← PasskeyRow
│  │              Cadastrado 10/06/2026      [🗑]    │ │     remove = ícone à direita
│  └────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │ [fingerprint] Galaxy S23           [🗑]        │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘

Estado vazio (sem passkeys): seção "Dispositivos" some;
mostra EmptyState abaixo do CTA.

Estado sem suporte / WebView: CTA desabilitado/oculto +
callout informativo (ver §9).
```

## 3. Component breakdown
| Component | Type | Props | States | Notes |
|---|---|---|---|---|
| `SecurityPage` | Screen | — | — | rota `(app)/profile/seguranca`; usa `ProfileSubHeader title="Segurança"` |
| `PasskeyManager` | Container client | — | support-resolved/loading | decide CTA vs notice; orquestra hooks |
| `AddPasskeyButton` | Button (card row) | `disabled`, `loading`, `onClick` | default/hover/active/focus/disabled/loading | **primary CTA**; estilo card row verde-accent |
| `PasskeyList` | List | `items` | populated/empty | 1 coluna, `gap-2` |
| `PasskeyRow` | Card row | `passkey`, `onRemove` | default/hover/focus | label + data; botão remover (ícone, ≥44px) |
| `RemovePasskeyDialog` | shadcn `AlertDialog` | `open`, `passkeyLabel`, `onConfirm`, `pending` | open/pending | destrutivo; confirm obrigatório |
| `PasskeyEmptyState` | Block | — | — | ícone + "Nenhum dispositivo cadastrado ainda." |
| `PasskeyUnsupportedNotice` | Callout | `reason: "unsupported"\|"webview"` | — | info pt-BR + orientação |

## 4. Interaction states (por elemento)
| Element | Default | Hover | Active | Focus | Disabled | Loading | Error |
|---|---|---|---|---|---|---|---|
| AddPasskeyButton | `bg-card border-border`, ícone em `bg-primary/10 text-primary` | `hover:bg-accent` | `scale-[0.99]` | `ring-2 ring-ring` | `opacity-50 cursor-not-allowed` | spinner + "Aguardando biometria…" (botão disabled, `aria-busy`) | toast erro; botão volta a default |
| PasskeyRow | `bg-card border-border` | `hover:bg-accent/50` | — | `ring-2 ring-ring` (no botão remover) | — | — | — |
| Remove (ícone) | `text-muted-foreground` | `hover:text-destructive` | — | `ring-2 ring-ring` | durante pending: `opacity-50` | spinner no dialog | toast erro |
| Dialog confirm | `bg-destructive text-white` | escurece | — | ring | `pending` → disabled+spinner | — | toast |

## 5. Data binding
| Field | Source | Transform | Update trigger |
|---|---|---|---|
| lista de passkeys | `usePasskeys()` → `listMyPasskeys(uid)` (read client Firestore) | ordenar por `createdAt` desc; formatar data pt-BR (`date-fns`) | mount, após registro/remoção (invalidate) |
| suporte | `usePasskeySupport()` → `browserSupportsWebAuthn()` + `platformAuthenticatorIsAvailable()` + heurística WebView | `{ supported, isWebView }` | mount |
| registrar | `useRegisterPasskey()` → `registerPasskey(deviceLabel?)` | — | clique no CTA (gesto) |
| remover | `useRevokePasskey()` → `revokePasskey(credentialId)` | — | confirmar no dialog |

## 6. Responsive
| Breakpoint | Layout | Notas |
|---|---|---|
| base (mobile, 375px) | 1 coluna, container do layout de perfil (`max-w-sm`/`mx-auto` herdado), `px-4` | alvo principal |
| ≥768px | mesma 1 coluna centralizada (sem mudança estrutural — tela simples) | não esticar rows |
| landscape | rolável, sem overflow horizontal | `min-h-dvh` herdado |

## 7. Acessibilidade
- [ ] Touch targets ≥ **48px** (rows `min-h-[56px]`; botão remover com `size-11`/hitarea ≥44px).
- [ ] `AddPasskeyButton`: `<button>` semântico, `aria-busy` no loading, label textual visível (não só ícone).
- [ ] Botão remover: ícone + `aria-label="Remover {deviceLabel}"` (icon-only precisa label).
- [ ] Foco visível: `focus-visible:ring-2 ring-ring` em todos os interativos (padrão do projeto).
- [ ] `RemovePasskeyDialog`: foco move pro dialog; Esc/Cancelar fecham; foco retorna ao gatilho.
- [ ] Toasts (sonner) `aria-live="polite"`, não roubam foco, auto-dismiss 3–5s.
- [ ] Contraste ≥ 4.5:1 (tokens `foreground`/`muted-foreground` sobre `card` já atendem).
- [ ] `color-not-only`: estados (erro/sucesso) com ícone+texto, não só cor.
- [ ] `prefers-reduced-motion`: spinner/scale respeitam `motion-reduce:*`.

## 8. Animation
| Trigger | Animation | Duration | Easing | Notas |
|---|---|---|---|---|
| press no CTA/row | `scale-[0.99]` | 150ms | ease-out | `transition-transform`, `motion-reduce:transform-none` |
| hover row/CTA | `bg` transition | 150ms | ease | `transition-colors` (padrão) |
| dialog abrir | fade+scale do shadcn | ~200ms | spring | nativo do `AlertDialog` |
| loading | spinner `animate-spin` | — | linear | `motion-reduce:animate-none` |

## 9. Edge cases
| Case | Condição | Comportamento |
|---|---|---|
| Empty | sem passkeys | seção "Dispositivos" oculta; `PasskeyEmptyState` ("Nenhum dispositivo cadastrado ainda.") sob o CTA |
| Unsupported | `browserSupportsWebAuthn()` false **ou** sem platform authenticator | CTA **desabilitado** + `PasskeyUnsupportedNotice reason="unsupported"`: "Seu dispositivo/navegador não suporta biometria. Use e-mail e senha." |
| WebView/in-app | heurística user-agent (Instagram/FB/WhatsApp in-app) | CTA oculto + `PasskeyUnsupportedNotice reason="webview"`: "Abra o app no navegador (Chrome/Safari) para ativar a biometria." |
| Loading lista | fetch em curso | skeleton de 2 rows (`animate-pulse`, `motion-reduce` estático) |
| Erro lista | read falha | callout de erro + ação "Tentar novamente" |
| Registro: cancelado | `NotAllowedError` | **neutro**: toast info "Registro cancelado." (não erro alarmante) |
| Registro: já existe | `InvalidStateError` / 409 | toast "Este dispositivo já está cadastrado." |
| Registro: sucesso | 201 | toast sucesso "Biometria ativada!" + lista atualiza |
| Remoção: sucesso | 200 | toast "Dispositivo removido." + row some |
| Remoção: erro | 4xx/5xx | toast genérico pt-BR; row permanece |
| Overflow label | deviceLabel longo | `truncate` (padrão do projeto) |

## 10. Tech-specific notes (house rules — Next.js)
- `"use client"` em todos os componentes do slice (interação + hooks).
- React Query: `usePasskeys` (`queryKey:["passkeys",uid]`, `enabled: !!uid`); mutations `useRegisterPasskey`/`useRevokePasskey` invalidam a query no sucesso.
- Estilo: **reusar a linguagem visual de `ProfileMenuItem`/`SettingsMenu`** (card row `min-h-[56px] rounded-lg border border-border bg-card px-4 py-3 gap-3`, seções com `<h2 class="text-xs uppercase tracking-wide text-muted-foreground">`). NÃO criar novo padrão de card.
- CTA usa o mesmo card row, mas ícone em `bg-primary/10 text-primary` (destaque verde) para sinalizar ação primária.
- shadcn: `AlertDialog` para a confirmação destrutiva (API confirmada via context7 na implementação).
- Ícones lucide: `ShieldCheck`/`Fingerprint` (CTA/rows), `Trash2` (remover). Sem emoji.
- Tailwind only (sem inline). Tokens semânticos (`primary`,`card`,`muted-foreground`,`destructive`,`ring`,`accent`,`border`) — sem hex cru.
- Item de entrada: novo `ProfileMenuItem` em `SettingsMenu` (seção "Geral" ou nova "Segurança") `href="/profile/seguranca"` ícone `ShieldCheck`.

## 11. Files to create/modify
```
src/
├── app/(app)/profile/seguranca/page.tsx                    (novo)
├── features/passkeys/
│   ├── components/
│   │   ├── PasskeyManager.tsx
│   │   ├── AddPasskeyButton.tsx
│   │   ├── PasskeyList.tsx        (+ PasskeyRow)
│   │   ├── RemovePasskeyDialog.tsx
│   │   ├── PasskeyEmptyState.tsx
│   │   ├── PasskeyUnsupportedNotice.tsx
│   │   ├── __tests__/...
│   │   └── index.ts
│   ├── hooks/
│   │   ├── usePasskeys.ts
│   │   ├── useRegisterPasskey.ts
│   │   ├── useRevokePasskey.ts
│   │   ├── usePasskeySupport.ts
│   │   └── index.ts
│   └── index.ts
├── services/webauthn.ts                                    (novo, client)
├── server/auth/webauthnCredentialStore.ts                  (+deleteCredential)
├── app/api/auth/webauthn/credentials/[credentialId]/route.ts (novo, DELETE)
└── features/profile/components/SettingsMenu.tsx            (novo item)
```

## 12. Acceptance criteria (UI)
- [ ] Mobile (375px) renderiza sem overflow horizontal; rows ≥56px.
- [ ] Todos os estados implementados: empty, unsupported, webview, loading, error, success.
- [ ] CTA só dispara em gesto de clique; `aria-busy` no loading.
- [ ] Remoção exige confirmação (AlertDialog); botão remover tem `aria-label`.
- [ ] Toasts pt-BR, `aria-live`, auto-dismiss; cancelamento = neutro.
- [ ] Foco visível em todos interativos; reduced-motion respeitado.
- [ ] Visual consistente com `SettingsMenu`/`ProfileMenuItem` (mesmos tokens/cards).
- [ ] Fallback e-mail+senha nunca escondido/afetado.
```
