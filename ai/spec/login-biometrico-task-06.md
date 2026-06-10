# SPEC

## 1. Task id and title
- Task: TASK-06
- Title: UI de gestão de passkeys (enrollment + revogação)

## 2. Objetivo
Tela onde o usuário aprovado **registra a biometria do device** (passkey) e **lista/remove** os passkeys cadastrados. Mobile-first (Android/iOS via navegador). Inclui o endpoint de **revogação** (DELETE via Admin SDK, com ownership) que faltava, a leitura da lista (read client), o serviço client do fluxo WebAuthn (`@simplewebauthn/browser`), detecção de disponibilidade e tratamento de WebView/in-app browser (A9). Fallback e-mail+senha nunca é afetado.

## 3. In scope
- **Endpoint de revogação** `DELETE /api/auth/webauthn/credentials/[credentialId]`:
  - `requireApprovedUser`;
  - busca a credencial (`getCredentialById`) → 404 se inexistente; **ownership: `cred.uid === uid` da sessão** senão 404 (não revela existência alheia);
  - deleta via Admin SDK (`deleteCredential`); 200/204.
- **Store:** `deleteCredential(credentialId)` em `webauthnCredentialStore` (Admin SDK).
- **Serviço client** `src/services/webauthn.ts`:
  - `registerPasskey(deviceLabel?)`: `POST /register/options` → `startRegistration({ optionsJSON })` → `POST /register/verify { response, deviceLabel }`. Mapeia `InvalidStateError` (já registrado) e `NotAllowedError` (cancelado/timeout) para mensagens pt-BR; outros erros → mensagem genérica.
  - `listMyPasskeys(uid)`: leitura client (Firestore Client SDK) de `webauthn_credentials where uid == uid` (Rules permitem own-read, TASK-03).
  - `revokePasskey(credentialId)`: `DELETE` no endpoint acima.
- **Detecção de suporte:** `browserSupportsWebAuthn()` + `platformAuthenticatorIsAvailable()` → esconder/desabilitar o botão de adicionar quando indisponível; orientar quando em WebView/in-app browser (A9).
- **UI (feature slice `src/features/passkeys/`):**
  - lista de passkeys (rótulo do device, data de criação, último uso se houver) com ação de remover (confirmação);
  - botão "Ativar biometria neste dispositivo" (acionado por **gesto do usuário** — req. iOS Safari) com input/escolha de rótulo;
  - estados loading/erro/sucesso/empty (toast pt-BR);
  - hooks React Query: `usePasskeys` (lista), `useRegisterPasskey`, `useRevokePasskey`, `usePasskeySupport`.
- **Rota** `src/app/(app)/profile/seguranca/page.tsx` + item "Segurança / Biometria" no `SettingsMenu`.

## 4. Out of scope
- Endpoints de **login** biométrico/custom token e HR-01 single-use (TASK-07).
- Botão de login na tela de login (TASK-08).
- Endpoints de registro (TASK-05, reuso).
- Alterar schema/rules/config (reuso).

## 5. Áreas técnicas envolvidas
- `src/app/api/auth/webauthn/credentials/[credentialId]/route.ts` (novo, DELETE).
- `src/server/auth/webauthnCredentialStore.ts` (+`deleteCredential`).
- `src/services/webauthn.ts` (novo, client).
- `src/features/passkeys/{components,hooks}` (novo slice) + barrel.
- `src/app/(app)/profile/seguranca/page.tsx` (novo) + `src/features/profile/components/SettingsMenu.tsx` (novo item).
- Reuso: `requireApprovedUser`, endpoints TASK-05, `@simplewebauthn/browser`, `firebase` client, React Query, shadcn (Dialog/Button), sonner, lucide.

## 6. Regras e comportamento
- **Revogação só do próprio passkey:** ownership obrigatório no servidor (`cred.uid === sessão`); deletar credencial alheia = negado (404, sem vazar existência). É a defesa real — a UI não é confiável.
- **Disponibilidade:** se `browserSupportsWebAuthn()` falso ou sem autenticador de plataforma → não oferecer registro; mensagem clara. Em **WebView/in-app browser** (Instagram/WhatsApp) onde WebAuthn falha → orientar "abrir no navegador" (A9).
- **Gesto do usuário:** `startRegistration` só dentro de handler de clique (req. iOS Safari).
- **Cancelamento** (`NotAllowedError`) = estado neutro (não erro alarmante).
- **Mensagens pt-BR**, nunca expor detalhe técnico do WebAuthn.
- **Fallback preservado:** esta tela é opcional; e-mail+senha continua o caminho primário e de recuperação.
- Mobile-first: touch targets ≥ 44–48px, layout de celular.

## 7. Contratos e interfaces
- `DELETE /api/auth/webauthn/credentials/[credentialId]` → 200 `{ success: true }` | 404 (inexistente/alheia) | 401/403 (auth). Node runtime, force-dynamic.
- `webauthnCredentialStore.deleteCredential(credentialId: string): Promise<void>`.
- `services/webauthn.ts`:
  - `registerPasskey(deviceLabel?: string): Promise<void>` (lança erro tipado/mapeado em falha);
  - `listMyPasskeys(uid: string): Promise<WebauthnCredential[]>`;
  - `revokePasskey(credentialId: string): Promise<void>`.
- `@simplewebauthn/browser` v13.3 (context7): `startRegistration({ optionsJSON })`, `browserSupportsWebAuthn()`, `platformAuthenticatorIsAvailable()`.
- Endpoints de registro (TASK-05) chamados via `fetch` (Origin enviado pelo browser; cookies same-origin).

## 8. Impacto de dados e persistência
- Deleta docs de `webauthn_credentials` (via Admin SDK; Rules negam write client). Lê própria coleção (client). Sem migração/índice novo (índice `uid+createdAt` da TASK-03 cobre a listagem).

## 9. Testes obrigatórios
- **Endpoint DELETE (segurança — cobrir bem):** 401 sem sessão; 403 não-approved; **404 ao tentar revogar credencial de OUTRO usuário** (ownership); 404 inexistente; sucesso deleta a própria.
- **Serviço:** `registerPasskey` orquestra options→startRegistration→verify; `InvalidStateError`/`NotAllowedError` mapeados; `revokePasskey` chama DELETE.
- **Detecção:** `usePasskeySupport` reflete `browserSupportsWebAuthn`/`platformAuthenticatorIsAvailable`.
- **Componentes:** lista renderiza passkeys; empty state; botão escondido/desabilitado sem suporte; fluxo de remoção pede confirmação.
- Vitest + Testing Library (jsdom). Mock de `@simplewebauthn/browser`, services, fetch. Verificar via JSON real.

## 10. Critérios de aceite
- Usuário aprovado registra passkey (biometria) e vê na lista; remove com confirmação.
- Revogação server-side aplica ownership (não remove de terceiros) — provado por teste.
- Botão escondido/desabilitado sem suporte; WebView orientado.
- Cancelamento tratado como neutro; mensagens pt-BR; sem vazar detalhe técnico.
- Fallback e-mail+senha intacto.
- `typecheck`, `lint`, testes passam. Mobile-first (validado no `/ui-review` + device real no `/local-env`).

## 11. Constraints
- TypeScript strict, sem `any`. Tailwind (sem inline). pt-BR.
- Ownership da revogação é server-side (UI não confiável).
- `import "server-only"` no endpoint/store; `@simplewebauthn/browser` só no client.
- Reusar endpoints TASK-05 e `requireApprovedUser`/store.
- Não tocar no login (TASK-07/08).

## 12. Execution cost profile
- tdd: n/a (UI; lógica de segurança da revogação coberta no /test)
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/high

## 13. Frontend indicator
- is_frontend: true
- reason: Cria a tela de Segurança/Biometria (lista de passkeys, botão de ativar, diálogo de remoção), com estados de interação, em `src/features/passkeys/` + rota `(app)/profile/seguranca`. (Inclui um endpoint DELETE de apoio, mas o núcleo é UI.)

## 14. Open questions
- Rótulo do device: input livre no registro vs auto ("Dispositivo"/ua-derived). Proposto **input opcional com default**; `/ui-spec` decide a UX exata.
- Local na navegação: nova seção "Segurança" no `SettingsMenu` (proposto) vs dentro de "Editar Perfil". `/ui-spec` confirma.
- Listagem: read client-direto (proposto, espelha predictions) vs GET endpoint. Mantido client-direto (Rules permitem own-read; chave pública não é segredo).
