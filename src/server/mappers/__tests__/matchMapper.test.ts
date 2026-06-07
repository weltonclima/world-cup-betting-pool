/**
 * Testes de matchMapper (TASK-02) — TDD (RED → GREEN).
 * Usa @/schemas como fonte única. Cobre venue, round, groupId, terceiro e todos os status.
 */

import { describe, it, expect, vi } from "vitest";
import {
  mapApiFixtureToFirestore,
  mapRoundToStage,
  mapApiStatusToMatchStatus,
  normalizeKickoffAt,
} from "../matchMapper";
import { matchSchema } from "@/schemas";
import {
  TEST_TEAM_ID_MAP,
  TEST_TEAM_GROUP_MAP,
  fixtureAgendada,
  fixtureFinalizadaComPlacar,
  fixtureAoVivo,
  fixtureOitavas,
  fixtureQuartas,
  fixtureSemifinal,
  fixtureTerceiro,
  fixtureFinal,
  fixtureSemVenue,
  fixtureRoundDesconhecido,
  fixtureTimeAusente,
  fixtureOffsetUtc,
  fixtureOffsetBrasilia,
  fixtureDataInvalida,
} from "./fixtures/apiFixtureFixtures";

describe("mapApiFixtureToFirestore", () => {
  it("M1: partida agendada (NS) fica com status scheduled e placares null", () => {
    const r = mapApiFixtureToFirestore(fixtureAgendada, TEST_TEAM_ID_MAP);
    expect(r.status).toBe("scheduled");
    expect(r.homeScore).toBeNull();
    expect(r.awayScore).toBeNull();
    expect(r.homeTeamId).toBe("brasil-doc-id");
    expect(r.awayTeamId).toBe("espanha-doc-id");
  });

  it("M2: partida finalizada (FT) fica com status finished e placares corretos", () => {
    const r = mapApiFixtureToFirestore(fixtureFinalizadaComPlacar, TEST_TEAM_ID_MAP);
    expect(r.status).toBe("finished");
    expect(r.homeScore).toBe(2);
    expect(r.awayScore).toBe(1);
  });

  it("M3: partida ao vivo (1H) fica com status live", () => {
    const r = mapApiFixtureToFirestore(fixtureAoVivo, TEST_TEAM_ID_MAP);
    expect(r.status).toBe("live");
  });

  it("M4: round Group Stage mapeia para stage grupos", () => {
    const r = mapApiFixtureToFirestore(fixtureAgendada, TEST_TEAM_ID_MAP);
    expect(r.stage).toBe("grupos");
  });

  it("M5: round Round of 16 mapeia para stage oitavas", () => {
    const r = mapApiFixtureToFirestore(fixtureOitavas, TEST_TEAM_ID_MAP);
    expect(r.stage).toBe("oitavas");
  });

  it("M6: round Quarter-finals mapeia para stage quartas", () => {
    const r = mapApiFixtureToFirestore(fixtureQuartas, TEST_TEAM_ID_MAP);
    expect(r.stage).toBe("quartas");
  });

  it("M7: round Semi-finals mapeia para stage semifinal", () => {
    const r = mapApiFixtureToFirestore(fixtureSemifinal, TEST_TEAM_ID_MAP);
    expect(r.stage).toBe("semifinal");
  });

  it("M8: round 3rd Place Final mapeia para stage terceiro", () => {
    const r = mapApiFixtureToFirestore(fixtureTerceiro, TEST_TEAM_ID_MAP);
    expect(r.stage).toBe("terceiro");
  });

  it("M9: round Final mapeia para stage final", () => {
    const r = mapApiFixtureToFirestore(fixtureFinal, TEST_TEAM_ID_MAP);
    expect(r.stage).toBe("final");
  });

  it("M10: round desconhecido lança erro informativo", () => {
    expect(() =>
      mapApiFixtureToFirestore(fixtureRoundDesconhecido, TEST_TEAM_ID_MAP),
    ).toThrow(/round.*não reconhecido/i);
  });

  it("M11: lança erro quando homeTeamId não existe no teamIdMap", () => {
    expect(() =>
      mapApiFixtureToFirestore(fixtureTimeAusente, TEST_TEAM_ID_MAP),
    ).toThrow(/999/);
  });

  it("M12: venue presente é mapeado para { name, city }", () => {
    const r = mapApiFixtureToFirestore(fixtureAgendada, TEST_TEAM_ID_MAP);
    expect(r.venue).toEqual({ name: "MetLife Stadium", city: "East Rutherford" });
  });

  it("M13: venue ausente/TBD é mapeado para null", () => {
    const r = mapApiFixtureToFirestore(fixtureSemVenue, TEST_TEAM_ID_MAP);
    expect(r.venue).toBeNull();
  });

  it("M14: round numérico de grupos (Group Stage - 2) extrai 2", () => {
    const r = mapApiFixtureToFirestore(fixtureFinalizadaComPlacar, TEST_TEAM_ID_MAP);
    expect(r.round).toBe(2);
  });

  it("M15: round em mata-mata (Round of 16) fica null", () => {
    const r = mapApiFixtureToFirestore(fixtureOitavas, TEST_TEAM_ID_MAP);
    expect(r.round).toBeNull();
  });

  it("M16: groupId em grupos vem do grupo do mandante (via teamGroupMap)", () => {
    const r = mapApiFixtureToFirestore(
      fixtureAgendada,
      TEST_TEAM_ID_MAP,
      TEST_TEAM_GROUP_MAP,
    );
    expect(r.groupId).toBe("A");
  });

  it("M17: groupId fora de grupos é null mesmo com teamGroupMap", () => {
    const r = mapApiFixtureToFirestore(
      fixtureOitavas,
      TEST_TEAM_ID_MAP,
      TEST_TEAM_GROUP_MAP,
    );
    expect(r.groupId).toBeNull();
  });

  it("M17b: groupId em grupos sem teamGroupMap degrada para null", () => {
    const r = mapApiFixtureToFirestore(fixtureAgendada, TEST_TEAM_ID_MAP);
    expect(r.groupId).toBeNull();
  });

  it("M18: placar não é gravado quando não finalizado (live com gols null)", () => {
    const r = mapApiFixtureToFirestore(fixtureAoVivo, TEST_TEAM_ID_MAP);
    expect(r.homeScore).toBeNull();
    expect(r.awayScore).toBeNull();
  });

  it("M19: output de partida finalizada satisfaz matchSchema (strict)", () => {
    const r = mapApiFixtureToFirestore(
      fixtureFinalizadaComPlacar,
      TEST_TEAM_ID_MAP,
      TEST_TEAM_GROUP_MAP,
    );
    expect(matchSchema.safeParse(r).success).toBe(true);
  });

  it("M20: output de partida agendada satisfaz matchSchema (strict)", () => {
    const r = mapApiFixtureToFirestore(
      fixtureAgendada,
      TEST_TEAM_ID_MAP,
      TEST_TEAM_GROUP_MAP,
    );
    expect(matchSchema.safeParse(r).success).toBe(true);
  });

  it("M21: kickoffAt com offset +00:00 é normalizado para sufixo Z", () => {
    const r = mapApiFixtureToFirestore(fixtureOffsetUtc, TEST_TEAM_ID_MAP);
    expect(r.kickoffAt).toBe("2026-06-11T15:00:00.000Z");
    expect(r.kickoffAt.endsWith("Z")).toBe(true);
  });

  it("M22: kickoffAt com offset -03:00 é convertido para o instante em Z", () => {
    const r = mapApiFixtureToFirestore(fixtureOffsetBrasilia, TEST_TEAM_ID_MAP);
    // 12:00-03:00 == 15:00Z
    expect(r.kickoffAt).toBe("2026-06-11T15:00:00.000Z");
  });

  it("M23: offsets +00:00 e -03:00 do mesmo instante produzem o mesmo kickoffAt", () => {
    const utc = mapApiFixtureToFirestore(fixtureOffsetUtc, TEST_TEAM_ID_MAP);
    const brt = mapApiFixtureToFirestore(fixtureOffsetBrasilia, TEST_TEAM_ID_MAP);
    expect(utc.kickoffAt).toBe(brt.kickoffAt);
  });

  it("M24: data inválida lança erro claro", () => {
    expect(() =>
      mapApiFixtureToFirestore(fixtureDataInvalida, TEST_TEAM_ID_MAP),
    ).toThrow(/data de partida inválida/i);
  });
});

describe("normalizeKickoffAt", () => {
  it("preserva instante já em Z", () => {
    expect(normalizeKickoffAt("2026-06-11T15:00:00.000Z")).toBe(
      "2026-06-11T15:00:00.000Z",
    );
  });
  it("normaliza offset +00:00 para Z", () => {
    expect(normalizeKickoffAt("2026-06-11T15:00:00+00:00")).toBe(
      "2026-06-11T15:00:00.000Z",
    );
  });
  it("converte offset -03:00 para o instante UTC", () => {
    expect(normalizeKickoffAt("2026-06-11T12:00:00-03:00")).toBe(
      "2026-06-11T15:00:00.000Z",
    );
  });
  it("lança erro para data inválida", () => {
    expect(() => normalizeKickoffAt("não-é-data")).toThrow(
      /data de partida inválida/i,
    );
  });
});

describe("mapRoundToStage", () => {
  it("converte Group Stage para grupos", () => {
    expect(mapRoundToStage("Group Stage - 1")).toBe("grupos");
  });
  it("converte Round of 16 para oitavas", () => {
    expect(mapRoundToStage("Round of 16")).toBe("oitavas");
  });
  it("converte Quarter-finals para quartas", () => {
    expect(mapRoundToStage("Quarter-finals")).toBe("quartas");
  });
  it("converte Semi-finals para semifinal", () => {
    expect(mapRoundToStage("Semi-finals")).toBe("semifinal");
  });
  it("converte 3rd Place Final para terceiro", () => {
    expect(mapRoundToStage("3rd Place Final")).toBe("terceiro");
  });
  it("converte Final para final", () => {
    expect(mapRoundToStage("Final")).toBe("final");
  });
  it("lança erro para round desconhecido", () => {
    expect(() => mapRoundToStage("Playoff Round")).toThrow(/round.*não reconhecido/i);
  });
});

describe("mapApiStatusToMatchStatus", () => {
  const cases: Array<[string, string]> = [
    ["NS", "scheduled"],
    ["TBD", "scheduled"],
    ["1H", "live"],
    ["HT", "live"],
    ["2H", "live"],
    ["ET", "live"],
    ["P", "live"],
    ["BT", "live"],
    ["LIVE", "live"],
    ["FT", "finished"],
    ["AET", "finished"],
    ["PEN", "finished"],
    ["AWD", "finished"],
    ["WO", "finished"],
    ["PST", "postponed"],
    ["CANC", "canceled"],
    ["SUSP", "canceled"],
    ["INT", "canceled"],
    ["ABD", "canceled"],
  ];

  it.each(cases)("%s → %s", (short, expected) => {
    expect(mapApiStatusToMatchStatus(short)).toBe(expected);
  });

  it("status desconhecido retorna scheduled e emite console.warn", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      expect(mapApiStatusToMatchStatus("XXUNKNOWN")).toBe("scheduled");
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0]![0]).toContain("XXUNKNOWN");
    } finally {
      warnSpy.mockRestore();
    }
  });
});
