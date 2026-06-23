# RELEASE PLAN — Ranking Fase Eliminatória (PRD-16)

> PRD: `ai/prd/ranking-eliminatorias.md` · PLAN: `ai/plan/ranking-eliminatorias.md`
> Branch: `fix/home-screen-data-bugs` · Deploy: Firebase App Hosting (Next.js SSR/SSG)

## 1. Release summary

Entrega do ranking agregado das eliminatórias + exposição na UI. 5 tasks (TASK-01..05) done.

- **TASK-01** — `rankingScopeSchema` ganha scope `"eliminatorias"` (agregado, não 1-stage→1-scope).
- **TASK-02** — `recalcRankings()` computa e persiste agregado das 5 fases mata-mata (`dezesseis-avos + oitavas + quartas + semifinal + final`): docs `rankings/eliminatorias` (global) + `pool-{poolId}-eliminatorias` (re-rankeado por `byElimination.points`). Cleanup de órfão estendido. **`RECALC_VERSION` 3 → 4** (shape muda).
- **TASK-03** — `PhaseRanking.tsx` split em dois blocos (Grupos / Eliminatórias) + card agregado em destaque. D2: nenhum card de `dezesseis-avos`.
- **TASK-04** — Home: banner discreto "Copa em: {fase}" via `deriveCurrentStage` + `STAGE_LABEL` (pt-BR, novo `matches/lib/stageLabels.ts`).
- **TASK-05** — Gate verde ponta-a-ponta.

Áreas afetadas: schema de ranking, cron/recalc de scoring, Route Handlers `/api/rankings/[scope]` e `/pool/[scope]` (aceitam novo scope por validação de schema, sem mudança de código), tela de rankings, Home.

## 2. Deployment prerequisites

- Merge da branch → `main`.
- Sem mudança de env vars. Sem nova dependência. Sem mudança de Firestore rules/indexes (agregado usa mesma coleção `rankings/`, doc-id novo).
- Build de hosting (`build:hosting`) verde — confirmado localmente (`next build` 60/60 pages, exit 0).

## 3. Data and migration considerations

- **Sem migration manual / sem backfill script.** O bump `RECALC_VERSION 3→4` é um **gate de shape**: na primeira leitura pós-deploy, `ensureRankingsFresh` detecta `version !== 4` e força 1 recompute on-read, que grava os novos docs `eliminatorias`. O cron de scoring também regrava no próximo ciclo.
- **Ordering:** schema (`eliminatorias` no enum) precede recalc gravando o doc — garantido por estarem no mesmo deploy. UI degrada com `null` se o doc agregado ainda não existir (primeira leitura).
- **Órfãos:** cleanup já inclui `pool-{id}-eliminatorias` em `ownedByLivePool` — não apaga docs de pool vivo.
- **D2 (invariante):** `dezesseis-avos` conta no agregado (path próprio, fora de `RANKING_STAGE_SCOPES`) mas não tem card. Coberto por testes em ambas camadas.

## 4. Rollout strategy

**Direct release (deploy único, sem feature flag).** Justificativa: mudança aditiva (novo scope/doc/bloco UI), idempotente, com recompute automático on-read. Não há flag no projeto para esse caminho e o risco é baixo-contido.

- Primeira leitura de cada scope dispara 1 recompute (custo controlado por fingerprint + score_state — ver commit `72366bc`). Esperar leve pico de reads/writes no primeiro acesso pós-deploy.

## 5. Monitoring and validation

Pós-deploy:
- Abrir tela de rankings → confirmar bloco Eliminatórias com card agregado + oitavas/quartas/semi/final, **sem** card dezesseis-avos.
- Conferir que `rankings/eliminatorias` e `rankings/_freshness.version === 4` foram gravados (1ª leitura).
- Home → banner "Copa em: {fase atual}" coerente com o próximo jogo agendado/ao vivo.
- Validar `GET /api/rankings/eliminatorias` e `/api/rankings/pool/eliminatorias` respondem 200.
- Observar reads/writes do recalc no primeiro ciclo (pico esperado, deve estabilizar).

## 6. Risks

- **Técnico (baixo):** recompute on-read no 1º acesso adiciona latência pontual à primeira request de ranking pós-deploy. Mitigado pelo corte via fingerprint.
- **Dados (baixo):** se denominador `finishedElimination` divergisse do numerador, aproveitamento inflaria — coberto por teste, não observado.
- **Compat (baixo):** scope novo aceito por schema; clientes antigos ignoram doc desconhecido.
- **Blind spot:** sem alerta dedicado de custo de recompute — observar manualmente o 1º ciclo.

## 7. Rollback considerations

- Reverter o deploy (re-deploy do commit anterior em App Hosting). Código antigo volta a `RECALC_VERSION = 3` → força 1 recompute de volta ao shape antigo na próxima leitura.
- Docs `pool-*-eliminatorias` deixados pelo código novo viram órfãos benignos sob o código antigo (não lidos, não quebram nada); limpáveis manualmente se desejado. `rankings/eliminatorias` global idem.
- Sem perda de dados: agregado é derivado de palpites/partidas existentes, recomputável a qualquer momento.

## 8. Release checklist

- [ ] Branch revisada e mergeada em `main`.
- [ ] CI/local gate verde: lint (0 err), typecheck, test (3155 pass), format, build.
- [ ] `RECALC_VERSION === 4` confirmado no código deployado.
- [ ] Deploy App Hosting (`build:hosting` → deploy).
- [ ] 1ª leitura pós-deploy grava `eliminatorias` + `_freshness.version=4`.
- [ ] Smoke: tela rankings (split + D2 sem dezesseis-avos), Home banner, endpoints `eliminatorias`.
- [ ] Observar 1º ciclo de recalc (reads/writes) por ~1 janela de cron.
- [ ] Plano de rollback ciente (re-deploy commit anterior).
