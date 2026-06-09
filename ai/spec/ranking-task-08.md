# SPEC

## 1. Task: TASK-08 – Tela 01: Ranking Geral

## 2. Objective

Exibir a classificação geral completa: pódio top-3 + lista ordenada (posição, nome/apelido, pontos, aproveitamento) com **destaque do usuário logado** ("Você"), paginação client e estados loading/empty/error. Centerpiece da seção Ranking.

## 3. In scope

1. Componente client `GeneralRanking` (`src/features/rankings/components/`) consumindo `useGeneralRanking()` (TASK-05).
2. Pódio top-3 (avatares, coroa no 1º, nome + pontos).
3. Lista de classificação (posição, avatar, nome, apelido, pontos, aproveitamento; erros/acertos conforme §6).
4. Destaque "Você" (uid logado via `useAuth`).
5. Paginação client de 20/página.
6. Estados ligados a `useGeneralRanking` (loading/empty/error) usando componentes da TASK-07.
7. Montar em `src/app/(app)/rankings/page.tsx` (substituir stub).
8. Linha clicável → `/rankings/perfil/[uid]`.

## 4. Out of scope

- Por Fase/Por Grupo (TASK-09), Meu Ranking (TASK-10), demais telas.
- Recalc/serviços/hooks (prontos). Sub-nav (TASK-07).

## 5. Main technical areas

`src/features/rankings/components/GeneralRanking.tsx` (+ subcomponentes `RankingPodium`, `RankingRow` se útil), `src/app/(app)/rankings/page.tsx`, barrel `components/index.ts`. Usa `useGeneralRanking` (`@/features/rankings`), `useAuth` (`@/hooks/useAuth`), Shadcn `avatar`/`badge`, Lucide (`Crown`), `next/link`, estados TASK-07.

## 6. Business rules and behavior

- **Binário (pontos === acertos exatos):** exibir **"pts"** como métrica principal (`entry.points`). NÃO mostrar coluna separada "Acertos" com o mesmo número. Métricas por linha: **Pontos** (`points`) + **Aproveitamento** (`accuracy`%). `wrong` pode aparecer em telas de detalhe (Meu Ranking/Perfil), não na lista geral (evitar ruído). Confirmar layout exato no `/screen`.
- **Ordenação:** já vem ordenada por `position` do doc `rankings/geral` (TASK-03). Renderizar na ordem de `entries`.
- **Pódio:** primeiros 3 de `entries` (position 1/2/3). 1º com coroa (`Crown`, `aria-hidden`). Avatar com fallback de iniciais (Shadcn Avatar). Layout do pódio: 2º-1º-3º (centro elevado) conforme imagem.
- **Lista:** demais participantes (ou todos, com top-3 também repetidos na lista? — pela imagem, pódio separado + lista completa começando em #1 ou #4; decidir no `/screen`. Default: pódio top-3 + lista completa de todos a partir de #1 para escaneabilidade, OU lista a partir de #4. `/screen` decide).
- **Destaque "Você":** `entry.uid === firebaseUser?.uid` → linha `bg-primary/10` + badge "Você" (`Badge`), contraste AA. Rolar até a linha do usuário não é obrigatório (paginação pode posicioná-la).
- **Paginação client:** 20 por página; controles "Anterior/Próxima" + indicador de página. Se ≤20 participantes, sem controles. Página inicial = a que contém o usuário logado (nice-to-have; default página 1).
- **Nome/apelido:** `entry.name` (pode ser undefined em doc antigo) → fallback para `nickname`. Apelido sempre de `nickname`.
- **`accuracy`/`points` ausentes** (compat doc antigo): exibir `points` (sempre presente); `accuracy` undefined → "—".
- **Linha clicável:** navega a `/rankings/perfil/{uid}` (`next/link`), alvo ≥44px.

## 7. Contracts and interfaces

```tsx
// GeneralRanking.tsx — sem props (consome hook + auth)
export function GeneralRanking(): JSX.Element;
// Subcomponentes internos (não precisam ser exportados):
// RankingPodium({ top3: RankingEntry[] }), RankingRow({ entry, isCurrentUser })
```
Consome `RankingEntry` (TASK-01): `{ uid, nickname, name?, position, points, wrong?, accuracy? }`. Hook `useGeneralRanking()` → `{ data: Ranking|null, isLoading, isError, refetch }`.

## 8. Data and persistence impact

Nenhum (leitura via hook). Sem escrita.

## 9. Required tests

Recommended TDD: **no**. Teste leve (recomendado): helper puro de paginação (fatiar entries em páginas de 20) se extraído — testável. Componente: teste de render com QueryClientProvider mockando o hook → destaque "Você" aplicado à linha certa; pódio mostra top-3. Seguir padrão jsdom (`// @vitest-environment jsdom`). Não testar Recharts/markup frágil.

## 10. Acceptance criteria

- [ ] `/rankings` mostra pódio top-3 + lista ordenada com pontos e aproveitamento.
- [ ] Linha do usuário logado destacada + badge "Você".
- [ ] Paginação 20/página funcional (ou ausente se ≤20).
- [ ] Estados loading (skeleton), empty ("Nenhum participante encontrado"), error (+ retry) ligados ao hook.
- [ ] Linha navega ao perfil; alvos ≥44px.
- [ ] Sob binário, sem duplicar Pontos/Acertos.
- [ ] tsc strict, sem `any`, sem hex/inline; Lucide; suite verde. `/screen` consumido.

## 11. UI/Screen requirement

- Requires screen: **yes** — `/screen` antes do `/implement`.
- Platform: web (mobile-first)
- Screens involved: Tela 01 Ranking Geral (`PRD05-01-Ranking-Geral.png`)
- Product type: leaderboard/dashboard consumer
- Recommended style: tema verde escopo (`.ranking-theme`), cards Shadcn, pódio com avatares, números `tabular-nums`
- Applicable UX domains: style, color, typography, ux, layout

### Accessibility requirements
- Lista semântica (`<ol>`/`<ul>` ou `<table>` com headers). Contraste do destaque "Você" ≥4.5:1 (texto) / ≥3:1 (fundo). Avatares com `alt`/fallback textual; coroa `aria-hidden`. Cor não é único indicador do destaque (badge "Você" textual). Foco visível nas linhas/links; ordem de tab = visual. `tabular-nums` p/ alinhamento. Suporte a text scaling.

### Interaction requirements
- Tap na linha → perfil; feedback de press 80–150ms; ≥8px entre alvos; paginação com alvos ≥44px; loading skeleton >300ms; erro com retry.

### UI states required
- loading (RankingSkeleton), empty (RankingEmptyState), error (RankingErrorState + retry), populated (pódio+lista), destaque "Você", paginação (com/sem controles).

## 12. Constraints

- Sem `any`; TS strict; Tailwind tokens (sem hex/inline); Lucide named; `next/link`.
- Reusar Shadcn `avatar`/`badge`, estados TASK-07, hook TASK-05. Não refazer ordenação (vem do doc).
- `"use client"` no componente (usa hook/auth).
- Mobile-first; não esconder atrás do Bottom Tab Bar (layout já tem `pb-20`).

## 13. Open questions (resolver no /screen)

- **OQ1:** Lista inclui top-3 (repetidos) ou começa em #4? Default: lista completa a partir de #1 (escaneável); `/screen` confirma vs imagem.
- **OQ2:** Exibir `accuracy` e/ou `wrong` na linha da lista geral? Default: Pontos + Aproveitamento na lista; `wrong` só em telas de detalhe.
- **OQ3:** Página inicial da paginação centrada no usuário vs página 1. Default: página 1 (simplicidade).
