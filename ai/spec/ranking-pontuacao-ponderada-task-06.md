# SPEC

## 1. Task id and title
- Task: TASK-06
- Title: Redesign do pódio (top-3) com foto real e indicador de posição

## 2. Objective
Redesenhar o `RankingPodium` (top-3) em `GeneralRanking.tsx`: cards menores e sem
scroll horizontal, **foto real** no avatar (`entry.avatarUrl`, fallback iniciais),
**medalha/badge de posição** visível em cada card (1º/2º/3º) e detalhamento que torne
2º e 3º distinguíveis (pontos ponderados + aproveitamento + indicador de posição),
preservando a ordem visual 2-1-3 e a acessibilidade (D6/Eixo B).

## 3. In scope
- `RankingPodium` (em `src/features/rankings/components/GeneralRanking.tsx`):
  - **Avatar com foto:** `AvatarImage src={entry.avatarUrl}` + `AvatarFallback`
    (iniciais via `initials()` existente). `AvatarImage` (base-ui) já existe em
    `components/ui/avatar.tsx` e cai no fallback sozinho quando `src` é vazio/quebrado.
  - **Indicador de posição visível** em cada card: badge/medalha com "1º"/"2º"/"3º"
    (ou medalha 🥇🥈🥉 + número acessível). Hoje só o 1º tem `Crown` e nenhum mostra o
    número — 2º e 3º ficam ambíguos. Tornar a posição explícita nos três.
  - **Cards menores, sem overflow horizontal:** layout responsivo que cabe na largura
    do container sem `gap`/tamanhos que forcem scroll lateral em telas estreitas
    (mobile-first). Manter `flex` com `min-w-0`/`truncate` onde necessário.
  - **Detalhamento:** nome, pontos (ponderados — rótulo "pts"), aproveitamento
    (`accuracyLabel`), e o indicador de posição. 2º e 3º distinguíveis pela posição.
  - Manter a ordem visual **2-1-3** (`order-*`) com DOM em ordem de ranking (1,2,3).
  - Manter o destaque do card 1º (fundo `primary`) e o `Crown`/medalha.
  - Manter o link para o perfil e o badge "Você" do usuário atual.
- Atualizar/estender o `aria-label` do card para incluir a posição já legível.
- Teste de render leve do pódio (ver §9).

## 4. Out of scope
- **NÃO** alterar `RankingRow` nem avatares fora do pódio (`MyRanking`, `PhaseRanking`,
  `ParticipantProfile`) — isso é **TASK-07**.
- **NÃO** mexer em schema, `recalc.ts`, regra de pontuação, accuracy ou `avatarUrl`
  propagation — já entregue na TASK-05.
- **NÃO** alterar paginação, estados de loading/erro/empty, ou `usePoolRanking`.
- **NÃO** criar novos componentes de UI base (`components/ui/*`); reusar Avatar/Badge.
- **NÃO** introduzir nova dependência.

## 5. Main technical areas involved
- `src/features/rankings/components/GeneralRanking.tsx` — `RankingPodium` (e helpers
  `initials`/`accuracyLabel` já existentes, reutilizados).
- `src/components/ui/avatar.tsx` — consumo de `AvatarImage`/`AvatarFallback` (sem editar).
- `src/components/ui/badge.tsx` — consumo (sem editar).
- Teste: `src/features/rankings/components/__tests__/` (criar/estender p/ o pódio).

## 6. Business rules and behavior
- **Foto:** se `entry.avatarUrl` presente → renderiza a imagem; ausente/quebrada →
  fallback de iniciais (comportamento nativo do `Avatar` base-ui). Nunca quebra o layout.
- **Posição:** o indicador exibido = `entry.position` (1/2/3). Não recalcular posição
  no client — vem da entry (recalc é a fonte).
- **Pontos:** `entry.points` já são pontos **ponderados** (TASK-03) — rótulo "pts"
  permanece coerente; sem conversão no client.
- **Aproveitamento:** `accuracyLabel(entry)` → `"—"` quando `accuracy` indefinido.
- **Ordem visual 2-1-3** preservada; DOM em ordem de ranking para leitura/AT.
- **Acessibilidade:** `aria-label` por card com posição, nome, pontos e "(você)" quando
  aplicável. Medalha/ícone decorativo = `aria-hidden`. Foco visível mantido
  (`focus-visible:ring-*`). Alvos de toque adequados (cards são links grandes).

## 7. Contracts and interfaces
- Consome `RankingEntry` (já com `avatarUrl?: string` da TASK-05). Sem novos contratos.
- Sem mudança em props públicas de `GeneralRanking`. `RankingPodium` permanece interno;
  assinatura `{ top3: RankingEntry[]; currentUid?: string }` pode ser mantida.
- Imagem via `AvatarImage` (base-ui `Avatar.Image`): `src`, `alt`. Fallback via
  `AvatarFallback`.

## 8. Data and persistence impact
- Nenhum. Tarefa puramente de apresentação (client component).

## 9. Required tests
Teste de componente leve (render) para `GeneralRanking`/`RankingPodium`:
- Com 3 entries e `avatarUrl` presente → renderiza `<img>` com o `src` correto para
  cada card (ou pelo menos a imagem do avatar disponível).
- Entry sem `avatarUrl` → renderiza as iniciais (fallback), sem `<img>` com src vazio.
- **Indicador de posição** 1º/2º/3º presente e acessível (texto/aria) para os três.
- Pontos e "pts" exibidos; aproveitamento exibido (incl. `"—"` quando ausente).
- `aria-label` do card contém posição + nome + pontos.
- Sem regressão: ordem visual e link de perfil preservados.
- Não testar lógica de pontuação/accuracy (fora do escopo; vem pronta na entry).

## 10. Acceptance criteria
- Pódio renderiza foto real quando disponível e iniciais como fallback.
- Cada card mostra a posição (1º/2º/3º) de forma visível e acessível; 2º e 3º
  distinguíveis.
- Sem scroll horizontal do pódio em larguras mobile típicas (≥320px).
- Pontos (ponderados) + aproveitamento exibidos; ordem visual 2-1-3 mantida.
- `vitest run` verde; sem regressão nos testes de ranking existentes.
- Conformidade com o `ai/ui-spec/ranking-pontuacao-ponderada-task-06.md` (gerado a seguir).
- Sem nova dependência.

## 11. Constraints
- Client component (`"use client"`) — manter.
- Reusar tokens de tema (`bg-primary`, `border-border`, `bg-card`, `text-muted-foreground`)
  e componentes base; **não** hardcodar cores fora dos tokens.
- Mobile-first; respeitar `min-h`/alvos de toque e `focus-visible`.
- Precedência de design: project patterns (`patterns/nextjs`) > ui-ux-pro-max; APIs reais
  (base-ui Avatar) confirmadas no ui-spec/implement.
- Não estender o escopo para outras superfícies de avatar (TASK-07).

## 12. Execution cost profile
- tdd: n/a (apresentação pura — cobrir via teste de render leve + `/ui-review`)
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/high

## 13. Frontend indicator
- is_frontend: true
- reason: Redesenha o componente visual `RankingPodium` (top-3) da tela de ranking —
  layout, avatar com foto, badges de posição, estados e acessibilidade.
  → `/ui-spec` + `/patterns:nextjs` + `/ui-review` na sequência do flow.

## 14. Open questions
- **Forma do indicador de posição** (medalha colorida 🥇🥈🥉 vs. badge "1º/2º/3º" vs.
  número grande) — decidir o layout final no `/ui-spec` (D6 deixa o detalhamento aberto
  para o ui-spec). Não bloqueia: qualquer das formas satisfaz "posição visível e
  acessível".
