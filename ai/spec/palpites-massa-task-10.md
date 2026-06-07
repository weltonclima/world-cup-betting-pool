# SPEC

## 1. Task: TASK-10 – Tela Classificação Prevista (PRD03-04)

> Feature: `palpites-massa` · Plan: `ai/plan/palpites-massa.md` (TASK-10)
> PRD: `ai/prd/palpites-massa.md` (§6.1 A2/A7) · Design contract: `design-system/MASTER.md` + `ai/screen/palpites-massa-task-06.md`
> Wireframe: `docs/prd-03-1/PRD03-04-Classificacao-Prevista.png`
> Depende de: TASK-02 (`computeGroupStandings`), TASK-06 (tokens/tema), TASK-09 (rota e fluxo do grupo).

## 2. Objective

Exibir a classificação prevista 1º–4º de um grupo, calculada a partir dos placares previstos pelo usuário (`computeGroupStandings`), em uma tabela acessível. Destaca os 2 primeiros (classificados) e marca o 3º como candidato a melhor terceiro. É **visual, não pontuada** (A2). Inclui CTA "Confirmar Classificação" que avança o fluxo. A classificação aparece **após** "Salvar Grupo" na mesma rota do grupo (TASK-09), como seção/etapa, mantendo coerência para o wizard (TASK-16).

## 3. In scope

- Componente apresentacional `PredictedStandings.tsx` — recebe `standings` (de `computeGroupStandings`), `teamMap`/resolver de times e handler de confirmação por props; renderiza tabela acessível + legenda + CTA.
- Helper de destaque/derivação (puro): mapear `GroupStandingEntry` → linha com `qualification` (`qualified` | `best-third-candidate` | `eliminated`).
- Wiring na rota `src/app/(app)/predictions/grupos/[groupId]/page.tsx` (TASK-09): após salvar (ou via toggle "Ver classificação prevista"), mostrar a seção `PredictedStandings` abaixo do grid de preenchimento. CTA "Confirmar Classificação" avança no fluxo (por ora: volta ao grid de grupos `/predictions/grupos` — placeholder coerente, substituível pelo wizard TASK-16).
- Export no `components/index.ts`.
- Teste scoped `PredictedStandings.test.tsx`.

## 4. Out of scope

- `computeGroupStandings` e desempate FIFA (TASK-02) — apenas consumido; nenhum recálculo nem ajuste manual (A7).
- Resumo dos 12 grupos (TASK-11) e ranking dos melhores terceiros real (TASK-12) — aqui apenas a marcação visual do 3º do grupo corrente como "candidato".
- Persistência: classificação é derivação visual, **não** grava nada (A2/D-PERSIST). Sem schema/endpoint novo.
- Wizard de etapas contínuo e navegação entre fases (TASK-16). O CTA avança com destino placeholder.
- Edição dos placares — feita no grid da TASK-09; aqui é read-only.

## 5. Main technical areas

- `src/features/predictions/components/PredictedStandings.tsx` (novo)
- `src/features/predictions/components/index.ts` (export)
- `src/features/predictions/components/__tests__/PredictedStandings.test.tsx` (novo)
- `src/app/(app)/predictions/grupos/[groupId]/page.tsx` (alteração: adicionar seção/toggle de classificação)
- Reuso: `computeGroupStandings` + `GroupStandingEntry` (`@/features/predictions/lib`), `resolveTeam`/`ResolvedTeam` + `buildTeamMap` (`@/features/matches/lib/matchesHelpers`), `useGroupMatches`/`useTeams`/`usePredictions` já agregados (a página já tem `useGroupPredictions`; ver R7).

## 6. Business rules and behavior

- **R1.** A tabela exibe as linhas retornadas por `computeGroupStandings(matches, predictions)` (já ordenadas e com `position` 1-based). Colunas: **Pos**, **Seleção** (bandeira+nome), **Pts** (points), **SG** (goalDifference, com sinal), **GP** (goalsFor). (Wireframe mostra Pos/Time/Pts/SG/GP.)
- **R2. Destaque (derivação visual, A2):**
  - `position <= 2` → `qualified` (classificado direto).
  - `position === 3` → `best-third-candidate` (candidato a melhor terceiro).
  - `position >= 4` → `eliminated` (sem destaque).
  - Marcação por **ícone + texto/legenda**, nunca só cor (WCAG).
- **R3. Não pontuada:** nenhum cálculo de pontos do bolão; nenhuma escrita. Puramente derivada dos palpites.
- **R4. Sem desempate manual (A7):** a ordem vem de `computeGroupStandings`; a UI não oferece reordenar/ajustar empate.
- **R5. CTA "Confirmar Classificação":** chama `onConfirm()`. No wiring da rota, navega para `/predictions/grupos` (placeholder coerente até TASK-16). Sempre habilitado quando há standings (não exige grupo 100% preenchido — partidas sem palpite contam 0 e a tabela ainda é exibida).
- **R6. Estado parcial:** se nem todos os 6 jogos têm palpite, a tabela ainda renderiza (times com menos jogos disputados). Exibir nota informativa "Classificação parcial — baseada nos jogos já preenchidos." quando `algum time tiver played < (n-1)` (ou, simplificando, quando total de jogos previstos < total do grupo). Decisão: nota exibida quando `filledCount < totalCount` (passado por prop).
- **R7. Toggle na rota (TASK-09):** a página mantém um estado local `showStandings` (boolean). Ativado automaticamente após um save bem-sucedido (em `onSuccess` do batch, quando houve `saved > 0`) **e** disponível manualmente via botão "Ver classificação prevista" abaixo do grid. A classificação é computada com `useGroupPredictions` data já existente (matches + predictions atuais incluindo draft) — para refletir o que o usuário preencheu, usar os `currentScores` dos items como fonte de predictions (montar `Prediction[]` sintético a partir dos items com `currentScores`).
- **R8. uid ausente / sem dados:** se não há standings (0 times), não renderizar a seção (ou esconder o toggle).

## 7. Contracts and interfaces

### `PredictedStandings` (props)
```
{
  groupId: string;
  standings: GroupStandingEntry[];   // de computeGroupStandings (ordenado, position 1-based)
  resolveTeamName: (teamId: string) => ResolvedTeam;  // nome + flagUrl
  isPartial: boolean;                // true → exibe nota de classificação parcial
  onConfirm: () => void;
}
```
- Apresentacional puro (sem hooks de dados). `resolveTeamName` injetado para manter o componente testável e desacoplado do teamMap.

### Helper de derivação (puro, exportado para teste)
```
type Qualification = "qualified" | "best-third-candidate" | "eliminated";
function deriveQualification(position: number): Qualification
```
- `position<=2 → "qualified"`, `===3 → "best-third-candidate"`, senão `"eliminated"`.

### Wiring na página (TASK-09)
- Estado `showStandings`. Fonte de predictions para `computeGroupStandings`: `items` com `currentScores` definido → `{ uid:"", matchId, homeScore, awayScore }`. Matches: derivados dos items (precisa de `homeTeamId`/`awayTeamId`/`groupId`/`stage` — **ver Open Question Q1**, pois `GroupPredictionItem` hoje não expõe os teamIds nem o match cru).

## 8. Data and persistence impact

- Nenhum. Derivação client-side puramente visual (A2/D-PERSIST). Sem schema, sem endpoint, sem localStorage novo (o draft já existe da TASK-09).

## 9. Required tests

Arquivo: `src/features/predictions/components/__tests__/PredictedStandings.test.tsx` (`// @vitest-environment jsdom`, RTL + vitest). Componente apresentacional. Cobrir:

1. **Render da tabela:** dado 4 entries, renderiza `table` com header (`scope=col`) e 4 linhas de dados na ordem de `position`; cada linha mostra Pos, nome do time, Pts, SG (com sinal), GP.
2. **Ordem:** as linhas aparecem na ordem do array (1→4); a primeira célula de cada linha mostra a posição correta.
3. **Destaque/qualification:** linha 1 e 2 marcadas como classificadas (texto/aria "Classificado"); linha 3 marcada "Candidato a melhor terceiro"; linha 4 sem marcação de classificação.
4. **`deriveQualification`** (pura): mapeia 1,2→qualified; 3→best-third-candidate; 4→eliminated.
5. **Nota parcial:** `isPartial=true` exibe a nota; `false` não exibe.
6. **CTA:** clicar "Confirmar Classificação" chama `onConfirm` 1×.
7. **Acessibilidade:** `table` tem `<caption>` ou `aria-label`; headers com `scope`; SG com sinal legível; marcação por ícone+texto.

> O wiring da rota (toggle pós-save) é coberto indiretamente; o teste foca no componente puro + helper. Se o build de `Prediction[]`/matches sintéticos virar helper puro (Q1), adicionar teste unitário dele.

## 10. Acceptance criteria

- AC1. Após salvar um grupo (ou ao acionar "Ver classificação"), aparece a tabela 1º–4º calculada dos placares previstos.
- AC2. 1º e 2º destacados como classificados; 3º marcado como candidato a melhor terceiro — sempre com ícone+texto (não só cor).
- AC3. Tabela acessível: header com `scope`, caption/aria-label, navegável por leitor de tela.
- AC4. "Confirmar Classificação" avança o fluxo (placeholder: grid de grupos).
- AC5. Sem ajuste manual de desempate; ordem vem de `computeGroupStandings`.
- AC6. Classificação parcial sinalizada quando nem todos os jogos têm palpite.
- AC7. Nada é persistido (visual). tsc + eslint limpos; testes scoped GREEN (vitest JSON).

## 11. UI/Screen requirement

- Requires screen: **yes**
- Platform: **web** (mobile-first → desktop)
- Screens involved: PRD03-04 (Classificação prevista) — seção na rota do grupo.
- `/screen` deve ser executado antes do `/implement`. → `ai/screen/palpites-massa-task-10.md`.
- Product type: Sports betting pool / bracket challenge (mobile-first), estilo FotMob/ESPN (tabela de classificação esportiva).
- Recommended style: esportivo limpo; tabela densa porém escaneável; shell verde via `.palpites-theme`.
- Applicable UX domains: chart/tabela, style, color, typography, ux.

> Scripts Python do ui-ux-pro-max indisponíveis. Direção derivada de `design-system/MASTER.md` + TASK-06 + wireframe PRD03-04.

### Accessibility requirements
- Contraste ≥4.5:1 texto / ≥3:1 componentes (tokens MASTER + verde escopado AA).
- Tabela semântica: `<table>` + `<caption>` (ou `aria-label`), `<th scope="col">` nas colunas, `<th scope="row">` opcional na posição/time.
- Marcação de classificação por ícone (Lucide) + texto/`aria-label`, nunca só cor.
- SG exibido com sinal explícito ("+3", "0", "-2") — não depender de cor para positivo/negativo.
- Touch targets ≥44px no CTA; foco visível.
- `motion-reduce` em quaisquer transições.
- Sem inputs nesta tela (read-only) — sem requisito de teclado de digitação.

### Interaction requirements
- CTA com press feedback (transition-colors ≤150ms via Button).
- Sem loading próprio (dados já carregados pela TASK-09); se a página estiver carregando, a seção não aparece.
- Toggle "Ver classificação prevista" expande/colapsa a seção (estado preservado).

### UI states required
- **populated:** tabela completa com destaques.
- **partial:** tabela + nota "Classificação parcial".
- **hidden/empty:** sem standings → seção não renderizada (toggle oculto).
- **success (pós-save):** seção exibida automaticamente após save com `saved > 0`.
- **disabled:** n/a (CTA sempre habilitado quando há standings).
- loading/error: herdados da TASK-09 (a seção só aparece em estado populated da página).

## 12. Constraints

- TS strict, sem `any`. Tailwind tokens only — sem hex; sem `style` inline (não há largura geométrica aqui).
- Lucide imports nomeados. `next/link` ou handler de navegação para o CTA.
- Mobile-first; WCAG AA. Tabela não deve gerar scroll horizontal no mobile (colunas compactas; abreviar rótulos Pts/SG/GP com `<abbr>`/aria).
- Não tocar TASK-02 (`computeGroupStandings`) nem outras tasks. Só consumir.
- Container herda `.palpites-theme` da rota (TASK-09).
- Não persistir nada.

## 13. Open questions

- **Q1 (resolver no implement):** `GroupPredictionItem` (TASK-05) expõe `homeTeam`/`awayTeam` (ResolvedTeam) e `currentScores`, mas **não** expõe `homeTeamId`/`awayTeamId` nem o match cru — `computeGroupStandings` precisa de `MatchWithId[]` (com teamIds) e `Prediction[]`. **Decisão:** na página, computar standings a partir das fontes brutas já disponíveis via os hooks que `useGroupPredictions` usa internamente — i.e., chamar `useGroupMatches(groupId)` + `usePredictions(uid)` + `useTeams()` na própria página (ou estender `GroupPredictionsData` para expor `matches` e um `predictions` efetivo). Caminho preferido (mínimo acoplamento): a página usa `useGroupMatches(groupId)` para os matches e monta `Prediction[]` a partir dos `currentScores` dos items (matchId casa). `resolveTeamName` via `buildTeamMap(useTeams().data)`. Confirmar no implement sem alterar a assinatura de `useGroupPredictions` se possível; se necessário expor `matches` em `GroupPredictionsData`, é alteração aditiva mínima (não quebra TASK-09).
- **Q2:** destino real do "Confirmar Classificação" é definido pelo wizard (TASK-16). Placeholder: `/predictions/grupos`. Sem impacto no contrato do componente (recebe `onConfirm`).
