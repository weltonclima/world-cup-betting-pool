# REVIEW — TASK-05 (grupos-eliminatorias): Service + hooks React Query

> Spec: `ai/spec/grupos-eliminatorias-task-05.md`
> Verdict: **APROVADO com fixes aplicados** (1 BLOCKER + 2 WARNING + 2 gaps de teste — todos resolvidos)

## Escopo revisado
8 arquivos (service + hooks + barrels + testes):
- `src/services/worldcup.ts`, `src/services/_apiClient.ts` (refactor dedup), `src/services/index.ts`
- `src/features/worldcup/hooks/{worldcupKeys,useGroups,useBracket,index}.ts`
- `src/services/__tests__/worldcup.test.ts`, `src/features/worldcup/hooks/__tests__/worldcupHooks.test.tsx`

Review independente via `gsd-code-reviewer` (gate: diff ≥ 5 arquivos).

## Achados e resolução

### BLOCKER — BL-01: colisão de query-key `["groups"]`
A feature irmã `groups` (pool de apostas) já ocupa `["groups"]` (`groupsKeys.all`). Como o React Query casa invalidação por **prefixo** no QueryClient compartilhado, `useCreateGroup` → `invalidateQueries(["groups"])` derrubaria a classificação da Copa (query cara, backed por openfootball). Ambas as features novas no branch `prd-09`.
**Fix:** keys da Copa namespaced sob `["worldcup", …]` (espelha `matchesKeys` → `["matches", …]`). PRD literal cede para preservar coerência de cache. ✅

### WARNING — WR-01: drift entre `useGroups` e `useGroupStandings`
Os dois hooks observam a mesma cache entry; `queryKey/queryFn/staleTime/refetchInterval` precisam ser idênticos. Estavam copiados → risco de divergência futura.
**Fix:** extraído `groupsQueryOptions()` compartilhado; `useGroupStandings` só acrescenta `select`. ✅

### WARNING — WR-02: duplicação de `httpError` vs `buildHttpError`
O guard de parsing do corpo `{ error }` estava reduplicado (o `_apiClient.ts` foi criado justamente p/ dedup).
**Fix:** extraído `extractErrorDetail(res)` em `_apiClient.ts`; `buildHttpError` e `worldcup.ts:httpError` reusam. Só a construção do erro tipado fica local. ✅

### Gaps de teste
- **WR-03:** `refetchInterval` não exercido. → +3 testes com fake timers: live → poll 60s (T7); sem live → sem poll (T8); bracket → sem poll (T9). ✅
- **WR-04:** path de detalhe de `httpError` não testado. → T2 agora assere detalhe anexado; T2b cobre corpo não-JSON → fallback. ✅

## Verificado sólido (sem ação)
- Desvio #1 (`select` sobre `["worldcup","groups"]`, sem entry por grupo) — correto, `undefined` p/ grupo inexistente coberto (T4).
- Desvio #2 (`useBracket` sem `refetchInterval`) — `bracketResponseSchema` `.strict()` sem `hasLiveGroupMatch`; rationale válido.
- `refetchInterval: (query) => …` — assinatura v5 correta. Zod revalidação, status preservado em `WorldcupServiceError`, zero `any`, TS strict.

## Gate final
- `npx vitest run` → **2112 pass / 0 fail** (16 da TASK-05).
- `npx tsc --noEmit` → limpo.
- `npx eslint` (arquivos novos) → limpo.
- Sem regressão (`_apiClient` refactor não quebrou matches/teams).
