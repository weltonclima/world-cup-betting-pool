import { describe, expect, it } from "vitest";

import { buildEspnMatchId } from "../espnMatchId";
import { getChampionship } from "../championshipCatalog";
import type { EspnEvent } from "../espnTypes";
import { matchBaseId } from "../matchBaseId";
import {
  ESPN_GROUP_EVENTS,
  EXPECTED_GROUP_IDS,
} from "./fixtures/espnParitySnapshot";

const fifaWorld = getChampionship("fifa.world")!;
const bra = getChampionship("bra.1-2026")!;

describe("matchBaseId › legado (Copa) mantém paridade", () => {
  const events = ESPN_GROUP_EVENTS as unknown as EspnEvent[];

  it("delega ao buildEspnMatchId (namespacing é identidade no legado)", () => {
    // contrato de delegação, independente da ordem da fixture
    for (const ev of events) {
      expect(matchBaseId(ev, fifaWorld)).toBe(buildEspnMatchId(ev));
    }
  });

  it("o conjunto de ids gerados == ids canônicos esperados da Copa", () => {
    const generated = new Set(events.map((ev) => matchBaseId(ev, fifaWorld)));
    expect(generated).toEqual(new Set(EXPECTED_GROUP_IDS));
  });
});

describe("matchBaseId › campeonato novo usa event.id namespaced", () => {
  const event = { id: "401757", competitions: [] } as unknown as EspnEvent;

  it("prefixa event.id com championshipId", () => {
    expect(matchBaseId(event, bra)).toBe("bra.1-2026:401757");
  });

  it("lança se event.id vazio", () => {
    const bad = { id: "", competitions: [] } as unknown as EspnEvent;
    expect(() => matchBaseId(bad, bra)).toThrow();
  });
});
