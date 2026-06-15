/**
 * Mapper ESPN event → patch de status/placar (TASK-04).
 *
 * Converte uma `EspnCompetition` JÁ VALIDADA (pós-parse do schema TASK-02) num
 * patch parcial `{ status, homeScore, awayScore }` consumível pelo merge (TASK-06),
 * via o matcher (TASK-05).
 *
 * Regras (validadas empiricamente no spike TASK-00):
 * - Mapeia EXCLUSIVAMENTE por `status.type.state` (`pre`/`in`/`post`). NUNCA
 *   parseia `detail` — é texto livre/localizado, display-only (`"FT"`, `"31'"`,
 *   `"Sun, June 14th at 1:00 PM EDT"`).
 * - Nulidade dos placares espelha o refine do `matchSchema`:
 *   `scheduled` → ambos null; `live`/`finished` → ambos numéricos.
 * - Extrai home/away por `homeAway` (independe da ordem no array).
 *
 * Módulo puro: sem I/O, sem estado, sem `server-only` (testável via vitest).
 */

import { z } from "zod";

import { matchSchema } from "@/schemas/matches";
import { stageSchema } from "@/schemas/shared";
import type { MatchWithId } from "@/types/matches";

import { buildEspnMatchId, isGroupStage } from "./espnMatchId";
import type { EspnCompetition, EspnEvent } from "./espnTypes";
import { resolveTeamByCode } from "./teamRegistry";

/** Patch parcial derivado de um competition ESPN. Status narrow (sem postponed/canceled). */
export interface EspnMatchPatch {
  status: "scheduled" | "live" | "finished";
  homeScore: number | null;
  awayScore: number | null;
}

/** Mapeia o `state` ESPN no status do domínio. Único critério de status. */
export function mapEspnState(
  state: "pre" | "in" | "post",
): "scheduled" | "live" | "finished" {
  switch (state) {
    case "pre":
      return "scheduled";
    case "in":
      return "live";
    case "post":
      return "finished";
  }
}

/** Converte uma competition ESPN validada num patch de status/placar. */
export function mapEspnCompetition(
  competition: EspnCompetition,
): EspnMatchPatch {
  const status = mapEspnState(competition.status.type.state);

  // Pré-jogo: placares ESPN ("0") são ruído; o domínio exige ambos null.
  if (status === "scheduled") {
    return { status, homeScore: null, awayScore: null };
  }

  // live/finished: extrai por homeAway (ordem do array não é confiável).
  const home = competition.competitors.find((c) => c.homeAway === "home");
  const away = competition.competitors.find((c) => c.homeAway === "away");

  return {
    status,
    homeScore: home ? home.score : null,
    awayScore: away ? away.score : null,
  };
}

type Stage = z.infer<typeof stageSchema>;

/**
 * `season.slug` ESPN → stage do domínio (7 valores, confirmados no spike TASK-00).
 * Mata-mata e grupo cobertos. Slug ausente/desconhecido NÃO está aqui → throw.
 */
const STAGE_BY_SLUG: Readonly<Record<string, Stage>> = {
  "group-stage": "grupos",
  "round-of-32": "dezesseis-avos",
  "round-of-16": "oitavas",
  "quarterfinals": "quartas",
  "semifinals": "semifinal",
  "3rd-place-match": "terceiro",
  "final": "final",
};

/** Resolve o stage do domínio a partir do `season.slug`. @throws Error se slug ausente/desconhecido. */
function resolveStage(event: EspnEvent): Stage {
  const slug = event.season?.slug;
  const stage = slug === undefined ? undefined : STAGE_BY_SLUG[slug];
  if (stage === undefined) {
    throw new Error(
      `mapEspnEventToMatch: season.slug desconhecido ou ausente ` +
        `("${String(slug)}"). event.id=${event.id}. Stage indeterminado.`,
    );
  }
  return stage;
}

/** Extrai o groupId ("A".."L") de `altGameNote`; null se ausente/sem match (mata-mata ou defensivo). */
function extractGroupId(altGameNote: string | undefined): string | null {
  const m = altGameNote?.match(/,\s*Group\s+([A-L])\s*$/i);
  return m ? m[1]!.toUpperCase() : null;
}

/** Extrai a venue do domínio (both-or-null) do competition ESPN. */
function extractVenue(
  competition: EspnCompetition,
): { name: string; city: string } | null {
  const name = competition.venue?.fullName?.trim();
  const city = competition.venue?.address?.city?.split(",")[0]?.trim();
  if (!name || !city) {
    return null;
  }
  return { name, city };
}

/** teamId do domínio a partir da abbr ESPN: id resolvido, ou a abbr literal (placeholders de mata-mata). */
function resolveTeamId(abbr: string): string {
  return resolveTeamByCode(abbr)?.id ?? abbr;
}

/**
 * Converte um `EspnEvent` já validado num `MatchWithId` completo (todos os campos
 * do `matchSchema`), distinto do patch parcial de `mapEspnCompetition`.
 *
 * `id` vem de `buildEspnMatchId` (paridade byte-idêntica com openfootball). `stage`
 * do `season.slug`; `groupId` de `altGameNote` (null em mata-mata); `round` SEMPRE
 * null (ESPN não expõe matchday); `venue` both-or-null; status/placar reusam
 * `mapEspnCompetition`. Saída validada por `matchSchema.parse` (falha ruidosa).
 *
 * @param event       evento ESPN pós-parse do `espnEventSchema`.
 * @param knockoutNum número de mata-mata (73–104); obrigatório quando !isGroupStage.
 * @throws Error  stage indeterminado, time desconhecido em grupo, knockoutNum ausente.
 * @throws ZodError  saída viola `matchSchema` (dados ESPN inconsistentes).
 */
export function mapEspnEventToMatch(
  event: EspnEvent,
  knockoutNum?: number,
): MatchWithId {
  const competition = event.competitions[0];
  if (!competition) {
    throw new Error(
      `mapEspnEventToMatch: evento sem competition. event.id=${event.id}.`,
    );
  }

  const home = competition.competitors.find((c) => c.homeAway === "home");
  const away = competition.competitors.find((c) => c.homeAway === "away");
  if (!home || !away) {
    throw new Error(
      `mapEspnEventToMatch: competition sem home/away. event.id=${event.id}.`,
    );
  }

  // id antes do stage: buildEspnMatchId lança em time desconhecido de grupo.
  const id = buildEspnMatchId(event, knockoutNum);
  const stage = resolveStage(event);
  const groupId = isGroupStage(event)
    ? extractGroupId(competition.altGameNote)
    : null;

  const patch = mapEspnCompetition(competition);

  const match = {
    homeTeamId: resolveTeamId(home.team.abbreviation),
    awayTeamId: resolveTeamId(away.team.abbreviation),
    kickoffAt: event.date,
    stage,
    round: null,
    groupId,
    venue: extractVenue(competition),
    status: patch.status,
    homeScore: patch.homeScore,
    awayScore: patch.awayScore,
  };

  // Falha ruidosa: ID silenciosamente errado é pior que throw.
  return { id, ...matchSchema.parse(match) };
}

/**
 * Processa o schedule ESPN inteiro, atribuindo `knockoutNum` sequencial (73, 74, …)
 * aos jogos de mata-mata em ordem de data ASC. Jogos de grupo mapeiam direto.
 * Retorna `[...grupos, ...mata-mata]`. Exceções propagam (sem silêncio).
 */
export function mapEspnEventsToMatches(events: EspnEvent[]): MatchWithId[] {
  const groupEvents = events.filter((e) => isGroupStage(e));
  const knockoutEvents = events
    .filter((e) => !isGroupStage(e))
    .sort((a, b) => a.date.localeCompare(b.date));

  const groupMatches = groupEvents.map((e) => mapEspnEventToMatch(e));
  const knockoutMatches = knockoutEvents.map((e, i) =>
    mapEspnEventToMatch(e, 73 + i),
  );

  return [...groupMatches, ...knockoutMatches];
}
