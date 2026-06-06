# SPEC — TASK-09: Esqueleto Cloud Functions + Integração API-Football

> Entrada: `ai/plan/feature.md` (TASK-09) + `ai/prd/feature.md` + `.claude/CLAUDE.md` (fluxo API-Football → Cloud Functions → Firestore → Frontend; coleções `teams`/`groups`/`matches`; estratégia de atualização de dados) + `ai/spec/task-07.md` (schemas Zod das 9 coleções) + `firebase.json` (emuladores, porta Functions 5001) + `src/schemas/*` (contratos Zod existentes).
> Tipo: `integration` · Criticidade: `high` · Risco técnico: `high` · Story points: 5.
> TDD: **sim** · Screen: não · Dependências: **TASK-05** (firebase init + Admin SDK), **TASK-07** (schemas Zod) — Wave 4.

---

## 1. Objetivo

Criar o **projeto Firebase Functions independente** sob `functions/` e implementar:

1. Um **cliente HTTP** encapsulado para a API-Football, com chave em variável de ambiente exclusivamente no lado do servidor, tratamento de cota, timeout e interface mockável.
2. Uma **camada de mapeamento** pura (`apiFootball → documento Firestore`) validada contra os schemas Zod existentes — este é o **alvo principal de TDD**.
3. Uma **função callable de exemplo** (`syncTeams`) e um **stub de função agendada** (`scheduledSync`, cron `0 2 * * *`) que orquestram: chamada ao cliente → mapeamento → escrita no Firestore via Admin SDK.
4. Toda a **infraestrutura de build e teste** do subprojeto, incluindo configuração de Vitest e `tsconfig` independentes do app Next.js.

O frontend **jamais** chama a API-Football diretamente. Cloud Functions são o único ponto de contato com a API externa.

### Truths que devem ser verdadeiras ao fim

- `functions/` é um projeto Node.js TypeScript autônomo com seu próprio `package.json` e `tsconfig.json`.
- `functions/src/apiFootball/client.ts` exporta uma interface `ApiFootballClient` e uma implementação concreta; `functions/src/apiFootball/mock.ts` exporta uma implementação mock sem dependências externas.
- A chave da API é lida de `process.env.API_FOOTBALL_KEY` (server-side); nunca de `NEXT_PUBLIC_*`.
- `functions/src/mappers/` contém funções puras que transformam respostas da API-Football nos shapes dos schemas Zod (ex.: `teamSchema`, `matchSchema`). Essas funções são testadas com Vitest.
- `functions/src/index.ts` exporta pelo menos `syncTeams` (callable) e `scheduledSync` (scheduled, cron `0 2 * * *`).
- `npm run build` na raiz do projeto Next.js continua verde; `npm run build` dentro de `functions/` compila o subprojeto independentemente via `tsc`.
- `npm run test` dentro de `functions/` roda a suíte Vitest (mappers + cliente mock) e passa.
- Sem `any` em todo o código TypeScript de `functions/`.
- O sistema funciona sem credenciais reais da API-Football — o cliente é substituível pelo mock de forma transparente.

---

## 2. Escopo

### Dentro do escopo

- Scaffold completo do subprojeto `functions/`: `package.json`, `tsconfig.json`, `.eslintrc.js`, `vitest.config.ts`.
- Módulo `functions/src/apiFootball/`: interface do cliente, implementação concreta (HTTP com `node-fetch` ou `fetch` nativo do Node 18+), implementação mock e tipos da API-Football.
- Módulo `functions/src/mappers/`: funções puras de mapeamento com output validado pelos schemas Zod.
- Módulo `functions/src/firestore/`: helpers de escrita idempotente via Admin SDK.
- `functions/src/index.ts`: exports das funções Firebase (callable `syncTeams`, scheduled `scheduledSync`).
- Suíte de testes em `functions/src/__tests__/` ou `functions/src/**/*.test.ts` cobrindo mappers e cliente mock.
- Documentação de variáveis de ambiente e estratégia de quotas (neste spec, §8).
- Config de mapeamento de IDs Copa 2026 com placeholder documentado (§6.3).

### Fora do escopo (tarefas posteriores)

- Deploy efetivo das Functions para produção ou staging → **TASK-10**.
- Sync completo de todos os dados da Copa (esta task entrega o **esqueleto** e a function `syncTeams` como exemplo funcional).
- Cálculo de rankings e estatísticas via Functions → PRDs futuros.
- Custom claims via Functions (refinamento do controle de acesso; apontado na TASK-08).
- Telas/UI que consumam os dados sincronizados.

> Não alterar `.claude/`, `docs/`, `src/` (app Next.js), `firestore.rules`. Esta task cria arquivos exclusivamente sob `functions/` e, se necessário, ajusta `firebase.json` para referenciar o diretório `functions/` nas configurações de build (verificar se já está correto — não quebrar o emulador existente).

---

## 3. Decisões técnicas

### 3.1 Subprojeto Node.js independente

**Decisão D1:** `functions/` é um projeto Node.js **autônomo**, com `package.json` próprio e dependências separadas do app Next.js. O `tsconfig.json` de `functions/` NÃO estende o `tsconfig.json` da raiz (ambientes de execução diferentes: browser/Node; módulos `commonjs` vs `esnext`). O `tsc` de `functions/` compila para `functions/lib/` (saída configurada em `outDir`). O `package.json` raiz do Next.js não inclui `functions/` no seu `build` — a compilação das Functions é separada.

**Versão do Node runtime:** Node.js **18** (LTS; suportado pelo Firebase Functions v2). Configurar em `functions/package.json` → `"engines": { "node": "18" }`.

### 3.2 Firebase Functions v2

**Decisão D2:** usar **Firebase Functions v2** (`firebase-functions/v2`) em vez de v1. A v2 usa sintaxe mais limpa, melhor integração com Cloud Run e suporte a scheduler via `onSchedule`. Imports relevantes:

```ts
import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
```

### 3.3 Admin SDK via `firebase-admin`

**Decisão D3:** acesso ao Firestore dentro das Functions usa exclusivamente o **Firebase Admin SDK** (`firebase-admin`). O Admin SDK **bypassa as Security Rules** por design (TASK-08, D8). Não usar o SDK client do browser (`src/firebase/client.ts`) dentro das Functions. Inicializar o Admin SDK uma única vez em `functions/src/firebase/admin.ts` com `initializeApp()` (sem argumentos — o runtime do Firebase injeta as credenciais automaticamente em produção; no emulador, usar `FIRESTORE_EMULATOR_HOST`).

### 3.4 Interface do cliente API-Football

**Decisão D4:** definir uma **interface TypeScript** `ApiFootballClient` que abstrai todas as chamadas HTTP à API-Football. A implementação concreta (`HttpApiFootballClient`) e a implementação mock (`MockApiFootballClient`) implementam essa mesma interface. O código de orquestração (`syncTeams`, `scheduledSync`) recebe o cliente como parâmetro (injeção de dependência) ou obtém-o via factory configurável. Isso permite:

- Testar orquestradores com o mock sem I/O real.
- Substituir por mock enquanto fixtures da Copa 2026 não existem na API.
- Futura substituição por outro provider sem alterar orquestradores.

### 3.5 Sem `any` nas Functions

**Decisão D5:** a regra de `no any` do projeto se aplica integralmente a `functions/`. Respostas HTTP da API-Football são tipadas com interfaces em `functions/src/apiFootball/types.ts`; parsing/validação com Zod garante que os dados externos entram no sistema com tipos conhecidos. Usar `unknown` + type guard ou `safeParse` ao lidar com corpos de resposta desconhecidos.

### 3.6 Mapeamento puro e testável

**Decisão D6:** funções de mapeamento em `functions/src/mappers/` são **puras** — recebem dados brutos da API-Football, retornam o shape do documento Firestore (ou lançam erro de validação Zod). Sem side effects, sem imports do Firebase, sem I/O. Essa pureza é o que torna o TDD trivial: nenhum mock de Firebase necessário nos testes de mapper.

### 3.7 Vitest no subprojeto Functions

**Decisão D7:** usar **Vitest** para testes do subprojeto `functions/`, alinhado com o restante da stack de testes do projeto. Configurar `vitest.config.ts` dentro de `functions/` com alias de caminhos relativos (sem `@/` — o alias `@` é do Next.js; usar caminhos relativos ou configurar alias `#functions/` se necessário). Testes de mapper são unitários puros; não precisam do emulador Firebase.

### 3.8 Estratégia de quotas da API-Football

**Decisão D8:** a API-Football tem cota diária de requisições (plano free: tipicamente 100 req/dia). Estratégia adotada:

1. **Cache em Firestore primeiro:** antes de chamar a API, checar se o dado já existe no Firestore e é recente o suficiente (ex.: atualizado há menos de 24h para `teams`/`matches`).
2. **Sync sob demanda** via `syncTeams` (callable): administrador aciona manualmente quando necessário.
3. **Scheduler diário** às 02:00 (`scheduledSync`): atualiza resultados/standings — dados dinâmicos que mudam diariamente durante a Copa.
4. **Fallback para mock:** se `API_FOOTBALL_KEY` não estiver definida, o sistema usa o `MockApiFootballClient` automaticamente (comportamento documentado em §8).

### 3.9 Idempotência nas escritas

**Decisão D9:** escritas no Firestore usam `set` com merge seletivo ou `set` simples em vez de `add` para garantir **idempotência**. Executar `syncTeams` duas vezes não cria duplicatas — o documento é identificado por ID estável (ex.: `teams/{apiFootballTeamId}` ou `teams/{codigoFIFA}`). Documentar a estratégia de ID de cada coleção em §6.4.

### 3.10 IDs Copa 2026 — config-driven com placeholder

**Decisão D10:** os IDs de torneio e temporada da Copa 2026 na API-Football são **desconhecidos** até que os fixtures existam na API. Centralizar em `functions/src/apiFootball/config.ts` como constantes documentadas. Quando os IDs reais forem conhecidos, apenas esse arquivo é editado. Não hardcodar IDs em múltiplos lugares.

---

## 4. Layout de arquivos

```
functions/
├── package.json                   # projeto Node.js independente
├── tsconfig.json                  # TypeScript p/ Node 18, outDir: lib/
├── .eslintrc.js                   # extends do ESLint do projeto
├── vitest.config.ts               # config Vitest para functions/
├── src/
│   ├── index.ts                   # exports das Firebase Functions
│   ├── firebase/
│   │   └── admin.ts               # init Firebase Admin SDK (singleton)
│   ├── apiFootball/
│   │   ├── types.ts               # interfaces TypeScript das respostas da API-Football
│   │   ├── client.ts              # interface ApiFootballClient + HttpApiFootballClient
│   │   ├── mock.ts                # MockApiFootballClient (sem I/O real)
│   │   ├── config.ts              # IDs de torneio/temporada (Copa 2026 placeholder)
│   │   └── factory.ts             # getApiFootballClient() — retorna real ou mock
│   ├── mappers/
│   │   ├── teamMapper.ts          # ApiFootball team → teamSchema
│   │   └── matchMapper.ts         # ApiFootball fixture → matchSchema
│   ├── firestore/
│   │   └── writer.ts              # helpers de escrita idempotente via Admin SDK
│   ├── functions/
│   │   ├── syncTeams.ts           # callable: orquestra sincronização de seleções
│   │   └── scheduledSync.ts       # scheduled: cron 02:00, resultados/standings
│   └── __tests__/
│       ├── teamMapper.test.ts
│       ├── matchMapper.test.ts
│       └── client.mock.test.ts
└── lib/                           # saída do tsc (gerado; no .gitignore)
```

> O diretório `functions/lib/` deve estar no `.gitignore`. O arquivo `functions/.gitignore` é gerado automaticamente pelo `firebase init functions` e já o inclui normalmente; verificar e adicionar se ausente.

---

## 5. Interfaces e contratos de código

### 5.1 Interface `ApiFootballClient`

```ts
// functions/src/apiFootball/client.ts

export interface TeamResponse {
  team: {
    id: number;
    name: string;
    code: string;
    logo: string;
  };
  group?: string; // injetado pelo contexto do torneio
}

export interface FixtureResponse {
  fixture: {
    id: number;
    date: string;        // ISO 8601
    status: { short: string }; // "NS", "1H", "FT", "PST", etc.
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  league: {
    round: string; // ex.: "Group Stage - 1", "Round of 16"
  };
}

export interface ApiFootballClient {
  getTeamsByTournament(tournamentId: number, season: number): Promise<TeamResponse[]>;
  getFixtures(tournamentId: number, season: number): Promise<FixtureResponse[]>;
}
```

> Os tipos acima são um **subconjunto** da resposta da API-Football — apenas os campos que o mapeamento consome. Campos adicionais da API são ignorados. Se a API retornar mais campos, o `HttpApiFootballClient` os recebe mas não os expõe pela interface, mantendo o contrato enxuto.

### 5.2 `HttpApiFootballClient` (implementação concreta)

```ts
// functions/src/apiFootball/client.ts (continuação)

export class HttpApiFootballClient implements ApiFootballClient {
  private readonly baseUrl = "https://v3.football.api-sports.io";
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(apiKey: string, timeoutMs = 10_000) {
    if (!apiKey) throw new Error("API_FOOTBALL_KEY não configurada.");
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  // ... métodos implementados com fetch + AbortController para timeout
  // + verificação de status HTTP + tratamento de erro de quota (HTTP 429)
}
```

**Tratamento de erros obrigatório:**
- `HTTP 429` (quota excedida): lançar `ApiFootballQuotaError` (custom error class) com mensagem em pt-BR; função orquestradora captura e registra via `logger.warn`.
- `HTTP 401/403`: lançar `ApiFootballAuthError`; indicar variável `API_FOOTBALL_KEY` provavelmente inválida.
- Timeout via `AbortController` (`signal: AbortSignal.timeout(this.timeoutMs)`): lançar `ApiFootballTimeoutError`.
- Erros de rede genéricos: relançar com contexto.

### 5.3 `MockApiFootballClient` (implementação mock)

```ts
// functions/src/apiFootball/mock.ts

export class MockApiFootballClient implements ApiFootballClient {
  async getTeamsByTournament(_tournamentId: number, _season: number): Promise<TeamResponse[]> {
    return MOCK_TEAMS; // array de TeamResponse com dados fictícios da Copa 2026
  }

  async getFixtures(_tournamentId: number, _season: number): Promise<FixtureResponse[]> {
    return MOCK_FIXTURES; // array de FixtureResponse com partidas fictícias
  }
}
```

O mock inclui dados suficientes para exercitar o mapeamento completo (pelo menos 4 seleções de grupos diferentes, 2 partidas em status distintos). Esses dados também são usados nos testes de mapper.

### 5.4 `getApiFootballClient()` — factory

```ts
// functions/src/apiFootball/factory.ts

import { HttpApiFootballClient } from "./client";
import { MockApiFootballClient } from "./mock";
import type { ApiFootballClient } from "./client";

export function getApiFootballClient(): ApiFootballClient {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    // Sem chave configurada → usar mock (ambiente de desenvolvimento / Copa sem fixtures)
    return new MockApiFootballClient();
  }
  return new HttpApiFootballClient(apiKey);
}
```

> Esta factory é o **único lugar** no código de produção que decide qual implementação usar. O orquestrador importa `getApiFootballClient()` e nunca instancia diretamente o cliente concreto ou o mock.

---

## 6. Camada de mapeamento

### 6.1 `teamMapper.ts`

Transforma uma `TeamResponse` da API-Football no shape esperado pelo `teamSchema` de `src/schemas/teams.ts`.

**Assinatura:**

```ts
// functions/src/mappers/teamMapper.ts

import { type z } from "zod";
// Importar o schema a partir de um caminho relativo ao subprojeto,
// ou copiar/reexportar o schema em functions/src/shared/schemas.ts
// (ver nota D11 em §6.5)
import { teamSchema } from "../../shared/schemas"; // ou caminho equivalente

export type MappedTeam = z.infer<typeof teamSchema>;

export function mapApiTeamToFirestore(raw: TeamResponse, groupId?: string): MappedTeam {
  const doc = {
    name: raw.team.name,
    code: raw.team.code,
    flagUrl: raw.team.logo || undefined,
    groupId: groupId ?? raw.group ?? undefined,
  };
  // parse com Zod garante que o output satisfaz teamSchema;
  // lança ZodError (com mensagem pt-BR) se o dado da API for inválido
  return teamSchema.parse(doc);
}
```

**Regras:**
- Saída **sempre** validada por `teamSchema.parse(doc)` — se a API retornar dado inválido, o erro de Zod propaga e a escrita não ocorre.
- `groupId` é injetado como parâmetro quando o contexto do torneio o informa (a API-Football retorna seleções e grupos em endpoints separados; o orquestrador combina antes de chamar o mapper).
- Sem imports de Firebase, sem side effects.

### 6.2 `matchMapper.ts`

Transforma uma `FixtureResponse` no shape do `matchSchema`.

**Assinatura:**

```ts
export type MappedMatch = z.infer<typeof matchSchema>;

export function mapApiFixtureToFirestore(
  raw: FixtureResponse,
  teamIdMap: Record<number, string>, // apiId → firestoreDocId
): MappedMatch
```

**Lógica de mapeamento:**

| Campo API-Football | Campo Firestore | Transformação |
|---|---|---|
| `teams.home.id` | `homeTeamId` | lookup em `teamIdMap` |
| `teams.away.id` | `awayTeamId` | lookup em `teamIdMap` |
| `fixture.date` | `kickoffAt` | string ISO 8601 (já compatível) |
| `league.round` | `stage` | `mapRoundToStage(round)` (ver abaixo) |
| `fixture.status.short` | `status` | `mapApiStatusToMatchStatus(status)` |
| `goals.home` | `homeScore` | `null` se não finalizado |
| `goals.away` | `awayScore` | `null` se não finalizado |

**`mapRoundToStage(round: string): Stage`** — função auxiliar pura que converte os valores de `league.round` da API-Football (ex.: `"Group Stage - 1"`, `"Round of 16"`, `"Quarter-finals"`) para os valores do `stageSchema` (`"grupos"`, `"oitavas"`, `"quartas"`, `"semifinal"`, `"final"`). Esta função é **config-driven**: os mapeamentos são declarados em um objeto e podem ser estendidos sem alterar a lógica.

**`mapApiStatusToMatchStatus(short: string): MatchStatus`** — converte status da API (`"NS"` → `"scheduled"`, `"1H"|"HT"|"2H"` → `"live"`, `"FT"` → `"finished"`, `"PST"` → `"postponed"`, `"CANC"` → `"canceled"`) para o `matchStatusSchema`.

Ambos os auxiliares são exportados individualmente para facilitar testes unitários isolados.

### 6.3 Config de IDs Copa 2026 (placeholder)

```ts
// functions/src/apiFootball/config.ts

/**
 * IDs do torneio Copa do Mundo 2026 na API-Football.
 *
 * ⚠️  PLACEHOLDER — os IDs reais ainda não estão disponíveis na API-Football
 * (copa de 2026; fixtures podem não existir no momento desta implementação).
 *
 * Quando os IDs forem publicados pela API-Football, atualizar apenas este arquivo.
 * Referência: https://www.api-football.com/documentation-v3#tag/Leagues
 *
 * Copa do Mundo 2018: leagueId = 1, season = 2018
 * Copa do Mundo 2022: leagueId = 1, season = 2022
 * Copa do Mundo 2026: leagueId provavelmente = 1, season = 2026 (CONFIRMAR)
 */
export const COPA_2026_CONFIG = {
  leagueId: 1,      // TODO: confirmar quando disponível na API-Football
  season: 2026,     // TODO: confirmar quando disponível na API-Football
} as const;

/**
 * Se true, ignora API real e usa MockApiFootballClient independente de API_FOOTBALL_KEY.
 * Útil para desenvolvimento sem fixtures reais disponíveis.
 */
export const USE_MOCK_FALLBACK = process.env.API_FOOTBALL_USE_MOCK === "true";
```

### 6.4 Estratégia de ID de documento no Firestore

| Coleção | ID do documento | Justificativa |
|---|---|---|
| `teams/{teamId}` | `String(raw.team.id)` (ID numérico da API-Football como string) | Estável, idempotente, referenciável |
| `matches/{matchId}` | `String(raw.fixture.id)` (ID do fixture na API-Football) | Estável, idempotente |
| `groups/{groupId}` | Letra do grupo em maiúscula, ex.: `"A"` | Estável, derivável do fixture |

> Esta estratégia garante idempotência: reexecutar `syncTeams` sobrescreve os mesmos documentos com `set()` — sem duplicatas.

### 6.5 Nota D11 — Compartilhamento dos schemas Zod entre `src/` e `functions/`

Os schemas Zod vivem em `src/schemas/` (projeto Next.js). As funções de mapeamento em `functions/` precisam importá-los para validar o output. Duas abordagens possíveis:

**Abordagem A (recomendada para esta task):** copiar/espelhar os schemas relevantes em `functions/src/shared/schemas.ts`, mantendo-os em sincronia manualmente. Simples, sem dependência de paths cruzados entre projetos distintos.

**Abordagem B (alternativa futura):** extrair os schemas para um pacote `packages/schemas/` (monorepo com workspaces) compartilhado pelos dois projetos. Mais correto arquiteturalmente, mas adiciona complexidade de configuração de monorepo fora do escopo desta task.

**Decisão para TASK-09:** usar a **Abordagem A**. Criar `functions/src/shared/schemas.ts` que reimporta/reexporta apenas `teamSchema` e `matchSchema` (os usados pelos mappers). Documentar que este arquivo deve ser mantido em sincronia com `src/schemas/`. A migração para Abordagem B é um refinamento futuro.

---

## 7. Funções Firebase

### 7.1 `syncTeams` — callable

```ts
// functions/src/functions/syncTeams.ts

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { getApiFootballClient } from "../apiFootball/factory";
import { mapApiTeamToFirestore } from "../mappers/teamMapper";
import { writeTeams } from "../firestore/writer";
import { COPA_2026_CONFIG } from "../apiFootball/config";

export const syncTeams = onCall(async (request) => {
  // Verificar se o chamador é admin (via custom claims ou uid conhecido)
  // Nesta task, deixar sem auth guard (stub); auth guard será adicionado em PRD futuro
  // quando custom claims estiverem configurados (apontado em TASK-08 §9.4).

  logger.info("syncTeams: iniciando sincronização de seleções.");

  const client = getApiFootballClient();

  try {
    const teams = await client.getTeamsByTournament(
      COPA_2026_CONFIG.leagueId,
      COPA_2026_CONFIG.season,
    );

    const mapped = teams.map((t) => ({
      id: String(t.team.id),
      data: mapApiTeamToFirestore(t, t.group),
    }));

    await writeTeams(mapped);

    logger.info(`syncTeams: ${mapped.length} seleções gravadas no Firestore.`);
    return { synced: mapped.length };
  } catch (err) {
    logger.error("syncTeams: erro na sincronização.", err);
    throw new HttpsError("internal", "Erro ao sincronizar seleções.");
  }
});
```

### 7.2 `scheduledSync` — scheduled (stub)

```ts
// functions/src/functions/scheduledSync.ts

import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { getApiFootballClient } from "../apiFootball/factory";
import { COPA_2026_CONFIG } from "../apiFootball/config";

// Executa diariamente às 02:00 (fuso UTC; ajustar se necessário)
export const scheduledSync = onSchedule("0 2 * * *", async () => {
  logger.info("scheduledSync: início da sincronização agendada.");

  const client = getApiFootballClient();

  try {
    // Stub — sincronização completa (fixtures + resultados) a ser implementada
    // quando IDs Copa 2026 estiverem confirmados (COPA_2026_CONFIG.leagueId/season)
    const fixtures = await client.getFixtures(
      COPA_2026_CONFIG.leagueId,
      COPA_2026_CONFIG.season,
    );

    logger.info(`scheduledSync: ${fixtures.length} fixtures recebidos da API.`);
    // TODO (PRD futuro): mapear fixtures e gravar matches/results no Firestore
  } catch (err) {
    logger.error("scheduledSync: erro na sincronização agendada.", err);
    // Não relançar — o scheduler do Firebase registrará falha mas não reenfileira automaticamente
  }
});
```

### 7.3 `functions/src/index.ts`

```ts
// functions/src/index.ts

export { syncTeams } from "./functions/syncTeams";
export { scheduledSync } from "./functions/scheduledSync";
```

---

## 8. Variáveis de ambiente e segredos

### 8.1 Variáveis obrigatórias

| Variável | Onde configurar | Visibilidade | Descrição |
|---|---|---|---|
| `API_FOOTBALL_KEY` | Firebase Secret Manager (produção) / `.env` local (dev) | **Server-side apenas** | Chave de acesso à API-Football |
| `API_FOOTBALL_USE_MOCK` | `.env` local (dev) | Server-side | Se `"true"`, força uso do MockApiFootballClient mesmo com a chave configurada |
| `FIRESTORE_EMULATOR_HOST` | Setado automaticamente pelo emulador Firebase | Server-side | Redireciona Admin SDK para emulador local |

**`API_FOOTBALL_KEY` NUNCA deve ser prefixada com `NEXT_PUBLIC_`**, não deve aparecer em `src/` (app Next.js) e não deve ser commitada no repositório.

### 8.2 Configuração em produção

No Firebase Functions v2, variáveis secretas são gerenciadas via **Secret Manager do Google Cloud**:

```bash
# Configurar o segredo (executar uma vez)
firebase functions:secrets:set API_FOOTBALL_KEY

# Referenciar no código (v2)
import { defineSecret } from "firebase-functions/params";
const apiKey = defineSecret("API_FOOTBALL_KEY");
```

Para esta task (esqueleto), usar `process.env.API_FOOTBALL_KEY` diretamente — o wiring completo com `defineSecret` pode ser feito na TASK-10 (deploy). Documentar a intenção em comentário no código.

### 8.3 Configuração para desenvolvimento local

Criar `functions/.env` (não commitado):

```
API_FOOTBALL_KEY=sua_chave_aqui
# ou, para forçar mock:
API_FOOTBALL_USE_MOCK=true
```

Criar `functions/.env.example` (commitado, sem valores reais):

```
# Chave de acesso à API-Football (https://www.api-football.com/)
# Nunca commitar a chave real. Configurar via Firebase Secret Manager em produção.
API_FOOTBALL_KEY=

# Forçar uso do mock client (sem chamadas reais à API)
# Útil durante desenvolvimento enquanto fixtures da Copa 2026 não existem.
API_FOOTBALL_USE_MOCK=true
```

### 8.4 Estratégia de quotas — resumo

A API-Football free tier tem cota de ~100 requisições/dia. Estratégia desta implementação:

1. **Dados estáticos** (`teams`, `groups`): sincronizar sob demanda via `syncTeams` callable — admin aciona manualmente antes da Copa e quando necessário. 1 chamada à API por sync.
2. **Dados semi-estáticos** (`matches` — calendário, sedes): sincronizar via `scheduledSync` diário às 02:00. Baixa frequência; poucos updates esperados.
3. **Dados dinâmicos** (resultados, placares em tempo real): `scheduledSync` atualiza diariamente às 02:00. Para a Copa 2026 com <100 usuários, resultado diário é suficiente.
4. **Cache em Firestore**: o Firestore serve como cache persistente — o frontend lê do Firestore, nunca da API diretamente.
5. **Fallback para mock**: se `API_FOOTBALL_KEY` não estiver configurada (desenvolvimento, CI), `getApiFootballClient()` retorna o mock automaticamente.

---

## 9. Configuração do subprojeto `functions/`

### 9.1 `functions/package.json`

```json
{
  "name": "bolao-dos-parcas-functions",
  "version": "1.0.0",
  "engines": { "node": "18" },
  "main": "lib/index.js",
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^4.9.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "zod": "^4.0.0"
  }
}
```

> **Nota sobre Zod:** o subprojeto precisa do Zod para os schemas compartilhados usados nos mappers. Adicionar como `devDependency` (só usado em build/testes dos mappers; o output do mapper é um objeto plain que é gravado no Firestore). Se a validação Zod precisar rodar em tempo de execução nas Functions (ex.: validate antes de gravar), mover para `dependencies`.

### 9.2 `functions/tsconfig.json`

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "target": "ES2020",
    "lib": ["ES2020"],
    "outDir": "lib",
    "rootDir": "src",
    "strict": true,
    "noImplicitAny": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "lib", "**/*.test.ts", "**/__tests__/**"]
}
```

> Excluir arquivos de teste do `tsc` de produção (eles são rodados pelo Vitest, não pelo `tsc`).

### 9.3 `functions/vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
  },
  resolve: {
    alias: {
      // Mapear schemas compartilhados para o diretório functions/src/shared
      "#shared": resolve(__dirname, "src/shared"),
    },
  },
});
```

### 9.4 Build independente

O `package.json` da raiz (Next.js) **não inclui** `cd functions && npm run build` no script `build`. A compilação das Functions é executada separadamente:

```bash
# build do app Next.js (não altera)
npm run build

# build das Functions (subprojeto independente)
cd functions && npm run build
```

O CI pode rodar ambos em etapas separadas. A TASK-10 configurará o deploy pipeline.

---

## 10. Plano de TDD

### 10.1 Alvo principal: funções de mapper

As funções de mapper são o alvo primário do TDD porque são puras, testáveis sem dependências externas e de alto risco (dados incorretos no Firestore causam problemas em cascata no frontend).

### 10.2 Fixtures de teste (dados de entrada)

Criar em `functions/src/__tests__/fixtures/` (ou inline nos testes):

**`apiTeamFixtures.ts`** — array de `TeamResponse` com pelo menos:
- Seleção com todos os campos preenchidos (`name`, `code`, `logo`, `group`)
- Seleção sem `groupId` (fase eliminatória)
- Seleção com `code` inválido (3+ caracteres — para testar rejeição pelo schema)

**`apiFixtureFixtures.ts`** — array de `FixtureResponse` com pelo menos:
- Partida `status.short = "NS"` (não iniciada), placares null
- Partida `status.short = "FT"` (finalizada), placares inteiros
- Partida `status.short = "1H"` (ao vivo)
- Partida com `league.round` mapeável (`"Group Stage - 1"`)
- Partida com `league.round` desconhecido (para testar comportamento de fallback)

### 10.3 Casos de teste obrigatórios

#### `teamMapper.test.ts`

| # | Cenário | Entrada | Esperado |
|---|---|---|---|
| T1 | Mapeamento completo válido | TeamResponse com todos os campos | `teamSchema.parse()` não lança; campos corretos |
| T2 | `groupId` injetado como parâmetro | TeamResponse sem `group`, `groupId = "A"` | `mapped.groupId === "A"` |
| T3 | `groupId` da resposta da API quando parâmetro ausente | TeamResponse com `group = "B"` | `mapped.groupId === "B"` |
| T4 | `flagUrl` ausente/vazia → campo omitido | `logo = ""` | `mapped.flagUrl === undefined` |
| T5 | `code` inválido da API → ZodError | `code = "BRAZ"` (4 chars) | `teamSchema.parse()` lança ZodError |
| T6 | `name` vazio → ZodError | `name = ""` | `teamSchema.parse()` lança ZodError |

#### `matchMapper.test.ts`

| # | Cenário | Entrada | Esperado |
|---|---|---|---|
| M1 | Partida agendada | `status.short = "NS"`, goals null | `status: "scheduled"`, `homeScore: null`, `awayScore: null` |
| M2 | Partida finalizada | `status.short = "FT"`, goals `{home: 2, away: 1}` | `status: "finished"`, placares corretos |
| M3 | Partida ao vivo | `status.short = "1H"` | `status: "live"`, placares null (ainda) |
| M4 | Round "Group Stage" → stage "grupos" | `round = "Group Stage - 1"` | `stage: "grupos"` |
| M5 | Round "Round of 16" → stage "oitavas" | `round = "Round of 16"` | `stage: "oitavas"` |
| M6 | Round desconhecido → lança erro | `round = "???"` | lança `Error` com mensagem informativa |
| M7 | `homeTeamId` não encontrado em `teamIdMap` | id ausente no map | lança `Error` com id ausente |
| M8 | Output satisfaz `matchSchema` em partida finalizada | FT válida | `matchSchema.safeParse(output).success === true` |
| M9 | Output satisfaz `matchSchema` em partida agendada | NS válida | `matchSchema.safeParse(output).success === true` |

#### `client.mock.test.ts`

| # | Cenário | Esperado |
|---|---|---|
| C1 | `MockApiFootballClient.getTeamsByTournament()` retorna array de `TeamResponse` | `Array.isArray(result)` e `result.length > 0` |
| C2 | `MockApiFootballClient.getFixtures()` retorna array de `FixtureResponse` | idem |
| C3 | `getApiFootballClient()` sem `API_FOOTBALL_KEY` retorna mock | `instanceof MockApiFootballClient` ou comportamento equivalente |
| C4 | Dados do mock satisfazem os tipos `TeamResponse`/`FixtureResponse` (compile-time) | TypeScript não reclama na compilação |

### 10.4 Disciplina TDD

Escrever os testes T1–T6 e M1–M9 **antes** de implementar os mappers (red → green). Sequência recomendada:

1. Criar os fixtures de teste.
2. Escrever `teamMapper.test.ts` (T1–T6) — red.
3. Implementar `mapApiTeamToFirestore` até todos verdes.
4. Escrever `matchMapper.test.ts` (M1–M9) — red.
5. Implementar `mapApiFixtureToFirestore` + auxiliares até todos verdes.
6. Escrever `client.mock.test.ts` — estes devem ser verdes trivialmente após implementar o mock.

---

## 11. `firestore/writer.ts` — helpers de escrita

```ts
// functions/src/firestore/writer.ts

import { getFirestore } from "firebase-admin/firestore";
import type { MappedTeam } from "../mappers/teamMapper";

interface DocToWrite<T> {
  id: string;
  data: T;
}

export async function writeTeams(teams: DocToWrite<MappedTeam>[]): Promise<void> {
  const db = getFirestore();
  const batch = db.batch();

  for (const { id, data } of teams) {
    const ref = db.collection("teams").doc(id);
    batch.set(ref, data); // set() = idempotente (sobrescreve)
  }

  await batch.commit();
}

// Padrão idêntico para writeMatches, writeGroups (a adicionar conforme necessário)
```

> `batch.set()` é idempotente: documentos existentes são sobrescritos com os novos dados. Para updates parciais (ex.: só atualizar placar de uma partida já existente), usar `batch.update()` — implementar na function de resultados (stub na TASK-09, completo em PRD futuro).

---

## 12. Integração com `firebase.json` e emulador

O `firebase.json` atual configura o emulador de Functions na porta **5001**. Verificar se já referencia o diretório `functions/` corretamente:

```json
{
  "functions": {
    "source": "functions"
  }
}
```

Se a chave `"functions"` não existir no `firebase.json`, adicionar. Se já existir de outra forma, ajustar apenas `"source": "functions"` sem quebrar as demais configurações (Firestore rules, emuladores).

Para rodar as Functions no emulador local:

```bash
# Da raiz do projeto
firebase emulators:start --only functions,firestore

# Ou (se quiser UI)
firebase emulators:start
```

O emulador injeta automaticamente `FIRESTORE_EMULATOR_HOST` para o Admin SDK, redirecionando escritas para o Firestore emulado.

---

## 13. Critérios de aceite e verificação

### 13.1 Checklist de entregáveis

- [ ] Diretório `functions/` existe com `package.json`, `tsconfig.json`, `vitest.config.ts`, `.env.example`.
- [ ] `functions/src/apiFootball/client.ts` exporta interface `ApiFootballClient` + classe `HttpApiFootballClient` com tratamento de quota/timeout/auth.
- [ ] `functions/src/apiFootball/mock.ts` exporta `MockApiFootballClient` implementando `ApiFootballClient` com dados fictícios.
- [ ] `functions/src/apiFootball/factory.ts` exporta `getApiFootballClient()` que usa o mock quando `API_FOOTBALL_KEY` está ausente.
- [ ] `functions/src/apiFootball/config.ts` tem `COPA_2026_CONFIG` com placeholder documentado (R2).
- [ ] `functions/src/mappers/teamMapper.ts` exporta `mapApiTeamToFirestore` com output validado por `teamSchema`.
- [ ] `functions/src/mappers/matchMapper.ts` exporta `mapApiFixtureToFirestore` com auxiliares `mapRoundToStage` e `mapApiStatusToMatchStatus`.
- [ ] `functions/src/index.ts` exporta `syncTeams` (callable) e `scheduledSync` (scheduled cron `0 2 * * *`).
- [ ] `functions/src/shared/schemas.ts` reexporta `teamSchema` e `matchSchema` dos schemas do app (Abordagem A — D11).
- [ ] Suíte Vitest em `functions/src/__tests__/` cobre T1–T6, M1–M9 e C1–C4.
- [ ] Sem `any` em todo o código TypeScript de `functions/`.
- [ ] `API_FOOTBALL_KEY` não aparece em `src/` (app Next.js) e não está hardcodada.

### 13.2 Comandos de verificação

```bash
# Dentro de functions/
npm run build          # tsc compila sem erros
npm run test           # vitest run → todas as suítes verdes
npm run lint           # 0 erros

# Na raiz do projeto Next.js (verificar que as Functions não quebraram nada)
npm run build          # next build → sucesso (não deve tocar functions/)
npm run typecheck      # tsc --noEmit na raiz → 0 erros
```

> Com RTK: `rtk tsc`, `rtk vitest run`, `rtk lint`, `rtk next build`.

### 13.3 Verificação manual do emulador

```bash
# Sobe emuladores
firebase emulators:start --only functions,firestore

# Em outro terminal — chamar a função syncTeams via HTTP (emulador Functions)
curl -X POST http://127.0.0.1:5001/<project-id>/us-central1/syncTeams \
  -H "Content-Type: application/json" \
  -d '{"data":{}}'
# Esperado: {"result":{"synced": <N>}} onde N é o número de times do mock
```

Se `API_FOOTBALL_KEY` não estiver configurada, o mock é usado e a chamada deve retornar dados fictícios gravados no emulador do Firestore.

---

## 14. Riscos e mitigações

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| **R2** | **IDs Copa 2026 não disponíveis na API-Football** | **Alta** | `COPA_2026_CONFIG` como placeholder documentado (§6.3); `MockApiFootballClient` permite desenvolvimento completo sem fixtures reais; task funciona sem credenciais |
| R1 | Quota diária da API-Football esgotada | Alta | Estratégia cache-first em Firestore (§8.4); sync sob demanda + scheduler diário; fallback para mock |
| R2b | `teamSchema` usa `.strict()` e a API-Football retorna campos extras | Média | A interface `TeamResponse` extrai apenas os campos usados; `mapApiTeamToFirestore` constrói o objeto destino explicitamente — campos extras da API nunca chegam ao `parse()` |
| R3 | `tsc` das Functions conflitar com `tsc` da raiz | Média | `tsconfig.json` de `functions/` é independente; `"exclude"` na raiz não inclui `functions/`; build scripts separados |
| R4 | `matchSchema` com refinement placar×status rejeitar output do mapper | Média | Testes M8/M9 cobrem explicitamente este refinement; mapper deve construir objeto compatível |
| R5 | Admin SDK inicializado múltiplas vezes (Cold start Functions) | Baixa | Singleton em `functions/src/firebase/admin.ts` com `getApps().length === 0` guard |
| R6 | Credencial `service account` exposta em código | Alta | Admin SDK sem credenciais explícitas (runtime injeta em produção); emulador usa `FIRESTORE_EMULATOR_HOST`; `.env` no `.gitignore` |
| R7 | `mapRoundToStage` sem cobertura para rounds não previstos | Média | Lançar erro explícito com mensagem (M6 cobre); fácil de estender com novos rounds |

---

## 15. Suposições

| # | Suposição |
|---|---|
| A1 | Firebase Functions v2 é suportado pelo plano Firebase do projeto (Blaze/pay-as-you-go exigido para Functions) |
| A2 | Node.js 18 LTS está disponível no ambiente de desenvolvimento |
| A3 | A chave da API-Football (plano free ou pago) será fornecida pelo administrador quando disponível; desenvolvimento segue com mock |
| A4 | Os IDs de torneio da Copa 2026 na API-Football seguirão o padrão histórico (`leagueId = 1`); a confirmar quando disponível |
| A5 | `teamSchema` e `matchSchema` de TASK-07 são a fonte de verdade e não serão alterados substancialmente antes da implementação desta task; qualquer alteração nos schemas exige atualização dos mappers |
| A6 | A autenticação na função callable `syncTeams` (verificar se o chamador é admin) será adicionada em PRD futuro, quando custom claims estiverem configurados (apontado em TASK-08 §9.4); o stub não tem auth guard |
| A7 | O scheduler cron `0 2 * * *` usa UTC; ajuste de fuso pode ser necessário dependendo da localização do time |
| A8 | `firebase.json` já existe na raiz (criado em TASK-05); esta task apenas acrescenta/verifica a chave `"functions"` |
| A9 | O subprojeto `functions/` não usa alias `@/` (restrito ao app Next.js); caminhos relativos ou alias `#shared` são usados internamente |

---

## 16. Notas para as próximas tarefas

- **TASK-10** (hosting/deploy): configurar o pipeline de deploy das Functions (`firebase deploy --only functions`), incluindo o wiring correto de `defineSecret("API_FOOTBALL_KEY")` para o Secret Manager em produção.
- **PRD futuro — sync completo**: implementar mapeamento e gravação de `matches`, `groups` e resultados em tempo real no `scheduledSync`, preenchendo o stub deixado nesta task.
- **PRD futuro — custom claims**: a function `syncTeams` deve verificar se o chamador tem `role: "admin"` via custom claims antes de executar o sync (hoje é stub sem guard).
- **PRD futuro — recálculo de rankings/estatísticas**: adicionar functions triggered por escrita em `matches` (quando `status` muda para `"finished"`) para recalcular `rankings` e `statistics` automaticamente.
- **Decisão D11 (schemas compartilhados)**: avaliar migração para monorepo (`packages/schemas/`) quando o número de schemas compartilhados crescer além de `teamSchema`/`matchSchema`.
