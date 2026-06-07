# SPEC — TASK-12: Tela Ranking dos Melhores Terceiros (PRD03-06)

> PRD: `ai/prd/palpites-massa.md` (§6.1 A2/A6/A7, §6.2.1 D-OF4) | Plano: `ai/plan/palpites-massa.md` (TASK-12)
> Design contract: `design-system/MASTER.md` (§2.4-palpites) | Screen: `ai/screen/palpites-massa-task-12.md`
> Wireframe: `docs/prd-03-1/PRD03-06-Melhores-Terceiros.png`
> Tipo: ui | SP: 3 | Criticidade: medium | Risco técnico: low | TDD: no | Screen: yes
> Depende de: TASK-02 (`rankBestThirds`, `computeGroupStandings`), TASK-06 (primitivas/tema). CTA aponta para a fase de chave (TASK-13/14, ainda não implementada).

---

## 1. Objetivo

Sexta etapa do wizard de palpites em massa: exibir os **8 melhores terceiros colocados** (critério FIFA, via `rankBestThirds` da TASK-02) ranqueados de 1 a 8, com bandeira + nome + Pts/Saldo/GP de cada seleção, e oferecer o CTA **"Gerar 16 Avos"** que avança para a fase de chave (`/predictions/chave/dezesseis-avos`). O CTA só é habilitado quando **todos os 12 grupos estão completos** (6 jogos preenchidos cada).

Decisão A2: esta classificação é **VISUAL, não pontuada**. Nada é persistido nesta tela — apenas projeção derivada dos palpites de grupo do usuário. Só os 104 placares pontuam.

---

## 2. Escopo

### 2.1 Dentro do escopo

- **Rota** `src/app/(app)/predictions/melhores-terceiros/page.tsx` — Client Component que faz data-fetching (`useMatches` + `useTeams` + `usePredictions`), deriva `buildThirdsRanking` e o estado de completude dos 12 grupos, e renderiza `BestThirdsRanking` dentro do container `.palpites-theme`.
- **Componente** `src/features/predictions/components/BestThirdsRanking.tsx` — APRESENTACIONAL e puro: recebe `thirds` (ranking já calculado), `resolveTeamName`, `allGroupsComplete`, `completedGroupsCount`, `totalGroupsCount`, `bracketHref`, `isLoading`, `isError`, `onRetry`. Exporta também o helper puro `buildThirdsRanking(matches, predictions)`.
- **Teste** `src/features/predictions/components/__tests__/BestThirdsRanking.test.tsx` — cobre `buildThirdsRanking` (pura) + render do componente (tabela ranqueada, CTA habilitado/desabilitado, estados loading/error/empty, acessibilidade).
- **Artefatos** `ai/spec/palpites-massa-task-12.md` + `ai/screen/palpites-massa-task-12.md`.

### 2.2 Fora do escopo

- **NÃO editar** `src/features/predictions/components/index.ts` — restrição de merge sem conflito. A página importa o componente **diretamente pelo caminho** (`@/features/predictions/components/BestThirdsRanking`).
- Não implementa a tela de chave (`/predictions/chave/dezesseis-avos`) — o CTA apenas linka para ela (TASK-13/14).
- Não persiste nada (A2 — visual). Sem mutações.
- Não altera `standings.ts` nem `rankBestThirds`/`computeGroupStandings`.
- Não toca em navegação, wizard (TASK-16) ou demais telas.

---

## 3. Contrato do componente

```ts
export interface ThirdRankingEntry {
  /** Posição no ranking de terceiros (1-based, 1 = melhor). */
  rank: number;
  /** Entrada de standings do 3º colocado do grupo (de rankBestThirds). */
  entry: GroupStandingEntry;
  /** groupId de origem ("A".."L"). */
  groupId: string;
}

export interface ThirdsRankingResult {
  /** Os 8 (ou menos) melhores terceiros, ranqueados 1..N. */
  thirds: ThirdRankingEntry[];
  /** Grupos com todos os jogos preenchidos. */
  completedGroupsCount: number;
  /** Total de grupos detectados (esperado 12). */
  totalGroupsCount: number;
  /** true quando todos os grupos detectados estão completos e há ≥ 1. */
  allGroupsComplete: boolean;
}

/** Helper puro — agrupa, computa standings por grupo, ranqueia terceiros. */
export function buildThirdsRanking(
  matches: MatchWithId[],
  predictions: Prediction[],
): ThirdsRankingResult;

export interface BestThirdsRankingProps {
  thirds: ThirdRankingEntry[];
  resolveTeamName: (teamId: string) => ResolvedTeam;
  allGroupsComplete: boolean;
  completedGroupsCount: number;
  totalGroupsCount: number;
  bracketHref: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function BestThirdsRanking(props: BestThirdsRankingProps): React.JSX.Element;
```

---

## 4. Regras (R)

- **R1 — Ranking dos terceiros.** `buildThirdsRanking` agrupa as partidas com `stage === "grupos"` e `groupId` definido por `groupId`. Para cada grupo, computa `computeGroupStandings(matchesDoGrupo, predictions)` e monta `Record<groupId, GroupStandings>`. Passa esse Record a `rankBestThirds` (TASK-02), que devolve os 8 melhores ordenados (pts → saldo → gols pró → teamId). Mapeia cada um para `ThirdRankingEntry` com `rank = index + 1` e o `groupId` de origem.
- **R2 — Origem do groupId.** Como `rankBestThirds` perde o groupId, `buildThirdsRanking` mantém um `Map<teamId, groupId>` ao construir o Record (cada terceiro pertence a exatamente um grupo). O `groupId` exibido (badge "Grupo X") vem desse Map pelo `teamId`.
- **R3 — Completude dos grupos (A6 / habilitar CTA).** Um grupo está completo quando **todos** os seus jogos têm palpite (`filled === total` e `total > 0`). `completedGroupsCount` conta esses grupos; `allGroupsComplete = totalGroupsCount > 0 && completedGroupsCount === totalGroupsCount`. O CTA "Gerar 16 Avos" só fica habilitado (link navegável) quando `allGroupsComplete`; caso contrário renderiza um botão `disabled` com `aria-disabled` e texto auxiliar ("Complete os 12 grupos para gerar a chave — X de Y").
- **R4 — Não pontuada (A2).** Nenhuma persistência. Tudo derivado client-side dos palpites já existentes.
- **R5 — Ranking parcial.** Se `< 8` terceiros tiverem palpites suficientes para definir posição 3 (grupos incompletos), o ranking exibe os que existirem; o CTA permanece desabilitado até todos completarem. Quando `thirds.length === 0`, exibe estado vazio coerente (não tabela vazia).
- **R6 — Estados.** loading → skeleton (`role="status"`); error → alerta + retry; empty (sem terceiros) → mensagem orientando preencher os grupos; happy → tabela ranqueada + CTA.

---

## 5. Acessibilidade (nível enhanced)

- Tabela acessível: `<table>` com `<caption class="sr-only">`, `<th scope="col">` em todos os cabeçalhos (Pos/Seleção/Grupo/Pts/SG/GP).
- Bandeira decorativa: `<img alt="" aria-hidden="true">` (nome textual ao lado).
- Saldo de gols com sinal explícito ("+4"/"0"/"-2") e `abbr title` em SG/GP.
- CTA desabilitado comunica estado não só por cor: `disabled` + `aria-disabled="true"` + texto "Complete os 12 grupos…" + ícone `Lock`. Habilitado: `<Link>` com `aria-label`.
- Touch targets ≥ 44px (`min-h-[44px]` no CTA).
- `motion-reduce` no skeleton (`animate-pulse motion-reduce:animate-none`).
- Cor não-exclusiva: status de completude por ícone (`CheckCircle2`/`Lock`) + texto.

---

## 6. Tema e tokens

- Container raiz da rota: `.palpites-theme` (MASTER §2.4-palpites — shell verde, já em `globals.css`).
- Componente usa **apenas tokens** (`text-foreground`, `text-muted-foreground`, `bg-card`, `bg-muted`, `border-border`, `bg-win-bg`/`text-win`, `text-primary`, `text-destructive`). Herda o verde dentro do escopo; neutro fora dele (testável isolado).
- Zero hex, zero `style`, zero `any`.

---

## 7. Imports

### `BestThirdsRanking.tsx`
```ts
import Link from "next/link";
import { CheckCircle2, Lock, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  rankBestThirds,
  computeGroupStandings,
  type GroupStandingEntry,
  type AllGroupStandings,
} from "@/features/predictions/lib";
import type { MatchWithId, Prediction } from "@/types";
import type { ResolvedTeam } from "@/features/matches/lib/matchesHelpers";
```

### `page.tsx`
```ts
"use client";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMatches, useTeams } from "@/features/matches/hooks";
import { usePredictions } from "@/features/predictions/hooks";
import { buildTeamMap, resolveTeam } from "@/features/matches/lib/matchesHelpers";
import {
  BestThirdsRanking,
  buildThirdsRanking,
} from "@/features/predictions/components/BestThirdsRanking"; // import direto (não barrel)
```

**Proibições:** sem `any`, sem `style={{}}`, sem hex, sem editar `components/index.ts`, sem chamadas a API-Football no browser.

---

## 8. Critérios de aceitação

- [ ] `buildThirdsRanking` agrupa por groupId, computa standings, e devolve os 8 melhores terceiros ranqueados 1..N com groupId de origem.
- [ ] `allGroupsComplete` true ⟺ todos os grupos detectados completos (≥ 1 grupo).
- [ ] Tabela exibe Pos, bandeira+nome, Grupo, Pts, SG (com sinal), GP por linha, na ordem do ranking.
- [ ] CTA "Gerar 16 Avos" habilitado (Link → `/predictions/chave/dezesseis-avos`) só quando `allGroupsComplete`; caso contrário desabilitado com texto/contagem.
- [ ] Estados loading (skeleton role=status), error (alert + retry), empty (sem terceiros) cobertos.
- [ ] Acessibilidade: tabela com scope, caption sr-only, ícone+texto no status, ≥ 44px no CTA.
- [ ] `index.ts` NÃO modificado; página importa o componente pelo caminho.
- [ ] tsc + eslint limpos nos arquivos alterados; testes scoped GREEN.
- [ ] Sem `any`, sem inline style, sem hex.

---

## 9. O que NÃO faz

- Não implementa a tela de chave nem `buildBracketFromFixtures`.
- Não persiste (A2 visual).
- Não edita o barrel de componentes (merge-safe).
- Não altera a lib de standings.
