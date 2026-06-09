import { describe, expect, expectTypeOf, it } from "vitest";

import type { MatchStatus } from "@/types/shared";
import {
  mapMatchStatus,
  parseRound,
  type ParsedRound,
} from "@/lib/apiFootball";

// ---------------------------------------------------------------------------
// mapMatchStatus
// ---------------------------------------------------------------------------

describe("mapMatchStatus › scheduled", () => {
  it('NS → "scheduled" (não iniciado)', () => {
    expect(mapMatchStatus("NS")).toBe("scheduled");
  });

  it('TBD → "scheduled" (data/horário a definir)', () => {
    expect(mapMatchStatus("TBD")).toBe("scheduled");
  });
});

describe("mapMatchStatus › live", () => {
  it('1H → "live" (primeiro tempo)', () => {
    expect(mapMatchStatus("1H")).toBe("live");
  });

  it('HT → "live" (intervalo)', () => {
    expect(mapMatchStatus("HT")).toBe("live");
  });

  it('2H → "live" (segundo tempo)', () => {
    expect(mapMatchStatus("2H")).toBe("live");
  });

  it('ET → "live" (prorrogação)', () => {
    expect(mapMatchStatus("ET")).toBe("live");
  });

  it('BT → "live" (pausa da prorrogação)', () => {
    expect(mapMatchStatus("BT")).toBe("live");
  });

  it('P → "live" (disputa de pênaltis em andamento)', () => {
    expect(mapMatchStatus("P")).toBe("live");
  });

  it('LIVE → "live" (em jogo — código genérico)', () => {
    expect(mapMatchStatus("LIVE")).toBe("live");
  });

  it('SUSP → "live" (suspenso temporariamente)', () => {
    expect(mapMatchStatus("SUSP")).toBe("live");
  });

  it('INT → "live" (interrompido temporariamente)', () => {
    expect(mapMatchStatus("INT")).toBe("live");
  });
});

describe("mapMatchStatus › finished", () => {
  it('FT → "finished" (encerrado no tempo normal)', () => {
    expect(mapMatchStatus("FT")).toBe("finished");
  });

  it('AET → "finished" (encerrado na prorrogação)', () => {
    expect(mapMatchStatus("AET")).toBe("finished");
  });

  it('PEN → "finished" (encerrado nos pênaltis)', () => {
    expect(mapMatchStatus("PEN")).toBe("finished");
  });
});

describe("mapMatchStatus › postponed", () => {
  it('PST → "postponed" (adiado)', () => {
    expect(mapMatchStatus("PST")).toBe("postponed");
  });
});

describe("mapMatchStatus › canceled", () => {
  it('CANC → "canceled" (cancelado)', () => {
    expect(mapMatchStatus("CANC")).toBe("canceled");
  });

  it('ABD → "canceled" (abandonado)', () => {
    expect(mapMatchStatus("ABD")).toBe("canceled");
  });

  it('WO → "canceled" (W.O. / sem apresentação)', () => {
    expect(mapMatchStatus("WO")).toBe("canceled");
  });

  it('AWD → "canceled" (resultado por decisão administrativa)', () => {
    expect(mapMatchStatus("AWD")).toBe("canceled");
  });
});

describe("mapMatchStatus › erros", () => {
  it("código desconhecido lança TypeError contendo o código recebido", () => {
    expect(() => mapMatchStatus("XX")).toThrow(TypeError);
    expect(() => mapMatchStatus("XX")).toThrow("XX");
  });

  it("código em minúsculo lança TypeError (API sempre envia maiúsculo)", () => {
    expect(() => mapMatchStatus("ns")).toThrow(TypeError);
  });

  it("string vazia lança TypeError", () => {
    expect(() => mapMatchStatus("")).toThrow(TypeError);
  });
});

describe("mapMatchStatus › inferência de tipo", () => {
  it("retorno é MatchStatus", () => {
    expectTypeOf(mapMatchStatus("FT")).toEqualTypeOf<MatchStatus>();
  });
});

// ---------------------------------------------------------------------------
// parseRound
// ---------------------------------------------------------------------------

describe("parseRound › fase de grupos", () => {
  it('"Group Stage - 1" → stage grupos, round 1, groupId null', () => {
    expect(parseRound("Group Stage - 1")).toEqual({
      stage: "grupos",
      round: 1,
      groupId: null,
    });
  });

  it('"Group Stage - 2" → stage grupos, round 2, groupId null', () => {
    expect(parseRound("Group Stage - 2")).toEqual({
      stage: "grupos",
      round: 2,
      groupId: null,
    });
  });

  it('"Group Stage - 48" → stage grupos, round 48 (rodada máxima da fase de grupos)', () => {
    expect(parseRound("Group Stage - 48")).toEqual({
      stage: "grupos",
      round: 48,
      groupId: null,
    });
  });
});

describe("parseRound › mata-mata", () => {
  it('"Round of 32" → dezesseis-avos, round null, groupId null', () => {
    expect(parseRound("Round of 32")).toEqual({
      stage: "dezesseis-avos",
      round: null,
      groupId: null,
    });
  });

  it('"Round of 16" → oitavas, round null, groupId null', () => {
    expect(parseRound("Round of 16")).toEqual({
      stage: "oitavas",
      round: null,
      groupId: null,
    });
  });

  it('"Quarter-finals" → quartas, round null, groupId null', () => {
    expect(parseRound("Quarter-finals")).toEqual({
      stage: "quartas",
      round: null,
      groupId: null,
    });
  });

  it('"Semi-finals" → semifinal, round null, groupId null', () => {
    expect(parseRound("Semi-finals")).toEqual({
      stage: "semifinal",
      round: null,
      groupId: null,
    });
  });

  it('"3rd Place Final" → terceiro, round null, groupId null', () => {
    expect(parseRound("3rd Place Final")).toEqual({
      stage: "terceiro",
      round: null,
      groupId: null,
    });
  });

  it('"Final" → final, round null, groupId null', () => {
    expect(parseRound("Final")).toEqual({
      stage: "final",
      round: null,
      groupId: null,
    });
  });
});

describe("parseRound › erros", () => {
  it("string desconhecida lança TypeError contendo o valor recebido", () => {
    expect(() => parseRound("Knockout Round Plus")).toThrow(TypeError);
    expect(() => parseRound("Knockout Round Plus")).toThrow(
      "Knockout Round Plus",
    );
  });

  it("string vazia lança TypeError", () => {
    expect(() => parseRound("")).toThrow(TypeError);
  });

  it('"Group Stage - 0" lança TypeError (rodada deve ser ≥ 1)', () => {
    // A regex /^Group Stage - (\d+)$/ captura "0", mas round 0 é inválido.
    // O parser deve validar N ≥ 1 após o parse.
    expect(() => parseRound("Group Stage - 0")).toThrow(TypeError);
  });
});

describe("parseRound › inferência de tipo", () => {
  it("retorno satisfaz ParsedRound", () => {
    expectTypeOf(parseRound("Final")).toEqualTypeOf<ParsedRound>();
  });
});
