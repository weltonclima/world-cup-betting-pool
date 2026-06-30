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
import type { EspnCompetition, EspnCompetitor, EspnEvent } from "./espnTypes";
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

/**
 * Slot da chave derivado de um `displayName` placeholder ESPN (TASK-02).
 * `round` = slug ESPN da fase-fonte; `game` = nº do jogo-fonte; `label` = rótulo
 * pt-BR exibível.
 */
export interface BracketSlot {
  round: string;
  game: number;
  label: string;
}

/** Config de parsing por fase-fonte: regex do `displayName` + slug + prefixo do rótulo. */
const BRACKET_SLOT_PATTERNS: ReadonlyArray<{
  re: RegExp;
  round: string;
  /** Prefixo do rótulo ("R32", "QF", …). */
  prefix: string;
}> = [
  { re: /^Round of 32 (\d+) (Winner|Loser)$/i, round: "round-of-32", prefix: "R32" },
  { re: /^Round of 16 (\d+) (Winner|Loser)$/i, round: "round-of-16", prefix: "R16" },
  { re: /^Quarterfinal (\d+) (Winner|Loser)$/i, round: "quarterfinals", prefix: "QF" },
  { re: /^Semifinal (\d+) (Winner|Loser)$/i, round: "semifinals", prefix: "SF" },
];

/**
 * Converte o `displayName` de um time-placeholder ESPN ("Round of 32 3 Winner")
 * no slot da chave + rótulo pt-BR. Retorna `null` para qualquer string que não
 * descreva um slot (time real, fase de grupos, vazio) OU jogo-fonte inválido
 * (`game < 1`) — degrada sem lançar. Rótulo uniforme "jogo N" em todas as fases.
 * Pura — sem I/O.
 */
export function parseBracketSlot(displayName: string): BracketSlot | null {
  for (const p of BRACKET_SLOT_PATTERNS) {
    const m = displayName.match(p.re);
    if (!m) {
      continue;
    }
    const game = Number(m[1]);
    if (game < 1) {
      // Jogo-fonte 0 não existe (numeração FIFA é 1-based); degrada p/ null em
      // vez de produzir um slot inválido que abortaria o parse do schema.
      return null;
    }
    const outcome = m[2]!.toLowerCase() === "loser" ? "Perdedor" : "Vencedor";
    return { round: p.round, game, label: `${outcome} ${p.prefix} jogo ${game}` };
  }
  return null;
}

/**
 * Deriva o desfecho de um jogo de mata-mata a partir de `status.type.name` ESPN.
 * Só faz sentido em jogo finalizado (`state === "post"`) — antes disso retorna
 * `undefined`. `STATUS_FINAL_PEN` → pênaltis; `STATUS_OVERTIME` → prorrogação;
 * qualquer outro nome (ou ausente) em jogo finalizado → tempo normal. Pura.
 */
export function mapOutcome(
  statusTypeName: string | undefined,
  state: "pre" | "in" | "post",
): "normal" | "overtime" | "penalties" | undefined {
  if (state !== "post") {
    return undefined;
  }
  switch (statusTypeName) {
    case "STATUS_FINAL_PEN":
      return "penalties";
    case "STATUS_OVERTIME":
      return "overtime";
    default:
      return "normal";
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
 * Slot/label de um lado, quando placeholder. A evidência autoritativa é o
 * `displayName` casar um padrão de slot — times reais carregam nome de país, que
 * jamais casa as regexes ancoradas. `isActive` é OPCIONAL na ESPN (pode faltar
 * num placeholder), então NÃO se gateia por ele: gatear perderia o slot/label
 * sempre que a flag estivesse ausente. Resolvido → `parseBracketSlot` retorna null.
 */
function sideSlot(
  competitor: EspnCompetitor,
): { slot: { round: string; game: number }; label: string } | null {
  const parsed = parseBracketSlot(competitor.team.displayName ?? "");
  if (!parsed) {
    return null;
  }
  return { slot: { round: parsed.round, game: parsed.game }, label: parsed.label };
}

/**
 * Campos de enriquecimento de MATA-MATA (TASK-02) — slot/label por-lado,
 * lado que avançou, desfecho e pênaltis. Só chamado para jogos de mata-mata;
 * fase de grupos não recebe nenhum destes campos. Pênaltis ficam em campos
 * próprios, SEPARADOS de homeScore/awayScore (invariante validada no refine).
 */
function buildKnockoutFields(
  state: "pre" | "in" | "post",
  statusName: string | undefined,
  home: EspnCompetitor,
  away: EspnCompetitor,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  const homeSide = sideSlot(home);
  if (homeSide) {
    fields.homeBracketSlot = homeSide.slot;
    fields.homePlaceholderLabel = homeSide.label;
  }
  const awaySide = sideSlot(away);
  if (awaySide) {
    fields.awayBracketSlot = awaySide.slot;
    fields.awayPlaceholderLabel = awaySide.label;
  }

  // Lado que avançou (autoritativo ESPN); null quando ninguém avançou ainda.
  fields.advanceSide =
    home.advance === true ? "home" : away.advance === true ? "away" : null;

  const outcome = mapOutcome(statusName, state);
  if (outcome !== undefined) {
    fields.outcome = outcome;
  }

  // Pênaltis só quando o jogo foi decidido nos pênaltis. shootoutScore ausente
  // aqui dispara o refine de pênaltis (falha ruidosa, ID/dado errado é pior).
  if (outcome === "penalties") {
    fields.homeShootout = home.shootoutScore ?? null;
    fields.awayShootout = away.shootoutScore ?? null;
  }

  return fields;
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
    // Enriquecimento de mata-mata (TASK-02). Fase de grupos não recebe nenhum
    // destes campos (ficam ausentes). Slot/label são por-lado; pênaltis só
    // quando decididos nos pênaltis, sempre SEPARADOS do placar de tempo normal.
    ...(isGroupStage(event)
      ? {}
      : buildKnockoutFields(competition.status.type.state, competition.status.type.name, home, away)),
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
