/**
 * Ordenação e desempate de ranking (PRD-05 "Critérios de Desempate"), funções puras.
 *
 * `points` agora é PONDERADO (5/10, TASK-03) — não mais === acertos exatos. O critério
 * do PRD "mais acertos exatos" deixa de ser redundante com "maior pontuação", mas NÃO se
 * adiciona um passo novo: `accuracy DESC` (acertos exatos / mesmo denominador no escopo)
 * já desempata por exatos. Cadeia efetiva de desempate:
 *   1. points DESC (ponderado)
 *   2. acerto DESC (correct = placar exato; "A" na UI — MAIOR PESO no desempate)
 *   3. vitória DESC (winner = acertou só o vencedor; "V" na UI)
 *   4. empate DESC (draw = acertou o empate; "E" na UI)
 *   5. accuracy DESC (acertos exatos no escopo)
 *   6. wrong ASC
 *   7. firstPredictionAt ASC (mais antigo primeiro; ausente vai por último)
 *   8. uid ASC (fallback estável → ordem total determinística)
 *
 * Os campos `correct`/`winner`/`draw` PARTICIPAM do desempate (passos 2–4) e correspondem
 * exatamente às colunas A/V/E exibidas na tela de ranking. Quando os pontos empatam,
 * "acerto tem mais peso": desempata primeiro por placares exatos (correct), depois por
 * vitórias acertadas (winner), depois por empates acertados (draw). São opcionais em
 * RankableParticipant → ausência conta como 0 (`?? 0`) p/ manter o comparador determinístico.
 */

/** Shape de domínio para ordenação. NÃO persistido (firstPredictionAt não está em RankingEntry). */
export interface RankableParticipant {
  uid: string;
  points: number; // pontos PONDERADOS (5/10, TASK-03); ordena o ranking
  accuracy: number; // 0–100 (derivado de acertos exatos no escopo)
  wrong: number; // erros
  firstPredictionAt?: string; // ISO; ausente = sem palpites
  // Decomposição dos acertos por tipo no escopo (Tela 01). Opcionais: não
  // participam do desempate (já coberto por points/accuracy) — só carona até a entry.
  correct?: number; // placares EXATOS (10 pts)
  winner?: number; // acertou vencedor sem placar (5 pts)
  draw?: number; // acertou empate sem placar (5 pts)
}

export interface RankedParticipant extends RankableParticipant {
  position: number; // 1-indexed
}

/** Comparador total. Retorna 0 apenas quando o uid é igual (mesma entidade). */
export function compareRanking(
  a: RankableParticipant,
  b: RankableParticipant,
): number {
  if (b.points !== a.points) return b.points - a.points; // points DESC

  // Acerto (A) DESC — placares exatos. Maior peso no desempate.
  const correctA = a.correct ?? 0;
  const correctB = b.correct ?? 0;
  if (correctB !== correctA) return correctB - correctA;

  // Vitória (V) DESC — acertou só o vencedor.
  const winnerA = a.winner ?? 0;
  const winnerB = b.winner ?? 0;
  if (winnerB !== winnerA) return winnerB - winnerA;

  // Empate (E) DESC — acertou o empate.
  const drawA = a.draw ?? 0;
  const drawB = b.draw ?? 0;
  if (drawB !== drawA) return drawB - drawA;

  if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy; // accuracy DESC
  if (a.wrong !== b.wrong) return a.wrong - b.wrong; // wrong ASC

  // firstPredictionAt ASC, ausente por último.
  // Compara por instante (Date.parse) — ISO com offsets diferentes pode representar o
  // mesmo instante; comparação lexicográfica de string seria incorreta nesse caso.
  const fa = a.firstPredictionAt;
  const fb = b.firstPredictionAt;
  if (fa !== fb) {
    if (fa === undefined) return 1;
    if (fb === undefined) return -1;
    const ta = Date.parse(fa);
    const tb = Date.parse(fb);
    if (Number.isNaN(ta) || Number.isNaN(tb)) {
      // Fallback defensivo (datas já validadas por isoDateTime upstream): compara string.
      if (fa !== fb) return fa < fb ? -1 : 1;
    } else if (ta !== tb) {
      return ta - tb; // mesmo instante → cai para o desempate por uid
    }
  }

  return a.uid.localeCompare(b.uid); // fallback estável
}

/** Ordena (cópia, sem mutar a entrada) e atribui `position` 1-indexed sequencial. */
export function rankParticipants(
  list: RankableParticipant[],
): RankedParticipant[] {
  return [...list]
    .sort(compareRanking)
    .map((participant, index) => ({ ...participant, position: index + 1 }));
}
