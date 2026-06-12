# SPEC

## 1. Task id and title
- Task: TASK-06
- Title: Abas da área Jogos (Partidas | Grupos | Eliminatórias)

## 2. Objective
Introduzir navegação por abas na área Jogos com rotas URL e layout compartilhado, sem regressão na tela de Partidas nem na rota de detalhe `/matches/[id]`.

## 3. In scope
- `src/app/(app)/matches/layout.tsx` — layout compartilhado (Server Component) que renderiza o segmented control de abas acima de `{children}`. Aplica-se a `/matches`, `/matches/grupos`, `/matches/eliminatorias` **e** `/matches/[id]`.
- `src/features/worldcup/components/CompetitionTabs.tsx` — `"use client"` segmented control (3 abas, ativo por `usePathname`).
- `src/app/(app)/matches/grupos/page.tsx` e `src/app/(app)/matches/eliminatorias/page.tsx` — páginas placeholder mínimas (conteúdo real nas TASK-07/08); apenas um wrapper que renderiza um componente placeholder ou um título sr-only + “em breve”. Mantêm a aba navegável e deep-linkável já nesta task.
- Esconder/mostrar as abas na rota de detalhe: ver §6.4 (decisão).

## 4. Out of scope
- Conteúdo das telas Grupos/Eliminatórias (TASK-07/08). Hooks de dados (já em TASK-05). Alterar `MatchList`/filtros/`MatchDetail` (só não quebrar).

## 5. Main technical areas involved
- `src/app/(app)/matches/*` (novo layout + 2 páginas). `src/features/worldcup/components/*`.
- Reuso: shadcn (Button/cn), lucide; padrão de `MatchListHeader` (chips/segmented já usados na área).
- Layout fonte de verdade: `docs/prd-03-1/prd-3-2.png` (mosaico — header "Copa do Mundo" + tabs Grupos/Eliminatórias; tema verde).

## 6. Business rules and behavior
1. **Rotas (App Router):** `/matches` = aba Partidas (página existente intocada); `/matches/grupos` e `/matches/eliminatorias` = rotas estáticas novas. **Precedência:** segmento estático tem prioridade sobre `[id]` dinâmico — `/matches/grupos` NÃO cai em `[id]` com `id="grupos"`. Confirmar com teste.
2. **Segmented control:** 3 abas (Partidas / Grupos / Eliminatórias), ativo derivado de `usePathname()`:
   - `/matches` → Partidas ativo.
   - `/matches/grupos*` → Grupos. `/matches/eliminatorias*` → Eliminatórias.
   - Navegação via `next/link` (deep-link, prefetch). a11y: `role="tablist"`/`tab` com `aria-current="page"` no ativo, ou `<nav aria-label="Seções de Jogos">` semântico — escolher um e ser consistente.
3. **Posição:** abas no topo da área de conteúdo de Jogos (dentro do `max-w-4xl` do AppShell), acima do conteúdo de cada página. Título "Copa do Mundo": seguir decisão atual do projeto (títulos de tela `sr-only`, commit 80db1b0) — manter h1 sr-only "Jogos"/"Copa do Mundo" e tabs visíveis. Layout image manda no visual das tabs.
4. **Rota de detalhe `/matches/[id]`:** as abas **não** devem aparecer na tela de detalhe do jogo (é um drill-down, não uma seção irmã). Decisão: o `CompetitionTabs` se auto-oculta quando `usePathname()` casa `/matches/<algo>` que não seja `grupos`/`eliminatorias` e não seja exatamente `/matches` (i.e., detalhe). Implementação: o componente retorna `null` nesses paths. Alternativa rejeitada (route group separado) = mais complexa. Resultado: `/matches/[id]` e `/matches/[id]/predict` renderizam sem o segmented control.
5. **Responsividade:** mobile-first; abas em linha, full-width ou scroll horizontal se não couber (360px). Reusar abordagem dos chips de `MatchListHeader`.
6. **Sem estado de dados:** esta task não busca nada; placeholders são estáticos.

## 7. Contracts and interfaces
- `CompetitionTabs` sem props (lê `usePathname` internamente) — ou prop opcional `className`. Mantém simples.
- Nenhuma API.

## 8. Data and persistence impact
Nenhum.

## 9. Required tests
- `CompetitionTabs.test.tsx` (jsdom, mock `next/navigation usePathname`):
  - `/matches` → aba Partidas marcada ativa (aria-current/variant).
  - `/matches/grupos` → Grupos ativa. `/matches/eliminatorias` → Eliminatórias ativa.
  - `/matches/m73` (detalhe) → componente retorna `null` (sem tablist).
  - `/matches/m73/predict` → null.
  - 3 links com hrefs corretos.
- Gate de regressão: rodar a suíte existente de `src/features/matches/**` e `src/app/(app)/**` — DEVE passar inalterada (o layout novo não quebra MatchList/MatchDetail). Reportar contagem.
- (Opcional) teste de smoke das páginas placeholder render sem erro.

## 10. Acceptance criteria
- `npx vitest run` integral verde, **sem regressão** na suíte matches/app (critério de done do gate).
- `npx tsc --noEmit` e eslint limpos.
- `/matches/grupos` e `/matches/eliminatorias` resolvem para as páginas novas (não para `[id]`), comprovado por teste do `CompetitionTabs`/estrutura de arquivos.
- Abas ausentes na rota de detalhe.
- `MatchList`, filtros e `MatchDetail` inalterados em comportamento.

## 11. Constraints
- TS strict, zero `any`, alias `@/*`, Tailwind only (sem inline style), comentários pt-BR.
- `layout.tsx` pode ser Server Component; `CompetitionTabs` é `"use client"` (usa `usePathname`).
- Não modificar `src/app/(app)/matches/page.tsx`, `MatchList`, `MatchDetail`.
- shadcn + tokens de tema existentes (verde primário) — sem cor hardcoded.

## 12. Execution cost profile
- tdd: n/a
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/high

## 13. Frontend indicator
- is_frontend: true
- reason: cria navegação por abas (segmented control) + rotas/páginas da área Jogos. Dispara `/ui-spec` + `/patterns:nextjs`.

## 14. Open questions
Nenhuma — colisão de rota e ocultação na detail page decididas em §6.
