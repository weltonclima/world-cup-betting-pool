# SPEC

## 1. Task: TASK-09 – Tela 03: Ranking por Fase (+ Por Grupo)

## 2. Objective

Entregar a Tela 03 da seção Ranking com duas sub-abas:

- **Por Fase** — um card-resumo por fase de ranking (Fase de Grupos, Oitavas, Quartas, Semifinal, Final) mostrando a **posição do usuário logado** naquela fase + métricas (sob binário: Acertos = Pontos + Aproveitamento), com ícone por fase. Fase sem dados → `-`.
- **Por Grupo** — seletor de grupo (A–L) + ranking daquele grupo (lista enxuta estilo Tela 01), com destaque "Você".

Consome hooks/serviços prontos (TASK-04/05) e estados compartilhados (TASK-07). Monta em `src/app/(app)/rankings/fase/page.tsx` (substitui o stub).

## 3. In scope

1. Componente client `PhaseRanking` (`src/features/rankings/components/`) que orquestra as duas sub-abas via Shadcn `Tabs` ("Por Fase" / "Por Grupo").
2. **Por Fase** — `StageRankingCards`: itera as 5 fases de ranking (`grupos`, `oitavas`, `quartas`, `semifinal`, `final`), cada uma com `useRanking(scope)`; localiza a entry do usuário logado (`useAuth().firebaseUser?.uid`) e renderiza um `StageRankingCard` (ícone + nome da fase + Posição `#N` + métricas). Fase sem doc / usuário sem entry → placeholder `-`.
3. **Por Grupo** — `GroupRankingView`: `GroupSelector` (chips/segmented A–L) + `useGroupRanking(groupId)` → lista ordenada do grupo (posição, nome/apelido, pontos, aproveitamento) com destaque "Você". Reusa `RankingRow` da TASK-08 se exportado; senão subcomponente local.
4. Estados loading/empty/error por sub-aba, usando `RankingSkeleton` / `RankingEmptyState` / `RankingErrorState` (TASK-07). Error com `onRetry` = `refetch` da query relevante.
5. Montar em `src/app/(app)/rankings/fase/page.tsx` (Server Component fino → componente client).
6. Sub-aba "Por Grupo": grupo default = primeiro disponível (ver §6/OQ2). Persistência de sub-aba/grupo é nice-to-have (não obrigatória).
7. Barrel: exportar novos componentes em `src/features/rankings/components/index.ts`.

## 4. Out of scope

- Tela 01 Geral (TASK-08), Meu Ranking (TASK-10), Evolução (TASK-11), Perfil (TASK-12), Estatísticas (TASK-13).
- Recalc/serviços/hooks (prontos — TASK-03/04/05). Shell/sub-nav/estados (TASK-07).
- Pódio top-3 (exclusivo da Tela 01). Paginação (lista por grupo é curta — sem paginação).
- Ranking completo de cada fase como lista (a aba "Por Fase" é resumo pessoal por fase — ver §6 D1).

## 5. Main technical areas

`src/features/rankings/components/PhaseRanking.tsx` (orquestrador) + subcomponentes `StageRankingCards`/`StageRankingCard`, `GroupRankingView`/`GroupSelector`, `src/app/(app)/rankings/fase/page.tsx`, barrel `components/index.ts`. Usa: `useRanking` + `useGroupRanking` (`@/features/rankings`), `useAuth` (`@/hooks/useAuth`), Shadcn `tabs`/`avatar`/`badge`/`button`, Lucide (ícones de fase + `Trophy`), `next/link`, estados TASK-07, `cn` (`@/lib/utils`).

## 6. Business rules and behavior

### Decisões

- **D1 — "Por Fase" é resumo PESSOAL por fase (não ranking completo).** Pela imagem (`PRD05-03-Ranking-Por-Fase.png`): cada card mostra **Posição**, **Pontos**, **Acertos** de UM participante — o usuário logado. Logo, para cada fase: `useRanking(scope)` → achar `entry.uid === firebaseUser?.uid` → exibir `entry.position`, métricas. Não renderizar a lista de todos por fase nesta tela.
- **D2 — Binário (pontos === acertos exatos).** A imagem mostra colunas "Pontos" **e** "Acertos" com valores **diferentes** (ex.: Grupos Pontos 35 / Acertos 6) — isso reflete o modelo 3/1/0 do texto original do PRD-05, **descartado** (PRD §6 D1). Sob binário, Pontos e Acertos são o mesmo número. **Decisão:** NÃO duplicar dois rótulos idênticos. Card exibe **Acertos** (= `entry.points`) + **Aproveitamento** (`entry.accuracy`%) — duas métricas reais e distintas. (Ver OQ1: alternativa é manter rótulo único "Pontos".)
- **D3 — Fases de ranking = as 5 do `rankingScopeSchema` exceto "geral":** `grupos`, `oitavas`, `quartas`, `semifinal`, `final`. (Schema já exclui `dezesseis-avos` e `terceiro`.) Rótulos pt-BR: "Fase de Grupos", "Oitavas de Final", "Quartas de Final", "Semifinal", "Final".
- **D4 — Por Grupo = grupos individuais (A–L)** via `useGroupRanking(groupId)` (doc `rankings/grupo-{groupId}`). Alinhado a PRD A1/D3.

### Comportamento

- **Card de fase (Por Fase):**
  - Ícone por fase (Lucide; mapa fixo em constante — ver §7). `aria-hidden`.
  - Título = rótulo pt-BR da fase (`text-base font-medium`).
  - Métricas: **Posição** `#N` (`entry.position`), **Acertos** (`entry.points`), **Aproveitamento** (`entry.accuracy`% ou `-` se undefined). Números `tabular-nums`.
  - **Sem dados** (doc inexistente OU usuário sem entry naquela fase): Posição e métricas exibem `-` (placeholder textual; não esconder o card). Pela imagem, a Final aparece com `-`/0.
  - Estado por card: cada fase tem sua própria query → enquanto carrega, skeleton no card; erro no card → mensagem curta + retry local (ou estado agregado — ver OQ3).
- **Por Grupo:**
  - `GroupSelector`: lista de grupos A–L como chips selecionáveis (radiogroup/segmented). Origem dos grupos: ver OQ2 (sem constante central de grupos hoje; `match.groupId` é a fonte). Alvo ≥44px; grupo ativo destacado por cor + peso + `aria-pressed`/`aria-current` (cor não é único indicador).
  - Ao selecionar grupo → `useGroupRanking(groupId)`; lista ordenada por `position` (já vem ordenada do doc).
  - Linha: posição, avatar (iniciais fallback), nome (`name` → fallback `nickname`), apelido, **Acertos** (`points`) + **Aproveitamento** (`accuracy` ou `-`).
  - **Destaque "Você":** `entry.uid === firebaseUser?.uid` → `bg-primary/10` + badge "Você". Cor não é único indicador (badge textual).
  - Linha clicável → `/rankings/perfil/{uid}` (`next/link`, alvo ≥44px) — consistente com Tela 01.
- **Compat doc antigo:** `name`/`accuracy` podem ser `undefined` (entries antigas só com `{uid,nickname,position,points}`) → fallback de nome para `nickname`; accuracy → `-`.
- **Sub-abas:** Shadcn `Tabs`; "Por Fase" default. Estado da aba pode ser local (`useState`) — deep-link de sub-aba não é requisito (a rota já é `/rankings/fase`).

## 7. Contracts and interfaces

```tsx
// PhaseRanking.tsx — orquestrador, sem props (consome hooks + auth)
export function PhaseRanking(): JSX.Element;

// Subcomponentes internos (não precisam ser exportados):
// StageRankingCards()                         -> itera as 5 fases
// StageRankingCard({ scope, label, Icon })    -> card-resumo de UMA fase
// GroupRankingView()                          -> seletor + lista do grupo
// GroupSelector({ groups, value, onChange })  -> chips A–L
// RankingRow({ entry, isCurrentUser })        -> linha (reuso TASK-08 se exportado)
```

Tipos/constantes:

```tsx
import type { RankingScope } from "@/types"; // "geral" | "grupos" | "oitavas" | ...
import type { LucideIcon } from "lucide-react";

// Fases de ranking exibidas na aba "Por Fase" (exclui "geral"). Constante dedicada (sem hardcode espalhado).
const STAGE_CARDS: ReadonlyArray<{ scope: Exclude<RankingScope, "geral">; label: string; Icon: LucideIcon }>;
// ex.: { scope: "grupos", label: "Fase de Grupos", Icon: Users }
//      { scope: "oitavas", label: "Oitavas de Final", Icon: Network }  (ícone de chaveamento)
//      { scope: "quartas"/"semifinal"/"final", label: ..., Icon: Trophy/Medal }
```

Consome `RankingEntry` (TASK-01): `{ uid, nickname, name?, position, points, wrong?, accuracy? }`. Hooks: `useRanking(scope) → UseQueryResult<Ranking|null>`, `useGroupRanking(groupId|undefined) → UseQueryResult<GroupRanking|null>` (desabilitado sem `groupId`).

## 8. Data and persistence impact

Nenhum (somente leitura via hooks). Sem escrita. Lê docs `rankings/{scope}` (5 fases) e `rankings/grupo-{groupId}` já gravados pelo recalc (TASK-03).

## 9. Required tests

Recommended TDD: **no**. Testes leves (recomendados, não bloqueantes), padrão jsdom (`// @vitest-environment jsdom`) com QueryClientProvider:

- `StageRankingCard`: dado um `Ranking` com a entry do usuário → renderiza `#position` + acertos; sem entry/sem doc → `-`.
- `GroupRankingView`: troca de grupo dispara nova query (mock do hook por groupId); destaque "Você" aplicado à linha certa.
- Não testar markup frágil de tabs nem layout.

## 10. Acceptance criteria

- [ ] `/rankings/fase` renderiza sub-abas "Por Fase" / "Por Grupo" (Shadcn Tabs), "Por Fase" default.
- [ ] "Por Fase": 5 cards (Grupos, Oitavas, Quartas, Semifinal, Final) com ícone + `#posição` do usuário + Acertos + Aproveitamento; fase sem dados → `-`.
- [ ] "Por Grupo": seletor A–L + ranking do grupo selecionado (posição, nome/apelido, acertos, aproveitamento) com destaque "Você".
- [ ] Estados loading (skeleton), empty (sem participantes/sem grupo), error (+ retry) ligados às queries.
- [ ] Sob binário, sem duplicar Pontos/Acertos (exibe Acertos + Aproveitamento).
- [ ] Linha do grupo navega ao perfil; alvos ≥44px; seletor de grupo ≥44px.
- [ ] tsc strict, sem `any`, sem hex/inline; Lucide named; tema `.ranking-theme`; suite verde. `/screen` (ai/screen/ranking-task-09.md) consumido.

## 11. UI/Screen requirement

- Requires screen: **yes** — `/screen` antes do `/implement`.
- Platform: web (mobile-first)
- Screens involved: Tela 03 Ranking por Fase + Por Grupo (`PRD05-03-Ranking-Por-Fase.png`)
- Product type: leaderboard/stats dashboard (consumer, mobile-first)
- Recommended style: tema verde escopo (`.ranking-theme`), cards Shadcn por fase, segmented tabs, números `tabular-nums`, ícone por fase
- Applicable UX domains: style, layout, ux

### Accessibility requirements

- Sub-abas via `Tabs` acessível (`role="tablist"`/`tab`/`tabpanel`, foco por teclado, `aria-selected`). Cards de fase como lista semântica. Lista por grupo como lista semântica (`<ol>`/`<ul>`). Contraste do destaque "Você" ≥4.5:1 (texto) / ≥3:1 (fundo). Ícones de fase `aria-hidden`; posição/métrica com rótulos textuais visíveis ("Posição", "Acertos", "Aproveitamento"). Seletor de grupo: cor não é único indicador (peso/borda + `aria-pressed`/`aria-current`); alvos ≥44px. `tabular-nums` p/ alinhamento. Foco visível; ordem de tab = visual. Suporte a text scaling. Reduced-motion no skeleton.

### Interaction requirements

- Trocar sub-aba e selecionar grupo via tap (não hover); feedback de press 80–150ms; ≥8px entre alvos; tap na linha do grupo → perfil; loading via skeleton (>300ms); erro com retry.

### UI states required

- loading (RankingSkeleton por aba/card), empty (RankingEmptyState — "Nenhum dado para esta fase/grupo"), error (RankingErrorState + retry), populated (cards por fase / lista por grupo), destaque "Você", placeholder `-` em fase sem dados, sub-aba ativa.

## 12. Constraints

- Sem `any`; TS strict; Tailwind tokens (sem hex/inline); Lucide named imports; `next/link`.
- Reusar Shadcn `tabs`/`avatar`/`badge`/`button`, estados TASK-07, hooks TASK-05, `RankingRow` da TASK-08 (se exportável). Não refazer ordenação (vem do doc).
- `"use client"` nos componentes (usam hooks/auth/state).
- Mobile-first; respeitar `pb-20` (Bottom Tab Bar). Tema `.ranking-theme` herdado do shell (TASK-07) — não reaplicar.
- Rótulos de fase/grupo via constante dedicada (sem hardcode espalhado).

## 13. Open questions (resolver no /screen)

- **OQ1 — Rótulo da métrica no card de fase:** imagem mostra "Pontos" + "Acertos" (modelo 3/1/0 descartado). Default proposto: exibir **Acertos** (= points) + **Aproveitamento** (métricas distintas e reais). Alternativa: manter só "Pontos". `/screen` decide o rótulo final vs imagem.
- **OQ2 — Origem da lista de grupos (A–L) no `GroupSelector`:** não há constante central de grupos hoje (`match.groupId` é a fonte; grupos da Copa 2026 = A–L, 12 grupos). Default proposto: constante dedicada `GROUP_IDS = ["A".."L"]` no escopo da feature (sem hardcode espalhado), validando contra docs existentes. Confirmar quantidade (12 grupos / 48 seleções) e se deve filtrar só grupos com doc gravado.
- **OQ3 — Granularidade de loading/error na aba "Por Fase":** cada card tem query própria (5 queries). Default: skeleton/erro **por card** (degradação graciosa — uma fase falha sem derrubar as outras). Alternativa: estado agregado único. `/screen` confirma.
- **OQ4 — Grupo default na aba "Por Grupo":** primeiro grupo com doc disponível vs "A" fixo vs nenhum selecionado (placeholder "selecione um grupo"). Default proposto: "A" (ou primeiro disponível).
- **OQ5 — Linha do grupo navega ao perfil?** Default proposto: sim (consistente com Tela 01). Depende de A5 (visibilidade de perfil alheio) já assumido aberto no plano — perfil em si é público; só "ver histórico de palpites" é bloqueado (TASK-12).
