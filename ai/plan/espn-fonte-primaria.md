# PLAN — ESPN como Fonte Primária de Dados de Copa (PRD-13)

> Status: Draft · Data: 2026-06-14 · Origem: `ai/prd/espn-fonte-primaria.md`

---

## 1. Planning summary

Promover ESPN de overlay (today-only) a fonte canônica do schedule completo da Copa 2026. O bloqueador dominante é **estabilidade de matchId** — IDs gerados a partir da ESPN devem ser byte-idênticos aos atuais (openfootball) para não quebrar `predictions/{matchId}`, `matches/{id}`, `worldcup_cache` e rankings. Por isso o plano começa por um **spike empírico obrigatório (TASK-00)** que resolve 5 GAPs antes de qualquer código de produção, seguido de tarefas de fundação (schema, matchId), regra de mapeamento (mapper completo), exposição (client range, pipeline) e limpeza (admin sync, cache).

8 tarefas em 4 fases. openfootball **não** é removido — vira fallback de emergência. Migração de matchIds históricos só ocorre se o spike provar que a paridade de IDs é impossível (contingência, fora do escopo base).

## 2. Recommended execution phases

- **Phase 1 — Fundação & de-risk:** TASK-00 (spike), TASK-01 (schema), TASK-02 (matchId + reverse lookup).
- **Phase 2 — Regra de mapeamento:** TASK-03 (mapper completo event→MatchWithId).
- **Phase 3 — Exposição & integração:** TASK-04 (client range+paginação), TASK-05 (getEffectiveMatches), TASK-06 (fetchAllTeams).
- **Phase 4 — Limpeza & cache:** TASK-07 (desativar admin sync + revalidate).

## 3. Tasks

### TASK-00 – Spike empírico ESPN schedule range
- Type: integration
- Goal: Resolver GAP-01..05 com dado real antes de escrever código de produção.
- Scope: Buscar scoreboard ESPN com range real (`?dates=20260611-20260715`), salvar JSON bruto, inspecionar e **documentar** num arquivo de findings: (a) campos de stage — `competitions[0].type.*`; (b) campos de group — `competitions[0].groups[].*`; (c) match number de mata-mata — `id`/`uid`/campo dedicado; (d) round em grupos — `week`/similar; (e) venue — `competitions[0].venue.*`; (f) contagem de eventos retornados (trunca em 100? pagina?) e split de range que cobre os 104 jogos. NENHUM código de produção.
- Main modules/files likely involved: script throwaway de fetch; `ai/spec/` ou `ai/prd/` findings doc; leitura de `espnTypes.ts`, `mapper.ts`, `teamRegistry.ts` como referência de paridade.
- Dependencies: nenhuma.
- Story points: 3
- Criticality: critical
- Technical risk: high
- Recommended TDD later: no (spike investigativo, sem código de produção)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: opus/high
  - test: sonnet/medium
  - review: opus/high
- Notes: Bloqueia TASK-01..05. Se o spike provar que match number de mata-mata é irrecuperável por ordem estável → escalar decisão (contingência de migração de IDs) ao usuário antes de seguir.

### TASK-01 – Estender `espnEventSchema` para schedule completo
- Type: api
- Goal: Tipar os campos ESPN adicionais necessários ao mapper completo, confirmados no spike.
- Scope: Estender o Zod schema (mantendo `.passthrough()`) para capturar `event.id`/`uid`, `competitions[0].type`, `competitions[0].groups`, `competitions[0].venue`, `week`/round. Campos tolerantes (`.optional()`) — ESPN é não-oficial. Sem lógica de mapeamento aqui.
- Main modules/files likely involved: `src/server/copaData/espnTypes.ts`.
- Dependencies: TASK-00.
- Story points: 2
- Criticality: high
- Technical risk: medium
- Recommended TDD later: no (schema/DTO; validar via parse de fixture do spike no test da TASK-03)
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: Usar a fixture JSON capturada na TASK-00 como prova de parse.

### TASK-02 – Reverse lookup TEAM_REGISTRY + estratégia de matchId ESPN
- Type: domain
- Goal: Gerar matchIds byte-idênticos aos atuais a partir de dados ESPN — núcleo de risco da feature.
- Scope: (a) Mapa inverso `code → openfootball_name` derivado do `TEAM_REGISTRY` (para reconstruir o slug de grupos a partir da abbreviation ESPN). (b) `buildEspnMatchId(event)`: grupos → `{YYYY-MM-DD}-{slug(of_name)}-{slug(of_name)}`; mata-mata → `m{num}` onde `num` vem da estratégia confirmada no spike (campo ESPN direto, ou ordem estável por data/rodada começando em 73). (c) Tratamento de placeholders de mata-mata (`1A`..`W74`) coerente com `resolveTeamId` atual.
- Main modules/files likely involved: `src/server/copaData/teamRegistry.ts`, novo helper em `espnMatcher.ts`/`espnMapper.ts` ou módulo `espnMatchId.ts`, leitura de `mapper.ts` (paridade de `buildMatchId`).
- Dependencies: TASK-00.
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
- Notes: TDD red-green obrigatório. Snapshot test comparando IDs gerados vs IDs reais existentes (jogos de grupo com os 48 times + mata-mata). **Zero divergência antes de merge.**

### TASK-03 – Mapper completo `mapEspnEventToMatch` → `MatchWithId`
- Type: integration
- Goal: Converter um `EspnEvent` num `MatchWithId` completo (não só patch de status/score).
- Scope: Novo `mapEspnEventToMatch(event)` produzindo `id` (via TASK-02), `kickoffAt` (`event.date`), `homeTeamId`/`awayTeamId` (`resolveTeamByCode` + placeholder fallback), `stage`, `groupId`, `round`, `venue`, `status`, `homeScore`, `awayScore`. Validar saída contra `matchSchema` (`.strict()`). Mapear `type.abbreviation` ESPN → `stageSchema`; `groups[].abbreviation` → `groupId`; venue → `{name, city}`.
- Main modules/files likely involved: `src/server/copaData/espnMapper.ts`, `src/schemas/matches.ts` (referência), `teamRegistry.ts`.
- Dependencies: TASK-01, TASK-02.
- Story points: 5
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/medium
  - review: opus/high
- Notes: TDD cobrindo cada campo + parse `matchSchema` ok. Reusar fixture do spike. Mapeamento stage/group é o ponto frágil — testar todos os stages.

### TASK-04 – `EspnScoreClient.fetchSchedule(range)` + paginação/split
- Type: integration
- Goal: Buscar o schedule inteiro (104 jogos) cobrindo o limite de 100 eventos da ESPN.
- Scope: Adicionar `fetchSchedule(dateRange)` (ou generalizar `fetchScoreboard` para aceitar range). Se o spike confirmar truncamento em 100 → fazer 2+ chamadas de ranges disjuntos e mesclar dedup por `event.id`. Reusar `EspnTimeoutError/EspnFetchError/EspnParseError`. Cache `revalidate: 300`.
- Main modules/files likely involved: `src/server/copaData/espnClient.ts`, `config.ts`.
- Dependencies: TASK-00.
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
- Notes: TDD na lógica de split/merge/dedup (não na rede). Garantir cobertura dos 104 jogos sem duplicar.

### TASK-05 – `getEffectiveMatches`: ESPN base + fallback openfootball + overrides
- Type: application
- Goal: Inverter a pipeline — ESPN vira base; openfootball vira fallback; overrides manuais continuam vencendo.
- Scope: Refatorar `getEffectiveMatches()`: tentar `fetchSchedule` + `mapEspnEventsToMatches` como base; se ESPN falhar integralmente → fallback `fetchAllMatches()` openfootball; aplicar `readPersistedMatches` (`isManualOverride===true`) por cima. Precedência `manual > ESPN > openfootball-fallback`. Resiliência em ambas as bordas (ESPN-down e Firestore-down) preservada.
- Main modules/files likely involved: `src/server/copaData/matchSource.ts`, `index.ts` (exports), `src/app/api/matches/route.ts` (revalidate).
- Dependencies: TASK-03, TASK-04.
- Story points: 5
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/medium
  - review: opus/high
- Notes: TDD nos caminhos: ESPN ok, ESPN-down→openfootball, Firestore-down, override manual presente. Não regredir o contrato `MatchWithId[]`.

### TASK-06 – `fetchAllTeams` derivado de ESPN/registry
- Type: application
- Goal: Derivar seleções participantes sem depender do openfootball como base.
- Scope: Adaptar `fetchAllTeams()` para derivar de ESPN events de grupo (competitors reais) + `TEAM_REGISTRY`, montando `groupId` via reverse map da TASK-02. Avaliar se o `TEAM_REGISTRY` estático basta (sem HTTP). Manter shape `TeamWithId[]`.
- Main modules/files likely involved: `src/server/copaData/index.ts`, `teamRegistry.ts`.
- Dependencies: TASK-02, TASK-03.
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (derivação mecânica; coberta por test leve junto da TASK-03)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: groupId deve casar com o atual ("A".."L").

### TASK-07 – Desativar admin sync openfootball + ajustar cache revalidate
- Type: infra
- Goal: Limpar o endpoint de sync obsoleto e alinhar o cache à fonte ESPN.
- Scope: `/api/admin/worldcup/sync` → no-op/410 Gone/501 com mensagem de migração (não confundir com `/api/admin/matches/[id]` manual edit, que permanece). `/api/matches` `revalidate` 3600→300. Atualizar `architecture.md`.
- Main modules/files likely involved: `src/app/api/admin/worldcup/sync/route.ts`, `src/app/api/matches/route.ts`, `config.ts`, `.claude/context/architecture.md`.
- Dependencies: TASK-05.
- Story points: 2
- Criticality: low
- Technical risk: low
- Recommended TDD later: no (wiring/config)
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/medium
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: Confirmar que nada além do admin chama o sync antes de desativar.

## 4. Dependency map

```
TASK-00 (spike) ─┬─> TASK-01 ─┐
                 ├─> TASK-02 ─┼─> TASK-03 ─┐
                 └─> TASK-04 ──────────────┼─> TASK-05 ─> TASK-07
                                  TASK-02 ─┴─> TASK-06
```

- TASK-00 bloqueia tudo (resolve GAPs).
- TASK-03 precisa de TASK-01 (schema) + TASK-02 (matchId/teams).
- TASK-05 precisa de TASK-03 (mapper) + TASK-04 (client range).
- TASK-06 precisa de TASK-02 + TASK-03.
- TASK-07 precisa de TASK-05 (pipeline já invertida).

## 5. Recommended execution order

1. **TASK-00** — spike (desbloqueia GAPs; pode mudar TASK-02/03)
2. **TASK-01** — schema
3. **TASK-02** — matchId + reverse lookup (núcleo de risco)
4. **TASK-03** — mapper completo
5. **TASK-04** — client range+paginação (paralelizável com 01–03 após spike)
6. **TASK-05** — getEffectiveMatches
7. **TASK-06** — fetchAllTeams
8. **TASK-07** — admin sync + cache

## 6. Planning risks and blockers

- **TASK-00 é gate duro.** TASK-01/02/03/04 não começam sem os findings. Se o spike falhar em achar match number estável de mata-mata, a paridade de matchId fica em risco → decisão de contingência (migração de IDs históricos) sobe ao usuário.
- **TASK-02 e TASK-03 são os de maior risco** (crit critical, risk high). TDD obrigatório com snapshot contra IDs reais. Não fazer merge com qualquer divergência de ID.
- **TASK-04** depende do comportamento de paginação descoberto no spike — escopo (1 chamada vs split) só fecha após TASK-00.
- **TASK-05** inverte a pipeline canônica — maior superfície de regressão. Cobrir todas as bordas de fallback.
- **openfootball mantido como fallback** — não remover nesta feature; remoção é PRD futuro pós-validação em produção.
- **TASK-07** assume que só o admin chama `/api/admin/worldcup/sync`; confirmar antes de desativar.
