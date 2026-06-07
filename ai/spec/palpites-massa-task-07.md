# SPEC

## 1. Task: TASK-07 – Tela Hub de Palpites (PRD03-01 + estados)

## 2. Objective
Entregar a tela inicial do fluxo de palpites em massa: progresso global "X / 104", lista de cards por fase (7 fases) com contagem de jogos/pendentes e bloqueio de fases futuras (A6), CTA "⚡ Completar Copa", e os 4 estados visuais (vazio/andamento/enviado/bloqueado). Aplicar o tema verde escopado `.palpites-theme` no container da área de palpites.

## 3. In scope
- Rota `src/app/(app)/predictions/page.tsx` (substitui o destino atual; vira o Hub).
- Componente apresentacional `src/features/predictions/components/PredictionsHub.tsx` (recebe dados por props — testável isolado, sem fetch interno).
- Derivação de view-model no `page.tsx` (data-fetching via hooks) → props do `PredictionsHub`.
- Adicionar a classe `.palpites-theme` em `src/app/globals.css` (decisão TASK-06 §6) e aplicá-la no container raiz da página do Hub.
- Documentar `.palpites-theme` no MASTER.md (§2.4-palpites).
- ProgressBar global "X / 104" via `computeProgress(predictions, matches)`.
- 7 `PhaseCard`: Grupos, 16 Avos, Oitavas, Quartas, Semifinal, 3º Lugar, Final — cada um com `gamesCount`/`pendingCount`/`status`/`href`.
- Regra de bloqueio de fase futura (A6): uma fase desbloqueia somente quando a fase anterior está concluída.
- CTA "⚡ Completar Copa".
- Estados: vazio (PRD03-13), em andamento (PRD03-14), enviado/concluído (PRD03-15), e tratamento de fase bloqueada por card (PRD03-16); loading e error globais da tela.

## 4. Out of scope
- Construção das telas de destino (grid de grupos é TASK-08; palpite em massa, classificação, bracket são tasks posteriores). Cards apenas linkam.
- Reapontar o item de navegação "Palpites" (TASK-16).
- Modo contínuo encadeado real do "Completar Copa" (TASK-16). Aqui o CTA navega para o primeiro passo pendente (grupos), sem orquestração de wizard.
- Persistência/envio (sem mutação nesta tela).
- Edição das primitivas `ProgressBar`/`PhaseCard` (já entregues na TASK-06).

## 5. Main technical areas
- `src/app/(app)/predictions/page.tsx` (client component; data-fetching + view-model).
- `src/features/predictions/components/PredictionsHub.tsx` (apresentacional).
- `src/features/predictions/components/index.ts` (export do novo componente).
- `src/app/globals.css` (`.palpites-theme`).
- `design-system/MASTER.md` (§2.4-palpites).
- Hooks reusados: `useMatches` (`@/features/matches/hooks`), `usePredictions` (`@/features/predictions/hooks`), `useAuth` (uid).
- Lib reusada: `computeProgress` (`@/features/predictions/lib`).
- Primitivas reusadas: `ProgressBar`, `PhaseCard` (`@/features/predictions/components`).

## 6. Business rules and behavior
- **Fases e ordem (fixas, em constante dedicada):**
  | Stage (enum) | Rótulo | href |
  |---|---|---|
  | `grupos` | Fase de Grupos | `/predictions/grupos` |
  | `dezesseis-avos` | 16 Avos de Final | `/predictions/chave/dezesseis-avos` |
  | `oitavas` | Oitavas de Final | `/predictions/chave/oitavas` |
  | `quartas` | Quartas de Final | `/predictions/chave/quartas` |
  | `semifinal` | Semifinal | `/predictions/chave/semifinal` |
  | `terceiro` | Disputa de 3º Lugar | `/predictions/chave/terceiro` |
  | `final` | Final | `/predictions/chave/final` |
  > Os `href` de fases eliminatórias apontam para rotas ainda não construídas (placeholder de convenção — não navegáveis até existirem; ainda assim válidos como destino). O único `href` funcional nesta entrega é o de Grupos.
- **Contagem por fase:** `gamesCount` = nº de partidas daquela `stage` em `matches`; `pendingCount` = `gamesCount − filled` da fase, derivado de `computeProgress(...).byStage[stage]`. Fase sem partidas em `matches` → `gamesCount = 0`.
- **Status do card (derivado, não bloqueado):**
  - `concluido` quando `gamesCount > 0` e `pendingCount === 0`.
  - `andamento` quando `0 < filled < gamesCount`.
  - `nao-iniciado` quando `filled === 0` e `gamesCount > 0`.
- **Bloqueio de fase futura (A6):** percorrer as fases na ordem fixa; a primeira fase (`grupos`) nunca bloqueia. Uma fase posterior recebe `status = "bloqueado"` (sobrepõe o status derivado) enquanto **a fase imediatamente anterior não estiver `concluido`**. Fases com `gamesCount === 0` contam como não-concluídas para fins de desbloqueio (não destravam a seguinte). `PhaseCard` com `status="bloqueado"` não navega (já é o comportamento da primitiva).
- **ProgressBar global:** `value = global.filled`, `total = global.total` (esperado 104; se `matches` vier parcial, usa o total real disponível — sem hardcode de 104 no cálculo, mas o copy pode citar a meta). Label default "X / Y".
- **CTA "⚡ Completar Copa":** `Button` (variant default, tema verde herdado) com ícone `Zap`. `href` = primeira fase não-concluída e não-bloqueada (na prática `/predictions/grupos` enquanto grupos não estiver completo; quando grupos completo, primeira fase eliminatória disponível). Rótulo permanece "⚡ Completar Copa".
- **Estados da tela:**
  - **loading:** enquanto `isLoading` (matches ou predictions) → skeleton/placeholder com `role="status"` `aria-live="polite"`.
  - **error:** `isError` → mensagem + botão "Tentar novamente" (`onRetry` = refetch).
  - **vazio (PRD03-13):** `global.filled === 0` → ProgressBar em 0/Y, todos os cards em `nao-iniciado`/`bloqueado`, copy de incentivo ("Você ainda não fez nenhum palpite"). Não é um estado separado de layout — é o Hub com progresso zero + CTA "Começar".
  - **em andamento (PRD03-14):** `0 < global.filled < global.total` → CTA "Continuar/Completar Copa".
  - **enviado/concluído (PRD03-15):** `global.filled === global.total` e `total > 0` → banner de conclusão ("Copa completa!" / ✓) + cards concluídos; CTA pode esconder ou virar "Revisar". Não há flag de envio (A5) — "enviado" é derivado da completude.
- **uid ausente:** AuthGuard já protege a rota; mesmo assim, sem uid as queries ficam desabilitadas → tratar como loading.

## 7. Contracts and interfaces

### PredictionsHub (apresentacional)
```ts
type PhaseHubItem = {
  stage: Stage;            // do enum stageSchema
  title: string;
  gamesCount: number;
  pendingCount: number;
  status: PhaseStatus;     // "nao-iniciado" | "andamento" | "concluido" | "bloqueado"
  href: string;
};

interface PredictionsHubProps {
  /** Progresso global agregado. */
  filled: number;
  total: number;
  /** Fases já com status/bloqueio resolvidos, na ordem de exibição. */
  phases: PhaseHubItem[];
  /** Destino do CTA "Completar Copa". */
  completeHref: string;
  /** true quando todas as fases com jogos estão concluídas. */
  isComplete: boolean;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}
```
- `PredictionsHub` é puro: sem hooks de dados, sem `useAuth`. Toda derivação (status/bloqueio/contagem) acontece no `page.tsx` (ou em um helper puro testável). **Recomendado:** extrair `buildHubPhases(progress, matchesByStageCount)` como função pura local ao componente/módulo para teste direto da regra A6 — opcional, mas a regra de bloqueio DEVE ser testável.

### page.tsx
- Client component. Usa `useAuth()` (uid), `useMatches()`, `usePredictions(uid)`.
- Deriva `computeProgress(predictions, matches)`, monta `PhaseHubItem[]` (ordem fixa + A6), calcula `completeHref`/`isComplete`, passa tudo ao `PredictionsHub`.
- Envolve o conteúdo no container `.palpites-theme`.

## 8. Data and persistence impact
Nenhuma escrita. Leitura via React Query (`useMatches`, `usePredictions`) já existente. Sem novo schema, sem nova coleção. `globals.css` ganha a classe de escopo `.palpites-theme` (remapeia `--primary`/`--ring`/`--sidebar-primary` para o verde AA validado em `.auth-theme`).

## 9. Required tests
Arquivo: `src/features/predictions/components/__tests__/PredictionsHub.test.tsx` (`// @vitest-environment jsdom`), mockando nada além do necessário (componente é puro). Padrão de asserção igual a `MassPredictionPrimitives.test.tsx` (`toBeTruthy`/`getAttribute`).
- **render**: título, ProgressBar com fração "X / Y" e role progressbar; 7 cards de fase renderizados com seus títulos.
- **progresso**: `filled`/`total` refletidos no aria-valuenow/valuetext da barra.
- **estado vazio**: `filled=0` → copy de incentivo presente; CTA presente.
- **estado em andamento**: `0<filled<total` → CTA "Completar Copa" com href correto.
- **estado concluído (enviado)**: `filled===total` → banner/indicador de conclusão; cards concluídos com ✓ (texto "Concluído").
- **bloqueio A6**: dado um `phases` onde Grupos não está concluído, fases seguintes vêm `bloqueado` → cards bloqueados sem `<a>`/href (assert ausência de role link) e com `aria-disabled`. Quando Grupos concluído, a fase seguinte deixa de estar bloqueada.
- **navigation links**: card de Grupos renderiza link com `href="/predictions/grupos"`; CTA renderiza link/botão com `completeHref`.
- **aria**: ProgressBar `role="progressbar"`; cards com `aria-label` resumido; CTA com rótulo acessível; ícones decorativos `aria-hidden`.
- **loading**: `isLoading` → `role="status"`.
- **error**: `isError` → botão "Tentar novamente" chama `onRetry`.
- Se `buildHubPhases` for extraída: teste unitário puro da regra A6 (desbloqueio em cascata, fase com 0 jogos não destrava a seguinte).

## 10. Acceptance criteria
- Hub renderiza progresso global "X / 104" (ou total real), os 7 cards de fase na ordem fixa, e o CTA "⚡ Completar Copa".
- Fases futuras aparecem bloqueadas até a anterior concluir (A6) e não navegam quando bloqueadas.
- Os 4 estados (vazio/andamento/enviado/bloqueado-por-card) + loading + error renderizam corretamente.
- `.palpites-theme` aplicado no container; CTA/barra/realce em verde dentro do escopo; neutro fora.
- `tsc` e `eslint` limpos nos arquivos alterados; testes do Hub verdes.
- Sem `any`, sem hex, sem `style` (exceto a exceção geométrica já encapsulada na ProgressBar), Lucide named import, `next/link` para navegação.

## 11. UI/Screen requirement
- Requires screen: **yes**
- Platform: **web** (mobile-first → desktop)
- Screens involved: PRD03-01 (Hub) + estados PRD03-13/14/15/16.
- `/screen` deve ser executado antes do `/implement` desta task.
- Product type: Sports betting pool / bracket challenge (mobile-first, estilo FotMob/ESPN).
- Recommended style: Esportivo limpo e funcional (MASTER.md); shell/CTA/barra em verde via `.palpites-theme` (decisão TASK-06).
- Applicable UX domains: style, color, typography, ux, accessibility, navigation, states.
- Nota: scripts Python do ui-ux-pro-max indisponíveis neste ambiente — direção derivada de `design-system/MASTER.md` + wireframes PNG (`docs/prd-03-1/PRD03-01`, `PRD03-13..16`).

### Accessibility requirements
- Contraste ≥ 4.5:1 texto / ≥ 3:1 componentes — verde escopado e neutros do MASTER já validados AA.
- Touch targets ≥ 44×44px (PhaseCard `p-4` e CTA garantem); gap ≥ 8px entre cards (`gap-3/4`).
- ProgressBar com `role="progressbar"` + `aria-valuemin/max/now/valuetext` (já na primitiva).
- Cards com `aria-label` resumido; estado bloqueado com `aria-disabled` e sem link; ícones decorativos `aria-hidden`.
- Loading: `role="status"` `aria-live="polite"`. Status nunca por cor isolada (ícone+texto: ✓ "Concluído", 🔒 "Bloqueado").
- Foco visível `focus-visible:ring-2 ring-ring ring-offset-2`; ordem natural do DOM; sem tabIndex positivo.
- Reduced motion: `motion-reduce:transition-none` (barra/hover já cobertos).

### Interaction requirements
- Press feedback via `transition-colors duration-150` nos cards/CTA.
- Loading state quando fetch > 300ms (skeleton/placeholder).
- Error com recuperação inline (botão "Tentar novamente").
- CTA destacado (primário verde) e tappable; cards inteiros tappable.

### UI states required
- loading, empty (PRD03-13), populated/em-andamento (PRD03-14), complete/enviado (PRD03-15), per-card blocked (PRD03-16), error. Cada um com tratamento visual claro (definido no `/screen`).

## 12. Constraints
- TypeScript strict, sem `any`.
- Tailwind tokens apenas; sem hex; sem `style` inline (exceto largura geométrica já encapsulada na ProgressBar).
- Lucide named imports (`Zap`, `Trophy`, etc.); `next/link` para navegação interna.
- `PredictionsHub` apresentacional e puro (sem fetch) para testabilidade; data-fetching só no `page.tsx`.
- `.palpites-theme` reusa o verde AA de `.auth-theme` (não criar verde novo); remapeia apenas `--primary`/`--primary-foreground`/`--ring`/`--sidebar-primary`.
- Reusar primitivas e lib existentes — não duplicar lógica de progresso/cards.
- Mobile-first; coluna única de cards (`flex flex-col gap-3`), `pb-20 md:pb-4` para compensar BottomNav.

## 13. Open questions
- **Rótulo/destino do CTA quando a Copa está completa:** assume-se esconder o CTA ou trocar para "Revisar Palpites" (sem nova rota). Decisão de cópia fica para o `/screen`; não bloqueia.
- **Rotas de fase eliminatória** (`/predictions/chave/[stage]`) ainda não existem; os `href` são da convenção de rota e só ficarão navegáveis em tasks futuras. Não bloqueia (cards eliminatórios nascem bloqueados por A6 até grupos concluir).
