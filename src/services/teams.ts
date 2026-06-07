import { collection, getDocs } from "firebase/firestore";

import { firestore } from "@/firebase";
import { teamSchema } from "@/schemas";
import type { TeamWithId } from "@/types";

/**
 * Camada de serviço de seleções (PRD-02, TASK-03).
 *
 * Funções puras de Firestore (Client SDK) para leitura de todas as seleções.
 * Sem React/cache — os hooks TanStack Query que as consomem ficam na TASK-05.
 * Os erros do Firebase propagam crus (com `code`) — esta camada NÃO traduz mensagens.
 *
 * A coleção `teams` é pequena (≤ 48 seleções na Copa 2026) e estática (populada
 * antes do torneio). Adequada para cache de join client-side (A4 do PRD-02).
 *
 * Cada doc é validado por `teamSchema` (.parse) sobre `d.data()` — o schema é
 * `.strict()` e NÃO inclui o campo `id`; o doc id (id da API-Football) é injetado
 * APÓS o parse, gerando um `TeamWithId` (TASK-05). Necessário para o join client-side.
 */

/**
 * Lista todas as seleções da coleção `teams`.
 *
 * Sem filtros ou ordenação — toda a coleção é pequena (< 50 docs) e é buscada
 * de uma vez para uso como cache de join client-side (nome/bandeira por id).
 *
 * O doc id do Firestore é injetado em cada objeto retornado após o parse do schema
 * (o schema `.strict()` não inclui `id`). Necessário para `buildTeamMap` (TASK-05).
 *
 * @throws ZodError se algum documento não passar na validação do schema.
 * @throws FirebaseError se a leitura falhar (propaga cru, sem tradução).
 * @returns Array de TeamWithId validados (vazio se a coleção estiver vazia).
 */
export async function listAllTeams(): Promise<TeamWithId[]> {
  const snapshot = await getDocs(collection(firestore, "teams"));
  return snapshot.docs.map((d) => ({ id: d.id, ...teamSchema.parse(d.data()) }));
}
