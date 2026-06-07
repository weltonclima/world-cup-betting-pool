/** Score de um jogo (ausente enquanto não jogado) */
export interface OpenFootballScore {
  ft?: [number, number];
  ht?: [number, number];
  et?: [number, number];
  p?: [number, number];
}

/**
 * Partida de grupo (sem `num`) — team1/team2 são nomes reais de seleções.
 * Partida de mata-mata (com `num`) — team1/team2 podem ser placeholders
 *   como "2A", "1E", "W74", "L101".
 */
export interface OpenFootballMatch {
  round: string;           // "Matchday 1", "Round of 32", "Final" etc.
  num?: number;            // presente apenas em mata-mata (73–104)
  date: string;            // "YYYY-MM-DD"
  time?: string;           // "HH:MM UTC±H" (pode ser ausente em TBD)
  team1: string;           // nome real ou placeholder
  team2: string;
  group?: string;          // "Group A"…"Group L" (só em jogos de grupo)
  ground?: string;         // nome do estádio/cidade
  score?: OpenFootballScore;
}

/** Shape raiz do JSON openfootball */
export interface OpenFootballData {
  name: string;
  matches: OpenFootballMatch[];
}
