/**
 * Ordenação e desempate de ranking (PRD-05 "Critérios de Desempate"), funções puras.
 *
 * `points` agora é PONDERADO (5/10, TASK-03) — não mais === acertos exatos. O critério
 * do PRD "mais acertos exatos" deixa de ser redundante com "maior pontuação", mas NÃO se
 * adiciona um passo novo: `accuracy DESC` (acertos exatos / mesmo denominador no escopo)
 * já desempata por exatos. Cadeia efetiva de desempate:
 *   1. points DESC (ponderado)
 *   2. vitórias acertadas DESC (correct + winner) — acertos em jogos com vencedor
 *   3. empates acertados DESC (draw) — acertos de empate
 *   4. accuracy DESC (acertos exatos no escopo)
 *   5. wrong ASC
 *   6. firstPredictionAt ASC (mais antigo primeiro; ausente vai por último)
 *   7. uid ASC (fallback estável → ordem total determinística)
 *
 * Os campos `correct`/`winner`/`draw` PARTICIPAM do desempate (passos 2–3): quando os
 * pontos empatam, quem acertou mais vitórias (placar exato OU só o vencedor) fica à frente;
 * persistindo o empate, quem acertou mais empates. São opcionais em RankableParticipant →
 * ausência conta como 0 (`?? 0`) para manter o comparador total e determinístico.
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

  // Vitórias acertadas DESC: acertos em jogos com vencedor (placar exato + só vencedor).
  const winsA = (a.correct ?? 0) + (a.winner ?? 0);
  const winsB = (b.correct ?? 0) + (b.winner ?? 0);
  if (winsB !== winsA) return winsB - winsA;

  // Empates acertados DESC.
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
