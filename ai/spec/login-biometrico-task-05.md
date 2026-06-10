# SPEC

## 1. Task id and title
- Task: TASK-05
- Title: Route Handlers de registro de passkey (enrollment)

## 2. Objetivo
Dois endpoints que permitem um usuário **autenticado e aprovado** registrar um passkey (biometria do device) na sua conta: um gera as opções de registro (challenge), o outro verifica a attestation e **grava a credencial via Admin SDK**. Núcleo de segurança: attestation mal verificada = credencial forjada. Mantém as 4 camadas (sessão válida + `approved`), challenge assinado de uso único, e escrita exclusiva server-side.

## 3. In scope
- **`POST /api/auth/webauthn/register/options`**:
  - exige sessão válida (`verifySessionCookie`) + `users/{uid}.status === "approved"`;
  - `generateRegistrationOptions` com `rpName`/`rpID` (de `webauthnConfig`), `userName` = e-mail, `userDisplayName` = nickname, **`userID` estável** derivado do `uid` Firebase, `authenticatorSelection` = `webauthnAuthenticatorSelection` (platform/required/required), `supportedAlgorithmIDs`, e **`excludeCredentials`** = credenciais já registradas do usuário (evita duplicar autenticador);
  - seta o **challenge cookie assinado** (`createChallengeCookieValue({ challenge, uid })`, httpOnly, curto) e retorna o `PublicKeyCredentialCreationOptionsJSON`.
- **`POST /api/auth/webauthn/register/verify`**:
  - exige sessão válida + `approved`;
  - lê o challenge cookie (`readChallenge`) → 400 se ausente/inválido/expirado; **valida `challenge.uid === uid` da sessão** (binding);
  - valida o body (`{ response: RegistrationResponseJSON, deviceLabel?: string }`);
  - `verifyRegistrationResponse({ response, expectedChallenge, expectedOrigin: webauthnConfig.origin, expectedRPID: webauthnConfig.rpID, requireUserVerification: true })`;
  - se `verified`: **persiste** a credencial em `webauthn_credentials/{credentialId}` via Admin SDK (`credentialId`, `uid` da sessão, `publicKey` convertida Uint8Array→base64url, `counter`, `transports` do response, `deviceLabel` sanitizado, `createdAt`);
  - **limpa o challenge cookie** (uso único) em qualquer caso (sucesso/erro);
  - 201 em sucesso; 400/401/403/422 conforme falha.
- **Módulo store server-only** `src/server/auth/webauthnCredentialStore.ts` (compartilhado com TASK-07): `listCredentialsByUid(uid)`, `saveCredential(cred)`, `getCredentialById(credentialId)` — usando Admin SDK + conversão base64url↔Uint8Array. Valida com `webauthnCredentialSchema` antes de gravar.
- **Helper de guarda** `requireApprovedUser()` (server) que encapsula cookie→`verifySessionCookie`→`approved`, retornando `{ uid }` ou um `NextResponse` de erro — reutilizado pelos dois endpoints (e TASK-06).
- Schema de payload do verify (`register/_schema.ts` ou inline) para `deviceLabel` + presença de `response`.

## 4. Out of scope
- Endpoints de **login** biométrico e custom token (TASK-07).
- UI de enrollment/gestão (TASK-06).
- Regressão de counter no login (TASK-07; no registro o counter inicial vem do response).
- Alteração de `webauthnConfig`/challenge helper (TASK-04, reuso).
- Alteração de schema/rules (TASK-03, reuso).

## 5. Áreas técnicas envolvidas
- `src/app/api/auth/webauthn/register/options/route.ts` (novo).
- `src/app/api/auth/webauthn/register/verify/route.ts` (novo).
- `src/server/auth/webauthnCredentialStore.ts` (novo, server-only).
- `src/server/auth/requireApprovedUser.ts` (novo, server-only) — guarda de sessão+approved.
- Reuso: `webauthnConfig`, `webauthnChallenge`, `webauthnCredentialSchema`, `firebaseAdmin`, `sessionCookie`.
- `@simplewebauthn/server` (`generateRegistrationOptions`, `verifyRegistrationResponse`) + `@simplewebauthn/server/helpers` para base64url (`isoBase64URL` / `isoUint8Array`).

## 6. Regras e comportamento (segurança)
- **4 camadas mantidas:** ambos exigem sessão verificada por Admin SDK + `users/{uid}.status==="approved"`. Não-autenticado → 401; autenticado não-`approved` → 403.
- **Challenge:** gerado server-side, assinado, httpOnly, curto, **uso único** (cookie limpo no verify). `verify` rejeita challenge ausente/forjado/expirado (400). Binding: `challenge.uid` deve igualar o `uid` da sessão (evita usar challenge de outro contexto).
- **`uid` SEMPRE da sessão**, nunca do body. A credencial é gravada sob o `uid` da sessão.
- **expectedOrigin/expectedRPID** vêm de `webauthnConfig` (não do request) — impede spoof.
- **`requireUserVerification: true`** — exige biometria/PIN do device (prioridade mobile).
- **excludeCredentials** evita registrar o mesmo autenticador duas vezes.
- **Persistência só em `verified === true`**; falha de verificação → nada gravado, 422/400.
- **`publicKey`** armazenada como base64url string (schema TASK-03); conversão no boundary.
- **`deviceLabel`** sanitizado (trim, limite de tamanho, fallback "Dispositivo" se vazio).
- Erros não vazam detalhe técnico do WebAuthn ao cliente (mensagem pt-BR genérica); detalhes só em log server.
- Node runtime (`runtime="nodejs"`), `dynamic="force-dynamic"`.

## 7. Contratos e interfaces
- `POST /register/options` → req sem body (ou ignorado) → 200 `PublicKeyCredentialCreationOptionsJSON` + `Set-Cookie` challenge. 401/403 conforme auth.
- `POST /register/verify` → req `{ response: RegistrationResponseJSON, deviceLabel?: string }` → 201 `{ verified: true, credential: { credentialId, deviceLabel, createdAt } }` | 400 (challenge) | 422 (verificação falhou/body inválido) | 401/403.
- `webauthnCredentialStore`:
  - `listCredentialsByUid(uid): Promise<WebauthnCredential[]>`
  - `getCredentialById(credentialId): Promise<WebauthnCredential | null>`
  - `saveCredential(cred: WebauthnCredential): Promise<void>` (valida com schema; doc id = credentialId).
- `requireApprovedUser(): Promise<{ uid: string } | { errorResponse: NextResponse }>` (lê cookies internamente).
- `@simplewebauthn/server` v13.3.x (confirmado context7): `verifyRegistrationResponse` retorna `{ verified, registrationInfo: { credential: { id, publicKey: Uint8Array, counter, transports }, credentialDeviceType, credentialBackedUp } }`.

## 8. Impacto de dados e persistência
- Escreve em `webauthn_credentials` (coleção TASK-03) via Admin SDK (bypassa Rules por design).
- Lê `webauthn_credentials` (excludeCredentials) e `users/{uid}` (status).
- Sem migração.

## 9. Testes obrigatórios (TDD — opus/high, escrever antes)
**register/options:**
- sem cookie de sessão → 401; sessão inválida → 401; usuário não-`approved` → 403.
- approved → 200 com options (challenge presente) + challenge cookie setado (httpOnly); `excludeCredentials` reflete credenciais existentes do usuário; `rpID`/`userID` corretos.
**register/verify:**
- sem challenge cookie → 400; challenge inválido/expirado → 400; `challenge.uid` ≠ sessão → 400/403.
- `verifyRegistrationResponse` retornando `verified:false` → 422, **nada gravado**, cookie limpo.
- `verified:true` → credencial gravada (uid da sessão, publicKey base64url, counter, transports, deviceLabel sanitizado), 201, cookie limpo.
- body inválido (sem `response`) → 422.
- `uid` nunca vem do body (ignorado se presente).
- erro do Admin SDK na gravação → 500 sem vazar detalhe.
**store:** save valida schema (rejeita doc inválido); conversão base64url↔Uint8Array round-trip.
- Mock de `@simplewebauthn/server`, Admin SDK (auth+firestore), `cookies()`. Verificar via JSON real.

## 10. Critérios de aceite
- Ambos endpoints aplicam sessão+`approved`; respostas de erro corretas (401/403/400/422).
- Challenge assinado, uso único (limpo no verify), com binding de `uid`.
- Verificação usa `expectedOrigin`/`expectedRPID` da config; `requireUserVerification:true`.
- Credencial gravada SOMENTE em `verified`, sob `uid` da sessão, com `publicKey` base64url; nada gravado em falha.
- `excludeCredentials` evita duplicidade.
- `typecheck`, `lint`, testes passam (JSON real). Sem vazar detalhe técnico ao cliente.

## 11. Constraints
- TypeScript strict, sem `any`. `import "server-only"` nos módulos server.
- `uid` sempre da sessão; `expectedOrigin`/`expectedRPID` da config; nunca do request.
- Não criar endpoint de login aqui (TASK-07).
- Reusar `webauthnConfig`/`webauthnChallenge`/schema/Admin SDK existentes.
- Node runtime + force-dynamic. Comentários pt-BR. Sem logar segredo/token.

## 12. Execution cost profile
- tdd: opus/high
- implement: opus/high
- test: sonnet/high
- review: opus/high

## 13. Frontend indicator
- is_frontend: false
- reason: Route Handlers (API) + módulos server (store, guarda de auth). Sem UI/telas/interação. O `@simplewebauthn/browser` (UI) é da TASK-06.

## 14. Open questions
- `userID` estável: derivar de `uid` Firebase (ex.: `isoUint8Array.fromUTF8String(uid)`); confirmar no /implement a codificação exata da lib v13. Não bloqueia (resolvido contra a API real).
- `deviceLabel`: origem (body do verify). Limite de tamanho sugerido 60 chars; fallback "Dispositivo". Confirmar com a UI (TASK-06), mas o default é seguro.
