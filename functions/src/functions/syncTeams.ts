/**
 * Função callable `syncTeams` — sincroniza seleções da API-Football para o Firestore.
 *
 * Fluxo: cliente API-Football → mapApiTeamToFirestore → writeTeams (Firestore)
 *
 * Auth guard (verificar se chamador é admin) será adicionado em PRD futuro,
 * quando custom claims estiverem configurados (TASK-08 §9.4).
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { getApiFootballClient } from "../apiFootball/factory";
import { mapApiTeamToFirestore } from "../mappers/teamMapper";
import { writeTeams } from "../firestore/writer";
import { COPA_2026_CONFIG } from "../apiFootball/config";

export const syncTeams = onCall(async (request) => {
  // WR-04: Guard mínimo de autenticação — rejeita chamadas não autenticadas para
  // evitar esgotamento de cota da API-Football por clientes anônimos.
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Autenticação necessária para sincronizar seleções.");
  }
  // TODO (PRD futuro): verificar request.auth.token.role === "admin"
  // quando custom claims estiverem configurados via TASK-08.

  logger.info("syncTeams: iniciando sincronização de seleções.");

  const client = getApiFootballClient();

  try {
    const times = await client.getTeamsByTournament(
      COPA_2026_CONFIG.leagueId,
      COPA_2026_CONFIG.season,
    );

    const mapeados = times.map((t) => ({
      id: String(t.team.id),
      data: mapApiTeamToFirestore(t, t.group),
    }));

    await writeTeams(mapeados);

    logger.info(`syncTeams: ${mapeados.length} seleções gravadas no Firestore.`);
    return { synced: mapeados.length };
  } catch (err: unknown) {
    logger.error("syncTeams: erro na sincronização.", err);
    throw new HttpsError("internal", "Erro ao sincronizar seleções.");
  }
});
