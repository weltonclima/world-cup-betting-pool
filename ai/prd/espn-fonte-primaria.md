# PRD — ESPN como Fonte Primária de Dados de Copa (PRD-13)

> Status: Draft · Data: 2026-06-14 · Autor: Welton Lima

---

## 1. Feature summary

Tornar a API pública não-oficial da ESPN (`site.api.espn.com`) a **fonte primária** de todos os dados de Copa 2026 — schedule completo, status, placares e times — substituindo o openfootball como base da pipeline. O openfootball pode ser mantido apenas como fallback estático de emergência ou removido inteiramente.

**Motivação imediata (bug):** A integração ESPN (PRD-12) busca scores somente para `?dates=TODAY`. Jogos disputados ontem ou antes, cujos resultados o openfootball ainda não atualizou, continuam aparecendo como `"scheduled"` com placar `null`. A Home screen exibe dados incorretos para resultados recentes.

**Solução estrutural:** Em vez de corrigir o TODAY-only buscando ESPN para múltiplas datas históricas (paliativo), promover ESPN a fonte canônica do schedule completo — uma chamada de range de datas cobre todo o torneio e devolve schedule + placares + status em tempo real.

---

## 2. Consolidated scope

### In scope
- Novo cliente ESPN para schedule completo: `fetchEspnSchedule(dateRange)` buscando o scoreboard com range de datas (ex.: `?dates=20260611-20260715`), retornando `EspnEvent[]` para o torneio inteiro.
- Novo mapper ESPN event → `MatchWithId` completo (não só o patch parcial de status/scores). Campos: `kickoffAt`, `homeTeamId`, `awayTeamId`, `stage`, `groupId`, `round`, `venue`, `status`, `homeScore`, `awayScore`.
- Estratégia de matchId estável derivada de ESPN (ver seção 7 — risco crítico).
- Atualização de `getEffectiveMatches()`: ESPN passa a ser a base, não o openfootball.
- Manutenção da camada de overrides manuais (Firestore `isManualOverride === true`) sobre a base ESPN.
- Manutenção do fallback resiliente: ESPN-down → fallback para openfootball (estático) ou erro degradado gracioso.
- Investigação spike (TASK-00 deste PRD): confirmar campos ESPN para stage/group/venue/matchNum antes de implementar.
- Atualização de `fetchAllTeams()`: derivar a partir de ESPN events + teamRegistry (mesma lógica atual, fonte muda).
- Cache: schedule completo com `revalidate: 300` (5min) — mesmo tier do live atual.

### Out of scope
- Remoção definitiva do openfootball neste PRD — manter como fallback de emergência até validação em produção.
- Migração de matchIds existentes no Firestore (histórico) — somente se a estratégia de matchId não conseguir preservar os IDs atuais (ver riscos).
- Admin sync via openfootball (`/api/admin/worldcup/sync`) — desativado nesta feature; admin edit manual continua funcionando.
- Pênaltis / `shootoutScore` — PRD separado (exige extensão do `matchSchema`).
- Copa feminina, stats, odds, broadcasts.

---

## 3. System understanding relevant to this feature

### Pipeline atual (PRD-12 completo, TASK-07 merged)
```
openfootball JSON (GitHub raw)
  └─ fetchAllMatches()       openfootball base → MatchWithId[] (schedule completo)
       └─ getEffectiveMatches()
            ├─ fetchEspnPatchMap(today)   ESPN scoreboard só para dia atual
            │    └─ buildEspnPatchMap()   {matchId → patch{status,scores}}
            ├─ applyEspnPatches()         sobrescreve status/scores de jogos de HOJE
            └─ readPersistedMatches()     overrides manuais (isManualOverride=true) vencem tudo
                 └─ /api/matches          Route Handler (revalidate=3600)
```

**Gap atual:** `fetchEspnPatchMap` chama `fetchScoreboard(todayUtcYyyymmdd())` — apenas hoje. Jogos de dias anteriores que o openfootball ainda não atualizou ficam como `"scheduled"` na Home.

### matchId — esquema atual (CRÍTICO)
- **Grupos** (sem `num`): `{YYYY-MM-DD}-{slug(team1)}-{slug(team2)}`  
  Onde `slug(name) = name.toLowerCase().replace(/[^a-z0-9]/g, '-')`.  
  Exemplo: `2026-06-14-brazil-morocco`.  
  `name` vem do openfootball (inglês): `"Brazil"`, `"Morocco"`, etc.
- **Mata-mata** (com `num`): `m{num}` (ex.: `m73`, `m104`).  
  `num` é o campo do openfootball; **ESPN não tem campo equivalente direto** — risco alto.
- Todos os matchIds são usados como chave primária em: `predictions/{matchId}`, `matches/{id}` (Firestore), `worldcup_cache` standings/bracket, logs de ranking.

### teamRegistry
- Keyed por nome openfootball (inglês): `"Brazil"`, `"Morocco"`, etc.
- Cada entry tem `{ id, code, name, flagUrl }` onde `id === code` (3 letras FIFA).
- TASK-01 (PRD-12) adicionou `resolveTeamByCode(abbr)` — lookup por código ESPN.
- Os 48 `abbreviation` ESPN batem exatamente com `code` do registry (spike TASK-00, PRD-12).
- A chave openfootball (nome) é necessária para reconstruir o matchId de grupos — deve ser preservada.

### Campos de `MatchWithId` que o mapper ESPN atual NÃO produz
O `espnMapper.ts` atual gera apenas `EspnMatchPatch { status, homeScore, awayScore }`.  
Um mapper completo precisaria também de:
- `kickoffAt` → provavelmente `event.date` (já disponível, ISO 8601 UTC)
- `homeTeamId` / `awayTeamId` → de `competitors[].team.abbreviation` → `resolveTeamByCode`
- `stage` → não mapeado atualmente; ESPN usa `competitions[0].type.abbreviation` ou similar
- `groupId` → não mapeado; ESPN provavelmente tem `competitions[0].groups[].abbreviation`
- `round` → número da rodada dentro do grupo
- `venue` → não mapeado; ESPN provavelmente tem `competitions[0].venue.{fullName,city}`
- matchId → precisa ser construído (ver riscos)

### ESPN scoreboard com date range
- Endpoint confirmado: `site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=YYYYMMDD-YYYYMMDD`
- Spike TASK-00 (PRD-12) confirmou: retornou 100 eventos para `20260611-20260715`.
- Copa 2026 tem **104 partidas** (72 de grupo + 16+8+4+2+1+1 = 32 mata-mata).
- **Gap não resolvido:** ESPN retorna exatamente 100 eventos ou há paginação? Se truncar em 100, o range precisa ser dividido em 2 chamadas (ex.: grupo + mata-mata, ou primeira metade + segunda metade do calendário).

### Admin sync (impacto)
- `/api/admin/worldcup/sync` chama openfootball e persiste em Firestore `matches`. Com ESPN como base, este endpoint deixa de fazer sentido como "sync" — ou é adaptado para ESPN ou desativado nesta feature.
- Admin manual edit (`PUT /api/admin/matches/[id]`) continua funcional — opera sobre matchIds, independente da fonte.

---

## 4. Technical impact analysis

### Módulos diretamente afetados

| Módulo | Impacto |
|---|---|
| `src/server/copaData/espnClient.ts` | Adicionar `fetchSchedule(dateRange)` (ou adaptar `fetchScoreboard` para range) |
| `src/server/copaData/espnTypes.ts` | Estender schema para capturar campos adicionais: `type`, `groups`, `venue`, `id` do evento |
| `src/server/copaData/espnMapper.ts` | Novo `mapEspnEventToMatch()` → `MatchWithId` completo (não só patch) |
| `src/server/copaData/matchSource.ts` | Substituir `fetchAllMatches()` (openfootball) por `fetchEspnSchedule()` como base; simplificar pipeline |
| `src/server/copaData/index.ts` | Atualizar exports; `fetchAllMatches()` passa a usar ESPN internamente ou é renomeado |
| `src/server/copaData/mapper.ts` | Obsoleto como caminho principal; manter como fallback ou remover |
| `src/server/copaData/client.ts` | Idem — openfootball client torna-se fallback ou removido |
| `src/server/copaData/config.ts` | `REVALIDATE_MATCHES` pode ser revisto; URL openfootball pode virar fallback |
| `src/app/api/matches/route.ts` | `revalidate` pode cair de 3600s para 300s (ESPN cache tier) |
| `src/app/api/admin/worldcup/sync/route.ts` | Desativar ou adaptar: sync openfootball → Firestore não faz mais sentido como base |

### Fluxo novo pretendido
```
getEffectiveMatches()
  ├─ fetchEspnSchedule("20260611-20260715") ou dois ranges
  │    └─ mapEspnEventsToMatches()    ESPN → MatchWithId[] completo (base)
  ├─ applyManualOverrides()           isManualOverride=true vence ESPN
  └─ fallback: openfootball           se ESPN-down (best-effort)
       └─ /api/matches                Route Handler (revalidate=300)
```

### Impacto de contrato externo
- `MatchWithId[]` shape não muda — nenhum contrato de API/frontend precisa ser alterado.
- `status: "live"` continua sendo emitido (frontend já trata, TASK-07 PRD-12).
- matchIds devem ser idênticos aos atuais para não quebrar `predictions`, Firestore `matches`, rankings.

### Cache
- Route Handler `revalidate` pode cair de 3600s para 300s (ESPN é o único cache agora).
- Tier `jogoAoVivo` permanece 60s no React Query do cliente.

---

## 5. Risks

| Risco | Severidade | Mitigação |
|---|---|---|
| **matchId quebra** para mata-mata: openfootball tem `num` (73–104); ESPN não tem campo equivalente confirmado | Crítico | Spike obrigatório: verificar se ESPN events têm campo de match number ou se IDs sequenciais são estáveis. Fallback: derivar ordem por data+round para reconstruir `m{num}` |
| **matchId quebra** para grupos: slug usa nome openfootball ("Brazil"); ESPN usa abbreviation ("BRA") | Alto | Usar `resolveTeamByCode` → entry → chave openfootball (reverse lookup do TEAM_REGISTRY) para reconstruir slug idêntico. Testar com todos os 48 times antes de implementar |
| **ESPN trunca em 100 eventos** (104 > 100): schedule incompleto | Alto | Fazer 2 chamadas por range de datas disjuntos; ou paginação se ESPN suporta. Confirmar no spike |
| **ESPN não fornece stage/group/venue nos campos esperados** | Alto | Spike empírico obrigatório antes de implementar. Campos são acessíveis via `.passthrough()` mas não tipados — precisam ser confirmados |
| **Regressão em matchIds existentes**: predictions/rankings quebram se ID muda | Crítico | Estratégia matchId deve ser provada com snapshot test contra IDs atuais antes de qualquer merge |
| **Mata-mata com placeholders**: ESPN emite `1A`–`1L` como abbreviation (confirmado no PRD-12 spike) — mas como gerar `homeTeamId = "1A"` que o domínio usa como placeholder? | Médio | O mapper pode emitir o placeholder literal quando `resolveTeamByCode` retorna null — mesma lógica de `resolveTeamId` atual |
| **ESPN indisponível por janela > 5min com openfootball também obsoleto** | Médio | Fallback para openfootball congelado (dados parcialmente corretos) + alerta de monitoring. Degradação aceitável |
| **Admin sync obsoleto**: `/api/admin/worldcup/sync` sincronizava openfootball→Firestore; com ESPN como base direta, sync deixa de ter sentido | Médio | Desativar o endpoint (não é crítico ao funcionamento) ou adaptar para forçar revalidate do cache ESPN |
| **ESPN muda shape sem aviso** (API não-oficial) | Alto | Schema `.passthrough()` absorve campos extras; parse `safeParse` com fallback para openfootball |

---

## 6. Ambiguities and gaps

### GAP-01 — Stage/group ESPN (BLOQUEADOR)
Quais campos do evento ESPN identificam stage e group?
- Suspeitos: `competitions[0].type.abbreviation` (`"GROUP"`, `"RND32"`, `"QTR"`, etc.), `competitions[0].groups[].abbreviation` (`"A"`, `"B"`, ...).
- Mapeamento para nosso `stageSchema`: `"grupos" | "dezesseis-avos" | "oitavas" | "quartas" | "semifinal" | "terceiro" | "final"`.
- **Requer spike empírico** — não implementar sem confirmar.

### GAP-02 — Match number ESPN para mata-mata (BLOQUEADOR)
O openfootball numera mata-mata sequencialmente (`num`: 73–104), gerando IDs `m73`–`m104`. A ESPN tem campo equivalente?
- Suspeitos: campo `uid` do evento (ex.: `"s:600~l:1~e:12345"`), `id` (ex.: `"12345"`), ou campo separado de `matchNumber`.
- Se ESPN não tem match number compatível, a única alternativa é derivar `m{num}` por **ordem dos eventos no schedule** (eventos ordenados por data → atribuir num sequencial a partir de 73).
- **Requer spike empírico** antes de decidir estratégia.

### GAP-03 — Round (número da rodada no grupo) ESPN
`round` (inteiro: 1, 2, 3) é extraído do openfootball como `parseInt("Matchday 1")`.
- ESPN provavelmente tem `competitions[0].week` ou similar.
- **Requer confirmação no spike.**

### GAP-04 — Venue ESPN
`venue` exige `{ name: string, city: string }`.
- ESPN provavelmente tem `competitions[0].venue.{fullName, address.city}`.
- **Requer confirmação no spike.**

### GAP-05 — Paginação do scoreboard ESPN para range
Spike TASK-00 (PRD-12) retornou 100 eventos para range de ~35 dias. Copa tem 104 matches.
- ESPN pagina ou trunca silenciosamente em 100?
- Se trunca, qual split de range cobre todos os 104 jogos?

### GAP-06 — fetchAllTeams com ESPN
`fetchAllTeams()` deriva times dos matches de grupo openfootball. Com ESPN como base:
- ESPN events de grupo têm competitors com times reais (não placeholders) → mesma derivação funciona.
- Mas é necessário um mapa inverso de `abbreviation` → chave openfootball para montar `groupId` corretamente.
- Avaliar se `TEAM_REGISTRY` estático é suficiente como fonte de teams (sem HTTP) — provavelmente sim.

---

## 7. Recommended implementation concerns

1. **TASK-00 obrigatório (spike):** Antes de qualquer código de produção, executar spike empírico para resolver GAP-01 a GAP-05. Buscar ESPN range real, inspecionar JSON completo, confirmar: (a) campos de stage/group, (b) match number em mata-mata, (c) round em grupos, (d) venue, (e) comportamento de paginação para >100 eventos.

2. **matchId strategy — crítico:**  
   - **Grupos:** derivar via reverse lookup TEAM_REGISTRY: `code → openfootball_key → slugify`. Adicionar mapa `code → openfootball_name` ao teamRegistry (ou iterar as entries — já é possível hoje).  
   - **Mata-mata:** confirmar no spike. Se ESPN tem match number → `m{espn_match_num}`. Se não → ordenar mata-mata por data/rodada e atribuir `m73`–`m104` na mesma ordem do openfootball.  
   - **Validação obrigatória:** testes snapshot comparando IDs gerados pelo mapper ESPN versus IDs reais existentes para os jogos já ocorridos. Zero divergência antes de merge.

3. **Fallback openfootball:** Manter `HttpCopaDataClient` e o pipeline openfootball durante a transição. `getEffectiveMatches()` tenta ESPN primeiro; se falhar integralmente (não só patch vazio) → usa openfootball. Só remover openfootball em um PRD futuro após ESPN estável em produção.

4. **Admin sync:** Desativar ou no-op o endpoint `/api/admin/worldcup/sync` (retornar 410 Gone ou 501 Not Implemented com mensagem de migração). Não confundir com `/api/admin/matches/[id]` (manual edit) — este continua.

5. **Cache revalidate:** Com ESPN como única fonte ao vivo, o Route Handler `/api/matches` pode reduzir `revalidate` de 3600s para 300s (ESPN revalida em 5min; 1h de cache no route handler é desnecessário).

6. **TDD obrigatório para matchId:** Testes red-green cobrindo: grupos com todos os 48 times, mata-mata com placeholders, mata-mata com times reais, IDs idênticos aos atuais para jogos já conhecidos.

7. **Schema ESPN extensão:** O `espnEventSchema` atual usa `.passthrough()` — campos adicionais como `type`, `groups`, `venue` já chegam no objeto Zod mas sem tipagem. A extensão do schema deve ser feita antes do mapper, não inline.
