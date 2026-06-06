# SPEC — TASK-07: Modelo de dados Firestore (tipos + schemas Zod)

> Entrada: `ai/plan/feature.md` (TASK-07) + `ai/prd/feature.md` + `.claude/CLAUDE.md` (coleções, schema `users`, pontuação, rankings, estatísticas, fases).
> Tipo: `persistence` · Criticidade: `high` · Risco técnico: `low` · Story points: 3.
> TDD: **sim** · Screen: não · Dependências: **TASK-04** (estrutura/barrels) — Wave 3.

---

## 1. Objetivo

Definir o **contrato de dados** das **9 coleções Firestore** do Bolão dos Parças como **schemas Zod** em `src/schemas/`, e derivar os **tipos TypeScript** correspondentes via **`z.infer`** em `src/types/`. Os schemas Zod são a **fonte única de verdade**: não existe tipo TS escrito à mão duplicando um schema. O parsing/validação (refinements, enums, e-mail, inteiros ≥ 0) é exercitado por **TDD**.

Coleções: `users`, `teams`, `groups`, `matches`, `predictions`, `rankings`, `statistics`, `bonus_predictions`, `system_settings`.

### Truths que devem ser verdadeiras ao fim
- Cada uma das 9 coleções tem um schema Zod exportado em `src/schemas/<colecao>.ts`.
- Enums compartilhados (`Role`, `UserStatus`, `Stage`, e auxiliares) vivem em **um arquivo dedicado** `src/schemas/shared.ts` e são reusados (sem redefinição).
- Cada tipo TS em `src/types/` é **derivado** do schema via `z.infer` (zero duplicação manual).
- Refinements aplicados: e-mail válido, placares inteiros **≥ 0**, percentuais 0–100, enums restritos, strings não vazias onde aplicável.
- `npm run typecheck`, `npm run lint` e `npm run build` permanecem **verdes**.
- Testes (Vitest) cobrem: parse válido, rejeição por enum/refinement inválido, e correção da inferência de tipos.
- **Zero** `any`, **zero** estilo inline, **zero** lógica de negócio (só contrato de dados + validação).

---

## 2. Escopo

### Dentro do escopo
- `src/schemas/shared.ts`: enums e primitivos reutilizáveis (`roleSchema`, `userStatusSchema`, `stageSchema`, `matchStatusSchema`, `positiveScoreSchema`, etc.).
- `src/schemas/<colecao>.ts` para cada uma das 9 coleções (schema Zod do documento).
- `src/schemas/index.ts`: barrel reexportando todos os schemas + shared.
- `src/types/<colecao>.ts` para cada coleção: `export type X = z.infer<typeof xSchema>`.
- `src/types/index.ts`: barrel reexportando todos os tipos.
- Suíte de testes Vitest por schema em `src/schemas/__tests__/` (ou `*.test.ts` colocalizado — ver §6).

### Fora do escopo (tarefas posteriores)
- Funções de leitura/escrita no Firestore (`services/`) → PRD-01+.
- Conversores Firestore (`FirestoreDataConverter`) → opcional, fora desta task (decisão D9).
- Security Rules → **TASK-08** (consome os formatos aqui definidos).
- Mapeamento API-Football → schema → **TASK-09**.
- Lógica de cálculo de pontuação/ranking/estatística → features de PRD futuros (aqui só **forma** dos dados, não cálculo).
- Instalação do Vitest **não é entregue como código** desta spec, mas é **pré-requisito do passo de implementação/TDD** (ver §7).

> Não alterar `tsconfig.json`, `next.config.ts`, configs de Tailwind/ESLint. Esta task adiciona arquivos em `src/schemas/`, `src/types/` e testes, e ajusta `package.json`/config de teste **somente** para habilitar Vitest no passo de implementação.

---

## 3. Decisões técnicas

### 3.1 Versão do Zod — **Zod 4** (instalado: `zod@4.4.3`)
O projeto usa **Zod 4**. A API difere do Zod 3 em pontos que esta spec usa diretamente:

| Necessidade | Zod 4 (usar) | Zod 3 (NÃO usar) |
|---|---|---|
| Validar e-mail | `z.email()` | ~~`z.string().email()`~~ (deprecado no v4) |
| Data ISO | `z.iso.datetime()` | `z.string().datetime()` |
| Enum a partir de array | `z.enum([...] as const)` | idem |
| Inteiro | `z.int()` ou `z.number().int()` | `z.number().int()` |

> **Decisão D1:** usar a API do Zod 4. Preferir `z.email()`, `z.int()`, `z.iso.datetime()`. Onde a forma v3 ainda funcionar e for mais legível, é aceitável, mas **e-mail deve usar `z.email()`** (a forma `.string().email()` emite deprecation no v4).

### 3.2 Fonte única de verdade — tipos derivados
**Decisão D2:** nenhum `interface`/`type` manual descreve a forma de um documento. Todo tipo vem de `z.infer<typeof schema>`. Os arquivos em `src/types/` **apenas** reexportam tipos inferidos — não contêm schema nem campos literais.

```ts
// src/types/users.ts
import type { z } from "zod";
import type { userSchema } from "@/schemas/users";

export type User = z.infer<typeof userSchema>;
```

### 3.3 Enums compartilhados em arquivo dedicado
**Decisão D3:** `src/schemas/shared.ts` concentra os enums e primitivos reusados por mais de uma coleção, evitando divergência:
- `roleSchema = z.enum(["user", "admin"])` → `Role`
- `userStatusSchema = z.enum(["pending", "approved", "blocked"])` → `UserStatus`
- `stageSchema = z.enum(["grupos", "oitavas", "quartas", "semifinal", "final"])` → `Stage`
- `rankingScopeSchema = z.enum(["geral", "grupos", "oitavas", "quartas", "semifinal", "final"])` → `RankingScope` (é `Stage` + `"geral"`; rankings existem por fase **e** Geral — ver `.claude/CLAUDE.md` › Rankings)
- `matchStatusSchema = z.enum(["scheduled", "live", "finished", "postponed", "canceled"])` → `MatchStatus`
- Primitivos: `nonEmptyString = z.string().min(1)`, `scoreSchema = z.int().min(0)` (placar inteiro ≥ 0), `percentageSchema = z.number().min(0).max(100)`.

> **D3a (valores dos enums):** valores **em inglês, minúsculos, slug** (`"grupos"`, `"oitavas"`, …) para chave de armazenamento estável; rótulos pt-BR de exibição ficam fora desta task (camada de UI). **Assumido** — não há valores canônicos no PRD. As fases seguem `.claude/CLAUDE.md` › Rankings/Estatísticas (Grupos, Oitavas, Quartas, Semifinal, Final).

### 3.4 Campo `id` do documento vs. dados
**Decisão D4:** o **id do documento** (`doc.id`) **não** é redundado dentro do payload, exceto quando o domínio o exige como chave natural conhecida pelo cliente:
- `users`: mantém `uid` (= id do doc; é a chave do Firebase Auth, usada em queries e regras). **Assumido**: `users/{uid}`.
- Demais coleções: schema descreve o **conteúdo** do documento; o id fica implícito no path. Onde uma coleção referencia outra, usa-se um campo de **id de referência** explícito (ex.: `predictions.matchId`, `predictions.uid`).

> Isso mantém os schemas válidos tanto na escrita (sem exigir reescrever o id) quanto na leitura (id vem de `snapshot.id`). Helpers de "doc + id" ficam para `services/` (fora do escopo).

### 3.5 Timestamps
**Decisão D5:** datas/horas modeladas como **string ISO 8601** via `z.iso.datetime()` (ex.: `matches.kickoffAt`, `createdAt`, `updatedAt`). Justificativa: schemas Zod são isomórficos e testáveis sem depender do tipo `Timestamp` do Firestore; a conversão `Timestamp ↔ ISO` é responsabilidade da camada `services/` (TASK posterior). **Assumido** — PRD não especifica formato. Campos de auditoria `createdAt`/`updatedAt` são **opcionais** nos schemas (nem todo doc os terá no MVP).

### 3.6 Campos não especificados → assumidos e marcados
Vários campos abaixo não constam do PRD. São **decisões de engenharia** marcadas como **(assumido)**. Critério: incluir o mínimo necessário para as features do MVP (jogos, palpites, ranking por fase, estatísticas, bônus) sem inventar regra de negócio.

### 3.7 Estrita-por-padrão / campos extras
**Decisão D6:** schemas são **estritos** (`.strict()`) por padrão para detectar campos inesperados nos testes e na escrita do cliente. Exceção: documentos que podem evoluir por dados externos (ex.: `teams`, `matches` enriquecidos pela API-Football em TASK-09) podem relaxar para `.strip()` **se** a TASK-09 exigir — não nesta task. Aqui: **`.strict()`** em todos.

### 3.8 Sem `any`
**Decisão D7:** nenhuma anotação `any`. Inferência sempre via `z.infer`. Em testes, usar `unknown` + parse, nunca `any`.

### 3.9 Nomenclatura
**Decisão D8:**
- Schema: `camelCase` + sufixo `Schema` → `userSchema`, `matchSchema`, `bonusPredictionSchema`.
- Tipo: `PascalCase`, singular → `User`, `Match`, `BonusPrediction`.
- Arquivo de schema: nome **da coleção** (`users.ts`, `bonus_predictions.ts` → **`bonusPredictions.ts`** em camelCase de arquivo; ver D8a).
- Enum schema: `camelCase` + `Schema` (`stageSchema`); tipo do enum: `PascalCase` (`Stage`).

> **D8a (nome de arquivo):** coleção `bonus_predictions` e `system_settings` usam `snake_case` no Firestore, mas os **arquivos** seguem o padrão camelCase já usado no projeto → `bonusPredictions.ts` / `systemSettings.ts`. O **nome da coleção** (string usada no path/regras) permanece `snake_case` e será uma constante em TASK posterior (services). Não hardcodar o nome da coleção dentro do schema.

### 3.10 Conversores Firestore
**Decisão D9:** **não** criar `FirestoreDataConverter` nesta task. Os schemas serão consumidos por `services/` (parse na leitura/escrita) em PRD futuro. Aqui entregamos só schema + tipo + testes.

---

## 4. Definições dos schemas (por coleção)

> Notação: `z.email()` valida e-mail; `nonEmptyString` = `z.string().min(1)`; `scoreSchema` = `z.int().min(0)`; campos marcados **(assumido)** são decisões de engenharia (não constam do PRD). Todos os objetos terminam em `.strict()`.

### 4.0 `shared.ts` (enums e primitivos)
```ts
import { z } from "zod";

export const roleSchema = z.enum(["user", "admin"]);
export const userStatusSchema = z.enum(["pending", "approved", "blocked"]);
export const stageSchema = z.enum([
  "grupos",
  "oitavas",
  "quartas",
  "semifinal",
  "final",
]);
export const rankingScopeSchema = z.enum([
  "geral",
  "grupos",
  "oitavas",
  "quartas",
  "semifinal",
  "final",
]);
export const matchStatusSchema = z.enum([
  "scheduled",
  "live",
  "finished",
  "postponed",
  "canceled",
]);

export const nonEmptyString = z.string().min(1);
export const scoreSchema = z.int().min(0); // placar inteiro ≥ 0
export const percentageSchema = z.number().min(0).max(100);
export const isoDateTime = z.iso.datetime();
```
Tipos derivados em `src/types/shared.ts`: `Role`, `UserStatus`, `Stage`, `RankingScope`, `MatchStatus`.

### 4.1 `users`  (`users/{uid}`)
| Campo | Schema | Notas |
|---|---|---|
| `uid` | `nonEmptyString` | = id do doc (Firebase Auth) |
| `name` | `nonEmptyString` | nome completo |
| `nickname` | `nonEmptyString` | apelido exibido |
| `email` | `z.email()` | validação de e-mail |
| `role` | `roleSchema` | `user` \| `admin` |
| `status` | `userStatusSchema` | `pending` \| `approved` \| `blocked` |
| `createdAt` | `isoDateTime.optional()` | (assumido) auditoria |
| `updatedAt` | `isoDateTime.optional()` | (assumido) auditoria |

> Campos do PRD (`uid,name,nickname,email,role,status`) são **obrigatórios**; auditoria é opcional/assumida.

### 4.2 `teams`  (seleções)
| Campo | Schema | Notas |
|---|---|---|
| `name` | `nonEmptyString` | nome da seleção (assumido) |
| `code` | `z.string().length(3)` | (assumido) código FIFA de 3 letras (ex.: `BRA`) |
| `flagUrl` | `z.url().optional()` | (assumido) bandeira |
| `groupId` | `nonEmptyString.optional()` | (assumido) grupo na fase de grupos |

> Sem campos no PRD → todos **assumidos**, mínimos para listar/exibir seleções.

### 4.3 `groups`  (grupos da fase de grupos)
| Campo | Schema | Notas |
|---|---|---|
| `name` | `nonEmptyString` | (assumido) ex.: `A`..`L` |
| `teamIds` | `z.array(nonEmptyString)` | (assumido) ids das seleções do grupo |

> Standings (V/E/D, pontos) **fora do escopo** desta task (dado dinâmico calculado pela API-Football/TASK-09). Se necessário depois, estende-se `groups` ou cria subcoleção.

### 4.4 `matches`  (partidas)
| Campo | Schema | Notas |
|---|---|---|
| `homeTeamId` | `nonEmptyString` | seleção mandante |
| `awayTeamId` | `nonEmptyString` | seleção visitante |
| `kickoffAt` | `isoDateTime` | data/hora do jogo |
| `stage` | `stageSchema` | fase do torneio |
| `groupId` | `nonEmptyString.nullable().optional()` | (assumido) só na fase de grupos; `null` no mata-mata |
| `status` | `matchStatusSchema` | situação |
| `homeScore` | `scoreSchema.nullable()` | (assumido) `null` enquanto não finalizado |
| `awayScore` | `scoreSchema.nullable()` | (assumido) `null` enquanto não finalizado |

> **Refinement (assumido):** placares são `null` quando `status !== "finished"`; quando `status === "finished"`, ambos devem ser inteiros ≥ 0. Implementar via `.refine()` no objeto:
> `homeScore`/`awayScore` ambos `null` OU ambos `number` conforme `status`. Mensagem pt-BR. **Marcar como assumido** — PRD não define ciclo de vida do placar.

### 4.5 `predictions`  (palpites)
| Campo | Schema | Notas |
|---|---|---|
| `uid` | `nonEmptyString` | autor do palpite (referência `users.uid`) |
| `matchId` | `nonEmptyString` | partida alvo |
| `homeScore` | `scoreSchema` | placar previsto mandante (inteiro ≥ 0) |
| `awayScore` | `scoreSchema` | placar previsto visitante (inteiro ≥ 0) |
| `createdAt` | `isoDateTime.optional()` | (assumido) |
| `updatedAt` | `isoDateTime.optional()` | (assumido) |

> Pontuação binária (acertou placar exato → +1) é **calculada** em outra camada; o palpite só guarda a previsão. Unicidade `(uid, matchId)` é regra de **id do doc/Security Rules** (TASK-08), não validada aqui. **Assumido**: id do doc `predictions/{uid}_{matchId}` — fora do escopo do schema.

### 4.6 `rankings`  (rankings calculados)
Modelado como **documento por escopo** contendo as entradas ordenadas (cabe < 100 usuários por doc; otimizado para o porte do projeto). **(assumido)**.

| Campo | Schema | Notas |
|---|---|---|
| `scope` | `rankingScopeSchema` | `geral` ou uma das 5 fases |
| `updatedAt` | `isoDateTime` | quando foi recalculado |
| `entries` | `z.array(rankingEntrySchema)` | ranking ordenado |

`rankingEntrySchema` (objeto aninhado, `.strict()`):
| Campo | Schema | Notas |
|---|---|---|
| `uid` | `nonEmptyString` | usuário |
| `nickname` | `nonEmptyString` | (assumido) desnormalizado para exibição |
| `position` | `z.int().min(1)` | posição (assumido) |
| `points` | `z.int().min(0)` | total de acertos no escopo (binário) |

> **Assumido**: estrutura por escopo + `entries`. PRD lista apenas os escopos (Geral + 5 fases), não o layout. Alternativa (doc por usuário) registrada nas notas (§9).

### 4.7 `statistics`  (estatísticas por usuário)  (`statistics/{uid}`)
Reflete `.claude/CLAUDE.md` › Estatísticas por Usuário.
| Campo | Schema | Notas |
|---|---|---|
| `uid` | `nonEmptyString` | dono das estatísticas |
| `totalCorrect` | `z.int().min(0)` | total de acertos |
| `accuracy` | `percentageSchema` | aproveitamento (%) 0–100 |
| `longestStreak` | `z.int().min(0)` | maior sequência de acertos |
| `correctByStage` | `z.record(stageSchema, z.int().min(0))` | acertos por fase |
| `positionHistory` | `z.array(positionHistoryEntrySchema)` | histórico de posições no ranking |

`positionHistoryEntrySchema` (objeto aninhado, `.strict()`):
| Campo | Schema | Notas |
|---|---|---|
| `at` | `isoDateTime` | (assumido) momento do snapshot |
| `scope` | `rankingScopeSchema` | (assumido) qual ranking |
| `position` | `z.int().min(1)` | posição registrada |

> `z.record(stageSchema, …)`: chaves restritas às 5 fases. **Assumido**: `correctByStage` pode vir parcial (nem toda fase começou) → record com chaves opcionais é o comportamento natural; documentar no teste.

### 4.8 `bonus_predictions`  (palpites bônus)
Campeão, artilheiro etc. Regras de pontuação do bônus **não definidas no PRD** (lacuna registrada no PRD §6) → modelar só a **escolha**, não o cálculo. **(assumido)**.
| Campo | Schema | Notas |
|---|---|---|
| `uid` | `nonEmptyString` | autor |
| `championTeamId` | `nonEmptyString.optional()` | palpite de campeão (seleção) |
| `topScorerName` | `nonEmptyString.optional()` | palpite de artilheiro (nome livre) |
| `createdAt` | `isoDateTime.optional()` | (assumido) |
| `updatedAt` | `isoDateTime.optional()` | (assumido) |

> **Assumido**: artilheiro como string livre (não há coleção de jogadores no MVP). Campos opcionais permitem palpite parcial. Extensível conforme novas categorias de bônus surgirem.

### 4.9 `system_settings`  (configurações globais)  (doc único, ex.: `system_settings/global`)
| Campo | Schema | Notas |
|---|---|---|
| `registrationOpen` | `z.boolean()` | (assumido) cadastro aberto/fechado |
| `predictionsLocked` | `z.boolean()` | (assumido) trava global de palpites |
| `currentStage` | `stageSchema.optional()` | (assumido) fase corrente do torneio |
| `updatedAt` | `isoDateTime.optional()` | (assumido) |

> Sem campos no PRD → todos **assumidos**, cobrindo controles administrativos plausíveis do MVP (abrir cadastro, travar palpites). Mantido enxuto e extensível.

---

## 5. Padrão de derivação de tipo (`z.infer`)

Para **cada** schema, um arquivo espelho em `src/types/`:

```ts
// src/types/<colecao>.ts
import type { z } from "zod";
import type { <x>Schema } from "@/schemas/<colecao>";

export type <X> = z.infer<typeof <x>Schema>;
```

Exemplos:
```ts
// src/types/users.ts
import type { z } from "zod";
import type { userSchema } from "@/schemas/users";
export type User = z.infer<typeof userSchema>;

// src/types/matches.ts
import type { z } from "zod";
import type { matchSchema } from "@/schemas/matches";
export type Match = z.infer<typeof matchSchema>;
```

Barrels:
```ts
// src/schemas/index.ts
export * from "./shared";
export * from "./users";
export * from "./teams";
export * from "./groups";
export * from "./matches";
export * from "./predictions";
export * from "./rankings";
export * from "./statistics";
export * from "./bonusPredictions";
export * from "./systemSettings";

// src/types/index.ts
export * from "./shared";
export * from "./users";
// … (1 linha por coleção)
```

> Substitui o `export {};` placeholder atual dos dois barrels (TASK-04).

---

## 6. Estrutura de arquivos (alvo)

```
src/
├── schemas/
│   ├── shared.ts                 enums + primitivos
│   ├── users.ts
│   ├── teams.ts
│   ├── groups.ts
│   ├── matches.ts
│   ├── predictions.ts
│   ├── rankings.ts
│   ├── statistics.ts
│   ├── bonusPredictions.ts       coleção: bonus_predictions
│   ├── systemSettings.ts         coleção: system_settings
│   ├── index.ts                  barrel (substitui export {})
│   └── __tests__/
│       ├── users.test.ts
│       ├── teams.test.ts
│       ├── groups.test.ts
│       ├── matches.test.ts
│       ├── predictions.test.ts
│       ├── rankings.test.ts
│       ├── statistics.test.ts
│       ├── bonusPredictions.test.ts
│       ├── systemSettings.test.ts
│       └── shared.test.ts
└── types/
    ├── shared.ts
    ├── users.ts
    ├── teams.ts
    ├── groups.ts
    ├── matches.ts
    ├── predictions.ts
    ├── rankings.ts
    ├── statistics.ts
    ├── bonusPredictions.ts
    ├── systemSettings.ts
    └── index.ts                  barrel (substitui export {})
```

> **D10 (localização dos testes):** testes em `src/schemas/__tests__/`. Garantir que o pattern de teste **não** seja varrido pelo `tsc`/build de produção de forma a quebrar — Vitest usa seus próprios globs; manter `*.test.ts` é compatível com `eslint-config-next`. Se algum teste importar de `@/types`, ok (alias já configurado).

---

## 7. TDD — tooling e cobertura

### 7.1 Tooling (a adicionar no passo de implementação)
**Vitest ainda não está instalado.** No passo de TDD/implementação, adicionar como devDependencies e script:

```bash
npm i -D vitest @vitest/coverage-v8
```
`package.json` → script `"test": "vitest run"` (e opcional `"test:watch": "vitest"`).
Config mínima `vitest.config.ts` com alias `@` → `./src` (espelhar o `paths` do tsconfig) para os imports `@/schemas/*` funcionarem em teste.

> **Recomendação:** Vitest (alinha com a stack Vite-like e é o recomendado pelo plano para tarefas TDD desta fundação). `@firebase/rules-unit-testing` é da TASK-08 (não usar aqui).

### 7.2 O que cada suíte deve cobrir
Para **cada** schema, no mínimo:

1. **Parse válido (happy path):** um objeto completo e correto → `schema.parse(input)` não lança e retorna o objeto; `safeParse(...).success === true`.
2. **Rejeição por enum:** valor fora do enum (`role: "root"`, `status: "deleted"`, `stage: "terceiro_lugar"`, `matchStatus: "paused"`) → `safeParse(...).success === false`.
3. **Rejeição por refinement numérico:** placar **negativo** e placar **não inteiro** (`homeScore: -1`, `homeScore: 1.5`) → rejeitado em `matches`, `predictions`; `accuracy: 101` e `accuracy: -1` → rejeitado em `statistics`.
4. **Rejeição por e-mail inválido:** `users.email = "não-é-email"` → rejeitado.
5. **Rejeição por string vazia** onde `nonEmptyString` é usado (`name: ""`, `uid: ""`) → rejeitado.
6. **Campos extras (`.strict()`):** objeto com chave desconhecida → rejeitado.
7. **Refinement de `matches` (placar × status):** `status: "finished"` com `homeScore: null` → rejeitado; `status: "scheduled"` com `homeScore: 2` → rejeitado (ou conforme a regra final em §4.4); ambos coerentes → aceito.
8. **Inferência de tipo (compile-time):** asserts de tipo que falham o build se a inferência divergir. Padrão sem libs extras:
   ```ts
   import { expectTypeOf } from "vitest";
   import type { User } from "@/types/users";
   // garante que o tipo derivado tem a forma esperada
   expectTypeOf<User["role"]>().toEqualTypeOf<"user" | "admin">();
   ```
   (ou `// @ts-expect-error` em atribuições inválidas). Isso valida que `z.infer` produz exatamente o contrato esperado.

### 7.3 Disciplina TDD
Escrever o teste do schema **antes** de finalizar o schema (red → green). Cada coleção: começar pelo teste de parse válido + um inválido, então implementar/ajustar o schema até passar.

---

## 8. Passo a passo de implementação

1. **Pré-requisito:** instalar Vitest + config (§7.1). Confirmar `npm run typecheck` verde no estado atual.
2. **`shared.ts`** (schemas + tipos) + teste `shared.test.ts` (enums aceitam/rejeitam valores).
3. Para cada coleção, em ordem de dependência (`users`, `teams`, `groups`, `matches`, `predictions`, `rankings`, `statistics`, `bonusPredictions`, `systemSettings`): escrever teste(s) → implementar schema → derivar tipo → verde.
4. Atualizar barrels `src/schemas/index.ts` e `src/types/index.ts` (trocar `export {};` por reexports).
5. Rodar verificação (§9) e reportar saída real.

---

## 9. Critérios de aceite e verificação

Rodar, exigindo saída limpa:

```bash
npm run test          # vitest run → todas as suítes verdes
npm run typecheck     # tsc --noEmit → 0 erros (inferência + asserts de tipo ok)
npm run lint          # next lint → 0 erros/warnings
npm run build         # next build → sucesso
```

> Com RTK: `rtk vitest run`, `rtk tsc`, `rtk lint`, `rtk next build`.

Checklist:
- [ ] 9 schemas Zod implementados (+ `shared.ts`), em `src/schemas/`.
- [ ] Enums `Role`, `UserStatus`, `Stage` (e `RankingScope`, `MatchStatus`) em `shared.ts`, reusados sem redefinição.
- [ ] Todo tipo em `src/types/` é `z.infer<typeof …Schema>` (zero duplicação manual).
- [ ] `users` exige `uid,name,nickname,email,role,status`; e-mail validado por `z.email()`.
- [ ] Placares (`matches`, `predictions`) são inteiros ≥ 0; `accuracy` 0–100.
- [ ] Schemas `.strict()` rejeitam campos extras.
- [ ] Testes cobrem: parse válido, rejeição por enum, refinement numérico, e-mail, string vazia, campo extra, refinement placar×status, e inferência de tipo.
- [ ] Barrels reexportam tudo; `export {};` removido dos dois.
- [ ] Sem `any`; sem estilo inline; sem lógica de negócio (cálculo de pontos/ranking fora).
- [ ] `test`, `typecheck`, `lint`, `build` verdes.

---

## 10. Suposições (consolidado — campos não especificados no PRD)

| # | Suposição | Coleção/campo |
|---|---|---|
| A1 | Timestamps como string ISO 8601 (`z.iso.datetime()`); conversão `Timestamp↔ISO` na camada services | todos `*At` |
| A2 | `createdAt`/`updatedAt` opcionais | users, predictions, bonus, system |
| A3 | Valores de enum em slug inglês minúsculo; rótulos pt-BR na UI | `stage`, `role`, etc. |
| A4 | `users/{uid}` com `uid` no payload; demais coleções sem id redundante | id de doc |
| A5 | `teams`: `name`, `code` (3 letras), `flagUrl?`, `groupId?` | teams |
| A6 | `groups`: `name` + `teamIds[]`; sem standings | groups |
| A7 | `matches`: placares `null` até finalizar; refinement placar×status | matches |
| A8 | `predictions`: unicidade `(uid,matchId)` via id de doc + rules (não no schema) | predictions |
| A9 | `rankings`: doc por escopo com `entries[]` (cabe <100 users) | rankings |
| A10 | `statistics`: `correctByStage` como record por fase; `positionHistory[]` | statistics |
| A11 | `bonus_predictions`: só a escolha (campeão/artilheiro como string livre); cálculo fora | bonus |
| A12 | `system_settings`: doc único `global` com flags administrativas | system_settings |
| A13 | Sem `FirestoreDataConverter` nesta task | todos |

> Estas suposições são pontos a confirmar com o dono do produto antes de PRD-01+ tocarem essas coleções. Nenhuma introduz regra de negócio de pontuação/ranking — apenas **forma** dos dados.

---

## 11. Riscos e mitigações (desta tarefa)

| # | Risco | Mitigação |
|---|---|---|
| T1 | Usar API Zod 3 (`z.string().email()`) sob Zod 4 → deprecation/erro | Usar `z.email()`, `z.int()`, `z.iso.datetime()` (D1) |
| T2 | Duplicar tipos à mão divergindo do schema | Tipos só via `z.infer`; lint/review barram `interface` de documento (D2) |
| T3 | Vitest ausente quebra o passo TDD | Instalar Vitest + alias `@` na config antes de escrever testes (§7.1) |
| T4 | Refinement placar×status mal modelado bloqueia escrita legítima | Cobrir os 3 estados (agendado/ao vivo/finalizado) em teste; manter regra simples (D §4.4) |
| T5 | Campos assumidos divergirem do produto real | Marcar tudo como (assumido) (§10); manter enxuto e extensível |
| T6 | `.strict()` quebrar ingestão API-Football (TASK-09) | Decisão D6: TASK-09 pode relaxar pontualmente; nesta task fica `.strict()` |

---

## 12. Notas para as próximas tarefas
- **TASK-08** (Security Rules) consome estes formatos: `users.status`/`role`, `predictions.uid` (escrita só do próprio), leitura pública de `teams`/`matches`. Nomes de coleção em `snake_case` (`bonus_predictions`, `system_settings`).
- **TASK-09** (Cloud Functions/API-Football) mapeia respostas externas → `teamSchema`/`matchSchema`; pode precisar relaxar `.strict()` → `.strip()` em `teams`/`matches` (avaliar lá).
- **services/** (PRD futuro) parseia leituras com `safeParse` e injeta `doc.id`; é onde nasce o `FirestoreDataConverter` se necessário.
- Constantes com os **nomes das coleções** (`COLLECTIONS.bonusPredictions = "bonus_predictions"`) ficam em `lib/`/`services/` numa task futura — não hardcodar dentro dos schemas.
