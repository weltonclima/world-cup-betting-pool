/**
 * Matcher ESPN event ↔ matchId openfootball (TASK-05).
 *
 * Casa cada `EspnEvent` (scoreboard ESPN já validado, TASK-02) ao `matchId`
 * openfootball correto, produzindo `Map<matchId, EspnMatchPatch>` para o merge
 * (TASK-06). Estratégia FIXA:
 *   1. resolver `abbreviation` ESPN → team id via `resolveTeamByCode` (TASK-01);
 *   2. casar contra a base por par (homeTeamId, awayTeamId) + janela UTC ±1 dia;
 *   3. derivar o patch via `mapEspnCompetition` (TASK-04).
 *
 * Invariante crítica: matching errado NUNCA escreve em jogo errado. Em qualquer
 * dúvida (time não resolvido, match ausente) retorna `null` — falso-negativo é
 * sempre preferível a falso-positivo. O `matchId` é SEMPRE `m.id` da base,
 * jamais reconstruído a partir de strings.
 *
 * Módulo puro: sem I/O, sem estado, sem `server-only` (testável via vitest).
 */

import type { EspnEvent } from "./espnTypes";
import { mapEspnCompetition, type EspnMatchPatch } from "./espnMapper";
import { resolveTeamByCode } from "./teamRegistry";
import type { MatchWithId } from "@/types/matches";

const ONE_DAY_MS = 86_400_000;

/**
 * Meia-noite UTC (ms) do dia de uma string ISO 8601. Retorna `NaN` para
 * datas inválidas — o caller (`withinDateWindow`) trata o `NaN` explicitamente.
 */
function utcDayMs(isoStr: string): number {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return NaN;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Datas UTC dentro de ±1 dia (inclusivo)? */
function withinDateWindow(eventIso: string, kickoffIso: string): boolean {
  const a = utcDayMs(eventIso);
  const b = utcDayMs(kickoffIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return Math.abs(a - b) <= ONE_DAY_MS;
}

/**
 * Casa um evento ESPN a uma partida da base.
 * Retorna `{ matchId, patch }` ou `null` (time não resolvível, ou nenhuma
 * partida na base satisfaz par + janela de data).
 */
export function matchEspnEvent(
  event: EspnEvent,
  base: MatchWithId[],
): { matchId: string; patch: EspnMatchPatch } | null {
  const competition = event.competitions[0];
  if (!competition) return null;

  const homeCompetitor = competition.competitors.find((c) => c.homeAway === "home");
  const awayCompetitor = competition.competitors.find((c) => c.homeAway === "away");
  if (!homeCompetitor || !awayCompetitor) return null;

  const homeTeam = resolveTeamByCode(homeCompetitor.team.abbreviation);
  const awayTeam = resolveTeamByCode(awayCompetitor.team.abbreviation);
  if (!homeTeam || !awayTeam) return null;

  // Par exato (não simétrico) + janela de data UTC ±1 dia.
  // Coletamos TODOS os candidatos: a unicidade do par por janela é uma
  // propriedade dos dados (mesmas seleções podem se reencontrar no mata-mata),
  // não uma garantia. Ambiguidade (≠ 1 candidato) → null. Isso torna o
  // falso-positivo impossível por construção, não por suposição (R5).
  const candidates = base.filter(
    (m) =>
      m.homeTeamId === homeTeam.id &&
      m.awayTeamId === awayTeam.id &&
      withinDateWindow(event.date, m.kickoffAt),
  );
  if (candidates.length !== 1) return null;

  return { matchId: candidates[0]!.id, patch: mapEspnCompetition(competition) };
}

/**
 * Constrói o mapa `matchId → patch` a partir de todos os eventos ESPN.
 * Eventos não casáveis são ignorados (não entram no mapa).
 */
export function buildEspnPatchMap(
  events: EspnEvent[],
  base: MatchWithId[],
): Map<string, EspnMatchPatch> {
  const map = new Map<string, EspnMatchPatch>();
  for (const event of events) {
    const result = matchEspnEvent(event, base);
    if (result) map.set(result.matchId, result.patch);
  }
  return map;
}
