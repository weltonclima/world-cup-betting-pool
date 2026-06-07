# SPEC — TASK-05: Serviços client consumindo `/api/*`

> Plano: `ai/plan/integracao-api-football.md` (TASK-05) · Depende de TASK-04 (Route Handlers)
> Objetivo: reescrever `src/services/matches.ts` e `src/services/teams.ts` para
> consumir os Route Handlers `/api/*` via `fetch` + validação Zod no client,
> **substituindo** a leitura direta do Firestore — sem quebrar os hooks da Home.

## 1. Contexto

Pivô de arquitetura (PRD-07 v2.0): dados da Copa deixam o Firestore e passam a vir
da API-Football via servidor Next (Route Handlers → cache Next → API-Football). A
TASK-04 já expôs:

- `GET /api/matches` → `MatchWithId[]` (cada item com `id = String(fixture.id)`)
- `GET /api/matches/[id]` → `MatchWithId` (404 → `{ error }`)
- `GET /api/teams` → `TeamWithId[]` (cada item com `id = String(team.id)`)

Erros do servidor: corpo `{ error: string }` com status HTTP apropriado
(503 quota, 502 auth, 504 timeout, 500 contrato/genérico, 404 não encontrado).

`predictions`, `users`, `rankings`, `statistics`, `systemSettings` **permanecem
Firestore** — fora do escopo.

## 2. Assinaturas (mantidas + novas)

`src/services/matches.ts`:

| Função | Assinatura | Observação |
|---|---|---|
| `listMatches` | `(): Promise<MatchWithId[]>` | **nova** — `GET /api/matches` |
| `getMatchById` | `(id: string): Promise<MatchWithId \| null>` | **nova** — `GET /api/matches/:id`; 404→null |
| `getNextScheduledMatch` | `(): Promise<MatchWithId \| null>` | **mantida** (Home) — agora derivada |
| `getRecentFinishedMatches` | `(): Promise<MatchWithId[]>` | **mantida** (Home) — agora derivada |

`src/services/teams.ts`:

| Função | Assinatura | Observação |
|---|---|---|
| `listAllTeams` | `(): Promise<TeamWithId[]>` | **mantida** (Home / `useTeams`) — `GET /api/teams` |

Consumidores preservados: `src/features/home/hooks/{useNextMatch,useRecentResults,useTeams}.ts`
(importam de `@/services` e não mudam). Barrel `src/services/index.ts` mantém os
exports antigos e acrescenta `listMatches` / `getMatchById`.

## 3. Derivação client-side de next/recent

Para evitar endpoints extras (nota do plano), as duas funções da Home derivam de
`listMatches()`:

- `getNextScheduledMatch`: `filter(status === "scheduled")` → `sort(kickoffAt asc)`
  → primeiro (`[0] ?? null`).
- `getRecentFinishedMatches`: `filter(status === "finished")` → `sort(kickoffAt desc)`
  → `slice(0, 5)`.

Ordenação por `kickoffAt` usa `String.localeCompare` — válido porque `kickoffAt` é
ISO 8601 UTC (`isoDateTime`), lexicograficamente ordenável.

## 4. Validação Zod no client (sem `any`)

O servidor já valida, mas a camada client revalida (defesa em profundidade, não
confiar cegamente na rede). A resposta da rede inclui `id`, mas `matchSchema` e
`teamSchema` são `.strict()` (não conhecem `id`) e `matchSchema` tem um `.refine`
de placares.

**Decisão importante:** NÃO usar `z.intersection(schema, z.object({id}))` nem
`schema.and(...)`. Verificado empiricamente (Zod 4.4.3): a interseção **não
reaplica o `.refine`** do lado esquerdo — uma partida `finished` com placares
`null` passaria, abrindo buraco de validação. Em vez disso, valida-se em duas
etapas (split-parse), preservando o `matchSchema` intacto:

```ts
const idSchema = z.object({ id: z.string().min(1) });
function parseMatchWithId(input: unknown): MatchWithId {
  const { id } = idSchema.parse(input);                 // valida id
  const { id: _omit, ...rest } = input as Record<string, unknown>;
  return { id, ...matchSchema.parse(rest) };            // valida rest + refine
}
```

`idSchema.parse(input)` roda primeiro e garante que `input` é objeto antes do
spread. Arrays validados como `z.array(z.unknown())` e mapeados por
`parseMatchWithId` / `parseTeamWithId`. Tudo tipado como `unknown` antes do parse
(sem `any`).

## 5. Tratamento de erro / 404

- `res.ok === false` → lança `Error` com mensagem útil:
  `"<fallback> (HTTP <status>) — <detalhe>"`, onde `<detalhe>` vem de `{ error }`
  do corpo (tolera corpo não-JSON / vazio).
- `getMatchById`: `status === 404` → `null` **antes** de checar `ok`.
- Parse Zod falho → `ZodError` propaga (não é mascarado).
- next/recent propagam o erro de `listMatches`.

## 6. Base URL

Base relativa `"/api"`. Funciona no client (browser resolve contra a origem). Os
consumidores atuais (hooks da Home) são `"use client"`. **Risco/limitação:** se um
dia algum consumidor for server-side (RSC / Route Handler chamando estes serviços),
uma URL relativa não resolve em `fetch` no servidor — nesse caso usar diretamente
os helpers `src/app/api/_lib/apiFootballData.ts` (`fetchAllMatches`/`fetchAllTeams`)
em vez destes serviços client. Documentado; sem mudança necessária hoje.

## 7. Casos de teste (`fetch` global mockado)

`matches.test.ts`:
- `listMatches`: sucesso (array validado, URL correta), vazio, erro HTTP (status +
  detalhe), erro HTTP sem corpo JSON, item com status inválido (ZodError), item sem
  `id` (ZodError).
- `getMatchById`: sucesso (URL encodada), 404→null, outro erro HTTP, resposta fora
  do contrato (ZodError).
- `getNextScheduledMatch`: filtra+ordena+primeiro, null sem scheduled, propaga erro HTTP.
- `getRecentFinishedMatches`: filtra+ordena desc+limita 5, vazio sem finished, propaga erro HTTP.

`teams.test.ts`:
- `listAllTeams`: sucesso (URL correta), vazio, erro HTTP (status+detalhe), erro HTTP
  sem corpo JSON, código inválido (ZodError), item sem `id` (ZodError).

Mock: `const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock)`; helpers
`okJson` / `errorJson` simulam `Response` (`ok`, `status`, `json()`).

## 8. Fora do escopo / não tocar

`functions/**`, `src/server/**`, `src/app/api/**`, `src/features/**` (TASK-06
reaponta hooks), `next.config`, `firebase.json`, `middleware`, demais services
(predictions/users/rankings/statistics/systemSettings).
