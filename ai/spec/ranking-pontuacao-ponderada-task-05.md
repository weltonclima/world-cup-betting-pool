# SPEC

## 1. Task id and title
- Task: TASK-05
- Title: Propagar `avatarUrl` até `RankingEntry` (com mitigação de payload / R2-D4)

## 2. Objective
Levar a foto real do usuário (`users.avatarUrl`, data URL JPEG base64 — PRD-06)
até as entradas de ranking (`RankingEntry`), de forma **aditiva e retrocompatível**,
sem estourar o limite de **1 MB/doc** do Firestore nem inflar de forma perigosa o
payload do GET dos rankings. A propagação deve **degradar com segurança** (omitir a
foto, caindo no fallback de iniciais) quando o orçamento de bytes do documento for
excedido — nunca quebrar o `set` do doc.

## 3. In scope
- `schemas/rankings.ts` → `rankingEntrySchema`: adicionar campo
  `avatarUrl: z.string().optional()` (aditivo). Atualizar o comentário do schema.
- `server/rankings/recalc.ts`:
  - `toEntry()` passa a ler `u.avatarUrl` do usuário e incluí-lo na entry **quando
    presente e dentro do orçamento** (ver §6).
  - Introduzir um **guard de orçamento de bytes por documento de ranking**: ao montar
    o array `entries` de cada doc (`geral`, `pool-*-geral`, fases, `grupo-*`), incluir
    os avatares **em ordem de posição** (1º, 2º, 3º, …) acumulando o tamanho estimado
    em bytes; quando incluir o próximo avatar ultrapassaria o orçamento, **omitir**
    `avatarUrl` daquela entry em diante (entries continuam, só sem foto).
  - Função/util pura e testável para: (a) estimar o tamanho em bytes de uma data URL
    base64; (b) aplicar o orçamento sobre uma lista de entries já ordenada.
- `schemas/__tests__/rankings.test.ts`: cobrir o novo campo opcional (presente,
  ausente, retrocompat com docs sem `avatarUrl`).
- Testes do recalc / do guard de orçamento (ver §9).

## 4. Out of scope
- **NÃO** redesenhar o pódio nem alterar componentes de UI (`GeneralRanking.tsx`,
  `RankingPodium`, `RankingRow`) — isso é TASK-06/07.
- **NÃO** consumir `avatarUrl` em nenhuma tela ainda.
- **NÃO** adicionar dependência nativa de processamento de imagem (`sharp`/`canvas`)
  ao projeto. Não há lib de imagem server-side e o avatar **já chega comprimido do
  client** (256×256 JPEG sob `MAX_AVATAR_BYTES`); o re-encode server-side fica fora.
- **NÃO** criar endpoint separado de thumbnail por uid (alternativa descartada — ver §6).
- **NÃO** alterar a regra de pontuação, accuracy, streak ou qualquer métrica (TASK-02/03).

## 5. Main technical areas involved
- `src/schemas/rankings.ts` — `rankingEntrySchema` (+ `RankingEntry` inferido em
  `src/types/rankings.ts`, herda automaticamente).
- `src/server/rankings/recalc.ts` — `toEntry()` + montagem de `entries` de cada doc
  (geral, pools, fases, grupos) + novo guard de orçamento.
- `src/schemas/__tests__/rankings.test.ts` — contrato do campo.
- Testes do recalc/guard (`src/server/rankings/__tests__/` ou junto ao guard util).

## 6. Business rules and behavior
**Decisão de mitigação (R2/D4):** entre as três opções da PRD (downscale server-side,
top-3 only, thumbnail por endpoint), adotar **guard de orçamento por doc com priorização
por posição** — única viável sem nova dependência e que honra a intenção de D4 ("foto
na lista inteira") como **best-effort**:

1. `avatarUrl` é **aditivo e opcional** na entry. Ausência → fallback de iniciais (UI).
2. Ao montar `entries` de um doc de ranking, percorrer as entries **em ordem de
   posição crescente** (1º primeiro). Manter um acumulador de bytes.
3. Para cada entry com `avatarUrl` presente: estimar seu tamanho em bytes. Se
   `acumulado + tamanho ≤ AVATAR_BUDGET_BYTES`, incluir `avatarUrl` e somar ao
   acumulado. Caso contrário, **omitir** `avatarUrl` dessa entry (não interrompe o
   loop — entries seguintes ainda podem ter avatares menores, mas a ordem por posição
   garante que o **top do ranking** — e portanto o pódio — sempre recebe foto primeiro).
4. `AVATAR_BUDGET_BYTES`: orçamento **conservador** reservado só para avatares, deixando
   folga (~224 KB) para o resto do doc (campos textuais + metadados). Valor: **800 KB**
   (`800 * 1024`) — abaixo do teto de 1 MB do Firestore. Constante exportada e documentada.
5. O guard aplica-se **por documento** independentemente (geral, cada pool, cada fase,
   cada grupo) — cada doc tem seu próprio orçamento.
6. **Métrica de bytes (CRÍTICA):** medir o tamanho da **STRING armazenada** (o
   comprimento da data URL inteira) — é a string que o Firestore grava e conta contra
   o limite de 1 MB/doc. **NÃO** usar o tamanho DECODIFICADO da imagem (`dataUrlByteSize`
   de `imageToDataUrl.ts`, ~3/4 da string): a data URL base64 é ASCII, logo a string
   é ~4/3 maior que o decodificado; orçar pelo decodificado subestimaria o doc em
   ~25–33% e poderia estourar o limite — exatamente o que o guard previne (R2). Util
   server-safe `storedDataUrlBytes(url) = url.length`; **não** importar o módulo
   browser-only nem acoplar a `document`/`canvas`.

**Invariantes:**
- Doc de ranking **nunca** excede o orçamento de avatares (garante o `set`).
- Entry sem `avatarUrl` no user → entry sem o campo (comportamento idêntico ao atual).
- Top-3 de qualquer doc sempre recebem foto se o usuário tiver uma (orçamento de
  800 KB comporta dezenas de avatares de ~20–50 KB; o corte só afeta caudas longas).

## 7. Contracts and interfaces
- `rankingEntrySchema` (Zod, `.strict()`):
  ```
  avatarUrl: z.string().optional()   // data URL base64 (PRD-06); omitido sob orçamento
  ```
  → `RankingEntry` ganha `avatarUrl?: string` por inferência. Retrocompatível: docs
  já gravados sem o campo continuam fazendo parse (campo opcional).
- `toEntry(r)` em `recalc.ts`: assinatura inalterada; passa a popular `avatarUrl`
  **condicionalmente** (somente quando dentro do orçamento). O controle de orçamento
  vive na montagem de `entries` (onde a ordem por posição é conhecida), não dentro de
  `toEntry` isoladamente — `toEntry` pode receber um flag/`avatarUrl` já resolvido, ou
  a poda de orçamento ser aplicada à lista resultante de `.map(toEntry)`. Preferir
  **pós-processar a lista ordenada** (`applyAvatarBudget(entries)`) para manter
  `toEntry` simples e o guard testável isoladamente.
- Novo util puro (server-safe), por ex. em `src/server/rankings/avatarBudget.ts`:
  - `storedDataUrlBytes(dataUrl: string): number` — comprimento da string armazenada
  - `applyAvatarBudget(entries: RankingEntry[], budget?: number): RankingEntry[]`
    — recebe entries **já ordenadas por position**, devolve cópia com `avatarUrl`
    removido nas entries que excedem o orçamento acumulado.
  - `export const AVATAR_BUDGET_BYTES = 800 * 1024;`

## 8. Data and persistence impact
- **Sem migração.** O recalc reconstrói os docs `rankings/*` do zero a cada execução
  (idempotente) — a foto passa a aparecer no próximo recalc (mesmo padrão de D5).
- O campo é aditivo no schema; docs antigos sem `avatarUrl` permanecem válidos.
- Aumento de tamanho dos docs `rankings/*` é **limitado pelo orçamento** (≤ 800 KB de
  avatares por doc), preservando a folga até o teto de 1 MB do Firestore.
- Nenhum índice novo.

## 9. Required tests
**Guard de orçamento (`applyAvatarBudget` / `storedDataUrlBytes`) — TDD:**
- `storedDataUrlBytes` = comprimento da string (inclui o prefixo `data:…,`) e é
  ~4/3 maior que o decodificado (assertar a distinção das métricas).
- Invariante: soma das strings de avatar mantidas ≤ orçamento (< 1 MB do Firestore).
- Lista cujos avatares somados cabem no orçamento → todos mantêm `avatarUrl`.
- Lista cujos avatares estouram o orçamento → **prefixo por posição** mantém foto,
  cauda perde `avatarUrl`; entries permanecem (só sem foto).
- Avatar único maior que o orçamento → é omitido; doc não quebra.
- Entries sem `avatarUrl` → inalteradas; não consomem orçamento.
- Ordem de posição é respeitada (1º antes do 10º) — top do ranking priorizado.
- Idempotência: aplicar o guard duas vezes dá o mesmo resultado.

**Schema (`rankings.test.ts`):**
- Entry com `avatarUrl` válido faz parse.
- Entry sem `avatarUrl` faz parse (retrocompat).
- `.strict()` ainda rejeita chaves desconhecidas.

**Recalc (integração leve, se já houver harness):**
- Usuário com `avatarUrl` → entry correspondente carrega a foto (dentro do orçamento).
- Usuário sem `avatarUrl` → entry sem o campo.

## 10. Acceptance criteria
- `rankingEntrySchema` aceita `avatarUrl` opcional; `RankingEntry` expõe `avatarUrl?`.
- `recalc.ts` popula `avatarUrl` nas entries a partir de `users.avatarUrl`, aplicando
  o guard de orçamento por doc.
- Nenhum doc de ranking ultrapassa `AVATAR_BUDGET_BYTES` em avatares — comprovado por
  teste do guard.
- Top-3 de cada doc recebem foto quando o usuário a possui.
- Suíte verde (`vitest run`), sem regressão nos testes de recalc/rankings existentes.
- Sem nova dependência no `package.json`. Sem import de módulo browser-only no server.

## 11. Constraints
- Aditivo e retrocompatível (não estreitar contratos existentes).
- Função de pontuação / métricas **intocadas** (escopo de TASK-02/03).
- `recalc.ts` permanece idempotente e best-effort no save de placar.
- Util do guard deve ser **server-safe** (sem `document`/`canvas`/DOM).
- Respeitar `.strict()` dos schemas.
- Não importar de `features/profile/lib/imageToDataUrl.ts` (browser-only) — replicar a
  função pura de estimativa de bytes em local server-safe.

## 12. Execution cost profile
- tdd: sonnet/high
- implement: opus/high
- test: sonnet/medium
- review: sonnet/high

## 13. Frontend indicator
- is_frontend: false
- reason: Task de persistência/api — schema + agregação server-side (`recalc.ts`).
  Nenhuma tela/componente/interação. Consumo visual da foto fica em TASK-06/07.

## 14. Open questions
- **Orçamento de 800 KB**: assume avatares pequenos (client comprime a 256px JPEG;
  na prática ~20–50 KB). Se a base tiver avatares próximos do teto de 700 KB, apenas
  o 1º caberia por doc — comportamento ainda **seguro** (degrada para iniciais), mas o
  pódio além do 1º perderia foto. Mitigação aceitável dentro de D4 (best-effort);
  reavaliar só se observado em produção. Não bloqueia a implementação.
</content>
</invoke>
