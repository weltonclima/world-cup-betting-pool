# RELEASE PLAN — Multi-Championship & Public Launch

> Épico de 21 tasks (todas `done`). Transforma o produto de torneio único (Copa
> 2026) em plataforma multi-campeonato auto-serviço. Dados 100% ESPN ao vivo; só
> histórico arquivado persiste. Validação local: lint 0 · vitest 4124/4124 (1280
> files) · `next build` 0 · `tsc` 0.

## 1. Release summary

O que entra em produção:

- **Fundação de dados (TASK-01→06)**: cliente ESPN multi-liga (23 slugs curados),
  `championshipSchema` + catálogo estático, **matchId namespaced** (`{championshipId}:{id}`)
  para campeonatos novos — a Copa (`fifa.world`) mantém ids BARE por compat de
  `predictions`/`rankings` legados.
- **Persistência/arquivamento (TASK-13/14)**: status de runtime em
  `championships/{id}` (override do catálogo) e snapshot congelado em `history/{docId}`,
  gravados só pelo pipeline de arquivamento (Admin SDK, bypassa Rules).
- **Config de pool & ranking (TASK-07/11/12/20/21)**: `enabledChampionships` por
  pool; **cron de scoring varre Copa (obrigatória) + ligas ativas habilitadas**
  (`type: "league"`, não-`archived`) best-effort; ranking geral e por-campeonato.
- **UI & Histórico (TASK-08/09/10/15)**: segmentação por campeonato, chaveamento,
  tela de Histórico.
- **Lançamento público (TASK-16/17/18)**: onboarding auto-serviço (`create-group`),
  convites, moderação no grupo, anti-abuso (verificação de e-mail → pool nasce
  `pending` até `activate-pool` promover).
- **TASK-19 (esta)**: observabilidade do sweep — `POST /api/predictions/score`
  passa a retornar `championshipsProcessed` (Copa + ligas ativas varridas com
  sucesso), cumprindo o contrato documentado em `score-cron.yml`.

Superfície de deploy alterada nesta branch: `firestore.indexes.json` (+1 índice),
`firestore.rules` (+2 matches), `functions/src/functions/promoteFirstAdmin.ts`,
`.github/workflows/score-cron.yml`, app (App Hosting / Next.js).

## 2. Deployment prerequisites

- **Secrets do cron já provisionados** no ambiente de produção: `SCORE_SECRET`
  (autoriza `POST /api/predictions/score`), `RANKINGS_SECRET` (recalc encadeado).
  Sem eles o encadeamento de recalc degrada silencioso.
- **Push (se aplicável ao release)**: `NEXT_PUBLIC_FIREBASE_VAPID_KEY` deve existir
  **no build** — ausência mata o push mudo (toggle some, tokens=0). Verificar antes
  do build de produção.
- Firebase project alvo: `world-cup-betting-pool-8e93c` (scripts `deploy:*`).
- Node `>=20` no runtime (App Hosting).
- Catálogo curado: só os 23 slugs aprovados no spike (TASK-01, 23/23) — nenhum slug
  reprovado a habilitar.

## 3. Data and migration considerations

- **Índice novo (ordering-first)**: `matches` composto `championshipId ASC + kickoffAt ASC`.
  **Deve ser criado ANTES** de o app servir queries que o usem — senão a query
  falha em produção (`FAILED_PRECONDITION`). `firebase deploy --only firestore:indexes`
  precede o deploy do app; aguardar o índice sair de "Building".
- **Rules novas**: `championships/{id}` e `history/{docId}` — leitura `isApproved()`,
  **escrita client `false`** (congelado imutável, só Admin SDK escreve). Deploy de
  rules antes/junto do app.
- **Sem backfill**: dados ao vivo vêm da ESPN; Copa legada intacta (ids BARE
  preservados). Nenhuma migração de `predictions`/`rankings` existentes.
- **Namespacing é aditivo**: campeonatos novos geram ids `{cid}:{id}` que não colidem
  com a Copa nem entre si; chaves de idempotência (`score_state[matchId]`) seguem
  únicas.
- **Compat de leitura vs escrita** (risco conhecido): rotas de leitura migraram para
  `getEffectiveMatches` (ESPN); confirmar que as rotas de escrita/score usam a mesma
  fonte efetiva para evitar 409 espúrio. Coberto pelos testes de sweep, mas monitorar.

## 4. Rollout strategy

**Gated + migration-first + monitoring-first.**

1. **Migration-first**: `deploy:rules` (rules + indexes) → aguardar índice pronto.
2. **Deploy functions**: `deploy:functions` (`promoteFirstAdmin` alterado).
3. **Deploy app**: `deploy:hosting`.
4. **Gate natural por pool**: campeonatos novos só são pontuados onde um pool os
   habilita via `enabledChampionships`. A Copa é default e não muda — **o blast
   radius é opt-in por admin de grupo**. Não precisa flag global adicional.
5. **Piloto controlado**: habilitar 1 liga não-Copa em 1 pool de teste; observar 1–2
   ciclos de cron (30 min cada) antes de liberar o catálogo aos demais admins.
6. `splitPhaseRanking` permanece `false` por default (opt-in de exibição, sem efeito
   de scoring).

## 5. Monitoring and validation

- **Cron logs** (`score-cron.yml` a cada 30 min): observar o corpo
  `{ scoredMatches, updatedPredictions, skippedMatches, championshipsProcessed }`.
  `championshipsProcessed` = 1 significa "só Copa varrida"; > 1 confirma ligas ativas
  entrando. Queda inesperada para 1 ⇒ fetch de liga falhando (best-effort engoliu).
- Warnings `[score] falha ao buscar partidas da liga <cid>` → fonte ESPN instável
  para aquela liga.
- Recalc encadeado: status do `POST /api/rankings/recalc` (warn se != 2xx).
- Rate-limit ESPN: sem SLA público — vigiar 429/timeout no primeiro dia com ligas
  habilitadas (TASK-01 não observou cap além de paginação em `bra.1`/`uefa.champions`).
- Arquivamento: confirmar que cleanup/recalc **não apaga** docs de liga `archived`
  (snapshot congelado protegido — hazard TASK-13/21).

## 6. Risks

**Técnicos**
- Índice `matches` ainda "Building" no deploy do app → queries falham até concluir
  (mitiga: migration-first + aguardar).
- Divergência fonte leitura vs escrita/score → 409 espúrio em recálculo (monitorar).
- Colisão de ids: cups geram ids BARE → **excluídos do scoring** (gated a
  `type: "league"`); habilitar cup no scoring sobrescreveria palpites da Copa.
  Garantido no código, mas é invariante crítica.

**Operacionais**
- ESPN sem SLA: liga instável degrada silenciosa (best-effort) — só visível via
  `championshipsProcessed` e warnings.
- Anti-abuso de onboarding depende de entrega de e-mail de verificação; SMTP fora →
  pools ficam `pending` (best-effort não quebra cadastro, mas usuário fica preso até
  verificar).

**Dados**
- Snapshot congelado de liga arquivada apagado por sweep de cleanup mal-escopado
  (hazard documentado) — validar após primeiro arquivamento real.

## 7. Rollback considerations

- **App/functions**: rollback padrão do App Hosting/Functions (redeploy da revisão
  anterior). Mudanças são retrocompatíveis — `championshipsProcessed` é aditivo;
  consumidores que faziam strict-match do corpo foram os testes (corrigidos).
- **Índice**: criar índice é seguro/reversível (pode remover depois); **não** derruba
  a Copa.
- **Rules**: as novas rules só ADICIONAM `championships`/`history` (read approved,
  no write) — remover reverte sem afetar coleções existentes.
- **Gate por pool**: para "desligar" um campeonato problemático sem rollback de
  código, basta um admin remover o cid de `enabledChampionships` — o sweep para de
  varrê-lo no próximo ciclo. Rollback operacional mais rápido que redeploy.

## 8. Release checklist

- [ ] `SCORE_SECRET` e `RANKINGS_SECRET` presentes no ambiente de produção.
- [ ] `NEXT_PUBLIC_FIREBASE_VAPID_KEY` presente no build (se push no escopo).
- [ ] `firebase deploy --only firestore:rules,firestore:indexes` executado.
- [ ] Índice `matches (championshipId, kickoffAt)` fora de "Building".
- [ ] `deploy:functions` (promoteFirstAdmin) aplicado.
- [ ] `deploy:hosting` (app) aplicado após índice pronto.
- [ ] Smoke pós-deploy: home + rankings da Copa carregam (nenhuma regressão legada).
- [ ] Piloto: habilitar 1 liga não-Copa em 1 pool de teste.
- [ ] Observar ≥1 ciclo de cron: corpo com `championshipsProcessed > 1`, sem warnings
      de fetch.
- [ ] Confirmar ranking geral (Copa) inalterado + ranking por-campeonato da liga
      piloto aparece.
- [ ] Testar onboarding auto-serviço ponta-a-ponta (cadastro → verificação →
      `activate-pool` promove pool `pending`).
- [ ] Validar 1 arquivamento real → Histórico servido do snapshot; cleanup não apaga.
- [ ] Só então liberar o catálogo completo aos demais admins.
