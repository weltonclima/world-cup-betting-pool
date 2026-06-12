# SPEC

## 1. Task id and title
- Task: TASK-07
- Title: Tela Grupos (classificação dos grupos)

## 2. Objective
Implementar o conteúdo da aba Grupos (`/matches/grupos`): seletor de grupo A–L, tabela de classificação (`# Seleção P J V E D GP GC SG PTS`), badges de qualificação, legenda das colunas e os 3 estados (loading/empty/error). Criar os componentes de estado **compartilhados** que a TASK-08 reusa.

## 3. In scope
- `src/features/worldcup/components/`:
  - `GroupsView.tsx` — `"use client"`. Orquestra `useGroups()` + estado local do grupo selecionado (default `"A"`); resolve loading/empty/error/sucesso; compõe `GroupSelector` + `GroupStandingsTable` + `StandingsLegend`.
  - `GroupSelector.tsx` — chips horizontais roláveis (mobile-first) dos grupos disponíveis; `value`/`onChange`; ativo destacado.
  - `GroupStandingsTable.tsx` — tabela das 11 colunas a partir de um `GroupTable`; bandeira + nome por linha; coluna `P` (posição) = `position`; badge de qualificação na linha (ver §6.4).
  - `QualificationBadge.tsx` — mapeia `Qualification` → rótulo + variante (ver §6.4). Reusado por linha/legenda.
  - `StandingsLegend.tsx` — legenda das abreviações de coluna (J/V/E/D/GP/GC/SG/PTS) + legenda das cores de qualificação.
  - **Componentes de estado compartilhados** (TASK-08 importa, não duplica):
    - `WorldcupSkeleton.tsx` — skeleton genérico de carregamento (variante tabela).
    - `WorldcupEmptyState.tsx` — vazio, string exata `"Nenhuma informação disponível."`.
    - `WorldcupErrorState.tsx` — erro, string exata `"Erro ao carregar informações."` + botão `"Tentar novamente"` (`onRetry`).
  - Atualizar barrel `src/features/worldcup/components/index.ts`.
- `src/app/(app)/matches/grupos/page.tsx` — substituir placeholder; Server Component que renderiza `<GroupsView />` + `<h1 className="sr-only">Grupos</h1>`.
- Testes co-localizados em `__tests__/` de cada componente novo.

## 4. Out of scope
- Tela Eliminatórias / `BracketView` / cards de mata-mata (TASK-08) — mas os 3 componentes de estado compartilhados são criados aqui.
- Abas/layout/`CompetitionTabs` (TASK-06, fechada). Hooks/service (TASK-05, fechados). Cômputo de standings/badges (TASK-02 — já vem pronto da API).
- Alterar `/matches`, `MatchList`, `MatchDetail`.

## 5. Main technical areas involved
- `src/features/worldcup/components/*` (novo). `src/app/(app)/matches/grupos/page.tsx`.
- Reuso: `useGroups` (`@/features/worldcup/hooks`), tipos `GroupTable`/`GroupStanding`/`Qualification` (`@/types/worldcup`), `Button`/`Badge` (`@/components/ui`), `cn` (`@/lib/utils`), lucide.
- Padrão de estado/skeleton/flag espelha `src/features/matches/components/{MatchesEmptyState,MatchesErrorState,MatchListSkeleton,MatchCard}.tsx` (mesmo tema, mesmas classes de bandeira/fallback de iniciais).
- Layout fonte de verdade: `docs/prd-03-1/prd-3-2.png` (célula PRD03-04/05 — tabela verde com bandeiras).

## 6. Business rules and behavior

### 6.1 Fonte de dados
- `useGroups()` → `{ groups: GroupTable[], hasLiveGroupMatch }`. `GroupsView` usa **`useGroups`** (não `useGroupStandings`) porque precisa da lista completa de grupos p/ o seletor e do slice selecionado — uma única cache entry `["groups"]`, sem refetch por grupo.
- Grupo selecionado = estado local `useState<string>("A")`. Slice = `data.groups.find(g => g.groupId === selected)`.
- Lista de grupos do seletor = `data.groups.map(g => g.groupId)` na ordem recebida (já A→L). Não hardcodar A–L: derivar dos dados (degrada se vierem menos grupos).

### 6.2 Estados (precedência)
1. `isPending` (ou `isLoading`) → `<WorldcupSkeleton variant="table" />`.
2. `isError` → `<WorldcupErrorState onRetry={refetch} />`.
3. Sucesso mas `groups.length === 0` → `<WorldcupEmptyState />`.
4. Sucesso com grupos mas slice selecionado inexistente (defensivo) → `<WorldcupEmptyState />`.
5. Sucesso normal → seletor + tabela + legenda.

### 6.3 Tabela (11 colunas)
- Cabeçalho na ordem exata do PRD: `#` (posição), `Seleção`, `P`, `J`, `V`, `E`, `D`, `GP`, `GC`, `SG`, `PTS`.
  - **Atenção ao mapeamento PRD:** o PRD lista colunas `# Seleção P J V E D GP GC SG PTS`. Aqui `#` = `position`; `P` (primeira após Seleção) também é Pontos no exemplo do PRD? Não — o exemplo `1 Brasil 3 3 0 0 7 1 +6 9` tem 8 números após o nome para colunas `P J V E D GP GC SG PTS` (9 rótulos). Resolver a ambiguidade assim (decisão travada): exibir **10 colunas de dado** na ordem `#`,`Seleção`,`J`,`V`,`E`,`D`,`GP`,`GC`,`SG`,`PTS` — `J=played`, `V=wins`, `E=draws`, `D=losses`, `GP=goalsFor`, `GC=goalsAgainst`, `SG=goalDifference`, `PTS=points`. A coluna isolada `P` do rótulo do PRD é redundante (Pontos já é `PTS`) e o exemplo numérico não a inclui → **omitida**. Documentar no código.
- `SG` (saldo): exibir com sinal explícito quando ≥0 (`+6`, `0`), negativo natural (`-2`).
- `PTS`: `font-bold` / destaque (coluna principal).
- Números: usar `tabular-nums` p/ alinhamento.
- Coluna `Seleção`: bandeira (`team.flagUrl`, fallback iniciais — espelhar `TeamFlag` do MatchCard: `w-7 h-5`/compacto) + `team.name` (`truncate`). `team.code` (FIFA) pode aparecer no mobile no lugar do nome se a imagem indicar — **decisão:** mostrar nome com `truncate`; em ≤390px o nome trunca, sem ocultar coluna.
- Linha destaca posições de classificação por uma faixa/realce sutil à esquerda (ver §6.4), não por cor de fundo forte (contraste).

### 6.4 Qualificação (badges + realce)
`QualificationBadge` mapeia `Qualification`:
| valor | rótulo | variante Badge | uso |
|---|---|---|---|
| `classificado` | "Classificado" | `default` (verde primário) | 1º/2º |
| `possivel` | "Possível classificado" | `secondary` | 3º (melhores terceiros) |
| `eliminado` | "Eliminado" | `muted` | 4º |
| `indefinido` | (sem badge) | — | grupo incompleto |

- Na tabela: badge **não** cabe por linha em 360px junto das 10 colunas → exibir a qualificação como **marcador de cor na coluna `#`** (borda/dot à esquerda da posição) + badge textual **apenas** quando há espaço (≥640px, coluna extra "Situação") OU lista de badges resumida abaixo da tabela. **Decisão travada:** indicador de cor por linha (dot/barra à esquerda, com `aria-label` da situação) em todas as larguras; `StandingsLegend` explica as cores. Sem coluna de badge textual na tabela mobile.
- `indefinido` → marcador neutro (`muted`), `aria-label="Situação a definir"`.
- Cor nunca é o único sinal: o `aria-label` por linha + a legenda textual garantem `color-not-only`.

### 6.5 Legenda
- `StandingsLegend`: bloco abaixo da tabela. Duas partes:
  1. Abreviações: `J Jogos · V Vitórias · E Empates · D Derrotas · GP Gols Pró · GC Gols Contra · SG Saldo de Gols · PTS Pontos` (strings exatas do PRD).
  2. Cores de qualificação: amostra de cor + rótulo (Classificado / Possível classificado / Eliminado), `text-xs text-muted-foreground`.

### 6.6 Seletor de grupo
- Chips horizontais (`flex gap-2 overflow-x-auto`), rótulo `"Grupo A"`…`"Grupo L"` (prefixo "Grupo " + id). Mobile-first: rolável sem quebrar layout; `scrollbar` discreta.
- Chip ativo: `bg-primary text-primary-foreground`; inativo: `bg-muted text-muted-foreground hover:...`. Touch target ≥44px (`h-11` mobile). Botão real (`<button>`), `aria-pressed` no ativo, navegável por teclado.

### 6.7 Comportamento dinâmico
- `hasLiveGroupMatch` já dispara `refetchInterval` 60s dentro de `useGroups` (TASK-05) — `GroupsView` não reimplementa polling.

## 7. Contracts and interfaces
- `GroupsView`: sem props (lê hook). `"use client"`.
- `GroupSelector`: `{ groups: string[]; value: string; onChange: (groupId: string) => void; className? }`.
- `GroupStandingsTable`: `{ table: GroupTable; className? }`.
- `QualificationBadge`: `{ qualification: Qualification; className? }` (renderiza `null` p/ `indefinido` no contexto de badge textual).
- `StandingsLegend`: sem props (ou `className?`).
- `WorldcupSkeleton`: `{ variant?: "table" | "bracket"; className? }` (TASK-07 usa `"table"`; `"bracket"` reservado p/ TASK-08).
- `WorldcupEmptyState`: `{ message?: string; className? }` (default `"Nenhuma informação disponível."`).
- `WorldcupErrorState`: `{ onRetry: () => void; message?: string; className? }` (default `"Erro ao carregar informações."`).

## 8. Data and persistence impact
Nenhum (client-side, read-only).

## 9. Required tests
- `GroupStandingsTable.test.tsx`: renderiza 4 linhas de um `GroupTable` fixo; cabeçalhos na ordem `# Seleção J V E D GP GC SG PTS`; `SG` com sinal (`+6`, `-2`); `PTS` presente; bandeira/iniciais por linha; indicador de qualificação com `aria-label` correto por situação.
- `QualificationBadge.test.tsx`: `classificado`→"Classificado"/default; `possivel`→"Possível classificado"/secondary; `eliminado`→"Eliminado"/muted; `indefinido`→null.
- `GroupSelector.test.tsx`: renderiza um chip "Grupo X" por id; clique chama `onChange` com o id; ativo tem `aria-pressed`.
- `GroupsView.test.tsx` (mock `useGroups`): pending→skeleton; error→error state com retry chamando `refetch`; sucesso vazio→empty state; sucesso→seletor+tabela; troca de grupo no seletor muda a tabela exibida.
- `WorldcupEmptyState.test.tsx` / `WorldcupErrorState.test.tsx`: strings exatas do PRD; retry dispara callback.
- `StandingsLegend.test.tsx` (smoke): rótulos de abreviação presentes.
- Gate de regressão: suíte `src/features/matches/**` e `src/app/(app)/**` continua verde.

## 10. Acceptance criteria
- `npx vitest run` integral verde, sem regressão; `npx tsc --noEmit` e eslint limpos.
- Tela `/matches/grupos` renderiza seletor + tabela + legenda; troca de grupo funciona; default Grupo A.
- 3 estados com strings exatas do PRD; `WorldcupErrorState` tem retry.
- Responsivo 360/390/430/768/1024 sem scroll horizontal na **página** (a tabela pode ter scroll interno controlado se necessário, decidido no ui-spec).
- Componentes de estado compartilhados existem e são exportados p/ a TASK-08.
- `MatchList`/`MatchDetail` inalterados.

## 11. Constraints
- TS strict, zero `any`, alias `@/*`, Tailwind only (sem inline style), comentários pt-BR.
- Tokens de tema (verde primário) — sem hex hardcoded.
- `GroupsView` e componentes interativos `"use client"`; `page.tsx` Server Component.
- Não duplicar lógica de bandeira — espelhar `TeamFlag` (extrair util compartilhada se necessário, mas sem refatorar `matches`).
- Não alterar TASK-01..06.

## 12. Execution cost profile
- tdd: n/a
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/high

## 13. Frontend indicator
- is_frontend: true
- reason: tela com seletor, tabela, badges, estados — dispara `/ui-spec` + `/patterns:nextjs` + `/ui-review`.

## 14. Open questions
Nenhuma — ambiguidade da coluna `P` resolvida em §6.3 (omitida; redundante com `PTS`); apresentação do badge por linha resolvida em §6.4 (indicador de cor + aria-label + legenda).
