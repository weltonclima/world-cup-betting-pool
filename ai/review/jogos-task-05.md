# Review — TASK-05: Sheet de Filtros (Jogos / PRD-03)

> Reviewer: Staff Engineer (adversarial) | Commit: `daf8dd2`
> Spec: `ai/spec/jogos-task-05.md` | Screen: `ai/screen/jogos-task-05.md` | Design: `design-system/MASTER.md`
> Imagem fonte: `docs/prd-03/PRD03-03-Tabela-Grupos.png` (sheet de FILTROS, apesar do nome)

## Verdict: REJECTED

> **Re-review (BLOCKER fix) — ver seção no fim do arquivo. Novo verdict: APPROVED.**

- **BLOCKER:** 2
- **WARNING:** 4
- tsc: limpo (exit 0). IDE diagnostics: 0 em todos os arquivos alterados. Suite: 28 testes novos, build verde.

Os dois BLOCKERs são violações de área de toque (Priority 2 — CRÍTICO) que contradizem o
próprio spec (§8) e o design-system (§10.2: mínimo 44×44px, WCAG 2.5.5). Lógica, tipos, estado
de rascunho, single-source-of-truth e ARIA estão corretos; o que falha é a meta de toque que a
própria task declarou obrigatória.

---

## BLOCKERS

### B-01 — Botões toggle de Fase/Status com 36px (< 44px) [Priority 2]
**Arquivo:** `src/features/matches/components/MatchFiltersSheet.tsx:110` (ToggleButton)
O `ToggleButton` usa `h-9` (36px). O spec §8 e a tabela de acessibilidade (linha 257) exigem
explicitamente `min-h-[44px]` em **botões de toggle e itens de lista**; o design-system §10.2
fixa 44×44px como mínimo WCAG 2.5.5. Os itens da lista de seleção respeitam (`min-h-[44px]`), mas
os ~9 botões de Fase + 4 de Status ficam em 36px — alvos de toque insuficientes no contexto mobile
crítico da feature.
**Fix:** trocar `"... h-9 px-3 ..."` por `"... min-h-[44px] px-3 ..."` (ou `h-11`) no `ToggleButton`.

### B-02 — Botão de fechar (X) do Sheet com 28px (< 44px) [Priority 2]
**Arquivo:** `src/components/ui/sheet.tsx:62-77`
O close button built-in usa `Button size="icon-sm"` que, neste `button.tsx` (variante Base UI nova),
mapeia para `size-7` = **28×28px**. É o controle primário de descarte do overlay e está bem abaixo
de 44px. ESC/overlay funcionam (Base UI), mas o alvo visível de toque é deficiente.
**Fix:** no `SheetContent` desta task, passar uma classe que force `min-h-[44px] min-w-[44px]` no
close, ou usar `size="icon"` com override `className="size-11"`. (O header do MatchListHeader já faz
isso corretamente com `min-h-[44px] min-w-[44px]` — replicar o padrão.)

---

## WARNINGS

### W-01 — Pipeline de filtro por teamId sem cobertura de teste [Test Quality]
**Arquivo:** `src/features/matches/components/MatchList.tsx:138-144`
O filtro `item.homeTeamId === selectedTeamId || item.awayTeamId === selectedTeamId` não é exercitado
por nenhum teste. Em `MatchList.test.tsx` o `MatchFiltersSheet` é mockado para `null` e não há setter
externo de `selectedTeamId`, então o ramo fica morto nos testes. Os 28 testes novos cobrem o sheet
isolado (draft/apply/clear), mas a *integração* do commit de teamId → re-filtragem da lista não é
verificada. Lógica é simples e foi validada por leitura, mas é regressão desprotegida.
**Fix:** adicionar teste de integração que renderiza MatchList com o sheet real (ou um teste que
chama `onApply({ teamId })` e assere que a lista re-filtra), cobrindo home e away match.

### W-02 — `toMatchWithId` ainda emite sentinela `""` para home/awayTeamId [Maintainability]
**Arquivo:** `src/features/matches/components/MatchList.tsx:99-100`
Agora que `MatchListItem` expõe `homeTeamId`/`awayTeamId` reais (TASK-05), o sentinela `""` virou
débito desnecessário: o adaptador descarta ids válidos e os substitui por strings vazias, mantendo
um `MatchWithId` semanticamente inválido em circulação. Inofensivo hoje (o card não consome), mas é
uma armadilha latente para qualquer consumidor futuro de `match.homeTeamId`.
**Fix:** `homeTeamId: item.homeTeamId, awayTeamId: item.awayTeamId,` — ids já disponíveis, custo zero,
remove o comentário-desculpa.

### W-03 — "Limpar Filtros" com 40px (< 44px) [Priority 2, severidade menor]
**Arquivo:** `src/features/matches/components/MatchFiltersSheet.tsx:392`
`h-10` = 40px na ação secundária de footer. Abaixo de 44px. Menos crítico que B-01/B-02 (ação
secundária, largura total facilita o toque), mas mesmo padrão de desvio.
**Fix:** `h-11` para alinhar com "Aplicar Filtros".

### W-04 — Lista `role="listbox"` sem navegação por setas (roving tabindex) [Priority 1, parcial]
**Arquivo:** `src/features/matches/components/MatchFiltersSheet.tsx:291-375`
Cada `role="option"` tem `tabIndex={0}`, então o Tab percorre todas as opções e Enter/Espaço
ativam — funcional e operável por teclado. Porém o padrão ARIA APG para listbox espera navegação
por setas com roving `tabIndex` (um item tabável; ↑/↓ move foco). Leitores de tela podem anunciar
o widget como listbox e o usuário esperar setas. Operável, mas não conforme ao role declarado.
**Fix (opcional):** ou implementar roving tabindex + onKeyDown ↑/↓, ou trocar `role="listbox"`/
`option` por uma lista de botões/`role="radiogroup"`+`radio` (mais simples e honesto p/ seleção única).

---

## UI/UX Review

### Violações por prioridade
| Priority | Violações | Severidade |
|---|---|---|
| 1 — Acessibilidade | 1 (W-04, listbox/teclado) | WARNING |
| 2 — Toque & Interação | 3 (B-01, B-02 = BLOCKER; W-03 = WARNING) | 2 BLOCKER + 1 WARNING |
| 3-10 | 0 | — |

- **BLOCKER count:** 2 (B-01, B-02 — ambos Priority 2 touch).
- **WARNING count:** 4 (W-01..W-04).

### Critical Violations (Priority 1-2 — sempre blocking)
- B-01: toggle buttons 36px < 44px.
- B-02: sheet close (X) 28px < 44px.

### Top-3 Priority Fixes
1. **B-01 — Toggle buttons para `min-h-[44px]`** — alvos de Fase/Status hoje em 36px quebram WCAG
   2.5.5 no contexto mobile da feature — trocar `h-9` por `min-h-[44px]` no `ToggleButton`.
2. **B-02 — Close (X) do Sheet para 44px** — controle primário de descarte em 28px — forçar
   `size-11`/`min-h-[44px] min-w-[44px]` no `SheetClose` do `SheetContent`.
3. **W-01 — Cobrir o pipeline de teamId** — adicionar teste de integração apply(teamId) →
   re-filtragem (home + away), eliminando o ramo morto em `MatchList.tsx:138-144`.

### Recommendations (não-blocking)
- W-02: usar os ids reais em `toMatchWithId` (remover sentinela `""`).
- W-03: "Limpar Filtros" `h-10` → `h-11`.
- W-04: alinhar a lista de seleção ao padrão APG (roving tabindex) ou migrar para `radiogroup`.

---

## Pontos validados (sem achados)
- Single source of truth: chips (header) e sheet compartilham o MESMO estado em `MatchList`
  (`selectedStage`/`selectedPredictionStatus`/`selectedTeamId`) — sem fonte dupla. ✔
- Draft-state pattern: edições só comitam no "Aplicar"; `useEffect([open])` re-sincroniza ao abrir;
  omissão intencional de deps documentada e correta. ✔
- `filtersCount` dinâmico (stage+status+teamId) reflete badge no header. ✔
- ARIA: `aria-pressed` nos toggles, `role="listbox"`/`option`+`aria-selected`, `aria-label` na busca,
  bandeiras decorativas com `alt=""`/`aria-hidden`, seções com `aria-labelledby`. ✔
- Focus trap / ESC / overlay / retorno de foco: delegados ao Base UI Dialog (shadcn Sheet). ✔
- TypeScript strict: sem `any` no componente (o `as any` está apenas no mock de teste — aceitável).
  Sem estilos inline. Tokens semânticos do design-system (sem hex). ✔
- Desvios da imagem (Bloqueado→Jogo Encerrado; ●→Check; verde=primary) documentados no screen §10. ✔
- tsc limpo; IDE diagnostics 0 em todos os arquivos; 28 testes novos do sheet verdes. ✔

---

_Reviewer: Claude (review skill, adversarial) — modelo Opus 4.8_

---

## Re-review (BLOCKER fix)

> Re-review focada (não full re-run) após REJECTED. Commit na branch `feat/integracao-api-football`.
> Escopo: B-01, B-02, W-02, W-03. Arquivos alterados lidos integralmente; IDE diagnostics
> executado nos três.

### Novo Verdict: APPROVED

| Achado | Status | Evidência |
|---|---|---|
| B-01 (BLOCKER) | **CLEARED** | `MatchFiltersSheet.tsx:110` — `ToggleButton` agora `min-h-11` (44px). Base `size="sm"` é `h-7` (height:28px), mas `min-h-11` vence em CSS (min-height > height) → altura renderizada 44px. Cobre os ~9 botões de Fase + 4 de Status (todos via o mesmo `ToggleButton`). |
| B-02 (BLOCKER) | **CLEARED** | `sheet.tsx:68` — close button `className="absolute top-3 right-3 min-h-11 min-w-11"`. Base `size="icon-sm"` é `size-7` (28px), mas `min-h-11`/`min-w-11` (44px) sobrescrevem → alvo de toque 44×44px. |
| W-02 | **CLEARED** | `MatchList.tsx:98-99` — `toMatchWithId` agora passa `item.homeTeamId`/`item.awayTeamId` (ids reais; confirmados em `useMatchesList.ts:38,40,134-135`). Sentinela `""` removido; docstring atualizada. |
| W-03 | **CLEARED** | `MatchFiltersSheet.tsx:384,392` — "Aplicar Filtros" e "Limpar Filtros" ambos `h-11` (44px). |
| W-04 | **KNOWN WARNING (mantido)** | `role="listbox"` sem roving tabindex/setas. Tab + Enter/Espaço funcionam (operável); não-blocking conforme review original. |

### Verificações adicionais
- **IDE diagnostics:** 0 em `MatchFiltersSheet.tsx`, `sheet.tsx`, `MatchList.tsx`. ✔
- **tsc/testes:** reportados limpos (tsc exit 0; 243/243 matches+ui verdes). Não re-executei a suíte
  (re-review focada); arquivos de teste presentes (`__tests__/MatchFiltersSheet.test.tsx` etc.). ✔
- **Nenhum novo issue** introduzido pelos quatro fixes.

_Re-reviewer: Claude (review skill, adversarial) — modelo Opus 4.8_
