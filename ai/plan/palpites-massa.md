# PLAN — Fluxo de Palpites em Massa (Copa 2026)

> Feature slug: `palpites-massa`
> PRD: `ai/prd/palpites-massa.md` (decisões A1–A10 no §6.1)
> Design contract: `design-system/MASTER.md` (referência obrigatória nas tasks de UI)
> Gerado: 2026-06-07

---

## 1. Planning summary

16 tasks em 6 fases. Sequência **grupos antes de eliminatória** (decisão A1/A3 + dependência de `stageSchema` para 16 avos e endpoint batch).

Fundação primeiro (schema 16 avos + lógica pura de classificação/terceiros/chave + endpoint batch), depois primitivas de UI, depois telas do fluxo de grupos, depois bracket, e por fim a casca do wizard + modo "Completar Copa" + navegação.

**Reuso central:** feature `predictions` (`useUpsertPrediction`, helpers `predictionDocId`/`isPredictionLocked`, padrão de Route Handler `POST /api/predictions`), feature `matches` (`useMatches`, `useTeams`, `buildTeamMap`/`resolveTeam`), `ScoreInput` (como base do novo input compacto).

**Pontos de atenção herdados do PRD:**
- `ScoreInput` atual é stepper +/- — o palpite em massa exige variante **digitável com navegação TAB** (TASK-06).
- Pontuação **placar exato também na eliminatória** (A1) → bracket usa input de placar; vencedor derivado.
- Classificação e terceiros são **visuais, não pontuados** (A2) → lógica pura sem persistência própria.
- Sem coleção `Bracket` (A3) → palpites de eliminatória são `predictions` contra fixtures reais.

**TDD recomendado** em toda lógica pura (TASK-01 schema, TASK-02, TASK-03) e no endpoint batch (TASK-04).

---

## 2. Recommended execution phases

1. **Fundação (sem UI):** TASK-01 (schema 16 avos), TASK-02 (lib classificação/terceiros/progresso), TASK-03 (lib chave/seeding).
2. **Dados/API:** TASK-04 (endpoint batch), TASK-05 (service+hooks batch, draft local, agrupadores).
3. **Primitivas UI:** TASK-06 (input compacto digitável, progress bar, cards de fase/grupo).
4. **Telas — fluxo de grupos:** TASK-07 (Hub), TASK-08 (grid grupos), TASK-09 (palpite em massa), TASK-10 (classificação prevista), TASK-11 (resumo grupos), TASK-12 (melhores terceiros).
5. **Bracket:** TASK-13 (componente de chave), TASK-14 (telas eliminatórias), TASK-15 (resumo final + envio).
6. **Integração:** TASK-16 (casca do wizard + Completar Copa + navegação).

---

## 3. Tasks

### TASK-01 – Schema de fase "16 avos" (dezesseis-avos)
- Type: domain (schema)
- Goal: Incluir a fase de 16 avos no enum de fases para suportar o formato 48 seleções, sem quebrar matches/rankings/estatísticas existentes.
- Scope: Adicionar valor (ex.: `"dezesseis-avos"`) em `stageSchema`; avaliar impacto em `rankingScopeSchema` (ranking por fase — decidir se 16 avos tem ranking próprio); atualizar mapeamento de rótulos pt-BR e de `stage` da API-Football ("Round of 32"); ajustar fixtures de teste.
- Main modules/files: `src/schemas/shared.ts`, `src/schemas/matches.ts`, `src/schemas/rankings.ts`, `src/schemas/statistics.ts`, `src/app/api/_lib/apiFootballData.ts` (mapeamento de stage), respectivos `__tests__`.
- Dependencies: none
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD: yes
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: Confirmar o slug exato e o rótulo da API-Football para a fase. Verificar se a string `"3rd Place Final"`/`"Round of 32"` já é mapeada. Não introduzir ranking de 16 avos se não houver requisito (manter `rankingScopeSchema` enxuto e documentar a decisão).

### TASK-02 – Lib pura: classificação de grupo, melhores terceiros, progresso
- Type: domain
- Goal: Funções puras que derivam classificação prevista por grupo, ranking dos 8 melhores terceiros (critério FIFA) e métricas de progresso global — sem React, sem Firebase.
- Scope: `computeGroupStandings(matches, predictions)` → tabela ordenada (pontos, saldo, gols pró, gols contra) com desempate FIFA (pontos → saldo → gols pró → confronto direto → sorteio determinístico estável); `rankBestThirds(allGroupStandings)` → 8 melhores 3ºs; `deriveWinner(prediction)` (vencedor do confronto a partir do placar, incluindo sinalização de empate); `computeProgress(predictions, matches)` → {preenchidos, total, percentual} global e por fase.
- Main modules/files: `src/features/predictions/lib/standings.ts` (+ index), `src/features/predictions/lib/__tests__/standings.test.ts`.
- Dependencies: none (usa tipos `MatchWithId`/`Prediction` existentes)
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD: yes
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: Desempate por sorteio deve ser determinístico (ex.: ordenar por id de seleção) para não gerar resultados instáveis entre renders. Confronto direto exige cruzar predictions do próprio grupo. Empate de placar em eliminatória: `deriveWinner` retorna `null`/flag para a UI tratar.

### TASK-03 – Lib pura: chave derivada dos fixtures de mata-mata (revisada por D-BRACKET)
- Type: domain
- Goal: Construir a estrutura da chave a partir dos **fixtures reais de mata-mata** da API-Football (Round of 32 → Final), associar cada confronto ao `matchId` real, e projetar o avanço a partir dos vencedores previstos (derivados do placar — A1).
- Scope: `buildBracketFromFixtures(matches)` → agrupa os fixtures de knockout por fase (`dezesseis-avos`, `oitavas`, `quartas`, `semifinal`, `terceiro`, `final`) em uma estrutura de slots com `matchId` real e times (quando definidos; placeholders quando TBD); `advanceBracket(round, winners)` → projeta a próxima fase a partir dos vencedores previstos (`deriveWinner` da TASK-02), para uso visual quando os fixtures reais ainda não têm os times resolvidos; tipos da chave (slot, origem, fase). **Sem tabela de seeding FIFA hardcoded** — a ordem/pareamento vem dos próprios fixtures.
- Main modules/files: `src/features/predictions/lib/bracket.ts` (+ index), `src/features/predictions/lib/__tests__/bracket.test.ts`.
- Dependencies: TASK-02 (tipos de standings/`deriveWinner`), TASK-17 (fixtures de mata-mata no formato 2026 — mock/real)
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD: yes
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: Revisado por decisão **D-BRACKET** (PRD §6.2): chave vem dos fixtures reais, não de seeding calculado. Risco reduzido de alto→médio. O ponto delicado passa a ser o tratamento de fases com times TBD (placeholders `1A`/`2B`) e a projeção visual a partir das previsões enquanto o fixture real não resolveu (A6). `advanceBracket` cobre a projeção; `buildBracketFromFixtures` cobre o casamento com `matchId` real para persistência/pontuação.

### TASK-17 – Migração da camada de dados para openfootball/worldcup.json
- Type: integration
- Goal: Substituir a implementação api-football por um provedor openfootball (grátis, sem chave) que entrega dados reais da Copa 2026, mantendo a interface do client + Route Handlers + schemas intactos.
- Scope:
  1. **Client novo** (`src/server/copaData/client.ts`): implementa a interface existente (`getTeamsByTournament`/`getFixtures`, renomeável `CopaDataClient`) buscando `https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json` (fetch server-side, cache via `revalidate`). Tratamento de erro/timeout análogo ao client atual.
  2. **Mapper novo** (`src/server/copaData/mapper.ts`): openfootball match → `matchSchema` — `round`→`stage` (Matchday N→`grupos`; "Round of 32"→`dezesseis-avos`; "Round of 16"→`oitavas`; "Quarter-final"→`quartas`; "Semi-final"→`semifinal`; "Match for third place"→`terceiro`; "Final"→`final`); `group "Group A"`→`groupId "A"`; `date`+`time "HH:MM UTC±H"`→`kickoffAt` ISO com offset (D-OF5); nome de time→`id` via registry; `status` (sem score→`scheduled`; com `score.ft`→`finished`+goals — D-OF6); `matchId` (`m{num}` p/ knockout, slug p/ grupo — D-OF2). Placeholders de mata-mata (`"2A"`,`"W74"`) preservados como id de slot (D-OF4).
  3. **Registry de times** (`src/server/copaData/teamRegistry.ts`): 48 seleções `nome → { id, code, flagUrl, name }` (D-OF3); serve `/api/teams` e resolução de nomes em matches.
  4. **Config**: `src/server/copaData/config.ts` (URL/season 2026, flag de cache). Aposentar `src/server/apiFootball/*` (client HTTP, config, mock) — preservando a interface; atualizar `apiFootballData.ts` (ou substituir por `copaData/index.ts`) e os imports em `/api/matches`, `/api/teams`, `/api/standings`, `/api/predictions*`.
  5. **Testes**: fixtures openfootball (amostra real de grupo + knockout), testes de mapper (todos os rounds, parsing de horário, matchId, placeholders, registry), e atualização/remoção dos testes api-football obsoletos.
- Main modules/files: `src/server/copaData/{client,mapper,teamRegistry,config,index}.ts` (+ `__tests__`), `src/app/api/_lib/apiFootballData.ts` (substituir), imports nos Route Handlers, remoção de `src/server/apiFootball/*` obsoleto.
- Dependencies: TASK-01 (stages/rounds)
- Story points: 8
- Criticality: critical
- Technical risk: high
- Recommended TDD: yes
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: Decisões **D-OF1..6 / D-BRACKET / D-PERSIST** (PRD §6.2.1). Substitui a integração api-football do milestone anterior — blast radius contido pela interface do client + schemas + Route Handlers (frontend e schemas não mudam). vitest nunca bate na rede: fixtures locais são o test double. Pré-requisito de TASK-03 (placeholders→seeding), TASK-05 (agrupadores) e telas de grupo/chave. Em produção não precisa de chave nem plano pago.

### TASK-04 – Endpoint POST /api/predictions/batch
- Type: api
- Goal: Persistir vários palpites numa única requisição, reaproveitando autenticação, autorização e regra de lock por item do handler atual.
- Scope: Novo Route Handler que recebe `{ predictions: PredictionInput[] }`; valida sessão (Admin SDK) → uid; valida aprovação do usuário; valida cada item com `predictionInputSchema`; busca fixtures (`fetchAllMatches`); aplica `isPredictionLocked` por item; grava via Firestore Admin `WriteBatch`. Resposta agrega por item: gravados, rejeitados (lock/404) com motivo. Limite de tamanho do lote.
- Main modules/files: `src/app/api/predictions/batch/route.ts`, `src/app/api/predictions/batch/__tests__/route.test.ts`.
- Dependencies: none (espelha `src/app/api/predictions/route.ts`)
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD: yes
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: **Sensível a segurança** — uid SEMPRE da sessão, nunca do body; nunca gravar `status`/`points`. Itens bloqueados não devem derrubar o lote inteiro (resposta parcial 207-like via corpo, status 200). Definir cap (ex.: ≤ 104 itens).

### TASK-05 – Service + hooks de batch, rascunho local e agrupadores
- Type: application
- Goal: Camada client para salvar lotes, persistir rascunho local (auto-save A4) e agrupar partidas por grupo/fase para as telas.
- Scope: `upsertPredictionsBatch(inputs)` em `services/predictions.ts` (fetch ao endpoint batch, mapeia erros pt-BR); hook `useUpsertPredictionsBatch` (mutation + invalida `predictionsKeys`); store de rascunho em localStorage (`usePredictionDraft` — chave por usuário, debounce); hooks `useGroupMatches(groupId)` e `usePhaseMatches(stage)` derivando de `useMatches`/`useTeams` (+ `groups`); compositor `useGroupPredictions(groupId)` (matches do grupo × draft × predictions salvas).
- Main modules/files: `src/services/predictions.ts`, `src/features/predictions/hooks/useUpsertPredictionsBatch.ts`, `src/features/predictions/hooks/usePredictionDraft.ts`, `src/features/predictions/hooks/useGroupPredictions.ts`, `src/features/matches/hooks/*` (agrupadores), `__tests__` correspondentes.
- Dependencies: TASK-04
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD: yes (service + draft store)
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: Precisa de leitura da coleção `groups` (A–L) — confirmar fonte (Firestore client read vs. derivar `groupId` de matches). Draft local não deve bloquear digitação (debounce + escrita assíncrona).

### TASK-06 – Primitivas UI: input de placar compacto + progress bar + cards
- Type: ui
- Goal: Componentes base reutilizados por todas as telas do fluxo.
- Scope: `CompactScoreInput` (campo numérico digitável, navegação TAB, mobile numeric keyboard, validação inline, estados disabled/locked) — variante do `ScoreInput` para preenchimento em massa; `ProgressBar` (percentual + label "X / Y"); `PhaseCard` (card de fase no Hub: jogos, pendentes, status, CTA/bloqueado); `GroupCard` (card de grupo no grid: nome, progresso, status).
- Main modules/files: `src/features/predictions/components/CompactScoreInput.tsx`, `ProgressBar.tsx`, `PhaseCard.tsx`, `GroupCard.tsx`, `components/index.ts`, `__tests__`.
- Dependencies: none (design system existente)
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: yes – web – primitivas visuais novas (input/list/card) com estados; base de todo o fluxo
- Design domains: style, color, typography, ux
- Design complexity: medium
- Accessibility level: critical
- Notes: Resolver no `/screen` o **tema verde** dos wireframes vs. shell neutro do MASTER (escopo `.palpites-theme` ou tokens `--color-win/loss/draw`). Navegação TAB entre placares é requisito explícito; alvos ≥ 44px; `inputMode="numeric"`.

### TASK-07 – Tela Hub de Palpites (PRD03-01 + estados)
- Type: ui
- Goal: Tela inicial do fluxo com progresso global e cards por fase; ponto de entrada do "Completar Copa".
- Scope: Rota `(app)/predictions` (substitui a lista atual como destino do menu); header (logo + avatar + notificações), `ProgressBar` global ("72/104"), lista de `PhaseCard` (Grupos, 16 avos, Oitavas, Quartas, Semis, 3º, Final) com bloqueio de fases futuras; estados vazio (PRD03-13), em andamento (PRD03-14), enviado (PRD03-15), bloqueado (PRD03-16); CTA "Completar Copa".
- Main modules/files: `src/app/(app)/predictions/page.tsx`, `src/features/predictions/components/PredictionsHub.tsx`, hooks de progresso (TASK-02/05).
- Dependencies: TASK-02, TASK-05, TASK-06
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: yes – web – nova tela principal + 4 estados
- Design domains: style, color, typography, ux
- Design complexity: high
- Accessibility level: enhanced
- Notes: A lista atual (TASK-08 antiga) deixa de ser o destino de "Palpites"; decidir se vira sub-rota. Fases futuras bloqueadas até completar a anterior (A6).

### TASK-08 – Tela Seleção de Grupo (PRD03-02)
- Type: ui
- Goal: Grid 3×4 dos grupos A–L com progresso/status para escolher qual preencher.
- Scope: Rota `(app)/predictions/grupos`; grid de `GroupCard` (nome, jogos preenchidos, percentual, status não-iniciado/andamento/concluído); navegação para a tela de palpite do grupo.
- Main modules/files: `src/app/(app)/predictions/grupos/page.tsx`, `src/features/predictions/components/GroupSelectionGrid.tsx`.
- Dependencies: TASK-05, TASK-06
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD: no
- Recommended screen: yes – web – nova tela (grid/list)
- Design domains: style, ux, color
- Design complexity: medium
- Accessibility level: enhanced
- Notes: Grid responsivo (3 col mobile → 4 col desktop, ref. wireframe). Status visual de grupo concluído (✓).

### TASK-09 – Tela Palpite em Massa do Grupo (PRD03-03)
- Type: ui
- Goal: Preencher os 6 jogos do grupo numa tela, com TAB + auto-save local + "Salvar Grupo" (batch).
- Scope: Rota `(app)/predictions/grupos/[groupId]`; lista de 6 linhas (bandeira/nome/`CompactScoreInput`×2/nome/bandeira) via `useGroupPredictions`; auto-save em rascunho local; CTA "Salvar 6 Palpites" → `useUpsertPredictionsBatch`; tratamento de itens bloqueados (feedback agregado); loading/error.
- Main modules/files: `src/app/(app)/predictions/grupos/[groupId]/page.tsx`, `src/features/predictions/components/GroupQuickFill.tsx`, `GroupMatchRow.tsx`.
- Dependencies: TASK-05, TASK-06
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: yes – web – nova tela de formulário em massa
- Design domains: style, ux, color, typography
- Design complexity: high
- Accessibility level: critical
- Notes: TAB percorre placares na ordem visual; Sonner ao salvar; jogos com kickoff passado entram travados (reusa `isPredictionLocked`). Mobile: teclado numérico.

### TASK-10 – Tela Classificação Prevista (PRD03-04)
- Type: ui
- Goal: Mostrar a tabela 1º–4º calculada dos placares do grupo (visual, não pontuada) e confirmar.
- Scope: Tela/etapa que consome `computeGroupStandings`; tabela ordenada (posição, seleção, pts, saldo, GP); destaque dos 2 classificados + marcação do 3º (candidato a melhor terceiro); CTA "Confirmar Classificação".
- Main modules/files: `src/features/predictions/components/PredictedStandings.tsx` (+ rota/etapa).
- Dependencies: TASK-02, TASK-06
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD: no
- Recommended screen: yes – web – nova tela (tabela)
- Design domains: chart, style, ux, typography
- Design complexity: medium
- Accessibility level: enhanced
- Notes: Tabela acessível (header/scope). Sem ajuste manual de desempate (A7).

### TASK-11 – Tela Resumo dos 12 Grupos (PRD03-05)
- Type: ui
- Goal: Visão consolidada dos classificados de cada grupo antes dos terceiros.
- Scope: Lista dos 12 grupos com 1º/2º (e 3º marcado); status ✓ por grupo concluído; CTA "Continuar"; estado de grupos incompletos.
- Main modules/files: `src/features/predictions/components/GroupsSummary.tsx` (+ rota/etapa).
- Dependencies: TASK-02
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD: no
- Recommended screen: yes – web – nova tela (lista)
- Design domains: style, ux, typography
- Design complexity: medium
- Accessibility level: standard
- Notes: Bloquear "Continuar" enquanto houver grupo incompleto.

### TASK-12 – Tela Ranking dos Melhores Terceiros (PRD03-06)
- Type: ui
- Goal: Exibir os 8 melhores 3ºs (critério FIFA) e gerar a chave dos 16 avos.
- Scope: Tela que consome `rankBestThirds`; lista ordenada 1–8 (+ não classificados, opcional); CTA "Gerar 16 Avos" → dispara `buildRoundOf32`.
- Main modules/files: `src/features/predictions/components/BestThirdsRanking.tsx` (+ rota/etapa).
- Dependencies: TASK-02 (e TASK-03 para o CTA gerar a chave)
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD: no
- Recommended screen: yes – web – nova tela (lista ranqueada)
- Design domains: chart, style, ux, typography
- Design complexity: medium
- Accessibility level: enhanced
- Notes: Só habilita "Gerar 16 Avos" com os 12 grupos concluídos.

### TASK-13 – Componente de Chave Interativa (bracket)
- Type: ui
- Goal: Componente reutilizável de chave que recebe confrontos (placar por confronto, vencedor derivado) e projeta o avanço.
- Scope: `Bracket` / `BracketMatchup` usando `CompactScoreInput` por confronto; vencedor derivado (`deriveWinner`); tratamento de empate (exigir desempate/placar não-empatado em eliminatória); layout responsivo (vertical mobile → horizontal desktop); auto-save local + persistência via batch.
- Main modules/files: `src/features/predictions/components/Bracket.tsx`, `BracketMatchup.tsx`.
- Dependencies: TASK-03, TASK-06, TASK-05
- Story points: 5
- Criticality: high
- Technical risk: high
- Recommended TDD: no
- Recommended screen: yes – web – componente multi-tela complexo
- Design domains: style, ux, color, typography
- Design complexity: high
- Accessibility level: critical
- Notes: Bracket é a peça de UX mais arriscada (responsividade + interação + projeção). `/screen` deve detalhar layout mobile/desktop e o tratamento de empate em eliminatória.

### TASK-14 – Telas das fases eliminatórias (PRD03-07…11)
- Type: ui
- Goal: Telas de 16 avos, oitavas, quartas, semis e final+3º lugar usando o componente de chave.
- Scope: Rotas/etapas por fase consumindo `usePhaseMatches`/projeção; reaproveitam `Bracket`; navegação entre fases; bloqueio até fase anterior concluída (A6).
- Main modules/files: `src/app/(app)/predictions/chave/[stage]/page.tsx` (ou etapas do wizard), `src/features/predictions/components/KnockoutPhaseScreen.tsx`.
- Dependencies: TASK-13
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: yes – web – 5 telas de fase
- Design domains: style, ux, color
- Design complexity: high
- Accessibility level: critical
- Notes: Final + 3º lugar na mesma tela (PRD03-11). Persistir como `predictions` contra fixtures reais quando definidos (A3/A6).

### TASK-15 – Tela Resumo Final + Confirmar e Enviar (PRD03-12 + PRD03-15)
- Type: ui
- Goal: Revisão final (campeão/vice/3º/4º) e envio (upsert dos pendentes).
- Scope: Resumo derivado da chave (campeão/vice/3º/4º + contagem de jogos preenchidos); CTA "Confirmar e Enviar" → `upsertPredictionsBatch` de todos os pendentes; estado "Enviado" (PRD03-15); tratamento de itens bloqueados/falhos.
- Main modules/files: `src/features/predictions/components/FinalSummary.tsx` (+ rota/etapa).
- Dependencies: TASK-04, TASK-05, TASK-03
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: yes – web – nova tela + estado enviado
- Design domains: style, ux, typography
- Design complexity: medium
- Accessibility level: enhanced
- Notes: "Enviado" derivado da existência dos palpites (A5), sem flag nova. Feedback claro de quantos foram gravados/rejeitados.

### TASK-16 – Casca do wizard, modo "Completar Copa" e navegação
- Type: ui
- Goal: Amarrar o fluxo contínuo, a navegação entre etapas e o reapontamento do menu "Palpites" para o Hub.
- Scope: Orquestração de etapas (Hub → grupos → classificação → resumo → terceiros → chave → final); modo contínuo "⚡ Completar Copa" (encadeia grupo A→L→eliminatórias sem voltar ao hub); persistência de progresso/etapa atual; atualizar item de navegação "Palpites" (BottomNav/SideNav) para o Hub; manter `/matches/[id]/predict` como fallback (A8).
- Main modules/files: `src/features/predictions/components/PredictionsWizard.tsx`, rotas `(app)/predictions/*`, `src/components/navigation/*` (item Palpites).
- Dependencies: TASK-07 … TASK-15
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: yes – web – navegação/fluxo multi-tela
- Design domains: ux, style
- Design complexity: high
- Accessibility level: enhanced
- Notes: Definir gerência de estado da etapa (URL vs. estado client). Não quebrar deep-link de edição pontual.

---

## 4. Dependency map

```
TASK-01 (schema 16 avos) ─── (independente; pré-req conceitual de fases eliminatórias)
TASK-02 (lib standings/terceiros/progresso) ──┬── TASK-03 (lib chave/seeding)
                                              ├── TASK-07 (Hub)
                                              ├── TASK-10 (classificação)
                                              ├── TASK-11 (resumo grupos)
                                              └── TASK-12 (terceiros)
TASK-04 (endpoint batch) ─── TASK-05 (service+hooks+draft) ──┬── TASK-09 (palpite massa)
                                                            ├── TASK-13 (bracket)
                                                            └── TASK-15 (resumo final/envio)
TASK-06 (primitivas UI) ──┬── TASK-07, TASK-08, TASK-09, TASK-10, TASK-13
TASK-03 ──┬── TASK-12 (CTA gerar chave), TASK-13, TASK-15
TASK-13 ─── TASK-14 (telas eliminatórias)
TASK-07..15 ─── TASK-16 (wizard + Completar Copa + nav)
```

## 5. Execution waves (parallel groups)

> Atualizado por PRD §6.2 (D-API/D-MOCK/D-GROUP/D-BRACKET): TASK-17 entra como fundação de dados; TASK-03 passa a depender de TASK-17.

- **Wave 1 (fundação):** TASK-01 ✅, TASK-02 ✅, TASK-04, TASK-17 — independentes entre si (TASK-17 dep TASK-01).
- **Wave 2:** TASK-03 (dep 02, 17), TASK-05 (dep 04, 17), TASK-06 (independente de UI) — paralelos.
- **Wave 3 (telas grupos):** TASK-07 (dep 02,05,06), TASK-08 (dep 05,06), TASK-10 (dep 02,06), TASK-11 (dep 02), TASK-12 (dep 02,03) — paralelizáveis em 2–3 por vez.
- **Wave 4:** TASK-09 (dep 05,06) — pode rodar junto da Wave 3 se 05/06 prontos.
- **Wave 5 (bracket):** TASK-13 (dep 03,05,06) → TASK-14 (dep 13); TASK-15 (dep 03,04,05) em paralelo a TASK-14.
- **Wave 6 (integração):** TASK-16 (dep 07–15).

## 6. Recommended execution order (sequential fallback)

TASK-01 → TASK-02 → TASK-03 → TASK-04 → TASK-05 → TASK-06 → TASK-07 → TASK-08 → TASK-09 → TASK-10 → TASK-11 → TASK-12 → TASK-13 → TASK-14 → TASK-15 → TASK-16

**Início recomendado:** TASK-01 (destrava o vocabulário de fases) ou, em paralelo, TASK-02 (lógica pura, alto valor, testável). Para mostrar valor cedo, priorizar o caminho de grupos (01→02→04→05→06→07→08→09) antes do bracket.

## 7. Planning risks and blockers

1. **Seeding dos 16 avos (TASK-03) — risco alto.** A regra de qual 1º enfrenta qual melhor 3º depende de combinação de grupos (regulamento FIFA 2026). Exige pesquisa e constante documentada; testar exaustivamente.
2. **Disponibilidade de dados de grupo/fixtures 2026 (TASK-05/08/09).** Depende de `matches.groupId` e da coleção `groups` populados. Se a API-Football ainda não expõe os grupos/fixtures de 2026, telas ficam sem dados reais → necessário fallback/seed ou estado vazio coerente. **Verificar antes da Wave 3.**
3. **Casamento palpite de eliminatória ↔ fixture real (TASK-13/14/15).** Confrontos derivam das previsões do usuário; fixtures reais só existem com `matchId` definido. Definir no spec como persistir antes de os times reais serem conhecidos (A3/A6) — possivelmente só rascunho local até o fixture existir.
4. **Empate de placar em eliminatória (TASK-02/13).** Pontuação é placar exato (A1), mas a chave precisa de um vencedor para avançar. Definir UX: exigir placar não-empatado, ou capturar critério de avanço sem afetar a pontuação.
5. **Tema visual (TASK-06).** Wireframes verdes vs. MASTER neutro — resolver cedo no `/screen` da TASK-06 para manter consistência nas telas seguintes.
6. **Reapontamento de navegação (TASK-16).** Trocar destino de "Palpites" sem quebrar o fluxo antigo (`/matches/[id]/predict`) nem deep-links.
