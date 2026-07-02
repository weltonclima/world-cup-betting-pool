"use client";

/**
 * `usePredictions` da Home — re-export do hook canônico da feature matches
 * (TASK-02 perf-hardening).
 *
 * ANTES: query key `homeKeys.predictions(uid)` (`["home","predictions",uid]`),
 * distinta do `usePredictions` de matches (`["matches","predictions",uid]`) que
 * `useMatchesList` usa. Resultado: `listPredictionsByUid` era chamado 2× na Home.
 *
 * AGORA: delega para o hook de matches (key `matchesKeys.predictions(uid)`) → um
 * único fetch compartilhado por todos os observers. A invalidação pós-upsert de
 * palpite (`useUpsertPrediction`) já invalida `matchesKeys.predictions(uid)`, que
 * agora cobre também os cards da Home.
 */
export { usePredictions } from "@/features/matches/hooks/usePredictions";
