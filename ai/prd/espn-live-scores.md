# PRD — ESPN Live Scores (PRD-12)

> Status: Draft · Data: 2026-06-14 · Autor: Welton Lima

---

## 1. Feature summary

Integrar a API pública não-oficial da ESPN (`site.api.espn.com`) como fonte de **placares ao vivo** da Copa 2026, enriquecendo os dados do openfootball (que não emite estado `live` nem atualiza em tempo real). A chamada ESPN é cacheada por **5 minutos** no servidor (Next.js data cache via `fetch` + `revalidate: 300`), eliminando polling excessivo. O manual override do super_admin continua vencendo qualquer fonte.

---

## 2. Consolidated scope

### In scope
- `EspnScoreClient` — fetch com timeout, erros tipados e validação Zod do shape do scoreboard.
- Schema Zod do scoreboard ESPN (`events[].competitions[0]`) — apenas campos consumidos: `status.type.state`, `status.type.detail`, `competitors[].score`, `competitors[].winner`, `competitors[].team.abbreviation`, `startDate`.
- Mapper ESPN event → patch `{ status, homeScore, awayScore }`.
- Matching ESPN event ↔ `matchId` openfootball por: data (UTC, janela ±1 dia) + par de abreviações (`abbreviation`) via `teamRegistry`.
- Merge em `getEffectiveMatches()`: `matchSource.ts` passa a retornar `base openfootball` + `patch ESPN` + `override manual` (precedência manual > ESPN > openfootball).
- Suporte ao status `"live"` com placar parcial (schema já suporta; `mapStatus` e `mapOpenFootballMatch` nunca emitem `live` — passa a vir da ESPN).
- Fallback resiliente: qualquer falha ESPN (timeout, HTTP error, parse error, matching inválido) → ignora patch ESPN, mantém comportamento atual.
- Cache 5 minutos: `fetch(ESPN_URL, { next: { revalidate: 300 } })` — Next.js data cache server-side. Não há polling client-side nesta fase.
- Testes: client (mock fetch), mapper, matching, merge, fallback.

### Out of scope (fases futuras)
- Cliente-side polling (`refetchInterval` React Query) — não nesta fase; cache 5min é a estratégia.
- `shootoutScore` / pênaltis — requer extensão do `matchSchema` (campo `.strict()`); PRD separado.
- Timeline play-by-play (`details[]`).
- Route Handler `/api/matches/live` dedicado — desnecessário com cache 5min na source.
- Copa feminina (`fifa.wwc`).
- Stats, odds, broadcasts, logos ESPN.

---

## 3. System understanding relevant to this feature

### Pipeline atual de dados da Copa
```
openfootball JSON (GitHub raw)
  └─ HttpCopaDataClient.getData()       fetch + Next.js data cache (REVALIDATE_MATCHES tier)
       └─ fetchAllMatches()             mapeia → MatchWithId[]
            └─ getEffectiveMatches()    openfootball base + overlay Firestore (isManualOverride)
                 └─ /api/matches        Route Handler (nodejs, dynamic=force-dynamic)
                      └─ React Query    client (STALE_TIME tier)
```

### Ponto de extensão central
`getEffectiveMatches()` em `src/server/copaData/matchSource.ts` — é aqui que o merge ESPN vai entrar. Precedência atual: `manual > openfootball`. Nova: `manual > ESPN > openfootball`.

### Schema de partida (`matchSchema`)
- Já suporta `status: "live"` com placar parcial (`homeScore`/`awayScore` ambos presentes ou ambos null).
- Schema é `.strict()` — qualquer campo novo exige atualização do schema.
- `isManualOverride === true` blindado do merge ESPN (igual ao merge openfootball).

### matchId — como é gerado
- Mata-mata (campo `num`): `m{num}` (ex.: `m73`). ESPN não tem `num` — o matching precisa cruzar por data + times.
- Grupo (sem `num`): `{date}-{slug(team1)}-{slug(team2)}` onde slug = lowercase + replace não-alfanuméricos por `-`. Data no formato `YYYY-MM-DD`.
- **Crítico:** o `matchId` derivado do slug usa o **nome openfootball** (ex.: `"Brazil"` → `"brazil"`), não a abreviação ESPN. O matching deve resolver `abbreviation` ESPN → nome openfootball via `teamRegistry`, para então reconstruir o matchId ou fazer lookup reverso.

### teamRegistry
- 48 seleções com `{ id, code, name, flagUrl }` onde `id === code` (3 letras FIFA maiúsculas, ex.: `"BRA"`).
- ESPN usa `competitors[].team.abbreviation` — também 3 letras maiúsculas. Deve coincidir com `code` para a maioria dos times; pode divergir para poucos (ex.: `GER` vs `GER` — provavelmente OK; mas `USA` vs `US` é divergência possível).
- O registry está indexado por **nome openfootball** (chave = `"Brazil"`), não por `code`. Para lookup por code: iterar os valores para encontrar `entry.code === abbreviation`.

### Cache tiers atuais
- `jogoAoVivo: 60s`, `jogoEncerrado: 300s`, `jogoDia: 1800s`, `jogoFuturo: 21600s`.
- O Route Handler `/api/matches` usa `revalidateForMatch` por partida.
- A chamada ESPN será cacheada com `revalidate: 300` **independentemente** do tier da partida — o dado ESPN nunca será mais fresco que 5min, mesmo quando o Route Handler revalida em 60s. Isso é intencional (escolha do usuário).

### Cache bust pattern (PRD-11)
Admin PUT/DELETE em matches chama `revalidatePath("/api/matches")` + `revalidatePath("/api/matches/[id]")`. O merge ESPN roda dentro de `getEffectiveMatches()`, chamado pelo Route Handler — o cache bust do admin continua funcional sem alteração.

---

## 4. Technical impact analysis

### Módulos afetados

| Módulo | Impacto |
|---|---|
| `src/server/copaData/matchSource.ts` | Merge ESPN: chamar `EspnScoreClient`, aplicar patches após fallback, antes do override manual |
| `src/server/copaData/espnClient.ts` | **NOVO** — fetch + timeout + erros tipados + Zod |
| `src/server/copaData/espnMapper.ts` | **NOVO** — ESPN event → patch `{ status, homeScore, awayScore }` |
| `src/server/copaData/espnMatcher.ts` | **NOVO** — matching ESPN event ↔ matchId via teamRegistry |
| `src/server/copaData/espnTypes.ts` | **NOVO** — Zod schema do scoreboard ESPN |
| `src/server/copaData/teamRegistry.ts` | Adicionar índice reverso por `code` (lookup `abbreviation → matchId`) |
| `src/server/copaData/mapper.ts` | `mapStatus()` continua sem mudanças — `"live"` não vem do openfootball |

### Fluxo de dados novo
```
getEffectiveMatches()
  ├─ fetchAllMatches()          openfootball base (sem mudança)
  ├─ espnScoreClient.fetch()    ESPN scoreboard (cache 5min)
  │    └─ buildEspnPatchMap()   { matchId → patch } via matcher
  │         └─ fallback {}      se ESPN falhar (qualquer erro)
  ├─ aplicar patches ESPN       match.id presente no patchMap → merge status/scores
  └─ aplicar overrides manuais  isManualOverride === true → vence ESPN + openfootball
```

### Impacto de contrato
- `MatchWithId` shape não muda — `status: "live"` já é válido; `homeScore`/`awayScore` já são anuláveis.
- Clientes do Route Handler `/api/matches` já recebem `status: "live"` — mas nunca ocorria. Após a feature, vai ocorrer. Frontend deve tratar estado `live` (verificar: cards home, lista de jogos, detalhe).

### Performance / cache
- ESPN fetch com `revalidate: 300`: 1 chamada HTTP por 5 min no servidor (compartilhada entre requests Next.js via data cache). Zero impacto em volume de requests ESPN.
- `buildEspnPatchMap()` é CPU-only após o fetch (matching in-memory, 48 times × N jogos). Negligível.
- `getEffectiveMatches()` já fazia 2 I/O (openfootball HTTP + Firestore). Passa a fazer 3 (+ ESPN HTTP). Ambos cacheados no Next.js data cache.

---

## 5. Risks

| Risco | Severidade | Mitigação |
|---|---|---|
| API não-oficial ESPN muda shape sem aviso | Alto | Zod strict validation — parse falha → fallback gracioso (não quebra app) |
| `abbreviation` ESPN diverge do `code` teamRegistry para algum time | Alto | Criar tabela de aliases (ex.: `"US" → "USA"`); testar todos os 48 times antes de produzir; matching falho → ignora evento (nunca corrompe) |
| ESPN retorna evento ESPN↔matchId não casado (mata-mata com placeholder) | Médio | Matching só em partidas com times reais (não placeholder); rejeita silenciosamente eventos não resolvidos |
| Status ESPN `in` emitido quando openfootball ainda tem `finished` (race condition na transição) | Médio | Override manual sempre vence; sem override: ESPN ganha (ESPN > openfootball) — aceitável |
| Regressão: `getEffectiveMatches()` retorna resultado diferente para jogos `post` (ESPN FT != openfootball FT) | Médio | Validar testes de snapshot; ESPN FT deve coincidir com openfootball pós-commit; se divergir, ESPN prevalece (mais confiável) |
| Termos de uso ESPN (API não-oficial, uso em pool) | Médio | Decisão de negócio — documentada no PRD de referência (`docs/espn-live-scores.md`), fora do escopo técnico |
| ESPN indisponível por janela longa (> 5min) | Baixo | Fallback para openfootball — comportamento idêntico ao atual |

---

## 6. Ambiguities and gaps

> **Gaps #1, #3, #5 RESOLVIDOS pelo spike TASK-00 (2026-06-14)** — ver "Achados Empíricos TASK-00" em `docs/espn-live-scores.md`. Síntese abaixo.

1. ~~**Aliases de abreviação**~~ ✅ **RESOLVIDO.** Cruzamento dos 48 `abbreviation` ESPN × `code` do `TEAM_REGISTRY`: **todos batem exatamente, ZERO aliases necessários** — inclui os não-ISO de atenção (`SUI`, `GER`, `NED`, `ALG`, `POR`, `PAR`, `URU`, `KSA`, `HAI`, `RSA`). Matching usa `abbreviation` (3 letras), **nunca** `displayName` (que diverge em `Czechia`/`Türkiye`/`Congo DR`/`United States`). TASK-01 simplifica: `resolveTeamByCode(abbr)` = lookup direto `code === abbr`; mapa de aliases fica `{}` (ponto de extensão preservado contra mudança futura da ESPN).

2. **Matching em mata-mata**: Quando openfootball ainda tem placeholder (`"2A"`, `"W74"`), o time real já foi resolvido pela ESPN. O matcher deve ignorar esses jogos? (proposta: sim — matchId com placeholder não tem time real para casar; ignorar evento ESPN até openfootball resolver o placeholder). **Confirmado pela TASK-00:** ESPN também emite placeholders como `abbreviation` (`1A`–`1L`, `2A`–`2L`, `3RD`, `RD16 W1`–`RD16 W8`, `RD32`) em mata-mata não resolvido — o matcher rejeita naturalmente (regex de placeholder não bate código de 3 letras válido no registry).

3. ~~**Score `live` com valores ESPN**~~ ✅ **RESOLVIDO.** `competitors[].score` é **STRING sempre** (`"1"`, `"0"`) — confirmado em `post` (FT) e `in` (parcial ao vivo). TASK-02 usa `z.coerce.number().int().min(0)`. Nunca assumir number nativo.

4. **`status` ESPN para jogos com prorrogação**: ESPN usa `in` para ET? Qual o `status.type.detail` (ex.: `"ET"`, `"120'"`)? O mapper deve mapear para `"live"` de qualquer forma — não há `"extra_time"` no matchSchema. **Encaminhado pela TASK-00:** mapear status **só por `state`** (`pre`→scheduled, `in`→live, `post`→finished); `detail` é texto livre/localizado (ex.: `"31'"`, `"Sun, June 14th at 1:00 PM EDT"`) — display-only, nunca fonte de status. ET/pênaltis permanecem `in`/`post` → mapeiam live/finished sem caso especial.

5. ~~**Janela do scoreboard ESPN**~~ ✅ **RESOLVIDO.** Sem `?dates` a janela **cobre apenas 1 dia** (não é confiável). `?dates=YYYYMMDD` é **OBRIGATÓRIO**; intervalo `?dates=YYYYMMDD-YYYYMMDD` funciona (100 eventos retornados em `20260611-20260715`). TASK-03 chama com `?dates=YYYYMMDD` do dia atual (UTC). Formato `event.date`: ISO 8601 com `Z` sem segundos (`"2026-06-14T04:00Z"`) — `new Date()` é seguro.

6. **Revalidate do Route Handler vs cache ESPN**: Com `jogoAoVivo: 60s` no Route Handler mas ESPN cacheada em 300s, o dado live na tela tem até 5min de atraso. Isso é aceitável pelo usuário? (confirmado pelo argumento `"para não ficar chamando toda hora"`).

---

## 7. Recommended implementation concerns

1. **Adicionar índice reverso ao teamRegistry** antes de tudo: `buildCodeIndex(): Map<string, TeamEntry>` para lookup `abbreviation → entry.id`. Criar também mapa de aliases ESPN→code para divergências conhecidas.

2. **Zod schema ESPN pode ser `z.object(...).passthrough()`** (não strict) — queremos apenas os campos que consumimos e ignorar o resto silenciosamente. Isso evita breaking change se ESPN adicionar campos.

3. **`getEffectiveMatches()` deve capturar qualquer exceção da ESPN com `try/catch`** e logar (não lançar). O padrão já existe no Firestore read (`console.error + return base`).

4. **Ordem de merge no `getEffectiveMatches()`**:
   ```
   base openfootball → patch ESPN (se não isManualOverride) → override manual (se isManualOverride)
   ```
   O manual override atual substitui o doc inteiro. ESPN aplica apenas campos `{ status, homeScore, awayScore }` — não substitui `kickoffAt`, `venue`, `stage`, etc.

5. **Testar o matching contra o JSON real da ESPN antes de implementar** — confirmar os 48 `abbreviation` vs `code` do teamRegistry. É o risco mais alto da feature.

6. **Sem mudança no schema `matchSchema`** nesta fase — `"live"` + placares parciais já são válidos. Pênaltis (`penaltyHomeScore`/`penaltyAwayScore`) ficam para PRD separado (requerem extensão do schema `.strict()`).

7. **Frontend**: verificar se cards da Home e lista de Matches tratam `status === "live"` — pode precisar de badges de "AO VIVO" e placares parciais visíveis. Avaliar durante implementação.
