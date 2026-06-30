# PRD — ESPN fonte única de partidas + correção do chaveamento

> Base de análise técnica: `ai/diagnose/espn-api-analise.md` (coleta real da API ESPN, 2026-06-30).

## 1. Feature summary

Consolidar a ESPN como **fonte única** de dados de partidas da Copa (removendo todo vínculo remanescente com openfootball) e **corrigir o chaveamento das eliminatórias** (`/matches/eliminatorias`), onde times aparecem na chave errada (ex.: "Brasil na chave do Canadá"). A correção depende de enriquecer o parser ESPN para capturar a linkagem real do bracket (hoje descartada) e os campos de desempate (pênaltis) e avanço.

## 2. Consolidated scope

Três frentes, uma feature:

**A. Remover openfootball**
- Migrar os 2 únicos consumidores de `fetchAllMatches()` (openfootball cru) para `getEffectiveMatches()` (ESPN + override manual):
  - `src/app/api/predictions/score/route.ts` (pontuação de palpites)
  - `src/server/admin/dashboardStats.ts` (contagem de jogos)
- Ensinar `src/app/api/_lib/copaDataError.ts` a mapear os erros ESPN (`EspnTimeoutError`→504, `EspnFetchError`→502, `EspnParseError`→500) — preservando a semântica HTTP atual. Bônus: conserta a rota bracket (hoje cai em 500 genérico em falha ESPN).
- Apagar código openfootball morto: `src/server/copaData/{client.ts,mapper.ts}`, `COPA_DATA_URL` (config), `fetchAllMatches` + reexports no barrel `index.ts`, classes `CopaData*Error`.
- Migrar ~8 arquivos de teste que mockam `fetchAllMatches`/`CopaData*Error` para `getEffectiveMatches`/`Espn*Error` (score, predictions, predictions/batch, teams, standings, matches, matches/[id], copaData/client+mapper).

**B. Enriquecer parse ESPN** (`espnTypes.ts` + `espnMapper.ts` + schema de domínio)
- Capturar de `competitor.team`: `displayName`, `shortDisplayName`, `id`, `isActive` → derivar o **slot do bracket** dos placeholders (`"Round of 32 N Winner"`, `"Round of 16 N Winner"`, `"Quarterfinal N Winner"`, `"Semifinal N Winner/Loser"`).
- Capturar `competitor.advance` (quem avançou) e `competitor.shootoutScore` (pênaltis).
- Capturar `status.type.name` para distinguir `STATUS_FINAL_PEN` / `STATUS_OVERTIME` de fim normal.
- Propagar esses campos pelo domínio (`matchSchema`/`knockoutMatchSchema`) **sem** quebrar a paridade de `matchId`.

**C. Corrigir BracketView**
- Renderizar cada card com os **dois lados reais** que a ESPN entrega (resolvido OU placeholder legível "Vencedor R32 jogo N"), em vez do teamId genérico `"RD32"` indistinguível.
- Remover o pareamento posicional inventado (`roundOf16[k]` entre `roundOf32[2k],[2k+1]`) — fonte do bug.
- Exibir pênaltis (ex.: "1 (4) × 1 (3)") e o selo de quem avançou (`advance`).

## 3. System understanding relevant to this feature

- **Fonte efetiva** (`matchSource.getEffectiveMatches`): já é ESPN-única (base ESPN + override manual `isManualOverride`). Sem fallback openfootball.
- **openfootball remanescente**: só `fetchAllMatches()` (HTTP `COPA_DATA_URL`), usado por score + dashboard. `fetchAllTeams()` é registry estático (não é openfootball).
- **Pontuação** (`predictionsHelpers.scorePrediction`): compara placar previsto vs `match.homeScore/awayScore`. Ponderada 10 (exato) / 5 (acertou resultado) / 0. Empate parcial já tratado. **NÃO mexer na fórmula.**
- **Status de match** (`matchStatusSchema`): `scheduled|live|finished|postponed|canceled`. ESPN PEN/OT têm `state=post` → mapeiam para `finished`.
- **Linkagem ESPN** (achado-chave): undecided knockout sides vêm como "time placeholder" `isActive:false` com `displayName="Round of 32 N Winner"` e id sintético; ao decidir, a ESPN substitui pelo time real. Pareamento real é **cruzado** (não sequencial).
- **Numeração R32 própria** (1–16) não é campo plano e não bate com ordem de data/id/array — ver §6.

## 4. Technical impact analysis

- **Módulos**: `server/copaData` (espnTypes, espnMapper, index, matchSource; remoção de client/mapper/config), `app/api/_lib/copaDataError`, `app/api/predictions/score`, `server/admin/dashboardStats`, `schemas/matches` (+ `schemas/worldcup`/`knockoutMatch`), `server/worldcup/bracket`, `features/worldcup/components/{BracketView,KnockoutMatchCard}`.
- **Contratos/API**: shape do `matchSchema` ganha campos opcionais (slot bracket, shootout, advance, outcome). `bracketResponseSchema`/`KnockoutMatch` ganham os lados com label/placeholder e pênaltis. Compatibilidade: campos **opcionais** para não quebrar snapshots em cache (`worldcup_cache`).
- **Pontuação**: troca de fonte (openfootball→ESPN) altera **quais** resultados pontuam. Regra de pênaltis: `shootoutScore` é separado; `homeScore/awayScore` continuam o placar do tempo normal/prorrogação → pontuação consistente (empate decidido nos pênaltis pontua como empate). Invariante a garantir: shootout NUNCA é dobrado em home/awayScore.
- **Cache**: `worldcup_cache/bracket` snapshots antigos podem não ter os novos campos → schema deve aceitar ausência (campos opcionais) + recompute regrava enriquecido.
- **Testes**: churn grande na suíte (mocks de fonte). Sem impacto em Rules/infra.

## 5. Risks

- **Regressão de pontuação** (crítico): mudar a fonte do score pode repontuar jogos já pontuados se ESPN divergir do openfootball (placar/status). Mitigar: o filtro grosso por hash (`scoreState`) já existe; validar que jogos finished idênticos não geram writes espúrios.
- **Pênaltis dobrados**: se algum caminho somar `shootoutScore` em `homeScore/awayScore`, quebra a pontuação. Guard explícito + teste.
- **Snapshot de cache legado** sem novos campos → erro de parse. Mitigar com campos opcionais + recompute.
- **Conectores de árvore "de verdade"** exigem a numeração de slot R32 (ver §6) — risco de complexidade; escopo C entrega cards corretos sem necessariamente desenhar todas as linhas pai→filho.
- **API ESPN não-oficial**: shape pode mudar; manter `.passthrough()` e falha ruidosa só no que consumimos.

## 6. Ambiguities and gaps

- **Numeração própria do jogo R32 (1–16)**: a ESPN referencia "Round of 32 N Winner" mas o número próprio de cada evento R32 não é campo plano e não deriva de data/id/array (refutado empiricamente). Decisão necessária: (a) desenhar conectores completos exige core API ESPN ou âncora por time resolvido; (b) ou escopo C entrega cards com lados corretos + sem conectores inventados (resolve o bug visível). **Recomendação: (b) primeiro; conectores reais = fase 2 opcional.**
- **Exibição de pênaltis/prorrogação**: formato visual ("1 (4)" vs badge) — definir no ui-spec.
- **dashboardStats**: contar via ESPN muda o total (104 quando completo); confirmar que é o número desejado.
- **Remoção de `CopaData*Error`**: confirmar que nenhuma rota não-tocada ainda depende delas (groups/standings/teams importam nos testes).

## 7. Recommended implementation concerns

- Ordenar: **B (parse) antes de C (view)** — a view depende dos campos. **A (remoção)** é independente e pode vir antes ou em paralelo, mas como mexe em pontuação, fazer com TDD e validar o filtro por hash.
- Campos novos no schema = **opcionais** (compat de cache + paridade de id).
- Garantir invariante de pênaltis com teste dedicado.
- Não alterar `scorePrediction`.
- Manter `matchId` byte-idêntico (paridade openfootball já testada).
