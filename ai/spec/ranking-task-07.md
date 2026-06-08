# SPEC

## 1. Task: TASK-07 – Shell de Ranking + estados + roteamento

## 2. Objective

Estrutura de navegação da seção Ranking (6 telas alcançáveis sob a aba Ranking do Bottom Tab Bar) + estados compartilhados (loading/empty/error) reutilizados pelas TASK-08..13. Sem conteúdo de dados ainda — só o esqueleto navegável e os componentes de estado.

## 3. In scope

1. Substituir placeholder `src/app/(app)/rankings/page.tsx`.
2. Sub-rotas sob `src/app/(app)/rankings/`:
   - `/rankings` → Ranking Geral (Tela 01) — TASK-08
   - `/rankings/fase` → Ranking por Fase + Por Grupo (Tela 03) — TASK-09
   - `/rankings/eu` → Meu Ranking (Tela 02) — TASK-10
   - `/rankings/evolucao` → Evolução (Tela 04) — TASK-11
   - `/rankings/perfil/[uid]` → Perfil do Participante (Tela 05) — TASK-12
   - `/rankings/estatisticas` → Estatísticas Gerais (Tela 06) — TASK-13
   Nesta task: criar as rotas com placeholders mínimos (cada uma renderiza um stub "em construção" + a sub-nav); o conteúdo real entra nas tasks respectivas.
3. `RankingSubNav` — navegação interna entre as views principais de ranking (Geral / Fases / Meu Ranking / Estatísticas), rota atual destacada, consistente com tema verde. (Evolução e Perfil são alcançadas contextualmente, não precisam de item fixo na sub-nav — decisão final no `/screen`.)
4. Estados compartilhados em `src/features/rankings/components/`:
   - `RankingSkeleton` (skeleton de lista/cards)
   - `RankingEmptyState` (mensagem "Nenhum participante encontrado")
   - `RankingErrorState` (mensagem "Erro ao carregar ranking" + botão "Tentar Novamente" → `onRetry`)
5. Barrel `src/features/rankings/components/index.ts`.

## 4. Out of scope

- Conteúdo de cada tela (TASK-08..13): listas, pódio, gráficos, cards de stats.
- Hooks/serviços (já em TASK-04/05).
- Bottom Tab Bar (já existe; aba Ranking já aponta `/rankings`).

## 5. Main technical areas

`src/app/(app)/rankings/**` (page.tsx + sub-rotas), `src/features/rankings/components/{RankingSubNav,RankingSkeleton,RankingEmptyState,RankingErrorState,index}.tsx`. Reusa: padrão de estados de `@/features/matches/components` (MatchListSkeleton/MatchesEmptyState/MatchesErrorState), Shadcn `tabs`/`button`, `cn`, `next/navigation` (`usePathname`/`Link`), AppShell (já no layout).

## 6. Business rules and behavior

- Toda a seção já está protegida por `AuthGuard` (layout `(app)`); não duplicar guard.
- `RankingSubNav` usa `usePathname()` p/ destacar a rota ativa (`aria-current="page"`). Itens são `next/link` (back/deep-link previsíveis, estado preservado).
- `RankingErrorState.onRetry` recebe a função `refetch` da query da tela consumidora (nesta task, stub aceita a prop).
- Estados visuais (tema verde/card) consistentes com o app; skeleton com `animate-pulse` (respeitar `prefers-reduced-motion` — sem animação se reduzido).
- Mobile-first; sub-nav rolável horizontalmente se faltar largura; alvos ≥44px.

## 7. Contracts and interfaces

```tsx
// RankingErrorState
interface RankingErrorStateProps { onRetry: () => void; message?: string; }
// RankingEmptyState
interface RankingEmptyStateProps { message?: string; subtitle?: string; }
// RankingSkeleton
interface RankingSkeletonProps { rows?: number; }
// RankingSubNav — sem props (usa usePathname); itens internos: Geral, Fases, Meu Ranking, Estatísticas
```
Rotas Next App Router: cada `page.tsx` é Server Component fino que renderiza o componente client da feature (stub nesta task).

## 8. Data and persistence impact

Nenhum. Apenas navegação/estados.

## 9. Required tests

Recommended TDD: **no**. Testes leves (recomendados, não bloqueantes): `RankingErrorState` chama `onRetry` ao clicar "Tentar Novamente"; `RankingSubNav` marca item ativo por pathname. Seguir padrão dos testes de `matches` components. Cobertura plena vem com as telas.

## 10. Acceptance criteria

- [ ] Placeholder `/rankings` substituído; 6 rotas existem e renderizam (stub onde o conteúdo é de outra task).
- [ ] `RankingSkeleton`/`RankingEmptyState`/`RankingErrorState` criados e exportados; error tem botão "Tentar Novamente" funcional.
- [ ] `RankingSubNav` destaca rota ativa (`aria-current`), navegável por teclado.
- [ ] Mobile-first; alvos ≥44px; reduced-motion respeitado no skeleton.
- [ ] tsc strict, sem `any`; suite verde; `/screen` (ai/screen/ranking-task-07.md) consumido na implementação.

## 11. UI/Screen requirement

- Requires screen: **yes** — `/screen` deve rodar antes do `/implement`.
- Platform: web (mobile-first, responsivo)
- Screens involved: Shell/navegação da seção Ranking + estados (base das 6 telas)
- Product type: leaderboard & stats dashboard (consumer, mobile-first)
- Recommended style: tema verde/branco, cards Shadcn, segmented tabs (linguagem já estabelecida no app; contrato = screenshots `docs/prd-05/`)
- Applicable UX domains: ux, layout, navigation

### Accessibility requirements
- Contraste ≥4.5:1 texto / ≥3:1 componentes; foco visível na sub-nav; `aria-current` na rota ativa; ordem de tab = ordem visual; cor não é único indicador do item ativo (sublinhado/peso além de cor); reduced-motion no skeleton; leitura lógica por screen reader.

### Interaction requirements
- Tap como interação primária (não hover); feedback de press 80–150ms; ≥8px entre alvos; erro com caminho de recuperação (Tentar Novamente); loading via skeleton (>300ms).

### UI states required
- loading (RankingSkeleton), empty (RankingEmptyState), error (RankingErrorState), populated (conteúdo das tasks 08–13), navegação (item ativo destacado).

## 12. Constraints

- Sem `any`; TS strict; Tailwind (sem estilo inline); ícones Lucide.
- Reusar estados/é padrões de `matches` (não criar pattern novo sem necessidade).
- `next/link` p/ navegação; Server Components finos + componentes client da feature.
- Não reimplementar Bottom Tab Bar nem AuthGuard.

## 13. Open questions

- **OQ1:** Itens fixos da `RankingSubNav` (Geral/Fases/Meu Ranking/Estatísticas) vs alcance contextual de Evolução/Perfil — resolver no `/screen` conforme screenshots. Default proposto: 4 itens fixos; Evolução acessível a partir de Meu Ranking; Perfil a partir de linhas do ranking.
- **OQ2:** Meu Ranking como rota `/rankings/eu` (proposto) vs aba — `/screen` decide. Rota separada é o default (deep-link).
