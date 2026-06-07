import { collection, getDocs, limit, query, where } from "firebase/firestore";

import { firestore } from "@/firebase";
import { rankingSchema } from "@/schemas";
import type { Ranking } from "@/types";

/**
 * Camada de serviço de rankings (PRD-02, TASK-03).
 *
 * Funções puras de Firestore (Client SDK) para leitura de rankings.
 * Sem React/cache — os hooks TanStack Query que as consomem ficam na TASK-05.
 * Os erros do Firebase propagam crus (com `code`) — esta camada NÃO traduz mensagens.
 * Cada doc é validado por `rankingSchema` (.parse) — doc fora do schema faz a Promise rejeitar.
 */

/**
 * Retorna o documento de ranking com `scope:"geral"`.
 *
 * A coleção `rankings` armazena um doc por escopo; o doc de escopo "geral"
 * contém o ranking geral consolidado (todas as partidas, todos os usuários).
 *
 * @throws ZodError se o documento não passar na validação do schema.
 * @throws FirebaseError se a leitura falhar (propaga cru, sem tradução).
 * @returns O documento de ranking geral validado, ou `null` se não existir.
 */
export async function getGeneralRanking(): Promise<Ranking | null> {
  const q = query(
    collection(firestore, "rankings"),
    where("scope", "==", "geral"),
    limit(1),
  );
  const snapshot = await getDocs(q);
  const first = snapshot.docs[0];
  if (!first) return null;
  return rankingSchema.parse(first.data());
}
