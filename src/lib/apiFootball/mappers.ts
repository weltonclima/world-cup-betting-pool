import type { MatchStatus, Stage } from "@/types/shared";

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

/**
 * Resultado do parse de `league.round` da API-Football.
 * Compatível com o shape de `round`/`groupId` em `matchSchema`.
 */
export interface ParsedRound {
  /** Fase do torneio no domínio do bolão. */
  stage: Stage;
  /** Número da rodada (ex.: 2 em "Group Stage - 2"); null em fases únicas. */
  round: number | null;
  /**
   * Identificador do grupo (ex.: "Group A").
   * Sempre null neste parser — o campo vem de `standings[].group` na API,
   * não de `league.round`. Incluído para compatibilidade de shape com `matches`.
   */
  groupId: string | null;
}

// ---------------------------------------------------------------------------
// Lookup tables imutáveis (evitam duplicação de literais de string da API)
// ---------------------------------------------------------------------------

/** Mapeamento exato de `fixture.status.short` → `MatchStatus` do domínio. */
const STATUS_MAP: Readonly<Record<string, MatchStatus>> = {
  // Agendados
  NS: "scheduled",
  TBD: "scheduled",
  // Em andamento (9 códigos)
  "1H": "live",
  HT: "live",
  "2H": "live",
  ET: "live",
  BT: "live",
  P: "live",
  LIVE: "live",
  SUSP: "live",
  INT: "live",
  // Finalizados
  FT: "finished",
  AET: "finished",
  PEN: "finished",
  // Adiado
  PST: "postponed",
  // Cancelados/encerrados por decisão
  CANC: "canceled",
  ABD: "canceled",
  WO: "canceled",
  AWD: "canceled",
} as const;

/** Regex para capturar o número de rodada em "Group Stage - N". */
const GROUP_STAGE_REGEX = /^Group Stage - (\d+)$/;

/** Mapeamento de `league.round` exato → `Stage` do domínio (fases sem número). */
const ROUND_LABEL_MAP: Readonly<Record<string, Stage>> = {
  "Round of 16": "oitavas",
  "Quarter-finals": "quartas",
  "Semi-finals": "semifinal",
  "3rd Place Final": "terceiro",
  Final: "final",
} as const;

// ---------------------------------------------------------------------------
// Funções puras de mapeamento
// ---------------------------------------------------------------------------

/**
 * Converte `fixture.status.short` da API-Football para o enum `MatchStatus` do domínio.
 *
 * @param short - Código de status exato da API (ex.: "NS", "1H", "FT").
 * @returns Status no domínio do bolão.
 * @throws {TypeError} Quando o código não está mapeado — indica mudança na API.
 */
export function mapMatchStatus(short: string): MatchStatus {
  const status = STATUS_MAP[short];
  if (status === undefined) {
    throw new TypeError(
      `mapMatchStatus: código de status desconhecido recebido da API-Football: "${short}". ` +
        `Verifique se a API adicionou novos códigos e atualize o mapeamento.`,
    );
  }
  return status;
}

/**
 * Converte `league.round` da API-Football para o shape de rodada do domínio.
 *
 * @param leagueRound - String de rodada da API (ex.: "Group Stage - 2", "Final").
 * @returns ParsedRound com `stage`, `round` e `groupId`.
 * @throws {TypeError} Quando a string não é reconhecida — indica formato novo na API.
 */
export function parseRound(leagueRound: string): ParsedRound {
  // Fase de grupos: "Group Stage - N"
  const groupMatch = GROUP_STAGE_REGEX.exec(leagueRound);
  if (groupMatch !== null) {
    const round = parseInt(groupMatch[1] ?? "", 10);
    if (round < 1) {
      throw new TypeError(
        `parseRound: número de rodada inválido em "${leagueRound}" — deve ser ≥ 1.`,
      );
    }
    return { stage: "grupos", round, groupId: null };
  }

  // Fases de mata-mata (rótulos fixos)
  const stage = ROUND_LABEL_MAP[leagueRound];
  if (stage !== undefined) {
    return { stage, round: null, groupId: null };
  }

  throw new TypeError(
    `parseRound: string de rodada desconhecida recebida da API-Football: "${leagueRound}". ` +
      `Verifique se a API alterou o formato de rounds e atualize o mapeamento.`,
  );
}
