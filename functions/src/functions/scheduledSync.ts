/**
 * Função agendada `scheduledSync` — sincronização diária de resultados e standings.
 *
 * Cron: 0 2 * * * (02:00 UTC diariamente).
 * Fluxo atual (stub): obtém fixtures da API e registra no log.
 *
 * TODO (PRD futuro): mapear fixtures e gravar matches/results no Firestore
 * quando IDs Copa 2026 estiverem confirmados (COPA_2026_CONFIG.leagueId/season).
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { getApiFootballClient } from "../apiFootball/factory";
import { COPA_2026_CONFIG } from "../apiFootball/config";

// Executa diariamente às 02:00 UTC
export const scheduledSync = onSchedule("0 2 * * *", async () => {
  logger.info("scheduledSync: início da sincronização agendada.");

  const client = getApiFootballClient();

  try {
    // Stub — sincronização completa (fixtures + resultados) a ser implementada
    // quando IDs Copa 2026 estiverem confirmados (COPA_2026_CONFIG.leagueId/season)
    const fixtures = await client.getFixtures(
      COPA_2026_CONFIG.leagueId,
      COPA_2026_CONFIG.season,
    );

    logger.info(
      `scheduledSync: ${fixtures.length} fixtures recebidos da API. ` +
        "Mapeamento e gravação pendentes (PRD futuro).",
    );
    // TODO (PRD futuro): mapear fixtures → matches e gravar no Firestore
  } catch (err: unknown) {
    logger.error("scheduledSync: erro na sincronização agendada.", err);
    // Não relançar — o scheduler do Firebase registrará falha mas não reenfileira
  }
});
