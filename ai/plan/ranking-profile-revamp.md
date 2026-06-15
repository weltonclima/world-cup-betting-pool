# PLAN

> Feature: Ranking Profile Revamp (PRD-14) · PRD: `ai/prd/ranking-profile-revamp.md`

## 1. Planning summary

A entrega redesenha `/rankings/profile/[uid]` com duas experiências (próprio vs alheio),
histórico de palpites em accordion (grupos A–L + eliminatórias), card "DNA do palpiteiro",
comparação "Você × Ele" e limpeza dos cards redundantes.

O trabalho separa-se em 4 tasks com fronteiras limpas: **funções puras de domínio**
(agrupamento + DNA + comparação), o **Route Handler seguro** que serve palpites alheios só
de jogos encerrados (anti-cola), a **camada de aplicação** (service + hook compositor) e a
**reescrita da UI**. A criticidade concentra-se na TASK-02 (segurança: o filtro server-side
é a única barreira contra cola). As demais são de risco baixo/médio.

## 2. Recommended execution phases

- **Fase 1 – Fundação (domínio + contrato seguro):** TASK-01, TASK-02
- **Fase 2 – Aplicação (acesso a dados):** TASK-03
- **Fase 3 – Exposição (UI):** TASK-04
- **Fase 4 – Validação e release:** `/local-env` + `/release` (orquestrados pelo flow)

## 3. Tasks

### TASK-01 – Funções puras: agrupamento, DNA e comparação
- Type: domain
- Goal: Centralizar toda a lógica derivável e testável fora da UI — agrupamento hierárquico de palpites (fase → grupo/sub-fase), perfil "DNA do palpiteiro" e métricas de comparação entre dois participantes.
- Scope:
  - `groupProfilePredictions(items)` → estrutura accordion de 2 níveis (Fase de Grupos → Grupos A–L; Fase Eliminatória → stages em ordem enum). Grupos vazios preservados (A4). Ordenação: grupos alfabéticos, eliminatórias por stage enum (A6), matches por `kickoffAt` ASC.
  - `deriveBettorDna(predictions)` → tendência (otimista/cauteloso), placar favorito, média de gols/jogo.
  - `deriveProfileComparison(myEntry, otherEntry, myStats, otherStats)` → diferença de pontos, posições, contagem "acertou X que você errou" (só contagens, sem expor palpite).
  - `derivePredictionsCount(predictions, matches, now)` → "X de Y" com denominador = jogos com kickoff passado (A2).
- Main modules/files likely involved:
  - `src/features/rankings/lib/profilePredictionsGrouping.ts` (novo)
  - `src/features/rankings/lib/bettorDna.ts` (novo)
  - `src/features/rankings/lib/profileComparison.ts` (novo)
  - `src/features/rankings/lib/index.ts` (barrel)
  - reusa `derivePredictionDisplayStatus` de `predictions/lib`, `stageSchema` de `shared`
  - `__tests__/` co-locados
- Dependencies: nenhuma
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: opus/high
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: Funções totalmente puras (sem React/Firebase). Atenção ao label "Dezesseis Avos de Final" (A5) e ao `groupId === null` em eliminatórias. Placeholder de grupo vazio difere por contexto (próprio vs alheio) — passar flag de contexto ou resolver na UI. TASK-03: derivePredictionsCount espera predictions filtradas por kickoffAt <= now; se passar all predictions, made pode > ofTotal.

### TASK-02 – Route Handler `GET /api/predictions/[uid]` (anti-cola)
- Type: api
- Goal: Servir palpites de OUTRO participante, expondo apenas jogos com `status === "finished"`. Filtro server-side é a única barreira contra cola — Rules não conseguem aplicá-lo.
- Scope:
  - Novo Route Handler `runtime = "nodejs"`, `dynamic = "force-dynamic"`.
  - Auth: `verifySessionCookie` → re-check `users/{uid}.status === "approved"`.
  - Busca palpites do `uid` alvo via Admin SDK (bypassa Rules).
  - Cruza com `getEffectiveMatches()`; filtra **só `status === "finished"`** antes de retornar.
  - Retorna `Prediction[]` validado; erros tipados pt-BR (convenção `PredictionServiceError`).
  - Nunca retorna palpite de jogo não-encerrado, mesmo que exista.
- Main modules/files likely involved:
  - `src/app/api/predictions/[uid]/route.ts` (novo)
  - `src/server/firebaseAdmin.ts`, `src/server/auth/*` (existentes)
  - `src/server/copaData/matchSource.ts` (`getEffectiveMatches`)
  - `src/schemas/predictions.ts` (reuso)
  - `__tests__/route.test.ts`
- Dependencies: nenhuma (fundação paralela à TASK-01)
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: opus/high
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: SEGURANÇA CRÍTICA. Testes obrigatórios: (a) jogo agendado/ao-vivo de outro user NUNCA vaza; (b) não-autenticado = 401; (c) não-approved = 403; (d) uid inexistente = lista vazia; (e) auto-consulta também filtra finished (consistência) ou documenta divergência. Review opus/high por criticidade. Não introduzir leitura cruzada nas Rules.

### TASK-03 – Service + hook compositor `useProfilePredictions`
- Type: application
- Goal: Camada de acesso que escolhe a fonte de palpites conforme o contexto (próprio = Client SDK direto, alheio = Route Handler) e produz o view-model enriquecido para a UI.
- Scope:
  - Service `getOtherUserPredictions(uid)` → `GET /api/predictions/[uid]` (fetch same-origin, parse defensivo, erro tipado pt-BR).
  - Hook `useProfilePredictions(uid, isSelf)` em `rankings/hooks`:
    - `isSelf` → `listPredictionsByUid` (Client SDK, todos jogos)
    - `!isSelf` → `getOtherUserPredictions` (Route Handler, só finished)
    - join com `useMatches()` + `useTeams()`
    - produz `ProfilePredictionItem[]` (com `stage`, `groupId`, `actualScore`, `matchStatus`, `displayStatus`)
  - NÃO reusar `usePredictionsList` (evita acoplamento cross-feature) — reusa só funções puras.
- Main modules/files likely involved:
  - `src/services/predictions.ts` (estender) ou novo `src/services/profilePredictions.ts`
  - `src/features/rankings/hooks/useProfilePredictions.ts` (novo)
  - `src/features/rankings/hooks/rankingKeys.ts` (nova query key)
  - reusa `useMatches`, `useTeams`, `buildTeamMap`, `resolveTeam` de `matches`
  - `__tests__/useProfilePredictions.test.ts`
- Dependencies: TASK-02 (consome o Route Handler)
- Story points: 3
- Criticality: medium
- Technical risk: medium
- Recommended TDD later: no (composição de hooks; cobertura via teste de integração do hook)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: done
- Phases done: spec, implement, test, review
- Notes: Tipo `ProfilePredictionItem` é NOVO no contexto rankings (não estende `PredictionListItem`). Query key separada por uid + contexto. `enabled` desabilita query alheia se uid ausente.

### TASK-04 – Reescrita da UI `ParticipantProfile` + sub-componentes
- Type: application
- Goal: Reconstruir a tela com bifurcação meu/alheio, cards limpos, accordion de histórico, card DNA e bloco de comparação.
- Scope:
  - Rewrite `ParticipantProfile.tsx`: detectar `isSelf` no topo; título "Meu Perfil" vs nome.
  - Limpeza: grade de métricas sem "Acertos≡Pontos" (Acertos / Erros / Aproveitamento / Sequência Máx.).
  - `StagePerformance`: ocultar fases sem dados (`correctByStage[scope] > 0`).
  - Novos sub-componentes:
    - `ProfilePredictionsList` (accordion de fases; fase atual aberta via `deriveCurrentStage` — A7)
    - `PredictionGroupSection` (header com resumo "3/3 ✓"; placeholder vazio por contexto — A4)
    - `PredictionMatchRow` (3 estados: finished/live/scheduled; palpite × resultado × badges)
    - `BettorDnaCard`
    - `ProfileComparisonCard` (só perfil alheio)
  - Contador "X de Y palpites" (A2).
  - Estados loading/erro/empty reusam `RankingSkeleton`/`RankingErrorState`/`RankingEmptyState`.
- Main modules/files likely involved:
  - `src/features/rankings/components/ParticipantProfile.tsx` (rewrite)
  - `src/features/rankings/components/profile/*` (novos sub-componentes)
  - `src/features/rankings/components/index.ts`
  - reusa `Avatar`, `PREDICTION_DISPLAY_STATUS_LABEL/COLOR`, `deriveCurrentStage` (home/lib)
  - `__tests__/ParticipantProfile.test.tsx` (atualizar: não-encontrado, alheio, próprio)
- Dependencies: TASK-01 (funções puras), TASK-03 (hook)
- Story points: 5
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (UI; cobertura via testes de componente)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: done
- Phases done: spec, ui-spec, implement, test, review, ui-review
- Notes: is_frontend → dispara ui-spec + patterns:nextjs + ui-review no flow. `deriveCurrentStage` está em `home/lib` — confirmar import cross-feature ou mover para lib compartilhada. Maior task da entrega; risco baixo por reusar muito componente existente.

## 4. Dependency map

```
TASK-01 (domínio)  ─────────────┐
                                 ├──► TASK-04 (UI)
TASK-02 (api) ──► TASK-03 (hook)─┘
```

- TASK-01: sem dependências
- TASK-02: sem dependências
- TASK-03: depende de TASK-02
- TASK-04: depende de TASK-01 + TASK-03

TASK-01 e TASK-02 são paralelizáveis (fundação independente).

## 5. Recommended execution order

1. **TASK-02** — Route Handler seguro (maior criticidade; desbloqueia TASK-03; valida cedo a barreira anti-cola)
2. **TASK-01** — Funções puras (independente; pode ir em paralelo)
3. **TASK-03** — Service + hook (depende de TASK-02)
4. **TASK-04** — UI (depende de TASK-01 + TASK-03)

Ordem alternativa válida: TASK-01 → TASK-02 → TASK-03 → TASK-04. Priorizei TASK-02 primeiro por ser o ponto de maior risco — falhar cedo no item crítico é melhor.

## 6. Planning risks and blockers

- **TASK-02 (segurança):** o filtro `status === "finished"` é a única barreira anti-cola. Qualquer regressão vaza palpites de jogos abertos. Exige TDD + review opus/high. Sem blocker externo.
- **TASK-04 cross-feature import:** `deriveCurrentStage` vive em `home/lib`. Importar de rankings cria acoplamento — avaliar mover para `src/lib` ou `predictions/lib` compartilhado durante o spec.
- **TASK-01 contexto de placeholder:** o texto de grupo vazio muda entre próprio ("Nenhum palpite") e alheio ("Jogos ainda não encerrados"). Decidir no spec se a função pura recebe flag de contexto ou se a UI resolve o label.
- **Performance:** 104 jogos × join com teams/predictions é client-side. Volume baixo; sem preocupação real, mas accordion colapsado evita render desnecessário.
- **TDD recomendado:** TASK-01 e TASK-02 (regras + segurança). TASK-03/04 cobrem via testes de hook/componente.
