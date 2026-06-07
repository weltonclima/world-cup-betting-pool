# REVIEW — TASK-01 · Mover camada de integração API-Football para `src/server`

> Commit: `ac0ead7` · Spec: `ai/spec/integracao-api-football-task-01.md` · Plano: `ai/plan/integracao-api-football.md` (TASK-01)
> Revisão adversarial (stance FORCE) · READ-ONLY · Idioma: pt-BR

## 1. Objetivo da revisão

Confirmar que a camada de integração (client/mock/factory/types/config) foi disponibilizada sob `src/server/apiFootball` mantendo:
(a) API pública idêntica; (b) garantia server-only sem quebrar testes; (c) cópia fiel (sem regressão de lógica); (d) escopo (copiar, não mover; functions intactos até T11).

## 2. Evidências coletadas

- `git diff ac0ead7:functions/...:src/server/...` para `client.ts` e `factory.ts`: **somente comentários/cabeçalho diferem**; lógica idêntica. `types/config/mock` idênticos no commit.
- Barrel `src/server/apiFootball/index.ts` tem `import "server-only"` e reexporta toda a superfície pública (`getApiFootballClient`, classes de erro, `HttpApiFootballClient`, `MockApiFootballClient`, `MOCK_TEAMS`/`MOCK_FIXTURES`, `COPA_2026_CONFIG`, `isUseMockFallback`, tipos). Confirmado igual à promessa da spec §2/§3.
- Testes co-localizados importam módulos concretos (`../client`, `../mock`, `../factory`) — **nunca o barrel** — evitando o throw do `server-only` sob vitest (decisão §3 da spec aplicada corretamente).
- `npx tsc --noEmit`: exit 0.
- `npx vitest run src/server` (JSON, não resumo RTK): 100/100; os 15 testes desta camada (`client.http` 12, `client.mock` 4 — total 15+ via it.each) verdes.
- Sem imports dangling de `functions/src/apiFootball` em `src/` (grep limpo).

## 3. Achados

Nenhum BLOCKER. Nenhum WARNING acionável.

### Notas (não-classificadas, informativas — sem ação obrigatória)

- **N-01 (doc):** O cabeçalho de `client.ts` cita "App Hosting (Cloud Run) ... secret exposto como env var", enquanto o CLAUDE.md (regra 7) ainda fala em Cloud Functions. Divergência esperada do pivô PRD-07 v2.0; tratada como nota de doc, não defeito de código.
- **N-02 (risco residual já documentado):** Import profundo `@/server/apiFootball/client` burla o marker do barrel. Mitigado por convenção `src/server/**` e pela chave nunca ser `NEXT_PUBLIC_`. Endurecimento ESLint (`no-restricted-imports`) fica para T04+. Aceitável nesta task.
- **N-03 (segurança — OK):** A chave é lida só via `process.env["API_FOOTBALL_KEY"]` no factory/client (server). Nenhum `NEXT_PUBLIC_`. Nenhum segredo hardcoded. `config.ts` contém apenas IDs placeholder de torneio (não-secretos).

## 4. Verdict

**approved**

Cópia fiel, API pública preservada, server-only corretamente isolado no barrel, testes verdes e tsc limpo. Escopo respeitado (functions não removidos; mappers fora — T02).
