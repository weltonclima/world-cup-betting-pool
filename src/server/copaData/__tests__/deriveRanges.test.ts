import { describe, expect, it } from "vitest";

import { getChampionship } from "../championshipCatalog";
import { deriveRanges } from "../espnClient";

const fifaWorld = getChampionship("fifa.world")!;
const bra = getChampionship("bra.1-2026")!; // league, needsPagination true
const ucl = getChampionship("uefa.champions-2026")!; // CUP, needsPagination true
const america = getChampionship("conmebol.america-2026")!; // cup, needsPagination false

const RANGE_RE = /^(\d{8})-(\d{8})$/;

describe("deriveRanges › compat Copa", () => {
  it("fifa.world retorna exatamente os 2 ranges legados", () => {
    expect(deriveRanges(fifaWorld)).toEqual([
      "20260611-20260627",
      "20260628-20260719",
    ]);
  });
});

describe("deriveRanges › liga (paginação)", () => {
  const ranges = () => deriveRanges(bra);

  it("gera 12 ranges mensais cobrindo a temporada", () => {
    expect(ranges()).toHaveLength(12);
    expect(ranges()[0]).toBe("20260101-20260131");
    expect(ranges()[11]).toBe("20261201-20261231");
  });

  it("todos no formato YYYYMMDD-YYYYMMDD", () => {
    for (const r of ranges()) {
      expect(r).toMatch(RANGE_RE);
    }
  });

  it("ranges são ordenados, disjuntos e sem buraco", () => {
    const rs = ranges();
    for (let i = 1; i < rs.length; i++) {
      const prevEnd = rs[i - 1]!.split("-")[1]!;
      const curStart = rs[i]!.split("-")[0]!;
      // início do mês atual = fim do mês anterior + 1 dia
      expect(Number(curStart)).toBeGreaterThan(Number(prevEnd));
    }
  });
});

describe("deriveRanges › paginação é dirigida por needsPagination (não pelo tipo)", () => {
  it("cup com needsPagination true (UCL) também gera 12 ranges", () => {
    const rs = deriveRanges(ucl);
    expect(rs).toHaveLength(12);
    expect(rs[0]).toBe("20260101-20260131");
  });

  it("fevereiro de 2026 (não bissexto) termina em 28", () => {
    const rs = deriveRanges(bra);
    expect(rs[1]).toBe("20260201-20260228");
  });
});

describe("deriveRanges › cup curto (sem paginação)", () => {
  it("retorna um único range da temporada inteira", () => {
    expect(deriveRanges(america)).toEqual(["20260101-20261231"]);
  });
});

describe("deriveRanges › season inválida falha ruidosa (não silenciosa)", () => {
  const base = {
    espnSlug: "eng.1",
    needsPagination: true,
    legacyMatchId: false,
  } as const;

  it("temporada partida '2025-26' lança (exige seasonStart/end — TASK-05)", () => {
    expect(() => deriveRanges({ ...base, season: "2025-26" })).toThrow(/TASK-05/);
  });

  it("ano curto '26' lança", () => {
    expect(() => deriveRanges({ ...base, season: "26" })).toThrow();
  });

  it("lixo não-numérico lança", () => {
    expect(() => deriveRanges({ ...base, season: "temporada" })).toThrow();
  });
});

describe("deriveRanges › janela real seasonStart/seasonEnd (fix WR-02 / TASK-05)", () => {
  // Temporada europeia partida (ago–mai) que atravessa DOIS anos-calendário.
  const euroSplit = {
    espnSlug: "eng.1",
    season: "2025-26",
    needsPagination: true,
    legacyMatchId: false,
    seasonStart: "20250815",
    seasonEnd: "20260525",
  } as const;

  it("com janela presente NÃO lança mesmo com season partida '2025-26'", () => {
    expect(() => deriveRanges(euroSplit)).not.toThrow();
  });

  it("gera ranges mensais cobrindo ago/2025 → mai/2026 (10 meses)", () => {
    const rs = deriveRanges(euroSplit);
    expect(rs).toHaveLength(10);
    expect(rs[0]).toBe("20250801-20250831");
    expect(rs[9]).toBe("20260501-20260531");
  });

  it("ranges da janela são ordenados, disjuntos e atravessam a virada de ano", () => {
    const rs = deriveRanges(euroSplit);
    for (let i = 1; i < rs.length; i++) {
      const prevEnd = rs[i - 1]!.split("-")[1]!;
      const curStart = rs[i]!.split("-")[0]!;
      expect(Number(curStart)).toBeGreaterThan(Number(prevEnd));
    }
    // dez/2025 → jan/2026 presente (virada de ano)
    expect(rs).toContain("20251201-20251231");
    expect(rs).toContain("20260101-20260131");
  });

  it("janela tem precedência sobre a derivação por season YYYY", () => {
    // mesma competição, season YYYY, mas com janela ago–dez → segue a janela, não jan–dez
    const rs = deriveRanges({
      espnSlug: "eng.1",
      season: "2026",
      needsPagination: true,
      legacyMatchId: false,
      seasonStart: "20260801",
      seasonEnd: "20261231",
    });
    expect(rs[0]).toBe("20260801-20260831");
    expect(rs).toHaveLength(5); // ago,set,out,nov,dez
  });

  it("janela de um único mês gera exatamente 1 range (dia interno ignorado)", () => {
    const rs = deriveRanges({
      espnSlug: "some.cup",
      season: "2026",
      needsPagination: true,
      legacyMatchId: false,
      seasonStart: "20260610", // dia interno ignorado — granularidade é o mês
      seasonEnd: "20260628",
    });
    expect(rs).toEqual(["20260601-20260630"]);
  });

  it("janela invertida (start > end) FALHA ruidosa (não devolve [] em silêncio)", () => {
    expect(() =>
      deriveRanges({
        espnSlug: "eng.1",
        season: "2026",
        needsPagination: true,
        legacyMatchId: false,
        seasonStart: "20260601",
        seasonEnd: "20260501", // antes do início → janela invertida
      }),
    ).toThrow(/invertida/);
  });

  it("mês fora de 01-12 na janela FALHA ruidosa", () => {
    expect(() =>
      deriveRanges({
        espnSlug: "eng.1",
        season: "2026",
        needsPagination: true,
        legacyMatchId: false,
        seasonStart: "20261301", // mês 13 inválido
        seasonEnd: "20261401",
      }),
    ).toThrow(/mês/);
  });

  it("legado (legacyMatchId) tem precedência sobre a janela — compat Copa intocada", () => {
    // Mesmo com seasonStart/End definidos, o ramo legado vence: ranges fixos da Copa.
    const rs = deriveRanges({
      espnSlug: "fifa.world",
      season: "2026",
      needsPagination: false,
      legacyMatchId: true,
      seasonStart: "20260601",
      seasonEnd: "20260731",
    });
    expect(rs).toEqual(["20260611-20260627", "20260628-20260719"]);
  });
});
