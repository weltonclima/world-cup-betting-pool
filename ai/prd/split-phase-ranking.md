# PRD — Divisão de ranking por fase (grupos × eliminatória), opt-in por pool

> Feature slug: `split-phase-ranking`. Origem: `ai/diagnose/ranking-split-grupos-eliminatorias.md`.

## 1. Feature summary
Permitir que o admin de um pool ative uma **divisão de exibição** do ranking:
em vez do ranking `geral` cumulativo (que soma pontos da fase de grupos + fase
eliminatória), as telas passam a mostrar **dois rankings separados** — "Grupos"
e "Eliminatórias". A divisão é uma **flag por pool** (`splitPhaseRanking`),
opt-in, default OFF (mantém o comportamento atual). É puramente de **exibição**:
o motor de recálculo (`recalc.ts`) já persiste os dois conjuntos de pontos por
escopo; nada na pontuação ou no banco muda.

## 2. Consolidated scope

**Em escopo:**
1. **Persistência** — novo campo `pools.splitPhaseRanking?: boolean` (aditivo,
   optional, default `false` na leitura). Espelha o padrão de `predictionsLocked`
   / `allowInvites` em `src/schemas/pools.ts`.
2. **Toggle admin** — group_admin liga/desliga no dashboard do grupo
   (`/api/group/settings` GET+PATCH + UI de settings), espelhando o toggle
   `predictionsLocked` já existente. Super_admin: incluir no `poolEditSchema`
   / fluxo de edição de pool (PRD-11).
3. **Leitura da flag pelo membro** — as telas de membro precisam conhecer o
   valor da flag do próprio pool para decidir o que renderizar. Hoje a config do
   pool só é legível por group_admin (`/api/group/settings`). É preciso expor
   `splitPhaseRanking` a membros aprovados (ver §6 — opções).
4. **`/rankings` (GeneralRanking)** — flag ON → renderiza duas seções/abas lado
   a lado: "Grupos" (escopo `grupos`, doc `pool-{poolId}-grupos`) e
   "Eliminatórias" (escopo `eliminatorias`, doc `pool-{poolId}-eliminatorias`).
   Flag OFF → mantém o `geral` cumulativo atual.
5. **Home** (`useHomeDashboard` → hero rank+percentil) e **Perfil do
   participante** (`ParticipantProfile`) — quando ON, refletir a divisão (ver
   ambiguidade §6 sobre telas de rank único).

**Fora de escopo (não-objetivos):**
- Mudar a regra de pontuação ponderada (10/5/0) — ver [[scoring-weighted]].
- Reprocessar rankings, zerar ou migrar dados no Firestore.
- Criar novos escopos de ranking — `grupos` e `eliminatorias` já existem.
- Qualquer mudança visível em pools com a flag OFF (retrocompat total).

## 3. System understanding relevant to this feature

- **Recálculo** (`src/server/rankings/recalc.ts`): já grava, por pool, os docs
  `pool-{poolId}-geral` (cumulativo, `pointsGeral`), `pool-{poolId}-grupos`
  (linhas 441-482) e `pool-{poolId}-eliminatorias` (agregado mata-mata, 513-525),
  além de `pool-{poolId}-{oitavas|quartas|semifinal|final}` e
  `pool-{poolId}-grupo-{A-L}`. **O dado da divisão já existe.**
- **Leitura de ranking** (telas):
  - `usePoolRanking(groupId)` → `GET /api/rankings/pool` → `pool-{groupId}-geral`.
    Consumido por: `GeneralRanking.tsx:115`, `useHomeDashboard.ts:69`,
    `ParticipantProfile.tsx:73`.
  - `usePoolRankingByScope(scope)` → `GET /api/rankings/[scope]` → doc pool-scoped
    `pool-{groupId}-{scope}` (resolvido pela sessão). Já usado por
    `PhaseRanking.tsx` para exibir grupos/eliminatorias/fases.
  - Isolamento multi-tenant: o `groupId` vem SEMPRE da sessão, nunca do request.
- **Config do pool**:
  - `pools` schema (`src/schemas/pools.ts`) — flags aditivas optional, default
    na leitura.
  - `GET/PATCH /api/group/settings` — group_admin, `.strict()`; padrão exato de
    `predictionsLocked` a copiar.
  - `poolEditSchema` — PATCH super_admin (PRD-11).
- **Já existe a tela `/rankings/phase` (PhaseRanking)** com grupos +
  eliminatórias + fases. A feature NÃO substitui essa tela; ela muda o que a
  tela **principal** (`/rankings`) e as telas dependentes mostram quando a flag
  está ON.

## 4. Technical impact analysis

- **Schema/persistência**: +1 campo optional em `poolSchema`, `settingsSchema`
  (group/settings) e `poolEditSchema` (super_admin). Aditivo — docs antigos
  continuam fazendo parse. Sem migração.
- **API**:
  - `PATCH /api/group/settings` — aceitar e persistir `splitPhaseRanking`.
  - `GET /api/group/settings` — já retorna o pool inteiro (flag inclusa).
  - **Leitura por membro** — expor a flag (decisão de design, §6).
  - `admin/groups/[id]` (super_admin) — incluir no PATCH se aplicável.
- **Frontend**:
  - `GeneralRanking.tsx` — ramo condicional: split → 2 rankings (reusar
    componentes de `PhaseRanking`/`StageRankingCard` ou abas), senão geral.
  - `useHomeDashboard` / hero — refletir divisão (§6).
  - `ParticipantProfile` — refletir divisão (§6).
  - UI de settings do group_admin — novo `Switch` (espelhar `predictionsLocked`).
- **Contratos React Query**: possível nova query-key para config do pool
  (member-readable); cache por `groupId`.
- **Performance/consistência**: split ON dispara 2 leituras de ranking
  (grupos + eliminatorias) em vez de 1 (geral). Mesma rota/recalc preguiçoso;
  impacto baixo. Sem concorrência nova.

## 5. Risks
- **Regressão em 3 telas** (`/rankings`, Home, Perfil) que hoje assumem `geral`.
  Ramo condicional precisa preservar 100% do comportamento OFF.
- **Exposição da config a membros**: se a flag for exposta por endpoint novo,
  garantir que NÃO vaze outros campos sensíveis do pool a membros comuns
  (retornar só o necessário). Risco de segurança se reusar `/api/group/settings`
  (hoje group_admin-only) sem cuidado.
- **Home hero / Perfil são telas de rank ÚNICO** — exibem uma posição/percentil.
  Com split, não há "uma" posição. Decisão de produto pendente (§6) pode mudar
  o tamanho do trabalho dessas telas.
- **Pools sem doc de fase ainda** (ex.: torneio só na fase de grupos): o doc
  `pool-{poolId}-eliminatorias` pode estar vazio/ausente — UI precisa de empty
  state gracioso.

## 6. Ambiguities and gaps — RESOLVIDAS no checkpoint do PRD
1. **Home hero + Perfil com split ON** → **RESOLVIDO: mostrar os dois lado a
   lado** (rank de Grupos E de Eliminatórias). Hero e Perfil ganham apresentação
   dupla quando a flag está ON.
2. **Como o membro lê a flag** → **RESOLVIDO: embutir `splitPhaseRanking` no
   payload de `/api/rankings/pool`** (a resposta do ranking carrega a flag).
   Sem endpoint novo de config. Atenção: `/api/rankings/pool` retorna `null`
   quando o usuário não tem pool — a flag só existe quando há ranking; telas
   tratam `null`/ausência como OFF.
3. **Super_admin** → **RESOLVIDO: só group_admin nesta entrega.** Toggle apenas
   no dashboard do grupo; `poolEditSchema`/console super_admin ficam fora de
   escopo agora.
4. **Rótulo/UX do split em `/rankings`** — abas (como PhaseRanking) vs. duas
   listas empilhadas. Decidir no `/ui-spec` (pendência de design, não bloqueia o
   plano).

## 7. Recommended implementation concerns
- Sequenciar: **persistência + flag (schema/API)** → **leitura member-readable
  da flag** → **toggle admin (UI)** → **`/rankings` split** → **Home/Perfil**.
- Resolver ambiguidade §6.1 e §6.2 no checkpoint do PRD ou no início do `/plan`.
- Reusar componentes de `PhaseRanking` para o split em `/rankings` (evita
  duplicar lista/pódio).
- Toggle admin: copiar 1:1 o fluxo de `predictionsLocked` (schema, route, UI,
  testes) — caminho de menor risco.
- Tudo gated por flag: garantir testes do ramo OFF (retrocompat) e do ramo ON.
