# REVIEW — TASK-05 · Badge "lançado pelo admin"

> PRD-12 `palpites-manuais-grupo` · revisado 2026-06-12 · veredito: **APROVADO (com evidência)**

## Escopo revisado
Diff: 2 arquivos-fonte + 1 teste.
- `src/features/predictions/hooks/usePredictionsList.ts`
- `src/features/predictions/components/PredictionListCard.tsx`
- `src/features/predictions/components/__tests__/PredictionListComponents.test.tsx`

Gate `gsd-code-reviewer` (CLAUDE.md): diff <5 arquivos, criticidade low, tipo ui → **não atende** → review próprio. (GSD desabilitado nesta config.)

## Conformidade com spec + ui-spec

| Critério (spec §10 / ui-spec) | Status | Evidência |
|---|---|---|
| `isManual: boolean` em `PredictionListItem` | ✓ | `usePredictionsList.ts:40` |
| Derivado de `Boolean(prediction.editedBy)` | ✓ | `usePredictionsList.ts:119` |
| Badge só com `editedBy` presente | ✓ | render `item.isManual ? <ManualOriginBadge/> : null` (`PredictionListCard.tsx:174`) |
| Não vaza em palpite normal | ✓ | teste T-M2 (queryByText → null) |
| Texto "Lançado pelo admin" | ✓ | `PredictionListCard.tsx:95` |
| Ícone `ShieldCheck` `aria-hidden` | ✓ | `PredictionListCard.tsx:94` |
| Tokens semânticos (`bg-muted`/`text-muted-foreground`, sem hex) | ✓ | `PredictionListCard.tsx:92` |
| Coexiste com badge de status, footer `flex-wrap` | ✓ | `PredictionListCard.tsx:166,173`; teste T-M3 |
| Sem efeito em pontuação/ordenação | ✓ | nenhuma mudança em `displayStatus`/score/sort |
| Strict TS, sem `any` | ✓ | tipo explícito; tsc sem erro nos arquivos da task |

## Verificação (evidência real)
- **Testes:** `vitest run` → **64/64 passou** (`success: true`). Badge: T-M1 (isManual=true exibe), T-M2 (false não exibe), T-M3 (coexiste com status) — todos verde.
- **tsc:** 46 erros pré-existentes, **todos** em `.next/types/app/**` (TS2307, artefato stale de build). **Zero** nos arquivos da task. Sem regressão introduzida.

## Achados
Nenhum bloqueante. Nenhum de severidade média/alta.

Nota menor (não-bloqueante): badge usa `title="Lançado pelo admin"` como hint de hover — redundante com o texto visível, mas alinhado ao ui-spec §4 (opcional). OK.

## Veredito
**APROVADO.** Implementação bate exata com spec + ui-spec; comportamento coberto por teste; sem regressão. Pronto para commit.
