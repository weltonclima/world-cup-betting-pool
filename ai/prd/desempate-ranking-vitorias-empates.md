# PRD — Critério de desempate por vitórias e empates no ranking

## 1. Resumo da feature
Adicionar dois novos critérios de desempate ao ranking do bolão: quando dois
participantes têm a **mesma pontuação**, desempatar pela **quantidade de acertos
de vitória** (jogos com vencedor que o participante acertou) e, persistindo o
empate, pela **quantidade de acertos de empate**. Só depois desses dois passos a
cadeia continua com os critérios já existentes.

A ordem pedida pelo usuário é:
1. **pontos** (já existe)
2. **acertos** — mais acertos primeiro
3. **vitórias** — mais acertos de vitória primeiro
4. **empates** — mais acertos de empate primeiro

## 2. Escopo consolidado
Interpretação confirmada com o usuário: os critérios adicionais são **acerto,
vitória e empate**, aplicados após a pontuação. Traduzindo para os campos já
existentes no domínio de ranking (`RankableParticipant`):

- **acerto** → `correct` (placar exato, 10 pts) + `winner` (só o vencedor, 5 pts)
  + `draw` (só o empate, 5 pts) já contribuem para `points` e para `accuracy`.
  O passo "acertos" já é coberto hoje por `accuracy DESC` (percentual de acertos
  exatos no escopo). **Este PRD trata da inclusão explícita de vitórias e empates.**
- **vitórias** → acertos em jogos que terminaram com **vencedor**. Combina
  `correct` (cravou o placar de um jogo com vencedor) + `winner` (acertou só o
  vencedor). Ou seja, `vitóriasAcertadas = correct + winner`.
- **empates** → acertos de empate: `draw` (acertou que o jogo seria empate).

**Nota:** `correct` no domínio inclui placares exatos de jogos que terminaram
empatados também. Precisa ser esclarecido na fase de spec se `correct` de jogos
empatados deve entrar em "vitórias" ou "empates" (ver seção 6).

Cadeia de desempate resultante proposta (posição na cadeia deixada a critério da
equipe pelo usuário — recomendação: logo após `points`, mantendo os critérios
atuais como desempate final):

```
1. points DESC        (ponderado, já existe)
2. vitóriasAcertadas DESC   (NOVO — correct + winner)
3. draw DESC          (NOVO — empates acertados)
4. accuracy DESC      (já existe)
5. wrong ASC          (já existe)
6. firstPredictionAt ASC (já existe)
7. uid ASC            (fallback estável, já existe)
```

## 3. Entendimento do sistema relevante para a feature
- **Ordenação:** `src/features/rankings/lib/rankingSort.ts` — funções puras
  `compareRanking` e `rankParticipants`. É o único ponto de ordenação/desempate.
  O comparador é um comparador total (retorna 0 só quando `uid` é igual).
- **Contrato de ordenação:** interface `RankableParticipant` já expõe os campos
  necessários e opcionais para desempate: `correct?`, `winner?`, `draw?`. Hoje o
  comentário no arquivo diz que eles são "só carona até a entry" e **não**
  participam do desempate. Esta feature muda isso.
- **Origem dos dados:** `src/server/rankings/recalc.ts` agrega os palpites
  finalizados e já popula `correct`, `winner`, `draw`, `wrong`, `accuracy` tanto
  no ranking geral quanto por fase/grupo, e chama `rankParticipants`. Os valores
  já chegam ao comparador — não é preciso novo cálculo de agregação.
- **Consumidores:** `rankParticipants`/`compareRanking` são usados apenas em
  `recalc.ts` (ordenação server-side) e nos testes. A UI consome o ranking já
  ordenado (`position` atribuída no server), então **não há mudança de UI**.
- **Persistência:** o ranking é recalculado e gravado em Firestore via Admin SDK.
  A ordem/`position` é derivada; mudar o comparador só muda a ordem no próximo
  recálculo. Não há migração de schema.

## 4. Análise de impacto técnico
- **Módulo de ordenação (`rankingSort.ts`):** inserção de 2 novos passos no
  comparador. Como `correct`/`winner`/`draw` são opcionais, precisa de fallback
  (`?? 0`) para manter o comparador total e determinístico. Atualizar o
  comentário de cabeçalho (a cadeia documentada).
- **`recalc.ts`:** nenhuma mudança funcional esperada — os campos já são passados.
  Confirmar que os três escopos (geral, por fase, por grupo) preenchem os três
  campos (o grep confirma que sim).
- **Contratos de API / schema:** **nenhum**. `RankingEntry` não muda; a única
  mudança é a *ordem* das entries e a `position`.
- **UI:** nenhuma mudança de componente. Efeito visível apenas na ordem de linhas
  quando havia empate de pontos.
- **Testes:** `rankingSort.test.ts` precisa de novos casos cobrindo os dois novos
  desempates e a estabilidade da cadeia completa.

## 5. Riscos
- **Risco de regressão baixo:** mudança isolada em função pura, sem alteração de
  contrato nem de persistência. Coberto por testes unitários.
- **Semântica de "vitórias":** se a definição de `correct+winner` divergir da
  expectativa do usuário (ex.: se `correct` de jogo empatado for indevidamente
  contado como vitória), o ranking pode desempatar de forma inesperada. Precisa
  de decisão explícita no spec.
- **Ordem na cadeia:** o usuário não fixou a posição exata; a escolha altera o
  resultado em empates. Recomendação: logo após `points` (mais alinhado ao
  pedido "se os pontos forem iguais, ver vitórias").
- **Recálculo:** a nova ordem só se materializa no próximo `recalc`. Sem risco de
  dados corrompidos, mas rankings já gravados só mudam ao recalcular.

## 6. Ambiguidades e lacunas
1. **Definição exata de "vitórias":** `vitórias = correct + winner`? E o
   `correct` de um jogo que terminou **empatado** (placar exato de um empate) —
   entra em "vitórias" ou em "empates"? Decisão necessária no spec.
   - Opção A (simples): `vitórias = correct + winner`, `empates = draw`. Fácil,
     mas conta placar exato de empate como "vitória".
   - Opção B (semântica pura): precisaria decompor `correct` por resultado do
     jogo (com vencedor vs. empate), o que **não** está disponível hoje em
     `RankableParticipant` (exigiria novo campo vindo do `recalc`).
2. **Posição na cadeia:** confirmada como decisão da equipe (recomendação:
   após `points`).
3. **"a mesma coisa para o empate":** interpretado como um passo adicional de
   desempate por `draw DESC`. Confirmado.

## 7. Recomendações para o planejamento
- Tratar como **uma tarefa única** de baixo risco (função pura + testes), tipo
  `domain`, sem frontend.
- Aplicar **TDD**: é regra de negócio de ordenação, regression-sensitive.
- Resolver a ambiguidade #1 no spec **antes** de implementar. Recomendação
  pragmática: Opção A (`vitórias = correct + winner`, `empates = draw`), por usar
  só os campos existentes, sem tocar em `recalc`. Se a semântica pura for exigida,
  vira tarefa maior (novo campo no agregador).
- Sem migração, sem mudança de schema/UI. Efeito só no próximo recálculo.
