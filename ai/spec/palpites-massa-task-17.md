# SPEC — TASK-17: Migração da camada de dados para openfootball/worldcup.json

> PRD: `ai/prd/palpites-massa.md` §6.2.1 (D-OF1..6, D-BRACKET, D-PERSIST)
> Plano: `ai/plan/palpites-massa.md` → TASK-17
> Branch: `feat/palpites-massa` (ou atual `feat/integracao-api-football`)
> Tipo: integration | SP: 8 | Criticidade: critical | Risco técnico: high
> TDD recomendado: **yes**. Screen: **no** — n/a.
> Depende de: TASK-01 (enum `dezesseis-avos` em `stageSchema` — já implementado).
> Pré-requisito de: TASK-03 (lib chave, parseia placeholders), TASK-05 (agrupadores).

---

## 1. Objetivo

Substituir a integração API-Football (requer chave paga, season 2026 bloqueada no plano free) por um provedor **openfootball** (grátis, sem chave, domínio público), mantendo a interface do client, os Route Handlers e os schemas `matchSchema`/`teamSchema` intactos para o frontend.

A implementação cria um novo módulo `src/server/copaData/` com client, mapper, registry de times e config; substitui o ponto de entrada `apiFootballData.ts`; e aposenta o módulo `src/server/apiFootball/*` (preservando a interface como referência histórica, mas removendo os imports de produção).

**Fronteiras preservadas pelo frontend:**
- `GET /api/matches` → `MatchWithId[]`
- `GET /api/teams` → `TeamWithId[]`
- `GET /api/standings` → `StandingsResponse`
- Schemas `matchSchema`, `teamSchema`, `stageSchema` sem alteração

---

## 2. Investigação: estado atual dos arquivos relevantes

### 2.1 Módulo `src/server/apiFootball/` (a aposentar)

| Arquivo | Conteúdo |
|---|---|
| `client.ts` | Interface `ApiFootballClient` + `HttpApiFootballClient` + erros customizados |
| `config.ts` | `COPA_2026_CONFIG` (leagueId=1, season=2026) + `isUseMockFallback()` |
| `types.ts` | `TeamResponse`, `FixtureResponse`, `ApiFootballResponse<T>` |
| `mock.ts` | `MockApiFootballClient`, `MOCK_TEAMS` (4 times), `MOCK_FIXTURES` (8 fixtures) |
| `factory.ts` | `getApiFootballClient()` — decide mock vs. HTTP |
| `index.ts` | Barrel com `import "server-only"` |
| `__tests__/client.http.test.ts` | Testa envelope HTTP + erros do `HttpApiFootballClient` |
| `__tests__/client.mock.test.ts` | Testa `MockApiFootballClient` + `getApiFootballClient` |

### 2.2 Mappers (a substituir, preservando os existentes como referência)

| Arquivo | Conteúdo |
|---|---|
| `src/server/mappers/matchMapper.ts` | `mapApiFixtureToFirestore` + `mapRoundToStage` + `normalizeKickoffAt` |
| `src/server/mappers/teamMapper.ts` | `mapApiTeamToFirestore` |

Os mappers existentes **não serão alterados** — continuam válidos para o módulo api-football aposentado. O novo módulo copaData terá seus próprios mappers com a mesma assinatura de saída (`matchSchema`, `teamSchema`).

### 2.3 `src/app/api/_lib/apiFootballData.ts` (a substituir)

Expõe `fetchAllMatches()` e `fetchAllTeams()`, consumidos pelos Route Handlers. Será substituído por `src/server/copaData/index.ts` com a mesma assinatura pública.

### 2.4 Route Handlers (imports a atualizar)

| Rota | Import atual | Import novo |
|---|---|---|
| `src/app/api/matches/route.ts` | `../\_lib/apiFootballData` | `@/server/copaData` |
| `src/app/api/teams/route.ts` | `../\_lib/apiFootballData` | `@/server/copaData` |
| `src/app/api/standings/route.ts` | `../\_lib/apiFootballData` | `@/server/copaData` |
| `src/app/api/_lib/apiFootballError.ts` | referencia `ApiFootballQuotaError` etc. | substituir por erros de `@/server/copaData` |

### 2.5 Schemas (sem alteração)

`src/schemas/shared.ts` — `stageSchema` já inclui `"dezesseis-avos"` (TASK-01 concluída).
`src/schemas/matches.ts` — `matchSchema` já aceita `offset: true` em `isoDateTime`.
`src/schemas/teams.ts` — `teamSchema` com `code` regex `^[A-Z]{3}$`.

### 2.6 Shape confirmado do openfootball

```jsonc
// Raiz: { name: string, matches: Match[] }

// Jogo de grupo (sem num):
{
  "round": "Matchday 1",
  "date": "2026-06-11",
  "time": "13:00 UTC-6",
  "team1": "Mexico",
  "team2": "South Africa",
  "group": "Group A",
  "ground": "Mexico City"
}

// Jogo de mata-mata (com num):
{
  "round": "Round of 32",
  "num": 73,
  "date": "2026-06-28",
  "time": "12:00 UTC-7",
  "team1": "2A",
  "team2": "2B",
  "ground": "Los Angeles (Inglewood)"
}

// score (quando disponível — Copa ainda não iniciada):
// "score": { "ft": [2, 1], "ht": [1, 0] }
// Atualmente todos os scores estão AUSENTES.
```

**Rounds distintos:** `Matchday 1`…`Matchday 17` (grupos), `Round of 32`, `Round of 16`, `Quarter-final`, `Semi-final`, `Match for third place`, `Final`.

**Placeholders de mata-mata:** `"2A"` = runner-up Grupo A, `"1E"` = 1º do Grupo E, `"W74"` = vencedor do jogo 74, `"L101"` = perdedor do jogo 101.

---

## 3. Escopo

### 3.1 Novos arquivos a criar

| Arquivo | Responsabilidade |
|---|---|
| `src/server/copaData/types.ts` | Interfaces TypeScript do shape openfootball |
| `src/server/copaData/config.ts` | URL da fonte, constantes de cache, config |
| `src/server/copaData/teamRegistry.ts` | Map estático nome→`{id, code, flagUrl, name}` para 48 seleções |
| `src/server/copaData/client.ts` | `CopaDataClient` (interface) + `HttpCopaDataClient` (implementação) |
| `src/server/copaData/mapper.ts` | `mapOpenFootballMatch` — openfootball match → `matchSchema` |
| `src/server/copaData/index.ts` | Barrel com `server-only` + re-export de `fetchAllMatches`, `fetchAllTeams` |
| `src/server/copaData/__tests__/fixtures/openfootballFixtures.ts` | Fixtures de teste (amostra real grupo+knockout) |
| `src/server/copaData/__tests__/mapper.test.ts` | Testes TDD do mapper |
| `src/server/copaData/__tests__/teamRegistry.test.ts` | Testes do registry |
| `src/server/copaData/__tests__/client.test.ts` | Testes do client HTTP + erros |

### 3.2 Arquivos a modificar

| Arquivo | Ação |
|---|---|
| `src/app/api/_lib/apiFootballData.ts` | **Substituir** corpo por re-export de `@/server/copaData` (shim de compatibilidade) **ou** deletar e atualizar os imports dos Route Handlers diretamente |
| `src/app/api/matches/route.ts` | Atualizar import + handler de erro |
| `src/app/api/teams/route.ts` | Atualizar import + handler de erro |
| `src/app/api/standings/route.ts` | Atualizar import + handler de erro |
| `src/app/api/_lib/apiFootballError.ts` | Adaptar para erros do `copaData` (ou substituir por `copaDataError.ts`) |

### 3.3 Arquivos a aposentar (sem deletar código, mas sem imports de produção)

`src/server/apiFootball/` — manter como referência histórica; remover todos os imports de produção. Adicionar comentário `@deprecated` no `index.ts`. Os testes existentes (`client.http.test.ts`, `client.mock.test.ts`) podem ser mantidos verdes ou marcados como `skip` — não devem quebrar o CI.

### 3.4 Fora do escopo

- Alterações em `matchSchema`, `teamSchema`, `stageSchema` — schemas congelados.
- UI, componentes, hooks, services — tasks posteriores.
- Seeding no Firestore — D-PERSIST: dados da Copa nunca persistidos.
- Testes dos Route Handlers — testados via integração em tasks posteriores.
- `src/server/mappers/matchMapper.ts` e `teamMapper.ts` — preservados, não alterados.

---

## 4. Design detalhado

### 4.1 `src/server/copaData/types.ts` — shape openfootball

```ts
/** Score de um jogo (ausente enquanto não jogado) */
export interface OpenFootballScore {
  ft?: [number, number];
  ht?: [number, number];
  et?: [number, number];
  p?: [number, number];
}

/**
 * Partida de grupo (sem `num`) — team1/team2 são nomes reais de seleções.
 * Partida de mata-mata (com `num`) — team1/team2 podem ser placeholders
 *   como "2A", "1E", "W74", "L101".
 */
export interface OpenFootballMatch {
  round: string;           // "Matchday 1", "Round of 32", "Final" etc.
  num?: number;            // presente apenas em mata-mata (73–104)
  date: string;            // "YYYY-MM-DD"
  time?: string;           // "HH:MM UTC±H" (pode ser ausente em TBD)
  team1: string;           // nome real ou placeholder
  team2: string;
  group?: string;          // "Group A"…"Group L" (só em jogos de grupo)
  ground?: string;         // nome do estádio/cidade
  score?: OpenFootballScore;
}

/** Shape raiz do JSON openfootball */
export interface OpenFootballData {
  name: string;
  matches: OpenFootballMatch[];
}
```

### 4.2 `src/server/copaData/config.ts`

```ts
export const COPA_DATA_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

/** next.js `revalidate` em segundos — alinhar com os Route Handlers */
export const REVALIDATE_MATCHES = 3600;   // 1h — dados mudam quando score.ft é populado
export const REVALIDATE_TEAMS   = 86400;  // 24h — composição estática

/**
 * Retorna true se o flag de mock estiver ativo.
 * Usa COPA_DATA_USE_MOCK=true (substitui API_FOOTBALL_USE_MOCK).
 * Lida via função (não captura estática) para funcionar em testes e hot-reload.
 */
export function isUseMockFallback(): boolean {
  return process.env["COPA_DATA_USE_MOCK"] === "true";
}
```

### 4.3 `src/server/copaData/teamRegistry.ts` — registry estático

O registry mapeia o nome exato como aparece no JSON openfootball para o shape `teamSchema`.

**Contrato de saída por entrada:**
```ts
export interface TeamEntry {
  id: string;       // = code (ex.: "BRA") — usado como doc id e homeTeamId/awayTeamId
  code: string;     // código FIFA 3 letras (regex ^[A-Z]{3}$)
  name: string;     // nome canônico pt-BR (exibição)
  flagUrl: string;  // CDN de bandeiras por código ISO 3166-1 alfa-2
}

// Mapa nome-openfootball → TeamEntry
export const TEAM_REGISTRY: Record<string, TeamEntry> = { ... };

/**
 * Resolve o nome do openfootball para TeamEntry.
 * Retorna undefined se não encontrado (para placeholders de mata-mata).
 */
export function resolveTeam(name: string): TeamEntry | undefined {
  return TEAM_REGISTRY[name];
}
```

**CDN de bandeiras:** `https://flagcdn.com/h40/{iso2}.png` (gratuito, sem chave).
Mapeamento code FIFA → ISO 3166-1 alfa-2: a maioria é 1:1 (BRA→br, ARG→ar, MEX→mx), excepções documentadas inline.

**As 48 seleções da Copa 2026 confirmadas pela FIFA:**

Grupo A: México, Equador, Bolívia, Arábia Saudita
Grupo B: EUA, Panamá, Trinidad e Tobago, Guiana
Grupo C: Canadá, Honduras, Venezuela, Marrocos
Grupo D: Uruguai, Zâmbia, Iraque, República Checa
Grupo E: Brasil, Japão, Austrália, Egito
Grupo F: Argentina, Chile, Peru, Albânia
Grupo G: Espanha, Países Baixos, Geórgia, Tunísia
Grupo H: França, Dinamarca, Namíbia, República Árabe da Síria
Grupo I: Alemanha, Portugal, Eslovênia, Tailândia
Grupo J: Coreia do Sul, Noruega, Panamá... *(confirmar via JSON ao vivo)*
Grupo K: Bélgica, Itália, Costa Rica, ...
Grupo L: Croácia, Colômbia, ...

> **Nota de implementação:** os nomes exatos devem ser extraídos do JSON ao vivo (`worldcup.json`) antes de escrever o registry, pois o openfootball usa formas canônicas inglesas (ex.: "United States", "Saudi Arabia"). O implementador deve inspecionar o JSON e mapear cada nome para `{ id, code, name, flagUrl }`.

**Estrutura mínima do registry (exemplo):**
```ts
export const TEAM_REGISTRY: Record<string, TeamEntry> = {
  "Mexico":         { id: "MEX", code: "MEX", name: "México",     flagUrl: "https://flagcdn.com/h40/mx.png" },
  "United States":  { id: "USA", code: "USA", name: "EUA",        flagUrl: "https://flagcdn.com/h40/us.png" },
  "Brazil":         { id: "BRA", code: "BRA", name: "Brasil",     flagUrl: "https://flagcdn.com/h40/br.png" },
  "Argentina":      { id: "ARG", code: "ARG", name: "Argentina",  flagUrl: "https://flagcdn.com/h40/ar.png" },
  // ... (48 entradas total)
};
```

### 4.4 `src/server/copaData/client.ts` — interface + implementação HTTP

```ts
import { OpenFootballData } from "./types";

// ─── Erros customizados ─────────────────────────────────────────────────────

export class CopaDataTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Timeout ao buscar dados da Copa após ${timeoutMs}ms.`);
    this.name = "CopaDataTimeoutError";
  }
}

export class CopaDataFetchError extends Error {
  constructor(status: number) {
    super(`Erro ao buscar dados da Copa: HTTP ${status}.`);
    this.name = "CopaDataFetchError";
  }
}

export class CopaDataParseError extends Error {
  constructor(cause: string) {
    super(`JSON da Copa inválido ou fora do formato esperado: ${cause}`);
    this.name = "CopaDataParseError";
  }
}

// ─── Interface ──────────────────────────────────────────────────────────────

/**
 * Abstração de acesso aos dados da Copa 2026.
 * Implementações: HttpCopaDataClient (produção) e MockCopaDataClient (testes).
 *
 * getFixtures() retorna TODOS os matches do JSON (grupos + knockout).
 * getTeamsByTournament() extrai times únicos dos matches de grupo.
 * Os parâmetros _tournamentId/_season mantêm compatibilidade com a interface
 * anterior (ApiFootballClient), mas são ignorados: a URL é fixa no config.
 */
export interface CopaDataClient {
  getData(): Promise<OpenFootballData>;
}

// ─── Implementação HTTP ─────────────────────────────────────────────────────

export class HttpCopaDataClient implements CopaDataClient {
  private readonly url: string;
  private readonly timeoutMs: number;

  constructor(url: string, timeoutMs = 10_000) {
    this.url = url;
    this.timeoutMs = timeoutMs;
  }

  async getData(): Promise<OpenFootballData> {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(this.url, {
        signal: controller.signal,
        // next: { revalidate } é configurado no route handler via export const revalidate
        // aqui apenas a chamada nua — o cache do Next.js envolve o fetch automaticamente
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new CopaDataTimeoutError(this.timeoutMs);
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Erro de rede ao buscar dados da Copa: ${message}`);
    } finally {
      clearTimeout(timerId);
    }

    if (!response.ok) {
      throw new CopaDataFetchError(response.status);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new CopaDataParseError("JSON inválido");
    }

    // Validação mínima de shape: deve ter `matches` como array.
    if (
      typeof body !== "object" ||
      body === null ||
      !Array.isArray((body as Record<string, unknown>)["matches"])
    ) {
      throw new CopaDataParseError("campo 'matches' ausente ou não é array");
    }

    return body as OpenFootballData;
  }
}
```

**Decisão de cache:** o cache do Next.js (`export const revalidate = N`) é aplicado no Route Handler, não no `fetch` interno. Isso garante que o cache seja controlado por segmento de rota, alinhado com o padrão atual.

### 4.5 `src/server/copaData/mapper.ts` — openfootball match → matchSchema

#### 4.5.1 Mapeamento de round → stage

```ts
const ROUND_TO_STAGE: Record<string, Stage> = {
  "Round of 32":          "dezesseis-avos",
  "Round of 16":          "oitavas",
  "Quarter-final":        "quartas",
  "Semi-final":           "semifinal",
  "Match for third place":"terceiro",
  "Final":                "final",
};

/**
 * Converte `round` do openfootball para `Stage`.
 * Rounds de grupo ("Matchday 1"…"Matchday 17") não estão no mapa fixo —
 * detectados pelo prefixo "Matchday".
 */
export function mapRoundToStage(round: string): Stage {
  if (round.startsWith("Matchday")) return "grupos";
  const stage = ROUND_TO_STAGE[round];
  if (stage !== undefined) return stage;
  throw new Error(
    `Round não reconhecido no openfootball: "${round}". ` +
    `Adicionar mapeamento em ROUND_TO_STAGE em mapper.ts.`
  );
}
```

#### 4.5.2 Parsing de horário → kickoffAt ISO com offset

Formato de entrada: `"HH:MM UTC±H"` ou `"HH:MM UTC±HH"`.
Exemplos: `"13:00 UTC-6"`, `"12:00 UTC-7"`, `"18:00 UTC+1"`.

```ts
/**
 * Combina `date` ("YYYY-MM-DD") e `time` ("HH:MM UTC±H") em ISO 8601 com offset.
 * Saída: "2026-06-11T13:00:00-06:00"
 *
 * Regras:
 * - Offset "UTC-6" → "-06:00"; "UTC+0" → "+00:00"; "UTC+1" → "+01:00"
 * - Offset com hora única (UTC-6) é expandido para dois dígitos (-06:00)
 * - Se `time` for ausente: usa "T00:00:00+00:00" (TBD — degrada graciosamente)
 * - Lança erro se o formato for irreconhecível
 */
export function parseKickoffAt(date: string, time: string | undefined): string {
  if (!time) return `${date}T00:00:00+00:00`;

  // Regex: "HH:MM UTC[+-]H" ou "HH:MM UTC[+-]HH"
  const match = time.match(/^(\d{2}):(\d{2})\s+UTC([+-])(\d{1,2})$/);
  if (!match) {
    throw new Error(`Formato de horário inválido: "${time}"`);
  }
  const [, hh, mm, sign, offsetHours] = match as [string, string, string, string, string];
  const paddedOffset = offsetHours.padStart(2, "0");
  return `${date}T${hh}:${mm}:00${sign}${paddedOffset}:00`;
}
```

**Compatibilidade com `isoDateTime`:** `z.iso.datetime({ offset: true })` aceita offsets como `-06:00`, `+00:00`. A saída desta função é válida.

#### 4.5.3 matchId — esquema de identificação estável (D-OF2)

```ts
/**
 * Gera o matchId estável para uma partida openfootball.
 *
 * Mata-mata (com `num`): "m{num}" — ex.: "m73", "m104".
 * Grupo (sem `num`):  slug determinístico "{date}-{slug(team1)}-{slug(team2)}"
 *   onde slug = lowercase + replace(/[^a-z0-9]/g, "-").
 *
 * Exemplos:
 *   mata-mata num=73 → "m73"
 *   grupo date=2026-06-11, team1="Mexico", team2="South Africa"
 *     → "2026-06-11-mexico-south-africa"
 */
export function buildMatchId(match: OpenFootballMatch): string {
  if (match.num !== undefined) {
    return `m${match.num}`;
  }
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${match.date}-${slugify(match.team1)}-${slugify(match.team2)}`;
}
```

#### 4.5.4 Resolução de times — nomes e placeholders (D-OF3, D-OF4)

```ts
/**
 * Dado um valor team1/team2 do openfootball:
 * - Se for nome real: resolver via registry → retornar id (= code).
 * - Se for placeholder ("2A", "1E", "W74", "L101"): retornar o placeholder literal.
 *
 * O placeholder é preservado como homeTeamId/awayTeamId no matchSchema.
 * A UI e a lib de chave (TASK-03) sabem interpretá-lo.
 *
 * @throws Error se o nome não for um placeholder E não estiver no registry.
 */
export function resolveTeamId(name: string): string {
  // Padrão de placeholder: dígito(s)+letra(s) (ex.: "2A", "1E"), "W"+número, "L"+número
  const isPlaceholder = /^(\d[A-Z]+|[WL]\d+)$/.test(name);
  if (isPlaceholder) return name;

  const entry = resolveTeam(name);
  if (entry === undefined) {
    throw new Error(
      `Time "${name}" não encontrado no teamRegistry. ` +
      `Adicionar entrada em teamRegistry.ts.`
    );
  }
  return entry.id;
}
```

#### 4.5.5 Mapeamento de status (D-OF6)

```ts
/**
 * status:
 *   - score.ft AUSENTE → "scheduled"
 *   - score.ft PRESENTE → "finished"
 *   (openfootball não tem status live — quando score.ft aparece, o jogo acabou)
 */
export function mapStatus(score: OpenFootballScore | undefined): MatchStatus {
  return score?.ft !== undefined ? "finished" : "scheduled";
}
```

#### 4.5.6 Função principal `mapOpenFootballMatch`

```ts
/**
 * Converte um OpenFootballMatch no shape do documento `matches/{id}`.
 * Valida a saída com matchSchema.parse() — lança ZodError se inválido.
 *
 * @param raw - Match do openfootball
 * @returns { id: string } & MappedMatch  (MatchWithId)
 */
export function mapOpenFootballMatch(raw: OpenFootballMatch): MatchWithId {
  const stage = mapRoundToStage(raw.round);

  // groupId: letra do grupo ("Group A" → "A"); null fora de fase de grupos
  const groupId =
    stage === "grupos" && raw.group
      ? raw.group.replace(/^Group\s+/i, "").trim() || null
      : null;

  // round number: extrair dígito de "Matchday N"; null em mata-mata
  const round: number | null =
    stage === "grupos"
      ? (Number.parseInt(raw.round.replace("Matchday ", ""), 10) || null)
      : null;

  const homeTeamId = resolveTeamId(raw.team1);
  const awayTeamId = resolveTeamId(raw.team2);
  const kickoffAt  = parseKickoffAt(raw.date, raw.time);
  const status     = mapStatus(raw.score);
  const id         = buildMatchId(raw);

  // venue: ground → { name: ground, city: "" } (openfootball não tem city separada)
  // Omitir venue se ground ausente (matchSchema admite null/undefined).
  const venue =
    raw.ground ? { name: raw.ground, city: raw.ground } : null;

  // Placares: só quando finished
  const isFinished = status === "finished";
  const homeScore = isFinished ? (raw.score?.ft?.[0] ?? null) : null;
  const awayScore = isFinished ? (raw.score?.ft?.[1] ?? null) : null;

  const doc = {
    homeTeamId,
    awayTeamId,
    kickoffAt,
    stage,
    round: round ?? undefined,
    groupId,
    venue,
    status,
    homeScore,
    awayScore,
  };

  const mapped = matchSchema.parse(doc);
  return { id, ...mapped };
}
```

**Nota sobre venue:** o campo `ground` do openfootball contém apenas o nome do estádio/cidade (ex.: `"Mexico City"`, `"Los Angeles (Inglewood)"`). `venueSchema` exige `name` e `city` como `nonEmptyString`. Usar `ground` como ambos é uma simplificação aceitável; alternativa: usar `ground` como `name` e derivar `city` do texto antes do parêntese. Esta decisão deve ser documentada no código.

### 4.6 `src/server/copaData/index.ts` — barrel e funções públicas

```ts
import "server-only";

import { HttpCopaDataClient } from "./client";
import { COPA_DATA_URL, isUseMockFallback } from "./config";
import { MockCopaDataClient } from "./mock";
import { mapOpenFootballMatch } from "./mapper";
import { resolveTeam } from "./teamRegistry";
import type { CopaDataClient } from "./client";
import type { MatchWithId } from "@/types/matches";
import type { MappedTeam } from "@/server/mappers/teamMapper"; // reusa o tipo

export type TeamWithId = MappedTeam & { id: string };

// ─── Factory ────────────────────────────────────────────────────────────────

function getCopaDataClient(): CopaDataClient {
  if (isUseMockFallback()) return new MockCopaDataClient();
  return new HttpCopaDataClient(COPA_DATA_URL);
}

// ─── Funções públicas (mesma assinatura de apiFootballData.ts) ───────────────

/**
 * Busca todos os matches da Copa 2026 via openfootball, mapeia para MatchWithId[].
 * Retorna grupos + mata-mata (104 matches quando o torneio estiver completo).
 */
export async function fetchAllMatches(): Promise<MatchWithId[]> {
  const client = getCopaDataClient();
  const data = await client.getData();
  return data.matches.map(mapOpenFootballMatch);
}

/**
 * Deriva as seleções participantes a partir dos matches de grupo
 * (times reais, excluindo placeholders de mata-mata).
 * groupId vem do campo `group` do match de grupo ("Group A" → "A").
 */
export async function fetchAllTeams(): Promise<TeamWithId[]> {
  const client = getCopaDataClient();
  const data = await client.getData();

  const seen = new Set<string>();
  const teams: TeamWithId[] = [];

  for (const match of data.matches) {
    if (!match.group) continue; // só jogos de grupo têm times reais com nome
    const groupId = match.group.replace(/^Group\s+/i, "").trim();

    for (const teamName of [match.team1, match.team2]) {
      const entry = resolveTeam(teamName);
      if (!entry || seen.has(entry.id)) continue;
      seen.add(entry.id);
      teams.push({
        id: entry.id,
        name: entry.name,
        code: entry.code,
        flagUrl: entry.flagUrl,
        groupId,
      });
    }
  }

  return teams;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export {
  CopaDataTimeoutError,
  CopaDataFetchError,
  CopaDataParseError,
} from "./client";
export type { CopaDataClient } from "./client";
export { COPA_DATA_URL, REVALIDATE_MATCHES, REVALIDATE_TEAMS } from "./config";
```

### 4.7 Mock para testes (`src/server/copaData/mock.ts`)

```ts
import type { CopaDataClient } from "./client";
import type { OpenFootballData } from "./types";
import { MOCK_COPA_DATA } from "./__tests__/fixtures/openfootballFixtures";

export class MockCopaDataClient implements CopaDataClient {
  async getData(): Promise<OpenFootballData> {
    return MOCK_COPA_DATA;
  }
}
```

### 4.8 Atualização dos Route Handlers

**`src/app/api/matches/route.ts`** — mudar import:
```ts
// Antes:
import { fetchAllMatches } from "../_lib/apiFootballData";
import { apiFootballErrorResponse } from "../_lib/apiFootballError";

// Depois:
import { fetchAllMatches } from "@/server/copaData";
import { copaDataErrorResponse } from "../_lib/copaDataError";
```

**`src/app/api/teams/route.ts`** e **`src/app/api/standings/route.ts`** — análogo.

**Novo `src/app/api/_lib/copaDataError.ts`:**
```ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { CopaDataTimeoutError, CopaDataFetchError, CopaDataParseError } from "@/server/copaData";

export function copaDataErrorResponse(err: unknown): NextResponse {
  if (err instanceof CopaDataTimeoutError)
    return NextResponse.json({ error: "A fonte de dados demorou para responder." }, { status: 504 });
  if (err instanceof CopaDataFetchError)
    return NextResponse.json({ error: "Falha ao buscar dados da Copa." }, { status: 502 });
  if (err instanceof CopaDataParseError)
    return NextResponse.json({ error: "Dados recebidos fora do contrato esperado." }, { status: 500 });
  if (err instanceof ZodError) {
    console.error("[copaData] ZodError ao mapear dados:", err.issues);
    return NextResponse.json({ error: "Dados recebidos fora do contrato esperado." }, { status: 500 });
  }
  console.error("[copaData] Erro inesperado:", err);
  return NextResponse.json({ error: "Erro inesperado ao obter os dados." }, { status: 500 });
}
```

**`src/app/api/_lib/apiFootballData.ts`** — shim de compatibilidade (se outros arquivos ainda importam daqui) ou deletar + atualizar os imports diretamente. Abordagem recomendada: **deletar o arquivo** e atualizar todos os imports para `@/server/copaData`.

---

## 5. Fixtures de teste

### 5.1 `src/server/copaData/__tests__/fixtures/openfootballFixtures.ts`

Amostra representativa com dados confirmados ao vivo:

```ts
import type { OpenFootballData, OpenFootballMatch } from "../../types";

// ─── Matches de grupo ────────────────────────────────────────────────────────

export const groupMatchBasic: OpenFootballMatch = {
  round: "Matchday 1",
  date: "2026-06-11",
  time: "13:00 UTC-6",
  team1: "Mexico",
  team2: "South Africa",
  group: "Group A",
  ground: "Mexico City",
};

export const groupMatchFinished: OpenFootballMatch = {
  round: "Matchday 2",
  date: "2026-06-15",
  time: "16:00 UTC-6",
  team1: "Brazil",
  team2: "Mexico",
  group: "Group E",
  ground: "Los Angeles (Inglewood)",
  score: { ft: [2, 1], ht: [1, 0] },
};

export const groupMatchNoTime: OpenFootballMatch = {
  round: "Matchday 3",
  date: "2026-06-20",
  team1: "Brazil",
  team2: "Egypt",
  group: "Group E",
  ground: "Dallas (Arlington)",
};

// ─── Matches de mata-mata ────────────────────────────────────────────────────

export const knockoutMatchRound32: OpenFootballMatch = {
  round: "Round of 32",
  num: 73,
  date: "2026-06-28",
  time: "12:00 UTC-7",
  team1: "2A",
  team2: "2B",
  ground: "Los Angeles (Inglewood)",
};

export const knockoutMatchRound16: OpenFootballMatch = {
  round: "Round of 16",
  num: 89,
  date: "2026-07-04",
  time: "15:00 UTC-5",
  team1: "W73",
  team2: "W74",
  ground: "Dallas (Arlington)",
};

export const knockoutMatchQuarterfinal: OpenFootballMatch = {
  round: "Quarter-final",
  num: 97,
  date: "2026-07-10",
  time: "18:00 UTC-5",
  team1: "W89",
  team2: "W90",
  ground: "New York (East Rutherford)",
};

export const knockoutMatchSemifinal: OpenFootballMatch = {
  round: "Semi-final",
  num: 101,
  date: "2026-07-14",
  time: "18:00 UTC-5",
  team1: "W97",
  team2: "W98",
  ground: "Dallas (Arlington)",
};

export const knockoutMatchThirdPlace: OpenFootballMatch = {
  round: "Match for third place",
  num: 103,
  date: "2026-07-18",
  time: "16:00 UTC-5",
  team1: "L101",
  team2: "L102",
  ground: "Miami (Miami Gardens)",
};

export const knockoutMatchFinal: OpenFootballMatch = {
  round: "Final",
  num: 104,
  date: "2026-07-19",
  time: "16:00 UTC-4",
  team1: "W101",
  team2: "W102",
  ground: "New York (East Rutherford)",
};

// Placeholder seeding com 1º de grupo
export const knockoutMatch1E: OpenFootballMatch = {
  round: "Round of 32",
  num: 75,
  date: "2026-06-29",
  time: "12:00 UTC-6",
  team1: "1E",
  team2: "3ABC",
  ground: "Mexico City",
};

// ─── Dataset completo mínimo para testes de integração ───────────────────────

export const MOCK_COPA_DATA: OpenFootballData = {
  name: "World Cup 2026",
  matches: [
    groupMatchBasic,
    groupMatchFinished,
    groupMatchNoTime,
    knockoutMatchRound32,
    knockoutMatchRound16,
    knockoutMatchQuarterfinal,
    knockoutMatchSemifinal,
    knockoutMatchThirdPlace,
    knockoutMatchFinal,
    knockoutMatch1E,
  ],
};
```

---

## 6. Testes (TDD)

### 6.1 `src/server/copaData/__tests__/mapper.test.ts`

| ID | Descrição | Asserção |
|---|---|---|
| MAP-01 | `mapRoundToStage("Matchday 1")` → `"grupos"` | |
| MAP-02 | `mapRoundToStage("Matchday 17")` → `"grupos"` | |
| MAP-03 | `mapRoundToStage("Round of 32")` → `"dezesseis-avos"` | |
| MAP-04 | `mapRoundToStage("Round of 16")` → `"oitavas"` | |
| MAP-05 | `mapRoundToStage("Quarter-final")` → `"quartas"` | |
| MAP-06 | `mapRoundToStage("Semi-final")` → `"semifinal"` | |
| MAP-07 | `mapRoundToStage("Match for third place")` → `"terceiro"` | |
| MAP-08 | `mapRoundToStage("Final")` → `"final"` | |
| MAP-09 | `mapRoundToStage("Unknown Round")` lança `Error` | |
| MAP-10 | `parseKickoffAt("2026-06-11", "13:00 UTC-6")` → `"2026-06-11T13:00:00-06:00"` | |
| MAP-11 | `parseKickoffAt("2026-07-19", "16:00 UTC-4")` → `"2026-07-19T16:00:00-04:00"` | |
| MAP-12 | `parseKickoffAt("2026-06-11", "18:00 UTC+1")` → `"2026-06-11T18:00:00+01:00"` | |
| MAP-13 | `parseKickoffAt("2026-06-20", undefined)` → `"2026-06-20T00:00:00+00:00"` | |
| MAP-14 | `parseKickoffAt("2026-06-11", "horário inválido")` lança `Error` | |
| MAP-15 | `buildMatchId({ num: 73, ... })` → `"m73"` | |
| MAP-16 | `buildMatchId({ num: 104, ... })` → `"m104"` | |
| MAP-17 | `buildMatchId` de grupo Mexico × South Africa 2026-06-11 → `"2026-06-11-mexico-south-africa"` | |
| MAP-18 | `buildMatchId` de grupo Brazil × Egypt 2026-06-20 → `"2026-06-20-brazil-egypt"` | |
| MAP-19 | `resolveTeamId("Mexico")` → `"MEX"` | |
| MAP-20 | `resolveTeamId("Brazil")` → `"BRA"` | |
| MAP-21 | `resolveTeamId("2A")` → `"2A"` (placeholder preservado) | |
| MAP-22 | `resolveTeamId("W74")` → `"W74"` (placeholder preservado) | |
| MAP-23 | `resolveTeamId("L101")` → `"L101"` (placeholder preservado) | |
| MAP-24 | `resolveTeamId("1E")` → `"1E"` (placeholder preservado) | |
| MAP-25 | `resolveTeamId("Time Desconhecido")` lança `Error` | |
| MAP-26 | `mapOpenFootballMatch(groupMatchBasic)` retorna `MatchWithId` válido por `matchSchema` | |
| MAP-27 | `mapOpenFootballMatch(groupMatchBasic).stage` === `"grupos"` | |
| MAP-28 | `mapOpenFootballMatch(groupMatchBasic).groupId` === `"A"` | |
| MAP-29 | `mapOpenFootballMatch(groupMatchBasic).round` === `1` | |
| MAP-30 | `mapOpenFootballMatch(groupMatchBasic).status` === `"scheduled"` | |
| MAP-31 | `mapOpenFootballMatch(groupMatchBasic).homeScore` === `null` | |
| MAP-32 | `mapOpenFootballMatch(groupMatchFinished).status` === `"finished"` | |
| MAP-33 | `mapOpenFootballMatch(groupMatchFinished).homeScore` === `2` | |
| MAP-34 | `mapOpenFootballMatch(groupMatchFinished).awayScore` === `1` | |
| MAP-35 | `mapOpenFootballMatch(groupMatchFinished).id` tem slug com data+times | |
| MAP-36 | `mapOpenFootballMatch(knockoutMatchRound32).id` === `"m73"` | |
| MAP-37 | `mapOpenFootballMatch(knockoutMatchRound32).stage` === `"dezesseis-avos"` | |
| MAP-38 | `mapOpenFootballMatch(knockoutMatchRound32).homeTeamId` === `"2A"` | |
| MAP-39 | `mapOpenFootballMatch(knockoutMatchRound32).awayTeamId` === `"2B"` | |
| MAP-40 | `mapOpenFootballMatch(knockoutMatchRound32).groupId` === `null` | |
| MAP-41 | `mapOpenFootballMatch(knockoutMatchFinal).stage` === `"final"` | |
| MAP-42 | `mapOpenFootballMatch(knockoutMatchThirdPlace).stage` === `"terceiro"` | |
| MAP-43 | `mapOpenFootballMatch(knockoutMatch1E).homeTeamId` === `"1E"` | |
| MAP-44 | `mapOpenFootballMatch(groupMatchNoTime).kickoffAt` === `"2026-06-20T00:00:00+00:00"` | |
| MAP-45 | Output de `mapOpenFootballMatch` para jogo de grupo passa em `matchSchema.parse()` sem erros | |
| MAP-46 | Output de `mapOpenFootballMatch` para mata-mata passa em `matchSchema.parse()` sem erros | |

### 6.2 `src/server/copaData/__tests__/teamRegistry.test.ts`

| ID | Descrição | Asserção |
|---|---|---|
| REG-01 | `TEAM_REGISTRY` tem exatamente 48 entradas | |
| REG-02 | Todos os `code` satisfazem regex `^[A-Z]{3}$` | |
| REG-03 | Todos os `flagUrl` são strings não vazias iniciando com `https://` | |
| REG-04 | `resolveTeam("Brazil")` retorna `{ id: "BRA", code: "BRA", ... }` | |
| REG-05 | `resolveTeam("Mexico")` retorna `{ id: "MEX", code: "MEX", ... }` | |
| REG-06 | `resolveTeam("Unknown Country")` retorna `undefined` | |
| REG-07 | IDs no registry são únicos (sem duplicatas) | |
| REG-08 | Todos os `id === code` (invariante D-OF3) | |

### 6.3 `src/server/copaData/__tests__/client.test.ts`

| ID | Descrição | Asserção |
|---|---|---|
| CLI-01 | Retorna `OpenFootballData` válido quando fetch retorna JSON bem-formado | `data.matches` é array |
| CLI-02 | Lança `CopaDataTimeoutError` em AbortError (timeout) | |
| CLI-03 | Lança `CopaDataFetchError` em HTTP 404 | |
| CLI-04 | Lança `CopaDataFetchError` em HTTP 500 | |
| CLI-05 | Lança `CopaDataParseError` quando JSON não tem campo `matches` | |
| CLI-06 | Lança `CopaDataParseError` quando `matches` não é array | |
| CLI-07 | Lança erro de rede genérico (não AbortError) para falha de rede | |

### 6.4 Testes obsoletos a desativar

| Arquivo | Ação |
|---|---|
| `src/server/apiFootball/__tests__/client.http.test.ts` | Manter (ainda testa `HttpApiFootballClient` isolado) |
| `src/server/apiFootball/__tests__/client.mock.test.ts` | Manter (ainda testa `MockApiFootballClient` isolado) |
| `src/app/api/_lib/__tests__/apiFootballError.test.ts` | Manter ou adaptar para `copaDataError.test.ts` |
| `src/server/mappers/__tests__/matchMapper.test.ts` | Manter (mapper api-football ainda existe como referência) |
| `src/server/mappers/__tests__/teamMapper.test.ts` | Manter (idem) |

---

## 7. Critérios de aceitação

- [ ] `fetchAllMatches()` retorna `MatchWithId[]` com `id` estável (slug para grupos, `m{num}` para mata-mata).
- [ ] Todos os stages mapeados corretamente (grupos, dezesseis-avos, oitavas, quartas, semifinal, terceiro, final).
- [ ] `kickoffAt` é ISO 8601 com offset (`z.iso.datetime({ offset: true })` aceita).
- [ ] `groupId` preenchido para todos os jogos de grupo (letras A–L); `null` para mata-mata.
- [ ] Placeholders de mata-mata (`"2A"`, `"W74"`, `"L101"`) preservados em `homeTeamId`/`awayTeamId`.
- [ ] `fetchAllTeams()` retorna 48 `TeamWithId[]` com `code` regex `^[A-Z]{3}$` e `flagUrl` válida.
- [ ] Todos os testes MAP-01…MAP-46, REG-01…REG-08, CLI-01…CLI-07 passam em vitest sem acesso à rede.
- [ ] Testes existentes (mapper, teamMapper, apiFootballError) continuam verdes.
- [ ] TypeScript compila sem `any` introduzido, sem `@ts-ignore`.
- [ ] `GET /api/matches`, `GET /api/teams`, `GET /api/standings` retornam dados corretos com o mock ativo (`COPA_DATA_USE_MOCK=true`).
- [ ] Nenhum import de `src/server/apiFootball` nos Route Handlers de produção (imports de produção migrados para `@/server/copaData`).

---

## 8. Sequência de implementação (TDD)

1. **RED** — criar `__tests__/fixtures/openfootballFixtures.ts` com os samples acima.
2. **RED** — criar `__tests__/mapper.test.ts` com MAP-01..MAP-46 (todos falham — módulo não existe).
3. **RED** — criar `__tests__/teamRegistry.test.ts` com REG-01..REG-08.
4. **RED** — criar `__tests__/client.test.ts` com CLI-01..CLI-07.
5. **GREEN** — implementar `types.ts`.
6. **GREEN** — implementar `config.ts`.
7. **GREEN** — implementar `teamRegistry.ts` (48 entradas — inspecionar JSON ao vivo primeiro).
8. **GREEN** — implementar `client.ts` (`CopaDataClient`, `HttpCopaDataClient`, erros). Testes CLI ficam verdes.
9. **GREEN** — implementar `mapper.ts` (todas as funções). Testes MAP ficam verdes.
10. **GREEN** — implementar `mock.ts` (`MockCopaDataClient`) e `index.ts`.
11. **Migrar** — atualizar Route Handlers + criar `copaDataError.ts`.
12. **Verify** — rodar `rtk vitest run` — todos os testes verdes; confirmar `COPA_DATA_USE_MOCK=true` funciona no dev local.
13. **Deprecate** — adicionar comentário `@deprecated` no `src/server/apiFootball/index.ts`.

---

## 9. Open questions

| # | Questão | Impacto | Recomendação |
|---|---|---|---|
| OQ-1 | **Placeholders vs. `matchSchema` strict:** `homeTeamId` é `nonEmptyString` — `"2A"` e `"W74"` satisfazem (strings não vazias). Mas a lib de chave (TASK-03) e o frontend esperam que `homeTeamId` seja um id de seleção (ex.: `"BRA"`). Como distinguir placeholder de id real para exibição e para `resolveTeam` no frontend? | Alto — TASK-03 e componentes de bracket precisam de um contrato claro | Proposta: exportar `isPlaceholderId(id: string): boolean` de `copaData`; o frontend/TASK-03 usa para branch visual. **Decidir antes de TASK-03.** |
| OQ-2 | **`/api/standings` com openfootball:** a rota atual deriva standings dos teams (agrupa por `groupId`). Com copaData, `fetchAllTeams()` já traz `groupId` correto — a rota funciona sem alteração. Mas standings do openfootball não inclui pontos/saldo reais. A rota continua servindo apenas `{ groups: [{ groupId, teams }] }` — suficiente? | Baixo — PRD diz que standings reais são derivados via TASK-02 (lógica client-side) | Manter a rota como está; documentar que serve apenas a composição dos grupos, não a classificação. |
| OQ-3 | **Persistência de palpites para mata-mata com placeholders:** `prediction.matchId` = `"m73"`. O usuário aposta no jogo `m73` onde `homeTeamId = "2A"`. Quando os times forem definidos na realidade, o `matchId` não muda — o palpite continua válido. Mas como pontuamos se o usuário apostou antes de saber quem são os times? | Alto — impacta a lógica de score de TASK-02 e a régua de negócio | Adotar: palpite em mata-mata sempre referencia `matchId` real (ex.: `m73`); pontuação compara placar previsto × placar real quando `score.ft` aparecer. A identidade do jogo é o `matchId`, não os times. **Confirmar com PRD antes de TASK-04.** |
| OQ-4 | **Venue com `city` duplicado de `name`:** openfootball tem apenas `ground` (ex.: `"Mexico City"`). `venueSchema` exige `name` e `city` como `nonEmptyString`. Usar `ground` como ambos é semanticamente incorreto (ex.: `"Los Angeles (Inglewood)"` não é uma cidade). Alternativa: extrair a parte antes do `(` como city. | Baixo — venue é informativo, não pontuado | Implementar parser simples: `city = ground.split("(")[0].trim() \|\| ground`; `name = ground`. Assim `"Los Angeles (Inglewood)"` vira `city="Los Angeles"`, `name="Los Angeles (Inglewood)"`. Documentar no código. |
| OQ-5 | **Formato de `time` com UTC+0:** o JSON pode ter `"18:00 UTC+0"` (zero sem dígito duplo). A regex `UTC([+-])(\d{1,2})` cobre `+0` → `+00:00`. Verificar no JSON ao vivo se `UTC+0` ou `UTC+00` são usados. | Baixo — a regex já cobre ambos | Testar com fixture adicional `"18:00 UTC+0"` no MAP-. Se necessário, adicionar caso de teste. |
| OQ-6 | **Nomes exatos das 48 seleções no JSON openfootball:** o registry precisa mapear o nome exato como aparece no `worldcup.json` para o `TeamEntry`. Diferenças: `"United States"` vs. `"USA"`, `"South Korea"` vs. `"Korea Republic"`, etc. | Alto — registry errado → todos os matches de grupo com aquele time lançam `Error` no `resolveTeamId` | O implementador DEVE inspecionar o JSON ao vivo (`https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json`) e extrair os nomes exatos antes de escrever o registry. Adicionar fixture de integração que parseia o JSON real em CI (opcional). |
| OQ-7 | **`round` number para Matchday:** `Number.parseInt("Matchday 1".replace("Matchday ", ""), 10)` = `1` OK. Mas rodadas como `"Matchday 17"` (Copa com 12 grupos × 3 rodadas = 36 rodadas, mas rounds distintos são 1–3 por grupo, portanto Matchday 1–3 dentro de cada grupo, ou 1–17 globalmente?) — confirmar o range real no JSON. | Médio — impacta o campo `round` de `matchSchema` | Mapear o número do Matchday como `round` (ex.: `Matchday 3` → `round = 3`). Se o JSON usar Matchdays até 17 (17 rodadas globais), `round` pode ser 1–17. `matchSchema.round` aceita qualquer `int ≥ 1`. Sem bloqueio. |
