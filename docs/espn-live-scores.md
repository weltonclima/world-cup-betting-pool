# PRD — Integração ESPN API (placares ao vivo da Copa)

> Status: Draft · Data: 2026-06-14 · Autor: Welton Lima
> Fonte avaliada: `pseudo-r/Public-ESPN-API` (documentação reverse-engineered da API pública não-oficial da ESPN)
> Relacionado: [openfootball-data-flow.md](./openfootball-data-flow.md), PRD-11 (override manual), [architecture-copa-data]

---

## 1. Feature summary

Avaliar e integrar a **API pública da ESPN** como fonte de **placar AO VIVO** (em andamento, minuto-a-minuto) das partidas da Copa 2026, substituindo/complementando o openfootball — que hoje é a única fonte e **não fornece estado “live”** nem atualização em tempo real.

O objetivo é fechar a lacuna que obriga o super_admin a digitar resultados manualmente (`isManualOverride`) porque o openfootball publica `score.ft` com horas de atraso (via commit no GitHub). Com a ESPN, o app passa a refletir gol-a-gol, status “1º tempo / intervalo / 2º tempo / pênaltis / encerrado”, e o ranking recalcula automaticamente ao FT real.

---

## 2. Verificação empírica — a API TEM os placares? **SIM (confirmado)**

Testes reais executados em 2026-06-14 contra `site.api.espn.com`.

### 2.1 Endpoint

```
GET https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard
```

- `{league}` da Copa do Mundo masculina = **`fifa.world`** (feminina = `fifa.wwc`)
- Filtro por data: `?dates=YYYYMMDD` ou intervalo `?dates=YYYYMMDD-YYYYMMDD`
- Sem `dates` → retorna a janela atual (jogos recentes/ao vivo/próximos)
- CDN otimizada p/ tempo real: `https://cdn.espn.com/core/soccer/scoreboard?xhr=1&league=fifa.world`

### 2.2 Provas coletadas

**Copa 2026 — season ATIVA na API** (`season.year: 2026`), jogos reais retornados:

| Data (UTC) | Estado | Detalhe | Placar |
|---|---|---|---|
| 2026-06-13 19:00 | post | FT | QAT 1 x 1 SUI |
| 2026-06-13 22:00 | post | FT | BRA 1 x 1 MAR |
| 2026-06-14 01:00 | post | FT | HAI 0 x 1 SCO |

**Copa 2022 — base completa de 64 jogos**, com placar, vencedor e pênaltis:

| Jogo | Estado | Placar | Vencedor |
|---|---|---|---|
| QAT x ECU | FT | 0 x 2 | ECU |
| ARG x KSA | FT | 1 x 2 | KSA |
| FRA x AUS | FT | 4 x 1 | FRA |
| **Final** ARG x FRA | **FT-Pens** | **3 x 3 (4–2 pen)** | **ARG** ✅ |

→ **Confirmado**: placar regular, placar de pênaltis (`shootoutScore`), flag de vencedor (`winner`) e estado da partida vêm corretos.

### 2.3 Campos disponíveis por partida (`events[].competitions[0]`)

| Campo | Conteúdo | Ganho vs openfootball |
|---|---|---|
| `status.type.state` | `pre` / `in` / `post` | **NET-NEW: estado “live” real** |
| `status.type.detail` | `"FT"`, `"FT-Pens"`, `"HT"`, `"45'+2'"`, etc. | **NET-NEW: minuto/fase ao vivo** |
| `status.clock` / `displayClock` | relógio do jogo (segundos / "67'") | **NET-NEW** |
| `competitors[].score` | placar atual (atualiza ao vivo) | tempo real (vs commit-lag) |
| `competitors[].shootoutScore` | placar de pênaltis | **NET-NEW (openfootball `p` é ignorado hoje)** |
| `competitors[].winner` | bool vencedor | **NET-NEW** |
| `competitors[].team` | `displayName`, `abbreviation`, `logo`, `color` | **NET-NEW: logos/cores oficiais** |
| `competitors[].statistics` / `form` | stats do time, forma recente | NET-NEW (futuro) |
| `details[]` | play-by-play: gol, cartão, pênalti, minuto, atleta | **NET-NEW: timeline de eventos** |
| `venue.displayName`, `attendance` | estádio, público | paridade |
| `odds[]`, `broadcasts[]` | cotações, transmissão | NET-NEW (opcional) |

---

## 3. Estado atual (confirmado no código)

```
openfootball JSON (GitHub raw, 2026/worldcup.json)
  └─ HttpCopaDataClient.getData()      fetch + cache Next.js 1h (REVALIDATE_MATCHES=3600)
       └─ mapOpenFootballMatch()       → MatchWithId
            └─ getEffectiveMatches()    base ao vivo + overlay de overrides manuais
```

**Limitações estruturais da fonte atual** (`src/server/copaData/`):

1. **Sem estado “live”** — `mapStatus()` (mapper.ts:135) só retorna `"scheduled"` ou `"finished"`. O schema **já suporta** `"live"` + placar parcial (matches.ts:55-59), mas a fonte nunca o emite. **Infra pronta, fonte é o gargalo.**
2. **Commit-lag** — openfootball atualiza por commit manual no GitHub; placar aparece horas depois do apito. Por isso o admin digita resultados na mão (PRD-11).
3. **Pênaltis ignorados** — `OpenFootballScore.p` existe no tipo mas o mapper só lê `ft[0]/ft[1]` (mapper.ts:181-182). Mata-mata decidido nos pênaltis fica sem o placar de pênaltis.
4. **Sem timeline** — nenhum gol-a-gol, cartão ou autor de gol.
5. **Sem logos/cores oficiais** dos times.

---

## 4. O que podemos melhorar com a ESPN

| # | Melhoria | Antes (openfootball) | Depois (ESPN) | Impacto |
|---|---|---|---|---|
| M1 | **Placar ao vivo** | só FT, com atraso | gol-a-gol, estado `in` + relógio | 🔥 Alto — UX central |
| M2 | **Status “live” real** | nunca emitido | `pre`/`in`/`post` + minuto | 🔥 Alto |
| M3 | **Auto-recálculo no FT** | depende de digitação manual | dispara ranking no `post` real | 🔥 Alto — elimina trabalho manual |
| M4 | **Pênaltis** | ignorado | `shootoutScore` mapeado | Médio — mata-mata correto |
| M5 | **Timeline de eventos** | inexistente | gols/cartões/autor via `details[]` | Médio — feature nova (MatchDetail) |
| M6 | **Logos/cores oficiais** | registry estático manual | `team.logo`/`color` da ESPN | Baixo — polimento visual |
| M7 | **Reduz override manual** | admin digita placares | só correção excepcional | Alto — menos operação |

---

## 5. Decisão de arquitetura proposta

**Estratégia: ESPN como fonte primária de placar/estado, openfootball como fonte de estrutura (fixtures/grupos/mata-mata), override manual continua vencendo tudo.**

Razão: o openfootball tem a **estrutura canônica** já mapeada (matchIds estáveis `m73`, slugs de grupo, placeholders `2A`/`W74`, fases). A ESPN tem o **estado dinâmico** (placar/live). Casar os dois preserva os matchIds existentes (não quebra predictions/ranking).

```
┌─ openfootball ──┐   estrutura: fixtures, grupos, mata-mata, matchId estável
│                 │
├─ ESPN scoreboard┤   dinâmica: score, state(live), clock, pênaltis, timeline
│                 │      └─ matching ESPN event ↔ matchId (por data + par de times)
└─ override manual┘   isManualOverride === true → vence TODOS (mantém PRD-11)
        │
        ▼
  getEffectiveMatches()  → MatchWithId[]  (consumido por ranking/home/predictions)
```

### Camadas de cache (revalidate diferenciado por estado)

- Jogos `pre`/`post` (sem live): `REVALIDATE_MATCHES = 3600` (1h) — barato.
- Jogos `in` (ao vivo): **polling curto 30–60s** no client (React Query `refetchInterval`) + revalidate server 30s. Só durante a janela ao vivo.
- Novo Route Handler: `GET /api/matches/live` (ou enriquecer `/api/matches`).

### Resiliência (não-regressão)

- ESPN indisponível/timeout → **degrada para openfootball** (igual hoje). Nunca quebra ranking.
- Abstração espelha `CopaDataClient`: novo `EspnScoreClient` com `CopaDataTimeoutError`/`FetchError`/`ParseError`.
- Matching ESPN↔matchId falho (time não casado) → ignora o evento ESPN, mantém base openfootball.

---

## 6. Escopo

### 6.1 In scope
- Cliente HTTP ESPN (`src/server/copaData/espnClient.ts`) com timeout/erros tipados + validação Zod do shape.
- Mapeador ESPN event → patch `{ status, homeScore, awayScore, penaltyHome?, penaltyAway? }`.
- **Matching ESPN event ↔ matchId openfootball** por (data, abreviação/nome dos 2 times) usando `teamRegistry`.
- Merge na `getEffectiveMatches()`: openfootball (estrutura) + ESPN (dinâmica) + override manual (top).
- Suporte a status `"live"` no read path + placar parcial.
- Mapeamento de `shootoutScore` (pênaltis).
- Route Handler de live + `refetchInterval` no React Query só p/ jogos `in`.
- Fallback openfootball em qualquer falha ESPN.
- Testes: client (mock fetch), mapper, matching, merge, fallback.

### 6.2 Out of scope (fases futuras)
- Timeline de eventos (`details[]`) na tela de detalhe — **M5**, PRD separado.
- Stats de time/jogador, odds, broadcasts.
- Webhooks/push de gol (só polling nesta fase).
- Copa feminina (`fifa.wwc`).

---

## 7. Tarefas candidatas (para `/plan`)

| ID | Tipo | Descrição | SP | Risco |
|---|---|---|---|---|
| TASK-01 | integration | `EspnScoreClient` (fetch/timeout/erros/validação shape) | 3 | médio |
| TASK-02 | domain | Schema/tipos do scoreboard ESPN (Zod) + parsing seguro | 2 | baixo |
| TASK-03 | application | Matching ESPN event ↔ matchId (data + times via teamRegistry) | 5 | **alto** |
| TASK-04 | application | Mapper ESPN → patch de placar/status/pênaltis | 3 | médio |
| TASK-05 | persistence | Merge em `getEffectiveMatches` (estrutura+dinâmica+override) | 3 | alto |
| TASK-06 | api | Route Handler live + revalidate diferenciado | 2 | baixo |
| TASK-07 | application | React Query `refetchInterval` condicional (só `in`) | 2 | baixo |
| TASK-08 | application | Auto-recálculo de ranking ao transitar p/ `post` | 3 | médio |

---

## 8. Riscos & mitigação

| Risco | Sev | Mitigação |
|---|---|---|
| API **não-oficial** ESPN pode mudar/quebrar sem aviso | Alto | Validação Zod estrita + fallback openfootball + alerta em log |
| **Matching** ESPN↔matchId errado (nomes/abreviações divergentes) | Alto | Tabela de aliases no `teamRegistry`; teste por par; ignora evento não-casado (nunca corrompe) |
| Termos de uso ESPN / uso comercial em pool de apostas | Médio | Revisar licença antes de produção; é zona cinza — decisão de negócio |
| Rate-limit em polling ao vivo | Médio | Polling só p/ jogos `in`, 30–60s; cache server compartilhado |
| Fuso/data: evento ESPN em UTC vs kickoff openfootball com offset | Médio | Casar por janela de data ±1 dia + par de times, não timestamp exato |
| Divergência ESPN vs openfootball vs manual | Médio | Precedência clara: manual > ESPN > openfootball |

---

## 9. Open questions

1. **Precedência ESPN vs openfootball quando ambos têm FT divergente** — ESPN ganha por ser mais confiável? (proposta: sim, ESPN > openfootball; manual > ambos).
2. **Granularidade do polling ao vivo** — 30s aceitável p/ custo App Hosting? Ou só refresh manual + 60s?
3. **Timeline (M5)** entra nesta fase ou PRD separado? (proposta: separado).
4. **Licença ESPN** — ok p/ uso não-comercial entre amigos? Bloqueia se monetizar?
5. **Janela de matching** — par de times é único por dia na Copa? (sim na fase de grupos; validar no mata-mata com placeholders já resolvidos).

---

## 10. Métricas de sucesso

- Placar na Home/Matches atualiza ≤ 60s do gol real (vs horas hoje).
- Status “live” visível durante 100% das partidas em andamento.
- Override manual cai a ~0 (só correção de erro de fonte).
- Zero regressão: ESPN fora do ar → comportamento idêntico ao atual.

---

## Achados Empíricos TASK-00 (2026-06-14)

> Spike de validação contra `site.api.espn.com` (liga `fifa.world`, season 2026 ATIVA).
> Coletados: janela default, `?dates=20260613`, `?dates=20260614`, intervalo `?dates=20260611-20260715` (100 eventos).
> **Resolve gaps #1, #3, #5 do PRD. Destrava TASK-01, TASK-02, TASK-03.**

### A. Janela do scoreboard sem `?dates`
- **Cobre apenas 1 dia** (retornou `day.date = "2026-06-13"`, 3 eventos).
- **Conclusão: `?dates` é OBRIGATÓRIO** para mirar um dia específico. Intervalo `?dates=YYYYMMDD-YYYYMMDD` funciona (retornou 100 eventos em `20260611-20260715`).
- **Decisão TASK-03:** chamar com `?dates=YYYYMMDD` do dia atual (UTC). A janela default não é confiável para cobrir os jogos do dia desejado.

### B. Tipo do campo `score`
- **Tipo: STRING sempre** — ex.: `"score": "1"`, `"score": "0"`.
- Confirmado em estados `post` (FT) e `in` (ao vivo, placar parcial).
- **Decisão TASK-02:** `z.coerce.number().int().min(0)` (ou `z.string().transform(Number)` com validação). Nunca assumir number nativo.

### C. Valores de `status.type`
Campo `competitions[0].status.type`:

| state | detail (exemplos reais) | description | completed |
|---|---|---|---|
| `pre` | `"Sun, June 14th at 1:00 PM EDT"` (texto livre — data/hora) | scheduled | false |
| `in` | `"31'"` (minuto do relógio) | In Progress | false |
| `post` | `"FT"` | Full Time | true |

- Extras úteis no estado `in`: `status.displayClock` (`"31'"`), `status.period` (`1` = 1º tempo).
- **Decisão TASK-04:** mapear por `state` (`pre`→scheduled, `in`→live, `post`→finished). NÃO parsear `detail` para status — é texto livre/localizado. `detail` serve só para exibição futura.
- Distribuição no intervalo coletado: `{ post: 7, in: 1, pre: 92 }`.

### D. Tabela de aliases ESPN → registry code
**Cruzamento dos 48 times reais: `team.abbreviation` ESPN × `code` do `TEAM_REGISTRY`.**

> 🎯 **RESULTADO: TODOS OS 48 BATEM EXATAMENTE. ZERO ALIASES NECESSÁRIOS.**
>
> Inclui os codes de atenção não-ISO do registry — todos coincidem com a ESPN:
> `SUI`, `GER`, `NED`, `ALG`, `POR`, `PAR`, `URU`, `KSA`, `HAI`, `RSA`, `SCO`, `ENG`, `BIH`, `CRO`, `COD`, `CPV`, `CUW`, `CIV`, `CZE`, `TUR`.

- ESPN abbrs reais: 48 · Registry codes: 48 · divergências: **0** · não cobertos: **0**.
- Nota: ESPN usa `displayName` diferente em alguns (`Czechia`, `Türkiye`, `Congo DR`, `United States`) mas a **`abbreviation` bate** (`CZE`, `TUR`, `COD`, `USA`). O matching deve usar `abbreviation`, **nunca** `displayName`.

**Placeholders de mata-mata (ESPN, a IGNORAR no matcher):** `1A`–`1L`, `2A`–`2L`, `3RD`, `RD16 W1`–`RD16 W8`, `RD32`. Aparecem como `abbreviation` em jogos de mata-mata ainda não resolvidos. O matcher (TASK-05) deve rejeitar eventos cujo `abbreviation` não esteja no registry (regex de placeholder não bate código de 3 letras válido).

### E. Conclusões para implementação
- **`?dates`:** obrigatório. TASK-03 usa `?dates=YYYYMMDD` (dia atual UTC).
- **Aliases:** **NENHUM**. TASK-01 simplifica — `resolveTeamByCode(abbr)` é lookup direto `code === abbr` no registry. Mapa de aliases pode ser `{}` (vazio, mas manter o ponto de extensão por segurança contra mudança futura da ESPN).
- **Score type:** string → coerção numérica em TASK-02.
- **Status:** mapear só por `state`; `detail` é display-only/localizado.
- **Formato `event.date`:** ISO 8601 com `Z`, sem segundos — ex.: `"2026-06-14T04:00Z"`. Parsear com `new Date()` é seguro.
- **Matching key:** `abbreviation` (3 letras), NÃO `displayName`. Placeholders de mata-mata rejeitados naturalmente (não estão no registry).
