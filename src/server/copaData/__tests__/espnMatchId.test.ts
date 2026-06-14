/**
 * Testes do gerador de matchId ESPN (TASK-02).
 * TG-* (grupos), TK-* (mata-mata), TP-* (paridade com openfootball).
 *
 * Núcleo de risco da feature: o matchId gerado a partir de dados ESPN DEVE ser
 * byte-idêntico ao do openfootball (`buildMatchId`) — qualquer divergência
 * quebra `predictions/{matchId}`, `matches/{id}`, rankings.
 *
 * Os eventos ESPN são parseados via `espnScoreboardSchema` antes de chegar ao
 * gerador (espelha o fluxo real client → schema → matchId).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { espnEventSchema, type EspnEvent } from "../espnTypes";
import { buildEspnMatchId, isGroupStage } from "../espnMatchId";
import { OF_NAME_BY_CODE, TEAM_REGISTRY } from "../teamRegistry";
import { buildMatchId } from "../mapper";

const FIXTURES_DIR = join(__dirname, "..", "__fixtures__");

/** Carrega e valida um fixture de evento ESPN cru. */
function loadEvent(file: string): EspnEvent {
  const raw = JSON.parse(readFileSync(join(FIXTURES_DIR, file), "utf-8"));
  return espnEventSchema.parse(raw);
}

/**
 * Constrói um EspnEvent de grupo validado a partir de abreviações/data.
 * `seasonSlug` default "group-stage"; competitors mínimos.
 * `date` é o instante UTC ESPN (ISO com Z). `city` é a cidade-sede (define o
 * offset → data LOCAL do matchId); default "Mexico City" (−6). `omitVenue`
 * suprime a venue (para testar erro de venue ausente).
 */
function groupEvent(opts: {
  date: string;
  homeAbbr: string;
  awayAbbr: string;
  seasonSlug?: string | undefined;
  city?: string;
  omitVenue?: boolean;
}): EspnEvent {
  // Chave "seasonSlug" ausente → assume grupo (caso comum TG/TP). Passar
  // seasonSlug: undefined explícito (TK-03) suprime o season → vira mata-mata.
  const slug = "seasonSlug" in opts ? opts.seasonSlug : "group-stage";
  const city = opts.city ?? "Mexico City";
  const raw = {
    id: "1",
    date: opts.date,
    ...(slug !== undefined ? { season: { slug } } : {}),
    competitions: [
      {
        status: { type: { state: "pre", detail: "Scheduled" } },
        ...(opts.omitVenue ? {} : { venue: { address: { city } } }),
        competitors: [
          { homeAway: "home", score: "0", team: { abbreviation: opts.homeAbbr } },
          { homeAway: "away", score: "0", team: { abbreviation: opts.awayAbbr } },
        ],
      },
    ],
  };
  return espnEventSchema.parse(raw);
}

/** Variante com competitors customizados (para casos de erro). */
function customEvent(competitors: unknown[], seasonSlug = "group-stage"): EspnEvent {
  // bypass: o schema exige .length(2); para testar "sem home" montamos 2
  // competitors mas ambos away, ou 2 com abbreviation desconhecida.
  const raw = {
    id: "1",
    date: "2026-06-11T19:00Z",
    season: { slug: seasonSlug },
    competitions: [
      {
        status: { type: { state: "pre", detail: "Scheduled" } },
        competitors,
      },
    ],
  };
  return espnEventSchema.parse(raw);
}

// ─── TG-* — grupos: IDs corretos ────────────────────────────────────────────

describe("buildEspnMatchId — fase de grupos", () => {
  it("TG-01: MEX vs RSA (fixture real) → 2026-06-11-mexico-south-africa", () => {
    const event = loadEvent("espn-event-group.json");
    expect(buildEspnMatchId(event)).toBe("2026-06-11-mexico-south-africa");
  });

  it("TG-02: BRA vs MAR → 2026-06-13-brazil-morocco", () => {
    const event = groupEvent({
      date: "2026-06-13T22:00Z",
      homeAbbr: "BRA",
      awayAbbr: "MAR",
    });
    expect(buildEspnMatchId(event)).toBe("2026-06-13-brazil-morocco");
  });

  it("TG-03: time com caractere especial (Curaçao, CUW) → slug 'cura-ao'", () => {
    const event = groupEvent({
      date: "2026-06-20T19:00Z",
      homeAbbr: "CUW",
      awayAbbr: "GER",
    });
    expect(buildEspnMatchId(event)).toBe("2026-06-20-cura-ao-germany");
  });

  it("TG-04: time com '&' (Bosnia & Herzegovina, BIH) → 'bosnia-herzegovina'", () => {
    const event = groupEvent({
      date: "2026-06-15T19:00Z",
      homeAbbr: "BIH",
      awayAbbr: "CAN",
    });
    expect(buildEspnMatchId(event)).toBe("2026-06-15-bosnia-herzegovina-canada");
  });

  it("TG-05: OF_NAME_BY_CODE cobre todos os times do registry (48)", () => {
    const expectedSize = Object.keys(TEAM_REGISTRY).length;
    expect(OF_NAME_BY_CODE.size).toBe(expectedSize);
    // Cada code do registry resolve para o nome-chave original.
    for (const [ofName, entry] of Object.entries(TEAM_REGISTRY)) {
      expect(OF_NAME_BY_CODE.get(entry.code)).toBe(ofName);
    }
  });

  it("TG-10: jogo noturno em Guadalajara (02:00Z, −6) usa data LOCAL 06-11", () => {
    // Instante UTC 2026-06-12T02:00Z; offset −6 → 2026-06-11T20:00 local.
    // Data UTC crua daria 06-12 (divergência); a correta é 06-11.
    const event = groupEvent({
      date: "2026-06-12T02:00Z",
      homeAbbr: "MEX",
      awayAbbr: "RSA",
      city: "Guadalajara",
    });
    expect(buildEspnMatchId(event)).toBe("2026-06-11-mexico-south-africa");
  });
});

// ─── TG-06..09 — grupos: erros ──────────────────────────────────────────────

describe("buildEspnMatchId — grupos, erros", () => {
  it("TG-06: home abbreviation desconhecida → throw", () => {
    const event = groupEvent({
      date: "2026-06-11T19:00Z",
      homeAbbr: "ZZZ",
      awayAbbr: "BRA",
    });
    expect(() => buildEspnMatchId(event)).toThrow();
  });

  it("TG-07: away abbreviation desconhecida → throw", () => {
    const event = groupEvent({
      date: "2026-06-11T19:00Z",
      homeAbbr: "BRA",
      awayAbbr: "ZZZ",
    });
    expect(() => buildEspnMatchId(event)).toThrow();
  });

  it("TG-08: sem competitor 'home' (ambos away) → throw", () => {
    const event = customEvent([
      { homeAway: "away", score: "0", team: { abbreviation: "BRA" } },
      { homeAway: "away", score: "0", team: { abbreviation: "MAR" } },
    ]);
    expect(() => buildEspnMatchId(event)).toThrow();
  });

  it("TG-09: sem competitor 'away' (ambos home) → throw", () => {
    const event = customEvent([
      { homeAway: "home", score: "0", team: { abbreviation: "BRA" } },
      { homeAway: "home", score: "0", team: { abbreviation: "MAR" } },
    ]);
    expect(() => buildEspnMatchId(event)).toThrow();
  });

  it("TG-11: cidade-sede fora do mapa de offset → throw", () => {
    const event = groupEvent({
      date: "2026-06-11T19:00Z",
      homeAbbr: "BRA",
      awayAbbr: "MAR",
      city: "Atlantis",
    });
    expect(() => buildEspnMatchId(event)).toThrow();
  });

  it("TG-12: jogo de grupo sem venue/city → throw", () => {
    const event = groupEvent({
      date: "2026-06-11T19:00Z",
      homeAbbr: "BRA",
      awayAbbr: "MAR",
      omitVenue: true,
    });
    expect(() => buildEspnMatchId(event)).toThrow();
  });
});

// ─── TK-* — mata-mata ───────────────────────────────────────────────────────

describe("buildEspnMatchId — mata-mata", () => {
  it("TK-01: round-of-32 com knockoutNum 73 → m73", () => {
    const event = groupEvent({
      date: "2026-06-28T19:00Z",
      homeAbbr: "2A",
      awayAbbr: "2B",
      seasonSlug: "round-of-32",
    });
    expect(buildEspnMatchId(event, 73)).toBe("m73");
  });

  it("TK-02: final com knockoutNum 104 → m104", () => {
    const event = groupEvent({
      date: "2026-07-19T19:00Z",
      homeAbbr: "W101",
      awayAbbr: "W102",
      seasonSlug: "final",
    });
    expect(buildEspnMatchId(event, 104)).toBe("m104");
  });

  it("TK-03: sem season.slug (undefined) tratado como mata-mata → m80", () => {
    const event = groupEvent({
      date: "2026-07-01T19:00Z",
      homeAbbr: "1A",
      awayAbbr: "2C",
      seasonSlug: undefined,
    });
    expect(isGroupStage(event)).toBe(false);
    expect(buildEspnMatchId(event, 80)).toBe("m80");
  });

  it("TK-04: fixture real knockout com knockoutNum 73 → m73", () => {
    const event = loadEvent("espn-event-knockout.json");
    expect(isGroupStage(event)).toBe(false);
    expect(buildEspnMatchId(event, 73)).toBe("m73");
  });

  it("TK-05: mata-mata sem knockoutNum → throw", () => {
    const event = groupEvent({
      date: "2026-06-28T19:00Z",
      homeAbbr: "2A",
      awayAbbr: "2B",
      seasonSlug: "round-of-32",
    });
    expect(() => buildEspnMatchId(event)).toThrow();
  });

  it("TK-06: mata-mata com knockoutNum NaN → throw", () => {
    const event = groupEvent({
      date: "2026-06-28T19:00Z",
      homeAbbr: "2A",
      awayAbbr: "2B",
      seasonSlug: "round-of-32",
    });
    expect(() => buildEspnMatchId(event, Number.NaN)).toThrow();
  });
});

// ─── TP-* — paridade com openfootball ───────────────────────────────────────

describe("buildEspnMatchId — paridade byte-a-byte com buildMatchId", () => {
  // NÃO-circular: o lado ESPN recebe o instante UTC (`utc`) + cidade-sede; o lado
  // openfootball recebe a data LOCAL (`ofDate`) já no formato do JSON. O caso
  // noturno tem `utc` num dia diferente de `ofDate` — só passa se a conversão
  // UTC→local estiver correta (a falha que a versão anterior circular escondia).
  const cases = [
    { name: "MEX/RSA diurno",  homeAbbr: "MEX", awayAbbr: "RSA", team1: "Mexico", team2: "South Africa", utc: "2026-06-11T19:00Z", city: "Mexico City", ofDate: "2026-06-11" },
    { name: "BRA/MAR diurno",  homeAbbr: "BRA", awayAbbr: "MAR", team1: "Brazil", team2: "Morocco", utc: "2026-06-13T22:00Z", city: "Mexico City", ofDate: "2026-06-13" },
    { name: "CUW/CIV diurno",  homeAbbr: "CUW", awayAbbr: "CIV", team1: "Curaçao", team2: "Ivory Coast", utc: "2026-06-20T19:00Z", city: "Mexico City", ofDate: "2026-06-20" },
    { name: "MEX/RSA NOTURNO", homeAbbr: "MEX", awayAbbr: "RSA", team1: "Mexico", team2: "South Africa", utc: "2026-06-12T02:00Z", city: "Guadalajara", ofDate: "2026-06-11" },
    { name: "ARG/ALG NOTURNO Inglewood", homeAbbr: "ARG", awayAbbr: "ALG", team1: "Argentina", team2: "Algeria", utc: "2026-06-26T03:00Z", city: "Inglewood, California", ofDate: "2026-06-25" },
  ];

  it.each(cases)(
    "TP-01: $name — ESPN id == openfootball id",
    ({ homeAbbr, awayAbbr, team1, team2, utc, city, ofDate }) => {
      const espnId = buildEspnMatchId(
        groupEvent({ date: utc, homeAbbr, awayAbbr, city }),
      );
      const ofId = buildMatchId({ round: "Matchday 1", date: ofDate, team1, team2 });
      expect(espnId).toBe(ofId);
    },
  );
});
