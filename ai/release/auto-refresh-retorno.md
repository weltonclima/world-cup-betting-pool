# RELEASE PLAN — Auto-refresh ao retornar à página

## 1. Release summary

Feature client-side pura: dados de ranking e resultados atualizam automaticamente ao retornar à página, sem refresh manual.

Duas mudanças de config React Query:
- **TASK-01** — `refetchOnWindowFocus: "always"` no QueryClient global (`QueryProvider.tsx`). Cobre troca de aba/janela.
- **TASK-02** — `refetchOnMount: "always"` em 5 hooks (`useRanking`, `usePoolRanking`, `usePoolRankingByScope`, `useMatches`, `useNextMatch`). Cobre navegação interna de volta.

Arquivos: 6 de produção + 1 teste. Sem mudança de server, API, schema, ou Firestore.

## 2. Deployment prerequisites

Nenhum novo. Deploy padrão App Hosting (`deploy:hosting`). Sem env var nova, sem migração, sem feature flag.

## 3. Data and migration considerations

Nenhuma. Sem schema, backfill, ordering ou compatibilidade. Mudança de comportamento de cache no browser — efetiva no próximo carregamento do bundle pelo usuário.

## 4. Rollout strategy

**Release direto.** Mudança de baixo risco, reversível por deploy, sem estado persistente. Não requer flag nem rollout faseado.

## 5. Monitoring and validation

- Pós-deploy: abrir `/matches` e `/rankings`, trocar de aba/navegar e voltar → confirmar refetch (Network tab ou dado atualizado).
- Observar volume de requisições a `/api/matches`, `/api/rankings/*` — esperado aumento modesto (dispara em foco/mount, não polling). Servidor tem cache Next.js absorvendo.

## 6. Risks

| Risco | Severidade | Nota |
|---|---|---|
| Aumento de requisições | Baixo | Eventos discretos, não polling. Cache server-side. |
| Refetch global em rotas admin | Baixo | Poucos usuários, payloads pequenos, sem side-effects. |
| Interação com refetchInterval do bracket | Nenhum | Independentes; foco só adiciona 1 disparo inofensivo. |

## 7. Rollback considerations

Reverter os 2 commits (ou o PR) e re-deploy. Sem estado a limpar — rollback instantâneo e limpo.

## 8. Release checklist

- [x] Lint (`npm run lint`) exit 0
- [x] Typecheck (`tsc --noEmit`) exit 0
- [x] Test (`vitest run`) 3421/3421 verde
- [x] Build (`next build`) exit 0
- [ ] Commit + PR
- [ ] Merge em `main`
- [ ] `deploy:hosting`
- [ ] Smoke test pós-deploy (troca de aba + navegação de volta em /matches e /rankings)
