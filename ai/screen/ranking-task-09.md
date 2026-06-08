# SCREEN SPEC — Ranking por Fase + Por Grupo (Tela 03)
## Task: TASK-09
## Platform: web (mobile-first, responsivo)

## Visual Analysis (de docs/prd-05/PRD05-03-Ranking-Por-Fase.png)

- **Header da tela:** barra superior com seta de voltar (`<`), título centralizado "Ranking por Fase" e ícone de engrenagem (`settings`) à direita. (No app real este header é o Header global / AppShell — não recriar; a seta de voltar é convenção do mock.)
- **Sub-abas (segmented):** logo abaixo do título, duas abas lado a lado: **"Por Fase"** (ativa, sublinhado/peso verde) e **"Por Grupo"** (inativa, cinza). Indicador da ativa = cor verde + sublinhado inferior.
- **Conteúdo "Por Fase":** pilha vertical de **cards brancos**, um por fase:
  - **Fase de Grupos** — ícone verde de "pessoas/silhuetas" (representando grupos) à esquerda; à direita, três colunas de métrica: **Posição** `#2`, **Pontos** `35`, **Acertos** `6`.
  - **Oitavas de Final** — ícone de chaveamento/bracket; **Posição** `#5`, **Pontos** `12`, **Acertos** `3`.
  - **Quartas de Final** — ícone de troféu; **Posição** `#3`, **Pontos** `18`, **Acertos** `3`.
  - **Semifinal** — ícone de troféu/cálice; **Posição** `#2`, **Pontos** `9`, **Acertos** `2`.
  - **Final** — ícone de troféu; **Posição** `-`, **Pontos** `0`, **Acertos** `0` (fase sem dados → placeholder `-` na posição e zeros).
  - Cada card: nome da fase em negrito no topo-esquerdo; abaixo/à direita as três métricas com rótulo pequeno cinza acima do número grande.
- **Bottom Tab Bar:** fixo, 5 itens (Home / Jogos / Palpites / **Ranking** ativo, troféu verde / Perfil).
- **Style signals:** verde primário (aba ativa + ícones de fase), cards brancos com cantos arredondados e borda/sombra sutil, números grandes em negrito, rótulos pequenos em cinza, layout em pilha vertical.
- **States visible:** apenas estado populado + um card "sem dados" (Final com `-`/0). Loading/empty/error não aparecem no mock → derivar do padrão do app (TASK-07).
- **Aba "Por Grupo":** NÃO visível no screenshot (só a aba existe). Conteúdo derivado do PRD (A1/D3): seletor de grupo A–L + ranking do grupo, estilo lista reduzida da Tela 01.

### Decisão crítica de leitura do mock

O mock mostra **Pontos ≠ Acertos** (ex.: Grupos 35 vs 6), refletindo o modelo **3/1/0** do texto original do PRD-05 — **descartado** pela decisão de produto (pontuação **binária 1/0**, PRD §6 D1). Sob binário, **Pontos === Acertos**. Portanto este card **não** pode ter duas colunas com o mesmo número. **Decisão aplicada:** card exibe **Posição** + **Acertos** (= `points`) + **Aproveitamento** (`accuracy`%) — três métricas reais e distintas. Ver OQ1.

A aba "Por Fase" mostra os números de **UM** participante (o logado) — é um **resumo pessoal por fase**, não um ranking completo. Confirmado pelo layout (uma posição/valor por card, não uma lista).

## 1. User and Business Goals

Participante confere **seu próprio desempenho por etapa da Copa** (em qual fase vai melhor/pior) e, na aba Por Grupo, compara-se com os demais dentro de um grupo específico (A–L). Reforça engajamento e leitura granular da performance além do ranking geral.

## 2. Design System Reference

- Master: `design-system/MASTER.md` (§2.4-ranking — escopo verde `.ranking-theme`; §10 acessibilidade Enhanced).
- Tema: `.ranking-theme` (aplicada no container raiz de `/rankings` pela TASK-07) remapeia `--primary`/`--ring`/`--chart-1` p/ verde `oklch(0.46 0.16 150)`. Componentes usam tokens semânticos (`bg-primary`, `text-primary`, `text-muted-foreground`) — **sem hex, sem inline**.
- Reuso: estados TASK-07 (`RankingSkeleton`/`RankingEmptyState`/`RankingErrorState`), `RankingRow` da Tela 01 (TASK-08) para a lista por grupo.

## 3. User Flow

- Entrada: `RankingSubNav` → "Fases" (`/rankings/fase`), ou deep-link direto.
- Sub-aba **Por Fase** (default): vê 5 cards-resumo (Grupos→Final) com sua posição/acertos/aproveitamento por fase.
- Sub-aba **Por Grupo**: escolhe um grupo (A–L) no seletor → vê o ranking daquele grupo; sua linha destacada ("Você"); toca numa linha → `/rankings/perfil/[uid]`.
- Saída: troca de aba na `RankingSubNav` (Geral/Meu Ranking/Estatísticas) ou Bottom Tab Bar; back previsível.
- Edge: fase sem dados → card com `-`; grupo sem ranking → empty; falha de fetch → error + retry; carregando → skeleton.

## 4. Information Architecture

1. `RankingSubNav` (global da seção, já sticky — TASK-07).
2. **Sub-abas internas** desta tela (Shadcn `Tabs`): "Por Fase" / "Por Grupo".
3. Painel "Por Fase": pilha de 5 cards-resumo (um por fase).
4. Painel "Por Grupo": `GroupSelector` (chips A–L) + lista do grupo selecionado.
5. Estados (substituem o painel/card conforme a query): skeleton / empty / error.

## 5. Layout and Components

### Sub-abas (Shadcn Tabs)
- `TabsList` com dois `TabsTrigger`: "Por Fase" / "Por Grupo". Largura total no mobile (`grid grid-cols-2` ou `w-full`).
- Ativo: `text-primary font-semibold` + indicador (sublinhado/fundo do trigger conforme primitivo). Inativo: `text-muted-foreground`. Cor não é único indicador (peso + indicador do trigger).
- `min-h-11` nos triggers (≥44px). Transição `transition-colors duration-150`.

### StageRankingCard (aba Por Fase)
- Container: `Card`/`div` `rounded-lg border border-border bg-card p-4`, `shadow-sm`. Gap entre cards `gap-3`/`space-y-3`.
- Layout: linha superior com **ícone** (círculo `bg-primary/10 text-primary`, `size={24}`, `aria-hidden`) + **nome da fase** (`text-base font-medium text-foreground`).
- Métricas em linha (3 colunas, `grid grid-cols-3` ou flex com `gap-6`): cada métrica = rótulo pequeno (`text-xs text-muted-foreground`) acima do valor (`text-2xl font-bold tabular-nums text-foreground`).
  - **Posição:** `#{position}` ou `-`.
  - **Acertos:** `{points}` ou `-`.
  - **Aproveitamento:** `{accuracy}%` ou `-`.
- Sem dados (sem doc da fase ou usuário sem entry): valores `-` (mantém o card visível).
- Loading do card: skeleton inline (barras `bg-muted` no lugar dos números). Erro do card: mensagem curta + retry local (degradação por card — ver OQ3).

### Ícones por fase (Lucide, constante dedicada)
| Fase | Rótulo | Ícone sugerido |
|---|---|---|
| `grupos` | Fase de Grupos | `Users` |
| `oitavas` | Oitavas de Final | `Network` (chaveamento) |
| `quartas` | Quartas de Final | `Trophy` |
| `semifinal` | Semifinal | `Medal` |
| `final` | Final | `Trophy` |
> Ícone exato pode ajustar no `/implement` (Lucide named import); todos `aria-hidden`.

### GroupSelector (aba Por Grupo)
- Chips horizontais roláveis (`overflow-x-auto`, sem scrollbar visível) A–L: cada chip `min-h-11 px-4 rounded-full text-sm`.
- Selecionado: `bg-primary text-primary-foreground font-semibold` + `aria-pressed="true"`/`aria-current`. Não selecionado: `bg-muted text-muted-foreground`. Cor não é único indicador (peso + estado ARIA).
- `role="group"`/`aria-label="Selecionar grupo"`; navegável por teclado.

### GroupRankingView (lista do grupo)
- Reusa `RankingRow` (TASK-08): posição, avatar (iniciais fallback), nome (`name`→`nickname`), apelido (`@nickname`, `text-muted-foreground`), **Acertos** (`points`, `tabular-nums`) + **Aproveitamento** (`accuracy`% ou `-`).
- Destaque "Você": `bg-primary/10 text-foreground` + badge `bg-primary text-primary-foreground` "Você". Contraste AA.
- Lista semântica (`<ol>`/`<ul>`). Linha clicável → `/rankings/perfil/[uid]` (`next/link`, alvo ≥44px).
- Sem paginação (lista de grupo é curta).

### Páginas
- `src/app/(app)/rankings/fase/page.tsx`: Server Component fino → `<PhaseRanking />` (client). Tema `.ranking-theme` já no shell.

## 6. Typography and Color Tokens

- Nome da fase: `text-base font-medium`. Rótulos de métrica: `text-xs text-muted-foreground`. Valores: `text-2xl font-bold tabular-nums`.
- Cores: `--primary` (verde escopo — aba ativa, ícone de fase, chip selecionado, destaque "Você", badge), `--primary-foreground` (texto sobre primary), `--foreground`, `--muted-foreground`, `--card`, `--border`, `--muted`, `--destructive` (erro). **Sem hex.**

## 7. UI States

| Estado | Tratamento |
|---|---|
| Loading (Por Fase) | skeleton por card (>300ms) |
| Loading (Por Grupo) | `RankingSkeleton` na lista |
| Empty (fase) | card com `-` (fase sem dados) |
| Empty (grupo) | `RankingEmptyState` ("Nenhum dado para este grupo") |
| Error | `RankingErrorState` + "Tentar Novamente" (`onRetry`=refetch) — por card (fase) ou na lista (grupo) |
| Populated | cards-resumo (Por Fase) / lista (Por Grupo) |
| Destaque "Você" | linha do usuário no grupo (cor + badge) |
| Active sub-tab | trigger destacado (cor+peso+indicador, `aria-selected`) |
| Selected group | chip destacado (cor+peso, `aria-pressed`) |

## 8. Accessibility Requirements (Priority 1)

- **Tabs acessíveis** (Shadcn/Radix): `role="tablist"`/`tab`/`tabpanel`, navegação por teclado (setas), `aria-selected`. Foco visível (`ring-2 ring-ring`).
- Cor **não é único indicador**: aba ativa (peso + indicador), chip de grupo (peso + `aria-pressed`), destaque "Você" (badge textual).
- Cards de fase: cada métrica com **rótulo textual visível** ("Posição"/"Acertos"/"Aproveitamento") — número sozinho não comunica significado a leitor de tela. `-` lido como "sem dados" (considerar `aria-label` no card sem dados).
- Lista por grupo: semântica `<ol>`/`<ul>`; linhas focáveis na ordem visual; ícones de fase `aria-hidden`.
- Contraste: verde `--primary` (0.46) + branco ≥ AA (validado em auth/palpites); destaque "Você" `bg-primary/10` + texto `--foreground` ≥ 4.5:1.
- Alvos ≥44px (triggers, chips de grupo, linhas/links); ≥8px entre alvos.
- `tabular-nums` para alinhamento de números. Suporte a text scaling (sem altura fixa que corte texto).
- `prefers-reduced-motion`: skeleton sem pulse; transições de cor desligadas.

## 9. Animation and Motion (Priority 7)

- Skeleton `animate-pulse` com `motion-reduce:animate-none`.
- Troca de aba/chip: `transition-colors duration-150`. Sem animar width/height. Feedback de press 80–150ms.

## 10. Navigation Patterns (Priority 9)

- `RankingSubNav` (global) inalterada; item "Fases" ativo.
- **Sub-abas internas** (Por Fase/Por Grupo) = navegação terciária via Shadcn `Tabs`; estado local (não muda a rota — a rota já é `/rankings/fase`). Deep-link de sub-aba não é requisito.
- `GroupSelector` = seleção de filtro (não navegação de rota).
- Linha do grupo → `/rankings/perfil/[uid]` (deep-link real, back previsível).
- Bottom Tab Bar (global) inalterado; Ranking ativo.

## 11. Pre-Delivery Checklist Status

- Ícones Lucide named (sem emoji) ✓ · tokens semânticos (sem hex/inline) ✓ · alvos ≥44px ✓ · estados definidos ✓ · reduced-motion ✓ · foco/aria (tabs, chips, lista) ✓ · cor não é único indicador ✓ · mobile-first ✓ · binário sem duplicar Pontos/Acertos ✓.

## 12. Design Gaps and Assumptions

- **G1 (binário vs mock):** mock tem "Pontos"≠"Acertos" (modelo 3/1/0 descartado). Assunção: card exibe **Acertos (=points) + Aproveitamento**. → OQ1.
- **G2 (Por Fase = resumo pessoal):** assunção de que os números são do usuário logado (uma posição/valor por card). Achar `entry.uid === firebaseUser?.uid` em `useRanking(scope)`. Se imagem fosse ranking completo, layout teria lista — não tem. → confirma D1.
- **G3 (origem dos grupos A–L):** sem constante central; assumir 12 grupos (A–L, Copa 2026 / 48 seleções), constante dedicada na feature. Filtrar só grupos com doc? → OQ2.
- **G4 (granularidade loading/error na Por Fase):** 5 queries independentes → assunção de degradação por card. → OQ3.
- **G5 (grupo default):** assumir "A" (ou primeiro com doc). → OQ4.
- **G6 (aba Por Grupo não está no screenshot):** layout derivado do PRD + Tela 01; validar visualmente quando dados reais existirem.

### Open Questions (espelham o spec)
- **OQ1:** rótulo da métrica no card de fase — Acertos+Aproveitamento (default) vs só "Pontos".
- **OQ2:** origem/quantidade dos grupos no seletor (constante A–L dedicada; filtrar por doc existente?).
- **OQ3:** loading/error por card vs agregado na aba Por Fase.
- **OQ4:** grupo default na aba Por Grupo ("A" / primeiro disponível / nenhum).
- **OQ5:** linha do grupo navega ao perfil (default sim).
