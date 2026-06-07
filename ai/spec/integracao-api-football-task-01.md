# SPEC — TASK-01 · Mover camada de integração API-Football para o servidor Next

> Origem: `ai/plan/integracao-api-football.md` §3 TASK-01 · PRD: `ai/prd/integracao-api-football.md`
> Tipo: refactor-support · SP: 3 · Criticality: high · Risk: medium · TDD: no (testes já existem) · Screen: no

## 1. Objetivo

Disponibilizar a camada de integração API-Football (client HTTP, mock, factory, types, config) sob `src/server/` para que os Route Handlers Next.js (TASK-04) a consumam, mantendo-a **server-only** (sem vazar a chave da API nem a implementação para o bundle do browser).

A API pública permanece **idêntica** à dos originais em `functions/`: `getApiFootballClient`, classes de erro (`ApiFootballQuotaError`, `ApiFootballAuthError`, `ApiFootballTimeoutError`), `HttpApiFootballClient`, `MockApiFootballClient`, tipos (`TeamResponse`, `FixtureResponse`, etc.) e config (`COPA_2026_CONFIG`, `isUseMockFallback`).

Esta task **copia** (não move) — os originais em `functions/src/apiFootball/**` e `functions/src/__tests__/client.*.test.ts` permanecem intactos até a TASK-11, que remove o código morto após a Home ser repontada.

## 2. Arquivos criados

| Arquivo | Origem | Ajuste |
|---------|--------|--------|
| `src/server/apiFootball/types.ts` | `functions/src/apiFootball/types.ts` | Cópia idêntica (sem imports internos) |
| `src/server/apiFootball/config.ts` | `functions/src/apiFootball/config.ts` | Cópia idêntica (sem imports internos) |
| `src/server/apiFootball/client.ts` | `functions/src/apiFootball/client.ts` | Imports relativos preservados (`./types`); comentário de cabeçalho atualizado p/ App Hosting + ponteiro do server-only |
| `src/server/apiFootball/mock.ts` | `functions/src/apiFootball/mock.ts` | Cópia idêntica (importa `./client`) |
| `src/server/apiFootball/factory.ts` | `functions/src/apiFootball/factory.ts` | Cópia funcional idêntica; **sem** `import "server-only"` (ver §3) |
| `src/server/apiFootball/index.ts` | — (novo barrel) | `import "server-only"` + reexporta a API pública |
| `src/server/apiFootball/__tests__/client.http.test.ts` | `functions/src/__tests__/client.http.test.ts` | Import `../apiFootball/client` → `../client` |
| `src/server/apiFootball/__tests__/client.mock.test.ts` | `functions/src/__tests__/client.mock.test.ts` | Imports `../apiFootball/{mock,factory}` → `../{mock,factory}` |

Estrutura final:

```
src/server/apiFootball/
├── client.ts
├── config.ts
├── factory.ts
├── index.ts          (barrel server-only — entrada pública)
├── mock.ts
├── types.ts
└── __tests__/
    ├── client.http.test.ts
    └── client.mock.test.ts
```

Os imports internos entre os módulos já eram **relativos** (`./client`, `./types`, `./config`, `./mock`) e não precisaram de ajuste — só os testes mudaram de caminho (saíram de `functions/src/__tests__/` para o `__tests__/` co-localizado, encurtando `../apiFootball/X` para `../X`).

## 3. Decisão sobre `server-only` vs testes

### Contexto

O pacote `server-only` (já presente em `node_modules`, fornecido pelo Next 15) é um marker: seu `index.js` **lança imediatamente no import** — `throw new Error("This module cannot be imported from a Client Component module...")`. O `package.json` resolve a condição `react-server` para um `empty.js` (no-op); qualquer outro bundler/runtime resolve para o `index.js` que lança.

O Vitest **não** ativa a condição `react-server`, então um `import "server-only"` é resolvido para `index.js` e lança ao carregar o módulo de teste. Se o `factory.ts` (importado por `client.mock.test.ts`) contivesse `import "server-only"`, a suíte quebraria na coleta.

### Decisão

`import "server-only"` fica **apenas no barrel** `src/server/apiFootball/index.ts` — o ponto de entrada público server-only. Os módulos internos (`client`, `mock`, `factory`, `config`, `types`) ficam **livres** do marker.

Consequências:

- **Produção / Route Handlers** consomem a API por `import { getApiFootballClient } from "@/server/apiFootball"` (o barrel). Qualquer tentativa de importá-lo de um Client Component falha no build do Next → garantia server-only mantida no ponto que importa.
- **Testes** importam os módulos concretos **diretamente** (`../client`, `../mock`, `../factory`), nunca pelo barrel, então o marker não é avaliado e a suíte passa sem precisar mockar `server-only`.

Esta é a abordagem prevista no próprio plano (§3 TASK-01: "Garantir 'server-only' ... `import "server-only"` no barrel"). Não foi necessário mockar `server-only` nem instalar dependências (o pacote já existe).

### Risco residual da decisão

Os módulos internos (`client.ts` etc.) **poderiam** ser importados diretamente por código client (`@/server/apiFootball/client`) burlando o marker do barrel. Mitigações: (a) convenção de pasta `src/server/**` sinaliza intenção server-only; (b) `client.ts`/`factory.ts` só leem `process.env` server (a chave nunca é `NEXT_PUBLIC_`), então mesmo importados não vazam segredo; (c) endurecimento futuro possível (TASK-04+) via regra ESLint `no-restricted-imports` bloqueando importes profundos em `@/server/apiFootball/*` fora de `src/server`/`src/app/api`. Não implementado nesta task (fora do escopo; sem custo de segurança imediato).

## 4. Restrições do projeto (obrigatórias)

- TypeScript strict, **sem `any`** — código copiado já é estrito; nenhum `any` introduzido.
- Alias `@/` confirmado no `tsconfig.json` (`paths: { "@/*": ["./src/*"] }`) e espelhado no `vitest.config.ts`. `src/server/**` é coberto pelo `include: ["**/*.ts", ...]` do tsconfig e pelo `include: ["src/**/*.test.{ts,tsx}"]` do vitest.
- **Sem hardcode novo** — config (IDs Copa, flag de mock) permanece em `config.ts`.
- API pública preservada — assinaturas, nomes de classe e tipos inalterados.

## 5. Verificação

- `npx vitest run src/server/apiFootball --reporter=json` (JSON inspecionado diretamente, não o resumo do RTK): `numTotalTests: 15`, `numPassedTests: 15`, `numFailedTests: 0`, `success: true`. Ambos os arquivos novos rodaram (`client.http.test.ts` 11 testes, `client.mock.test.ts` 4 testes).
- `npx tsc --noEmit`: exit 0, sem erros (nenhum relacionado a `src/server/apiFootball`).

## 6. Fora de escopo / não tocado

- `functions/**` (originais intactos — removidos só na TASK-11).
- `src/services/**`, `src/features/**`, `next.config`, `firebase.json`.
- Mappers (`matchMapper`/`teamMapper`) e correção de schema drift → TASK-02.
- Route Handlers que consomem esta camada → TASK-04.

## 7. Riscos

1. **Duplicação temporária** entre `functions/src/apiFootball/**` e `src/server/apiFootball/**` até a TASK-11. Aceito pelo plano (Notes da TASK-01). Mudanças nesta camada precisam ser refletidas nos dois lugares até a remoção — risco baixo de drift no curto intervalo entre T01 e T11.
2. **Import profundo burlando o barrel** (§3, risco residual) — mitigado por convenção e por a chave nunca ir ao client; endurecimento ESLint adiável.
3. **Marker `server-only`** depende do Next 15 fornecer o pacote — confirmado presente em `node_modules`; se removido no futuro, o barrel quebra o build (falha visível, não silenciosa).
