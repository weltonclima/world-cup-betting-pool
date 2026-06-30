/**
 * Esquema canônico de `matchId` da Copa.
 *
 * Estas primitivas NÃO são código de fonte (openfootball já removido) — são o
 * esquema de ID estável que toda a aplicação usa como chave de `predictions/{matchId}`.
 * A ingestão ESPN (`espnMatchId.ts`) DEVE produzir IDs byte-idênticos a estes,
 * e a fórmula de slug é a única fonte dessa paridade.
 */

/**
 * Slug determinístico de nome de seleção: lowercase, não-alfanuméricos viram
 * "-", colapsa repetições e apara as bordas.
 *
 * Ex.: "Curaçao" → "cura-ao"; "Bosnia & Herzegovina" → "bosnia-herzegovina".
 */
export function slugifyTeamName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Gera o matchId estável para uma partida.
 *
 * Mata-mata (com `num`): "m{num}" — ex.: "m73", "m104".
 * Grupo (sem `num`):  slug determinístico "{date}-{slug(team1)}-{slug(team2)}".
 */
export function buildMatchId(match: {
  num?: number;
  date: string;
  team1: string;
  team2: string;
}): string {
  if (match.num !== undefined) {
    return `m${match.num}`;
  }
  return `${match.date}-${slugifyTeamName(match.team1)}-${slugifyTeamName(match.team2)}`;
}
