# SPEC — TASK-03: Componentes base de UI (card, badges, estados)
> Feature: Jogos (PRD-03) · Plan: `ai/plan/jogos.md` · Branch: `feat/integracao-api-football`
> Dependência: TASK-01 (DONE) · Tipo: ui · Pontos: 3 · TDD: não · Screen: sim

---

## 1. Objetivo

Criar os componentes **apresentacionais** reutilizáveis da feature Jogos:

- `MatchCard` (3 variantes: Palpite Enviado / Palpite Pendente / Jogo Encerrado c/ placar)
- `MatchStatusBadge` — badge de status do palpite do usuário
- `GameStatusBadge` — badge de status do jogo
- `MatchCardSkeleton` / `MatchListSkeleton`
- `MatchesEmptyState` / `MatchesErrorState`
- Barrel `components/index.ts`
- Testes co-localizados em `components/__tests__/`

Além disso, endereçar o **WARNING-1 da review de TASK-01**: consolidar a fonte dupla de verdade
para rótulo de status do jogo (`deriveGameStatusLabel` vs `GAME_STATUS_LABEL`).

---

## 2. Arquivos a criar/modificar

### Criar
```
src/features/matches/components/MatchCard.tsx
src/features/matches/components/MatchStatusBadge.tsx
src/features/matches/components/GameStatusBadge.tsx
src/features/matches/components/MatchListSkeleton.tsx
src/features/matches/components/MatchesEmptyState.tsx
src/features/matches/components/MatchesErrorState.tsx
src/features/matches/components/index.ts
src/features/matches/components/__tests__/MatchCard.test.tsx
src/features/matches/components/__tests__/MatchStatusBadge.test.tsx
src/features/matches/components/__tests__/GameStatusBadge.test.tsx
src/features/matches/components/__tests__/MatchListSkeleton.test.tsx
src/features/matches/components/__tests__/MatchesEmptyState.test.tsx
src/features/matches/components/__tests__/MatchesErrorState.test.tsx
```

### Modificar (WARNING-1)
```
src/features/matches/lib/matchLabels.ts      — GAME_STATUS_LABEL derivado de deriveGameStatusLabel
src/features/matches/lib/matchesHelpers.ts   — manter deriveGameStatusLabel, SEM importar matchLabels
```

### NÃO modificar
```
src/features/matches/hooks/                  — escopo TASK-02/04
src/features/matches/index.ts                — barrel mínimo (orquestrador reconcilia)
```

---

## 3. Contrato visual (fonte de verdade: imagens PRD-03)

### 3.1 MatchCard — variante Palpite Enviado (PRD03-01 + PRD03-04)

Estrutura do card (de cima para baixo):
1. Linha superior: label do grupo (ex.: "Grupo C") centralizado — `text-xs text-muted-foreground`
2. Linha central: Bandeira+Nome mandante | Horário em destaque (ex.: "16:00") | Bandeira+Nome visitante
   - Horário: `text-2xl font-bold text-foreground` centralizado
   - Data abaixo do horário: `text-xs text-muted-foreground` (ex.: "12/06/2026")
   - Estádio/cidade: `text-xs text-muted-foreground` abaixo da data
3. Linha inferior: badge "PALPITE ENVIADO" (verde) + chevron direito (`>`) indicando navegação

Border: `rounded-xl border border-border bg-card shadow-sm`
Toque mínimo: `min-h-[44px]` no elemento clicável (o card inteiro é um link)

### 3.2 MatchCard — variante Palpite Pendente (PRD03-05)

Idêntico ao Enviado, com badge âmbar "PALPITE PENDENTE" no rodapé.

### 3.3 MatchCard — variante Jogo Encerrado (PRD03-06)

1. Linha superior: label do grupo + rodada (ex.: "Grupo G · Rodada 3") + data/hora compacta
2. Linha central: Bandeira+Nome mandante | **Placar** (ex.: "2 x 1") | Bandeira+Nome visitante
   - Placar: `text-3xl font-bold text-foreground`
   - Abaixo do placar: estádio + horário original (ex.: "Estádio Lusail · 16:00")
3. Linha inferior: badge "JOGO ENCERRADO" (cinza) — SEM chevron de navegação (ou chevron desabilitado)
4. Seção extra: "Resultado Final" + placar do palpite do usuário (se houver), ou "PALPITE BLOQUEADO" com
   mensagem "Palpites não disponíveis para jogos encerrados."
5. Botão/link "Visualizar Resultado e Estatísticas" (placeholder — TASK-06 preenche rota real)

### 3.4 MatchStatusBadge

Props: `status: MatchPredictionStatus`
Usa `PREDICTION_STATUS_LABEL` e `PREDICTION_STATUS_COLOR` de `matchLabels.ts`.
Semântica de cor: enviado=verde, pendente=âmbar, bloqueado=cinza.
Prefixo de ícone opcional (check para enviado, clock para pendente, lock para bloqueado).

### 3.5 GameStatusBadge

Props: `status: MatchStatus`
Usa `GAME_STATUS_LABEL` e `GAME_STATUS_COLOR` de `matchLabels.ts`.
Semântica: scheduled=azul, live=verde pulsante, finished=cinza, postponed/canceled=cinza.

### 3.6 Skeletons

`MatchCardSkeleton`: replica o layout de MatchCard com 5 barras `animate-pulse`.
`MatchListSkeleton`: renderiza N (default 3) instâncias de `MatchCardSkeleton` com separador de seção.

### 3.7 Estados

`MatchesEmptyState`: ícone `Calendar` + "Nenhum jogo encontrado" + subtexto opcional.
`MatchesErrorState`: ícone `AlertCircle` + "Erro ao carregar jogos" + botão "Tentar novamente" com `onRetry` prop.

---

## 4. Props contract

### MatchCard

```typescript
interface MatchCardProps {
  match: MatchWithId;
  homeTeam: ResolvedTeam;          // de matchesHelpers.ts
  awayTeam: ResolvedTeam;
  predictionStatus: MatchPredictionStatus;
  userPrediction?: { homeScore: number; awayScore: number } | null;
  /** href para a tela de detalhe (ex.: /matches/[id]) */
  detailHref: string;
  className?: string;
}
```

### MatchStatusBadge

```typescript
interface MatchStatusBadgeProps {
  status: MatchPredictionStatus;
  className?: string;
}
```

### GameStatusBadge

```typescript
interface GameStatusBadgeProps {
  status: MatchStatus;
  className?: string;
}
```

### MatchListSkeleton

```typescript
interface MatchListSkeletonProps {
  count?: number; // default 3
}
```

### MatchesEmptyState

```typescript
interface MatchesEmptyStateProps {
  message?: string;   // default "Nenhum jogo encontrado"
  subtitle?: string;
}
```

### MatchesErrorState

```typescript
interface MatchesErrorStateProps {
  onRetry: () => void;
  message?: string;   // default "Erro ao carregar jogos"
}
```

---

## 5. WARNING-1 — Consolidação da fonte de verdade de rótulo de status

### Problema
`deriveGameStatusLabel()` em `matchesHelpers.ts` e `GAME_STATUS_LABEL` em `matchLabels.ts`
mapeiam `MatchStatus → rótulo pt-BR` de forma duplicada e independente.

### Solução
Em `matchLabels.ts`: importar `deriveGameStatusLabel` (import de **valor**, não só tipo)
e construir `GAME_STATUS_LABEL` a partir dela:

```typescript
import { deriveGameStatusLabel } from "@/features/matches/lib/matchesHelpers";
import type { MatchStatus } from "@/types";

export const GAME_STATUS_LABEL: Record<MatchStatus, string> =
  Object.fromEntries(
    (["scheduled", "live", "finished", "postponed", "canceled"] as const).map(
      (s) => [s, deriveGameStatusLabel(s)]
    )
  ) as Record<MatchStatus, string>;
```

Em `matchesHelpers.ts`: NENHUMA importação de `matchLabels.ts` — sem ciclo de runtime.

### Verificação pós-consolidação
Rodar TASK-01 tests (`rtk vitest run ... --reporter=json`) — devem permanecer 48/48 verde.

---

## 6. Regras de implementação

1. **Componentes puramente apresentacionais** — nenhum hook/data-fetching interno.
2. **TypeScript strict** — nenhum `any`. Props totalmente tipadas com interfaces explícitas.
3. **Sem estilo inline** — apenas Tailwind + variáveis CSS de tema.
4. **Shadcn** — usar `Badge` (de `@/components/ui/badge`) e `Button` (de `@/components/ui/button`).
5. **Acessibilidade**:
   - Card como link: `role="article"` + `aria-label` descritivo
   - Badge: contraste WCAG AA (tokens semânticos garantem AA)
   - Bandeira: `alt={team.name}` em `<img>`; fallback com `aria-label={team.name}`
   - Ícone-only: `aria-label` obrigatório
   - Área de toque: `min-h-[44px]` em todo elemento interativo
   - Card inteiro navegável via teclado (Link de next/link wrapping o article)
6. **Fallback de bandeira** — iniciais quando `flagUrl` é undefined (padrão de `NextMatchCard`).
7. **`"use client"`** — todos os componentes são Client Components (interação + Link).
8. **Importações** — named imports de Lucide React; nunca `import *`.

---

## 7. Convenções de arquivo

Seguir o molde de `src/features/home/components/`:
- Cada componente em arquivo próprio com `"use client"` no topo.
- Skeleton no mesmo arquivo do componente (exportado separadamente).
- Barrel `index.ts` com `export * from` de todos.
- Testes em `__tests__/ComponentName.test.tsx` com `// @vitest-environment jsdom`.

---

## 8. Testes

### Cobertura mínima por componente

**MatchCard:**
- Renderiza article com aria-label descritivo (T1)
- Exibe nomes das seleções (T2)
- Exibe bandeiras como `<img>` quando flagUrl disponível (T3)
- Fallback de iniciais quando flagUrl ausente (T4)
- Variante enviado: badge "Enviado" visível (T5)
- Variante pendente: badge "Pendente" visível (T6)
- Variante encerrado: exibe placar (T7)
- Card é um link com href correto (T8)
- Card tem min-h-[44px] (T9)

**MatchStatusBadge:**
- Renderiza "Enviado" para status enviado (T1)
- Renderiza "Pendente" para status pendente (T2)
- Renderiza "Bloqueado" para status bloqueado (T3)

**GameStatusBadge:**
- Renderiza "Agendado" para scheduled (T1)
- Renderiza "Ao Vivo" para live (T2)
- Renderiza "Encerrado" para finished (T3)
- Renderiza "Adiado" para postponed (T4)
- Renderiza "Cancelado" para canceled (T5)

**MatchListSkeleton:**
- Renderiza N skeletons (default 3) com role="status" (T1)
- Respeita prop count (T2)

**MatchesEmptyState:**
- Exibe "Nenhum jogo encontrado" por default (T1)
- Aceita message customizada (T2)

**MatchesErrorState:**
- Exibe "Erro ao carregar jogos" (T1)
- Botão "Tentar novamente" chama onRetry (T2)

---

## 9. Critérios de aceite

| AC | Critério |
|---|---|
| AC1 | `MatchCard` renderiza 3 variantes sem erro TypeScript |
| AC2 | Bandeira fallback exibe iniciais quando `flagUrl` undefined |
| AC3 | `MatchStatusBadge` usa `PREDICTION_STATUS_LABEL` e `PREDICTION_STATUS_COLOR` |
| AC4 | `GameStatusBadge` usa `GAME_STATUS_LABEL` e `GAME_STATUS_COLOR` |
| AC5 | Skeletons têm `role="status"` e `aria-busy="true"` |
| AC6 | `MatchesErrorState` chama `onRetry` ao clicar em "Tentar novamente" |
| AC7 | `GAME_STATUS_LABEL` é derivado de `deriveGameStatusLabel` (sem duplicação) |
| AC8 | TASK-01 tests permanecem 48/48 verde após consolidação |
| AC9 | `tsc --noEmit` sem erros nos novos arquivos |
| AC10 | Nenhum `any`, nenhum `style={{}}` em nenhum componente |
| AC11 | Card inteiro é navegável via teclado (Next.js Link) |
| AC12 | Toda área interativa tem min-h-[44px] |

---

## 10. Ordem de implementação sugerida

1. **WARNING-1**: modificar `matchLabels.ts` → rodar TASK-01 tests
2. **`MatchStatusBadge.tsx`** + teste
3. **`GameStatusBadge.tsx`** + teste
4. **`MatchCard.tsx`** (3 variantes) + teste
5. **`MatchListSkeleton.tsx`** + teste
6. **`MatchesEmptyState.tsx`** + **`MatchesErrorState.tsx`** + testes
7. **`index.ts`** barrel
8. **`tsc --noEmit`** + **vitest run** (confirmar via JSON)
