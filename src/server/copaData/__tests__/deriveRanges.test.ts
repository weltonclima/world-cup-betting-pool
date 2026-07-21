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
