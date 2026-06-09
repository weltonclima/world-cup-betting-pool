# SPEC

## 1. Task: TASK-11 – Tela 04: Evolução no Ranking

## 2. Objective

Exibir o **histórico de posição do usuário logado ao longo das rodadas**: header verde "Sua evolução nas rodadas" com gráfico de linha (posição por rodada, eixo Y invertido — menor=melhor no topo) + lista de rodadas com indicador `↑ subiu / — manteve / ↓ caiu` e delta (badge "Atual" na última) + legenda. Estados loading/empty/error. A lista de rodadas é a **alternativa textual acessível** do gráfico.

## 3. In scope

1. Componente client `Evolution` (`src/features/rankings/components/`) consumindo o histórico de posições do usuário logado.
2. Header verde de destaque ("Sua evolução nas rodadas") contendo o `EvolutionLineChart` (TASK-06).
3. Lista de rodadas (mais recente → mais antiga): rótulo da rodada, posição (`#N`), indicador de evolução (ícone + delta), badge "Atual" na rodada mais recente.
4. Legenda (Subiu / Manteve / Caiu) com ícone + cor + texto.
5. Estados loading/empty/error ligados ao hook (componentes da TASK-07). **Empty = sem histórico** ("Sem histórico ainda").
6. Montar em `src/app/(app)/rankings/evolucao/page.tsx` (substituir stub).

## 4. Out of scope

- Backend/recalc, snapshots de `positionHistory` (TASK-03 — já grava).
- Helper `evolutionIndicator` (TASK-02 — pronto e testado).
- `EvolutionLineChart` em si (TASK-06 — pronto). Aqui só é consumido.
- Demais telas (Meu Ranking TASK-10, Perfil TASK-12 etc.).
- Mini-gráfico de evolução da Tela 02 "Meu Ranking" (TASK-10).

## 5. Main technical areas

`src/features/rankings/components/Evolution.tsx` (+ subcomponentes internos `EvolutionRow` / `EvolutionLegend` se úteis), `src/app/(app)/rankings/evolucao/page.tsx` (Server Component fino → renderiza `Evolution`), barrel `src/features/rankings/components/index.ts`.

Reusa:
- `EvolutionLineChart({ data: { label, position }[] })` de `@/features/rankings` (charts) — eixo Y já invertido; estado vazio textual embutido.
- `evolutionIndicator(prevPos, currPos)` de `@/features/rankings` → `{ direction: "up" | "same" | "down", delta }`.
- `useParticipantProfile(uid)` (TASK-05) → `Statistics | null` com `positionHistory[]`. **Não existe `useMyEvolution` dedicado** — reusa-se `useParticipantProfile(uid)` passando o **próprio uid** do usuário logado. `uid = useAuth().firebaseUser?.uid`.
- Tipos `Statistics`, `PositionHistoryEntry` (TASK-01) de `@/types`.
- Estados `RankingSkeleton` / `RankingEmptyState` / `RankingErrorState` (TASK-07).
- Shadcn `Badge`; Lucide named (`ArrowUp`, `ArrowDown`, `Minus`).

## 6. Business rules and behavior

- **Fonte dos dados:** `useParticipantProfile(uid)` com `uid` = usuário logado (`useAuth().firebaseUser?.uid`). Filtrar `positionHistory` ao **escopo "geral"** (doc-por-escopo; evolução da Tela 04 = posição no ranking geral). Ordenar por `at` ascendente para o gráfico e a derivação de deltas.
- **Dados do gráfico:** `data = positionHistory.map(h => ({ label: rótulo(h), position: h.position }))`, onde `rótulo(h)` = `"R" + h.round` quando `round` presente; fallback = `"R" + (índice + 1)` (ordem ascendente por `at`). Passado direto ao `EvolutionLineChart`.
- **Lista de rodadas (ordem de exibição = mais recente primeiro):** percorrer o histórico ascendente para calcular cada indicador via `evolutionIndicator(anterior?.position, atual.position)`; depois exibir invertido (recente no topo).
  - **Rodada 1 (sem anterior):** `evolutionIndicator(undefined, pos)` → `{ direction: "same", delta: 0 }` → renderiza **"—"** (manteve, sem delta).
  - **Última rodada (mais recente):** badge **"Atual"**.
  - Demais: ícone direcional + delta numérico (`delta > 0`).
- **Mapeamento de indicador → ícone/cor/texto (cor NÃO é único indicador → sempre ícone + texto):**
  - `up` (subiu) → `ArrowUp` + `text-primary` (verde do escopo) + delta.
  - `down` (caiu) → `ArrowDown` + `text-destructive` (vermelho) + delta.
  - `same` (manteve) → `Minus` + `text-muted-foreground` + sem delta (ou "—").
- **Posição exibida** com prefixo `#` e `tabular-nums` (`#4`, `#10`, `#15`).
- **Acessibilidade do gráfico:** o `EvolutionLineChart` é decorativo/complementar (Recharts SVG); a **lista de rodadas é a alternativa textual** e carrega o significado completo. Cada indicador tem texto/aria além de ícone+cor.
- **Compat de doc antigo:** `round` é opcional → usar fallback por índice. `positionHistory` vazio → estado **empty** ("Sem histórico ainda").

## 7. Contracts and interfaces

```tsx
// Evolution.tsx — sem props (consome hook + auth)
export function Evolution(): JSX.Element;
// Subcomponentes internos (não exportados obrigatoriamente):
// EvolutionRow({ label, position, indicator, isCurrent })
// EvolutionLegend()
```

Consome (TASK-01 / TASK-05):
- `Statistics` = `{ uid, totalCorrect, totalWrong?, accuracy, longestStreak, correctByStage, positionHistory: PositionHistoryEntry[] }`.
- `PositionHistoryEntry` = `{ at: string; scope: RankingScope; position: number; round?: number }`.
- `useParticipantProfile(uid)` → `UseQueryResult<Statistics | null>` (`{ data, isLoading, isError, refetch }`).
- `evolutionIndicator(prev, curr)` → `{ direction: "up" | "same" | "down"; delta: number }`.
- `EvolutionLineChart({ data: EvolutionPoint[] })`, `EvolutionPoint = { label: string; position: number }`.

## 8. Data and persistence impact

Nenhum (somente leitura via hook). Sem escrita. `positionHistory` é populado pelo recalc (TASK-03).

## 9. Required tests

Recommended TDD: **no** — o indicador (`evolutionIndicator`) já é testado puro na TASK-02; o gráfico é da TASK-06. Teste leve recomendado (não bloqueante): render do `Evolution` com `QueryClientProvider` mockando o hook → (a) lista com N rodadas, recente com badge "Atual", rodada 1 com "—"; (b) `positionHistory` vazio → empty state. Padrão jsdom (`// @vitest-environment jsdom`). Não testar markup do Recharts.

## 10. Acceptance criteria

- [ ] `/rankings/evolucao` mostra header verde + gráfico de linha (posição por rodada) do usuário logado.
- [ ] Lista de rodadas (recente→antiga) com posição `#N`, indicador subiu/manteve/caiu (ícone+texto) e delta.
- [ ] Rodada mais recente com badge "Atual"; rodada 1 (sem anterior) exibe "—" (manteve).
- [ ] Legenda Subiu/Manteve/Caiu presente.
- [ ] Estados loading (skeleton), empty ("Sem histórico ainda"), error (+ retry) ligados ao hook.
- [ ] Sob binário, sem métrica redundante; cor não é único indicador (sempre ícone+texto).
- [ ] tsc strict, sem `any`, sem hex/inline; Lucide named; tokens `.ranking-theme`; suite verde. `/screen` consumido.

## 11. UI/Screen requirement

- Requires screen: **yes** — `/screen` antes do `/implement`.
- Platform: web (mobile-first)
- Screens involved: Tela 04 Evolução no Ranking (`docs/prd-05/PRD05-04-Evolucao-Ranking.png`)
- Product type: leaderboard/stats dashboard consumer (mobile-first)
- Recommended style: tema verde escopo (`.ranking-theme`), header de destaque `bg-primary text-primary-foreground` com gráfico embutido, lista em card, números `tabular-nums`.
- Applicable UX domains: chart, style, ux, color, layout

### Accessibility requirements
- Gráfico (Recharts SVG) é complementar → a **lista de rodadas é a alternativa textual** completa. Indicadores nunca dependem só de cor: ArrowUp/ArrowDown/Minus + texto/aria-label ("subiu N", "caiu N", "manteve"). Contraste do verde (`--primary` 0.46) / vermelho (`--destructive`) ≥ AA. Header verde com texto branco ≥ AA. Foco visível; ordem de tab = visual. `tabular-nums` p/ alinhamento. `prefers-reduced-motion` respeitado (skeleton e qualquer transição). Alvos interativos ≥44px. Headings sequenciais. Suporte a text scaling.

### Interaction requirements
- Tela majoritariamente informativa (sem ações por linha). Erro com caminho de recuperação ("Tentar Novamente"). Loading via skeleton (>300ms). Sem hover como interação primária.

### UI states required
- loading (`RankingSkeleton`), empty (`RankingEmptyState` "Sem histórico ainda"), error (`RankingErrorState` + retry), populated (header+gráfico+lista+legenda).

## 12. Constraints

- Sem `any`; TS strict; Tailwind tokens (sem hex/inline); Lucide named.
- `"use client"` no `Evolution` (usa hook/auth).
- Reusar `EvolutionLineChart`, `evolutionIndicator`, `useParticipantProfile`, estados TASK-07 — não recriar.
- Não recalcular indicador fora do helper TASK-02.
- Mobile-first; layout não escondido atrás do Bottom Tab Bar (layout já tem `pb-20`).

## 13. Open questions (resolver no /screen)

- **OQ1:** Rótulo da rodada — "Rodada N" (lista, como na imagem) vs "RN" (eixo X do gráfico). Default: gráfico usa "RN" (compacto); lista usa "Rodada N". Confirmar na imagem.
- **OQ2:** Definição de "rodada" = cada execução de `/api/rankings/recalc` (decisão A4 do PRD); `round` é o nº/rótulo da jornada de recalc. Confirmar se a numeração começa em 1 e é contígua.
- **OQ3:** Filtrar `positionHistory` ao escopo "geral" (default proposto) vs exibir todos os escopos. Default: só "geral" (a Tela 04 é a evolução geral).
- **OQ4:** Quando há só 1 rodada no histórico — gráfico com 1 ponto + lista de 1 linha "—" "Atual", ou tratar como empty? Default: exibir a única rodada (não é empty).
