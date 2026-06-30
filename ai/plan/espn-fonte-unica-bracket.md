# PLAN — ESPN fonte única + correção do chaveamento

> PRD: `ai/prd/espn-fonte-unica-bracket.md` · Análise: `ai/diagnose/espn-api-analise.md`

## 1. Planning summary

6 tasks em 3 fases. **Fase 1 (foundation)** enriquece a ingestão ESPN: schema do scoreboard (TASK-01) → domínio + mapper com slot do bracket/pênaltis/advance (TASK-02). **Fase 2 (exposição visual)** propaga ao bracket derivado (TASK-03) e corrige o BracketView, eliminando o pareamento posicional (TASK-04) — entrega o fix do bug "Brasil na chave errada". **Fase 3 (remoção openfootball)** troca a fonte da pontuação/dashboard + mapeia erros ESPN (TASK-05) e apaga o código morto + migra testes (TASK-06).

Invariantes globais: `shootoutScore` NUNCA entra em `homeScore/awayScore`; campos novos = **opcionais** (compat de cache + paridade `matchId`); **não** alterar `scorePrediction`. Conectores reais pai→filho da árvore = fora de escopo (fase 2 futura).

## 2. Recommended execution phases

- **Phase 1 – foundation (ingestão ESPN):** TASK-01, TASK-02
- **Phase 2 – exposição/visual (fix do bug):** TASK-03, TASK-04
- **Phase 3 – remoção openfootball:** TASK-05, TASK-06

## 3. Tasks

### TASK-01 – Schema ESPN: capturar campos de linkagem/desempate
- Type: integration
- Goal: Estender `espnTypes.ts` para validar os campos hoje descartados que carregam a estrutura da chave e o desempate.
- Scope: `espnTeamSchema` ganha `displayName`/`shortDisplayName`/`id`/`isActive` (opcionais, `.passthrough` mantido); `espnCompetitorSchema` ganha `advance` (bool opc.) e `shootoutScore` (int opc.); `espnStatusTypeSchema` ganha `name` (string opc.). Sem mudança de domínio ainda.
- Main modules/files: `src/server/copaData/espnTypes.ts` (+ `__tests__`).
- Dependencies: nenhuma.
- Story points: 3
- Criticality: medium
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
- Notes: API não-oficial → todos os campos opcionais + tolerância a ausência. Fixtures reais em `ai/diagnose/espn-api-analise.md` e no scratchpad (`espn-ko.json`).

### TASK-02 – Domínio + mapper: slot do bracket, pênaltis, advance, outcome
- Type: domain
- Goal: Modelar no domínio os campos novos e preenchê-los no `espnMapper`, derivando o slot do bracket dos placeholders ESPN, com invariante de pênaltis.
- Scope: `matchSchema`/`knockoutMatchSchema` ganham OPCIONAIS: `bracketSlot` (ex.: `{ round: "round-of-32", game: 3 }` derivado de `displayName="Round of 32 N Winner"`), `placeholderLabel` (ex.: "Vencedor R32 jogo 3"), `homeShootout`/`awayShootout` (int|null), `advanceSide` ("home"|"away"|null), `outcome` ("normal"|"overtime"|"penalties"). `espnMapper` deriva-os; parser do `displayName` por regex; `resolveTeamId` continua, mas o lado indefinido agora carrega slot/label em vez de só "RD32". **Invariante:** shootout em campos próprios, jamais somado a `homeScore/awayScore`. `status.type.name` PEN/OT → `outcome`, status continua `finished`.
- Main modules/files: `src/schemas/matches.ts`, `src/schemas/worldcup.ts` (knockout), `src/server/copaData/espnMapper.ts`, `src/types/*` (+ `__tests__`).
- Dependencies: TASK-01.
- Story points: 5
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: paridade de `matchId` intocada. Regex de `displayName` cobre R32/R16/QF/SF(Winner|Loser). Teste dedicado ao invariante de pênaltis. **Slot/label por-lado** (home/away) — match KO tem 2 lados placeholder; spec corrigida de singular p/ por-lado. Review opus/high + gsd-code-reviewer: 0 blocker. Ajustes aplicados: WR-01 (sideSlot gateia por `displayName`, não `isActive` opcional), WR-03 (refine de pênaltis espelhado no `knockoutMatchSchema`), WR-04 (label uniforme "jogo N"), IN-01 (`game<1`→null, degrada s/ lançar). **Follow-ups (não-escopo):** WR-02 — `mapEspnEventsToMatches` aborta batch inteiro se 1 evento KO inconsistente lança; resiliência do consumidor é TASK-05/06. IN-02 — `advanceSide` null na Final/3º (ninguém "avança"); vencedor por placar; TASK-04 usa winner/score.

### TASK-03 – deriveBracket: propagar lados reais + label/pênaltis/advance
- Type: domain
- Goal: `deriveBracket` passa a expor, por lado de cada `KnockoutMatch`, o time resolvido OU o placeholder legível, mais pênaltis e quem avançou.
- Scope: `src/server/worldcup/bracket.ts` — `resolveSide` usa `placeholderLabel`/`bracketSlot` do match (em vez de reconstruir "Vencedor Jogo N" a partir de `W{n}` cru); propaga `homeShootout`/`awayShootout`/`advanceSide`/`outcome` para o `bracketResponseSchema`. Mantém ordenação por bucket. Campos novos opcionais no `bracketResponseSchema`.
- Main modules/files: `src/server/worldcup/bracket.ts`, `src/schemas/worldcup.ts` (+ `__tests__`).
- Dependencies: TASK-02.
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
- Notes: snapshots de cache legados sem campos novos → schema aceita ausência; recompute regrava enriquecido. Review opus/high + gsd-code-reviewer: 0 blocker. Invariante de pênaltis, gate de propagação e bracketSlot confirmados. Ajustes aplicados: auto-consistência (penalties inconsistente degrada, não quebra schema); WR-01 (teste do drop de shootout em outcome normal), IN-01 (advanceSide ausente), IN-02 (label ESPN vence id corrompido). **Follow-up (fora de escopo):** WR-02 — `deriveStatus` usa `match.homeScore!`/`awayScore!` em finished (código pré-existente, não-TASK-03); depende do refine upstream do matchSchema; latente, não ativo.

### TASK-04 – BracketView/KnockoutMatchCard: lados reais, sem pareamento posicional
- Type: application
- Goal: Renderizar cada card com os lados que a ESPN entrega (resolvido OU "Vencedor R32 jogo N"), eliminar o pareamento posicional inventado e exibir pênaltis + selo de avanço. Corrige o bug visível.
- Scope: `BracketView.tsx` — remover pairing por índice (`roundOf16[k]`↔`roundOf32[2k],[2k+1]`); cada coluna lista os matches da fase com seus lados reais. `KnockoutMatchCard.tsx` — exibir pênaltis ("1 (4)") e badge `advance`. Mantém layout desktop (árvore de colunas) + mobile (abas fase+próxima), mas sem conectores que impliquem linkagem falsa.
- Main modules/files: `src/features/worldcup/components/{BracketView,KnockoutMatchCard}.tsx`, `src/features/worldcup/lib/knockoutHelpers.ts` (+ `__tests__`).
- Dependencies: TASK-03.
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: done
- Phases done: spec, ui-spec, implement, test, review, ui-review
- Notes: frontend → flow roda ui-spec + ui-review. Review sonnet/high + gsd-code-reviewer: 0 blocker. ui-review: 0 critical/high (low: TabsTab min-h-11 pré-existente). Ajustes aplicados: WR-01 (getAdvancingSide gateia status antes de advanceSide), WR-02 (fallback desempata por shootout em snapshot legado sem advanceSide), WR-03 (3º lugar acessível no mobile quando só ele tem jogos). IN-01 (legenda outcome só full) aceito. Conectores reais pai→filho = fora de escopo. Formato visual de pênaltis/advance definido no ui-spec. Lógica de label testável via helpers. **Adicionar asserção de regressão** do sintoma-raiz: dado bracket com Brasil resolvido na sua oitava, o card certo mostra "Brasil" e nenhum pareamento posicional o coloca em chave alheia.

### TASK-05 – Trocar fonte da pontuação/dashboard + mapear erros ESPN
- Type: api
- Goal: Migrar `/api/predictions/score` e `dashboardStats` de `fetchAllMatches` (openfootball) para `getEffectiveMatches` (ESPN), e mapear erros ESPN no helper HTTP — preservando semântica 504/502/500.
- Scope: `copaDataErrorResponse` mapeia `EspnTimeoutError`→504, `EspnFetchError`→502, `EspnParseError`→500 (mantém os mapeamentos atuais durante a transição). `score/route.ts` e `dashboardStats.ts` trocam o fetch. Validar que o filtro grosso por hash (`scoreState`) não gera writes espúrios com a fonte ESPN.
- Main modules/files: `src/app/api/_lib/copaDataError.ts`, `src/app/api/predictions/score/route.ts`, `src/server/admin/dashboardStats.ts` (+ `__tests__`).
- Dependencies: nenhuma (independente de B/C); ordenada após para reduzir risco com schema já enriquecido.
- Story points: 3
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: NÃO alterar `scorePrediction`. Pênaltis: placar de tempo normal (empate) pontua como empate — consistente. Regressão de repontuação mitigada pelo hash. Review opus/high + gsd-code-reviewer: 0 blocker. Verificado: paridade de matchId (buildEspnMatchId byte-idêntico), fingerprint source-stable (0 writes espúrios no 1º run pós-swap), instanceof ESPN/CopaData disjuntos, sem circular (ESPN de submodule espnClient). 722/722 nas suítes api/admin/copaData. **Follow-up F1 (LOW, fora de escopo, pré-existente):** falha de transporte ESPN (DNS/conn refused) lança Error puro → 500 em vez de 502 (espnClient só lança EspnFetchError em HTTP !ok); mesmo comportamento do openfootball legado.

### TASK-06 – Apagar openfootball morto + migrar testes
- Type: refactor-support
- Goal: Remover o código openfootball agora órfão e migrar os testes que dependiam dele.
- Scope: apagar `src/server/copaData/{client.ts,mapper.ts}`, `COPA_DATA_URL` (config.ts), `fetchAllMatches` + reexports no `index.ts`, classes `CopaData*Error`. **Limpar a referência órfã em `src/app/api/_lib/copaDataError.ts`** (único arquivo de produção que ainda usa `CopaData*Error` após TASK-05 — substituir pelos `Espn*Error` já mapeados / remover os ramos mortos). Migrar os **12** testes que referenciam `CopaData*Error`/`fetchAllMatches` para `getEffectiveMatches`/`Espn*Error`: score, predictions, predictions/batch, teams, standings, matches, matches/[id], copaData client, copaData mapper, **rankings/recalc**, **worldcup/bracket**, **worldcup/groups**. `COPA_DATA_USE_MOCK` e mocks openfootball some.
- Main modules/files: `src/server/copaData/*`, `src/app/api/_lib/copaDataError.ts`, `src/app/api/**/__tests__/*`, `src/server/copaData/__tests__/*`.
- Dependencies: TASK-05 (nada mais consome `fetchAllMatches` depois dela).
- Story points: 3
- Criticality: medium
- Technical risk: medium
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/medium
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, implement, test, review
- Notes: confirmar que nenhuma rota não-tocada ainda importa `CopaData*Error`. Gate final: `lint` + `typecheck` + `test` limpos. Implement: deletados client/mapper/types + testes mortos + openfootballFixtures; criado `matchId.ts` neutro (slugifyTeamName+buildMatchId) consumido por espnMatchId; index/copaDataError/config podados; 12 suítes migradas CopaData*Error→Espn*Error (via subagente). Gate verde: lint 0 erros, tsc limpo, vitest 3411/3411. **Spec corrigiu escopo do plan:** `mapper.ts` NÃO é 100% morto — `slugifyTeamName` é consumida por `espnMatchId.ts` (paridade byte-idêntica de matchId) + `buildMatchId` é oráculo de paridade nos testes. Decisão: relocar ambas p/ novo `matchId.ts` neutro; deletar resto do mapper + client + types. `fetchAllTeams` PERMANECE (TEAM_REGISTRY, não openfootball). `COPA_DATA_USE_MOCK` já não existe em src (só doc).

### TASK-07 – Ingestão matchNumber (core API) → slot por evento
- Type: integration
- Goal: Obter o número de slot de bracket de cada jogo de mata-mata a partir do `matchNumber` oficial FIFA exposto pelo **core API** ESPN (`sports.core.api.espn.com/.../events/{id}/competitions/{id}` → `matchNumber`). Fecha a lacuna que o scoreboard não tem (premissa de TASK-04 era incompleta — a amarração EXISTE).
- Scope: novo client `espnBracketMap.ts` (ou similar) em `src/server/copaData/`: busca `matchNumber` dos eventos KO e deriva `slotInRound` (R32: `mn−72` → 1–16; R16: `mn−88` → 1–8; QF/SF idem). **Cache 24h** (estrutura FIFA é fixa, independe de placar) — Next data cache `revalidate` longo ou `worldcup_cache`. NÃO é live tier. ≈30 chamadas, paralelas, 1×/dia. Erro/ausência degrada para sem-conectores (não quebra o bracket). Achado real (coleta 2026-06-30): R32 mn 73–88, R16 mn 89–104, QF 93–96, SF, 3º, Final.
- Main modules/files: `src/server/copaData/espnBracketMap.ts` (novo), barrel `index.ts`, `__tests__`.
- Dependencies: nenhuma.
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
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: API não-oficial → todos os campos opcionais + tolerância a ausência/erro. Custo HTTP: cache 24h obrigatório (NUNCA no caminho live de 60s). Alternativa de fallback: mapa estático slot→jogo se o core API cair. Offsets confirmados ao vivo (R32 off72, R16 off88, QF off96, SF off100, 3º off102, Final off103). 16 testes BM-01..BM-16 verdes (JSON). Join por matchId reusa sequência 73+i de mapEspnEventsToMatches. Review: 0 blocker; ajuste aplicado — `z.coerce.number().int()` (risco string-serialization precedente em score). **TASK-08 herdará:** passar snapshot único de events para evitar divergência do join 73+i entre chamadas independentes de fetchSchedule.

### TASK-08 – deriveBracket: arestas reais pai→filho (bracket edges)
- Type: domain
- Goal: Com o slot por evento (TASK-07) + o pareamento dos placeholders do scoreboard, computar as arestas reais da chave: cada jogo (round R, slot S) é alimentado por dois jogos (round R−1, slots do pareamento). Pareamento FIFA fixo derivado dos `displayName` ("Round of 32 N Winner") — independe de resolução de times. Confronto-prova: oitava `760504` = slot4 (Brasil×Japão) + slot6 (Marfim×Noruega).
- Scope: `src/server/worldcup/bracket.ts` — anexar a cada `KnockoutMatch` os identificadores dos dois jogos-pai (ex.: `parentMatchIds: [id, id]` ou `feederSlots`). `bracketResponseSchema` ganha os campos novos (opcionais — snapshots legados sem arestas). Pareamento R16 confirmado: `(1,3)(2,5)(4,6)(7,8)(9,10)(11,12)(13,15)(14,16)` (chave oficial, NÃO sequencial). Degrada para sem-arestas se o mapa de slots faltar.
- Main modules/files: `src/server/worldcup/bracket.ts`, `src/schemas/worldcup.ts`, `__tests__`.
- Dependencies: TASK-07.
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
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: arestas opcionais no schema (compat de cache). Teste de regressão do confronto-prova (slot4+slot6→760504). Invariante: arestas vêm do slot/pareamento, não de pareamento posicional por índice. Review opus/high + gsd-code-reviewer: 0 blocker. Ajuste aplicado: LOW-2 (import `EspnBracketMap` de submodule `espnBracketMap`, não barrel server-only). **HIGH-1 (design gap, não bug):** `parentMatchIds` ausente quando ambos os times são reais (bracketSlot só existe em placeholders — `sideSlot()` retorna null para "Brasil"/"Japão"). Spec-conformante. TASK-09 deve derivar conectores via pareamento fixo direto no EspnBracketMap (não só via `parentMatchIds`). **MEDIUM-2 (follow-up TASK-07):** fetch de bracketMap (24h) e getEffectiveMatches (60s) são independentes; após Copa iniciar com schedule fixo, risco de divergência é baixo — decisão: aceitar. **MEDIUM-1:** assumção displayName digit = slotInRound validar com fixture ESPN real antes de TASK-09 go-live.

### TASK-09 – BracketView: conectores reais + fase+próxima nas abas
- Type: application
- Goal: Desenhar conectores REAIS pai→filho usando as arestas (TASK-08) e restaurar, em cada aba mobile, a visão fase+próxima (o que TASK-04 removeu por engano). Corrige a reclamação: "removeu a visão das oitavas no 16-avos".
- Scope: `BracketView.tsx` — cada aba mostra a fase atual + a próxima, com linhas conectoras posicionadas pelas arestas reais (não por `[2k],[2k+1]`). Desktop mantém todas as colunas, agora com conectores corretos. `KnockoutMatchCard` inalterado (já exibe pênaltis/advance). Layout: conector liga os 2 jogos-pai ao card-filho conforme `parentMatchIds`.
- Main modules/files: `src/features/worldcup/components/BracketView.tsx`, `src/features/worldcup/lib/knockoutHelpers.ts`, `__tests__`.
- Dependencies: TASK-08.
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: done
- Phases done: spec, ui-spec, implement, test, review, ui-review
- Notes (impl): árvore real entregue. (1) `bracket.ts` — `resolveParentMatchIds` HÍBRIDO: feeder por-lado da ESPN (primário, exato p/ jogos futuros não-resolvidos) + tabela FIFA fixa como fallback (ambos resolvidos). **CORRIGIU tabela errada herdada de TASK-08** (R16 slots 1↔2/5↔6/7↔8 trocados → "Canadá×Marrocos na chave errada"). Tabela verificada contra ESPN ao vivo: `ai/diagnose/espn-bracket-pairing.md`. (2) `knockoutHelpers.ts` — `buildMatchIndex` + `buildTreeOrder` (ordem de chave: pais adjacentes ao filho). (3) `BracketView.tsx` — `ConnectorLayer` SVG (H-bracket, aria-hidden, ResizeObserver, degrada s/ parentMatchIds), `justify-around` (filho centra entre pais), mobile fase+próxima restaurado. (4) `KnockoutMatchCard` — `data-match-id` p/ ancorar conectores. (5) **Cache busting:** `CACHE_VERSION` em `cache.ts` (v3) + `isCurrentVersion` na rota — snapshot `worldcup_cache/bracket` (TTL 24h) ficava preso com forma derivada velha; bump força recompute único. Suíte 3457/0. Validado em tela pelo usuário (pais corretos). **Review+ui-review concluídos.** GSD pass: 1 "blocker" CR-01 (grid-cols-5 <5 fases) REJEITADO como blocker — pré-existente TASK-04 + spec §11 manda preservar → follow-up. Fixes aplicados: WR-01 (hook do pai-B usa rB.right, não rA.right), WR-02 (MN-01 completo: clica Final + valida coluna única), WR-03 (MN-02/MN-03 adicionados), WR-04 (H-02 testa id duplicado per spec §6.4). ui-review: 0 critical/high; Medium (próxima fase sem opacity-60 — divergência aceita: flag por índice quebraria desktop) + CR-01 follow-up. WR-05/IN-* opcionais pulados.
- Notes: frontend → flow roda ui-spec + ui-review. **Supera a decisão "conectores reais = fora de escopo" e a premissa de TASK-04** (a amarração existe via matchNumber). Teste de regressão: card de Brasil mostra conector ligando ao slot6 (Marfim/Noruega), não a chave alheia. Mobile fase+próxima de volta em todas as abas. **CONSTRAINT HIGH-1 (herdado de TASK-08 review):** `parentMatchIds` do payload está AUSENTE quando ambos os lados de um confronto são times reais (bracketSlot só existe em placeholders ESPN). TASK-09 NÃO PODE depender exclusivamente de `parentMatchIds` para desenhar conectores de confrontos já decididos. Abordagem obrigatória: derivar conectores combinando (a) `parentMatchIds` quando presente (placeholder phase) + (b) lookup direto no EspnBracketMap + pareamento fixo por round quando `parentMatchIds` ausente (confronto com times reais). O pareamento R16 `(1,3)(2,5)(4,6)(7,8)(9,10)(11,12)(13,15)(14,16)` do plan é a fonte autoritativa para o caso (b). **MEDIUM-1 (validar antes de go-live):** confirmar com fixture ESPN real que o dígito N em "Round of 32 N Winner" é posição-dentro-da-fase (1-16), não matchNumber global (73-88) — falha silenciosa se divergir.

## 4. Dependency map

- TASK-01 → TASK-02 → TASK-03 → TASK-04 (cadeia B→C) — concluída
- TASK-05 → TASK-06 (cadeia A — pontuação)
- TASK-07 → TASK-08 → TASK-09 (cadeia D — conectores reais via matchNumber; corrige regressão visual de TASK-04)
- Cadeias A, B/C e D são independentes entre si.

## 5. Recommended execution order

1. TASK-01 (schema ESPN)
2. TASK-02 (domínio + mapper) — crítica
3. TASK-03 (deriveBracket)
4. TASK-04 (BracketView) — fix visível do bug
5. TASK-05 (troca de fonte score/dashboard) — crítica
6. TASK-06 (limpeza + testes)

## 6. Planning risks and blockers

- **TASK-02 / TASK-05 (critical):** tocam contrato de match e fonte da pontuação. Exigem TDD e atenção ao invariante de pênaltis + filtro por hash.
- **Cache legado:** snapshots `worldcup_cache/bracket` sem campos novos — schema deve aceitar ausência (TASK-03).
- **Churn de testes (TASK-06):** ampla migração de mocks; risco de quebra em rotas não-alvo que importam `CopaData*Error`.
- **Decisão de produto pendente (W3):** trocar a fonte de `dashboardStats` para ESPN muda o total de jogos (104 quando o calendário completo); confirmar no checkpoint se é o número desejado antes de TASK-05.
- **Fora de escopo (declarado):** conectores reais pai→filho da árvore (numeração R32 não exposta de forma plana pela ESPN) — fase 2 futura.
