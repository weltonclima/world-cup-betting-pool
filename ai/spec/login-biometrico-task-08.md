# SPEC

## 1. Task id and title
- Task: TASK-08
- Title: Botão "Entrar com biometria" no login (com fallback e-mail+senha)

## 2. Objective
Adicionar a superfície de login biométrico na tela `(auth)/login`: um botão que
dispara a cerimônia WebAuthn de autenticação (TASK-07), troca o custom token
resultante por uma sessão Firebase + session cookie e deixa o `AuthLayout`
redirecionar. O formulário e-mail+senha permanece sempre visível (fallback).

## 3. In scope
1. **Orquestração client do login biométrico** (`src/services/webauthn.ts`):
   `loginWithPasskey(): Promise<string>` →
   `POST /api/auth/webauthn/login/options` → `startAuthentication({ optionsJSON })`
   (`@simplewebauthn/browser`) → `POST /api/auth/webauthn/login/verify` →
   retorna o `customToken`. Erros como `PasskeyError` pt-BR (reusar a classe
   existente); `NotAllowedError` → code `"cancelled"`.
2. **Sessão a partir do custom token** (`src/services/auth.ts`):
   `signInWithBiometricToken(customToken: string): Promise<void>` →
   `await authPersistenceReady` → `signInWithCustomToken(firebaseAuth, customToken)`
   → reusar o `mintSessionCookie` existente (M1: `getIdToken(true)` carrega o
   claim `role` fresco). **Não** navega (AuthLayout cuida).
3. **Hook de mutação** (`src/features/auth/` ou `src/features/passkeys/hooks`):
   `useBiometricLogin` (espelha `useRegisterPasskey`): `mutationFn` =
   `loginWithPasskey` → `signInWithBiometricToken`; `onError` trata `"cancelled"`
   como info neutra (não erro).
4. **Componente** `BiometricLoginButton` (`src/features/auth/`):
   - usa `usePasskeySupport` (reuso TASK-06): renderiza o botão só quando
     `supported === true`; `null` (resolvendo) → nada; `false` → nada (fallback
     e-mail+senha basta); WebView (A9) → nota "abrir no navegador" OU oculto.
   - acionado por gesto do usuário (req. iOS Safari); estados loading/erro.
5. **Integração na página** `src/app/(auth)/login/page.tsx`: inserir o botão
   biométrico **abaixo** do `LoginForm`, com separador "ou". **M3: nunca** esconder
   nem substituir o `LoginForm`.
6. Testes (ver §9).

## 4. Out of scope
- Route Handlers de login (TASK-07, prontos).
- Registro/gestão de passkey (TASK-05/06).
- Alterar o fluxo e-mail+senha existente (`signIn`) ou o `AuthLayout`.
- Recuperação de dispositivo perdido (fallback e-mail+senha já cobre).
- Expor `mintSessionCookie` publicamente — encapsular via `signInWithBiometricToken`.

## 5. Main technical areas involved
- `src/services/webauthn.ts` (nova `loginWithPasskey`)
- `src/services/auth.ts` (nova `signInWithBiometricToken`; reusa `mintSessionCookie` privado)
- `src/features/auth/BiometricLoginButton.tsx` (novo)
- `src/features/auth/hooks/useBiometricLogin.ts` (novo) ou em `features/passkeys/hooks`
- `src/app/(auth)/login/page.tsx` (integra o botão)
- reuso: `usePasskeySupport`, `PasskeyError`, `PasskeyUnsupportedNotice`/padrão de nota
- `@simplewebauthn/browser` `startAuthentication`; `firebase/auth` `signInWithCustomToken`

## 6. Business rules and behavior
- **M3 (obrigatório):** o formulário e-mail+senha NUNCA é escondido/substituído. O
  botão biométrico é aditivo. Sem passkey/sem suporte → só o fallback aparece.
- **Gesto do usuário:** a cerimônia (`startAuthentication`) roda só no clique (iOS
  Safari exige ativação por gesto; não disparar em `useEffect`/autofill silencioso).
- **Cancelamento:** `NotAllowedError` (cancelou/timeout) = estado **neutro** (toast
  info), não erro alarmante.
- **Sem navegação manual:** sucesso → `signInWithCustomToken` + cookie → o
  `AuthLayout` redireciona aprovados → `/home` (mesmo contrato do `signIn`).
- **M1:** o `role` precisa estar fresco no cookie → `mintSessionCookie` usa
  `getIdToken(true)`; o login biométrico reusa esse caminho.
- **A9 (WebView/in-app browser):** detectado por `usePasskeySupport.isWebView` →
  orientar "abrir no navegador" (ou ocultar o botão); nunca quebrar o fallback.
- **Erros genéricos pt-BR:** nunca expor detalhe técnico WebAuthn nem distinguir
  enumeração (alinhado à TASK-07).

## 7. Contracts and interfaces
```ts
// services/webauthn.ts
loginWithPasskey(): Promise<string>            // resolve customToken; lança PasskeyError

// services/auth.ts
signInWithBiometricToken(customToken: string): Promise<void>

// features/auth/hooks/useBiometricLogin.ts
useBiometricLogin(): UseMutationResult<void, Error, void>
```
- `loginWithPasskey`: `options` falha (`!ok`) → `PasskeyError("Não foi possível
  entrar com biometria.")`; `startAuthentication` `NotAllowedError` →
  `PasskeyError(..., "cancelled")`; `verify` `!ok` → `PasskeyError` genérico.
- Endpoints consumidos: `POST /api/auth/webauthn/login/options` (sem body) e
  `POST /api/auth/webauthn/login/verify` (`{ response: <AuthenticationResponseJSON> }`)
  → `{ verified, customToken }`.

## 8. Data and persistence impact
Nenhum. Só consome endpoints e o fluxo de session cookie existente
(`POST /api/auth/session` via `mintSessionCookie`).

## 9. Required tests
1. **`loginWithPasskey` (service):** options→startAuthentication→verify retorna o
   `customToken`; `NotAllowedError` → `PasskeyError` code `"cancelled"`; `options`
   ou `verify` `!ok` → `PasskeyError` genérico. (mock `fetch` + `startAuthentication`.)
2. **`signInWithBiometricToken` (service):** chama `signInWithCustomToken` com o
   token e dispara o mint do cookie; aguarda `authPersistenceReady` antes.
3. **`BiometricLoginButton` (component):** renderiza só com `supported===true`;
   oculto/nota quando `false`/`null`/WebView; clique dispara a mutação; estado
   loading desabilita o botão; cancelamento não vira toast de erro.
4. **Regressão M3:** `LoginForm` (e-mail+senha) continua presente na página
   independentemente do suporte a biometria.

## 10. Acceptance criteria
- Botão biométrico visível em device com autenticador de plataforma; login E2E:
  clique → biometria → custom token → sessão → redirect via AuthLayout.
- Fallback e-mail+senha sempre presente (M3).
- Cancelamento neutro; erros pt-BR genéricos.
- `role` fresco no cookie (admins seguem admin após login biométrico — M1).
- WebView tratado (A9). `vitest run` verde nos testes acima.

## 11. Constraints
- Não esconder/substituir o `LoginForm` (M3).
- `mintSessionCookie` permanece privado; reuso via `signInWithBiometricToken`.
- Cerimônia só por gesto do usuário.
- Mobile-first (prioridade Android/iOS): touch targets ≥ 44px, botão proeminente.
- Sem navegação manual no sucesso (contrato do AuthLayout).
- pt-BR; nunca expor detalhe técnico WebAuthn.
- `"use client"` nos componentes/hooks; serviços agnósticos de UI.

## 12. Execution cost profile
- tdd: N/A (UI; lógica de service coberta por testes de service)
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/high

## 13. Frontend indicator
- is_frontend: true
- reason: cria `BiometricLoginButton` e integra na página de login (interação,
  estados, layout). → `/ui-spec` + `/patterns:nextjs` + `/ui-review`.

## 14. Open questions
Nenhuma bloqueadora. Decisão de UI (nota de WebView vs ocultar o botão) é detalhe
do `/ui-spec`. M1/M3 resolvidos acima.
