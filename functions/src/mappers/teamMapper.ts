/**
 * Mapper de seleção: ApiFootball TeamResponse → documento Firestore (teamSchema).
 * Função pura — sem side effects, sem imports do Firebase, sem I/O.
 * Output validado por teamSchema para garantir integridade dos dados no Firestore.
 */

import type { z } from "zod";
import { teamSchema } from "../shared/schemas";
import type { TeamResponse } from "../apiFootball/client";

export type MappedTeam = z.infer<typeof teamSchema>;

/**
 * Converte uma TeamResponse da API-Football no shape do documento `teams/{id}` no Firestore.
 *
 * @param raw - Resposta da API-Football para uma seleção
 * @param groupId - Grupo da seleção (ex.: "A", "B"). Sobrescreve raw.group se fornecido.
 * @returns Documento Firestore validado pelo teamSchema
 * @throws ZodError se os dados da API não satisfizerem o schema
 */
export function mapApiTeamToFirestore(
  raw: TeamResponse,
  groupId?: string,
): MappedTeam {
  const doc = {
    name: raw.team.name,
    code: raw.team.code,
    // logo vazia ou ausente → flagUrl undefined (omitido do documento)
    flagUrl: raw.team.logo || undefined,
    // groupId explícito prevalece sobre o da resposta da API
    groupId: groupId ?? raw.group ?? undefined,
  };

  // parse com Zod valida o output contra teamSchema;
  // lança ZodError se o dado da API for inválido (ex.: code com 4 chars, name vazio)
  return teamSchema.parse(doc);
}
