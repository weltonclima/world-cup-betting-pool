/**
 * Mapper de seleção: ApiFootball TeamResponse → documento `teams/{id}` (teamSchema).
 * Função pura — sem side effects, sem imports do Firebase, sem I/O.
 *
 * Fonte única de verdade dos tipos/validação: `@/schemas` (teamSchema é `.strict()`,
 * flagUrl validado por z.url()).
 */

import type { z } from "zod";
import { teamSchema } from "@/schemas";
import type { TeamResponse } from "@/server/apiFootball/types";

export type MappedTeam = z.infer<typeof teamSchema>;

/**
 * Converte uma TeamResponse no shape do documento `teams/{id}`.
 *
 * @param raw - Resposta da API-Football para uma seleção
 * @param groupId - Grupo da seleção (ex.: "A"). Sobrescreve raw.group se fornecido.
 * @returns Documento validado por teamSchema
 * @throws ZodError se os dados da API não satisfizerem o schema
 *   (ex.: code != 3 letras, name vazio, logo não-URL)
 */
export function mapApiTeamToFirestore(
  raw: TeamResponse,
  groupId?: string,
): MappedTeam {
  const doc = {
    name: raw.team.name,
    code: raw.team.code,
    // logo vazia/ausente → flagUrl undefined (omitido do documento)
    flagUrl: raw.team.logo || undefined,
    // groupId explícito prevalece sobre o da resposta da API
    groupId: groupId ?? raw.group ?? undefined,
  };

  // parse com Zod valida o output contra teamSchema (lança ZodError se inválido)
  return teamSchema.parse(doc);
}
