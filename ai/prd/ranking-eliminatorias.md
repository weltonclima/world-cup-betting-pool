# PRD — Ranking Fase Eliminatória (PRD-16)

> Originado de: conversa 2026-06-21 — preparação para Copa entrar em eliminatórias.
> Depende de: PRD-05 (ranking ponderado), PRD-03.2 (grupos e eliminatórias), PRD-09 (multi-tenant pools).

---

## 1. Feature Summary

Dois objetivos complementares:

**A. Análise de prontidão para as fases eliminatórias**
Confirmar que o pipeline de dados da Copa (ESPN → `getEffectiveMatches`) e o engine de palpites/bracket (`predictions/lib/bracket.ts`) preencherão automaticamente os slots das eliminatórias com os times reais conforme os resultados da fase de grupos forem publicados.

**B. Split de ranking: Fase de Grupos vs. Eliminatórias**
Criar uma separação visual e opcionalmente semântica no ranking — hoje tudo está numa tab "Por Fase" que mistura os 5 escopos sem hierarquia clara. O usuário quer que Fase de Grupos e Eliminatórias sejam divisões de primeiro nível, com os escopos de fase aparecendo como sub-divisão dentro de cada bloco.

Opcionalmente: adicionar um escopo agregado `eliminatorias` no backend que soma pontos de todos os rounds eliminatórios (oitavas + quartas + semifinal + final), permitindo ranquear quem foi melhor nas eliminatórias como um bloco único.

---

## 2. Consolidated Scope

### 2.1 Análise: preenchimento automático dos slots eliminatórios

**Palpites do usuário (bracket interativo):**
- Já funciona: `resolveSlotTeam()` em `predictions/lib/bracket.ts` mapeia placeholders (`"1A"`, `"2B"`, `"3A/B/C"`, `"W74"`) para os times previstos pelo usuário com base em `computeGroupStandings()`.
- Conclusão: **nenhuma mudança necessária** para o bracket preditivo do usuário.

**Dados reais (partidas reais das eliminatórias):**
- Pipeline: ESPN → `getEffectiveMatches()` → `/api/matches`.
- Quando a fase de grupos terminar, a ESPN publicará os `homeTeamId`/`awayTeamId` reais nos fixtures dos dezesseis-avos (ex.: o jogo 73 terá "BRA" no lugar de "1A").
- O mapper ESPN (`mapEspnEventsToMatches`) já lida com isso — ele retorna `teamId` real quando a ESPN tiver o dado; caso contrário, preserva o placeholder do openfootball.
- Conclusão: **nenhuma mudança necessária** no pipeline de dados para partidas reais.

**Ranking server-side:**
- `recalcRankings()` em `src/server/rankings/recalc.ts` pontua palpites contra partidas reais finalizadas.
- Pontos de eliminatória só aparecem quando há partidas reais `stage !== "grupos"` com `status === "finished"`.
- Quando a Copa entrar nas eliminatórias, o recalc-on-read (`ensureRankingsFresh`) detectará novos jogos finalizados via assinatura FNV-1a e recomputará os rankings de fase automaticamente.
- Conclusão: **nenhuma mudança necessária** no engine de recalc para começar a computar rankings eliminatórios.

### 2.2 Feature: Split visual Grupos / Eliminatórias no ranking

**Escopo principal — UI (`PhaseRanking.tsx`):**
Reorganizar a tab "Por Fase" em dois blocos visuais distintos:
- **Bloco 1: Fase de Grupos** — contém o card de escopo `grupos` + sub-seletor de grupo A–L.
- **Bloco 2: Eliminatórias** — contém cards de `oitavas`, `quartas`, `semifinal`, `final` (e possivelmente um card agregado `eliminatorias` se implementado).

A divisão deve ser visual (heading/separator), não necessariamente uma nova aba — manter a UX de tab única com scroll.

**Escopo backend (novo scope agregado `eliminatorias`) — D1/D2:**
Adicionar `"eliminatorias"` ao `rankingScopeSchema`.
- Somar pontos de `dezesseis-avos + oitavas + quartas + semifinal + final` por usuário (D2 — dezesseis-avos incluído no agregado).
- Persistir em `rankings/eliminatorias` e `rankings/pool-{groupId}-eliminatorias`.
- Exibir no bloco "Eliminatórias" como card de destaque (⭐), antes dos cards de fase individuais.
- Responde: "Quem foi melhor jogador das eliminatórias?"
- Dezesseis-avos NÃO ganha card de fase individual (só conta no agregado).

**Indicador de fase atual na Home (D3):**
Banner no dashboard Home mostrando a fase ativa da Copa (ex.: "Copa em: Oitavas de Final"), derivado da fase do próximo jogo não-finalizado (`status !== "finished"`, menor `kickoffAt`).

---

## 3. System Understanding Relevant to This Feature

### Rankings existentes (backend)
- `src/server/rankings/recalc.ts` — `RANKING_STAGE_SCOPES = ["grupos", "oitavas", "quartas", "semifinal", "final"]`
- Já computa e persiste `rankings/{scope}` e `rankings/pool-{groupId}-{scope}` para cada escopo.
- Pontuação ponderada: exato = 10pts, parcial = 5pts. Escopo de FASE `dezesseis-avos` não existe (PRD-05) — mas D2 traz os pontos de dezesseis-avos para o AGREGADO `eliminatorias` (sem criar card de fase).
- O agregado `eliminatorias` é um escopo NOVO, não pertence a `RANKING_STAGE_SCOPES` (que mapeia 1 stage → 1 scope). É computado somando múltiplas stages.

### Ranking scope schema
- `src/schemas/shared.ts` → `rankingScopeSchema = z.enum(["geral", "grupos", "oitavas", "quartas", "semifinal", "final"])`.
- `src/types/shared.ts` → `RankingScope` derivado do schema.
- Adicionar `"eliminatorias"` exige alterar este enum + types derivados + recalc + API routes + UI.

### UI de ranking de fase
- `src/features/rankings/components/PhaseRanking.tsx`:
  - `STAGE_CARDS` = array de 5 escopos sem distinção hierárquica.
  - Tab "Por Fase" exibe todos como peers; tab "Por Grupo" (A–L) separada.
  - Nenhuma separação visual Grupos vs. Eliminatórias.

### Hooks de ranking
- `usePoolRankingByScope(scope)` → `GET /api/rankings/pool/{scope}` — funciona para qualquer `RankingScope`.
- `useGroupRanking(groupId)` → leitura direta Firestore `rankings/grupo-{groupId}`.

### Data flow para bracket real
- ESPN: quando grupo termina → fixtures eliminatórios recebem times reais.
- `mapEspnEventsToMatches()` → `homeTeamId`/`awayTeamId` já resolvidos para teamId FIFA.
- Nenhum código de placeholder está no path dos dados reais; placeholders existem só nos dados do openfootball para os fixtures futuros.

---

## 4. Technical Impact Analysis

| Área | Impacto |
|---|---|
| `src/schemas/shared.ts` | Adicionar `"eliminatorias"` ao `rankingScopeSchema` (se escopo agregado for implementado) |
| `src/types/shared.ts` | `RankingScope` derivado — sem mudança manual se derivado via `z.infer` |
| `src/server/rankings/recalc.ts` | Novo scope `eliminatorias` = soma de `oitavas+quartas+semifinal+final` por usuário; persistir doc extra por recalc |
| `src/app/api/rankings/[scope]/route.ts` | Nenhuma mudança — schema já valida o scope; ao adicionar ao enum, aceita automaticamente |
| `src/app/api/rankings/pool/[scope]/route.ts` | Idem |
| `src/features/rankings/components/PhaseRanking.tsx` | Reorganizar `STAGE_CARDS` em dois blocos com separador; adicionar card `eliminatorias` se implementado |
| `src/features/rankings/hooks/usePoolRankingByScope.ts` | Nenhuma mudança — genérico por `RankingScope` |
| `RECALC_VERSION` em `recalc.ts` | Bumpar (shape dos docs muda com novo escopo `eliminatorias`) |
| Firestore | Novo doc `rankings/eliminatorias` + `rankings/pool-{id}-eliminatorias` por recalc |
| Auth/Rules | Nenhuma mudança — leitura de `rankings/*` já bloqueada para client; serve via Route Handler |
| Testes | `src/server/rankings/__tests__/recalc.test.ts` — adicionar cobertura do novo scope |

**Sem impacto em:**
- Pipeline de dados ESPN/openfootball (`matchSource.ts`) — dados reais de eliminatórias auto-preenchidos.
- Bracket preditivo do usuário (`predictions/lib/bracket.ts`) — já resolve placeholders via standings do usuário.
- Lógica de pontuação (`scorePrediction`) — inalterada.
- Auth flows, Firestore Rules, Cloud Functions.

---

## 5. Risks

| # | Risco | Severidade |
|---|---|---|
| R1 | Scope `eliminatorias` muda shape dos docs de ranking → RECALC_VERSION deve ser bumpado ou docs stale servem ranking zerado | Alta |
| R2 | ESPN pode demorar a publicar times reais nos dezesseis-avos (ex.: jogo 73 ainda mostra "1A" durante dias após término dos grupos) — dados de eliminatória aparecem mas sem time real, degradando UI do bracket | Média |
| R3 | Se `dezesseis-avos` continua excluído do ranking mas tem palpites pontuáveis, usuários podem se confundir: "palpitei mas não aparece no ranking de fase" — necessário comunicar claramente | Média |
| R4 | Agregar `eliminatorias` = soma de 4 escopos pode dar vantagem artificial a usuários que palpitaram em fases finais (mais jogos = mais pontos possíveis) vs. quem só chegou até oitavas (adversário caiu) — não é um bug mas pode gerar questionamentos | Baixa |
| R5 | Regressão no `PhaseRanking.tsx` ao reorganizar os cards — componente tem lógica de hover/active state e fetch por card | Baixa |

---

## 6. Decisions Locked (checkpoint 2026-06-23)

**D1 — Split = visual + scope agregado `eliminatorias` (Opção B).**
Reorganizar UI em dois blocos (Fase de Grupos / Eliminatórias) E criar novo scope backend `eliminatorias` que soma os pontos de todos os rounds eliminatórios. O card agregado aparece em destaque (⭐) no topo do bloco Eliminatórias, antes dos cards de fase individuais.

```
Por Fase
├─ FASE DE GRUPOS
│   └─ [card grupos] + seletor A-L
└─ ELIMINATÓRIAS
    ├─ [card ELIMINATÓRIAS — agregado] ⭐
    ├─ [card oitavas]
    ├─ [card quartas]
    ├─ [card semifinal]
    └─ [card final]
```

**D2 — `dezesseis-avos` entra no agregado `eliminatorias` (sem card de fase próprio).**
O scope agregado `eliminatorias` soma `dezesseis-avos + oitavas + quartas + semifinal + final`. Dezesseis-avos NÃO ganha card de ranking de fase individual (mantém a decisão do PRD-05 de não ter ranking de fase próprio), mas seus pontos contam no agregado. Reflete pontos de TODOS os rounds eliminatórios.

**D3 — Indicador de fase atual: na Home.**
Banner/indicador de fase atual da Copa no dashboard Home (ex.: "Copa em: Oitavas de Final"). Derivado da fase do próximo jogo não-finalizado (`status !== "finished"`, menor `kickoffAt`). Mais visível, maior impacto de UI.

## 6.1 Remaining gaps (aceitos)

- **Palpites de eliminatória sem time resolvido:** quando grupos terminam, slots não-preenchidos pelo usuário mostram placeholders; comportamento atual de `isBlocked` mantido (fora de escopo desta feature).

---

## 7. Recommended Implementation Concerns

1. **Começar pelo split visual (UI-only)** — impacto mínimo, valor imediato, sem mudança de schema. Reorganizar `STAGE_CARDS` em dois grupos (`grupos` / eliminatórias) com heading/separator. Pode ser entregue isoladamente.

2. **Scope `eliminatorias` como TASK separada** — adicionar ao schema, bumpar `RECALC_VERSION`, implementar no recalc como soma dos 4 escopos, testar que o recalc-on-read detecta novos finalizados de eliminatória e recomputa corretamente.

3. **Não alterar `dezesseis-avos`** por ora — excluir do agregado `eliminatorias` para manter consistência com PRD-05 original. Rever em PRD posterior se necessário.

4. **RECALC_VERSION bump é obrigatório** ao adicionar `eliminatorias` — deploy que muda shape sem bump vai servir docs stale sem o novo campo.

5. **Documentar claramente no UI** que `dezesseis-avos` não tem ranking de fase para evitar confusão quando a Copa chegar a essa fase.

6. **Confirmação: pipeline ESPN → eliminatórias é automático** — nenhum trabalho de backend necessário para que os times reais apareçam nos fixtures eliminatórios. O sistema funciona de forma transparente quando a ESPN publicar os times reais.
