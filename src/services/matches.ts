import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { firestore } from "@/firebase";
import { matchSchema } from "@/schemas";
import type { Match } from "@/types";

/**
 * Camada de serviço de partidas (PRD-02, TASK-03).
 *
 * Funções puras de Firestore (Client SDK) para leitura de partidas.
 * Sem React/cache — os hooks TanStack Query que as consomem ficam na TASK-05.
 * Os erros do Firebase propagam crus (com `code`) — esta camada NÃO traduz mensagens.
 *
 * Cada doc é validado por `matchSchema` (.parse) sobre `d.data()` apenas —
 * o schema é `.strict()` e NÃO inclui o campo `id` (doc id da API-Football).
 * O id do doc NÃO é injetado nos dados antes da validação.
 *
 * Índices Firestore compostos necessários (registrados em firestore.indexes.json):
 *   - matches: status ASC + kickoffAt ASC  (getNextScheduledMatch)
 *   - matches: status ASC + kickoffAt DESC (getRecentFinishedMatches)
 */

/**
 * Retorna a próxima partida agendada (status "scheduled"), ordenada pelo
 * `kickoffAt` mais próximo (asc), limitada a 1.
 *
 * @throws ZodError se o documento não passar na validação do schema.
 * @throws FirebaseError se a leitura falhar (propaga cru, sem tradução).
 * @returns Match validado, ou `null` se não houver partidas agendadas.
 */
export async function getNextScheduledMatch(): Promise<Match | null> {
  const q = query(
    collection(firestore, "matches"),
    where("status", "==", "scheduled"),
    orderBy("kickoffAt", "asc"),
    limit(1),
  );
  const snapshot = await getDocs(q);
  const first = snapshot.docs[0];
  if (!first) return null;
  return matchSchema.parse(first.data());
}

/**
 * Retorna as últimas partidas finalizadas (status "finished"), ordenadas por
 * `kickoffAt` decrescente (mais recentes primeiro), limitadas a 5.
 *
 * @throws ZodError se algum documento não passar na validação do schema.
 * @throws FirebaseError se a leitura falhar (propaga cru, sem tradução).
 * @returns Array de Match validados (vazio se não houver partidas finalizadas).
 */
export async function getRecentFinishedMatches(): Promise<Match[]> {
  const q = query(
    collection(firestore, "matches"),
    where("status", "==", "finished"),
    orderBy("kickoffAt", "desc"),
    limit(5),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => matchSchema.parse(d.data()));
}
