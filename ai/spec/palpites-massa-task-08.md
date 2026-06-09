# SPEC

## 1. Task: TASK-08 – Tela Seleção de Grupo (PRD03-02)

## 2. Objective
Entregar a tela que lista os 12 grupos (A–L) em grid responsivo (3 colunas mobile → 4 desktop), cada card mostrando progresso/status de preenchimento do grupo e navegando para a tela de palpite em massa do grupo (`/predictions/grupos/[groupId]`, construída em task posterior).

## 3. In scope
- Rota `src/app/(app)/predictions/grupos/page.tsx` (client component; data-fetching + view-model).
- Componente apresentacional `src/features/predictions/components/GroupSelectionGrid.tsx` (puro, props-fed, testável isolado).
- Helper puro de agregação por grupo `buildGroupSummaries(matches, predictions)` → resumo (progresso/status) por groupId, derivado das partidas `stage === "grupos"` e dos palpites do usuário. (Não usar 12 chamadas de hook — hooks não podem ser chamados em loop.)
- Grid responsivo de `GroupCard` (primitiva TASK-06): nome, fração "X / Y", status (não-iniciado/andamento/concluído ✓), navegação por `href`.
- Header/subtítulo da tela + caixa de dica (info tip) conforme wireframe.
- Estados: loading, error, vazio (sem dados de grupo), populated.
- Aplicar `.palpites-theme` no container da rota (classe já existe em `globals.css` desde TASK-07).

## 4. Out of scope
- Tela de palpite em massa do grupo `/predictions/grupos/[groupId]` (TASK-09) — apenas linkar.
- Edição da primitiva `GroupCard` (entregue na TASK-06).
- Reapontar navegação "Palpites" (TASK-16) e modo "Completar Copa".
- Persistência/escrita (somente leitura).
- Classificação prevista / resumo de grupos / terceiros (TASK-10/11/12).

## 5. Main technical areas
- `src/app/(app)/predictions/grupos/page.tsx`.
- `src/features/predictions/components/GroupSelectionGrid.tsx`.
- `src/features/predictions/components/index.ts` (export).
- Helper de agregação: `buildGroupSummaries` — local ao módulo `GroupSelectionGrid.tsx` **ou** em `src/features/predictions/lib/standings.ts` (reuso de tipos). **Decisão:** colocar em `lib/` se reaproveitável; caso contrário co-localizar no componente e exportar a função pura para teste. Preferir co-localização no componente (escopo da tela) com export nomeado.
- Hooks reusados: `useMatches`, `usePredictions`, `useAuth`, `useTeams` (opcional — não necessário para o grid, que só precisa de groupId + contagem).
- Primitiva reusada: `GroupCard`.
- Tipos: `MatchWithId`, `Prediction` (`@/types`).

## 6. Business rules and behavior
- **Fonte dos grupos:** derivar de `matches` filtrados por `stage === "grupos"`, agrupados por `match.groupId` (A–L, vindo do mapper openfootball). NÃO hardcodar a lista A–L de jogos — derivar dos dados. (A constante de rótulo "Grupo X" pode ser formatada a partir do groupId.)
- **Ordenação dos grupos:** alfabética por `groupId` ASC (A → L), estável.
- **Por grupo (`GroupSummary`):**
  - `groupId` (ex.: "A"), `name` (ex.: "Grupo A").
  - `totalCount` = nº de partidas do grupo (esperado 6).
  - `filledCount` = nº de partidas do grupo com palpite preenchido (existe `Prediction` com `matchId === match.id`).
  - `status`: `concluido` se `totalCount>0 && filledCount===totalCount`; `andamento` se `0<filledCount<totalCount`; `nao-iniciado` se `filledCount===0`.
  - `href` = `/predictions/grupos/{groupId}`.
- **Sem bloqueio entre grupos:** todos os 12 grupos são navegáveis (diferente do Hub — não há regra A6 entre grupos). `selected` não se aplica (estado de seleção é do fluxo contínuo/wizard — fora de escopo aqui).
- **Estados da tela:**
  - **loading:** `isLoading` (matches ou predictions) ou uid ausente → skeleton de grid (`role="status"`).
  - **error:** `isError` → mensagem + "Tentar novamente" (`onRetry` = refetch).
  - **vazio:** sem partidas de grupo (`summaries.length === 0`) após carregar → mensagem "Os jogos da fase de grupos ainda não estão disponíveis." (sem CTA de navegação — não há grupo para abrir).
  - **populated:** grid com os 12 (ou N disponíveis) GroupCards.
- **uid ausente:** AuthGuard protege a rota; sem uid as queries ficam desabilitadas → tratar como loading.

## 7. Contracts and interfaces

### buildGroupSummaries (pura)
```ts
interface GroupSummary {
  groupId: string;       // "A".."L"
  name: string;          // "Grupo A"
  totalCount: number;    // partidas do grupo
  filledCount: number;   // com palpite
  status: FillStatus;    // "nao-iniciado" | "andamento" | "concluido"
  href: string;          // "/predictions/grupos/A"
}

function buildGroupSummaries(
  matches: MatchWithId[],
  predictions: Prediction[],
): GroupSummary[]; // grupos (stage "grupos") agrupados por groupId, ordenados A→L
```
- Ignora partidas sem `groupId` ou de outras `stage`. Determinística (ordem por groupId).

### GroupSelectionGrid (apresentacional, puro)
```ts
interface GroupSelectionGridProps {
  summaries: GroupSummary[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}
```
- Sem hooks de dados; recebe tudo por props. Renderiza header/subtítulo, dica, grid de `GroupCard`, e os estados.

### page.tsx
- Client component. `useAuth()` (uid), `useMatches()`, `usePredictions(uid)`.
- Deriva `buildGroupSummaries(matches, predictions)` via `useMemo`, passa ao `GroupSelectionGrid`. Envolve no container `.palpites-theme`.

## 8. Data and persistence impact
Nenhuma escrita. Leitura via React Query (`useMatches`, `usePredictions`). Sem novo schema/coleção. `.palpites-theme` já existe em `globals.css` (TASK-07).

## 9. Required tests
Arquivo: `src/features/predictions/components/__tests__/GroupSelectionGrid.test.tsx` (`// @vitest-environment jsdom`). Padrão de asserção igual a `MassPredictionPrimitives.test.tsx`.
- **buildGroupSummaries (pura):** agrupa por groupId; conta filled/total; deriva status (nao-iniciado/andamento/concluido); ignora partidas não-grupo / sem groupId; ordena A→L; gera href correto.
- **render:** header + subtítulo + dica; grid com N GroupCards (nomes "Grupo A".."Grupo L").
- **navigation links:** cada GroupCard renderiza link com `href="/predictions/grupos/{id}"`.
- **status visual:** card de grupo concluído mostra ✓ (texto "concluído" no aria-label); card em andamento; card não-iniciado.
- **aria:** GroupCard com `aria-label` resumido ("Grupo C, 3 de 6 jogos, em andamento").
- **loading:** `isLoading` → `role="status"`; sem cards.
- **error:** `isError` → botão "Tentar novamente" chama `onRetry`.
- **vazio:** `summaries=[]` (não-loading) → mensagem de indisponibilidade.

## 10. Acceptance criteria
- Grid responsivo 3 col mobile → 4 col desktop com os grupos derivados dos dados (A–L), cada card com fração/status correto.
- Cada card navega para `/predictions/grupos/{groupId}`.
- Estados loading/error/vazio/populated renderizam corretamente.
- `.palpites-theme` aplicado; realce/barra/foco em verde dentro do escopo.
- `tsc` e `eslint` limpos nos arquivos alterados; testes da tela verdes.
- Sem `any`, sem hex, sem `style` inline; Lucide named imports; `next/link` para navegação.

## 11. UI/Screen requirement
- Requires screen: **yes**
- Platform: **web** (mobile-first → desktop)
- Screens involved: PRD03-02 (Seleção de Grupo).
- `/screen` deve ser executado antes do `/implement`.
- Product type: Sports betting pool / bracket challenge (mobile-first).
- Recommended style: Esportivo limpo (MASTER.md); grid/realce/foco em verde via `.palpites-theme`.
- Applicable UX domains: style, color, ux, accessibility, navigation, states, layout.
- Nota: scripts Python do ui-ux-pro-max indisponíveis — direção derivada de `design-system/MASTER.md` + wireframe `docs/prd-03-1/PRD03-02-Selecao-Grupo.png`.

### Accessibility requirements
- Contraste ≥ 4.5:1 texto / ≥ 3:1 componentes (verde escopado + neutros do MASTER AA).
- Touch targets ≥ 44×44px (GroupCard `min-h-[44px]`); gap ≥ 8px entre cards (`gap-3`).
- GroupCard com `aria-label` resumido; ícone ✓ decorativo `aria-hidden`; status nunca por cor isolada (✓ + texto no label).
- Foco visível `focus-visible:ring-2 ring-ring ring-offset-2`; ordem natural do DOM; sem tabIndex positivo.
- Header com hierarquia correta (`h1` único na tela; sem pulo de nível).
- Loading `role="status" aria-live="polite"`; error `role="alert"`.
- Reduced motion: `motion-reduce:transition-none` (já nas primitivas).

### Interaction requirements
- Press feedback via `transition-colors duration-150` (hover de borda no GroupCard).
- Loading state quando fetch > 300ms (skeleton de grid).
- Error com recuperação inline ("Tentar novamente").
- Cards inteiros tappable; alvos ≥ 44px e gap ≥ 8px.

### UI states required
- loading, empty (sem dados de grupo), populated, error. Cada um com tratamento visual definido no `/screen`. (Sem estado success/disabled — tela de seleção sem mutação.)

## 12. Constraints
- TypeScript strict, sem `any`.
- Tailwind tokens apenas; sem hex; sem `style` inline.
- Lucide named imports; `next/link` para navegação interna.
- `GroupSelectionGrid` apresentacional e puro; data-fetching só no `page.tsx`.
- `buildGroupSummaries` pura e testável; derivar grupos dos dados (não hardcodar lista de jogos).
- Reusar a primitiva `GroupCard` — não duplicar layout de card.
- Mobile-first; grid `grid-cols-3 md:grid-cols-4 gap-3`; `pb-20 md:pb-4`.

## 13. Open questions
- **Estado `selected`/seleção:** a primitiva GroupCard suporta `selected`, mas o destaque verde de "selecionado" do wireframe pertence ao fluxo contínuo (wizard, TASK-16). Nesta tela de seleção avulsa, nenhum card nasce selecionado. Assumido; não bloqueia.
- **Rótulo do grupo:** assume-se `"Grupo " + groupId`. Se o mapper expuser um nome diferente em `groups`/`match`, ajustar; por ora derivar do groupId. Não bloqueia.
- **Rota `/predictions/grupos/[groupId]`** ainda não existe (TASK-09); o `href` é de convenção e ficará navegável quando a tela existir. Não bloqueia.
