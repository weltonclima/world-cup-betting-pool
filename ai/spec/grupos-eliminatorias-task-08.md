# SPEC

## 1. Task id and title
- Task: TASK-08
- Title: Tela Eliminatórias (chaveamento)

## 2. Objective
Implementar o conteúdo da aba Eliminatórias (`/matches/eliminatorias`): fases empilhadas (Dezesseis-avos → Oitavas → Quartas → Semifinais → 3º Lugar → Final), cada uma com seus cards de confronto em 3 estados (aguardando / definido / encerrado). Reusa os componentes de estado compartilhados criados na TASK-07.

## 3. In scope
- `src/features/worldcup/components/`:
  - `BracketView.tsx` — `"use client"`. Orquestra `useBracket()`; resolve loading/empty/error/sucesso; mapeia os 6 buckets de `BracketResponse` em `PhaseSection` na ordem fixa.
  - `PhaseSection.tsx` — título da fase (pt-BR) + lista vertical de `KnockoutMatchCard`. Oculta a seção quando o bucket está vazio (degrada graciosamente).
  - `KnockoutMatchCard.tsx` — card de um `KnockoutMatch`; 3 variantes por `status` (ver §6.3). Presentacional puro (recebe `match`, sem hooks/fetch).
  - Atualizar barrel `src/features/worldcup/components/index.ts`.
- `src/app/(app)/matches/eliminatorias/page.tsx` — substituir placeholder; Server Component `<h1 className="sr-only">Eliminatórias</h1>` + `<BracketView />`.
- Testes co-localizados em `__tests__/`.

## 4. Out of scope
- Criar/alterar os componentes de estado compartilhados (já existem na TASK-07 — apenas importar). Hooks/service/cômputo (TASK-03/05, fechados). Tela Grupos (TASK-07). Abas/layout (TASK-06). Avanço de times no bracket (a fonte openfootball atualiza os lados; não computamos aqui).

## 5. Main technical areas involved
- `src/features/worldcup/components/*` (novo). `src/app/(app)/matches/eliminatorias/page.tsx`.
- Reuso: `useBracket` (`@/features/worldcup/hooks`), tipos `BracketResponse`/`KnockoutMatch`/`KnockoutSide`/`KnockoutPhase` (`@/types/worldcup`), `WorldcupSkeleton`/`WorldcupEmptyState`/`WorldcupErrorState` (TASK-07), `cn` (`@/lib/utils`).
- Padrão de bandeira/fallback espelha `TeamFlag` (MatchCard / GroupStandingsTable). Card visual espelha `MatchCard` (card verde, bandeiras, "x" central).
- Layout fonte de verdade: `docs/prd-03-1/prd-3-2.png` (células PRD03-06..09 — oitavas/quartas/semi/final).

## 6. Business rules and behavior

### 6.1 Fonte de dados
- `useBracket()` → `BracketResponse` `{ roundOf32, roundOf16, quarterFinals, semiFinals, thirdPlace, final }`, cada um `KnockoutMatch[]`.
- Sem estado de seleção — todas as fases renderizadas empilhadas (lista vertical mobile-first).

### 6.2 Fases (ordem + rótulo pt-BR fixos)
| bucket | rótulo |
|---|---|
| `roundOf32` | "Dezesseis-avos" |
| `roundOf16` | "Oitavas de Final" |
| `quarterFinals` | "Quartas de Final" |
| `semiFinals` | "Semifinais" |
| `thirdPlace` | "Disputa do 3º Lugar" |
| `final` | "Final" |

Ordem de renderização = a ordem da tabela acima. `BracketView` percorre uma lista `const PHASES = [{ key, label }, …]` e renderiza `PhaseSection` para cada bucket **não vazio**.

### 6.3 KnockoutMatchCard — 3 variantes por `status`
Cada card tem dois lados (`homeTeam`/`awayTeam`: `KnockoutSide` = `{ name, code?, flagUrl?, defined }`).

- **`aguardando`** (≥1 lado `defined:false`): exibe os nomes dos lados (que já são rótulos pt-BR vindos do domínio, ex.: "Vencedor Jogo 74", "1º do Grupo A") com separador "x"; rótulo de estado **"Aguardando definição"** (texto auxiliar `text-muted-foreground`). Lado `defined:false` → sem bandeira (usa um ícone/placeholder neutro); lado `defined:true` (se houver) → bandeira normal. Sem placar.
- **`definido`** (ambos `defined:true`, não encerrado): bandeira + nome de cada seleção, separador "x", sem placar. Pode exibir rótulo neutro de estado opcional (ex.: "A definir" NÃO — apenas o confronto). Sem texto de placar.
- **`encerrado`**: bandeira + nome de cada seleção + placar central `homeScore x awayScore` em destaque (espelha o placar do MatchCard encerrado: `{home} x {away}`). Texto de resultado acessível (ex.: aria-label `"Brasil 2 x 1 França"`).

Mapeamento defensivo: confiar no `status` do schema (já validado pelas refines da TASK-01). Não recomputar a partir de `defined`/scores.

### 6.4 Lado (KnockoutSide) rendering
- `defined:true`: `TeamFlag` (flagUrl ou iniciais) + `name` (`truncate`).
- `defined:false`: ícone neutro (lucide `HelpCircle` ou bloco `bg-muted`) no lugar da bandeira + `name` (rótulo placeholder pt-BR) `text-muted-foreground`.

### 6.5 Estados (precedência) — BracketView
1. `isPending` → `<WorldcupSkeleton variant="bracket" />`.
2. `isError` → `<WorldcupErrorState onRetry={refetch} />`.
3. Sucesso mas **todos** os 6 buckets vazios → `<WorldcupEmptyState />`.
4. Sucesso normal → seções das fases não vazias.

### 6.6 Comportamento dinâmico
- `useBracket` não tem `refetchInterval` (bracket estático; spec TASK-05 §6.6). `BracketView` não adiciona polling.

## 7. Contracts and interfaces
- `BracketView`: sem props. `"use client"`.
- `PhaseSection`: `{ label: string; matches: KnockoutMatch[]; className? }` — renderiza `null` se `matches.length === 0` (defensivo; BracketView já filtra).
- `KnockoutMatchCard`: `{ match: KnockoutMatch; className? }`. Presentacional.

## 8. Data and persistence impact
Nenhum (client-side, read-only).

## 9. Required tests
- `KnockoutMatchCard.test.tsx`:
  - `aguardando` (1 lado placeholder) → exibe nomes/rótulos + "Aguardando definição"; sem placar; lado defined:false sem `<img>`.
  - `definido` (2 reais) → bandeiras + nomes, sem placar, sem "Aguardando definição".
  - `encerrado` → placar `2 x 1` presente; aria-label do resultado.
  - fallback de iniciais quando `flagUrl` ausente em lado defined.
- `PhaseSection.test.tsx`: renderiza label + N cards; bucket vazio → null.
- `BracketView.test.tsx` (mock `useBracket`): pending→skeleton (bracket); error→error state + retry; todos buckets vazios→empty; sucesso→fases na ordem correta (Dezesseis-avos antes de Final), seções vazias omitidas.
- Gate de regressão: suíte `src/features/worldcup/**`, `src/features/matches/**`, `src/app/(app)/**` continua verde.

## 10. Acceptance criteria
- `npx vitest run` integral verde, sem regressão; `npx tsc --noEmit` e eslint limpos.
- `/matches/eliminatorias` renderiza as fases na ordem oficial; cards nos 3 estados corretos; placar só em encerrado.
- 3 estados de ciclo de vida (loading/empty/error) reusando componentes compartilhados da TASK-07.
- Responsivo 360→1024+ sem scroll horizontal da página.
- `MatchList`/`MatchDetail`/Tela Grupos inalterados.

## 11. Constraints
- TS strict, zero `any`, alias `@/*`, Tailwind only, comentários pt-BR, tokens de tema (sem hex).
- `BracketView`/cards `"use client"`; `page.tsx` Server Component.
- Reusar `WorldcupSkeleton`/`WorldcupEmptyState`/`WorldcupErrorState` (NÃO duplicar).
- Não alterar TASK-01..07.

## 12. Execution cost profile
- tdd: n/a
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/high

## 13. Frontend indicator
- is_frontend: true
- reason: tela de chaveamento com cards e estados — dispara `/ui-spec` + `/patterns:nextjs` + `/ui-review`.

## 14. Open questions
Nenhuma — estados do card derivam direto do `status` (schema TASK-01); rótulos placeholder já vêm em pt-BR do domínio (TASK-03).
