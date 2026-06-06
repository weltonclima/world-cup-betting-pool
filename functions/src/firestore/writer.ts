/**
 * Helpers de escrita idempotente no Firestore via Admin SDK.
 *
 * Usa batch.set() em vez de add() para garantir idempotência:
 * executar a mesma operação duas vezes sobrescreve o documento sem criar duplicatas.
 * O ID do documento é derivado do ID estável da API-Football (ver spec §6.4).
 *
 * WR-02: Batches são divididos em chunks de no máximo BATCH_LIMIT operações para
 * respeitar o limite de 500 escritas por requisição do Firestore Admin SDK.
 */

import { getFirestore } from "firebase-admin/firestore";
import "../firebase/admin"; // garante inicialização do Admin SDK
import type { MappedTeam } from "../mappers/teamMapper";
import type { MappedMatch } from "../mappers/matchMapper";

/** Limite conservador de operações por batch do Firestore (máximo oficial: 500) */
const BATCH_LIMIT = 450;

interface DocToWrite<T> {
  id: string;
  data: T;
}

/**
 * Divide um array em chunks de tamanho máximo `size`.
 */
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Grava seleções no Firestore de forma idempotente.
 * Coleção: `teams/{apiFootballTeamId}`
 *
 * Divide automaticamente em múltiplos batches se necessário (WR-02).
 *
 * @param teams - Array de { id, data } onde id é o ID numérico da API-Football como string
 */
export async function writeTeams(
  teams: DocToWrite<MappedTeam>[],
): Promise<void> {
  const db = getFirestore();

  for (const chunked of chunk(teams, BATCH_LIMIT)) {
    const batch = db.batch();
    for (const { id, data } of chunked) {
      const ref = db.collection("teams").doc(id);
      batch.set(ref, data); // set() = idempotente (sobrescreve)
    }
    await batch.commit();
  }
}

/**
 * Grava partidas no Firestore de forma idempotente.
 * Coleção: `matches/{apiFootballFixtureId}`
 *
 * Divide automaticamente em múltiplos batches se necessário (WR-02).
 *
 * @param matches - Array de { id, data } onde id é o ID do fixture da API-Football como string
 */
export async function writeMatches(
  matches: DocToWrite<MappedMatch>[],
): Promise<void> {
  const db = getFirestore();

  for (const chunked of chunk(matches, BATCH_LIMIT)) {
    const batch = db.batch();
    for (const { id, data } of chunked) {
      const ref = db.collection("matches").doc(id);
      batch.set(ref, data); // set() = idempotente (sobrescreve)
    }
    await batch.commit();
  }
}
