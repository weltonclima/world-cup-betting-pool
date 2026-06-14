# PLAN — ESPN Live Scores (PRD-12)

> Fonte: `ai/prd/espn-live-scores.md` · Data: 2026-06-14

## 1. Planning summary

Feature integra ESPN scoreboard como fonte de status/placar ao vivo, mergeando em `getEffectiveMatches()` com precedência `manual > ESPN > openfootball`. Cache 5min via Next.js data cache (`revalidate: 300`). Decompõe em **7 tasks**: fundação (registry reverso + schema ESPN), cliente HTTP, regras (mapper + matcher), persistência (merge), e exposição frontend.

Risco dominante = **matching ESPN↔matchId** (TASK-05). **TASK-00 (spike) CONCLUÍDO (2026-06-14)** eliminou o risco de alias: os 48 `abbreviation` ESPN batem exatamente com o `code` do teamRegistry — **zero aliases** (inclui os não-ISO `ALG`, `GER`, `POR`, `PAR`, `URU`, `KSA`, `HAI`, `RSA`, `SUI`, `NED`). Restam os riscos de casamento por par de ids + data (TASK-05) e não-regressão do merge (TASK-06). Fallback gracioso protege contra qualquer falha ESPN (zero regressão).

Schema `matchSchema` **não muda** nesta fase — `"live"` + placares parciais já válidos. Pênaltis ficam para PRD futuro.

## 2. Recommended execution phases

- **Phase 0 — Spike (gating):** TASK-00 (validação empírica ESPN: alias table + `?dates` + tipo do score)
- **Phase 1 — Foundation:** TASK-01 (registry reverso + aliases), TASK-02 (schema Zod ESPN)
- **Phase 2 — Client:** TASK-03 (`EspnScoreClient` HTTP/timeout/erros)
- **Phase 3 — Business rules:** TASK-04 (mapper event→patch), TASK-05 (matcher event↔matchId)
- **Phase 4 — Persistence/merge:** TASK-06 (merge em `getEffectiveMatches`)
- **Phase 5 — Exposure:** TASK-07 (frontend trata `live`)

## 3. Tasks

### TASK-00 – Spike: validação empírica da API ESPN (gating) ✅ CONCLUÍDO (2026-06-14)
- Type: integration
- Status: **DONE.** Achados em `docs/espn-live-scores.md` → secção "Achados Empíricos TASK-00". Destrava TASK-01/02/03.
- Achados-chave: (1) **zero aliases** — 48 `abbreviation` ESPN batem com `code` do registry; (2) `score` é **string** → `z.coerce.number()`; (3) `?dates=YYYYMMDD` **obrigatório** (janela default cobre só 1 dia); (4) status só por `state` (`pre`/`in`/`post`), `detail` é texto livre display-only; (5) ESPN emite placeholders de mata-mata como `abbreviation` (`1A`–`1L`, `RD16 W1`, etc.) — matcher rejeita naturalmente; (6) `event.date` ISO 8601 com `Z` sem segundos.
- Goal: Resolver os gaps empíricos do PRD (#1 aliases, #3 tipo do score, #5 janela `?dates`) com dados reais antes de implementar — produzir artefato verificável que destrava TASK-01/02/03.
- Scope: Chamar o scoreboard ESPN real (`fifa.world`, com e sem `?dates=YYYYMMDD`) e registrar: (a) lista de `abbreviation` dos times retornados × `code` do teamRegistry → **tabela de aliases ESPN→code** (divergências confirmadas); (b) tipo de `competitors[].score` (string vs number); (c) se a janela default cobre o dia ou exige `?dates`; (d) valores reais de `status.type.{state,detail}` durante pre/in/post. Saída: secção "Achados empíricos" anexada a este plano ou a `docs/espn-live-scores.md`. SEM código de produção — é investigação.
- Main modules/files likely involved: chamada exploratória (curl/script descartável), atualização de `docs/espn-live-scores.md`
- Dependencies: nenhuma
- Story points: 2
- Criticality: critical
- Technical risk: medium
- Recommended TDD later: no (spike investigativo, não gera produção)
- Execution cost:
  - spec: N/A
  - tdd: N/A
  - implement: sonnet/medium
  - test: N/A
  - review: sonnet/medium
- Notes: **Gating.** Sem a tabela de aliases validada, TASK-01 e TASK-05 operam no escuro. Se a Copa não tiver jogo no dia da execução, usar `?dates` de uma data com jogo confirmado (PRD lista 2026-06-13/14) ou base 2022 (`fifa.world` season 2022) para coletar abreviações.

### TASK-01 – Índice reverso do teamRegistry + aliases ESPN
- Type: domain
- Goal: Permitir lookup `abbreviation` ESPN → `TeamEntry` (e portanto `id`/`code`), com tabela de aliases para divergências conhecidas.
- Scope: Adicionar `buildCodeIndex()` / `resolveTeamByCode(abbr)` ao teamRegistry. Mapa de aliases ESPN→code (ex.: `"US"→"USA"` se confirmado). Função pura, testável. NÃO altera o registry existente (chave por nome openfootball).
- Main modules/files likely involved: `src/server/copaData/teamRegistry.ts`, `__tests__/teamRegistry.test.ts`
- Dependencies: TASK-00 (consome a tabela de aliases validada)
- Story points: 2
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes (lookup/aliases = regra de resolução, regression-sensitive)
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: **TASK-00 já validou os 48 `abbreviation` vs `code`: ZERO divergências.** Mapa de aliases nasce `{}` (vazio) — manter só como ponto de extensão contra mudança futura da ESPN. `resolveTeamByCode(abbr)` é lookup direto `code === abbr`. Base do matching (TASK-05).

### TASK-02 – Schema Zod do scoreboard ESPN
- Type: domain
- Goal: Definir o shape validável do scoreboard ESPN consumido — apenas campos usados, tolerante a campos extras.
- Scope: `espnTypes.ts` com Zod `.passthrough()` (não strict): `events[].competitions[].competitors[].{score, winner, homeAway, team.abbreviation}`, `events[].competitions[].status.type.{state, detail}`, `events[].date`. Tipo derivado. Parsing seguro (`safeParse`).
- Main modules/files likely involved: `src/server/copaData/espnTypes.ts`, `__tests__/espnTypes.test.ts`
- Dependencies: nenhuma
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (schema declarativo; testes junto em /test)
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: **TASK-00 confirmou: `score` é STRING sempre** (`"1"`, `"0"`) em `post` e `in`. Coerção `z.coerce.number().int().min(0)` obrigatória. `event.date` é ISO 8601 com `Z` sem segundos (`"2026-06-14T04:00Z"`).

### TASK-03 – EspnScoreClient (fetch/timeout/erros tipados)
- Type: integration
- Goal: Cliente HTTP que busca o scoreboard ESPN com cache 5min, timeout, erros tipados e validação via schema da TASK-02.
- Scope: `espnClient.ts` espelhando `HttpCopaDataClient`: `fetch(url, { next: { revalidate: 300 }, signal })`, timeout via AbortController. Erros tipados `EspnTimeoutError`/`EspnFetchError`/`EspnParseError`. URL `site.api.espn.com/.../soccer/fifa.world/scoreboard` (com `?dates` conforme achado da TASK-00). Valida shape via `espnScoreboardSchema.safeParse`. **Critério de aceite explícito:** `revalidate: 300` (cache 5min) assertado em teste.
- Main modules/files likely involved: `src/server/copaData/espnClient.ts`, `__tests__/espnClient.test.ts`
- Dependencies: TASK-02
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: no (I/O wrapper; testar com mock fetch em /test)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: opus/high
- Notes: **TASK-00 confirmou: `?dates=YYYYMMDD` é OBRIGATÓRIO** (janela default cobre só 1 dia, não confiável). Usar dia atual UTC. Intervalo `?dates=A-B` também funciona. `revalidate: 300` é o cache 5min pedido. Não confundir com tier `jogoAoVivo`. Testes mockam fetch (sem rede real).

### TASK-04 – Mapper ESPN event → patch de status/placar
- Type: application
- Goal: Converter um competition ESPN em `{ status, homeScore, awayScore }` consumível pelo merge.
- Scope: `espnMapper.ts`: `mapEspnState(state, detail)` → `"scheduled"|"live"|"finished"`; extrair scores de `competitors[]` por `homeAway`. Retorna patch parcial. Respeita refine do matchSchema (live = ambos presentes ou ambos null; finished = ambos presentes).
- Main modules/files likely involved: `src/server/copaData/espnMapper.ts`, `__tests__/espnMapper.test.ts`
- Dependencies: TASK-02
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes (mapeamento de estado + regras de placar = conditional behavior, regression-sensitive)
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: **TASK-00 confirmou: mapear SÓ por `state`** (`pre`→scheduled, `in`→live, `post`→finished). **NUNCA parsear `detail`** — é texto livre/localizado (`"31'"`, `"Sun, June 14th at 1:00 PM EDT"`, `"FT"`), display-only. ET/pênaltis ainda `in`/`post` → mapeia live/finished. Score parcial só quando state=in. Extras no `in`: `status.displayClock`, `status.period`.

### TASK-05 – Matcher ESPN event ↔ matchId openfootball
- Type: application
- Goal: Casar cada evento ESPN ao `matchId` openfootball correto via (data UTC ±1 dia) + par de abreviações resolvidas pelo registry.
- Scope: `espnMatcher.ts`: dado evento ESPN + a **lista base `MatchWithId[]`** (de `fetchAllMatches()`), retorna `matchId | null`. Estratégia FIXA: resolver `abbreviation` ESPN → team id via TASK-01, então casar contra o **`m.id` existente** na base por par de team ids (home/away) + janela de data UTC ±1 dia — **NUNCA reconstruir o slug do matchId**. Ignora (null) eventos com time não resolvido ou cujo match base ainda tenha placeholder (id real não casável). Produz `Map<matchId, patch>` combinando com TASK-04.
- Main modules/files likely involved: `src/server/copaData/espnMatcher.ts`, `__tests__/espnMatcher.test.ts`
- Dependencies: TASK-01, TASK-04
- Story points: 5
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes (matching = lógica crítica, falha corrompe placares de jogos errados)
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Notes: **Task mais arriscada.** **TASK-00 reduziu o risco de alias a zero** (lookup direto), mas o casamento por par de ids + data continua crítico. ESPN emite placeholders de mata-mata como `abbreviation` (`1A`–`1L`, `2A`–`2L`, `3RD`, `RD16 W1`–`RD16 W8`, `RD32`) — rejeitados naturalmente (não estão no registry). Par de times é único por dia na fase de grupos; no mata-mata validar com placeholders resolvidos. Matching errado nunca pode escrever em jogo errado — preferir falso-negativo (ignora) a falso-positivo.

### TASK-06 – Merge ESPN em getEffectiveMatches
- Type: persistence
- Goal: Integrar o patch ESPN no pipeline efetivo de partidas, com precedência `manual > ESPN > openfootball` e fallback resiliente.
- Scope: `matchSource.ts`: após `fetchAllMatches()`, chamar `EspnScoreClient` + matcher (try/catch → patchMap vazio em falha). Patch ESPN aplicado **somente no pass `base.map()`** (membros da base), antes do override manual, e **pulado quando `isManualOverride === true`**. O loop de overrides-ausentes-da-base permanece intocado (ESPN nunca inventa partida). Logar falha ESPN como `console.error` sem lançar. **Critério de aceite:** teste de regressão (snapshot) provando que ESPN-down → saída idêntica ao openfootball atual.
- Main modules/files likely involved: `src/server/copaData/matchSource.ts`, `__tests__/matchSource.test.ts`
- Dependencies: TASK-03, TASK-05
- Story points: 3
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes (ordem de precedência + fallback = regra crítica de não-regressão)
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/high
  - review: opus/high
- Notes: Não substituir doc inteiro com ESPN (só `status/homeScore/awayScore`). Coleção vazia + ESPN OK → base + live. ESPN falha → idêntico ao atual. Cache bust admin (PRD-11) segue funcional.

### TASK-07 – Frontend trata status "live"
- Type: application
- Goal: Garantir que Home e lista/detalhe de Matches renderizam `status === "live"` com badge "AO VIVO" e placar parcial.
- Scope: Auditar consumidores de `MatchWithId.status`. Adicionar tratamento de `live` onde só havia `scheduled`/`finished` (badge, placar parcial visível). Frontend — `is_frontend: true`.
- Main modules/files likely involved: `src/features/matches/*`, `src/features/home/*` (cards), possíveis helpers de status.
- Dependencies: TASK-06
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (UI; testes de derivação onde houver lógica)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: Frontend → roda `/ui-spec` + `/patterns:nextjs` + `/ui-review`. Escopo real depende da auditoria — pode ser pequeno se cards já tratam `live` genericamente.

## 4. Dependency map

```
TASK-00 (spike) ─→ TASK-01 (registry reverso) ──┐
                                                ├─→ TASK-05 (matcher) ──┐
TASK-02 (schema ESPN) ──┬───────────────────────┘                      │
                        │                                              ├─→ TASK-06 (merge) ─→ TASK-07 (frontend)
                        ├─→ TASK-03 (client) ──────────────────────────┘
                        └─→ TASK-04 (mapper) ─→ TASK-05
```

- TASK-00: sem deps (gating spike)
- TASK-01: ⟵ TASK-00
- TASK-02: sem deps (mas TASK-00 confirma tipo do score)
- TASK-03: ⟵ TASK-02 (TASK-00 confirma `?dates`)
- TASK-04: ⟵ TASK-02
- TASK-05: ⟵ TASK-01, TASK-04
- TASK-06: ⟵ TASK-03, TASK-05
- TASK-07: ⟵ TASK-06

## 5. Recommended execution order

1. ~~**TASK-00** — spike empírico ESPN (gating)~~ ✅ **CONCLUÍDO** (achados em `docs/espn-live-scores.md`)
2. **TASK-01** — registry reverso (aliases `{}`, fundação do matching) ← **PRÓXIMA**
3. **TASK-02** — schema Zod ESPN (fundação do client/mapper)
4. **TASK-03** — EspnScoreClient
5. **TASK-04** — mapper event→patch
6. **TASK-05** — matcher event↔matchId (crítico)
7. **TASK-06** — merge em getEffectiveMatches
8. **TASK-07** — frontend trata live

TASK-01 e TASK-02 paralelizáveis após TASK-00. TASK-03 e TASK-04 paralelizáveis após TASK-02.

## 6. Planning risks and blockers

- ~~**Gap PRD #1 (aliases):**~~ ✅ **RESOLVIDO (TASK-00):** 48/48 batem, zero aliases.
- ~~**Gap PRD #3 (tipo do score ESPN):**~~ ✅ **RESOLVIDO (TASK-00):** `score` é string → `z.coerce.number()`.
- ~~**Gap PRD #5 (janela do scoreboard):**~~ ✅ **RESOLVIDO (TASK-00):** `?dates=YYYYMMDD` obrigatório.
- **TASK-05 (matcher) — risco crítico/alto (residual).** Risco de alias zerado pela TASK-00; resta o casamento por par de team ids + janela de data ±1 dia, e a rejeição de placeholders de mata-mata. Matching errado nunca pode escrever em jogo errado.
- **TASK-06 (merge) — não-regressão.** Qualquer falha ESPN deve degradar para openfootball idêntico ao atual. TDD obrigatório para provar fallback.
- **TASK-07 escopo incerto:** depende de auditoria do frontend — pode ser trivial (cards já genéricos) ou médio.
