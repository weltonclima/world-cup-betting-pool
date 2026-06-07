# REVIEW (adversarial) — TASK-04 · Route Handlers /api (matches, teams, standings)

> Commit: `5956680` · Spec: `ai/spec/integracao-api-football-task-04.md`
> Reviewer: Staff Engineer (skill /review) · Stance: FORCE · Read-only
> Arquitetura: PRD-07 v2.0 (dados via Route Handlers + cache Next, não Firestore). Regra 7 do CLAUDE.md ("via Cloud Functions") está DESATUALIZADA → nota de doc, não blocker.

## Verdict: **approved with adjustments** (0 BLOCKER · 3 WARNING)

`tsc --noEmit` exit 0. Suíte `src/app/api` verde (parte dos 79 testes rodados). Rotas implementadas conforme spec (4 rotas, cache por tier, mapeamento de erro→HTTP centralizado, validação Zod de saída, chave nunca exposta). Nenhum defeito de correção ou segurança que bloqueie. Achados abaixo são robustez/qualidade.

## Escopo / Arquitetura
- Entregou as 4 rotas previstas (`matches`, `matches/[id]`, `teams`, `standings`) + helpers compartilhados (`_lib/apiFootballError.ts`, `_lib/apiFootballData.ts`). Aderente ao §2/§9 da spec.
- `export const revalidate` por rota a partir de `@/server/cache/tiers` (sem hardcode) — correto (§5). Nenhum uso de `cookies()`/`headers()` → rotas cacheáveis e sem dado por-usuário (§6). **Verificado**.
- `standings` deriva grupos de `teams` (A1), ordena `groups` por `groupId` e `teams` por `name`, separa `ungrouped`. Correto.

## Segurança (foco da task)
- **Chave API:** `API_FOOTBALL_KEY` lida apenas em `@/server/apiFootball`; os handlers só chamam `getApiFootballClient()`. Nenhum handler toca `process.env`. **OK**.
- **Vazamento em erro:** `apiFootballErrorResponse` usa mensagens fixas em pt; `ApiFootballAuthError` (cujo texto interno cita `API_FOOTBALL_KEY`) é mapeado para mensagem genérica "Falha na integração com a API de dados." (502), sem ecoar o erro nem stack. **OK** — não há vazamento de segredo na resposta.
- **Entrada validada:** a única entrada do client é o path param `id` em `matches/[id]`, usado apenas em comparação de igualdade (`m.id === id`) contra dados internos — sem injeção, sem I/O dirigido pela entrada. Saída validada com `matchSchema`/`teamSchema` antes de responder. **OK**.
- **Cacheável sem cookies:** confirmado, nenhuma API dinâmica usada.

## Correção (cache tier / erros / cota)
- Cache: matches/[id] = `jogoAoVivo` (60s); teams = `selecoes` (24h); standings = `grupos` (24h). Bate com a tabela §2/§5. Tradeoff de cota documentado na spec §5 (60s base único, granularidade fina no client) — decisão consciente, não defeito.
- Erros do client → HTTP: quota 503 / auth 502 / timeout 504 / ZodError 500 / genérico 500. Bate com §4.

## Achados

### WR-01 (WARNING) — Erros de negócio do mapper caem em 500 genérico mascarando a causa
**Arquivo:** `src/app/api/_lib/apiFootballData.ts:53` (chama `mapApiFixtureToFirestore`) + `src/app/api/_lib/apiFootballError.ts:60`
**Issue:** `mapApiFixtureToFirestore` lança `Error` puro (não `ZodError`) em dois casos previsíveis: time fora do `teamIdMap` (`matchMapper.ts:164/170`) e round não reconhecido (`matchMapper.ts:53`). Esses caem no ramo genérico → 500 "Erro inesperado ao obter os dados.", indistinguível de falha real de rede. Com dados reais da API-Football (um time/round novo), `/api/matches` retorna 500 opaco e nada é logado (a spec §4 diz "log fica só no servidor, não obrigatório nesta task" — então não há log). Diagnóstico em produção fica cego.
**Fix:** logar `console.error(err)` no ramo genérico de `apiFootballErrorResponse` (sem expor ao client), e/ou tratar erro de mapeamento como 502 (upstream-shape). Mínimo: adicionar o log para não perder a causa.

### WR-02 (WARNING) — Dupla validação Zod redundante (mapper já faz `parse`)
**Arquivo:** `src/app/api/_lib/apiFootballData.ts:53-55` e `:68-69`
**Issue:** `mapApiFixtureToFirestore`/`mapApiTeamToFirestore` já validam o output com `matchSchema.parse`/`teamSchema.parse` internamente (`matchMapper.ts:204`). Em seguida `fetchAllMatches`/`fetchAllTeams` chamam `matchSchema.parse(match)`/`teamSchema.parse(team)` de novo sobre o objeto já validado. É parse redundante por item (a spec §I "valida cada item com .parse" não exige duas vezes). Não é bug, mas é trabalho duplicado e confunde quem mantém ("por que validar de novo?").
**Fix:** remover o segundo `parse` em `fetchAllMatches`/`fetchAllTeams` (o mapper já garante o contrato), ou comentar explicitamente que é defesa-em-profundidade intencional. Preferível remover.

### WR-03 (WARNING) — `fetchAllMatches` chamado por inteiro em `/api/matches/[id]` (sem early-return)
**Arquivo:** `src/app/api/matches/[id]/route.ts:25-26`
**Issue:** o handler de detalhe busca teams+fixtures, mapeia/valida **todas** as partidas e só então faz `.find`. Funcionalmente correto e aceitável dado que a API tem endpoint único de fixtures (documentado), mas qualquer fixture inválida (vide WR-01) faz `/api/matches/[id]` quebrar com 500 mesmo quando o id pedido é uma partida válida — uma má fixture derruba a consulta de qualquer outra. Acoplamento de falha.
**Fix:** considerar mapear lazय/por-item com try-per-item, ou ao menos registrar que a robustez por-item depende de todas as fixtures serem mapeáveis. Não bloqueia (perf fora de escopo v1), mas o acoplamento de falha é o ponto.

## Testes
- Cobertura por rota presente (`__tests__/route.test.ts` em cada uma): sucesso + quota/auth; matches/[id] cobre 404; standings cobre agrupamento ordenado + `ungrouped` vazio. Mock só do barrel `@/server/apiFootball` (mappers/tiers reais) — bom teste de integração leve.
- **Gap (não-blocker):** nenhum teste cobre o caminho ZodError→500 com dado real fora de contrato, nem o caso de mapper lançando `Error` (WR-01). Os testes usam `validFixtures.ts` normalizado, então o drift de data (já corrigido pelo FIX kickoffAt) não é exercitado de ponta a ponta aqui.

## Risco
Baixo. As 3 WARNINGs são observabilidade/robustez. O risco real de produção é WR-01 (500 opaco sem log) caso a API-Football traga round/time não mapeado — recomendo endereçar antes de plugar credenciais reais.

---
_Reviewer: Claude (skill /review) — adversarial · read-only_
