# Análise a fundo da API ESPN — scoreboard `fifa.world`

> Diagnóstico para o bug "Brasil aparece na chave errada" + base para remover openfootball.
> Endpoint: `GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=YYYYMMDD-YYYYMMDD`
> Coleta real: 2026-06-30, range `20260628-20260719` (32 eventos mata-mata).

## 1. Estrutura de topo

```
{ leagues:[{ id, season:{ year, type, slug, type:{id,type,name} } }], events:[…], provider }
```

- `events[]` — 1 por jogo. Mata-mata = 32 eventos.
- Cada evento: `id, uid, date, name, shortName, season:{year,type,slug}, competitions:[…], status, venue, links`.

### Rounds (season.type → slug)

| season.type | slug | nº jogos |
|---|---|---|
| 13801 | round-of-32 | 16 |
| 13800 | round-of-16 | 8 |
| 13799 | quarterfinals | 4 |
| 13798 | semifinals | 2 |
| 13797 | 3rd-place-match | 1 |
| 13803 | final | 1 |

## 2. ⭐ Linkagem da chave (o que faltava)

A ESPN materializa **slots de bracket** como "times placeholder" com `isActive:false` e id sintético. O `displayName` diz o slot exato:

| Fase do slot | displayName | shortName/abbrev | id sintético |
|---|---|---|---|
| Vencedor R32 jogo N | `Round of 32 N Winner` | `RD32 W{N}` | `131524 + N` |
| Vencedor R16 jogo N | `Round of 16 N Winner` | `RD16 W{N}` | `19281 + N` (W1=19282) |
| Vencedor QF jogo N | `Quarterfinal N Winner` | `QFW{N}` | sintético |
| Vencedor SF jogo N | `Semifinal N Winner` | `SFW{N}` | sintético |
| Perdedor SF jogo N | `Semifinal N Loser` | `SF L{N}` | sintético |

Quando o jogo-fonte termina, a ESPN **substitui** o placeholder pelo time real (`isActive:true`, id/abbrev/bandeira reais). Por isso Brasil já aparece resolvido na oitava certa (evento 760504 `RD32 @ BRA`).

### Pareamento real é CRUZADO (não sequencial)

Dos shortNames das fases tardias:
- QF1 = `RD16 W1` vs `W2` · QF2 = `W5` vs `W6` · QF3 = `W3` vs `W4` · QF4 = `W7` vs `W8`
- SF1 = `QFW1` vs `QFW2` · SF2 = `QFW3` vs `QFW4`
- Final = `SFW1` vs `SFW2` · 3º = `SF L1` vs `SF L2`

→ Confirma: **ordenar por data/id e parear vizinhos `[2k],[2k+1]` está errado**. É a causa-raiz do "Brasil na chave errada".

### Nuance da numeração R32

O `displayName` dá o nº do jogo-fonte (`Round of 32 3 Winner`), mas o **número próprio** de cada evento R32 (1–16) NÃO é campo simples no scoreboard, e **não** corresponde a ordem de data/id/array (testado e refutado: Paraguai resolvido no evento 760503 contradiz "RD32 W3" por ordem). A numeração é a oficial FIFA. Para conectores 100% antes dos jogos, precisaria do **core API** (`sports.core.api.espn.com`) ou âncora por time resolvido. **Não é necessário** se renderizarmos cada card com os lados que a ESPN já entrega (ver §5).

## 3. Campos ricos hoje IGNORADOS

Por `competitions[0]`:
- `competitors[].advance` (bool) — **quem avançou** (autoritativo).
- `competitors[].winner` (bool).
- `competitors[].shootoutScore` (int) — **pênaltis** (ex.: GER 1(p3) × PAR 1(p4)). Hoje não modelamos → empate de mata-mata fica sem desempate.
- `competitions[].notes[].headline` — ex.: `"Paraguay advance 4-3 on penalties"`.
- `status.type.name` — `STATUS_SCHEDULED|FULL_TIME|FINAL_PEN|OVERTIME|FIRST_HALF…` + `state` (pre/in/post) + `clock`/`displayClock`/`period`.
- `competitors[].form` ("WLWDD"), `leaders`, `statistics[]` (posse, chutes, etc.).
- `competitions[].details[]` — gols/cartões com `athletesInvolved` (play-by-play).
- `venue{fullName,address}`, `attendance`, `broadcasts[]`.

## 4. O que a ESPN NÃO dá

- Linkagem por `$ref` no scoreboard (só no core API).
- Número próprio de jogo R32 como campo plano (ver §2 nuance).

## 5. Implicação para o fix do bracket

Cada evento já traz os **dois lados corretos** (resolvido OU placeholder `RD32 W3`). Logo:
- Renderizar cada card com os lados reais da ESPN → Brasil cai no card certo (a ESPN já o coloca lá).
- Bug atual = ignoramos o agrupamento da ESPN e pareamos por índice de data. Remover o pareamento posicional/conectores inventados resolve.
- Conectores de árvore "de verdade" (linhas pai→filho) exigem ingerir a numeração de slot (`RD32 W{N}` + core API ou âncora por time). Opcional, fase 2.

## 6. Openfootball — ainda usado

- `fetchAllMatches()` (openfootball cru via `HttpCopaDataClient(COPA_DATA_URL)`) ainda chamado em:
  - `src/app/api/predictions/score/route.ts:169` (pontuação)
  - `src/server/admin/dashboardStats.ts:67` (dashboard admin)
- `fetchAllTeams()` NÃO é openfootball — é `TEAM_REGISTRY` estático.
- Bracket / `/api/matches` / palpites já usam `getEffectiveMatches()` (ESPN).
- Remover openfootball = migrar esses 2 callers p/ `getEffectiveMatches`, depois apagar `client.ts`, `mapper.ts`, `COPA_DATA_URL`, `fetchAllMatches`.
