import { collection, getDocs, query, where } from "firebase/firestore";

import { firestore } from "@/firebase";
import { predictionSchema } from "@/schemas";
import type { Prediction } from "@/types";

/**
 * Camada de serviço de palpites (PRD-02, TASK-03).
 *
 * Funções puras de Firestore (Client SDK) para leitura de palpites por usuário.
 * Sem React/cache — os hooks TanStack Query que as consomem ficam na TASK-05.
 * Os erros do Firebase propagam crus (com `code`) — esta camada NÃO traduz mensagens.
 * Cada doc é validado por `predictionSchema` (.parse) — doc fora do schema faz a Promise rejeitar.
 */

/**
 * Lista todos os palpites do usuário com o dado `uid`.
 *
 * Os palpites são usados para join client-side com as partidas: comparar
 * `prediction.homeScore`/`awayScore` com o placar real para calcular acertos
 * (isCorrect — D1/R2 do PRD-02). Sem ordenação explícita (a UI ordena client-side).
 *
 * @param uid - UID do Firebase Auth do usuário.
 * @throws ZodError se algum documento não passar na validação do schema.
 * @throws FirebaseError se a leitura falhar (propaga cru, sem tradução).
 * @returns Array de Prediction validados (vazio se o usuário não tiver palpites).
 */
export async function listPredictionsByUid(uid: string): Promise<Prediction[]> {
  const q = query(
    collection(firestore, "predictions"),
    where("uid", "==", uid),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => predictionSchema.parse(d.data()));
}
