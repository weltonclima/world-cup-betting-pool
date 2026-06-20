# PLAN — Notificações: Disparos Automáticos

> **PRD-15** | PRD fonte: `ai/prd/notifications-triggers.md` | Branch: `feat/notifications-triggers`

---

## 1. Planning summary

6 tarefas, 3 fases. Fundação primeiro (remover tipo `pool` + módulo server-side de notificações), depois os disparos por domínio (system migrado, games, ranking), e por fim o scheduler que torna tudo automático.

A maior complexidade está na **TASK-05** (expor delta de posição no `recalc.ts` — função central de ranking) e no **fan-out em batch** das TASK-04/05. A **TASK-06** (scheduler) é o que efetivamente liga o "automático" — sem ela, scoring/recalc só rodam manual.

Estratégia de risco: TASK-05 é aditiva (novo campo no retorno do recalc, sem tocar a lógica de cálculo existente — confirmado que `geralPositionByUid` e `last.position` já coexistem no loop de statistics). Idempotência por ID determinístico em todas as criações evita duplicatas em re-run do cron.

---

## 2. Recommended execution phases

- **Fase 1 — Fundação** (TASK-01, TASK-02): remover `pool`; criar módulo server-only de notificações (factory + preferences batch + write idempotente).
- **Fase 2 — Disparos por domínio** (TASK-03, TASK-04, TASK-05): migrar system para server-side (corrige bug group_admin); notificações de games no scoring; notificações de ranking no recalc.
- **Fase 3 — Automação** (TASK-06): scheduler (GitHub Actions cron) que dispara o pipeline scoring→recalc→notificações.

---

## 3. Tasks

### TASK-01 – Remover tipo `pool` (bolão) de schema, preferências e UI
- Type: refactor-support
- Goal: Reduzir as categorias para `system | games | ranking`, removendo `pool` do enum, preferências, filtros e meta — desbloqueia o resto sem dependências.
- Scope: Tirar `pool` de `notificationType`; remover toggle/pill/meta de "Bolão"; ajustar default de preferências. Sem migração de dados (lista filtra tipos conhecidos).
- Main modules/files likely involved:
  - `src/schemas/notifications.ts`, `src/schemas/notificationPreferences.ts`
  - `src/features/notifications/components/NotificationFilters.tsx`
  - `src/features/notifications/components/PreferencesForm.tsx`
  - `src/features/notifications/lib/notificationMeta.ts`
  - respectivos `__tests__`
- Dependencies: nenhuma
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, implement, test, review
- Notes: `is_frontend: true` (toca componentes). UI-spec leve — só remoção de elementos, sem novo design. Verificar usos de `pool` em todo o slice antes de remover (grep).

### TASK-02 – Módulo server-side de notificações (`src/server/notifications/`)
- Type: domain
- Goal: Centralizar a criação de notificações server-side (Admin SDK), com factory por evento, leitura de preferências em batch e escrita idempotente por ID determinístico.
- Scope: `factory.ts` (mensagens por evento — system/games/ranking), `preferences.ts` (`fetchPreferencesMap(uids[])` via Admin SDK, default all-true se doc ausente), `write.ts` (`batch.set` em chunks de 500, ID determinístico, append-only), `index.ts`. `server-only`.
- Main modules/files likely involved:
  - `src/server/notifications/{factory,preferences,write,index}.ts` (novos)
  - `src/server/firebaseAdmin.ts` (consumo)
  - `src/schemas/notifications.ts` (contrato)
  - reusa copy de `src/features/predictions/lib/predictionsHelpers.ts` (rótulos acertou/vencedor/empate)
  - `__tests__/` co-locado
- Dependencies: TASK-01 (enum final sem `pool`)
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: Fundação de tudo que vem depois. Funções puras de mensagem são altamente testáveis (TDD). Idempotência (`games-{uid}-{matchId}`, `ranking-{uid}-{dateKey}`, `system-{uid}-{transition}-{dateKey}`) é regra de domínio crítica — cobrir com testes. Regra de preferência: `system` de moderação ignora `system:false`; games/ranking respeitam.

### TASK-03 – Migrar notificações `system` para server-side (corrige bug group_admin)
- Type: api
- Goal: Mover a criação das 4 notificações de moderação para os Route Handlers (Admin SDK), removendo a criação client-side que falha silenciosamente para group_admin.
- Scope: Disparar `notifyModeration()` nos handlers de aprovação/rejeição/bloqueio/reativação; remover `createNotification` dos hooks client. Opcional (avaliar no spec): S5 promoção.
- Main modules/files likely involved:
  - `src/app/api/group/users/{approve,reject,block,unblock}/route.ts`
  - `src/app/api/group/users/_moderation.ts`
  - `src/features/admin/hooks/useUpdateUserStatus.ts` (remover criação)
  - `src/features/groupAdmin/hooks/useModerateGroupUser.ts` (remover criação)
  - `src/features/admin/lib/notificationFactory.ts` (migrar/aposentar)
  - respectivos `__tests__`
- Dependencies: TASK-02
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: opus/high
- Notes: Corrige bug real (write denied silencioso). Best-effort: falha de notificação loga mas não derruba a moderação. Garantir paridade de mensagens com o factory antigo antes de aposentá-lo. Review opus por mexer em auth/moderação.
- Status: done
- Phases done: spec, implement, test, review

### TASK-04 – Notificações `games` no scoring route (fan-out batch)
- Type: integration
- Goal: Após pontuar palpites de jogos `finished`, criar notificações de acerto (placar/vencedor/empate) para os usuários, respeitando preferência `games`.
- Scope: Em `processMatch`, acumular acertos (`correct`/`partial` + flag empate); após scoring, carregar preferências em batch, filtrar `games:true`, criar via `notifyScoreHit()` em batch. Fire-and-forget após commit de pontuação. Idempotente. Não notifica `wrong`.
- Main modules/files likely involved:
  - `src/app/api/predictions/score/route.ts`
  - `src/server/notifications/*` (TASK-02)
  - `src/features/predictions/lib/predictionsHelpers.ts` (`scorePrediction`, rótulos)
  - `__tests__/route.test.ts`
- Dependencies: TASK-02
- Story points: 5
- Criticality: high
- Technical risk: high
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: opus/high
  - test: sonnet/medium
  - review: opus/high
- Notes: Risco alto = fan-out (N palpites × M jogos) sob Admin SDK. Mitigar com `batch.set` em chunks; não bloquear o response de scoring. Nomes dos times: `match` já está em mãos no loop. Idempotência `games-{uid}-{matchId}` evita duplicata em re-run do cron. Implement upgraded por risco=high.
- Status: done
- Phases done: spec, implement, test, review

### TASK-05 – Expor delta de posição no recalc + notificações `ranking`
- Type: integration
- Goal: Fazer `recalcRankings()` retornar o delta de posição por usuário e, nos recalc routes, criar notificações de subida (e pódio), respeitando preferência `ranking`.
- Scope: Aditar ao retorno de `recalcRankings` `[{ uid, previousPosition, newPosition }]` (geral) — derivado de `geralPositionByUid` vs `last.position` do `positionHistory`, já presentes no loop de statistics. Nos 2 recalc routes, filtrar `newPosition < previousPosition`, carregar preferências, `notifyRankingUp()` em batch. Mensagem especial top 3.
- Main modules/files likely involved:
  - `src/server/rankings/recalc.ts` (retorno aditivo)
  - `src/app/api/rankings/recalc/route.ts`
  - `src/app/api/group/rankings/recalc/route.ts`
  - `src/server/notifications/*` (TASK-02)
  - `src/server/rankings/__tests__/recalc.test.ts`
- Dependencies: TASK-02
- Story points: 5
- Criticality: high
- Technical risk: high
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Notes: Mexe em função central de ranking — manter aditivo (não alterar lógica de cálculo/persistência existente). `positionUnchanged` já distingue mudança; reusar. TDD no delta (regra: só subida, pódio top 3, idempotência por dia). Implement+review upgraded por risco=high.
- Status: done
- Phases done: spec, tdd, implement, test, review

### TASK-06 – Scheduler automático (GitHub Actions cron)
- Type: infra
- Goal: Disparar `/api/predictions/score` periodicamente (que encadeia recalc → notificações), tornando o pipeline automático sem ação manual.
- Scope: `.github/workflows/score-cron.yml` agendado (cron ~30min), `POST` com header `x-cron-secret` lendo `SCORE_SECRET` dos secrets do repo. Documentar setup de `SCORE_SECRET`/`RANKINGS_SECRET`. Sem Blaze (externo ao Firebase).
- Main modules/files likely involved:
  - `.github/workflows/score-cron.yml` (novo)
  - `apphosting.yaml` / docs de env (referência de secrets)
  - `src/app/api/_lib/secret.ts` (já existe — sem mudança)
- Dependencies: TASK-04, TASK-05 (o pipeline precisa existir para o cron valer)
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/medium
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: Decisão aberta: frequência do cron (recomendado 30min). `SCORE_SECRET` e `RANKINGS_SECRET` já suportados no código — só precisam ser configurados. Segurança: secrets nunca em log/commit.
- Status: done
- Phases done: spec, implement, test, review

---

## 4. Dependency map

```
TASK-01 (remover pool) ─┐
                        ├─> TASK-02 (módulo server-side) ─┬─> TASK-03 (system server-side)
                        │                                 ├─> TASK-04 (games scoring) ─┐
                        │                                 └─> TASK-05 (ranking recalc) ─┤
                        │                                                                ├─> TASK-06 (scheduler)
```

- TASK-01: sem dependências (raiz).
- TASK-02: depende de TASK-01 (enum final).
- TASK-03, TASK-04, TASK-05: dependem de TASK-02 (independentes entre si — paralelizáveis).
- TASK-06: depende de TASK-04 e TASK-05 (pipeline precisa existir).

---

## 5. Recommended execution order

1. **TASK-01** — remover `pool` (fundação, baixo risco, desbloqueia enum).
2. **TASK-02** — módulo server-side (fundação de toda criação).
3. **TASK-03** — migrar system (corrige bug, valida o módulo num caso real conhecido).
4. **TASK-04** — games no scoring (primeiro disparo automático novo).
5. **TASK-05** — ranking no recalc (segundo disparo; maior risco no recalc).
6. **TASK-06** — scheduler (liga o automático de ponta a ponta).

Razão da ordem: TASK-03 antes de 04/05 porque exercita o módulo da TASK-02 no caminho mais simples e conhecido (4 mensagens fixas) antes do fan-out complexo. TASK-06 por último — só faz sentido depois que há pipeline para agendar.

---

## 6. Planning risks and blockers

| Item | Tipo | Observação |
|---|---|---|
| TASK-04 fan-out | Risco técnico alto | N palpites × M jogos sob Admin SDK. `batch.set` chunks de 500, fire-and-forget. Maior ponto de atenção de performance. |
| TASK-05 mudança no recalc | Risco técnico alto | Função central de ranking. Manter estritamente aditivo; cobrir com testes; não regredir cálculo/`positionHistory`. |
| TASK-06 scheduler | Bloqueador de automação | Sem ele nada é "automático". Depende de configurar `SCORE_SECRET` nos secrets do repo (ação fora do código). |
| Frequência do cron | Clarificação aberta | Recomendado 30min — confirmar no spec da TASK-06. |
| Acerto em palpite manual de group_admin | Clarificação aberta | Notificar o user dono mesmo quando admin lançou? Recomendado sim — decidir no spec da TASK-04. |
| Eventos system extras (promoção/atribuição) | Escopo aberto | TASK-03 inclui só os 4 base; S5/S6 opcionais — decidir no spec. |
| Limite de 50 notificações | Risco baixo | IDs determinísticos limitam volume (1/jogo, 1 subida/dia). |

**TDD recomendado:** TASK-02 (mensagens + idempotência) e TASK-05 (regra de delta/pódio). Demais: testes pós-implementação.

---

## 7. Concerns do plan-checker (resolver no `/spec`)

Validação goal-backward (gsd-plan-checker) confirmou cobertura completa e dependências corretas. 4 precisões a fechar no spec — não são blockers:

1. **ID idempotente de `system` (TASK-02/03)** — `system-{uid}-{transition}-{dateKey}` proposto nas notas engole eventos legítimos repetidos no mesmo dia (block→unblock→block). PRD só define ID determinístico para games/ranking. Decidir esquema do `system` no spec: provavelmente **sem `dateKey`** ou keyed na ocorrência do evento, não no dia.
2. **S5/S6 system extras (TASK-03)** — PRD §6.2 recomenda **incluir** promoção (S5). Plano deferiu p/ spec. S6 (atribuição a pool, `PATCH /api/admin/users/[uid]/group`) não está em nenhuma task — confirmar deferimento explícito.
3. **Chain `score → recalc` (TASK-04/06)** — todo o "automático" de ranking depende de `/api/predictions/score` chamar `chainRecalc` → recalc in-process. TASK-06 agenda só o score. **Verificar no spec** que o chain dispara o recalc server-side; senão notificações de ranking nunca disparam automaticamente.
4. **`predictionIsDraw` em TASK-04** — distinguir J2 (vencedor) de J3 (empate) exige os scores do palpite (`prediction.homeScore === prediction.awayScore`), não só `ScorePredictionResult.status`. Confirmar no spec que `processMatch` tem o objeto de palpite em mãos no fan-out.
