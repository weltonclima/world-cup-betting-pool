---
task: TASK-10 — Middleware de proteção /admin/* (jose)
commit: d8e3336
spec: ai/spec/integracao-api-football-task-10.md
reviewed: 2026-06-07
reviewer: Staff Engineer (review adversarial de segurança — gsd-code-reviewer + gsd-security-auditor)
depth: deep
mode: read-only
files_reviewed:
  - middleware.ts
  - src/server/auth/verifySession.ts
  - src/server/auth/googleCerts.ts
findings:
  blocker: 0
  warning: 4
verdict: APROVADO COM RESSALVAS
---

# Review TASK-10 — Middleware /admin/* (jose)

## Veredito: APROVADO COM RESSALVAS

A verificação criptográfica do session cookie está CORRETA e fail-closed: endpoint de
certs certo, `iss`/`aud` corretos, `algorithms:["RS256"]` (bloqueia `alg=none`/confusão),
`kid` obrigatório, projectId ausente → bloqueia, qualquer erro → invalid → `/login`. Não
encontrei bypass de autorização. Quatro WARNINGs sobre defesa em profundidade, cobertura
do matcher e cache de certs.

## Checks de segurança críticos (resultado)

| Check | Resultado | Evidência |
|---|---|---|
| Endpoint de certs correto (session cookie) | OK | `verifySession.ts:25-26` `identitytoolkit/v3/relyingparty/publicKeys` (NÃO o de ID token). |
| `iss = https://session.firebase.google.com/<pid>` | OK | `verifySession.ts:96`. |
| `aud = <projectId>` | OK | `verifySession.ts:97`. |
| `alg` RS256 fixo (anti `alg=none`/confusão) | OK | `verifySession.ts:95` `algorithms:["RS256"]`; `importX509(pem,"RS256")` (`:90`). |
| Fail-closed em qualquer erro | OK | `verifySession.ts:101-104` catch → INVALID; nunca lança. `middleware.ts:41-43` invalid → `/login`. |
| projectId ausente → bloqueia | OK | `verifySession.ts:70` `!projectId` → INVALID; `middleware.ts:36` default `""`. |
| `kid` obrigatório / `kid` forjado | OK | sem `kid` → INVALID (`:78`); `kid` sem cert → INVALID (`:85`); jwtVerify ainda valida assinatura contra o cert real. |
| `exp`/`iat`/`nbf` validados | OK | delegado ao `jose.jwtVerify` (`:94`); testado (`verifySession.test.ts:120`). |
| Cache de certs respeita max-age | OK | `googleCerts.ts:53-54` parse `max-age` do `Cache-Control`; serve do cache até expirar. |
| Defense-in-depth documentado | PARCIAL (WR-01) | spec §4 + `middleware.ts:16-24` listam camadas, mas o enforcement server real (API Routes Admin SDK) NÃO existe ainda no código. |

## Warnings

### WR-01 — Defense-in-depth descrita mas NÃO implementada (middleware é a ÚNICA defesa server-side hoje)
**Arquivo:** `middleware.ts:16-24` (doc) + ausência de `src/app/admin/**` e de API Routes admin
**Issue:** O spec e o comentário do middleware afirmam que a autorização REAL fica nas API
Routes (Admin SDK), nas Firestore Rules e no `AdminGuard` client — tratando o middleware
como "1ª camada, não a única". Verifiquei: **não existe nenhuma rota `/admin/**`** nem
nenhuma API Route que faça `verifySessionCookie`/`verifyIdToken` + checagem de `role`
server-side. Logo, no estado atual, o middleware edge é a ÚNICA verificação server-side de
admin, e ele tem limitação conhecida (role congelado por até 5 dias; rebaixamento não
reflete até novo login). Não é bypass agora (não há painel admin a proteger), mas a
"defesa em profundidade" é aspiracional, não real. CRÍTICO acompanhar: quando o painel
`/admin` for criado, as API Routes que ele consome DEVEM fazer enforcement com Admin SDK —
não confiar no middleware.
**Fix sugerido:** registrar como dependência bloqueante do PRD que introduzir `/admin/*`:
toda mutação admin exige `verifyIdToken/verifySessionCookie` + recheck de `role` (e idealmente
`status`) no doc via Admin SDK, independente do middleware.

### WR-02 — Matcher pode não cobrir `/admin` exato (sem subpath) de forma confiável
**Arquivo:** `middleware.ts:55-57`
**Issue:** `matcher: ["/admin/:path*"]`. No Next.js o segmento `:path*` casa zero-ou-mais
segmentos, então `/admin` (raiz) deveria casar — mas o comportamento de raiz exata vs
`/admin/` varia entre versões e há histórico de pegadinhas. Não há teste E2E do matcher
(spec §7/§9.5 admite). Se `/admin` exato escapar do middleware e existir uma página nele,
fica desprotegido no edge.
**Fix sugerido:** usar matcher explícito cobrindo ambos, ex.: `["/admin", "/admin/:path*"]`,
e adicionar smoke test pós-deploy conforme spec §7.

### WR-03 — Cache de certs sem fallback ao último valor bom em falha de rede
**Arquivo:** `src/server/auth/googleCerts.ts:41-55`
**Issue:** Quando o cache expira, um fetch que falha (rede/HTTP não-200) LANÇA, e
`verifySession` trata como invalid → todo admin é redirecionado a `/login` até o endpoint
voltar (negação de serviço para admins, fail-closed). É a escolha segura (não concede
acesso), mas frágil: uma intermitência do Google derruba o acesso admin. Além disso, se o
endpoint não enviar `Cache-Control`, `parseMaxAgeSeconds` retorna 0 → `expiresAt = now` →
o cache NUNCA é servido (re-fetch a cada request), amplificando o problema.
**Fix sugerido:** em falha de fetch, servir o cache anterior mesmo expirado (stale-while-error)
por uma janela curta; aplicar um `max-age` mínimo default (>0) quando o header faltar.

### WR-04 — Constante `__session` duplicada como literal (drift de nome)
**Arquivo:** `middleware.ts:30` vs `src/app/api/auth/session/route.ts:26`
**Issue:** O nome do cookie é literal nos dois lados. Spec justifica (evitar puxar o
Route Handler `runtime=nodejs` para o bundle edge). Risco baixo, mas se um lado mudar o
nome o middleware silenciosamente para de ler o cookie → todo `/admin` redireciona a
`/login` (fail-closed, mas quebra acesso admin sem erro). 
**Fix sugerido:** extrair o literal para um módulo compartilhado SEM dependências de runtime
(ex.: `src/server/auth/constants.ts`) e importar nos dois.

## Verificação
- `npx tsc --noEmit` (root): **sem erros** (exit 0).
- Dep `jose ^6.2.3` adicionada (edge-compatible); nenhuma dependência Node no caminho do
  middleware. Nenhum segredo hardcoded; nenhum `any`.
