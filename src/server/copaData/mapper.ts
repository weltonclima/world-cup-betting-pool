/**
 * Mapper: openfootball match → matchSchema (MatchWithId).
 *
 * Converte o shape do JSON openfootball para o formato exigido por `matchSchema`.
 */

import { matchSchema } from "@/schemas/matches";
import type { OpenFootballMatch, OpenFootballScore } from "./types";
import { resolveTeam } from "./teamRegistry";
import type { MatchWithId } from "@/types/matches";

export type Stage =
  | "grupos"
  | "dezesseis-avos"
  | "oitavas"
  | "quartas"
  | "semifinal"
  | "terceiro"
  | "final";

export type MatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "canceled";

// ─── Mapeamento round → stage ────────────────────────────────────────────────

const ROUND_TO_STAGE: Record<string, Stage> = {
  "Round of 32": "dezesseis-avos",
  "Round of 16": "oitavas",
  "Quarter-final": "quartas",
  "Semi-final": "semifinal",
  "Match for third place": "terceiro",
  "Final": "final",
};

/**
 * Converte `round` do openfootball para `Stage`.
 * Rounds de grupo ("Matchday 1"…"Matchday N") detectados pelo prefixo "Matchday".
 */
export function mapRoundToStage(round: string): Stage {
  if (round.startsWith("Matchday")) return "grupos";
  const stage = ROUND_TO_STAGE[round];
  if (stage !== undefined) return stage;
  throw new Error(
    `Round não reconhecido no openfootball: "${round}". ` +
    `Adicionar mapeamento em ROUND_TO_STAGE em mapper.ts.`,
  );
}

// ─── Parsing de horário ──────────────────────────────────────────────────────

/**
 * Combina `date` ("YYYY-MM-DD") e `time` ("HH:MM UTC±H") em ISO 8601 com offset.
 * Saída: "2026-06-11T13:00:00-06:00"
 *
 * Regras:
 * - Offset "UTC-6" → "-06:00"; "UTC+0" → "+00:00"; "UTC+1" → "+01:00"
 * - Offset com hora única (UTC-6) é expandido para dois dígitos (-06:00)
 * - Se `time` for ausente: usa "T00:00:00+00:00" (TBD — degrada graciosamente)
 * - Lança erro se o formato for irreconhecível
 */
export function parseKickoffAt(date: string, time: string | undefined): string {
  if (!time) return `${date}T00:00:00+00:00`;

  // Regex: "HH:MM UTC[+-]H" ou "HH:MM UTC[+-]HH"
  const match = time.match(/^(\d{2}):(\d{2})\s+UTC([+-])(\d{1,2})$/);
  if (!match) {
    throw new Error(`Formato de horário inválido: "${time}"`);
  }
  const [, hh, mm, sign, offsetHours] = match as [string, string, string, string, string];
  const paddedOffset = offsetHours.padStart(2, "0");
  return `${date}T${hh}:${mm}:00${sign}${paddedOffset}:00`;
}

// ─── buildMatchId ────────────────────────────────────────────────────────────

/**
 * Gera o matchId estável para uma partida openfootball.
 *
 * Mata-mata (com `num`): "m{num}" — ex.: "m73", "m104".
 * Grupo (sem `num`):  slug determinístico "{date}-{slug(team1)}-{slug(team2)}"
 *   onde slug = lowercase + replace(/[^a-z0-9]/g, "-").
 */
export function buildMatchId(match: OpenFootballMatch): string {
  if (match.num !== undefined) {
    return `m${match.num}`;
  }
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  return `${match.date}-${slugify(match.team1)}-${slugify(match.team2)}`;
}

// ─── resolveTeamId ───────────────────────────────────────────────────────────

/**
 * Dado um valor team1/team2 do openfootball:
 * - Se for nome real: resolver via registry → retornar id (= code).
 * - Se for placeholder ("2A", "1E", "W74", "L101", "3A/B/C/D/F"): retornar o placeholder literal.
 *
 * @throws Error se o nome não for um placeholder E não estiver no registry.
 */
export function resolveTeamId(name: string): string {
  // Padrão de placeholder do openfootball:
  //  - grupo: "1A".."1L" / "2A".."2L"
  //  - melhor terceiro: "3A/B/C/D/F" (grupos candidatos separados por "/")
  //  - vencedor/perdedor de jogo: "W74" / "L101"
  const isPlaceholder = /^(\d[A-Z]+(\/[A-Z]+)*|[WL]\d+)$/.test(name);
  if (isPlaceholder) return name;

  const entry = resolveTeam(name);
  if (entry === undefined) {
    throw new Error(
      `Time "${name}" não encontrado no teamRegistry. ` +
      `Adicionar entrada em teamRegistry.ts.`,
    );
  }
  return entry.id;
}

// ─── mapStatus ───────────────────────────────────────────────────────────────

/**
 * status:
 *   - score.ft AUSENTE → "scheduled"
 *   - score.ft PRESENTE → "finished"
 *   (openfootball não tem status live — quando score.ft aparece, o jogo acabou)
 */
export function mapStatus(score: OpenFootballScore | undefined): MatchStatus {
  return score?.ft !== undefined ? "finished" : "scheduled";
}

// ─── mapOpenFootballMatch ────────────────────────────────────────────────────

/**
 * Converte um OpenFootballMatch no shape do documento `matches/{id}`.
 * Valida a saída com matchSchema.parse() — lança ZodError se inválido.
 *
 * Nota sobre venue: openfootball tem apenas `ground` (ex.: "Mexico City",
 * "Los Angeles (Inglewood)"). venueSchema exige name e city.
 * city = parte antes do "(" (trimada); name = ground completo.
 * Ex.: "Los Angeles (Inglewood)" → city="Los Angeles", name="Los Angeles (Inglewood)".
 */
export function mapOpenFootballMatch(raw: OpenFootballMatch): MatchWithId {
  const stage = mapRoundToStage(raw.round);

  // groupId: letra do grupo ("Group A" → "A"); null fora de fase de grupos
  const groupId =
    stage === "grupos" && raw.group
      ? raw.group.replace(/^Group\s+/i, "").trim() || null
      : null;

  // round number: extrair dígito de "Matchday N"; null em mata-mata
  const round: number | null =
    stage === "grupos"
      ? (Number.parseInt(raw.round.replace("Matchday ", ""), 10) || null)
      : null;

  const homeTeamId = resolveTeamId(raw.team1);
  const awayTeamId = resolveTeamId(raw.team2);
  const kickoffAt = parseKickoffAt(raw.date, raw.time);
  const status = mapStatus(raw.score);
  const id = buildMatchId(raw);

  // venue: extrair city da parte antes do parêntese (OQ-4)
  const venue = raw.ground
    ? {
        name: raw.ground,
        city: raw.ground.split("(")[0]!.trim() || raw.ground,
      }
    : null;

  // Placares: só quando finished
  const isFinished = status === "finished";
  const homeScore = isFinished ? (raw.score?.ft?.[0] ?? null) : null;
  const awayScore = isFinished ? (raw.score?.ft?.[1] ?? null) : null;

  const doc = {
    homeTeamId,
    awayTeamId,
    kickoffAt,
    stage,
    ...(round !== null ? { round } : {}),
    groupId,
    venue,
    status,
    homeScore,
    awayScore,
  };

  const mapped = matchSchema.parse(doc);
  return { id, ...mapped };
}
