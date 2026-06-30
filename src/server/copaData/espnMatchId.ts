/**
 * Gerador de matchId ESPN (TASK-02) — núcleo de risco da feature.
 *
 * Produz, a partir de um `EspnEvent` JÁ VALIDADO (pós-parse do schema TASK-01),
 * o `matchId` byte-idêntico ao gerado pelo openfootball (`buildMatchId`):
 *   - Grupo:     "{YYYY-MM-DD}-{slug(home_ofName)}-{slug(away_ofName)}"
 *                A data é LOCAL do estádio (UTC + offset da cidade-sede), não
 *                UTC crua — ver VENUE_UTC_OFFSET. Crucial p/ paridade: ESPN só
 *                expõe instante UTC e jogos noturnos rolam de dia.
 *   - Mata-mata: "m{knockoutNum}" — o número é responsabilidade do caller
 *                (TASK-03 ordena os eventos por data e atribui 73, 74, …).
 *
 * Paridade de IDs é mandatória: divergência de 1 byte quebra
 * `predictions/{matchId}`, `matches/{id}` e rankings. O slug reusa
 * `slugifyTeamName` de `matchId.ts` (fórmula única) e o nome canônico vem de
 * `OF_NAME_BY_CODE` (reverso de `TEAM_REGISTRY`).
 *
 * Invariante crítica: NUNCA retorna um ID silenciosamente incorreto. Em qualquer
 * dúvida (código de time desconhecido em grupo, `knockoutNum` ausente/inválido
 * em mata-mata) lança `Error` — falso-negativo (throw) é sempre preferível a um
 * ID errado que sobrescreve a prediction do usuário.
 *
 * Módulo puro: sem I/O, sem estado, sem `server-only` (testável via vitest).
 */

import type { EspnEvent } from "./espnTypes";
import { slugifyTeamName } from "./matchId";
import { OF_NAME_BY_CODE } from "./teamRegistry";

/**
 * Offset UTC (horas) por cidade-sede da Copa 2026 — verão (jun/jul), com DST
 * EUA/Canadá; México fixo −6. Materializado do spike TASK-00: aplicar este
 * offset ao instante UTC reproduz a data LOCAL do openfootball → 72/72 IDs de
 * grupo byte-idênticos (data UTC crua divergiria em 28/72 jogos noturnos).
 *
 * Chave = `address.city.split(",")[0].trim()` (ESPN usa "Inglewood, California").
 */
const VENUE_UTC_OFFSET: ReadonlyMap<string, number> = new Map([
  ["Mexico City", -6], ["Guadalajara", -6], ["Guadalupe", -6],
  ["Toronto", -4], ["East Rutherford", -4], ["Foxborough", -4],
  ["Philadelphia", -4], ["Atlanta", -4], ["Miami Gardens", -4],
  ["Inglewood", -7], ["Santa Clara", -7], ["Vancouver", -7], ["Seattle", -7],
  ["Houston", -5], ["Arlington", -5], ["Kansas City", -5],
]);

/** `season.type` da fase de grupos (spike TASK-00). Fallback de `slug`. */
const GROUP_STAGE_SEASON_TYPE = 13802;

/**
 * Fase de grupos? Detecta via `event.season.slug === "group-stage"` ou, como
 * fallback, `season.type === 13802` (ambos confirmados no spike TASK-00).
 * `season`/`slug`/`type` ausentes → tratado como mata-mata (defensivo).
 */
export function isGroupStage(event: EspnEvent): boolean {
  return (
    event.season?.slug === "group-stage" ||
    event.season?.type === GROUP_STAGE_SEASON_TYPE
  );
}

/**
 * Converte o instante UTC de `event.date` (ISO 8601 com `Z`) na data LOCAL
 * (`YYYY-MM-DD`) do estádio, aplicando o offset da cidade-sede. Aritmética em
 * epoch (determinística, sem dependência do TZ do runtime).
 *
 * @throws Error se `event.date` mal-formado.
 */
function localMatchDate(isoUtc: string, offsetHours: number): string {
  const m = isoUtc.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) {
    throw new Error(`localMatchDate: event.date mal-formado ("${isoUtc}").`);
  }
  const [, y, mo, d, h, mi] = m;
  const utcMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  const local = new Date(utcMs + offsetHours * 3_600_000);
  const yyyy = local.getUTCFullYear();
  const mm = String(local.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(local.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Gera o matchId a partir de um EspnEvent validado.
 *
 * @param event       evento ESPN já parseado pelo schema.
 * @param knockoutNum número da partida de mata-mata (73–104); obrigatório e
 *                    finito quando o evento NÃO é de grupo.
 * @throws Error em grupo, se algum competitor faltar ou o código de time não
 *         existir em `OF_NAME_BY_CODE`.
 * @throws Error em mata-mata, se `knockoutNum` ausente ou não-finito.
 */
export function buildEspnMatchId(
  event: EspnEvent,
  knockoutNum?: number,
): string {
  if (!isGroupStage(event)) {
    if (knockoutNum === undefined || !Number.isFinite(knockoutNum)) {
      throw new Error(
        `buildEspnMatchId: evento de mata-mata exige knockoutNum finito ` +
          `(recebido: ${String(knockoutNum)}). event.id=${event.id}.`,
      );
    }
    return `m${knockoutNum}`;
  }

  const competition = event.competitions[0];
  if (!competition) {
    throw new Error(`buildEspnMatchId: evento sem competition. event.id=${event.id}.`);
  }

  const home = competition.competitors.find((c) => c.homeAway === "home");
  const away = competition.competitors.find((c) => c.homeAway === "away");
  if (!home || !away) {
    throw new Error(
      `buildEspnMatchId: competition sem home/away. event.id=${event.id}.`,
    );
  }

  const homeName = OF_NAME_BY_CODE.get(home.team.abbreviation);
  const awayName = OF_NAME_BY_CODE.get(away.team.abbreviation);
  if (homeName === undefined || awayName === undefined) {
    throw new Error(
      `buildEspnMatchId: código de time desconhecido em jogo de grupo ` +
        `(home="${home.team.abbreviation}", away="${away.team.abbreviation}"). ` +
        `event.id=${event.id}. Adicionar alias em ESPN_ALIASES ou entrada em TEAM_REGISTRY.`,
    );
  }

  // Data LOCAL do estádio (não UTC): openfootball usa data local. Ver
  // VENUE_UTC_OFFSET — sem isso, jogos noturnos rolariam para o dia seguinte.
  const rawCity = competition.venue?.address?.city;
  const city = rawCity?.split(",")[0]?.trim();
  if (!city) {
    throw new Error(
      `buildEspnMatchId: jogo de grupo sem venue.address.city. ` +
        `event.id=${event.id}. Necessário para derivar a data local.`,
    );
  }
  const offset = VENUE_UTC_OFFSET.get(city);
  if (offset === undefined) {
    throw new Error(
      `buildEspnMatchId: cidade-sede sem offset mapeado ("${city}"). ` +
        `event.id=${event.id}. Adicionar entrada em VENUE_UTC_OFFSET.`,
    );
  }

  const date = localMatchDate(event.date, offset);
  return `${date}-${slugifyTeamName(homeName)}-${slugifyTeamName(awayName)}`;
}
