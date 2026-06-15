# PRD — Ranking Profile Revamp

> PRD-14 | Feature: redesign da tela `/rankings/profile/[uid]`

---

## 1. Feature summary

Redesign completo da tela de perfil de participante no ranking. Hoje a tela exibe cards
redundantes (Pontos ≡ Acertos na pontuação binária), fases futuras vazias e nenhum
histórico de palpites. O objetivo é eliminar o ruído visual, introduzir contexto real
(palpite × resultado × status do jogo) agrupado por fase, e diferenciar a experiência
de quem acessa **o próprio perfil** versus **o perfil de outro participante**.

---

## 2. Consolidated scope

### 2.1 Contexto de acesso (bifurcação obrigatória)

| Contexto | uid da URL | O que exibe |
|---|---|---|
| **Próprio perfil** | `uid === currentUser.uid` | Stats limpas + histórico **completo** de palpites (todos os status de jogo) |
| **Perfil alheio** | `uid !== currentUser.uid` | Stats limpas + palpites **apenas de jogos encerrados** (`match.status === "finished"`) |

A bifurcação deve ser clara na UI — título "Meu Perfil" vs. nome do participante.

#### DECISÃO TRAVADA — visibilidade de palpites alheios (anti-cola)

Palpite de outro participante é exibido **somente para jogos finalizados** (`status === "finished"`).
Jogos agendados/ao-vivo de outro user **não** aparecem (evita copiar aposta antes do resultado).

**Por que NÃO basta afrouxar Firestore Rules:** as Rules não conseguem ler `match.status`/`kickoffAt`
(partidas não estão no Firestore — vêm de Route Handler). Abrir a Rule `predictions` para leitura
ampla vazaria palpites de jogos não-encerrados = brecha de cola. A regra A5 (`firestore.rules:81-83`)
**permanece** `read: if isApproved() && (isOwner || isAdmin)`.

**Implementação:** novo Route Handler `GET /api/predictions/[uid]` (Admin SDK) que:
1. autentica a sessão (approved)
2. busca palpites do `uid` alvo via Admin SDK (bypassa Rules por design)
3. cruza com `getEffectiveMatches()` e **filtra server-side** só `status === "finished"`
4. retorna apenas os palpites de jogos encerrados

Espelha exatamente o padrão de escrita server-side já existente. Quando `uid === currentUser.uid`,
o client usa o caminho direto `listPredictionsByUid` (Client SDK, todos os jogos) — não passa pelo Route Handler.

### 2.2 Seção de identidade (ambos os contextos)

- Avatar (fallback iniciais)
- Nome completo / nickname
- Posição no pool + total de participantes
- Percentil implícito (ex.: "Top 12%")

### 2.3 Cards de métricas (ambos os contextos) — limpeza obrigatória

**Remover** o card "Acertos" duplicado (Pontos === Acertos no modelo binário atual — exibir
apenas "Acertos" para não confundir).

Grade 2 × 2 proposta:
| Card | Fonte |
|---|---|
| Acertos | `entry.points` (binário) |
| Erros | `entry.wrong ?? stats.totalWrong` |
| Aproveitamento | `entry.accuracy` |
| Sequência Máx. | `stats.longestStreak` |

### 2.4 Desempenho por fase (ambos os contextos) — limpeza obrigatória

Exibir apenas fases com pelo menos 1 acerto registrado (`correctByStage[scope] > 0`).
Fases futuras com valor `0` ou ausente devem ser omitidas (não "—").

### 2.5 Histórico de palpites (apenas próprio perfil)

Dados por item:
- Equipes (nome + bandeira)
- Palpite: `homeScore × awayScore`
- Resultado real: `match.homeScore × match.awayScore` (ou "—" se não finalizado)
- Status do jogo: badge `scheduled` / `live` / `finished` / `postponed` / `canceled`
- Status do palpite: badge `PredictionDisplayStatus` (Acertou / Acertou o vencedor / Acertou o empate / Errou / Pendente / Bloqueado)

#### Agrupamento hierárquico

```
Fase de Grupos
  └── Grupo A
        └── [partidas do grupo A ordenadas por kickoffAt]
  └── Grupo B
        └── ...
  └── ... (até Grupo L)

Fase Eliminatória
  └── Dezesseis Avos de Final
  └── Oitavas de Final
  └── Quartas de Final
  └── Semifinal
  └── Disputa 3º Lugar
  └── Final
```

Regras de agrupamento:
- `match.stage === "grupos"` → bucket "Fase de Grupos" → sub-bucket `match.groupId` (A–L)
- Demais stages → bucket "Fase Eliminatória" → sub-bucket por stage label
- Grupos A–L: ordem alfabética
- Matches dentro de cada sub-bucket: `kickoffAt ASC`
- Fases eliminatórias sem nenhum palpite do usuário: ocultar (secção vazia não renderizada)
- Grupos sem palpite: exibir placeholder vazio "Nenhum palpite neste grupo"

### 2.6 Possibilidades adicionais analisadas

| Opção | Viabilidade | Observação |
|---|---|---|
| Contador "X de Y palpites feitos" | Alta | Fácil derivação: `predictions.length / matches.length` |
| Card "DNA do palpiteiro" (perfil de aposta) | Alta | Derivável de `predictions`: tendência otimista/cauteloso, placar favorito, média de gols. Zero API nova |
| Comparação "Você × Ele" no perfil alheio | Alta | Usa `rankings`/`statistics` (públicos). Sem expor palpite — só contagens |
| Mini gráfico de evolução de posição | Alta | `EvolutionLineChart` já existe em `rankings/components/charts` |
| Filtro por status de palpite (Acertos/Erros/Pendentes) | Média | Chips reusam padrão `PredictionFilters` de predictions |
| Palpites alheios de jogos encerrados | **APROVADO** | Via Route Handler com filtro `status === "finished"` (ver 2.1) |
| Palpites alheios de jogos não-encerrados | Bloqueado | Anti-cola — não implementar |

---

## 3. System understanding relevant to this feature

### 3.1 Tela atual

`src/features/rankings/components/ParticipantProfile.tsx`

- Busca ranking do pool do espectador (`usePoolRanking(myGroupId)`) para encontrar `entry` pelo uid
- Busca estatísticas do perfil alvo (`useParticipantProfile(uid)`)
- Não diferencia próprio perfil de perfil alheio
- Palpites de outro participante explicitamente omitidos (comentário A5 / TASK-14)

### 3.2 Bloqueio de privacidade (Firestore Rules)

```
predictions/{id} — read: approved owner only (request.auth.uid == uid)
```

Palpites de outro participante são **negados pelas Rules** no Client SDK. Não existe
Route Handler público que os exponha. Decisão de produto: palpites são privados.

### 3.3 Dados disponíveis para palpites do próprio usuário

- `listPredictionsByUid(uid)` — service existente, Client SDK direto
- `usePredictions(uid)` — hook existente, wrap TanStack Query
- `useMatches()` — hook existente, serve todas as partidas via `/api/matches`
- `useTeams()` — hook existente
- `derivePredictionDisplayStatus(prediction, match, now)` — função pura existente
- `PredictionListItem` em `usePredictionsList` — quase tudo está lá, mas **faltam**
  `match.homeScore`, `match.awayScore`, `match.status`, `match.stage`, `match.groupId`

### 3.4 Stage / group metadata

Cada `MatchWithId` tem `stage: stageSchema` e `groupId: string | null | undefined`.
A fase "grupos" é a única com `groupId` preenchido (A–L). Eliminatórias têm `groupId === null`.

### 3.5 Componentes reutilizáveis existentes

- `EvolutionLineChart` — gráfico de posição ao longo do tempo
- `PREDICTION_DISPLAY_STATUS_LABEL` + `PREDICTION_DISPLAY_STATUS_COLOR` — badges de palpite
- `Avatar` / `AvatarFallback` — identidade
- `RankingSkeleton` / `RankingErrorState` / `RankingEmptyState` — estados de loading/erro

---

## 4. Technical impact analysis

### 4.1 Módulos afetados

| Módulo | Impacto |
|---|---|
| `src/features/rankings/components/ParticipantProfile.tsx` | Rewrite completo |
| `src/features/rankings/hooks/` | Novo hook `useProfilePredictions` |
| `src/features/predictions/hooks/usePredictionsList.ts` | Possível extensão de tipo ou fork do tipo `PredictionListItem` |
| `src/features/rankings/components/` | Novos sub-componentes: `ProfilePredictionsList`, `PredictionGroupSection`, `PredictionMatchRow` |
| Testes: `__tests__/ParticipantProfile.test.tsx` | Atualização obrigatória |

### 4.2 Novo hook: `useProfilePredictions`

Localização: `src/features/rankings/hooks/useProfilePredictions.ts`

**Dois caminhos de leitura conforme o contexto (`isSelf`):**

| Contexto | Fonte de palpites | Cobertura |
|---|---|---|
| Próprio (`uid === me`) | `listPredictionsByUid(uid)` — Client SDK direto | todos os jogos |
| Alheio (`uid !== me`) | **`GET /api/predictions/[uid]`** — Route Handler Admin SDK | só `status === "finished"` |

Orquestra:
1. fonte de palpites condicional (Client SDK self / Route Handler alheio)
2. `useMatches()` — sempre ativo (usado para join + filtro de status)
3. `useTeams()` — sempre ativo

Retorna `ProfilePredictionItem[]`:
```typescript
interface ProfilePredictionItem {
  matchId: string;
  kickoffAt: string;
  stage: Stage;           // novo campo vs PredictionListItem
  groupId: string | null; // novo campo vs PredictionListItem
  homeTeam: ResolvedTeam;
  awayTeam: ResolvedTeam;
  prediction: { homeScore: number; awayScore: number };
  actualScore: { homeScore: number; awayScore: number } | null; // novo
  matchStatus: MatchStatus; // novo
  displayStatus: PredictionDisplayStatus;
  isManual: boolean;
}
```

### 4.3 Lógica de agrupamento (pura, testável)

Nova função em `src/features/rankings/lib/profilePredictionsGrouping.ts`:

```
groupProfilePredictions(items: ProfilePredictionItem[]): PredictionBucket[]
```

Onde `PredictionBucket` é uma hierarquia de dois níveis (fase > sub-fase/grupo).

### 4.4 Contracts e APIs

**NOVO Route Handler:** `GET /api/predictions/[uid]`
- Runtime `nodejs`, `dynamic = "force-dynamic"`
- Auth: `verifySessionCookie` → re-check `status === "approved"`
- Busca palpites do `uid` alvo via Admin SDK
- Cruza com `getEffectiveMatches()` e filtra **só `status === "finished"`** server-side
- Retorna `Prediction[]` (apenas jogos encerrados)
- Erros tipados pt-BR (mesma convenção de `PredictionServiceError`)

Demais dados já existem:
- `/api/matches` — usado por `useMatches()`
- Firestore `predictions` (próprio) — Client SDK com Rules existentes
- Firestore `rankings` + `statistics` — hooks existentes

### 4.5 Sem impacto em

- **Firestore Rules** (A5 permanece — leitura cruzada bloqueada no Client SDK; o acesso alheio passa pelo Admin SDK no novo Route Handler)
- Schemas / Zod (reusa `predictionSchema`)
- Recalc / pontuação
- Admin panel

---

## 5. Risks

| Risco | Severidade | Mitigação |
|---|---|---|
| Anti-cola: vazar palpite alheio de jogo não-encerrado | **Alta** | Filtro `status === "finished"` é server-side no Route Handler (Admin SDK) — cliente nunca recebe palpite de jogo aberto. Rules A5 seguem bloqueando o caminho Client SDK |
| Route Handler retornar jogo "finished" que depois reabre (raríssimo) | Baixa | `getEffectiveMatches()` é a fonte autoritativa; reflete overrides manuais |
| PredictionListItem type divergence | Média | Criar novo tipo `ProfilePredictionItem` no contexto de rankings, não estender o tipo de predictions para não criar acoplamento cross-feature |
| groupId nulo em matches eliminatórios | Média | Guard explícito: `groupId ?? null`; subgrupo "Fase Eliminatória" não usa groupId |
| Copa Mundo 2026 — dezesseis-avos não mapeia para `rankingScopeSchema` | Baixa | Stage "dezesseis-avos" existe em `stageSchema`; apenas não tem ranking próprio. Label adequado na UI |
| Matches sem palpite em grupos com palpite parcial | Baixa | Mostrar placeholder "Sem palpite" na linha, sem omitir o grupo inteiro |
| EvolutionLineChart — regressão se incluído sem dados | Baixa | Wrap com guard: `stats.positionHistory.length > 0` |

---

## 6. Ambiguities and gaps

> **TODAS AS DECISÕES TRAVADAS** (usuário aprovou o recomendado).

| # | Ambiguidade | DECISÃO |
|---|---|---|
| A1 | Perfil alheio: seção "Desempenho por Fase"? | **Manter** — Statistics são públicos (approved lê) |
| A2 | Contador "X de Y palpites": denominador? | **Jogos com kickoff já passado** (ex.: "18 de 20"). Não usar 104 totais |
| A3 | Gráfico de evolução de posição | **V2** — fora do escopo desta entrega |
| A4 | Grupo sem nenhum palpite | **Mostrar sub-bucket vazio** com placeholder. Próprio: "Nenhum palpite neste grupo"; alheio: "Jogos ainda não encerrados" |
| A5 | Dezesseis-avos: label na UI | **"Dezesseis Avos de Final"** pt-BR |
| A6 | Ordenação eliminatórias | **Por stage enum natural**: dezesseis-avos → oitavas → quartas → semifinal → terceiro → final |
| A7 | Accordion: abertura padrão | **Fase atual aberta**, resto colapsado. Usa `deriveCurrentStage` (já existe) |

### Escopo V1 confirmado

✅ Bifurcação meu/alheio · ✅ Limpeza de cards (remover Acertos≡Pontos) · ✅ Histórico em accordion (grupos A–L + eliminatórias) · ✅ Palpites alheios só de jogos encerrados · ✅ Card DNA do palpiteiro · ✅ Comparação "Você × Ele" no perfil alheio

⏳ **V2** (fora desta entrega): filtro chips por status · gráfico de evolução · badge de raridade

---

## 7. Recommended implementation concerns

1. **Bifurcação por identidade primeiro**: detectar `isSelf` no topo do componente e
   separar renderização de palpites. Não condicionar dentro de sub-componentes.

2. **Hook isolado no ranking feature**: `useProfilePredictions` pertence a `rankings/hooks`,
   não deve reusar `usePredictionsList` (acoplamento cross-feature). Reutilizar apenas
   as funções puras de `predictions/lib` (`derivePredictionDisplayStatus`).

3. **Função de agrupamento pura e testável**: toda a lógica de agrupamento em
   `rankings/lib/profilePredictionsGrouping.ts` com testes unitários — não inline no componente.

4. **Fases vazias**: lógica de ocultação de seção (fase de grupos sem palpites, eliminatória
   sem dados) deve ser determinística: uma fase aparece se e somente se tem pelo menos
   um item na lista depois do filtro.

5. **Sem regressão no perfil alheio**: o `StagePerformance` existente (só fases com dados)
   e o `ProfileStatsGrid` (sem duplicação de Acertos) devem funcionar igualmente no
   contexto de perfil alheio.

6. **Testabilidade**: `ParticipantProfile` atual tem teste em `__tests__/ParticipantProfile.test.tsx`;
   o rewrite deve manter cobertura de: (a) perfil não encontrado, (b) perfil alheio, (c) próprio perfil.

7. **Acessibilidade**: use `<section>` + `<h2>`/`<h3>` semânticos para navegação por leitores
   de tela; badges de status com `aria-label` descritivo.

---

## 8. Mockups de referência (layout aprovado)

> Mobile-first (app pt-BR, alvo mobile). Referência visual — o `/ui-spec` detalha tokens/estados.

### 8.1 Meu Perfil

```
┌─────────────────────────────────┐
│  ←  Meu Perfil                   │
├─────────────────────────────────┤
│            ╭─────╮               │
│            │ WL  │   ← avatar    │
│            ╰─────╯               │
│         Welton Lima              │
│           @welton                │
│                                  │
│   ┌───────────────────────────┐ │
│   │   #3   de 24 · Top 12%    │ │  ← posição + percentil
│   └───────────────────────────┘ │
│                                  │
│   ┌────────┬────────┬─────────┐ │
│   │   18   │   12   │   60%   │ │
│   │Acertos │ Erros  │Aproveit.│ │  ← 3 cols, SEM duplicar Pontos
│   └────────┴────────┴─────────┘ │
│                                  │
│   Sequência atual               │
│   ● ● ● ○ ● ● ●   (máx: 5)      │  ← bolinhas verde/cinza
│                                  │
├─────────────────────────────────┤
│  🧬 Seu DNA de palpiteiro        │
│   ┌───────────────────────────┐ │
│   │ Perfil:    Otimista 🔥    │ │
│   │ Placar fav: 2 × 1         │ │
│   │ Média gols: 3.2 / jogo    │ │
│   └───────────────────────────┘ │
├─────────────────────────────────┤
│  📋 Meus Palpites      18 de 20  │  ← contador (kickoff passado)
│                                  │
│  ▼ Fase de Grupos      14/30 ✓  │  ← accordion ABERTO (fase atual)
│   ┌───────────────────────────┐ │
│   │ ▼ Grupo A          3/3 ✓  │ │
│   │   🇧🇷 BRA 2-1 SRB 🇷🇸      │ │
│   │   palpite 2-1 · ✅ Acertou│ │
│   │   ───────────────────────  │ │
│   │   🇧🇷 BRA 1-0 SUI 🇨🇭      │ │
│   │   palpite 3-0 · 🟢 Venced.│ │
│   │   ───────────────────────  │ │
│   │   🇷🇸 SRB 0-2 SUI 🇨🇭      │ │
│   │   palpite 1-1 · ❌ Errou  │ │
│   ├───────────────────────────┤ │
│   │ ▶ Grupo B          2/3 ✓  │ │  ← colapsado
│   │ ▶ Grupo C          0/3    │ │  ← vazio explícito (A4)
│   └───────────────────────────┘ │
│                                  │
│  ▶ Fase Eliminatória    4/12 ✓  │  ← accordion FECHADO
│                                  │
└─────────────────────────────────┘
```

### 8.2 Perfil de Outro Participante (palpites SÓ de jogos encerrados)

```
┌─────────────────────────────────┐
│  ←  Perfil                       │
├─────────────────────────────────┤
│            ╭─────╮               │
│            │ JS  │               │
│            ╰─────╯               │
│          João Silva              │
│            @joao                 │
│                                  │
│   ┌───────────────────────────┐ │
│   │   #1   de 24 · Top 4%     │ │
│   └───────────────────────────┘ │
│                                  │
│   ┌────────┬────────┬─────────┐ │
│   │   24   │    6    │   80%   │ │
│   │Acertos │ Erros  │Aproveit.│ │
│   └────────┴────────┴─────────┘ │
│                                  │
├─────────────────────────────────┤
│  ⚔️  Você × João                 │  ← comparação (dados públicos)
│   ┌───────────────────────────┐ │
│   │  Você #3  ······  #1 João │ │
│   │  18 pts          24 pts   │ │
│   │  ─────────────────────────│ │
│   │  Atrás por 6 pontos       │ │
│   │  Ele acertou 4 jogos      │ │
│   │  que você errou           │ │
│   └───────────────────────────┘ │
│                                  │
├─────────────────────────────────┤
│  📋 Palpites de João             │
│  (apenas jogos encerrados)       │  ← legenda anti-cola
│                                  │
│  ▼ Fase de Grupos      20/24 ✓  │
│   ┌───────────────────────────┐ │
│   │ ▼ Grupo A          3/3 ✓  │ │
│   │   🇧🇷 BRA 2-1 SRB 🇷🇸      │ │
│   │   palpite João 2-1·✅Acert│ │
│   ├───────────────────────────┤ │
│   │ ▶ Grupo D          2/3 ✓  │ │
│   │ ▶ Grupo E   Jogos não      │ │  ← contexto alheio (A4)
│   │             encerrados     │ │
│   └───────────────────────────┘ │
│                                  │
│  ▶ Fase Eliminatória            │  ← oculta se sem jogo encerrado
│                                  │
└─────────────────────────────────┘
```

> Nota: no perfil alheio, jogos agendados/ao-vivo **não aparecem** — apenas `status === "finished"`.
> Grupo sem jogo encerrado mostra "Jogos não encerrados" (diferente de "Nenhum palpite" do próprio perfil).

### 8.3 Linha de palpite — estados

```
FINALIZADO:
  🇧🇷 BRA  2-1  SRB 🇷🇸
  seu palpite: 2-1 · ✅ Acertou           (verde)

AO VIVO (só próprio perfil):
  🇧🇷 BRA  1-1  SUI 🇨🇭   🔴 AO VIVO
  seu palpite: 2-0 · ⏳ Em jogo           (âmbar)

AGENDADO sem palpite (só próprio perfil):
  🇧🇷 BRA   vs   CMR 🇨🇲   ⏰ 16/jun 13h
  ⚠️ Você ainda não palpitou  [Palpitar]  (CTA)
```

### 8.4 Decisões de layout embutidas

- **Accordion** em vez de lista plana — 104 jogos não rolam numa tela. Fase atual aberta (A7).
- **Header de grupo com resumo** (`3/3 ✓`) — desempenho visível sem expandir.
- **3 colunas de métrica** — removido "Pontos≡Acertos".
- **Comparação** ocupa o espaço morto do perfil alheio.
- **Legenda anti-cola** explícita no perfil alheio.
