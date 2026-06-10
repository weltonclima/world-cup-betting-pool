# SPEC

## 1. Task id and title
- Task: TASK-07
- Title: Route Handlers de login por biometria (WebAuthn authentication)

## 2. Objective
Implementar os dois Route Handlers que geram as opções de autenticação WebAuthn e
verificam a assertion, emitindo um **Firebase custom token** quando válida. É o
ponto de maior risco da feature: assertion mal verificada = bypass total de auth.
Não há sessão prévia (é o próprio login). Resolve M1, M4, M5, HR-01 e N2.

## 3. In scope
1. `POST /api/auth/webauthn/login/options`
   - Gera challenge via `generateAuthenticationOptions` (`userVerification: "required"`,
     `rpID` da config).
   - **Usernameless por padrão (M5):** omite `allowCredentials`.
   - Seta cookie de challenge httpOnly assinado (mesmo helper do registro), agora
     **com `jti` único** (HR-01).
   - Público (sem sessão). Guard de CSRF por `Origin` (espelha o registro).
2. `POST /api/auth/webauthn/login/verify`
   - Lê + valida o cookie de challenge (assinatura/expiração) e **consome o `jti`
     server-side** (single-use, HR-01); limpa o cookie em qualquer desfecho.
   - Resolve a credencial: `getCredentialById(response.id)` → `uid` (M5).
   - `verifyAuthenticationResponse` com `expectedOrigin`/`expectedRPID` da config,
     `requireUserVerification: true`, `credential` = `{ id, publicKey(Uint8Array),
     counter, transports }` da credencial armazenada.
   - **Política de counter (M4):** rejeita regressão (ver §6). Persiste `newCounter`
     + `lastUsedAt` SOMENTE em sucesso.
   - Confirma `users/{uid}.status === "approved"`; bloqueia `pending`/`blocked`
     mesmo com assertion criptograficamente válida.
   - Emite `adminAuth.createCustomToken(uid, { role })` (M1) e retorna `{ customToken }`.
3. **HR-01 — challenge single-use compartilhado:** refatorar
   `src/server/auth/webauthnChallenge.ts` para emitir `jti` e adicionar um store de
   `jti` consumidos (Firestore, TTL ≥ TTL do challenge). O **registro (TASK-05)**
   passa a consumir `jti` também (carry-forward obrigatório).
4. Novas funções no `webauthnCredentialStore.ts`: `updateCredentialCounter(credentialId,
   newCounter, lastUsedAt)`.
5. Testes (TDD opus/high) — ver §9.

## 4. Out of scope
- UI / botão "Entrar com biometria" → **TASK-08**.
- Criação do session cookie `__session` no client (`signInWithCustomToken` →
  `/api/auth/session`) → **TASK-08** (server-side aqui só emite o custom token).
- Registro/enrollment de credencial (TASK-05/06) — apenas o ajuste de `jti` (HR-01).
- Recuperação de dispositivo perdido (fallback e-mail+senha já existe, intocado).
- Política de rate-limit dedicada (follow-up; não regredir nada existente).

## 5. Main technical areas involved
- `src/app/api/auth/webauthn/login/options/route.ts` (novo)
- `src/app/api/auth/webauthn/login/verify/route.ts` (novo)
- `src/server/auth/webauthnChallenge.ts` (refactor HR-01: `jti`)
- `src/server/auth/webauthnChallengeJtiStore.ts` (novo — consumo single-use)
- `src/server/auth/webauthnCredentialStore.ts` (nova fn `updateCredentialCounter`)
- `src/server/auth/webauthnConfig.ts` (consumido; sem mudança)
- `src/server/firebaseAdmin.ts` (`getAdminAuth().createCustomToken`)
- `src/app/api/auth/webauthn/register/verify/route.ts` (consumir `jti` — HR-01)
- Firestore: nova coleção `webauthn_challenge_jti`; rules (write negado ao client,
  como `webauthn_credentials`); índice/TTL se aplicável.

## 6. Business rules and behavior

### 6.1 Origin guard (CSRF, espelha o registro)
`request.headers.get("origin") !== webauthnConfig.origin` → `403`. Aplicar nos dois
endpoints (`options` e `verify`), mesmo sem sessão.

### 6.2 Challenge single-use (HR-01 — decisão travada)
- `createChallengeCookieValue` passa a embutir um `jti` (`crypto.randomUUID()`).
- O store de `jti`: `consumeJti(jti): Promise<boolean>` grava
  `webauthn_challenge_jti/{jti}` via `create()` (atômico). `ALREADY_EXISTS` (code 6)
  → retorna `false` (já consumido = replay). Doc carrega `expiresAt` para a TTL
  policy do Firestore limpar (TTL ≥ 5min do challenge).
- `verify` (login E registro): após `readChallenge` OK, chamar `consumeJti`. Se
  `false` → `400` "Sessão inválida ou expirada" (replay bloqueado). Consome **antes**
  da verificação criptográfica (challenge é one-shot independentemente do desfecho).
- O cookie continua sendo limpo em todo desfecho (defesa redundante).

### 6.3 Resolução usernameless (M5)
`uid` vem de `getCredentialById(response.id)`, NUNCA do body/sessão. Credencial
inexistente → `400` genérico ("Não foi possível autenticar"), sem revelar se o id
existe. `options` não exige e-mail (ramo usernameless é o padrão).

### 6.4 Política de counter (M4 — decisão travada: REJEITAR; refinada p/ `credentialBackedUp`)
Após `verifyAuthenticationResponse` com `verified: true`, sejam `stored` o counter
persistido, `next = authenticationInfo.newCounter` e `backedUp =
authenticationInfo.credentialBackedUp`:
- **single-device** (`backedUp === false`): counter DEVE crescer estritamente —
  exigir `next > stored`; senão **rejeitar** (`401`). Cobre o clone de autenticador
  não-sincronizado que reusa um counter antigo (inclui o caso `0/0`, que para
  single-device é suspeito).
- **passkey sincronizado** (`backedUp === true`, iCloud/Google): pode reportar
  counter `0` estático ou igual → tolerar igualdade; rejeitar só regressão real
  (`next < stored`).
- Regressão = **rejeita** (não só alerta), sem atualizar nada.
- Em sucesso: `updateCredentialCounter(credentialId, next, lastUsedAt=now)`.

### 6.5 Autorização (defense-in-depth)
Mesmo com assertion válida, ler `users/{uid}`; se ausente ou
`status !== "approved"` → `403` "Acesso não autorizado". Custom token só é emitido
**após TODAS** as checagens (assertion + counter + approved).

### 6.6 Custom token + role (M1 — decisão travada)
`getAdminAuth().createCustomToken(uid, { role })`, com `role` lido do doc
`users/{uid}` (default `"user"` se ausente/ inválido). Garante que o ID token
derivado (`signInWithCustomToken` + `getIdToken(true)` na TASK-08) carregue `role`,
sem o qual o middleware edge (`middleware.ts`, lê `result.role`) trataria admins
como não-admin. `role` não é claim reservado → seguro em `additionalClaims`.

### 6.7 N2 — re-mint do session cookie (decisão travada)
Resolvido: **reusar `POST /api/auth/session`** (já faz `verifyIdToken`). Nenhum
endpoint de re-mint novo. Fora do escopo server desta task; consumido na TASK-08.

### 6.8 Mensagens de erro
pt-BR, genéricas, sem vazar detalhe técnico do WebAuthn nem distinguir
"credencial não existe" de "assertion inválida" (anti-enumeração).

## 7. Contracts and interfaces

### POST /api/auth/webauthn/login/options
- Request body: vazio (ou `{}`). Sem e-mail (usernameless).
- Response `200`: `PublicKeyCredentialRequestOptionsJSON` (de `generateAuthenticationOptions`).
  - Set-Cookie: `webauthn_challenge` (httpOnly, `secure` fora de dev, `SameSite=Lax`,
    `maxAge=300`), payload `{ challenge, jti }`.
- Erros: `403` Origin.

### POST /api/auth/webauthn/login/verify
- Request body (Zod): `{ response: AuthenticationResponseJSON }` — validar como objeto
  presente (`z.record(z.string(), z.unknown())`); a verificação criptográfica é da lib.
- Response `200`: `{ verified: true, customToken: string }`.
  - Set-Cookie: limpa `webauthn_challenge` (maxAge 0).
- Erros: `403` Origin · `400` challenge inválido/replay/credencial não encontrada/
  body inválido (`422` se JSON malformado) · `401` assertion inválida ou counter
  regredido · `403` não-`approved` · `500` falha inesperada. Cookie limpo em todos.

### Store (`webauthnCredentialStore.ts`)
```
updateCredentialCounter(credentialId: string, newCounter: number, lastUsedAt: string): Promise<void>
```
(`update()` parcial: `{ counter, lastUsedAt }`; valida `newCounter` int ≥ 0.)
`getCredentialById` já existe (M5).

### Challenge (`webauthnChallenge.ts` refactor)
- `createChallengeCookieValue({ challenge, ...aux })` → embute `jti` automaticamente.
- `ChallengePayload` ganha `jti: string`.
- `readChallenge` retorna `jti` no payload (continua nunca lançando).

### Jti store (`webauthnChallengeJtiStore.ts`, novo)
```
consumeJti(jti: string, expiresAt: string): Promise<boolean>   // false = já consumido
```

## 8. Data and persistence impact
- Nova coleção `webauthn_challenge_jti/{jti}`: `{ expiresAt: ISO }`. Write
  exclusivo Admin SDK; **Rules: read/write client negado** (espelha
  `webauthn_credentials`). Configurar **TTL policy** no campo `expiresAt`
  (limpeza automática; sem índice composto necessário).
- `webauthn_credentials`: update de `counter` + `lastUsedAt` (campos já no schema
  TASK-03; sem migração).
- Teste de rules: client não lê/escreve `webauthn_challenge_jti`.

## 9. Required tests (TDD primeiro — opus/high)
Núcleo de segurança; cada item é caso de teste:
1. **options:** retorna options + seta cookie com `jti`; `403` em Origin inválido.
2. **verify — sucesso:** assertion válida + counter crescente → `200` com
   `customToken`; persiste `newCounter`+`lastUsedAt`; `createCustomToken` chamado com
   `{ role }` correto.
3. **anti-replay (HR-01):** segundo `verify` com mesmo `jti` → `400` (jti consumido),
   mesmo com cookie/assertion válidos.
4. **counter regressão (M4):** `next <= stored` com counter em uso → `401`, sem
   atualizar credencial.
5. **counter 0/0:** passkey sincronizado aceita; `lastUsedAt` atualizado, counter 0.
6. **credencial inexistente (M5):** `getCredentialById` null → `400` genérico.
7. **não-`approved`:** assertion válida mas `status="pending"/"blocked"` → `403`,
   sem custom token.
8. **challenge ausente/forjado/expirado:** `400`; cookie limpo.
9. **origin/rpID:** `expectedOrigin`/`expectedRPID` vêm da config, nunca do request.
10. **role default:** `users/{uid}` sem `role` → custom token com `role:"user"`.
11. **register/verify (carry-forward HR-01):** replay de `jti` no registro também
    bloqueado (não regredir TASK-05).
12. **rules:** client negado em `webauthn_challenge_jti`.

## 10. Acceptance criteria
- Os dois endpoints existem, runtime `nodejs`, `dynamic = "force-dynamic"`.
- Login usernameless E2E: assertion válida de credencial registrada (TASK-05/06) →
  custom token com `role` → (na TASK-08) sessão.
- Replay do challenge impossível (jti single-use) em login **e** registro.
- Regressão de counter rejeita o login; counter/`lastUsedAt` avançam só em sucesso.
- Não-`approved` nunca recebe custom token.
- Nenhuma mensagem vaza detalhe técnico/enumeração.
- `vitest run` verde nos testes acima; rules test verde.

## 11. Constraints
- `uid` e `role` SEMPRE derivados server-side (credencial + doc `users`), nunca do body.
- `expectedOrigin`/`expectedRPID` da `webauthnConfig` (nunca do request).
- Admin SDK só server-side (`import "server-only"`).
- HR-01 num helper COMPARTILHADO — não duplicar lógica de `jti` entre login/registro.
- Não remover/regredir o fallback e-mail+senha nem o fluxo de registro (TASK-05).
- Path do middleware é a RAIZ (`middleware.ts`), não `src/` (N1).
- Custom token emitido só após assertion + counter + approved — ordem inegociável.

## 12. Execution cost profile
- tdd: opus/high
- implement: opus/high
- test: sonnet/high
- review: opus/high

## 13. Frontend indicator
- is_frontend: false
- reason: Route Handlers server-side + helpers/store/rules. UI do login fica na TASK-08.

## 14. Open questions
Nenhuma bloqueadora — M1/M4/M5/HR-01/N2 resolvidos acima. Operacional (não bloqueia
implement): a **TTL policy** de `webauthn_challenge_jti` é config do console
Firestore; até estar ativa, docs de `jti` acumulam (corretude preservada, só limpeza
pendente) — registrar no /release.
