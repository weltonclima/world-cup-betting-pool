# SPEC — TASK-13: Componente de Chave Interativa (Bracket)

> Feature: `palpites-massa` · PRD: `ai/prd/palpites-massa.md` (§6.1 A1/A6, §6.2.1 D-OF4/D-BRACKET)
> Plano: `ai/plan/palpites-massa.md` (TASK-13) · Design: `design-system/MASTER.md` + `ai/screen/palpites-massa-task-06.md` (`.palpites-theme`)
> Gerado: 2026-06-07

## 1. Objetivo

Componente reutilizável de chave eliminatória (`Bracket`) e de confronto (`BracketMatchup`)
que recebe os confrontos de uma fase (saída de `buildBracketFromFixtures`), renderiza um
`CompactScoreInput` por lado e deriva o vencedor (`deriveWinner`). É a peça base das telas
de eliminatória (TASK-14). Apresentacional e puro — sem hooks de dados; orquestração
(draft, batch, resolução de slots) fica no `page.tsx`/`KnockoutPhaseScreen`.

## 2. Decisões herdadas

- **A1** — eliminatória pontua placar exato; vencedor é DERIVADO do placar.
- **A6** — fase bloqueada até a anterior concluir (tratado nas telas, TASK-14).
- **D-OF4** — `homeTeamId`/`awayTeamId` podem ser placeholders ("2A", "W74", "3ABC").
  A UI exibe rótulo humano via novo helper `humanizePlaceholder`.
- Empate em eliminatória: `deriveWinner` retorna `isDraw=true` → a UI mostra hint inline
  exigindo placar não-empatado para avançar (não bloqueia digitação nem o save).

## 3. Contrato dos componentes

### `humanizePlaceholder(id: string): string` (helper, em `lib/bracket.ts`)
Converte placeholder → rótulo pt-BR. Retorna o `id` original se não for placeholder.
- `"1A"` → `"1º Grupo A"`
- `"2B"` → `"2º Grupo B"`
- `"3ABC"` → `"3º (Grupos A/B/C)"`
- `"W74"` → `"Vencedor jogo 74"`
- `"L101"` → `"Perdedor jogo 101"`

### `resolveSlotLabel(slot, resolveTeamName): { name; flagUrl; isPlaceholder }`
Helper de componente: se `slot.teamId` não é placeholder, resolve via `resolveTeamName`;
caso contrário usa `humanizePlaceholder` (sem bandeira).

### `BracketMatchup` (componente)
Props: `matchup` (tipo `BracketMatchupType` da lib, renomeado no import), `homeScore`,
`awayScore`, `locked`, `resolveTeamName`, `onScoreChange(matchId, home, away)`.
- Dois lados (home/away) com nome/bandeira + `CompactScoreInput`.
- Vencedor derivado via `deriveWinner` quando ambos preenchidos e não-empate: realça o
  lado vencedor (token `text-win` + ícone, nunca cor isolada — texto "Vence").
- Empate: hint inline `role="status"` ("Empate não avança — ajuste o placar").
- `aria-label` por input ("Gols 1º Grupo A").

### `Bracket` (componente)
Props: `matchups: BracketMatchupType[]`, `scores: Record<matchId,{home,away}>`,
`lockedMatchIds: Set<string>` (ou função), `resolveTeamName`, `onScoreChange`, `title?`.
- Renderiza lista de `BracketMatchup`.
- Responsivo: `flex flex-col gap-3` mobile → `md:grid md:grid-cols-2` desktop (colunas).
- `role="list"` / itens `role="listitem"`.

## 4. Acessibilidade
- Inputs ≥ 44px (CompactScoreInput já garante), `aria-label` único por lado.
- Empate/vencedor com ícone + texto (cor não-exclusiva).
- Hint de empate via `role="status"` (anunciado por leitores de tela).
- TAB natural (DOM order home → away por confronto).

## 5. Testes (scoped)
- `humanizePlaceholder`: todos os formatos + id real passthrough.
- `BracketMatchup`: render com time real, render com placeholder (rótulo humano),
  vencedor derivado exibido, hint de empate, input locked.
- `Bracket`: render de N matchups, presença de classes responsivas (`md:grid-cols-2`).

## 6. Tema
Tokens apenas; herda o verde dentro de `.palpites-theme` (aplicado pela tela TASK-14).
