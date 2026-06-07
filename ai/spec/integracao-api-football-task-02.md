# SPEC — TASK-02 · Mover mappers p/ `src/server/mappers` + corrigir schema drift

> Origem: `ai/plan/integracao-api-football.md` §3 TASK-02 · PRD: `ai/prd/integracao-api-football.md`
> Tipo: domain · SP: 5 · Criticality: critical · Risk: medium · TDD: yes · Screen: no
> Depende de: TASK-01 (`src/server/apiFootball/{client,types,mock,factory,config,index}.ts`)

## 1. Objetivo

Mover os mappers puros (`matchMapper`, `teamMapper`) de `functions/src/mappers/` para
`src/server/mappers/`, usando **`@/schemas` como fonte única de verdade** (não a cópia
`functions/src/shared/schemas.ts`), e **corrigir o drift** entre o que os mappers produziam
e o que o schema do front (`matchSchema`/`teamSchema`, ambos `.strict()`) exige hoje:

- `stage` "terceiro" (disputa de 3º lugar) — round `"3rd Place Final"`.
- `venue` (`{ name, city }`, nullable/optional) — origem `fixture.venue`.
- `round` (número da rodada, int≥1, nullable/optional) — origem `league.round`.
- `groupId` (nullable/optional) — derivado do grupo do time mandante na fase de grupos.

Os originais em `functions/**` permanecem intactos (removidos só na TASK-11). Esta task
**copia + corrige**, não move fisicamente.

## 2. Arquivos criados / estendidos

| Arquivo | Ação |
|---|---|
| `src/server/mappers/matchMapper.ts` | Novo — importa de `@/schemas`; adiciona venue/round/groupId/terceiro |
| `src/server/mappers/teamMapper.ts` | Novo — importa de `@/schemas`; `flagUrl` via `z.url()` |
| `src/server/mappers/__tests__/matchMapper.test.ts` | Novo — cobertura completa (TDD) |
| `src/server/mappers/__tests__/teamMapper.test.ts` | Novo — cobertura completa (TDD) |
| `src/server/mappers/__tests__/fixtures/apiFixtureFixtures.ts` | Novo — fixtures de partida (venue/round/group/terceiro) |
| `src/server/mappers/__tests__/fixtures/apiTeamFixtures.ts` | Novo — fixtures de seleção |
| `src/server/apiFootball/types.ts` | Estendido — `FixtureInfo.venue`, `FixtureInfo.status.long?` opcional |
| `src/server/apiFootball/mock.ts` | Estendido — dataset mais rico (venue, 3º lugar, grupos) |

## 3. Decisões de mapeamento (drift)

### 3.1 `venue` (A: estádio)

- Tipo do front: `venue?: { name, city } | null` com `name`/`city` = `nonEmptyString`, `.strict()`.
- Origem: `fixture.venue` da API-Football (`{ id, name, city }`).
- Regra: se `venue` ausente **ou** `name`/`city` ausentes/vazios (TBD em jogos não confirmados),
  o mapper emite `venue: null`. Só monta o objeto quando **ambos** `name` e `city` são strings não vazias.
  Isso evita violar o `.strict()` (que rejeita `name: ""`).
- Tipo na API (`types.ts`): `fixture.venue?: { name: string | null; city: string | null } | null`
  (a API frequentemente devolve `name`/`city` `null` para sedes ainda não definidas).

### 3.2 `round` (número da rodada)

- Tipo do front: `round?: number | null`, `z.int().min(1)`.
- Origem: `league.round` (string), ex.: `"Group Stage - 2"`, `"Round of 16"`.
- Regra: extrai o **último inteiro** presente na string via regex `/(\d+)/g` (o último número é
  o número da rodada — `"Group Stage - 2"` → 2). Se não houver número (`"Round of 16"` tem "16"
  no texto mas representa a fase, não a rodada → ver nota), retorna `null`.
- **Nota / cuidado:** `"Round of 16"` contém "16", que NÃO é número de rodada. Para evitar
  falso-positivo, o `round` numérico só é extraído quando o round é da **fase de grupos**
  (`mapRoundToStage(...) === "grupos"`); nas fases eliminatórias (mata-mata) não existe "rodada",
  então `round = null`. Decisão: numeração de rodada só faz sentido na fase de grupos.

### 3.3 `groupId` (A1 — resolução)

- Tipo do front: `groupId?: string | null`, `nonEmptyString`.
- A API-Football **não** entrega o grupo dentro da `FixtureResponse` de forma confiável (vem do
  endpoint `/standings`, não de `/fixtures`). Decisão (A1 do PRD/plano): o grupo é **derivado do
  time mandante** via um mapa `teamGroupMap: Record<number, string | undefined>` (API id → grupo),
  passado pelo Route Handler (TASK-04), que combina `/standings` + `/teams` (A1 do plano: "grupo
  derivável de teams").
- Regra:
  - Se `stage === "grupos"`: `groupId = teamGroupMap[homeApiId] ?? null`. (Em grupos, mandante e
    visitante estão no mesmo grupo; usa-se o mandante como fonte canônica.)
  - Se `stage !== "grupos"` (mata-mata): `groupId = null` (não há grupo).
- `teamGroupMap` é **opcional** no mapper (default `{}`): sem ele, jogos de grupo ficam
  `groupId: null` (degradação graciosa; não quebra).

### 3.4 `terceiro` (3º lugar)

- `ROUND_TO_STAGE_MAP` ganha `"3rd Place Final" → "terceiro"`. `"Semi-finals" → "semifinal"`
  já existia. `stageSchema` do front já inclui `"terceiro"`.

### 3.5 `STATUS_MAP`

- Mantido idêntico ao original (já cobre NS/TBD/1H/HT/2H/ET/P/BT/LIVE/FT/AET/PEN/AWD/WO/PST/CANC/SUSP/INT/ABD).
- Status desconhecido → `console.warn` + fallback `"scheduled"` (regra WR-03 preservada).

### 3.6 Placar × status

- Inalterado: placar (`homeScore`/`awayScore`) só é gravado quando `status === "finished"`; caso
  contrário `null`. O `refine` do `matchSchema` valida isso.

### 3.7 `teamMapper.flagUrl`

- Front: `flagUrl: z.url().optional()`. Logo vazia/ausente → `undefined` (omitido). Logo inválida
  (não-URL) → `ZodError`. Mantida a regra do original.

## 4. Tipos derivados

```ts
type MappedMatch = z.infer<typeof matchSchema>;  // de @/schemas
type MappedTeam  = z.infer<typeof teamSchema>;
type Stage       = z.infer<typeof stageSchema>;
type MatchStatus = z.infer<typeof matchStatusSchema>;
```

## 5. Casos de teste (TDD)

### matchMapper

| ID | Caso | Esperado |
|---|---|---|
| M1 | NS (agendada) | status `scheduled`, placares `null` |
| M2 | FT (finalizada) | status `finished`, placares corretos |
| M3 | 1H (ao vivo) | status `live` |
| M4 | `"Group Stage - 1"` | stage `grupos` |
| M5 | `"Round of 16"` | stage `oitavas` |
| M6 | `"Quarter-finals"` | stage `quartas` |
| M7 | `"Semi-finals"` | stage `semifinal` |
| M8 | `"3rd Place Final"` | stage `terceiro` |
| M9 | `"Final"` | stage `final` |
| M10 | round desconhecido | lança erro `/não reconhecido/i` |
| M11 | homeTeamId ausente no map | lança erro com o id |
| M12 | venue presente | `venue = { name, city }` |
| M13 | venue ausente / TBD | `venue = null` |
| M14 | round número (grupos `"- 2"`) | `round = 2` |
| M15 | round sem número (mata-mata) | `round = null` |
| M16 | groupId em grupos (com map) | `groupId` = grupo do mandante |
| M17 | groupId fora de grupos | `groupId = null` |
| M18 | placar só quando finished (live com gols null) | placares `null` |
| M19 | output satisfaz `matchSchema` | parse `success` |
| status map | todos os shorts | mapeamento correto + warn em desconhecido |

### teamMapper

| ID | Caso | Esperado |
|---|---|---|
| T1 | completo | name/code/flagUrl/groupId |
| T2 | groupId param prevalece | usa param |
| T3 | groupId da API quando sem param | usa `raw.group` |
| T4 | logo vazia | `flagUrl` undefined |
| T5 | code inválido (4 chars) | `ZodError` |
| T6 | name vazio | `ZodError` |
| T7 | logo inválida (não-URL) | `ZodError` (regra `z.url()` do front) |

## 6. Restrições do projeto

- TS strict, **sem `any`**. Alias `@/` (tsconfig + vitest).
- Output validado por `matchSchema`/`teamSchema` (`.strict()` — shape exato).
- Sem hardcode de dados de domínio fora de `mock.ts`/`config.ts`.
- Funções puras (sem I/O, sem Firebase).

## 7. Verificação

- `npx vitest run src/server --reporter=json --outputFile=.vt2.json` → ler JSON, `numFailedTests: 0`.
- `npx tsc --noEmit` → exit 0 (erros da mudança corrigidos).

## 8. Fora de escopo / não tocado

- `functions/**` (originais intactos até TASK-11).
- `src/services/**`, `src/features/**`, `src/app/**`, `next.config`, `firebase.json`.
- `src/server/cache/**`, `src/server/apiFootball/{client,factory,config,index}.ts`.
- Route Handlers que montam `teamGroupMap` (TASK-04).

## 9. Riscos

1. **`round` ambíguo** (`"Round of 16"` contém "16"): mitigado restringindo extração numérica à
   fase de grupos. Se a API mudar o formato de `league.round`, revisar a regex/regra.
2. **`groupId` depende de `teamGroupMap`** que a fixture não fornece: sem o map (TASK-04), jogos de
   grupo ficam `groupId: null`. Degradação graciosa, mas a Home/Jogos só terão grupo após TASK-04
   montar o map a partir de `/standings`.
3. **Drift duplicado** functions↔src até TASK-11: mudanças nesta camada precisam ser refletidas nos
   dois lugares no curto intervalo. Aceito pelo plano.
4. **venue `.strict()`**: API pode devolver `name`/`city` `null` → mapper degrada para `venue: null`
   (nunca monta objeto parcial que violaria o schema).
