# PLAN — Matches: Tabs Temporais + Palpite no Card + Borda de Bandeira

## 1. Planning summary

Feature frontend pura (3 melhorias na tela `/matches`), decomposta em 3 tasks:
foundation (lib pura + view-model), card presentacional (borda + palpite),
integração (tabs no compositor). Sem mudança de API, schema ou persistência.
Toda a lógica de classificação temporal é derivável de dados já carregados
(`useMatches + useTeams + usePredictions`). Risco baixo-médio, concentrado na
interação tabs × filtros existentes.

## 2. Recommended execution phases

- **Phase 1 – foundation**: helper puro de classificação temporal + campo
  `userPrediction` no view-model (TASK-01).
- **Phase 2 – presentation**: ajustes no `MatchCard` — borda de bandeira +
  exibição do palpite (TASK-02).
- **Phase 3 – integration**: tabs temporais no `MatchList`, ligando a lib pura
  ao estado de UI e à passagem de `userPrediction` (TASK-03).

## 3. Tasks

### TASK-01 – Lib pura de classificação temporal + userPrediction no view-model
- Type: domain
- Goal: Tornar disponíveis ao restante da UI (a) uma função pura que classifica
  um `dateKey` em `"anteriores" | "hoje" | "proximos"` e (b) o palpite do
  usuário em cada `MatchListItem`.
- Scope:
  - Adicionar `classifyDateKey(dateKey, todayKey): TemporalBucket` em
    `matchesHelpers.ts` (função pura, sem React). Exportar `toUtcDateKey` se
    necessário para reuso.
  - Adicionar tipo `TemporalBucket = "anteriores" | "hoje" | "proximos"`.
  - Adicionar campo `userPrediction: { homeScore: number; awayScore: number } | null`
    ao tipo `MatchListItem` em `useMatchesList.ts`.
  - Popular `userPrediction` no compositor via Map por `matchId` (lookup do
    `predictions` já carregado).
- Main modules/files likely involved:
  - `src/features/matches/lib/matchesHelpers.ts`
  - `src/features/matches/lib/index.ts` (barrel — exportar novos símbolos)
  - `src/features/matches/hooks/useMatchesList.ts`
- Dependencies: none
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: yes (regra de classificação temporal + lookup de palpite
  são business rules testáveis isoladamente)
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: IDs de palpite devem casar byte-a-byte com IDs do match (ESPN, PRD-13).
  Cobrir caso de match sem palpite (`null`) e com palpite no teste.

### TASK-02 – MatchCard: borda de bandeira + palpite visível
- Type: application
- Goal: Exibir borda sutil nas bandeiras (distinguir fundo branco) e mostrar o
  palpite do usuário no card mesmo para jogos não-encerrados.
- Scope:
  - `TeamFlag`: adicionar `ring-1 ring-border/50` (+ `rounded-sm` já existente) ao
    `<img>`. Fallback de iniciais não muda.
  - `CardFooter`: exibir "Seu palpite: X x Y" de forma discreta
    (`text-xs text-muted-foreground`) quando `userPrediction != null` e o jogo
    NÃO está encerrado (status `scheduled` / `live`). Bloco `isFinished` mantém
    comportamento atual.
  - Garantir que `live` com palpite mostra o palpite.
- Main modules/files likely involved:
  - `src/features/matches/components/MatchCard.tsx`
- Dependencies: TASK-01 (consome `userPrediction` populado — mas a prop já existe
  na interface; pode ser desenvolvido em paralelo e validado end-to-end após 01)
- Story points: 2
- Criticality: low
- Technical risk: low
- Recommended TDD later: no (UI presentacional; cobertura via test pós-implement)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: done
- Phases done: spec, ui-spec, implement, test, review
- Notes: Verificar dark mode na borda (`ring-border/50` usa token semântico).
  Palpite discreto, não competir com horário/placar central.

### TASK-03 – MatchList: tabs temporais + wiring
- Type: application
- Goal: Adicionar três abas (Anteriores | Hoje | Próximos) abaixo do header,
  filtrando as seções por bucket temporal; default derivado dos dados; passar
  `userPrediction` ao `MatchCard`.
- Scope:
  - Estado `activeTab: TemporalBucket` com default derivado (Hoje → Próximos →
    Anteriores conforme disponibilidade), via `useMemo`.
  - Renderizar `shadcn/ui Tabs` (`src/components/ui/tabs.tsx`) abaixo do
    `MatchListHeader`, acima da lista.
  - Aplicar classificação temporal como última etapa do pipeline de filtro
    (após busca + filtros avançados), usando `classifyDateKey` de TASK-01.
  - Limpar filtros avançados + busca ao trocar de aba (evita empty-state confuso).
  - Passar `userPrediction={item.userPrediction}` ao `<MatchCard>`.
  - Empty-state por aba (ex.: "Nenhum jogo anterior").
- Main modules/files likely involved:
  - `src/features/matches/components/MatchList.tsx`
  - `src/components/ui/tabs.tsx` (consumir, já existe)
- Dependencies: TASK-01 (classifyDateKey + userPrediction), TASK-02 (card renderiza
  palpite — não bloqueante para o wiring, mas o resultado visual final depende dela)
- Story points: 3
- Criticality: medium
- Technical risk: medium
- Recommended TDD later: no (integração de UI; cobertura via test de componente
  pós-implement — testar troca de aba, default, limpeza de filtros)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: done
- Phases done: spec, ui-spec, implement, test, review, ui-review
- Notes: Decisão travada: tabs convivem com agrupamento por dia (filtram, não
  substituem). Trocar de aba limpa filtros avançados. `filtersCount` não inclui a
  aba ativa. Default: Hoje se houver jogos hoje, senão Próximos, senão Anteriores.

## 4. Dependency map

```
TASK-01 (foundation: lib + view-model)
   ├──▶ TASK-02 (card consome userPrediction)
   └──▶ TASK-03 (compositor usa classifyDateKey + userPrediction)

TASK-02 ──▶ TASK-03 (resultado visual final do card dentro das tabs)
```

- TASK-01: sem dependências.
- TASK-02: depende logicamente de TASK-01 para validação end-to-end (a prop já
  existe na interface, então pode ser implementada em paralelo).
- TASK-03: depende de TASK-01 (lib + campo) e fecha a feature visualmente com TASK-02.

## 5. Recommended execution order

1. **TASK-01** — foundation pura, destrava as outras duas.
2. **TASK-02** — card presentacional, baixo risco, valida `userPrediction` end-to-end.
3. **TASK-03** — integração das tabs, fecha a feature.

## 6. Planning risks and blockers

- **Interação tabs × filtros** (TASK-03): decisão de limpar filtros ao trocar de
  aba reduz complexidade e empty-states confusos. Se o usuário quiser preservar
  filtros entre abas, reabrir a decisão.
- **IDs de palpite** (TASK-01): assume IDs idênticos match↔prediction (PRD-13).
  Cobrir em teste; se divergir, lookup falha silenciosamente (`null`).
- **Default da aba** (TASK-03): deve ser derivado dos dados, não hardcoded —
  evita "Hoje" vazio quando não há jogos no dia.
- TDD recomendado só em TASK-01 (regra pura). TASK-02/03 são UI — test pós-implement.
- plan-checker skipped (small low-risk plan, 3 tasks, sem task critical/high).
