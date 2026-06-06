---
task: TASK-09
reviewed: 2026-06-05T02:25:00Z
depth: deep
files_reviewed: 16
files_reviewed_list:
  - functions/package.json
  - functions/tsconfig.json
  - functions/vitest.config.ts
  - functions/src/index.ts
  - functions/src/apiFootball/types.ts
  - functions/src/apiFootball/client.ts
  - functions/src/apiFootball/mock.ts
  - functions/src/apiFootball/factory.ts
  - functions/src/apiFootball/config.ts
  - functions/src/mappers/teamMapper.ts
  - functions/src/mappers/matchMapper.ts
  - functions/src/firestore/writer.ts
  - functions/src/firebase/admin.ts
  - functions/src/shared/schemas.ts
  - functions/src/functions/syncTeams.ts
  - functions/src/functions/scheduledSync.ts
  - functions/src/__tests__/teamMapper.test.ts
  - functions/src/__tests__/matchMapper.test.ts
  - functions/src/__tests__/client.mock.test.ts
  - functions/src/__tests__/fixtures/apiTeamFixtures.ts
  - functions/src/__tests__/fixtures/apiFixtureFixtures.ts
findings:
  blocker: 1
  warning: 4
  info: 1
  total: 6
verdict: rejected
---

# Revisão Técnica — TASK-09: Esqueleto Cloud Functions + Integração API-Football

**Revisado em:** 2026-06-05T02:25:00Z
**Profundidade:** deep (cross-file, call chains, type boundaries)
**Arquivos revisados:** 21
**Veredicto:** REJEITADO

---

## Resultado dos Comandos de Verificação

```
# functions/
npm test   → 3 suítes, 32 testes — TODOS PASSANDO
npm run build (tsc) → SUCESSO (saída limpa, zero erros)

# raiz Next.js
npm test   → 13 suítes, 97 testes — TODOS PASSANDO
npm run typecheck (tsc --noEmit) → SUCESSO
npm run build (next build) → FALHA — pre-existing (output: "export" + middleware-manifest)

# Análise de any
grep ": any" / "as any" em functions/src → ZERO ocorrências

# Vazamento de chave
grep "API_FOOTBALL" em src/ → ZERO ocorrências
```

O `next build` falha com `Cannot find module '.next/server/middleware-manifest.json'`. Esta falha é **pré-existente** (já detectada em TASK-05, causada pela configuração `output: "export"` em `next.config.ts` + issue de cache corrompido no ambiente CI) e **não foi introduzida pela TASK-09** — o subprojeto `functions/` não altera nem importa nada de `src/`. O `tsc --noEmit` na raiz passa limpo.

---

## Resumo

A TASK-09 entrega uma implementação sólida e bem estruturada do esqueleto de Cloud Functions. O código é TypeScript estrito sem `any`, os mappers são puros e testáveis, a suíte de 32 testes cobre todos os casos obrigatórios (T1–T6, M1–M9, C1–C4), e o build do subprojeto compila limpo. A separação entre `functions/` e o app Next.js está correta.

Há **um BLOCKER** técnico real: o cast `body as ApiFootballResponse<T>` no `HttpApiFootballClient` viola a D5 do spec ("usar `unknown` + type guard ou `safeParse`") — um campo `response` ausente ou malformado na resposta da API causa `TypeError: Cannot read properties of undefined` silencioso em runtime, mascarado por ser `unknown` primeiro. Os quatro WARNINGs são reais mas não bloqueiam desenvolvimento com mock.

---

## BLOCKER

### BL-01: Cast de resposta da API sem validação runtime viola D5 e causa crash silencioso

**Arquivo:** `functions/src/apiFootball/client.ts:128-130`

**Problema:**
```ts
const body: unknown = await response.json();
const envelope = body as ApiFootballResponse<T>;
return envelope.response;
```

O spec (D5, §3.5) determina: *"Respostas HTTP da API-Football são tipadas com interfaces em `types.ts`; parsing/validação com Zod garante que os dados externos entram no sistema com tipos conhecidos. Usar `unknown` + type guard ou `safeParse` ao lidar com corpos de resposta desconhecidos."*

A implementação usa `unknown` (correto) mas imediatamente executa um `as ApiFootballResponse<T>` — um type assertion que não valida nada em runtime. Se a API retornar:
- `{ "errors": { "rateLimit": "Too many requests" }, "results": 0, "response": [] }` — `envelope.response` é `[]`, sem erro, dados silenciosamente ausentes
- Qualquer resposta sem o campo `response` (manutenção da API, mudança de contrato) → `envelope.response` é `undefined` → `return undefined` (type lie: diz `T[]`, retorna `undefined`) → erro de runtime no mapper com mensagem enganosa

O tipo `T` em `fetchJson<T>` é completamente unbound — não há garantia em compile-time nem em runtime de que os objetos no array satisfazem o shape esperado. O mapper confia no type system, mas o type system foi burladoqui.

**Correção:** Validar o envelope com Zod antes de retornar. Como o tipo `T` é genérico, o approach mais seguro é validar apenas o envelope e deixar a validação dos itens para os mappers (que já fazem `matchSchema.parse()`):

```ts
import { z } from "zod";

// Schema do envelope de resposta (validação estrutural mínima)
const apiFootballEnvelopeSchema = z.object({
  results: z.number(),
  response: z.array(z.unknown()),
});

private async fetchJson<T>(url: string): Promise<T[]> {
  // ... (fetch, status checks inalterados)

  const body: unknown = await response.json();
  const parsed = apiFootballEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `Resposta inesperada da API-Football (envelope inválido): ${parsed.error.message}`,
    );
  }
  return parsed.data.response as T[];
}
```

Isso garante que pelo menos o campo `response` existe e é array antes de retornar. A validação de cada item continua sendo feita pelos Zod schemas nos mappers.

---

## WARNINGs

### WR-01: `USE_MOCK_FALLBACK` avaliado no carregamento do módulo impede isolamento correto em testes

**Arquivo:** `functions/src/apiFootball/config.ts:26-27` e `functions/src/apiFootball/factory.ts:21`

**Problema:**
```ts
// config.ts — avaliado UMA vez no import
export const USE_MOCK_FALLBACK =
  process.env["API_FOOTBALL_USE_MOCK"] === "true";
```

A constante é resolvida quando o módulo é importado pela primeira vez. Se um teste manipular `process.env["API_FOOTBALL_USE_MOCK"]` antes de chamar a factory, o comportamento depende de qual módulo foi carregado primeiro (Vitest usa ESM com cache de módulos). O teste C3 atualmente passa porque testa apenas a ausência de `API_FOOTBALL_KEY`, mas qualquer teste futuro que tente testar `USE_MOCK_FALLBACK = true` com `API_FOOTBALL_KEY` presente falhará silenciosamente.

**Correção:** Ler a variável em runtime dentro da factory:

```ts
// factory.ts
export function getApiFootballClient(): ApiFootballClient {
  const apiKey = process.env["API_FOOTBALL_KEY"];
  const useMock = process.env["API_FOOTBALL_USE_MOCK"] === "true";
  if (!apiKey || useMock) {
    return new MockApiFootballClient();
  }
  return new HttpApiFootballClient(apiKey);
}
```

Remover `USE_MOCK_FALLBACK` de `config.ts` (ou mantê-lo apenas como documentação comentada).

---

### WR-02: `writeTeams` e `writeMatches` sem proteção contra limite de 500 operações por batch do Firestore

**Arquivo:** `functions/src/firestore/writer.ts:26-37` e `45-56`

**Problema:**
```ts
const batch = db.batch();
for (const { id, data } of teams) {
  batch.set(ref, data); // sem limite
}
await batch.commit();
```

O Firestore Admin SDK lança `INVALID_ARGUMENT: maximum 500 writes allowed per request` se o batch ultrapassar 500 operações. A Copa 2026 tem 48 seleções (equipes) — seguro para `writeTeams`. Porém o `writeMatches` pode receber centenas de partidas (Copa 2022: 64 jogos; Copa 2026 com 48 seleções: 104 jogos de grupos + 16 + 8 + 4 + 2 + 1 = 135 partidas). Ainda abaixo de 500, mas o padrão sem proteção é frágil — qualquer expansão futura (outros torneios, rounds extras) quebraria silenciosamente em runtime.

**Correção:** Dividir em chunks de 499:

```ts
const BATCH_LIMIT = 499;

export async function writeTeams(teams: DocToWrite<MappedTeam>[]): Promise<void> {
  const db = getFirestore();
  for (let i = 0; i < teams.length; i += BATCH_LIMIT) {
    const chunk = teams.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const { id, data } of chunk) {
      batch.set(db.collection("teams").doc(id), data);
    }
    await batch.commit();
  }
}
```

---

### WR-03: `mapApiStatusToMatchStatus` retorna `"scheduled"` como fallback silencioso para status desconhecidos — inconsistente com a filosofia fail-fast dos mappers

**Arquivo:** `functions/src/mappers/matchMapper.ts:110-115`

**Problema:**
```ts
export function mapApiStatusToMatchStatus(short: string): MatchStatus {
  const status = STATUS_MAP[short];
  if (status !== undefined) return status;
  // Fallback seguro para status desconhecidos — não quebra o pipeline
  return "scheduled";
}
```

O `mapRoundToStage` lança erro para rounds desconhecidos (filosofia fail-fast, coberta pelo teste M6). O `mapApiStatusToMatchStatus` silenciosamente transforma status desconhecidos em `"scheduled"`. Isso cria inconsistência:

- Um novo status da API (ex.: "INT" para interrompido, já presente no `STATUS_MAP` mas não listado no spec original) não causaria erro, mas levaria a dados incorretos no Firestore — uma partida suspensa marcada como "scheduled" afeta cálculos de ranking.
- A API-Football já tem ~15 status diferentes; qualquer adição pela API passaria sem aviso.

**Observação:** `"INT"` (interrompido) e `"ABD"` (abandonado) já estão no `STATUS_MAP` — o mapa está mais completo que o spec. O problema real é novos status futuros.

**Correção:** Logar um warning e retornar fallback, ou lançar erro (alinhado com `mapRoundToStage`). No mínimo:

```ts
export function mapApiStatusToMatchStatus(short: string): MatchStatus {
  const status = STATUS_MAP[short];
  if (status !== undefined) return status;
  // Status desconhecido: logar para investigação em produção
  // Em ambiente de teste, considerar throw para detectar novos status da API
  console.warn(`Status desconhecido da API-Football: "${short}". Usando "scheduled" como fallback.`);
  return "scheduled";
}
```

Ou alinhar com `mapRoundToStage` e lançar erro (mais seguro para qualidade de dados).

---

### WR-04: `syncTeams` callable sem autenticação — exposta publicamente sem nenhum guard

**Arquivo:** `functions/src/functions/syncTeams.ts:17-20`

**Problema:**
```ts
export const syncTeams = onCall(async (_request) => {
  // TODO (PRD futuro): verificar se request.auth.token.role === "admin"
```

O spec (§7.1, A6) documenta explicitamente que o auth guard é um stub para esta task. Esta é uma limitação conhecida e aceita. No entanto, sem `enforceAppCheck` ou qualquer validação de `request.auth`, **qualquer usuário não autenticado pode chamar esta função** — inclusive via emulador sem credenciais, o que pode esgotar cota da API-Football ou inundar o Firestore com dados de mock.

Em produção com `API_FOOTBALL_KEY` configurada, isso representa risco operacional real (esgotamento de cota gratuita da API em uma única chamada maliciosa).

**Nota:** Este WARNING reconhece a decisão de design documentada no spec. A correção deve ser feita antes do deploy em produção (TASK-10).

**Correção mínima aceitável para o stub:**
```ts
export const syncTeams = onCall(async (request) => {
  // Guard mínimo: rejeitar chamadas não autenticadas
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Autenticação necessária.");
  }
  // TODO (PRD futuro): verificar request.auth.token.role === "admin"
  // quando custom claims estiverem configurados via TASK-08.
```

---

## INFO

### IN-01: `clearTimeout(timerId)` duplicado em `catch` e `finally`

**Arquivo:** `functions/src/apiFootball/client.ts:106-113`

**Problema:**
```ts
} catch (err: unknown) {
  clearTimeout(timerId);  // ← executado se fetch lançar
  // ...
} finally {
  clearTimeout(timerId);  // ← executado sempre (redundante após catch)
}
```

`clearTimeout` com um ID já cancelado é uma no-op em Node.js — não é um bug funcional, apenas código redundante. O `clearTimeout` no bloco `catch` é desnecessário pois `finally` sempre executa.

**Correção:** Remover o `clearTimeout(timerId)` do bloco `catch`. Manter apenas no `finally`.

---

## Análise de Conformidade com o Spec

| Critério | Status | Detalhe |
|---|---|---|
| Sem `any` em `functions/src` | PASS | Zero ocorrências |
| `API_FOOTBALL_KEY` não em `src/` | PASS | Zero ocorrências |
| `API_FOOTBALL_KEY` nunca `NEXT_PUBLIC_*` | PASS | |
| `functions/` subprojeto autônomo | PASS | `package.json` e `tsconfig.json` próprios |
| `tsconfig.json` não estende raiz | PASS | Independente, `module: "commonjs"` |
| `npm test` (32 testes) | PASS | 3 suítes, 32 testes, todos verdes |
| `npm run build` (tsc) | PASS | Saída limpa |
| Root `npm test` (97 testes) | PASS | Inalterado |
| Root `npm run typecheck` | PASS | Zero erros |
| Root `npm run build` | FALHA PRÉ-EXISTENTE | Não introduzida por TASK-09 |
| `ApiFootballClient` interface | PASS | Exportada em `client.ts` |
| `HttpApiFootballClient` com erros HTTP | PASS | 429, 401/403, timeout, rede |
| `MockApiFootballClient` | PASS | Dados de 4 seleções, 4 fixtures |
| `getApiFootballClient()` factory | PASS | Mock sem chave, real com chave |
| `COPA_2026_CONFIG` placeholder documentado | PASS | Com TODOs e referências históricas |
| `teamSchema.parse()` no output | PASS | ZodError propaga corretamente |
| `matchSchema.parse()` no output | PASS | Inclui refinement placar×status |
| `mapRoundToStage` config-driven | PASS | `ROUND_TO_STAGE_MAP` extensível |
| `mapApiStatusToMatchStatus` todos os status | PASS* | Completo, mas fallback silencioso (WR-03) |
| `writeTeams` idempotente | PASS | `batch.set()` correto |
| `syncTeams` callable | PASS | Stub funcional com log |
| `scheduledSync` cron `0 2 * * *` | PASS | Confirmado |
| `firebase.json` com `"source": "functions"` | PASS | Porta 5001 |
| `functions/.gitignore` com `lib/` | PASS | |
| `functions/.env.example` | PASS | |
| Validação runtime da resposta HTTP | **FALHA** | Cast sem type guard (BL-01) |
| Batch sem limite de 500 | **RISCO** | WR-02 |
| Auth guard na callable | **AUSENTE** | Documentado no spec como stub (WR-04) |

---

## Veredicto: REJEITADO

**BLOCKER obrigatório antes de aprovação:**

**BL-01** — `functions/src/apiFootball/client.ts:129`: Substituir `body as ApiFootballResponse<T>` por validação Zod do envelope (`z.object({ response: z.array(z.unknown()) })`). O cast atual viola D5 do spec e permite que respostas malformadas da API causem `TypeError` em runtime com mensagem enganosa.

**Após correção do BLOCKER, os WARNINGs podem ser adereçados sequencialmente:**

1. **WR-01** (alta prioridade para testabilidade): mover leitura de `API_FOOTBALL_USE_MOCK` para dentro da função `getApiFootballClient()`.
2. **WR-02** (alta prioridade para robustez): adicionar chunking de 499 no `writeTeams`/`writeMatches`.
3. **WR-04** (necessário antes de TASK-10/deploy): adicionar guard mínimo `!request.auth` no `syncTeams`.
4. **WR-03** (médio prazo): alinhar fallback de status com a filosofia fail-fast dos demais mappers.

---

_Revisado em: 2026-06-05T02:25:00Z_
_Revisor: Staff Engineer (adversarial review — TASK-09)_
_Profundidade: deep_
