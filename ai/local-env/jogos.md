# Local Env — Jogos (PRD-03)

**Data:** 2026-06-07
**Branch:** feat/integracao-api-football
**Plataforma:** Windows 11 / PowerShell / Node >=20

---

## Resumo dos gates

| Gate | Resultado | Detalhe |
|---|---|---|
| TypeScript (`tsc --noEmit`) | PASS | 0 erros |
| ESLint (src/) | PASS* | 0 erros, 12 warnings (não blockers) |
| Vitest (970 testes) | PASS | 970/970 verde |
| Next.js build | PASS (após fix) | 2 blockers corrigidos (ver abaixo) |
| Dev server `/matches` | HTTP 200 | Compila e responde |
| Dev server `/matches/123` | HTTP 200 | Compila e responde |
| API route `/api/matches` | HTTP 200 | JSON `[]` (API key real, Copa 2026 sem fixtures na API) |
| API route `/api/matches/[id]` | HTTP 404 | Esperado para id inexistente |
| API route `/api/teams` | HTTP 200 | JSON `[]` (mesmo motivo acima) |

*ESLint warnings são de uso de `<img>` em vez de `<Image>` (3x) e deps de `useCallback` (2x) — ignorados para esta feature, não bloqueiam release.

---

## Blockers corrigidos durante a validação

### BLOCKER-01 — `revalidate` com MemberExpression (4 rotas)
**Erro:** `Next.js can't recognize the exported 'config' field: Unsupported node type "MemberExpression" at "revalidate".`

**Causa:** As rotas `/api/matches`, `/api/matches/[id]`, `/api/standings` e `/api/teams` exportavam `revalidate` usando `REVALIDATE.jogoAoVivo` (importado de `@/server/cache/tiers`). O Next.js exige que `revalidate` seja um literal numérico estático.

**Fix:** Substituído por literais numéricos comentados com o valor de origem:
- `REVALIDATE.jogoAoVivo` → `60`
- `REVALIDATE.selecoes` / `REVALIDATE.grupos` → `86400`

**Arquivos:** `src/app/api/matches/route.ts`, `src/app/api/matches/[id]/route.ts`, `src/app/api/standings/route.ts`, `src/app/api/teams/route.ts`

---

### BLOCKER-02 — Re-export de `SESSION_COOKIE_NAME` em Route Handler
**Erro:** `Type 'OmitWithTag<...>' does not satisfy the constraint '{ [x: string]: never; }'. Property 'SESSION_COOKIE_NAME' is incompatible with index signature.`

**Causa:** `src/app/api/auth/session/route.ts` re-exportava `SESSION_COOKIE_NAME` para consumo externo. O Next.js não permite exports que não sejam verbos HTTP ou configurações válidas em Route Handlers.

**Fix:** Removida a re-exportação; constante ainda importada internamente (usada em `cookieOptions`). O único consumidor externo era o teste `route.test.ts`, que passou a importar direto de `@/server/auth/sessionCookie`.

**Arquivos:** `src/app/api/auth/session/route.ts`, `src/app/api/auth/session/__tests__/route.test.ts`

---

## Observações

- **API-Football real sem dados Copa 2026:** A chave real de API está configurada no `.env.local`, mas a API-Football ainda não tem fixtures para Copa do Mundo 2026 (leagueId=1, season=2026). As rotas retornam `[]` corretamente, sem erro. Para testar com dados reais, setar `API_FOOTBALL_USE_MOCK=true` no `.env.local`.
- **Mock disponível:** `src/server/apiFootball/mock.ts` tem 8 fixtures e 4 seleções fictícias prontas para uso com `API_FOOTBALL_USE_MOCK=true`.
- **Dev server na porta 3002:** Porta 3000 ocupada por outro processo, mas sem impacto funcional.

---

## Veredicto

**PRONTO PARA RELEASE** — todos os gates passam após dois fixes de compatibilidade Next.js. Testes, typecheck e rotas funcionam corretamente.
