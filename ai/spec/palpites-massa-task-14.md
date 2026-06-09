# SPEC — TASK-14: Telas das fases eliminatórias

> Feature: `palpites-massa` · PRD: `ai/prd/palpites-massa.md` (§6.1 A1/A6, §6.2.1 D-OF4)
> Plano: `ai/plan/palpites-massa.md` (TASK-14, dep TASK-13) · Design: MASTER + screen task-13
> Gerado: 2026-06-07

## 1. Objetivo

Telas das 5 fases eliminatórias (16 avos, oitavas, quartas, semifinal, final + 3º lugar)
usando o `Bracket` (TASK-13). Rota dinâmica `(app)/predictions/chave/[stage]`. Persiste
palpites como placar exato por `matchId` real (A1/A3) via batch local + server.

## 2. Rota e parâmetros

`app/(app)/predictions/chave/[stage]/page.tsx`, `stage ∈`:
`dezesseis-avos` | `oitavas` | `quartas` | `semifinal` | `final`.

- `final` renderiza DUAS chaves: a final (`usePhaseMatches("final")`) e o 3º lugar
  (`usePhaseMatches("terceiro")`) — PRD03-11.
- Param inválido → `notFound()`.

## 3. Mapa de fases (constante)

`KNOCKOUT_STAGES`: ordem + rótulo pt-BR + href anterior/próximo. Usado para navegação
e para a regra de bloqueio A6.

| slug | rótulo | anterior |
|---|---|---|
| dezesseis-avos | 16 avos de final | (grupos/terceiros) |
| oitavas | Oitavas de final | dezesseis-avos |
| quartas | Quartas de final | oitavas |
| semifinal | Semifinais | quartas |
| final | Final e 3º lugar | semifinal |

## 4. Bloqueio de fase (A6)

Uma fase é desbloqueada quando a fase imediatamente anterior está completa (todos os
confrontos da fase anterior têm palpite salvo OU rascunho). `dezesseis-avos` nunca
bloqueia (primeira eliminatória). Quando bloqueada, a tela exibe estado "Bloqueado"
(ícone Lock + texto + CTA para a fase anterior), sem renderizar o Bracket.

A "completude" da fase anterior é derivada de `computeProgress(predictions+draft, matchesDaFase)`:
fase anterior completa = filled === total (total > 0).

## 5. Persistência

- Auto-save local: `usePredictionDraft.setDraft(matchId, {home, away})` quando o par
  está completo (ambos números). Não persiste par parcial.
- Server: CTA "Salvar Fase" → `useUpsertPredictionsBatch` com os confrontos não
  bloqueados e com par completo. Feedback agregado via Sonner (reusa buildSaveFeedback).
- Persiste contra `matchId` real (D-OF4): mesmo com slots placeholder, o `matchId`
  do fixture existe e é pontuável (A1/A3).

## 6. Componente `KnockoutPhaseScreen`

Apresentacional: recebe `sections` (array de {title?, matchups, ...}), `scores`,
`lockedMatchIds`, `resolveTeamName`, estados, handlers e navegação (prev/next href,
isLocked, prevHref). Renderiza header da fase, 1+ Bracket, navegação, e estados
loading/error/empty/bloqueado. Reusa skeleton/erro no padrão das outras telas.

## 7. Estados
| Estado | Tratamento |
|---|---|
| loading | skeleton role=status |
| error | role=alert + retry |
| empty (sem fixtures) | mensagem + link voltar |
| bloqueado (A6) | Lock + texto + CTA fase anterior; sem Bracket |
| populated | Bracket(s) + CTA Salvar + navegação |

## 8. Testes (scoped)
- render da fase (matchups via Bracket) com fixtures resolvidos.
- bloqueio: fase anterior incompleta → estado bloqueado, sem inputs.
- persist: clicar "Salvar Fase" chama o handler de save com o payload esperado.
- final: renderiza seção da final + seção do 3º lugar.

## 9. Tema
Container `.palpites-theme` (shell verde). Tokens apenas; Lucide; next/link; mobile-first.
