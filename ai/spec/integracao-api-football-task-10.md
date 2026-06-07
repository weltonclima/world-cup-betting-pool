# SPEC — TASK-10: Middleware de proteção `/admin/*` (jose)

> Plan: `ai/plan/integracao-api-football.md` (TASK-10) · Type: integration · Criticality: critical · Risco R3 / Ambiguidade A3
> Objetivo: PRIMEIRO portão server-side que bloqueia não-admin em `/admin/*`, lendo o session cookie `__session` (TASK-09) e verificando assinatura + claim `role` no edge com `jose` (firebase-admin NÃO roda no middleware).
> Depende de: TASK-09 (session cookie `__session`) e TASK-08 (custom claim `role` no token).

## 1. Fluxo

1. `matcher: ["/admin/:path*"]` — middleware roda só nas rotas administrativas.
2. Lê o cookie `__session` do request (mesmo nome de `SESSION_COOKIE_NAME` em `src/app/api/auth/session/route.ts` — único cookie repassado pelo CDN do App Hosting ao backend).
3. Chama `verifySession(token, { projectId, fetchCerts })`:
   - `projectId` = `process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID`.
   - `fetchCerts` = `fetchGoogleCerts` (fetch + cache dos certificados públicos do Google).
4. Decisão de redirect:
   - `!result.valid` (ausente/inválido/expirado/forjado/erro de rede nos certs) → `redirect("/login")`.
   - `result.valid` mas `role !== "admin"` → `redirect("/home")`.
   - `result.valid` e `role === "admin"` → `NextResponse.next()`.

## 2. Verificação do SESSION COOKIE (≠ ID token)

Pontos críticos que diferenciam session cookie de ID token:

| Aspecto | Session cookie (este caso) | ID token (NÃO é o caso) |
|---|---|---|
| `iss` | `https://session.firebase.google.com/<projectId>` | `https://securetoken.google.com/<projectId>` |
| Endpoint de certs | `https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys` | `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com` |
| `aud` | `<projectId>` | `<projectId>` |
| `alg` | RS256 | RS256 |

### Endpoint de certs usado

`https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys`

- Formato da resposta: `{ "<kid>": "-----BEGIN CERTIFICATE-----..." }` (x509 PEM por `kid`).
- Header `Cache-Control: max-age=<s>` respeitado: `fetchGoogleCerts` cacheia em memória do runtime do middleware até `now + max-age` para não bater no endpoint a cada request. Cada instância edge revalida no máximo a cada `max-age` (sem estado compartilhado entre instâncias — aceitável).

### Claims verificados (via `jose`)

- `decodeProtectedHeader(token)` → extrai `kid` (sem verificar ainda). Sem `kid` → inválido.
- `importX509(pem, "RS256")` → chave pública do `kid`. `kid` desconhecido (sem cert) → inválido.
- `jwtVerify(token, key, { algorithms: ["RS256"], issuer, audience })`:
  - `algorithms: ["RS256"]` — rejeita `alg` divergente (defesa contra `alg=none` / confusão de algoritmo).
  - `issuer: https://session.firebase.google.com/<projectId>`.
  - `audience: <projectId>`.
  - `exp`/`iat`/`nbf` — validados automaticamente pelo `jose` (lança em token expirado).
- `payload.role` normalizado: só `"admin"`/`"user"` são reconhecidos; qualquer outro valor (ausente/desconhecido) → `null`. Admin SSE `role === "admin"`.

## 3. Arquivos

Criados:
- `src/server/auth/verifySession.ts` — função PURA `verifySession(token, deps)`. Deps injetáveis (`projectId`, `fetchCerts`) → testável sem rede/edge. Retorna `{ valid: true; role }` ou `{ valid: false }`. Nunca lança. Exporta `SESSION_COOKIE_CERTS_URL`, tipos `GoogleCerts`/`VerifySessionDeps`/`VerifySessionResult`.
- `src/server/auth/googleCerts.ts` — `fetchGoogleCerts(now?)`: fetch + cache em memória respeitando `Cache-Control: max-age`. `__clearGoogleCertsCache()` para testes. Mantido fora de `verifySession.ts` para preservar a pureza/testabilidade daquela função.
- `middleware.ts` (raiz) — fino: lê cookie, chama `verifySession`, decide redirect. `config.matcher = ["/admin/:path*"]`.
- `src/server/auth/__tests__/verifySession.test.ts` — testes (jose mockado + fetchCerts injetado).

Alterados:
- `package.json` — adicionada dep `jose` `^6.2.3` (não existia; instalada via npm — root usa `package-lock.json`).

NÃO tocados (fora do escopo): `functions/**`, `src/server/{apiFootball,mappers,cache}/**`, `src/app/api/**`, `src/services/**`, `next.config`, `firebase.json`.

## 4. Defense-in-depth

O middleware é a **1ª camada** (primeiro portão), não a autorização final:

1. **Middleware edge (esta task)** — verificação criptográfica completa do cookie + checagem de `role`. Limitação: o `role` no cookie é congelado na emissão (TASK-09 faz `getIdToken(true)` no login); mudança de role de quem já está logado só reflete no próximo login (~até 5 dias do cookie). Por isso NÃO é a única defesa.
2. **API Routes (Admin SDK, runtime Node)** — enforcement real com `firebase-admin` (`verifyIdToken`/`verifySessionCookie` + leitura do doc `users`). Roda no Cloud Run do App Hosting.
3. **Firestore Security Rules** — autorização no banco (independente do app).
4. **`AdminGuard` client** (`src/components/layout/AdminGuard.tsx`) — esconde o painel no browser (camada 2 da defesa do PRD-01).

## 5. Decisões

- **`jose` (não firebase-admin)**: firebase-admin depende de APIs Node indisponíveis no runtime edge do middleware. `jose` é edge-compatible e faz a verificação RS256 completa.
- **Função pura + deps injetadas**: `verifySession` recebe `fetchCerts` e `projectId` → testável mockando só `jose`, sem rede e sem edge real. Cache de certs isolado em `googleCerts.ts`.
- **Nunca lança**: qualquer falha (parse, assinatura, claim, rede) vira `{ valid: false }` → redirect `/login`. Fail-closed.
- **Normalização de `role`**: shape estável (`"admin" | "user" | null`); valores inesperados nunca concedem admin.
- **Nome do cookie duplicado como literal no middleware**: para manter o middleware sem importar o Route Handler (`route.ts` declara `runtime="nodejs"`/`force-dynamic`, indesejável puxar para o bundle edge). Documentado o alinhamento com `SESSION_COOKIE_NAME`.

## 6. Casos de teste (todos verdes — 13)

`verifySession` (`jose` mockado: `importX509`/`jwtVerify`/`decodeProtectedHeader`; `fetchCerts` injetado):
- token ausente (`undefined`) → invalid, `jwtVerify` não chamado.
- token string vazia → invalid, `decodeProtectedHeader` não chamado.
- header sem `kid` → invalid, `jwtVerify` não chamado.
- `kid` sem cert correspondente → invalid, `importX509` não chamado.
- assinatura inválida (`jwtVerify` lança) → invalid.
- iss/aud errados (`jwtVerify` lança por claim) → invalid.
- passa `algorithms`/`issuer`/`audience` corretos ao `jwtVerify` (asserção do contrato).
- token expirado (`jwtVerify` lança por `exp`) → invalid.
- válido, `role: "user"` → valid + role "user".
- válido, `role: "admin"` → valid + role "admin".
- válido, payload sem `role` → valid + role null.
- `projectId` vazio → invalid, sem chamar decode.
- `fetchCerts` lança → invalid.

## 7. O que precisa de cookie real / runtime para validar

- A verificação RS256 ponta-a-ponta com um `__session` REAL emitido por `createSessionCookie` (TASK-09) — os unit tests mockam `jose`, não fazem crypto real.
- O fetch real dos certificados do Google e o comportamento do cache `Cache-Control` em produção (testado por injeção, não contra o endpoint real).
- A entrega do cookie `__session` pelo CDN do App Hosting ao middleware (só em deploy — TASK-07).
- O comportamento do `matcher`/redirects num `next dev`/`next start` real (não exercido aqui; enunciado foca a lógica testável). Recomenda-se um smoke manual pós-deploy: (a) sem cookie → `/admin` redireciona a `/login`; (b) cookie de user → `/home`; (c) cookie de admin → painel.

## 8. Resultado de verificação

- `npx vitest run src/server/auth` (JSON, lido cru — não via resumo rtk): **13 passed / 0 failed**, 0 suítes com falha. RED confirmado antes (suíte não carregava sem o módulo). `.vt10.json`/`.vt10red.json` removidos após conferência.
- `npx tsc --noEmit`: **sem erros** (corrigido um `noUncheckedIndexedAccess` em `parseMaxAgeSeconds`).

## 9. Riscos / dependências

1. **Claim defasado**: `role` no cookie congela na emissão (TASK-09); rebaixamento de admin só vale no próximo login. Mitigado pela defense-in-depth (camadas 2–4).
2. **Cache de certs por instância**: cada instância edge mantém seu cache; sem invalidação central. Rotação de chave do Google é coberta no máximo em `max-age`. `jwtVerify` falha-fechado se a chave certa não estiver no cache → redirect `/login` (não concede acesso indevido).
3. **`NEXT_PUBLIC_FIREBASE_PROJECT_ID` ausente** → `verifySession` retorna invalid (fail-closed): `/admin/*` sempre redireciona a `/login`. Garantir env no runtime.
4. **Runtime edge do middleware**: `jose` e `fetch` são edge-safe; nenhuma dependência Node foi introduzida no caminho do middleware. Validar no deploy (TASK-07).
5. **Sem matcher de teste E2E**: a lógica de redirect do middleware em si não tem teste automatizado (só `verifySession`); o smoke manual da §7 cobre.
