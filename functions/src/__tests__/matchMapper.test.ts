/**
 * Testes de matchMapper — TDD (ciclo RED → GREEN).
 * Casos M1–M9 conforme spec §10.3.
 */

import { describe, it, expect, vi } from "vitest";
import {
  mapApiFixtureToFirestore,
  mapRoundToStage,
  mapApiStatusToMatchStatus,
} from "../mappers/matchMapper";
import { matchSchema } from "../shared/schemas";
import {
  TEST_TEAM_ID_MAP,
  fixtureAgendada,
  fixtureFinalizadaComPlacar,
  fixtureAoVivo,
  fixtureOitavas,
  fixtureRoundDesconhecido,
  fixtureTimeAusente,
} from "./fixtures/apiFixtureFixtures";

describe("mapApiFixtureToFirestore", () => {
  // M1: Partida agendada — status scheduled, placares null
  it("M1: partida agendada (NS) fica com status scheduled e placares null", () => {
    const resultado = mapApiFixtureToFirestore(fixtureAgendada, TEST_TEAM_ID_MAP);

    expect(resultado.status).toBe("scheduled");
    expect(resultado.homeScore).toBeNull();
    expect(resultado.awayScore).toBeNull();
    expect(resultado.homeTeamId).toBe("brasil-doc-id");
    expect(resultado.awayTeamId).toBe("espanha-doc-id");
  });

  // M2: Partida finalizada com placares
  it("M2: partida finalizada (FT) fica com status finished e placares corretos", () => {
    const resultado = mapApiFixtureToFirestore(
      fixtureFinalizadaComPlacar,
      TEST_TEAM_ID_MAP,
    );

    expect(resultado.status).toBe("finished");
    expect(resultado.homeScore).toBe(2);
    expect(resultado.awayScore).toBe(1);
  });

  // M3: Partida ao vivo
  it("M3: partida ao vivo (1H) fica com status live", () => {
    const resultado = mapApiFixtureToFirestore(fixtureAoVivo, TEST_TEAM_ID_MAP);

    expect(resultado.status).toBe("live");
  });

  // M4: Round "Group Stage" → stage "grupos"
  it("M4: round Group Stage mapeia para stage grupos", () => {
    const resultado = mapApiFixtureToFirestore(fixtureAgendada, TEST_TEAM_ID_MAP);

    expect(resultado.stage).toBe("grupos");
  });

  // M5: Round "Round of 16" → stage "oitavas"
  it("M5: round Round of 16 mapeia para stage oitavas", () => {
    const resultado = mapApiFixtureToFirestore(fixtureOitavas, TEST_TEAM_ID_MAP);

    expect(resultado.stage).toBe("oitavas");
  });

  // M6: Round desconhecido → lança erro informativo
  it("M6: round desconhecido lança erro com mensagem informativa", () => {
    expect(() =>
      mapApiFixtureToFirestore(fixtureRoundDesconhecido, TEST_TEAM_ID_MAP),
    ).toThrow(/round.*não reconhecido/i);
  });

  // M7: homeTeamId não encontrado no teamIdMap → lança erro
  it("M7: lança erro quando homeTeamId não existe no teamIdMap", () => {
    expect(() =>
      mapApiFixtureToFirestore(fixtureTimeAusente, TEST_TEAM_ID_MAP),
    ).toThrow(/999/);
  });

  // M8: Output satisfaz matchSchema em partida finalizada
  it("M8: output de partida finalizada satisfaz matchSchema", () => {
    const resultado = mapApiFixtureToFirestore(
      fixtureFinalizadaComPlacar,
      TEST_TEAM_ID_MAP,
    );
    const parseResult = matchSchema.safeParse(resultado);

    expect(parseResult.success).toBe(true);
  });

  // M9: Output satisfaz matchSchema em partida agendada
  it("M9: output de partida agendada satisfaz matchSchema", () => {
    const resultado = mapApiFixtureToFirestore(fixtureAgendada, TEST_TEAM_ID_MAP);
    const parseResult = matchSchema.safeParse(resultado);

    expect(parseResult.success).toBe(true);
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

  it("converte Final para final", () => {
    expect(mapRoundToStage("Final")).toBe("final");
  });

  it("lança erro para round desconhecido", () => {
    expect(() => mapRoundToStage("Playoff Round")).toThrow(
      /round.*não reconhecido/i,
    );
  });
});

describe("mapApiStatusToMatchStatus", () => {
  it("NS → scheduled", () => {
    expect(mapApiStatusToMatchStatus("NS")).toBe("scheduled");
  });

  it("1H → live", () => {
    expect(mapApiStatusToMatchStatus("1H")).toBe("live");
  });

  it("HT → live", () => {
    expect(mapApiStatusToMatchStatus("HT")).toBe("live");
  });

  it("2H → live", () => {
    expect(mapApiStatusToMatchStatus("2H")).toBe("live");
  });

  it("FT → finished", () => {
    expect(mapApiStatusToMatchStatus("FT")).toBe("finished");
  });

  it("PST → postponed", () => {
    expect(mapApiStatusToMatchStatus("PST")).toBe("postponed");
  });

  it("CANC → canceled", () => {
    expect(mapApiStatusToMatchStatus("CANC")).toBe("canceled");
  });

  // WR-03: status desconhecido deve retornar "scheduled" E emitir console.warn
  it("WR-03: status desconhecido retorna scheduled e emite console.warn", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const resultado = mapApiStatusToMatchStatus("XXUNKNOWN");
      expect(resultado).toBe("scheduled");
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0]![0]).toContain("XXUNKNOWN");
    } finally {
      warnSpy.mockRestore();
    }
  });
});
