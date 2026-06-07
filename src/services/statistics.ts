import { doc, getDoc } from "firebase/firestore";

import { firestore } from "@/firebase";
import { statisticsSchema } from "@/schemas";
import type { Statistics } from "@/types";

/**
 * Camada de serviço de estatísticas (PRD-02, TASK-03).
 *
 * Funções puras de Firestore (Client SDK) para leitura de estatísticas por usuário.
 * Sem React/cache — os hooks TanStack Query que as consomem ficam na TASK-05.
 * Os erros do Firebase propagam crus (com `code`) — esta camada NÃO traduz mensagens.
 * Cada doc é validado por `statisticsSchema` (.parse) — doc fora do schema faz a Promise rejeitar.
 *
 * Convenção de não-encontrado: `getStatistics` retorna `null` quando o doc
 * `statistics/{uid}` não existe (usuário aprovado mas sem partidas finalizadas ainda).
 * Isso difere de `null` por erro: erros Firestore propagam como exceção.
 */

/**
 * Retorna as estatísticas do usuário com o dado `uid`.
 *
 * O documento fica em `statistics/{uid}`. Quando o documento não existe
 * (usuário ainda sem dados agregados), retorna `null` sem rejeitar —
 * isso permite que a UI exiba estado "sem estatísticas" sem confundir com erro.
 *
 * @param uid - UID do Firebase Auth do usuário.
 * @throws ZodError se o documento existir mas não passar na validação do schema.
 * @throws FirebaseError se a leitura falhar (propaga cru, sem tradução).
 * @returns Statistics validado, ou `null` se o documento não existir.
 */
export async function getStatistics(uid: string): Promise<Statistics | null> {
  const snap = await getDoc(doc(firestore, "statistics", uid));
  if (!snap.exists()) return null;
  return statisticsSchema.parse(snap.data());
}
