# RELEASE PLAN — Performance Optimization & Security Hardening

## 1. Release summary

10 tasks entregues a partir de auditoria rígida (bugs, segurança, performance). Todas client-side ou Route Handlers — **sem mudança de schema, Firestore Rules, env vars ou infra**.

| Task | Tipo | Efeito |
|---|---|---|
| 01 | perf | Home: `/api/matches` 3×→1× (deriva next/recent do flatList) |
| 02 | perf | teams/predictions 2×→1× (namespaces unificados via re-export) |
| 04 | perf | `useMatchesList` memoizado + `deriveMatchPredictionStatus` O(n²)→O(n) |
| 05 | perf | pipeline de filtro do `MatchList` memoizado |
| 06 | perf | `React.memo(MatchCard)` + props estáveis |
| 07 | 🔒 seg | `usePredictions` queryKey por uid (cache leak entre contas) |
| 08 | 🔒 seg | `predictions/[uid]` exige mesmo pool (vazamento cross-tenant) |
| 09 | 🔒 seg | redeem idempotente + re-check status/role em score/recalc |
| 10 | UX | render progressivo na Home (loading por card) |
| 11 | UX | background refetch sem flash (keepPreviousData) |

TASK-03 (pênaltis) fechada como by-design por decisão do usuário (sem código).

Deploy alvo: **Firebase App Hosting (Cloud Run, SSR)**, projeto `world-cup-betting-pool-8e93c`.

## 2. Deployment prerequisites

- Gate verde confirmado: **3454 testes ✓, typecheck ✓, lint 0 errors, `next build` ✓**.
- Nenhuma env var nova. Nenhum secret novo.
- Nenhuma migração de dados. Nenhuma mudança em `firestore.rules`/`indexes`.
- Merge de `feat/auto-refresh-on-return` → `main` (via PR).
- Deploy padrão: `npm run deploy:hosting` (App Hosting build do commit de `main`).

## 3. Data and migration considerations

- **TASK-09/S2** cria a subcoleção `invites/{code}/redemptions/{uid}` sob demanda (primeiro resgate após deploy). É **server-only por deny-by-default** — não requer alteração de Rules (nenhuma regra = acesso client negado; Admin SDK bypassa). Convites emitidos antes do deploy: o primeiro resgate pós-deploy cria o subdoc; resgates já contabilizados antes continuam válidos (o `usedCount` histórico não é reprocessado — apenas o comportamento futuro fica idempotente).
- **TASK-07** muda a queryKey de palpites de `["predictions"]` para `["predictions", uid]` — cache **client-side** apenas; usuários com o app aberto durante o deploy revalidam no próximo foco/mount (auto-refresh). Sem impacto de dados.
- Sem backfill. Sem ordering constraint.

## 4. Rollout strategy

**Release direto (single deploy), sem feature flag.**

Justificativa: mudanças de baixo risco, cobertas por 3454 testes, sem migração nem mudança de contrato. As correções de segurança (07/08/09) devem ir para produção o quanto antes durante a Copa. Não há valor em rollout gradual — App Hosting não suporta canary nativo trivial, e o risco não justifica a cerimônia.

Sequência:
1. Abrir PR `feat/auto-refresh-on-return` → `main`.
2. Merge após review.
3. `npm run deploy:hosting` (ou deploy automático do App Hosting no push para `main`, se configurado).
4. Smoke test pós-deploy (ver §5).

## 5. Monitoring and validation

Pós-deploy, validar manualmente (smoke):
- **Home** carrega e mostra cards progressivamente (hero pode aparecer após os cards de jogos). Verificar no DevTools Network: **1×** `GET /api/matches`, **1×** `/api/teams` (não 3×/2×).
- **Jogos**: digitar na busca não trava; filtros/abas respondem; cards não re-renderizam em cascata.
- **Ranking**: trocar abas Grupos↔Eliminatórias (pool com split ON) não pisca skeleton.
- **Segurança**: `GET /api/predictions/<uid-de-outro-pool>` retorna **403** (S1). Navegador compartilhado: logout/login não vaza palpites (B2).
- **Cron**: próximo disparo de `/api/predictions/score` (GitHub Actions) continua 200 via `x-cron-secret` (S3 não afeta o caminho de secret).

Observar: logs do App Hosting para 500 inesperados em `predictions/[uid]` (novas leituras de user doc) e `invite/[code]/redeem`.

## 6. Risks

| Risco | Sev | Mitigação |
|---|---|---|
| TASK-08 quebra UX legítima se perfil de outro participante for acessado cross-pool | Baixo | Entries de ranking de pool só expõem uids do próprio pool → fluxo legítimo é sempre same-pool; super_admin tem bypass. Smoke test cobre. |
| TASK-09/S3 rejeita um disparo manual de admin `blocked` ou super_admin canônico mal configurado | Baixo | Comportamento correto (fail-closed). Caminho cron por secret intacto. |
| Memoização (04/05/06) com dep sutil congela derivação | Baixo | Testes de identidade referencial + 3454 testes de regressão verdes. |
| `keepPreviousData` exibe dados do scope/perfil anterior por ~1 frame | Aceito | É o comportamento desejado (stale-while-revalidate, decisão do usuário). |
| Subcoleção `redemptions` sem Rule explícita | Baixo | Deny-by-default cobre; Admin SDK bypassa. Confirmar que `firestore.rules` não tem `match /{document=**}` permissivo (não tem — deny-by-default). |

## 7. Rollback considerations

- **Rollback trivial**: reverter o deploy para o commit anterior em App Hosting (todas as mudanças são código; sem migração destrutiva).
- Subdocs `redemptions` criados permanecem inofensivos após rollback (código antigo simplesmente os ignora e volta a incrementar sem idempotência — comportamento pré-fix).
- Cache client-side (TASK-07/11) se auto-corrige no rollback (nova queryKey some; volta à antiga no próximo mount).
- Sem estado irreversível introduzido.

## 8. Release checklist

- [ ] PR aberto: `feat/auto-refresh-on-return` → `main`
- [ ] Review aprovado
- [ ] Gate verde reconfirmado no CI (lint, typecheck, test, build)
- [ ] Merge para `main`
- [ ] Deploy App Hosting (`npm run deploy:hosting` ou push automático)
- [ ] Smoke test Home (1× /api/matches no Network; cards progressivos)
- [ ] Smoke test Jogos (busca fluida)
- [ ] Smoke test Ranking (troca de aba sem flash)
- [ ] Verificar 403 em `predictions/[uid]` cross-pool (S1)
- [ ] Confirmar próximo cron `/score` 200 (S3)
- [ ] Monitorar logs App Hosting por ~1h (500 em predictions/[uid], redeem)
