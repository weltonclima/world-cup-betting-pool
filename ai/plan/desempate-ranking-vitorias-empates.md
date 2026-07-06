# PLAN — Critério de desempate por vitórias e empates no ranking

## 1. Resumo do planejamento
A feature é uma mudança isolada e de baixo risco em uma única função pura de
ordenação (`compareRanking` em `rankingSort.ts`). Os dados necessários
(`correct`, `winner`, `draw`) já existem na interface `RankableParticipant` e já
são preenchidos por `recalc.ts` — não há trabalho de agregação, schema, API, UI
nem migração. Por ser regra de negócio de ordenação, regression-sensitive, o
trabalho é conduzido por **TDD**. Uma única tarefa cobre o escopo com segurança.

Decisão de semântica (resolvida no PRD, a confirmar no spec): **Opção A** —
`vitóriasAcertadas = correct + winner`, `empatesAcertados = draw`. Usa só campos
existentes, sem tocar em `recalc.ts`.

Posição na cadeia (recomendada, alinhada ao pedido "se os pontos empatarem, ver
vitórias"): logo após `points`.

Semântica CORRIGIDA (conforme tela A/V/E): três critérios separados, "acerto tem
mais peso". A=`correct` (placar exato), V=`winner` (só vencedor), E=`draw` (empate).

Cadeia final de desempate:
```
1. points DESC
2. correct DESC   ← NOVO — acerto (A), MAIOR PESO
3. winner DESC    ← NOVO — vitória (V)
4. draw DESC      ← NOVO — empate (E)
5. accuracy DESC
6. wrong ASC
7. firstPredictionAt ASC
8. uid ASC
```

## 2. Fases de execução recomendadas
- **Fase 1 – regra de negócio (única):** ajustar o comparador de desempate e
  cobrir com testes. Não há fase de fundação, contrato ou integração — a
  interface e a agregação já suportam a mudança.

## 3. Tasks

### TASK-01 – Desempate por vitórias e empates no comparador de ranking
- Type: domain
- Goal: quando `points` empata, desempatar por vitórias acertadas
  (`correct + winner`) DESC e depois por empates acertados (`draw`) DESC, antes
  dos critérios atuais (accuracy, wrong, firstPredictionAt, uid).
- Scope:
  - Inserir dois passos novos em `compareRanking`, na ordem: após `points`,
    antes de `accuracy`.
  - Tratar os campos opcionais com fallback `?? 0` para manter comparador total
    e determinístico.
  - Atualizar o comentário de cabeçalho do arquivo (a cadeia documentada) e a
    observação de que `correct/winner/draw` agora participam do desempate.
  - **Não** alterar `recalc.ts` (campos já preenchidos nos três escopos: geral,
    fase, grupo) — apenas confirmar.
- Main modules/files likely involved:
  - `src/features/rankings/lib/rankingSort.ts` (mudança)
  - `src/features/rankings/lib/__tests__/rankingSort.test.ts` (testes)
  - `src/server/rankings/recalc.ts` (leitura/confirmação, sem mudança esperada)
- Dependencies: nenhuma
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: Confirmar no spec a semântica de "vitórias" (Opção A: `correct+winner`).
  Efeito só se materializa no próximo recálculo do ranking; sem migração. Cobrir
  em testes: (a) empate de pontos resolvido por vitórias; (b) empate de pontos e
  vitórias resolvido por empates; (c) queda para critérios atuais quando os três
  primeiros empatam; (d) estabilidade/determinismo com campos ausentes (`?? 0`).

## 4. Mapa de dependências
- TASK-01: sem dependências. Única tarefa.

## 5. Ordem de execução recomendada
1. TASK-01

## 6. Riscos de planejamento e bloqueios
- **Ambiguidade a confirmar no spec:** definição de "vitórias" (`correct+winner`
  inclui placar exato de jogo empatado). Recomendação Opção A já registrada; se o
  usuário exigir semântica pura (separar `correct` de jogos empatados), o escopo
  cresce (novo campo em `recalc`) — vira TASK adicional. Não bloqueia a Opção A.
- **Sem bloqueios técnicos.** Mudança em função pura, coberta por TDD.
- plan-checker skipped (small low-risk plan — 1 tarefa, criticidade medium,
  risco baixo).
