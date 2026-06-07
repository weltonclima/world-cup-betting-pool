# Spec — TASK-05: Sheet de Filtros (fase / status / seleção)

> PRD: `ai/prd/jogos.md` | Plan: `ai/plan/jogos.md` | Branch: `feat/integracao-api-football`
> Depende de: TASK-04 (DONE) — `page.tsx`, `MatchList.tsx`, `MatchListHeader.tsx`
> Design: `ai/screen/jogos-task-05.md` | Layout de referência: `docs/prd-03/PRD03-03-Tabela-Grupos.png`

---

## 1. Objetivo

Implementar o `MatchFiltersSheet` — sheet de filtros avançados (bottom sheet no mobile) para a lista
de jogos — e integrá-lo ao estado de filtros já levantado na TASK-04. O sheet adiciona a dimensão
**teamId/Seleção** (que os chips rápidos não tinham) e consolida fase + status em uma única UI de
"Aplicar / Limpar".

---

## 2. Escopo

### 2.1 Novo arquivo

**`src/features/matches/components/MatchFiltersSheet.tsx`**

Componente React (client). Recebe as props descritas abaixo e renderiza um shadcn `Sheet` com:

| Seção | Controles |
|---|---|
| **Fase** | 7 botões toggle: "Todas as fases" + grupos / oitavas / quartas / semifinal / terceiro / final |
| **Status do Palpite** | 4 botões toggle: "Todos" + enviado / pendente / bloqueado (encerrado) |
| **Seleção** | Input de busca + lista scrollável de teams (de `useTeams`) + "Todas as seleções" |
| **Ações** | "Aplicar Filtros" (commit) + "Limpar Filtros" (reset total) |

### 2.2 Modificações em arquivos existentes (TASK-04)

| Arquivo | Mudança |
|---|---|
| `src/features/matches/components/MatchList.tsx` | Adicionar `selectedTeamId` ao estado; aplicar filtro de teamId na pipeline; calcular `filtersCount`; montar `<MatchFiltersSheet>` |
| `src/features/matches/components/MatchListHeader.tsx` | `filtersCount` já existe — sem mudança de interface |
| `src/app/(app)/matches/page.tsx` | Sem mudança (Server Component, MatchList cuida do estado) |

---

## 3. Interface de props

```ts
export interface MatchFiltersSheetProps {
  /** Controla abertura do sheet (estado em MatchList). */
  open: boolean;
  /** Callback para fechar o sheet (sem aplicar alterações pendentes). */
  onClose: () => void;

  /** Fase atualmente aplicada na lista. */
  selectedStage: Stage | undefined;
  /** Status de palpite atualmente aplicado na lista. */
  selectedPredictionStatus: MatchPredictionStatus | undefined;
  /** TeamId atualmente aplicado na lista. */
  selectedTeamId: string | undefined;

  /**
   * Callback disparado ao clicar "Aplicar Filtros".
   * Recebe o estado final do sheet para commit na lista.
   */
  onApply: (filters: {
    stage: Stage | undefined;
    predictionStatus: MatchPredictionStatus | undefined;
    teamId: string | undefined;
  }) => void;

  /**
   * Callback disparado ao clicar "Limpar Filtros".
   * Deve resetar todos os filtros (stage + predictionStatus + teamId) para undefined.
   */
  onClear: () => void;
}
```

---

## 4. Modelo de estado interno

O sheet mantém **estado de rascunho** — edições não são aplicadas à lista até "Aplicar Filtros".
Isso evita re-renderizar a lista a cada clique dentro do sheet.

```ts
// Inicializado com os valores aplicados atuais (selectedStage etc.)
const [draftStage, setDraftStage] = useState<Stage | undefined>(selectedStage);
const [draftPredictionStatus, setDraftPredictionStatus] = useState<MatchPredictionStatus | undefined>(selectedPredictionStatus);
const [draftTeamId, setDraftTeamId] = useState<string | undefined>(selectedTeamId);
const [teamSearch, setTeamSearch] = useState("");
```

**Sincronização com props externas:** ao `open` mudar de `false → true`, o rascunho deve ser
re-inicializado com os valores externos (para que ao reabrir o sheet reflita o estado atual da lista).

```ts
useEffect(() => {
  if (open) {
    setDraftStage(selectedStage);
    setDraftPredictionStatus(selectedPredictionStatus);
    setDraftTeamId(selectedTeamId);
    setTeamSearch("");
  }
}, [open]);
```

**Importante:** NÃO usar React Hook Form — este é estado de seleção de filtros, não um formulário
de submissão de dados. Estado local com `useState` conforme nota do plan.

---

## 5. Comportamento dos controles

### 5.1 Seção Fase

- 7 botões (toggle style): "Todas as fases", "Fase de Grupos", "Oitavas", "Quartas", "Semifinal",
  "3º Lugar", "Final".
- "Todas as fases" → `draftStage = undefined`.
- Qualquer outra opção → `draftStage = <valor>`. Clicar na opção já selecionada a deseleciona
  (volta para `undefined`).
- Exatamente um botão ativo por vez.
- `aria-pressed` reflete estado de seleção.

### 5.2 Seção Status do Palpite

- 4 botões: "Todos", "Palpite Enviado", "Palpite Pendente", "Jogo Encerrado" (= bloqueado).
- "Todos" → `draftPredictionStatus = undefined`.
- Demais: `draftPredictionStatus = "enviado" | "pendente" | "bloqueado"`.
- Clicar na opção já selecionada → volta para `undefined`.
- `aria-pressed` reflete estado.

### 5.3 Seção Seleção

- Input de busca (`placeholder="Buscar seleção"`, `aria-label="Buscar por seleção"`).
- Lista de teams filtrada pelo `teamSearch` (substring, case-insensitive, sobre `team.name`).
- Item "Todas as seleções" sempre no topo (não filtrado pela busca).
- Cada item de team: ícone/bandeira (se disponível, senão placeholder) + nome da seleção.
- `draftTeamId`: clique em "Todas as seleções" → `undefined`; clique em team → seta o id (toggle:
  clicar no já selecionado → `undefined`).
- Lista scrollável (`max-h-48 overflow-y-auto`).
- Item selecionado indicado visualmente (fundo accent ou checkmark).
- `role="listbox"` na lista, `role="option"` + `aria-selected` em cada item.

### 5.4 Ações

- **"Aplicar Filtros"** (botão primary): chama `onApply({ stage: draftStage, predictionStatus: draftPredictionStatus, teamId: draftTeamId })` e em seguida `onClose()`.
- **"Limpar Filtros"** (botão ghost/link): chama `onClear()` e em seguida `onClose()`.

---

## 6. Integração em MatchList.tsx

### 6.1 Novo estado

```ts
const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(undefined);
```

### 6.2 Pipeline de filtro — adicionar teamId

```ts
// 3. Filtro por teamId (após stage, antes de predictionStatus)
const afterTeamId =
  selectedTeamId === undefined
    ? afterStage
    : afterStage.filter(
        (item) =>
          // Precisa comparar via id — MatchListItem não expõe homeTeamId/awayTeamId
          // Solução: filtrar via flatList original que tem os ids, então usar Set de ids
      );
```

> **Decisão de implementação:** `MatchListItem` não expõe `homeTeamId`/`awayTeamId`. Há duas
> opções:
> a. Adicionar `homeTeamId`/`awayTeamId` ao `MatchListItem` no `useMatchesList` (break mínimo).
> b. Usar `item.homeTeam.name` + lookup do teamId via `useTeams` (acoplamento maior).
>
> **Decisão:** opção (a) — adicionar `homeTeamId` e `awayTeamId` ao `MatchListItem` em
> `useMatchesList.ts`. Assim `MatchList.tsx` pode filtrar diretamente sem precisar do teamMap.
> Isso não quebra testes existentes (campos adicionados, não removidos).

### 6.3 filtersCount

```ts
const filtersCount =
  (selectedStage !== undefined ? 1 : 0) +
  (selectedPredictionStatus !== undefined ? 1 : 0) +
  (selectedTeamId !== undefined ? 1 : 0);
```

### 6.4 Handlers

```ts
function handleApplyFilters(filters: {
  stage: Stage | undefined;
  predictionStatus: MatchPredictionStatus | undefined;
  teamId: string | undefined;
}) {
  setSelectedStage(filters.stage);
  setSelectedPredictionStatus(filters.predictionStatus);
  setSelectedTeamId(filters.teamId);
  setFiltersOpen(false);
}

function handleClearFilters() {
  setSelectedStage(undefined);
  setSelectedPredictionStatus(undefined);
  setSelectedTeamId(undefined);
  setFiltersOpen(false);
}
```

### 6.5 Montagem do sheet

```tsx
<MatchFiltersSheet
  open={filtersOpen}
  onClose={() => setFiltersOpen(false)}
  selectedStage={selectedStage}
  selectedPredictionStatus={selectedPredictionStatus}
  selectedTeamId={selectedTeamId}
  onApply={handleApplyFilters}
  onClear={handleClearFilters}
/>
```

---

## 7. Componente shadcn Sheet

O shadcn `Sheet` **não está instalado** — deve ser adicionado via CLI antes de implementar:

```bash
npx shadcn@latest add sheet
```

Isso criará `src/components/ui/sheet.tsx`.

**Configuração do sheet:**
- `side="bottom"` no mobile (padrão).
- Cabeçalho: título "Filtros" + botão X (shadcn `SheetClose`).
- O shadcn Sheet (Radix UI) gerencia automaticamente: focus trap, fechamento por ESC, fechamento por
  overlay, retorno de foco ao trigger.

---

## 8. Acessibilidade (nível Critical)

| Requisito | Implementação |
|---|---|
| Focus trap | shadcn Sheet (Radix UI) — automático |
| Fechar por ESC | shadcn Sheet — automático |
| Fechar por overlay | shadcn Sheet — automático |
| Foco retorna ao trigger | shadcn Sheet — automático |
| Todos os botões de toggle | `aria-pressed` + label descritivo |
| Lista de seleções | `role="listbox"`, cada item `role="option"` + `aria-selected` |
| Input de busca | `aria-label="Buscar por seleção"` |
| Área de toque | `min-h-[44px]` em botões de toggle e itens de lista |
| Contraste | tokens semânticos do design system (WCAG AA) |

---

## 9. Testes co-localizados

**`src/features/matches/components/__tests__/MatchFiltersSheet.test.tsx`**

| # | Cenário |
|---|---|
| T1 | Sheet não renderizado quando `open=false` |
| T2 | Sheet visível quando `open=true` |
| T3 | Título "Filtros" aparece |
| T4 | Seção Fase exibe "Todas as fases" selecionado por padrão |
| T5 | Seção Status exibe "Todos" selecionado por padrão |
| T6 | Seção Seleção exibe "Todas as seleções" selecionado por padrão |
| T7 | Clicar em "Fase de Grupos" marca como selecionado (aria-pressed=true) |
| T8 | Clicar em "Palpite Enviado" marca como selecionado |
| T9 | Clicar em team seleciona aquele teamId (indicação visual) |
| T10 | "Aplicar Filtros" chama onApply com os valores do rascunho |
| T11 | "Limpar Filtros" chama onClear |
| T12 | "Aplicar Filtros" chama onClose |
| T13 | Busca filtra a lista de seleções |
| T14 | "Todas as seleções" sempre aparece mesmo com busca ativa |
| T15 | Reabrir o sheet re-inicializa o rascunho com os valores externos |

**Atualização de `MatchList.test.tsx`** (se pipeline de teamId alterar comportamento visível — não
esperado nos testes atuais, mas `filtersCount` agora é dinâmico):

- Adicionar T30: `filtersCount` no botão de filtros reflete 0 quando sem filtro de seleção.

---

## 10. Arquivos a criar/modificar

| Arquivo | Operação |
|---|---|
| `src/components/ui/sheet.tsx` | Criar via `npx shadcn@latest add sheet` |
| `src/features/matches/components/MatchFiltersSheet.tsx` | **Criar** |
| `src/features/matches/components/__tests__/MatchFiltersSheet.test.tsx` | **Criar** |
| `src/features/matches/hooks/useMatchesList.ts` | Modificar — adicionar `homeTeamId`/`awayTeamId` ao `MatchListItem` |
| `src/features/matches/components/MatchList.tsx` | Modificar — selectedTeamId + pipeline + filtersCount + sheet |

---

## 11. Constraints

- TypeScript strict — sem `any`.
- Sem estilos inline — Tailwind + tokens de tema.
- Estado local com `useState` (não RHF).
- Sem chamadas fetch/useEffect manual — dados via `useTeams` (já existente).
- Não modificar `src/features/matches/index.ts` (barrel raiz).
- RTK prefix para todos os comandos de shell.
