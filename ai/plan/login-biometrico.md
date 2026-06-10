# PLAN — Persistência de Sessão + Login Biométrico/Facial

> Fonte: `ai/prd/login-biometrico.md`. Constrói sobre a fundação de auth (PRD-01).
> Decisões travadas: persistência client `local` explícita; cookie `__session` com renovação deslizante (TTL 5d); lib `@simplewebauthn/{server,browser}`; challenge em cookie httpOnly assinado de curta duração; N passkeys por usuário; "facial" = autenticador de plataforma via WebAuthn (Face ID/Touch ID/Windows Hello/digital), NÃO reconhecimento facial custom.
> **Plataforma-alvo (prioridade): celulares Android (Chrome) + iOS (Safari 16+) via navegador mobile.** Desktop é opcional (não-requisito). Continua web Next.js (NÃO app nativo). Mobile-first nas tasks de UI; validação obrigatória em device real iOS + Android.

## 1. Resumo do planejamento

8 tasks em 5 fases. **Frente A (persistência)** é pequena e de baixo risco — fundação rápida. **Frente B (biometria/WebAuthn)** é o grosso e concentra o risco de segurança: dois pares de Route Handlers (registro e login) com verificação criptográfica, mais schema/rules da credencial e as UIs. As tasks críticas (TASK-05, TASK-07) emitem confiança de auth e exigem TDD + review opus/high. Fallback e-mail+senha permanece em todas as superfícies. **Alvo prioritário = celulares Android/iOS via navegador mobile** (WebAuthn cobre nativamente; sem app nativo). Mobile não adiciona tasks — molda config (TASK-04) e UI/validação (TASK-06/08).

## 2. Fases de execução

- **Fase 1 — Persistência (Frente A):** TASK-01, TASK-02
- **Fase 2 — Fundação WebAuthn (dados + config):** TASK-03, TASK-04
- **Fase 3 — Registro de credencial (enrollment):** TASK-05, TASK-06
- **Fase 4 — Login biométrico:** TASK-07, TASK-08
- **Fase 5 — Validação:** coberta por `/local-env` + `/release` (sem task dedicada)

## 3. Tasks

### TASK-01 – Persistência client explícita
- Type: application
- Goal: Tornar a persistência do Firebase Auth no client explícita e intencional (`local`), em vez de depender do default implícito.
- Scope: Aplicar `setPersistence(firebaseAuth, browserLocalPersistence)` na inicialização do client; garantir ordem correta vs `onAuthStateChanged`; não regredir o fluxo de emulador. Documentar a escolha.
- Main modules/files: `src/firebase/client.ts`, possível ajuste em `src/providers/AuthProvider.tsx`.
- Dependencies: nenhuma.
- Story points: 1
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (config de inicialização; cobertura via teste de integração leve do provider)
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: `setPersistence` é assíncrono — não pode introduzir corrida com o primeiro `onAuthStateChanged`. Em SSR/edge não roda (client-only). **M2:** incluir aqui o registro do achado de auditoria de persistência (estado atual client vs server) — item de escopo do PRD §2 sem outra task dona.

### TASK-02 – Renovação deslizante do session cookie
- Type: api
- Goal: Eliminar o mismatch client↔server — o cookie `__session` (5d fixo) deve renovar enquanto a sessão client estiver viva, para não derrubar rotas server-side antes do client.
- Scope: Estratégia de renovação deslizante: re-mint do cookie a partir de ID token fresco quando próximo da expiração (endpoint dedicado chamado pelo client, e/ou refresh no `POST /api/auth/session` já existente). Renovação SÓ com token válido (sem estender cego). Definir limiar de renovação. Atualizar `services/auth.ts` para acionar.
- Main modules/files: `src/app/api/auth/session/route.ts`, `src/services/auth.ts`, possível helper em `src/server/auth/`.
- Dependencies: nenhuma (independe da Frente B).
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes (lógica de validade/renovação, anti-extensão indevida)
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: Não criar sessão "imortal" — renovar exige reverificar token. `middleware.ts` no edge não tem Admin SDK; renovação fica no client→Route Handler Node.

### TASK-03 – Schema, tipos e Firestore Rules da credencial WebAuthn
- Type: persistence
- Goal: Contrato de dados das credenciais de passkey + autorização no banco.
- Scope: Schema Zod (`credentialId`, `publicKey`, `counter`, `transports[]`, `deviceLabel`, `uid`, `createdAt`, `lastUsedAt?`) + tipo derivado; coleção (`webauthnCredentials` ou subcoleção de `users/{uid}`). Firestore Rules: leitura própria opcional, **escrita negada ao client** (só Admin SDK), espelhando o padrão de `predictions`. Testes de rules. **Indexar/permitir lookup por `credentialId` (M5)** — login usernameless precisa resolver `credentialId → uid` sem e-mail.
- Main modules/files: `src/schemas/*` (+ `__tests__`), `src/types/*`, `firestore.rules`, índices se necessário.
- Dependencies: nenhuma.
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes (Security Rules + schema com `__tests__`, padrão do projeto)
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: `publicKey`/`counter` são sensíveis a clonagem; counter deve ser persistido e comparado no login (TASK-07). Decidir subcoleção vs coleção raiz no /spec.

### TASK-04 – Config WebAuthn + dependência
- Type: infra
- Goal: Base de configuração e biblioteca para os fluxos WebAuthn.
- Scope: Adicionar `@simplewebauthn/server` + `@simplewebauthn/browser`. Config `rpId`/`rpName`/`origin` por ambiente (dev `localhost`, prod domínio App Hosting) em módulo server-only + env. Helper de assinatura/leitura do cookie de challenge. **`rpId`/origin DEVEM casar com o domínio acessado no celular** (prioridade Android/iOS) — divergência invalida passkeys no mobile. `authenticatorSelection`: `authenticatorAttachment: "platform"`, `residentKey`/`requireResidentKey` e `userVerification: "required"` para garantir biometria do device.
- Main modules/files: `package.json`, `src/server/auth/webauthnConfig.ts` (novo), `src/firebase/env.ts` ou novo env validator, docs de env.
- Dependencies: nenhuma (pode ir junto com TASK-03).
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (config/wiring)
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/medium
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: `rpId` errado invalida passkeys silenciosamente. Tratar dev/prod desde já. Sem PWA manifest (follow-up separado).

### TASK-05 – Route Handlers de registro de passkey (enrollment)
- Type: api
- Goal: Endpoints que geram opções de registro e verificam a attestation, gravando a credencial vinculada ao `uid` autenticado.
- Scope: `POST /api/auth/webauthn/register/options` (gera challenge p/ usuário autenticado, seta cookie de challenge) e `POST /api/auth/webauthn/register/verify` (valida attestation com `@simplewebauthn/server`, confere challenge/origin/rpId, grava credencial via Admin SDK). Exige sessão válida (`verifySessionCookie`/`verifyIdToken`) + perfil `approved`.
- Main modules/files: `src/app/api/auth/webauthn/register/options/route.ts`, `.../register/verify/route.ts`, schemas de payload, `src/server/auth/webauthnConfig.ts`.
- Dependencies: TASK-03, TASK-04.
- Story points: 5
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes (verificação de attestation, challenge uso único/expiração, origin/rpId, auth obrigatório)
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Notes: Manter as 4 camadas — registrar credencial só para usuário autenticado e `approved`. Challenge uso único (limpar cookie após verify).

### TASK-06 – UI de gestão de passkeys (enrollment + revogação)
- Type: application (frontend)
- Goal: Tela para registrar biometria do dispositivo e listar/remover passkeys.
- Scope: Em configurações de perfil: botão "Ativar biometria neste dispositivo" → `@simplewebauthn/browser` `startRegistration` → chama endpoints da TASK-05; lista de passkeys com remoção; detecção `isUserVerifyingPlatformAuthenticatorAvailable` (esconde se indisponível); estados de loading/erro/sucesso (toast). `is_frontend: true`.
- Main modules/files: `src/features/profile/*`, `src/app/(app)/profile/configuracoes/page.tsx`, service client p/ webauthn (`src/services/auth.ts` ou novo `webauthn.ts`).
- Dependencies: TASK-05.
- Story points: 3
- Criticality: medium
- Technical risk: medium
- Recommended TDD later: no (UI; lógica de service coberta por testes de service)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: Frontend → roda `/ui-spec` + `/patterns:nextjs` + `/ui-review`. Mensagens de erro pt-BR; nunca expor detalhe técnico do WebAuthn ao usuário. **Mobile-first (prioridade Android/iOS):** layout/touch-targets para celular; acionar registro só em gesto do usuário (req. iOS Safari). Tratar WebView/in-app browser (A9) — detectar e orientar "abrir no navegador" se WebAuthn indisponível. Validar em device real iOS + Android.

### TASK-07 – Route Handlers de login por biometria
- Type: api
- Goal: Endpoints que geram opções de autenticação e verificam a assertion, emitindo um Firebase custom token quando válida.
- Scope: `POST /api/auth/webauthn/login/options` (challenge, cookie de challenge; opcionalmente por e-mail p/ resolver credenciais permitidas) e `POST /api/auth/webauthn/login/verify` (valida assertion, confere challenge/origin/rpId, **atualiza counter**, confirma perfil `approved`, então `adminAuth.createCustomToken(uid)` e retorna). Sem sessão prévia (é o login).
- Main modules/files: `.../login/options/route.ts`, `.../login/verify/route.ts`, schemas de payload, `src/server/firebaseAdmin.ts` (createCustomToken).
- Dependencies: TASK-03, TASK-04. (Funcionalmente requer credencial registrada — TASK-05/06 — para E2E.)
- Story points: 5
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes (verificação de assertion, anti-replay do challenge, regressão de counter/clonagem, bloqueio de não-`approved`)
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Notes: Ponto mais sensível — assertion mal verificada = bypass total. Counter deve crescer monotonicamente (senão suspeitar de clone). Custom token só após TODAS as checagens. Bloquear `pending`/`blocked` mesmo com assertion válida.
  - **M1 (resolver no /spec):** `createCustomToken(uid, additionalClaims)` deve incluir o claim `role` — senão o cookie de sessão derivado do login biométrico não terá `role` e o middleware edge quebra para admins. Decidir: passar `role` em `additionalClaims` OU garantir que `getIdToken(true)` pós-`signInWithCustomToken` recarregue o claim já setado no Auth.
  - **M4 (resolver ANTES do implement, não deixar aberto no TDD):** política de regressão de counter — rejeitar vs alertar. Decisão de segurança.
  - **M5:** ramo usernameless — `login/verify` resolve `uid` a partir do `credentialId` da assertion (lookup da TASK-03).
  - **HR-01 (carry-forward da TASK-05, OBRIGATÓRIO aqui):** o challenge cookie hoje é JWT jose stateless (replayável dentro do TTL de 5min). Implementar **single-use server-side** num helper de challenge COMPARTILHADO (registro + login): incluir `jti` no payload e registrar jti consumidos (doc Firestore com TTL ≥ TTL do challenge); `readChallenge`/verify rejeita jti já consumido e o grava no sucesso. Login é o ponto de maior risco (assertion → custom token → login completo) → é o lugar certo para o hardening cobrir ambas as frentes.
  - **N2:** escolher UMA forma de re-mint (endpoint dedicado vs reusar `POST /api/auth/session`, que já faz `verifyIdToken`) — não carregar as duas até o implement.

### TASK-08 – Botão "Entrar com biometria" no login
- Type: application (frontend)
- Goal: Superfície de login biométrico, com fallback a e-mail+senha.
- Scope: Em `(auth)/login`: botão condicional à disponibilidade do autenticador → `@simplewebauthn/browser` `startAuthentication` → endpoints da TASK-07 → `signInWithCustomToken(firebaseAuth, token)` → criar session cookie (fluxo existente) → `AuthLayout` redireciona. Estados de erro/cancelamento. `is_frontend: true`.
- Main modules/files: `src/features/auth/LoginForm.tsx` (ou novo `BiometricLoginButton.tsx`), `src/app/(auth)/login/page.tsx`, `src/services/auth.ts`.
- Dependencies: TASK-07 (e TASK-01/02 p/ persistência consistente da sessão resultante).
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: no (fluxo de UI; service de custom-token coberto por teste de service)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: Frontend → `/ui-spec` + `/patterns:nextjs` + `/ui-review`. Reusar `createSessionCookie` de `services/auth.ts` após `signInWithCustomToken`. Cancelamento do usuário (NotAllowedError) = estado neutro, não erro alarmante.
  - **M1:** `createSessionCookie` é hoje **privado** em `services/auth.ts` — exportar/refatorar para reuso. Ele chama `getIdToken(true)` (claim `role` fresco) — ligado à decisão M1 da TASK-07.
  - **M3 (asserção obrigatória no /ui-spec):** o formulário e-mail+senha NUNCA é escondido/substituído pelo botão biométrico — fallback e recuperação de dispositivo perdido dependem disso.
  - **Mobile-first (prioridade Android/iOS):** botão biométrico proeminente no celular; acionado por gesto (req. iOS Safari); `NotAllowedError` (cancelou/timeout) = estado neutro. Detectar WebView/in-app browser (A9). Validar em device real iOS + Android.

## 4. Mapa de dependências

```
TASK-01  (independente)
TASK-02  (independente)
TASK-03  (independente) ─┐
TASK-04  (independente) ─┼─→ TASK-05 ─→ TASK-06
                         └─→ TASK-07 ─→ TASK-08
TASK-08 também consome TASK-01/02 (sessão persistente).
TASK-07 requer TASK-05/06 para E2E real (credencial registrada).
```

## 5. Ordem de execução recomendada

1. **TASK-01** — persistência client (rápido, base)
2. **TASK-02** — renovação do cookie (fecha o mismatch; independente)
3. **TASK-03** — schema + rules da credencial
4. **TASK-04** — config + dependência WebAuthn
5. **TASK-05** — endpoints de registro
6. **TASK-06** — UI de registro/gestão
7. **TASK-07** — endpoints de login biométrico
8. **TASK-08** — botão de login biométrico

## 6. Riscos de planejamento e bloqueadores

- **TASK-05 / TASK-07 (críticos):** núcleo de segurança. Verificação WebAuthn incorreta = bypass de auth. TDD obrigatório; review opus/high. São as tasks que mais merecem cuidado.
- **`rpId`/origin (TASK-04):** depende do domínio real de produção (App Hosting). Confirmar domínio antes de TASK-04; divergência invalida passkeys.
- **Counter/anti-clonagem (TASK-07):** regressão de counter precisa de política (rejeitar vs alertar) — decidir no /spec.
- **Recuperação:** usuário sem dispositivo registrado depende de e-mail+senha — garantir que nunca seja removido como caminho.
- **TASK-02:** renovação não pode virar sessão imortal — revisar critério de re-mint com atenção.
- **TASK-06/08 (frontend):** passam por `/ui-spec` e `/ui-review`.
- **N1 (path):** `middleware.ts` está na **raiz** do projeto, não em `src/middleware.ts` — usar o path correto nos specs.
- **Pré-condição externa (N3):** confirmar o domínio real de produção (App Hosting) antes da TASK-04 (`rpId`/origin).
- **gsd-plan-checker:** rodado. Veredito: atinge o goal, sem gap crítico/bloqueador. Concerns M1–M5/N1–N3 dobrados nas notas das tasks.
- **Mobile como prioridade (Android/iOS via navegador):** sem novas tasks — WebAuthn já cobre mobile. Impacto concentrado em TASK-04 (rpId/origin + `authenticatorAttachment: platform`/`userVerification: required`), TASK-06/08 (UI mobile-first + WebView A9) e na validação (`/local-env` + device real iOS/Android). Desktop = opcional, não bloqueia.
- **A9 — WebView/in-app browser:** abrir via Instagram/WhatsApp cai em WebView onde WebAuthn pode falhar — tratar com detecção + orientação "abrir no navegador". Resolver no /ui-spec das tasks 06/08.
- **Validação em device real (NÃO só desktop):** iOS Safari + Android Chrome são o alvo; emulação desktop não prova a biometria mobile. `/local-env` deve cobrir.
