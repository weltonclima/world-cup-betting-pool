# RELEASE PLAN — Persistência de Sessão + Login Biométrico/Facial

> Fonte: `ai/prd/login-biometrico.md`, `ai/plan/login-biometrico.md`. TASK-01..08
> completas. Web Next.js (NÃO app nativo); alvo prioritário celulares Android
> Chrome + iOS Safari 16+ via navegador mobile. Deploy: Vercel (App Hosting).

## 1. Release summary
Entrega de duas frentes:
- **Frente A — Persistência de sessão:** persistência client explícita (`local`,
  TASK-01) + renovação deslizante do cookie `__session` (TASK-02). Fecha o mismatch
  client↔server sem sessão imortal.
- **Frente B — Login biométrico (WebAuthn/passkey):** schema+rules da credencial
  (TASK-03), config RP (TASK-04), endpoints de registro (TASK-05) e login (TASK-07),
  UI de gestão de passkeys (TASK-06) e botão "Entrar com biometria" (TASK-08).
  "Facial" = autenticador de plataforma (Face ID/Touch ID/Windows Hello/digital),
  NÃO reconhecimento facial custom. Fallback e-mail+senha preservado em todas as
  superfícies.

Áreas afetadas: `src/firebase/client.ts`, `src/services/{auth,webauthn}.ts`,
`src/server/auth/*`, `src/app/api/auth/webauthn/*`, `src/features/{passkeys,auth}/*`,
`src/app/(auth)/login`, `src/app/(app)/profile/seguranca`, `firestore.rules`,
`firestore.indexes.json`, `middleware.ts` (consome claim `role`).

Validação local: **typecheck 0, lint 0, 2008 testes verdes + 67 rules verdes.**

## 2. Deployment prerequisites (OBRIGATÓRIOS)
1. **Validação em DEVICE REAL — iOS Safari 16+ E Android Chrome.** Biometria NÃO é
   testável em desktop/emulador. Cobrir E2E: registrar passkey (perfil → segurança)
   e logar com biometria. Sem isso, a feature não está provada no alvo.
2. **TTL policy de `webauthn_challenge_jti`** no console Firestore (campo `expiresAt`).
   Sem ela: corretude preservada (replay segue bloqueado pelo single-use), mas os
   docs de `jti` acumulam sem limpeza automática. Configurar antes/junto do release.
3. **Deploy das rules + índices:** `npm run deploy:rules` (inclui a rule
   `webauthn_challenge_jti` read/write negado client e índices de
   `webauthn_credentials`). DEVE ir antes do código de produção usar a coleção.
4. **Variáveis de ambiente (produção):**
   - `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` — **confirmar o domínio REAL de produção**.
     Default: `bolaodosparcas.vercel.app` / `https://bolaodosparcas.vercel.app`.
     Divergência invalida TODOS os passkeys silenciosamente no mobile.
   - `WEBAUTHN_CHALLENGE_SECRET` — segredo forte (o módulo FALHA cedo em produção se
     ausente). Rotação invalida challenges em voo (curtos, baixo impacto).
   - `WEBAUTHN_RP_NAME` (opcional, default "Bolão dos Parças").
   - Conferir credenciais Admin SDK já existentes (`createCustomToken` na TASK-07).

## 3. Data and migration considerations
- **Sem migração de dados.** Coleções novas (`webauthn_credentials`,
  `webauthn_challenge_jti`) nascem vazias; usuários existentes seguem com e-mail+senha
  até registrarem um passkey (opt-in).
- **Ordenação:** deploy de rules/índices (pré-req 3) ANTES do código que escreve nas
  coleções (Admin SDK ignora rules, mas o read client da lista de passkeys depende
  delas; índices evitam falha de query).
- **Compatibilidade:** `__session` mantém o mesmo formato; a renovação deslizante é
  aditiva. `createCustomToken(uid,{role})` (M1) garante que sessões derivadas do login
  biométrico carreguem `role` — admins seguem admin no middleware edge.
- **Rollback de schema:** não aplicável (sem alteração destrutiva).

## 4. Rollout strategy
**Monitoring-first + opt-in natural (sem feature flag dedicada).**
- A Frente B é intrinsecamente opt-in: o botão biométrico só aparece com autenticador
  de plataforma disponível (`usePasskeySupport`) e exige passkey previamente
  registrado. Usuários sem passkey nunca veem mudança de fluxo.
- Sequência: (1) deploy rules/índices + envs → (2) deploy código → (3) smoke test em
  device real iOS+Android (registrar + logar) → (4) monitorar.
- Persistência (Frente A) é transparente; valida cedo (sessões não caem antes do TTL).
- Rollback fácil por ser aditivo (ver §7).

## 5. Monitoring and validation
- **Pós-deploy imediato (device real):** registrar passkey + logar com biometria em
  iOS Safari e Android Chrome. Confirmar redirect via AuthLayout e `role` correto p/
  admin.
- **Logs/erros server:** 4xx/5xx em `/api/auth/webauthn/login/*` e `/register/*`;
  picos de 401 (counter/assertion) podem indicar `rpId` divergente.
- **Acúmulo de `webauthn_challenge_jti`:** confirmar TTL policy expirando docs.
- **Sessão (Frente A):** ausência de quedas de sessão server antes do TTL de 5 dias.
- **WebView (A9):** verificar que abrir via Instagram/WhatsApp cai na nota "abrir no
  navegador" e não quebra o login.

## 6. Risks
- **TASK-05 / TASK-07 (núcleo de segurança — ALTO):** verificação WebAuthn incorreta
  = bypass de auth. Mitigado: TDD + review opus adversarial (0 critical), single-use
  `jti`, counter anti-clonagem, bloqueio de não-`approved`. Risco residual baixo.
- **`rpId`/origin divergente (ALTO operacional):** domínio errado invalida passkeys
  silenciosamente no mobile. Mitigado por guard de Public Suffix + coerência
  rpID⊆origin no boot. Confirmar domínio (pré-req 4).
- **M1 role claim:** sem `role` no custom token, admins quebram no middleware.
  Mitigado (claim incluído + `getIdToken(true)`).
- **TTL policy ausente:** acúmulo de jti (operacional, não de segurança).
- **Recuperação:** usuário sem device registrado depende de e-mail+senha — NUNCA
  remover esse caminho (M3 garantido na UI).
- **Blind spot:** biometria só validável em device real — emulação desktop não prova.

## 7. Rollback considerations
- **Código:** revert do deploy (Vercel) restaura o login e-mail+senha (sempre presente,
  M3). Botão biométrico desaparece; nenhum usuário fica preso.
- **Rules:** manter a rule `webauthn_challenge_jti` mesmo em rollback de código (negar
  client é seguro). Não reverter rules sozinhas.
- **Dados:** credenciais registradas permanecem; ao re-deploy voltam a funcionar. Sem
  limpeza necessária.
- **Persistência (Frente A):** revert volta ao comportamento anterior; cookies
  existentes expiram naturalmente.

## 8. Release checklist
- [ ] Confirmar domínio de produção → setar `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN`.
- [ ] Setar `WEBAUTHN_CHALLENGE_SECRET` (forte) em produção.
- [ ] `npm run deploy:rules` (rules + índices) ANTES do código.
- [ ] Ativar TTL policy de `webauthn_challenge_jti` (campo `expiresAt`).
- [ ] Deploy do código (Vercel).
- [ ] Smoke E2E em **iOS Safari real**: registrar passkey + logar.
- [ ] Smoke E2E em **Android Chrome real**: registrar passkey + logar.
- [ ] Confirmar admin mantém `role` após login biométrico (acesso `/admin`).
- [ ] Confirmar fallback e-mail+senha visível e funcional (M3).
- [ ] Confirmar nota WebView ao abrir via in-app browser (A9).
- [ ] Monitorar erros `/api/auth/webauthn/*` nas primeiras 24h.

## 9. Follow-ups (pós-release, não-bloqueadores)
- Aplicar `Sec-Fetch-Site=same-origin` (defense-in-depth) também nos endpoints de
  **registro** (TASK-05) — hoje só nos de login (rollout uniforme de CSRF).
- Considerar PWA manifest (fora do escopo desta feature).
- Ampliar heurística de detecção de WebView (`isInAppBrowser`) — hoje degrada p/ erro
  genérico em WebViews não cobertos (fail-closed, aceitável).
