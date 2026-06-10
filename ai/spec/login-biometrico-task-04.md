# SPEC

## 1. Task id and title
- Task: TASK-04
- Title: Config WebAuthn (rpId/origin por ambiente) + dependência + helper de challenge cookie

## 2. Objetivo
Estabelecer a base de configuração e as ferramentas para os fluxos WebAuthn (registro/login): adicionar a biblioteca `@simplewebauthn/{server,browser}`, prover a configuração de Relying Party (`rpName`/`rpID`/`origin`) resolvida por ambiente (dev `localhost`, prod `bolaodosparcas.vercel.app`), e um helper server-only para criar/ler um **challenge cookie** assinado de curta duração (anti-tamper, anti-replay). Nenhuma verificação de attestation/assertion nem endpoint nesta task (TASK-05/07).

## 3. In scope
- **Dependências:** `@simplewebauthn/server@^13.3.0` e `@simplewebauthn/browser@^13.3.0` (browser é consumido em TASK-06/08; instalar agora para fixar a versão).
- **Config RP** em módulo server-only `src/server/auth/webauthnConfig.ts`:
  - `rpName` (ex.: "Bolão dos Parças"), `rpID`, `origin` resolvidos por ambiente via env, com defaults seguros:
    - dev: `rpID="localhost"`, `origin="http://localhost:3000"`;
    - prod: `rpID="bolaodosparcas.vercel.app"`, `origin="https://bolaodosparcas.vercel.app"`.
  - Validação: `origin` deve terminar com `rpID` (o `rpID` é sufixo registrável do host do `origin`); falha cedo se inconsistente.
- **Helper de challenge cookie** server-only (`src/server/auth/webauthnChallenge.ts`):
  - `createChallengeCookieValue(payload)` → token **assinado** (jose, HS256) com o `challenge` (+ campos auxiliares, ex.: `uid` no registro), `exp` curto (ex.: 5 min);
  - `readChallenge(token)` → verifica assinatura + expiração e retorna o payload (ou erro/null);
  - nome + atributos do cookie (httpOnly, `secure` fora de dev, `sameSite`, `path`, `maxAge` curto), em constantes reutilizáveis pelos Route Handlers (05/07).
  - Segredo de assinatura via env (`WEBAUTHN_CHALLENGE_SECRET`), seguindo o padrão de segredo do projeto (`src/app/api/_lib/secret.ts`).
- Documentar variáveis de ambiente novas no exemplo de env do projeto (`.env.local.example` se existir).

## 4. Out of scope
- `generateRegistrationOptions`/`verifyRegistrationResponse`/`generateAuthenticationOptions`/`verifyAuthenticationResponse` e qualquer Route Handler — TASK-05/07.
- Persistência da credencial / lookup (TASK-03 já entregou schema/rules).
- UI / `@simplewebauthn/browser` em uso (TASK-06/08).
- Emissão de custom token (TASK-07).
- PWA / manifest.

## 5. Áreas técnicas envolvidas
- `package.json` — novas deps.
- `src/server/auth/webauthnConfig.ts` (novo) — config RP por ambiente. `import "server-only"`.
- `src/server/auth/webauthnChallenge.ts` (novo) — helper de challenge cookie (jose). `import "server-only"`.
- Env: novas `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN`, `WEBAUTHN_CHALLENGE_SECRET` (+ doc no example).

## 6. Regras e comportamento
- **rpID/origin atrelam passkeys ao domínio:** valor errado invalida passkeys silenciosamente. Por isso resolução por ambiente + validação `origin` termina em `rpID`. `.vercel.app` está na Public Suffix List → `bolaodosparcas.vercel.app` é registrável e é um `rpID` válido (não usar `vercel.app`).
- **Challenge cookie (anti-tamper):** o challenge NÃO pode ser definido pelo cliente; é assinado pelo servidor (jose). `readChallenge` rejeita token forjado/alterado/expirado. Expiração curta (uso único reforçado no endpoint que limpa o cookie após verificar — TASK-05/07).
- **`authenticatorSelection` alvo (config padrão a expor para os endpoints):** `authenticatorAttachment: "platform"`, `userVerification: "required"`, `residentKey: "required"` (passkey descoberto, login usernameless) — garante biometria do device (prioridade mobile). Exposto como constante de defaults para 05/07 consumirem; esta task NÃO chama as funções, só define os defaults.
- **Server-only:** ambos os módulos usam `import "server-only"`; segredo nunca vai ao bundle client. Sem `firebase-admin` aqui.
- Falha de env ausente em produção: erro explícito na carga (não silenciar) — `rpID`/segredo são obrigatórios em prod.

## 7. Contratos e interfaces
- `webauthnConfig.ts`:
  - `export const webauthnConfig: { rpName: string; rpID: string; origin: string }`.
  - `export const webauthnAuthenticatorSelection` (defaults `platform`/`required`/`required`) + `supportedAlgorithmIDs` (`[-7, -257]`).
- `webauthnChallenge.ts`:
  - `createChallengeCookieValue(payload: { challenge: string } & Record extra): Promise<string>` (token assinado).
  - `readChallenge(token: string | undefined): Promise<{ challenge: string; ... } | null>`.
  - `CHALLENGE_COOKIE_NAME`, `challengeCookieOptions(maxAgeS)`.
- Tipos do `@simplewebauthn/server` (v13.3.0, confirmado via context7): opções usam `rpID`/`rpName`; verificação usa `expectedOrigin`/`expectedRPID`/`expectedChallenge`; credencial `{ id, publicKey: Uint8Array, counter, transports }`. (Conversão Uint8Array↔base64url fica nos endpoints — TASK-05/07.)
- Sem endpoints/eventos nesta task.

## 8. Impacto de dados e persistência
- Nenhum (sem Firestore). Apenas dependências, config e helper de cookie.

## 9. Testes obrigatórios
- **webauthnConfig:** resolve dev vs prod corretamente conforme env/flag; validação `origin` termina em `rpID` (config inconsistente → erro); defaults de `authenticatorSelection`/algoritmos presentes.
- **webauthnChallenge (segurança):**
  - round-trip: `createChallengeCookieValue` → `readChallenge` recupera o `challenge` e auxiliares;
  - token forjado/alterado → `readChallenge` rejeita (null/erro);
  - token expirado → rejeita;
  - token ausente/`undefined` → null seguro.
- Vitest (node). Mock de env conforme necessário. Verificar via JSON real.

## 10. Critérios de aceite
- `@simplewebauthn/server` e `/browser` instalados na versão fixada.
- `webauthnConfig` retorna rpId/origin corretos por ambiente; inconsistência `origin`/`rpID` falha cedo.
- Challenge cookie assinado: round-trip funciona; tamper/expiração/ausência rejeitados (provado por teste).
- Segredo e rpId via env; documentados no example; nada sensível no bundle client (`server-only`).
- `typecheck`, `lint`, testes passam.

## 11. Constraints
- TypeScript strict, sem `any`. `import "server-only"` nos dois módulos.
- jose já é dependência (reuso; não adicionar lib de cripto nova para o cookie).
- Não chamar as funções de geração/verificação WebAuthn aqui (só configurar/defaults) — escopo é infra.
- Comentários/domínio em pt-BR. Sem UI.
- Segredo NUNCA logado nem exposto ao client.

## 12. Execution cost profile
- tdd: n/a (config/infra; o helper de challenge é coberto por testes no /test)
- implement: sonnet/medium
- test: sonnet/medium
- review: sonnet/medium

## 13. Frontend indicator
- is_frontend: false
- reason: Dependência, configuração server-only de Relying Party e helper de cookie assinado. Sem telas/componentes/interação. (`@simplewebauthn/browser` é instalado, mas usado só em TASK-06/08.)

## 14. Open questions
- Reuso do segredo existente (`api/_lib/secret.ts`) vs novo `WEBAUTHN_CHALLENGE_SECRET`: proposto **segredo dedicado** (isolamento de propósito); confirmar no /implement se o projeto preferir centralizar. Não bloqueia.
- Porta de dev do `origin` (`http://localhost:3000`): assume Next dev default 3000; ajustar se o projeto usar outra. Não bloqueia (env-driven).
