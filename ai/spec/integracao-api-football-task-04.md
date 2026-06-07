# SPEC — TASK-04 · Route Handlers de proxy + cache + validação da API-Football

> Plano: `ai/plan/integracao-api-football.md` (TASK-04, A1, A5)
> Consome (não altera): `@/server/apiFootball`, `@/server/mappers`, `@/server/cache/tiers`, `@/schemas`, `@/types/matches`.

## 1. Objetivo

Expor endpoints server-side Next.js (App Router Route Handlers) que fazem **proxy + cache + validação** da API-Football. O browser nunca chama a API-Football diretamente; consome só `/api/*`. A chave (`API_FOOTBALL_KEY`) permanece exclusivamente no servidor.

Cada handler:
1. obtém o client via `getApiFootballClient()` (barrel `@/server/apiFootball`);
2. busca dados (`getTeamsByTournament` / `getFixtures`) com `COPA_2026_CONFIG.leagueId` / `season`;
3. mapeia (mappers puros já existentes);
4. valida cada item de saída com o schema do front (`matchSchema` / `teamSchema`) via `.parse`;
5. responde `NextResponse.json(...)` com o tier de `revalidate` adequado.

## 2. Rotas e shape de resposta

| Método/Rota | Descrição | Resposta (sucesso 200) | `revalidate` |
|---|---|---|---|
| `GET /api/matches` | Todas as partidas mapeadas | `MatchWithId[]` | `REVALIDATE.jogoAoVivo` (60s) |
| `GET /api/matches/[id]` | Uma partida pelo id (= `String(fixture.id)`) | `MatchWithId` ou 404 | `REVALIDATE.jogoAoVivo` (60s) |
| `GET /api/teams` | Todas as seleções | `TeamWithId[]` | `REVALIDATE.selecoes` (24h) |
| `GET /api/standings` | Grupos derivados das seleções (A1) | `StandingsResponse` | `REVALIDATE.grupos` (24h) |

### Shapes

- **`MatchWithId`** (`src/types/matches.ts`): `Match & { id: string }`, onde `id = String(fixture.id)`. O `id` vem do `fixture.id` da API porque matches NÃO são persistidos no Firestore (decisão do pivô PRD-07).
- **`TeamWithId`**: `Team & { id: string }`, onde `id = String(team.id)`. teams também não são persistidos → o doc id = id da API.
- **`StandingsResponse`** (A1):
  ```ts
  {
    groups: Array<{
      groupId: string;           // ex.: "A"
      teams: TeamWithId[];       // seleções daquele grupo
    }>;
    ungrouped: TeamWithId[];     // seleções sem grupo (mata-mata / TBD)
  }
  ```
  Grupos ordenados por `groupId` (asc); seleções ordenadas por `name`.

### Erro (qualquer rota)

`{ error: string }` em português, sem vazar segredos, com status conforme §4.

## 3. teamIdMap / teamGroupMap (A1, regra 2)

Como teams **não são persistidos**, o id do doc = `String(team.id)` da API. Em `/api/matches` (e `/api/matches/[id]`) é preciso resolver `homeTeamId`/`awayTeamId`/`groupId` dos fixtures. Para isso o handler de matches **também busca teams** e monta, a partir da resposta:

```ts
teamIdMap    = { [t.team.id]: String(t.team.id) }       // API id → doc id (string)
teamGroupMap = { [t.team.id]: t.group }                 // API id → grupo (A1)
```

Esses mapas são passados a `mapApiFixtureToFirestore(raw, teamIdMap, teamGroupMap)`. O `groupId` do match é derivado pelo mapper (grupo do mandante, só na fase de grupos) — A1.

`/api/standings` deriva os grupos a partir do mesmo `t.group` exposto na resposta de teams (A1: standings derivado de teams, sem endpoint extra da API).

`MOCK_TEAM_GROUP_MAP` (do mock) é reaproveitado **apenas nos testes** quando útil; o código de produção monta os mapas a partir da resposta real do client.

## 4. Mapeamento de erros do client → HTTP

| Erro | Status | Mensagem (pt, sem segredo) |
|---|---|---|
| `ApiFootballQuotaError` | 503 | "Cota da API de dados esgotada. Tente novamente mais tarde." |
| `ApiFootballAuthError` | 502 | "Falha na integração com a API de dados." |
| `ApiFootballTimeoutError` | 504 | "A API de dados demorou para responder. Tente novamente." |
| `ZodError` (parse de saída) | 500 | "Dados recebidos fora do contrato esperado." (dado da API violou o schema do front) |
| genérico (`Error`, rede etc.) | 500 | "Erro inesperado ao obter os dados." |

A mensagem do `ApiFootballAuthError` **não** repassa o texto interno do erro (que cita `API_FOOTBALL_KEY`) — usa mensagem genérica para não vazar detalhe de configuração ao client. Os demais erros também usam texto fixo; o detalhe real fica só em log de servidor (não obrigatório nesta task).

O tratamento é centralizado em um helper `apiFootballErrorResponse(err)` reutilizado pelas 4 rotas.

## 5. Decisão de cache (A5) e cota

- Números importados de `@/server/cache/tiers` (`REVALIDATE`) — **sem hardcode**.
- **teams, standings → 24h** (`REVALIDATE.selecoes` / `REVALIDATE.grupos`): composição de grupos e seleções é estática durante a Copa.
- **matches e matches/[id] → 60s** (`REVALIDATE.jogoAoVivo`) como base única, porque:
  1. é **um único endpoint** da API (`/fixtures?league&season`) que retorna todas as partidas — não há chamada por jogo;
  2. revalidação é **on-demand / baixo tráfego** (<100 usuários) → mesmo com `revalidate: 60`, o número real de chamadas à API é o de janelas de 60s em que **alguém** acessa, não 1/min constante;
  3. a granularidade fina por status (futuro 6h, dia 30min, ao vivo 1min, encerrado 5min) é aplicada **no client** via React Query `staleTime` por tier (`STALE_TIME` / `revalidateForMatch`, TASK-06). O servidor mantém o teto mais fresco (60s) e o client decide quando vale revalidar de fato.

**Tradeoff / risco de cota:** usar o tier mais curto (60s) no servidor para TODAS as partidas significa que, em janelas de pico (vários acessos espalhados ao longo do dia, fora de jogo ao vivo), pode haver revalidações mais frequentes do que o estritamente necessário para partidas futuras/encerradas. Mitigação: tráfego baixíssimo + cache compartilhado por todos os usuários (uma revalidação serve todos) + a segmentação fina no client reduz requisições do browser. Caso a cota aperte, alternativas: (a) subir a base para `REVALIDATE.jogoDia` (30min) e deixar só o "ao vivo" mais fresco via revalidação on-demand; (b) split em endpoint por status. Por ora 60s é o escolhido por simplicidade e por ser o único ponto único de busca.

Não usar `cookies()` / `headers()` nos handlers (manteria a rota dinâmica e não cacheável). Apenas `export const revalidate` por rota.

## 6. Segurança

- `API_FOOTBALL_KEY` lida só em `@/server/apiFootball` (server-only) — handlers nunca a tocam.
- Mensagens de erro genéricas (§4), sem ecoar `API_FOOTBALL_KEY` nem stack.
- Sem `cookies()`/`headers()` → rotas cacheáveis e sem dado por-usuário.

## 7. Casos de teste (vitest, `src/app/api/**/__tests__`)

Mock de `@/server/apiFootball` via `vi.mock` (evita o `import "server-only"` do barrel sob vitest) + `vi.mock` dos mappers? Não — mappers são puros e seguros sob vitest; mockamos só o barrel `@/server/apiFootball` (factory `getApiFootballClient`) para controlar os dados. Mappers/tiers/schemas reais rodam de verdade (teste de integração leve).

Por rota:

- **/api/matches**
  - sucesso: client retorna `MOCK_FIXTURES` + `MOCK_TEAMS` → 200, array de `MatchWithId` com `id = String(fixture.id)`, `groupId` derivado nos jogos de grupo.
  - quota: `getFixtures`/`getTeamsByTournament` lança `ApiFootballQuotaError` → 503.
  - auth: lança `ApiFootballAuthError` → 502.
- **/api/matches/[id]**
  - sucesso: id existente → 200, `MatchWithId` único.
  - 404: id inexistente → 404.
  - quota → 503.
- **/api/teams**
  - sucesso → 200, array de `TeamWithId` com `id = String(team.id)`.
  - auth → 502.
- **/api/standings**
  - sucesso → 200, `groups` agrupados por grupo (A1), ordenados; seleções de mata-mata em `ungrouped` (se houver).
  - quota → 503.

## 8. Achados / desvios

- O client expõe `getTeamsByTournament(tournamentId, season)` e `getFixtures(tournamentId, season)` — assinaturas usadas diretamente com `COPA_2026_CONFIG`.
- `COPA_2026_CONFIG.leagueId/season` são placeholders (config.ts) — não bloqueia a task; em ausência de credenciais o factory cai no mock.
- `TeamWithId` não existia em `src/types`; criado inline o tipo de resposta (sem novo arquivo em `src/types`, para não tocar fora do escopo) reaproveitando `z.infer<typeof teamSchema>` no helper `_lib/apiFootballData.ts`.
- **DRIFT / RISCO (descoberto na implementação):** `MOCK_FIXTURES` em `src/server/apiFootball/mock.ts` usa `fixture.date` no formato `"...T15:00:00+00:00"` (offset numérico), mas `matchSchema.kickoffAt = z.iso.datetime()` **só aceita sufixo `Z`** e rejeita offsets numéricos. Logo `/api/matches` falharia (ZodError → 500) com os dados de mock atuais — e potencialmente com dados reais da API-Football, que retornam datas com `+00:00`. Correção fica FORA do escopo desta task (mexe em `mock.ts`/`schemas`, proibidos). Mitigação imediata: os testes usam `_lib/__tests__/validFixtures.ts`, que normaliza as datas para `Z`. **Ação recomendada para TASK-02/03:** ou ampliar `isoDateTime` para `z.iso.datetime({ offset: true })`, ou normalizar a data no `matchMapper` antes do `parse`. Sem isso, a rota quebra com dados reais.

## 9. Arquivos entregues

- `src/app/api/matches/route.ts`
- `src/app/api/matches/[id]/route.ts`
- `src/app/api/teams/route.ts`
- `src/app/api/standings/route.ts`
- `src/app/api/_lib/apiFootballError.ts` (mapeamento de erros compartilhado)
- `src/app/api/_lib/apiFootballData.ts` (busca+mapeamento+validação compartilhados; `TeamWithId`)
- Testes: `__tests__/route.test.ts` em cada rota + `src/app/api/_lib/__tests__/validFixtures.ts` (fixtures schema-válidas)
