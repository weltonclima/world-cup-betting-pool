---
task: TASK-09 — Session cookie httpOnly (/api/auth/session)
commit: 6f3f003
spec: ai/spec/integracao-api-football-task-09.md
reviewed: 2026-06-07
reviewer: Staff Engineer (review adversarial de segurança — gsd-code-reviewer + gsd-security-auditor)
depth: deep
mode: read-only
files_reviewed:
  - src/server/firebaseAdmin.ts
  - src/app/api/auth/session/route.ts
  - src/services/auth.ts
  - src/components/layout/PendingApprovalScreen.tsx
  - src/components/layout/BlockedScreen.tsx
findings:
  blocker: 0
  warning: 4
verdict: APROVADO COM RESSALVAS
---

# Review TASK-09 — Session cookie httpOnly

## Veredito: APROVADO COM RESSALVAS

Os controles centrais de segurança estão presentes e corretos: cookie httpOnly,
`secure` em produção, sameSite=lax, idToken validado ANTES de criar o session cookie,
Admin SDK isolado server-only sem vazamento no bundle client, credencial via env sem
hardcode, mensagens de erro genéricas. Quatro WARNINGs sobre defesa em profundidade e
robustez — nenhum bloqueia o ship.

## Checks de segurança críticos (resultado)

| Check | Resultado | Evidência |
|---|---|---|
| Cookie httpOnly + secure(prod) + sameSite | OK | `route.ts:37-46` `httpOnly:true`, `secure: NODE_ENV==="production"`, `sameSite:"lax"`, `path:"/"`. |
| idToken validado ANTES de createSessionCookie | OK | `route.ts:76` `verifyIdToken(idToken)` precede `createSessionCookie` (`:79`). Falha → 401 sem cookie (`:89-95`). Testado (`route.test.ts:77-95`). |
| Admin SDK realmente server-only (não vaza no client) | OK | `firebaseAdmin.ts:1` `import "server-only"`; barrel `src/firebase/index.ts` NÃO reexporta admin; só `route.ts` (runtime nodejs) importa. |
| Credencial via env, sem hardcode | OK | `firebaseAdmin.ts:58` `FIREBASE_SERVICE_ACCOUNT_KEY` / `:84` `applicationDefault()` / emulador. Nenhum segredo literal. |
| Erros não vazam segredo/motivo | OK | `route.ts:91-94` mensagem genérica "Não autorizado." sem detalhe do erro; catch não loga o token. |
| CSRF (sameSite=lax p/ POST de sessão) | ACEITÁVEL (WR-01) | `sameSite=lax` + POST exige `idToken` no corpo (não anexado automaticamente cross-site). Sem token CSRF dedicado. |
| Runtime/cache | OK | `route.ts:18-20` `runtime="nodejs"` + `dynamic="force-dynamic"` (auth nunca cacheada). |

## Warnings

### WR-01 — `verifyIdToken` sem checagem de revogação e sem `auth_time` recente
**Arquivo:** `src/app/api/auth/session/route.ts:76`
**Issue:** `verifyIdToken(idToken)` é chamado SEM o 2º argumento `checkRevoked=true`. A
recomendação oficial do Firebase para o fluxo de session cookie é exigir login recente
(verificar `auth_time` do decoded token, ex.: ≤ 5 min) antes de `createSessionCookie`,
para que um idToken vazado/antigo não possa ser trocado por um cookie de 5 dias. Aqui
qualquer idToken válido e não expirado (janela de até ~1h) vira sessão longa. Para
público <100 o risco é moderado, mas é um desvio do hardening recomendado e merece
registro.
**Fix sugerido:** `const decoded = await auth.verifyIdToken(idToken, true);` e rejeitar
(401) se `Date.now()/1000 - decoded.auth_time > 5*60`.

### WR-02 — Endpoint de sessão não checa `status` nem `role` ao emitir o cookie
**Arquivo:** `src/app/api/auth/session/route.ts:74-88`
**Issue:** O cookie é emitido para QUALQUER usuário autenticado, inclusive `status:pending`
ou `status:blocked`. O controle de status hoje vive só no client (`AuthProvider`/screens)
e nas Security Rules. O cookie de sessão em si não carrega/checa `status`, então um usuário
bloqueado mantém uma sessão server-side válida por até 5 dias (o middleware da T10 só
checa `role`, não `status`). Não é bypass direto de admin, mas é uma lacuna de defesa em
profundidade: a "sessão server-side" não reflete bloqueio. Documentar como risco aceito
ou planejar enforcement de `status` na camada server (API Routes da defense-in-depth).
**Fix sugerido:** registrar como risco aceito no spec OU, ao emitir, ler `users/{uid}.status`
via Admin SDK e recusar cookie para `blocked`.

### WR-03 — Falha silenciosa do cookie deixa client "logado" sem sessão server-side
**Arquivo:** `src/services/auth.ts:50-70`
**Issue:** `createSessionCookie` é best-effort: se o POST falhar, o login client prossegue
sem cookie. É decisão consciente (spec §5), mas significa que o usuário pensa estar logado
enquanto rotas protegidas por servidor (T10) o redirecionam a `/login` — UX confusa e
possível loop de redirect se uma rota pós-login estiver sob `/admin`. Sem impacto de
segurança (fail-closed no servidor), mas vale alerta visível ao usuário em vez de só
`console.error`.
**Fix sugerido:** em falha, sinalizar à UI (toast/Sonner) que a sessão server-side não foi
estabelecida.

### WR-04 — Duplicação do init do Admin SDK (`src/firebase/admin.ts` vs `src/server/firebaseAdmin.ts`)
**Arquivo:** `src/server/firebaseAdmin.ts` (todo) vs `src/firebase/admin.ts`
**Issue:** Existem dois inicializadores do Admin SDK quase idênticos (mesmo schema Zod,
mesma resolução de credencial), divergindo só no fallback ADC. Ambos `server-only` (seguro),
mas a duplicação de lógica de credencial é risco de drift de segurança: um hardening
aplicado a um pode esquecer o outro. O spec justifica (enunciado exigia `src/server/`), mas
o legado deveria ser consolidado/removido em task de limpeza.
**Fix sugerido:** consolidar num único módulo server-only e reexportar, ou agendar remoção
do `src/firebase/admin.ts` legado.

## Verificação
- `npx tsc --noEmit` (root): **sem erros** (exit 0).
- Nenhum segredo hardcoded; nenhum `any`; Admin SDK confirmado fora do bundle client.
