# SPEC

## 1. Task: TASK-09 – Tela Palpite em Massa do Grupo (PRD03-03)

> Feature: `palpites-massa` · Plan: `ai/plan/palpites-massa.md` (TASK-09)
> PRD: `ai/prd/palpites-massa.md` (§6.1 A4/A9) · Design contract: `design-system/MASTER.md` + `ai/screen/palpites-massa-task-06.md`
> Wireframe: `docs/prd-03-1/PRD03-03-Palpite-Rapido-Grupo.png`

## 2. Objective

Permitir que o usuário preencha os 6 jogos de um grupo (A–L) numa única tela, digitando placares com navegação TAB, com auto-save local a cada alteração (sem travar a digitação) e persistência server em lote ao acionar "Salvar Grupo". Feedback agregado via Sonner. Jogos com kickoff passado entram travados.

## 3. In scope

- Rota dinâmica `src/app/(app)/predictions/grupos/[groupId]/page.tsx` (Client Component) — data-fetching via `useGroupPredictions(groupId)`, orquestração do save (`useUpsertPredictionsBatch`), feedback Sonner, container com `.palpites-theme`.
- Componente apresentacional `GroupQuickFill.tsx` — recebe items + handlers + estados por props; renderiza header do grupo, instrução, lista de linhas, CTA "Salvar Grupo".
- Componente `GroupMatchRow.tsx` — uma linha de jogo: bandeira+nome mandante / `CompactScoreInput`×2 separados por "x" / nome+bandeira visitante; estado locked.
- Auto-save: cada alteração de placar chama `usePredictionDraft.setDraft(matchId, scores)` (debounce interno do hook cuida do localStorage).
- "Salvar Grupo": coleta itens preenchidos e não bloqueados, chama o batch, exibe toast agregado (X salvos, Y rejeitados/bloqueados).
- Estados: loading, error (com retry), empty (grupo sem jogos / groupId inválido), populated.

## 4. Out of scope

- Classificação prevista (TASK-10) — entregue na mesma rota como seção/etapa pós-save, mas o componente `PredictedStandings` e seu wiring são da TASK-10.
- Endpoint batch (TASK-04) e service/hooks (TASK-05) — já existentes; apenas consumidos.
- Primitivas `CompactScoreInput`/`ProgressBar` (TASK-06) — já existentes; apenas consumidas.
- Wizard contínuo "Completar Copa" e navegação entre grupos (TASK-16).
- Bracket / eliminatórias.

## 5. Main technical areas

- `src/app/(app)/predictions/grupos/[groupId]/page.tsx` (novo)
- `src/features/predictions/components/GroupQuickFill.tsx` (novo)
- `src/features/predictions/components/GroupMatchRow.tsx` (novo)
- `src/features/predictions/components/index.ts` (export dos novos)
- `src/features/predictions/components/__tests__/GroupQuickFill.test.tsx` (novo)
- Reuso: `useGroupPredictions` (hook), `usePredictionDraft`, `useUpsertPredictionsBatch`, `CompactScoreInput`, `resolveTeam`/`ResolvedTeam`, `isPredictionLocked` (já aplicado dentro de `useGroupPredictions`).

## 6. Business rules and behavior

- **R1.** A tela exibe exatamente as partidas do grupo retornadas por `useGroupPredictions(groupId)` (já ordenadas por kickoff), tipicamente 6. O número não é hardcoded — renderiza `items.length`.
- **R2.** Cada `CompactScoreInput` reflete `item.currentScores` (draft tem prioridade sobre saved — regra do hook). Campo vazio ⇒ `value=null`.
- **R3. Auto-save local:** ao alterar qualquer placar de uma linha, chamar `setDraft(matchId, { homeScore, awayScore })` com o par atual. Como o input é por lado (home/away), manter o outro lado a partir do `currentScores` vigente; valor `null` de um lado vira `0` **apenas** na escrita do draft quando o outro lado tiver valor — para não persistir par parcial inconsistente. Decisão: persistir draft somente quando **ambos** os lados forem números (par completo). Enquanto um lado for `null`, o draft daquela partida não é gravado (evita par inválido no batch).
- **R4. Não bloquear digitação:** o `setDraft` do hook já é debounced (300ms localStorage) e o estado React é síncrono — nenhuma chamada server por tecla. Sem `await`, sem rede no `onChange`.
- **R5. Salvar Grupo:** monta `UpsertPredictionInput[]` apenas com itens (a) não bloqueados e (b) com par completo (home e away números). Chama `mutate`/`mutateAsync` do `useUpsertPredictionsBatch`. Itens bloqueados são excluídos do payload (não geram 423 em massa).
- **R6. Feedback agregado (Sonner):**
  - Sucesso (`result.saved.length > 0` e `rejected.length === 0`): `toast.success("{n} palpites salvos.")`.
  - Parcial (`saved.length > 0` e `rejected.length > 0`): `toast.warning("{s} salvos, {r} não salvos (jogos encerrados ou inválidos).")`.
  - Nenhum salvo, só rejeitados: `toast.error("Nenhum palpite salvo. {r} jogos encerrados ou inválidos.")`.
  - Nada para salvar (payload vazio): `toast.info("Preencha ao menos um jogo para salvar.")` e não chama o batch.
  - Erro de rota (`onError`, `PredictionServiceError`/Error): `toast.error(error.message)` (mensagem pt-BR já mapeada pelo service).
- **R7. Estado do CTA:** desabilitado enquanto `isPending` (salvando) ou quando não há nenhum item preenchido+desbloqueado. Texto muda para "Salvando…" durante `isPending`.
- **R8. Locked:** item com `isLocked === true` renderiza ambos os inputs com `locked` (disabled + aria) e um marcador textual "Encerrado"/cadeado na linha (cor não-exclusiva). Linha continua exibindo o placar salvo, se houver.
- **R9. groupId inválido / sem jogos:** se `totalCount === 0` após load (sem erro), exibir estado vazio "Os jogos deste grupo ainda não estão disponíveis." + link de volta para `/predictions/grupos`.
- **R10. uid ausente:** `useGroupPredictions` retorna `items: []` quando uid é null; a página trata uid null como parte do `isLoading` (consistente com Hub/grid).

## 7. Contracts and interfaces

### `GroupMatchRow` (props)
```
{
  homeTeam: ResolvedTeam;        // { name, flagUrl? }
  awayTeam: ResolvedTeam;
  homeScore: number | null;
  awayScore: number | null;
  locked: boolean;
  onHomeChange: (v: number | null) => void;
  onAwayChange: (v: number | null) => void;
}
```
- aria-label dos inputs: `Gols {homeTeam.name}` / `Gols {awayTeam.name}`.
- Bandeira via `<img>` quando `flagUrl` definido (alt vazio, `aria-hidden`), fallback sem imagem (nome já presente). Separador "x" `aria-hidden`.

### `GroupQuickFill` (props)
```
{
  groupId: string;
  items: GroupPredictionItem[];   // de useGroupPredictions
  isLoading: boolean;
  isError: boolean;
  isSaving: boolean;
  onRetry: () => void;
  onScoreChange: (matchId: string, home: number | null, away: number | null) => void;
  onSave: () => void;
}
```
- Apresentacional puro (sem hooks de dados) — testável isolado.

### Página (não exporta contrato; orquestra)
- Lê `params` (`{ groupId: string }`), instancia `useGroupPredictions`, `usePredictionDraft(uid)`, `useUpsertPredictionsBatch(uid)`.
- `onScoreChange` resolve o par completo e chama `setDraft` (R3).
- `onSave` monta payload (R5) e dispara `mutate` com callbacks de toast (R6).

## 8. Data and persistence impact

- **Local:** `localStorage` chave `palpites-rascunho-{uid}` (via `usePredictionDraft`) — par por matchId. Sem schema novo.
- **Server:** `POST /api/predictions/batch` (existente). Nenhuma coleção/schema novo. uid sempre da sessão (server-side); o client nunca envia uid.
- Nenhuma migração.

## 9. Required tests

Arquivo: `src/features/predictions/components/__tests__/GroupQuickFill.test.tsx` (`// @vitest-environment jsdom`, RTL + vitest). Componente apresentacional `GroupQuickFill` + `GroupMatchRow`. Mockar `next/link` se necessário (não há nav crítica aqui). Cobrir:

1. **Render:** dado items (6), renderiza 6 linhas com nomes dos times e 12 inputs (2 por linha) com aria-label corretos.
2. **TAB order:** os inputs aparecem no DOM na ordem visual mandante→visitante por linha, e linha após linha (assert via ordem de `getAllByRole("textbox")` / querySelector — sem tabIndex positivo).
3. **Auto-save trigger:** digitar num input dispara `onScoreChange(matchId, home, away)` com os valores corretos.
4. **Save chama handler:** clicar "Salvar Grupo" chama `onSave` 1×.
5. **CTA desabilitado:** quando `isSaving`, o botão fica disabled e exibe "Salvando…"; quando nenhum item preenchido+desbloqueado, fica disabled.
6. **Locked disabled:** item com `locked` renderiza inputs `disabled` e marcador textual "Encerrado".
7. **Estados:** loading (`role=status`), error (`role=alert` + retry chama `onRetry`), empty (mensagem + link de volta).

> Toast/batch agregado: a lógica de mapeamento `saved/rejected → toast` é testada via uma função pura auxiliar `buildSaveFeedback(result)` (exportada do page ou de um helper) **ou** via teste de integração da página mockando `useGroupPredictions`/`useUpsertPredictionsBatch`/`sonner`. Preferir extrair `buildSaveFeedback` pura e testá-la (mais barato): assert das 4 ramificações de R6.

## 10. Acceptance criteria

- AC1. Acessar `/predictions/grupos/A` exibe os jogos do grupo A em linhas com 2 inputs cada e CTA "Salvar Grupo".
- AC2. Digitar placares e navegar com TAB percorre os campos na ordem visual sem saltos.
- AC3. Alterar um placar persiste rascunho local (verificável: recarregar mantém os valores).
- AC4. "Salvar Grupo" chama o batch e exibe toast agregado coerente (sucesso/parcial/erro/vazio).
- AC5. Jogos encerrados aparecem travados (inputs disabled + rótulo) e não entram no payload.
- AC6. Estados loading/error/empty corretos; error tem retry.
- AC7. tsc + eslint limpos nos arquivos alterados; testes scoped GREEN (confirmado via vitest JSON).

## 11. UI/Screen requirement

- Requires screen: **yes**
- Platform: **web** (mobile-first → desktop)
- Screens involved: PRD03-03 (Palpite em massa do grupo) + estados loading/error/empty/locked.
- `/screen` deve ser executado antes do `/implement` desta task. → `ai/screen/palpites-massa-task-09.md`.
- Product type: Sports betting pool / bracket challenge (mobile-first), estilo FotMob/ESPN.
- Recommended style: esportivo limpo e funcional, consistente com MASTER; shell verde via `.palpites-theme` (já em `globals.css`).
- Applicable UX domains: style, color, typography, ux (entrada de dados rápida por teclado).

> Nota: scripts Python do ui-ux-pro-max indisponíveis neste ambiente. Direção de design derivada de `design-system/MASTER.md` + `ai/screen/palpites-massa-task-06.md` + wireframe PRD03-03.

### Accessibility requirements
- Contraste ≥ 4.5:1 texto / ≥ 3:1 componentes (tokens MASTER + verde escopado já validados AA).
- Touch targets ≥ 44×44px nos inputs (CompactScoreInput já cumpre) e CTA; gap ≥ 8px entre alvos.
- `aria-label` obrigatório em cada input ("Gols {time}"); bandeiras `aria-hidden`/alt vazio; "x" `aria-hidden`.
- **TAB**: ordem natural do DOM (mandante→visitante por linha, linha a linha). Sem `tabIndex` positivo, sem captura de teclado.
- Status (locked) por ícone+texto, nunca só cor.
- `motion-reduce` herdado das primitivas. Foco visível (`focus-visible:ring-2 ring-ring ring-offset-2`).
- Loading com `role=status` `aria-live="polite"`; error com `role=alert`.

### Interaction requirements
- Press feedback do CTA via `transition-colors` (≤150ms) das classes de botão.
- Auto-save não bloqueia digitação (R4). Save mostra estado `isPending` ("Salvando…") imediatamente (<300ms).
- Erro de save reportado via toast (recuperável: usuário tenta de novo); estado da tela preservado.
- Toast agregado posiciona-se no provedor Sonner global (já montado).

### UI states required
- **loading:** skeleton de linhas + `role=status`.
- **empty:** mensagem "jogos indisponíveis" + link voltar.
- **populated:** linhas editáveis; CTA habilitado quando há item preenchido+desbloqueado.
- **error:** `role=alert` + "Tentar novamente" (`onRetry`).
- **saving (isPending):** CTA disabled + "Salvando…".
- **locked (por linha):** inputs disabled + rótulo "Encerrado".
- **disabled (CTA):** sem item preenchido+desbloqueado ou durante save.

## 12. Constraints

- TS strict, sem `any`. Tailwind tokens only — nenhum hex; `style` inline só para largura geométrica (não há aqui; ProgressBar já encapsula).
- Lucide imports nomeados. `next/link` para navegação.
- Mobile-first; WCAG AA.
- Não tocar arquivos de outras tasks (TASK-04/05/06 só consumir).
- Reuso obrigatório: `useGroupPredictions`, `usePredictionDraft`, `useUpsertPredictionsBatch`, `CompactScoreInput`.
- Container da rota com `.palpites-theme` (padrão das rotas de palpites).

## 13. Open questions

- Par parcial: resolvido por decisão em R3 (só grava draft/payload com par completo). Se o reviewer preferir gravar `0` no lado vazio ao salvar, é ajuste localizado no `buildSaveFeedback`/payload — mantida a regra conservadora (não inventar placar).
- Layout da seção de Classificação Prevista (TASK-10) na mesma rota: definido no spec da TASK-10 (toggle "ver classificação" pós-save). TASK-09 entrega a tela de preenchimento; o wiring do toggle é integrado na TASK-10.
