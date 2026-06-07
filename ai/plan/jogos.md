# PLAN — Jogos (PRD-03)

> Input: `ai/prd/jogos.md` · Saída por tarefa: `ai/spec/jogos-task-NN.md`, `ai/screen/jogos-task-NN.md`
> Fonte de verdade de layout: `docs/prd-03/PRD03-01..06`. Design system: `design-system/MASTER.md` (já existe, PRD-02).

## 1. Planning summary

Catálogo de partidas `/matches` (read-only Firestore). Schema (`matchSchema`, `predictionSchema`, `teamSchema`) e enums (`shared.ts`) já existem do PRD-02 — **sem mudança de schema**. Services de matches são parciais (só Home); precisam de `listMatches` + `getMatchById`. `matches/page.tsx` é placeholder; detalhe `[id]` é novo. Rota/shell/BottomNav já existem.

8 tarefas. Fundação primeiro (services + helpers puros de status/filtro), depois camada reativa (hooks), depois UI (card → filtros → lista → detalhe). Lógica de negócio crítica (derivação de status do palpite, **bloqueio por kickoff**) isolada em helpers puros com TDD. Filtros/busca/agrupamento client-side (base ≈ 104 jogos).

Início recomendado: **TASK-01 / TASK-02 / TASK-03 em paralelo** (Wave 1). Maior risco: TASK-02 (regra de bloqueio kickoff vs status defasado), TASK-07 (composição da lista + estados).

**Ambiguidades do PRD a travar antes/durante spec:** cache 5min (PRD-03) vs 30min (CLAUDE.md) → adotar **5 min** p/ matches; filtro **client-side**; `postponed→"Adiado"`, `canceled→"Cancelado"`, `live→"Ao Vivo"` (somente consulta); cabeçalhos de seção **Hoje/Amanhã/data** via date-fns; busca casa mandante **ou** visitante.

## 2. Recommended execution phases

1. **Fundação** — TASK-01 (services list/getById), TASK-02 (labels + helpers de status/bloqueio), TASK-03 (helpers de filtro/busca/agrupamento)
2. **Camada reativa** — TASK-04 (hooks matches + join palpites)
3. **UI** — TASK-05 (Card de Jogo + badges + skeleton), TASK-06 (Filtros sheet), TASK-07 (Lista + header/busca/estados), TASK-08 (Detalhe do Jogo)

## 3. Tasks

### TASK-01 – Estender camada de serviços de partidas
- Type: persistence
- Goal: leituras Firestore para listar todas as partidas e obter uma por id.
- Scope: em `src/services/matches.ts` adicionar `listMatches()` (todas, `orderBy kickoffAt asc`) e `getMatchById(id)` (`getDoc`, retorna `MatchWithId | null`). Espelhar padrão existente (`.parse` do `matchSchema`, id injetado pós-parse, erro Firebase cru). Atualizar `src/services/index.ts` se necessário. Testes em `__tests__`.
- Main modules/files: `src/services/matches.ts`, `src/services/__tests__/matches.test.ts`
- Dependencies: nenhuma
- Story points: 2
- Criticality: high
- Technical risk: low
- Recommended TDD: no (mapeável; testes de service no `/test`)
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: filtro/busca NÃO vão para o Firestore (client-side); evita índices compostos. `getMatchById` usa `doc(firestore,"matches",id)`.

### TASK-02 – Labels de domínio + helpers de status e bloqueio
- Type: domain
- Goal: funções puras que derivam status do jogo, status do palpite e regra de bloqueio, + mapa de rótulos pt-BR dos enums.
- Scope: arquivo de constantes (ex.: `src/features/matches/lib/labels.ts`) mapeando `matchStatusSchema`→pt-BR (Agendado/Ao Vivo/Encerrado/Adiado/Cancelado) e `stageSchema`→pt-BR (Fase de Grupos/Oitavas/Quartas/Semifinal/3º Lugar/Final). Helpers em `src/features/matches/lib/matchStatus.ts`: `isPredictionLocked(match, now)` (true se `now >= kickoffAt` OU status ∈ {live,finished,postponed,canceled}); `derivePredictionStatus(match, prediction|undefined, now)` → `"enviado" | "pendente" | "bloqueado"`; `isFinished(match)`. Usar `date-fns`. Sem I/O, sem React.
- Main modules/files: `src/features/matches/lib/labels.ts`, `src/features/matches/lib/matchStatus.ts`, `lib/__tests__/*`
- Dependencies: nenhuma (usa schemas/types existentes)
- Story points: 3
- Criticality: critical
- Technical risk: medium
- Recommended TDD: yes
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: regra de bloqueio é o coração da feature (PRD §Regras: "bloqueados no horário oficial de início"). Cobrir bordas: exatamente no kickoff, status defasado (scheduled mas kickoff passou → bloqueado), enviado+bloqueado (mostra enviado, edição travada no PRD-04).

### TASK-03 – Helpers de filtro, busca e agrupamento
- Type: domain
- Goal: funções puras que aplicam filtros, busca textual e agrupam por dia.
- Scope: `src/features/matches/lib/matchFilters.ts`: tipo `MatchFilters { stage?, predictionStatus?, teamId? }`; `filterMatches(matches, filters, predictionsByMatchId, now)`; `searchMatchesByTeam(matches, term, teamsById)` (casa mandante ou visitante por nome de seleção); `groupMatchesByDay(matches, now)` → seções ordenadas com rótulo Hoje/Amanhã/`dd 'de' MMMM` (date-fns, locale pt-BR). Sem I/O.
- Main modules/files: `src/features/matches/lib/matchFilters.ts`, `lib/__tests__/*`
- Dependencies: nenhuma (consome tipo de status do palpite da TASK-02 em runtime, mas pode ser planejada/implementada em paralelo expondo a assinatura)
- Story points: 3
- Criticality: high
- Technical risk: low
- Recommended TDD: yes
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: busca normaliza acentos/caixa. Agrupamento ordena seções por data asc; jogos dentro da seção por kickoff asc.

### TASK-04 – Hooks reativos de partidas (TanStack Query)
- Type: application
- Goal: expor dados de partidas + palpites do usuário via React Query, prontos para a UI.
- Scope: `src/features/matches/hooks/matchesKeys.ts` (query keys); `useMatches()` (consome `listMatches`); `useMatch(id)` (consome `getMatchById`); reuso/extração de `usePredictionsByUid` (já existe em home/hooks — extrair p/ compartilhado ou reusar) e `useTeams` (mapa id→team). Compositor opcional `useMatchesView()` que entrega lista + predictionsByMatchId + teamsById. `staleTime` 5 min (decisão A1). Sem fetch manual/useEffect.
- Main modules/files: `src/features/matches/hooks/*`, `src/features/matches/index.ts`
- Dependencies: TASK-01
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: evitar duplicar `usePredictions`/`useTeams` da Home — preferir mover p/ `src/hooks/` compartilhado se a Home também usa. Decidir no spec.

### TASK-05 – Card de Jogo (variantes + badges + skeleton)
- Type: ui
- Goal: componente de card reutilizável cobrindo todas as variantes das telas.
- Scope: `MatchCard` (bandeiras+nomes mandante/visitante, grupo, data/hora, estádio/cidade, badge status palpite, placar quando encerrado, navegação p/ detalhe). `PredictionStatusBadge` (enviado=verde / pendente=âmbar / bloqueado=cinza) e `MatchStatusBadge`. `MatchCardSkeleton`. Fallback de bandeira quando `flagUrl` ausente (código FIFA). Variantes conforme PRD03-04 (enviado), 05 (pendente), 06 (encerrado c/ placar). Sem estilo inline; Tailwind + tokens do MASTER.
- Main modules/files: `src/features/matches/components/{MatchCard,PredictionStatusBadge,MatchStatusBadge,MatchCardSkeleton}.tsx`, `components/__tests__/*`
- Dependencies: TASK-02 (labels + derivePredictionStatus)
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD: no (lógica em helpers já testada; testes de render no `/test`)
- Recommended screen: yes – both – primeira tarefa UI do PRD-03; novo componente central da lista
- Design domains: style, color, ux, typography
- Design complexity: medium
- Accessibility level: enhanced (área de toque ≥44px, contraste AA dos badges, link acessível)
- Notes: **primeira UI** → `/screen` lê `design-system/MASTER.md` e gera override de página `--page "jogos"` se necessário. Badges com cor semântica.

### TASK-06 – Sheet de Filtros (fase, status, seleção, busca)
- Type: ui
- Goal: painel de filtros conforme PRD03-03.
- Scope: `MatchFiltersSheet` (shadcn Sheet): seção Fase (chips/segmented: Grupos/Oitavas/Quartas/Semifinal/3º Lugar/Final), Status do Palpite (Todos/Enviado/Pendente/Jogo Encerrado/Bloqueado), Seleção (campo busca país + lista selecionável), ações Aplicar / Limpar. Estado de filtros controlado pelo pai (lista). Persistir filtros ativos (localStorage — estratégia PRD-00).
- Main modules/files: `src/features/matches/components/MatchFiltersSheet.tsx`, `components/__tests__/*`
- Dependencies: TASK-02 (labels), TASK-03 (tipo `MatchFilters`)
- Story points: 5
- Criticality: medium
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: yes – both – novo modal/drawer de filtros
- Design domains: style, ux, color, typography
- Design complexity: medium
- Accessibility level: critical (foco preso no sheet, ESC fecha, labels de form, navegação por teclado)
- Notes: chips rápidos da lista (PRD03-01) refletem subset destes filtros — alinhar fonte única de estado com a TASK-07.

### TASK-07 – Página Lista de Jogos (header, busca, chips, estados)
- Type: ui
- Goal: substituir placeholder por `/matches` completa (PRD03-01).
- Scope: `src/app/(app)/matches/page.tsx` + `MatchesListView`: header (título Jogos, campo busca, botão filtros que abre o sheet), chips de filtro rápido, lista agrupada por dia (usa `groupMatchesByDay`), render de `MatchCard`, estados loading (skeleton list), empty ("Nenhum jogo encontrado"), error ("Erro ao carregar jogos" + Tentar novamente). Orquestra hooks (TASK-04) + helpers (TASK-02/03). BottomNav já presente no shell.
- Main modules/files: `src/app/(app)/matches/page.tsx`, `src/features/matches/components/MatchesListView.tsx`, testes
- Dependencies: TASK-03, TASK-04, TASK-05, TASK-06
- Story points: 5
- Criticality: critical
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: yes – both – tela principal (layout + navegação + estados)
- Design domains: style, ux, color, typography
- Design complexity: high
- Accessibility level: enhanced (busca rotulada, regiões de lista, estados anunciados)
- Notes: estado de filtros/busca compartilhado entre chips e sheet (TASK-06). Responsivo 360→1024px+.

### TASK-08 – Página Detalhe do Jogo
- Type: ui
- Goal: nova rota `/matches/[id]` (PRD03-02 / PRD03-06).
- Scope: `src/app/(app)/matches/[id]/page.tsx` + `MatchDetailView`: info completa (times, bandeiras, data, hora, estádio, cidade, fase, grupo), status do jogo, status do palpite, ações contextuais — `Enviar Palpite`/`Editar Palpite`/`Visualizar Palpite` (CTA → rota PRD-04), `Ver Informações da Partida`, e quando encerrado `Visualizar Resultado & Estatísticas` (CTA placeholder/PRD futuro) + placar final. Estados loading/error/not-found. Usa `useMatch(id)` + palpite do usuário.
- Main modules/files: `src/app/(app)/matches/[id]/page.tsx`, `src/features/matches/components/MatchDetailView.tsx`, testes
- Dependencies: TASK-02, TASK-04 (e reuso de badges da TASK-05)
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: yes – both – nova tela
- Design domains: style, ux, color, typography
- Design complexity: medium
- Accessibility level: enhanced (botões rotulados, ordem de leitura, estado not-found)
- Notes: ações são CTAs de navegação — formulário de palpite é PRD-04. Botão de palpite desabilitado/oculto quando bloqueado.

## 4. Dependency map

```
TASK-01 ─┐
         ├─> TASK-04 ─┐
TASK-02 ─┼─> TASK-05 ─┤
         │           ├─> TASK-07
TASK-03 ─┴─> TASK-06 ─┘
TASK-02 ─┐
TASK-04 ─┴─> TASK-08
```

- TASK-01: — (raiz)
- TASK-02: — (raiz)
- TASK-03: — (raiz)
- TASK-04: TASK-01
- TASK-05: TASK-02
- TASK-06: TASK-02, TASK-03
- TASK-07: TASK-03, TASK-04, TASK-05, TASK-06
- TASK-08: TASK-02, TASK-04 (+ badges TASK-05)

## 5. Execution waves (parallel groups)

- **Wave 1:** TASK-01, TASK-02, TASK-03 (independentes — fundação)
- **Wave 2:** TASK-04 (←01), TASK-05 (←02), TASK-06 (←02,03)
- **Wave 3:** TASK-07 (←03,04,05,06), TASK-08 (←02,04,05)

## 6. Recommended execution order (sequential fallback)

TASK-02 → TASK-01 → TASK-03 → TASK-04 → TASK-05 → TASK-06 → TASK-08 → TASK-07

(TASK-02 primeiro: regra crítica de bloqueio destrava status em card/lista/detalhe. TASK-07 por último: integra tudo.)

## 7. Planning risks and blockers

1. **Dados não populados** (herdado PRD-02): `matches`/`teams` precisam de seed. Bloqueia validação `/local-env` e release — coordenar com ingestão (HOLD do release PRD-02). Empty-state cobre UX.
2. **Bloqueio por kickoff vs status defasado** (TASK-02): se scheduler não atualizou status, basear bloqueio em `kickoffAt` evita palpite após início. TDD obrigatório.
3. **Duplicação de hooks** (`usePredictions`/`useTeams` já na Home): decidir extração p/ `src/hooks/` compartilhado na TASK-04 p/ evitar divergência.
4. **Estado de filtros compartilhado** chips (TASK-07) ↔ sheet (TASK-06): definir fonte única (provável estado no container da lista + localStorage).
5. **CTAs órfãos** p/ PRD-04 (envio/edição) e resultado/estatísticas: rotas-alvo podem não existir; usar placeholders navegáveis sem quebrar.
6. **`flagUrl` opcional**: fallback obrigatório no card/detalhe (TASK-05).
