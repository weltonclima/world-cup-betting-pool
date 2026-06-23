# PLAN — Ranking Fase Eliminatória (PRD-16)

> PRD: `ai/prd/ranking-eliminatorias.md` (decisões D1/D2/D3 travadas em 2026-06-23)

## 1. Planning summary

5 tasks em 3 fases. O pipeline de dados (ESPN → eliminatórias) e o bracket preditivo do usuário **já funcionam** — não há trabalho de prontidão; o PRD confirmou isso. O trabalho real é: (1) novo scope agregado `eliminatorias` no schema, (2) computar e persistir esse agregado no recalc (com cleanup de órfãos + bump de versão), (3) reorganizar a UI de ranking de fase em dois blocos com card agregado em destaque, (4) indicador de fase atual na Home.

Maior risco em **TASK-02** (recalc): muda shape dos docs (exige bump de `RECALC_VERSION`), precisa incluir `eliminatorias` no cleanup de órfãos de pool, e somar 5 stages (incluindo `dezesseis-avos`, que NÃO está em `RANKING_STAGE_SCOPES`). Backend (01→02) precede frontend (03/04). TASK-05 é validação.

## 2. Recommended execution phases

- **Phase 1 – Foundation (contrato):** TASK-01
- **Phase 2 – Business rules (recalc agregado):** TASK-02
- **Phase 3 – Exposure (UI):** TASK-03, TASK-04
- **Phase 4 – Validation:** TASK-05

## 3. Tasks

### TASK-01 – Adicionar scope `eliminatorias` ao schema
- Type: domain
- Goal: Estender `rankingScopeSchema` com o escopo agregado `"eliminatorias"` — contrato único de verdade consumido por recalc, API e UI.
- Scope: Adicionar `"eliminatorias"` ao enum `rankingScopeSchema` em `src/schemas/shared.ts`. Verificar que `RankingScope` em `src/types/shared.ts` deriva via `z.infer` (sem edição manual). Confirmar que os Route Handlers `GET /api/rankings/[scope]` e `/pool/[scope]` passam a aceitar o novo scope sem mudança (validação por schema). Atualizar comentário do enum documentando que `eliminatorias` é AGREGADO (não 1 stage → 1 scope) e inclui dezesseis-avos.
- Main modules/files likely involved: `src/schemas/shared.ts`, `src/schemas/__tests__/shared.test.ts` (se existir), `src/types/shared.ts` (verificação).
- Dependencies: none
- Story points: 1
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (mudança de enum/contrato; ganha teste no /test)
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, implement, test, review
- Notes: `is_frontend: false`. Não inventar enum paralelo — reusar `rankingScopeSchema`. Confirmar quem mais consome o enum (`PhaseRanking.tsx`, `rankingKeys`).

### TASK-02 – Recalc: computar e persistir agregado `eliminatorias`
- Type: domain + persistence
- Goal: No `recalcRankings()`, computar o ranking agregado das eliminatórias (soma de `dezesseis-avos + oitavas + quartas + semifinal + final`) e persistir `rankings/eliminatorias` + `rankings/pool-{groupId}-eliminatorias`.
- Scope: (1) Definir conjunto de stages eliminatórios `ELIMINATION_STAGES = ["dezesseis-avos","oitavas","quartas","semifinal","final"]` (note: inclui dezesseis-avos, que NÃO está em `RANKING_STAGE_SCOPES`). (2) **Acumulador dedicado `byElimination: ScopeCounts` no `UserAgg`**, populado direto de `match.stage ∈ ELIMINATION_STAGES` no loop de agregação (linhas ~249-298). **NÃO derivar somando `byStageScope`** — esse Map só é populado para stages dentro de `RANKING_STAGE_SCOPES` (linha 278), que exclui dezesseis-avos, o que silenciosamente dropparia os pontos de dezesseis-avos e violaria D2. (3) **Denominador `finishedElimination`** = soma das partidas finalizadas em TODAS as 5 `ELIMINATION_STAGES` (incl. dezesseis-avos) — necessário para casar numerador (que inclui exatos de dezesseis-avos) e denominador, senão aproveitamento fica inflado/deflado. Construir em paralelo ao `finishedByStage` (linhas 201-207). (4) Persistir doc global `rankings/eliminatorias` + docs por pool `pool-{poolId}-eliminatorias`, **re-rankeado entre membros do pool pelos pontos do agregado de eliminatória (`byElimination.points`)** — NÃO por `pointsGeral` —, espelhando o loop das fases (linhas 439-448). (5) **Cleanup de órfãos:** incluir `pool-{id}-eliminatorias` em `ownedByLivePool` senão será apagado. (6) **Bumpar `RECALC_VERSION` 3 → 4** (shape muda). (7) Atualizar comentário do histórico de `RECALC_VERSION`.
- Main modules/files likely involved: `src/server/rankings/recalc.ts`, `src/server/rankings/__tests__/recalc.test.ts`.
- Dependencies: TASK-01
- Story points: 5
- Criticality: high
- Technical risk: high
- Recommended TDD later: yes (agregação multi-stage + cleanup de órfão + denominador — regression-sensitive; um erro serve ranking zerado/stale)
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: Cuidado: dezesseis-avos está fora de `RANKING_STAGE_SCOPES`, então o loop atual de agregação por stage (linha ~278) o ignora — a soma do agregado precisa de path próprio que inclua dezesseis-avos. Testes: usuário sem palpites de elim → entry zerada; dezesseis-avos contando no agregado mas sem card de fase; cleanup não apaga `pool-X-eliminatorias` de pool vivo; bump de versão força recompute. `is_frontend: false`.

### TASK-03 – UI: split Grupos/Eliminatórias + card agregado
- Type: application (frontend)
- Goal: Reorganizar a tab "Por Fase" de `PhaseRanking.tsx` em dois blocos visuais (Fase de Grupos / Eliminatórias) com o card agregado `eliminatorias` em destaque no topo do bloco Eliminatórias.
- Scope: Dividir `STAGE_CARDS` em dois grupos: bloco "Fase de Grupos" (card `grupos` + seletor de grupo A–L já existente) e bloco "Eliminatórias" (card destaque `eliminatorias` ⭐ + cards `oitavas`, `quartas`, `semifinal`, `final`). Adicionar headings/separadores de bloco. Card agregado consome `usePoolRankingByScope("eliminatorias")` (hook genérico, sem mudança). Estilo de destaque no card agregado (borda/ícone diferenciado). Manter estados loading/empty/error por card. Não criar nova aba — manter tab única com scroll.
- Main modules/files likely involved: `src/features/rankings/components/PhaseRanking.tsx`, `src/features/rankings/components/__tests__/` (se houver), reuso de `usePoolRankingByScope`.
- Dependencies: TASK-01 (scope no schema), TASK-02 (doc agregado existir p/ dado real — mas UI degrada com null se ausente)
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (componente UI; coberto por test + ui-review)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: done
- Phases done: spec, ui-spec, patterns:nextjs, implement, test, review, ui-review
- Notes: `is_frontend: true` → dispara ui-spec + patterns:nextjs + ui-review. Manter consistência visual com tab "Por Grupo". Card agregado deve comunicar que soma todos os rounds (incl. dezesseis-avos). Pode rodar em paralelo com TASK-04.

### TASK-04 – Home: indicador de fase atual da Copa
- Type: application (frontend)
- Goal: Mostrar na Home a fase ativa da Copa (ex.: "Copa em: Oitavas de Final"), derivada da fase do próximo jogo não-finalizado.
- Scope: (1) Nova derivação pura (ex.: `deriveCurrentStage(matches)` em `home/lib/homeDashboardHelpers.ts`) que retorna o `Stage` do jogo com menor `kickoffAt` e `status !== "finished"`; fallback para a última stage finalizada se todos terminaram, ou null se sem dados. (2) **CRIAR um mapa `Stage`→rótulo pt-BR** (ex.: `stageLabels.ts` ou estender `matches/lib/matchLabels.ts`), keyed pelos slugs de `stageSchema` (`grupos`, `dezesseis-avos`, `oitavas`, `quartas`, `semifinal`, `terceiro`, `final`) — **NÃO existe hoje**: `matchLabels.ts` só tem `PREDICTION_STATUS_LABEL`/`GAME_STATUS_LABEL`, e os labels de `BracketView.tsx` são keyed por outro enum (`roundOf32`/`roundOf16`), incompatível com os slugs de `Stage`. (3) Renderizar banner/badge discreto no `HomeDashboard` (não bloqueia outros cards). Wire via `useHomeDashboard` (já carrega matchesList). Degradar silenciosamente se null.
- Main modules/files likely involved: `src/features/home/lib/homeDashboardHelpers.ts` (+`__tests__`), `src/features/home/hooks/useHomeDashboard.ts`, `src/features/home/components/HomeDashboard.tsx` (+ possível novo componente de banner), novo `stageLabels.ts` (mapa `Stage`→pt-BR, fonte única).
- Dependencies: none (independente do backend de ranking)
- Story points: 2
- Criticality: low
- Technical risk: low
- Recommended TDD later: yes (derivação pura de fase atual — lógica condicional, fácil de testar isolada)
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: done
- Phases done: spec, ui-spec, patterns:nextjs, tdd, implement, test, review, ui-review
- Notes: `is_frontend: true` → ui-spec + patterns:nextjs + ui-review. `deriveCurrentStage` foi removido no home-revamp (CurrentStageCard) — este é um retorno deliberado como banner leve, NÃO como card vazio. Reusar labels de stage existentes. Pode rodar em paralelo com TASK-03.

### TASK-05 – Validação integrada e gate
- Type: test
- Goal: Validar o fluxo ponta-a-ponta: schema → recalc → API → UI, e rodar o gate (lint/typecheck/test/build).
- Scope: Garantir cobertura de testes do novo scope no recalc e na UI; rodar `npm test`, `lint`, `typecheck`, `format:check`; verificar que `RECALC_VERSION` bump força recompute on-read; smoke manual do split visual e do banner de fase. Confirmar que rotas `/api/rankings/eliminatorias` e `/api/rankings/pool/eliminatorias` respondem. **Asserts D2 (load-bearing):** (a) pontos de dezesseis-avos APARECEM no agregado `eliminatorias` (teste no recalc); (b) o bloco Eliminatórias renderiza EXATAMENTE {agregado, oitavas, quartas, semifinal, final} e NENHUM card de dezesseis-avos (teste de UI).
- Main modules/files likely involved: suites em `__tests__/`, gate scripts.
- Dependencies: TASK-02, TASK-03, TASK-04
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no
- Execution cost:
  - spec: haiku/medium
  - tdd: N/A
  - implement: sonnet/medium
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, implement, test, review
- Notes: Coberto pelo Stage 4 (`/local-env`) e gate do flow. `is_frontend: false`. Gate verde: lint 0 errors, typecheck clean, 85 testes feature pass, format clean, build OK. D2(a)/D2(b) presentes + verdes. RECALC_VERSION=4.

## 4. Dependency map

```
TASK-01 (schema)
   └─→ TASK-02 (recalc agregado)
          └─→ TASK-03 (UI split)  ─┐
   TASK-04 (Home banner) ──────────┤ (independente do backend)
                                    └─→ TASK-05 (validação)
```

- TASK-01 → bloqueia TASK-02 e TASK-03 (precisam do scope no enum).
- TASK-02 → bloqueia dado real do card agregado (TASK-03 degrada com null se ausente).
- TASK-04 → independente (não toca ranking).
- TASK-05 → depende de 02, 03, 04.

## 5. Recommended execution order

1. **TASK-01** — schema (foundation, destrava tudo)
2. **TASK-02** — recalc agregado (maior risco; backend primeiro)
3. **TASK-03** — UI split (pode paralelizar com 04)
4. **TASK-04** — Home banner (pode paralelizar com 03)
5. **TASK-05** — validação + gate

## 6. Planning risks and blockers

- **TASK-02 é o ponto crítico:** dezesseis-avos fora de `RANKING_STAGE_SCOPES` exige path de agregação próprio; esquecer o cleanup de órfão apaga `pool-*-eliminatorias`; esquecer o bump de `RECALC_VERSION` serve docs stale. TDD obrigatório.
- **Sem blockers de clarificação:** D1/D2/D3 travados no PRD.
- **Prontidão para eliminatórias:** confirmado pelo PRD que NÃO requer trabalho — pipeline ESPN e bracket preditivo já operam. Nenhuma task gerada para isso (intencional).
- **TASK-03/04 são frontend** → disparam ui-spec/patterns/ui-review no flow.
