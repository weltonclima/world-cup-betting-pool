/**
 * TASK-05 — mapper de LIGA (`mapEspnEventsToLeagueMatches`).
 *
 * Liga = pontos corridos, sem grupos/mata-mata. Divergências vs mapper Copa:
 *  - team ids vêm do id ESPN (clubes NÃO estão no TEAM_REGISTRY) — sem resolveTeamId;
 *  - stage = "liga"; round = matchday (`week.number`) ou null;
 *  - id = `{championshipId}:{event.id}` (matchBaseId, path novo);
 *  - championshipId injetado;
 *  - SEM campos de mata-mata (bracket/pênaltis/outcome).
 */

import { describe, expect, it } from "vitest";

import { getChampionship } from "../championshipCatalog";
import { extractLeagueTeamDisplay, mapEspnEventsToLeagueMatches } from "../espnMapper";
import { parseEspnScoreboard } from "../espnTypes";

const bra = getChampionship("bra.1-2026")!;

/** Scoreboard cru de liga (clubes) — 2 jogos, com team.id e week (matchday). */
function leagueScoreboard() {
  return {
    events: [
      {
        id: "701001",
        date: "2026-05-10T20:00:00Z",
        season: { year: 2026, type: 1, slug: "regular-season" },
        week: { number: 5 },
        competitions: [
          {
            status: { type: { state: "post", detail: "FT", name: "STATUS_FULL_TIME" } },
            competitors: [
              { homeAway: "home", score: "2", team: { id: "83", abbreviation: "FLA" } },
              { homeAway: "away", score: "1", team: { id: "133", abbreviation: "PAL" } },
            ],
          },
        ],
      },
      {
        id: "701002",
        date: "2026-05-11T20:00:00Z",
        season: { year: 2026, type: 1, slug: "regular-season" },
        // sem week → round null
        competitions: [
          {
            status: { type: { state: "pre", detail: "Scheduled" } },
            competitors: [
              { homeAway: "home", score: "0", team: { id: "134", abbreviation: "SAO" } },
              { homeAway: "away", score: "0", team: { id: "135", abbreviation: "COR" } },
            ],
          },
        ],
      },
    ],
  };
}

function mappedLeague() {
  const parsed = parseEspnScoreboard(leagueScoreboard());
  if (!parsed.success) throw new Error("fixture de liga inválida");
  return mapEspnEventsToLeagueMatches(parsed.data.events, bra);
}

describe("mapEspnEventsToLeagueMatches (TASK-05)", () => {
  it("mapeia todos os eventos da liga", () => {
    expect(mappedLeague()).toHaveLength(2);
  });

  it("injeta championshipId do campeonato", () => {
    for (const m of mappedLeague()) {
      expect(m.championshipId).toBe("bra.1-2026");
    }
  });

  it("stage é sempre 'liga' (sem grupos/mata-mata)", () => {
    for (const m of mappedLeague()) {
      expect(m.stage).toBe("liga");
    }
  });

  it("id = {championshipId}:{event.id} (namespaced, path novo)", () => {
    const ids = mappedLeague().map((m) => m.id);
    expect(ids).toContain("bra.1-2026:701001");
    expect(ids).toContain("bra.1-2026:701002");
  });

  it("team ids vêm do id ESPN do clube (não do registry de seleções)", () => {
    const m = mappedLeague().find((x) => x.id === "bra.1-2026:701001")!;
    expect(m.homeTeamId).toBe("83");
    expect(m.awayTeamId).toBe("133");
  });

  it("round = matchday (week.number) quando presente, senão null", () => {
    const withWeek = mappedLeague().find((x) => x.id === "bra.1-2026:701001")!;
    const noWeek = mappedLeague().find((x) => x.id === "bra.1-2026:701002")!;
    expect(withWeek.round).toBe(5);
    expect(noWeek.round).toBeNull();
  });

  it("placar e status mapeados (finished 2-1)", () => {
    const m = mappedLeague().find((x) => x.id === "bra.1-2026:701001")!;
    expect(m.status).toBe("finished");
    expect(m.homeScore).toBe(2);
    expect(m.awayScore).toBe(1);
  });

  it("NÃO emite campos de mata-mata (bracket/pênaltis/outcome)", () => {
    const m = mappedLeague().find((x) => x.id === "bra.1-2026:701001")!;
    expect(m.homeShootout ?? null).toBeNull();
    expect(m.homeBracketSlot).toBeUndefined();
    expect(m.awayBracketSlot).toBeUndefined();
    expect(m.outcome).toBeUndefined();
  });

  it("team.id vazio ('') cai para a abbreviation (WR-02: || não ??)", () => {
    const sb = {
      events: [
        {
          id: "701003",
          date: "2026-05-12T20:00:00Z",
          competitions: [
            {
              status: { type: { state: "pre", detail: "Scheduled" } },
              competitors: [
                { homeAway: "home", score: "0", team: { id: "", abbreviation: "GRE" } },
                { homeAway: "away", score: "0", team: { id: "42", abbreviation: "BOT" } },
              ],
            },
          ],
        },
      ],
    };
    const parsed = parseEspnScoreboard(sb);
    if (!parsed.success) throw new Error("fixture inválida");
    const [m] = mapEspnEventsToLeagueMatches(parsed.data.events, bra);
    expect(m!.homeTeamId).toBe("GRE"); // "" caiu para abbreviation, não quebrou nonEmptyString
    expect(m!.awayTeamId).toBe("42");
  });
});

// ─── extractLeagueTeamDisplay (TASK-20) ─────────────────────────────────────────
// Mapa de display de clubes (id -> {name, crestUrl}) para a tabela de liga.
// Chave DEVE casar com a do mapEspnEventToLeagueMatch (team.id || abbreviation)
// para as linhas de display baterem com as linhas da tabela.

/** Scoreboard de liga com displayName + logo nos competidores. */
function displayScoreboard() {
  return {
    events: [
      {
        id: "701001",
        date: "2026-05-10T20:00:00Z",
        competitions: [
          {
            status: { type: { state: "post", detail: "FT", name: "STATUS_FULL_TIME" } },
            competitors: [
              {
                homeAway: "home",
                score: "2",
                team: {
                  id: "83",
                  abbreviation: "FLA",
                  displayName: "Flamengo",
                  logo: "https://espn/fla.png",
                },
              },
              {
                homeAway: "away",
                score: "1",
                // sem logo → sem crestUrl; sem displayName → fallback para id
                team: { id: "133", abbreviation: "PAL" },
              },
            ],
          },
        ],
      },
    ],
  };
}

function displayMap() {
  const parsed = parseEspnScoreboard(displayScoreboard());
  if (!parsed.success) throw new Error("fixture de display inválida");
  return extractLeagueTeamDisplay(parsed.data.events);
}

describe("extractLeagueTeamDisplay (TASK-20)", () => {
  it("extrai name=displayName e crestUrl=logo quando presentes", () => {
    const entry = displayMap().get("83");
    expect(entry).toEqual({ name: "Flamengo", crestUrl: "https://espn/fla.png" });
  });

  it("logo ausente → entry sem crestUrl", () => {
    const entry = displayMap().get("133");
    expect(entry).toBeDefined();
    expect(entry).not.toHaveProperty("crestUrl");
  });

  it("displayName ausente → name cai para o teamId (fallback, nunca vazio)", () => {
    // "133" não tem displayName na fixture → name = "133"
    expect(displayMap().get("133")).toMatchObject({ name: "133" });
  });

  it("usa a MESMA chave que o mapper de match (team.id || abbreviation)", () => {
    const sb = {
      events: [
        {
          id: "701004",
          date: "2026-05-13T20:00:00Z",
          competitions: [
            {
              status: { type: { state: "pre", detail: "Scheduled" } },
              competitors: [
                {
                  homeAway: "home",
                  score: "0",
                  team: { id: "", abbreviation: "GRE", displayName: "Grêmio" },
                },
                {
                  homeAway: "away",
                  score: "0",
                  team: { id: "42", abbreviation: "BOT", displayName: "Botafogo" },
                },
              ],
            },
          ],
        },
      ],
    };
    const parsed = parseEspnScoreboard(sb);
    if (!parsed.success) throw new Error("fixture inválida");
    const display = extractLeagueTeamDisplay(parsed.data.events);
    // id "" → chave = abbreviation "GRE", casando com homeTeamId do match
    expect(display.get("GRE")).toMatchObject({ name: "Grêmio" });
    expect(display.get("42")).toMatchObject({ name: "Botafogo" });
  });

  it("é robusta a lista de eventos vazia", () => {
    expect(extractLeagueTeamDisplay([]).size).toBe(0);
  });

  // H-1 (review TASK-20): logo inválido NÃO pode virar crestUrl — o schema de
  // resposta valida `z.url()` com `.parse()` throwing na rota; um logo "" ou
  // relativo derrubaria a tabela inteira. Sanitizar na extração (drop → fallback).
  it("logo string vazia ('') → sem crestUrl (não quebra z.url na rota)", () => {
    const sb = {
      events: [
        {
          id: "701005",
          date: "2026-05-14T20:00:00Z",
          competitions: [
            {
              status: { type: { state: "pre", detail: "Scheduled" } },
              competitors: [
                {
                  homeAway: "home",
                  score: "0",
                  team: { id: "90", abbreviation: "INT", displayName: "Internacional", logo: "" },
                },
                {
                  homeAway: "away",
                  score: "0",
                  team: { id: "91", abbreviation: "GRE", displayName: "Grêmio", logo: "logo.png" },
                },
              ],
            },
          ],
        },
      ],
    };
    const parsed = parseEspnScoreboard(sb);
    if (!parsed.success) throw new Error("fixture inválida");
    const display = extractLeagueTeamDisplay(parsed.data.events);
    // logo "" → drop
    expect(display.get("90")).not.toHaveProperty("crestUrl");
    // logo relativo (não é URL absoluta) → drop
    expect(display.get("91")).not.toHaveProperty("crestUrl");
    // nomes preservados
    expect(display.get("90")).toMatchObject({ name: "Internacional" });
    expect(display.get("91")).toMatchObject({ name: "Grêmio" });
  });

  it("logo http(s) absoluto é preservado como crestUrl", () => {
    const sb = {
      events: [
        {
          id: "701006",
          date: "2026-05-15T20:00:00Z",
          competitions: [
            {
              status: { type: { state: "pre", detail: "Scheduled" } },
              competitors: [
                {
                  homeAway: "home",
                  score: "0",
                  team: { id: "92", abbreviation: "CAM", logo: "https://espn/cam.png" },
                },
                {
                  homeAway: "away",
                  score: "0",
                  team: { id: "93", abbreviation: "CRU", logo: "http://espn/cru.png" },
                },
              ],
            },
          ],
        },
      ],
    };
    const parsed = parseEspnScoreboard(sb);
    if (!parsed.success) throw new Error("fixture inválida");
    const display = extractLeagueTeamDisplay(parsed.data.events);
    expect(display.get("92")).toMatchObject({ crestUrl: "https://espn/cam.png" });
    expect(display.get("93")).toMatchObject({ crestUrl: "http://espn/cru.png" });
  });
});
