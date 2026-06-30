import { describe, expect, it } from "vitest";

import type { KnockoutMatch } from "@/types/worldcup";

import {
  buildMatchIndex,
  buildTreeOrder,
  formatKickoffBr,
  formatSideScore,
  getAdvancingSide,
  getWinningSide,
} from "../knockoutHelpers";

// ---------------------------------------------------------------------------
// Fixtures — KnockoutMatch mínimo por status.
// TZ dos testes fixado em America/Sao_Paulo (UTC−3) via vitest.config.
// ---------------------------------------------------------------------------

function makeMatch(over: Partial<KnockoutMatch> = {}): KnockoutMatch {
  return {
    id: "m73",
    phase: "oitavas",
    homeTeam: { name: "Brasil", code: "BRA", defined: true },
    awayTeam: { name: "Argentina", code: "ARG", defined: true },
    status: "definido",
    ...over,
  };
}

// ---------------------------------------------------------------------------
// getWinningSide — lado vencedor de mata-mata encerrado.
// ---------------------------------------------------------------------------

describe("getWinningSide", () => {
  it("retorna null quando status é 'aguardando'", () => {
    const match = makeMatch({
      status: "aguardando",
      homeTeam: { name: "Vencedor Jogo 71", defined: false },
    });
    expect(getWinningSide(match)).toBeNull();
  });

  it("retorna null quando status é 'definido' (jogo ainda não encerrado)", () => {
    expect(getWinningSide(makeMatch({ status: "definido" }))).toBeNull();
  });

  it("retorna 'home' quando o mandante tem placar maior", () => {
    const match = makeMatch({ status: "encerrado", homeScore: 2, awayScore: 1 });
    expect(getWinningSide(match)).toBe("home");
  });

  it("retorna 'away' quando o visitante tem placar maior", () => {
    const match = makeMatch({ status: "encerrado", homeScore: 0, awayScore: 3 });
    expect(getWinningSide(match)).toBe("away");
  });

  it("retorna 'draw' em empate — pênaltis não influenciam o bolão", () => {
    const match = makeMatch({ status: "encerrado", homeScore: 1, awayScore: 1 });
    expect(getWinningSide(match)).toBe("draw");
  });

  it("retorna 'draw' em empate 0x0", () => {
    const match = makeMatch({ status: "encerrado", homeScore: 0, awayScore: 0 });
    expect(getWinningSide(match)).toBe("draw");
  });
});

// ---------------------------------------------------------------------------
// getAdvancingSide — lado que avançou (autoridade = advanceSide). TASK-04.
// ---------------------------------------------------------------------------

describe("getAdvancingSide", () => {
  it("usa advanceSide como autoridade mesmo com empate no tempo normal (pênaltis)", () => {
    const match = makeMatch({
      status: "encerrado",
      homeScore: 1,
      awayScore: 1,
      outcome: "penalties",
      homeShootout: 4,
      awayShootout: 3,
      advanceSide: "home",
    });
    // getWinningSide veria "draw"; getAdvancingSide coroa quem avançou.
    expect(getWinningSide(match)).toBe("draw");
    expect(getAdvancingSide(match)).toBe("home");
  });

  it("advanceSide vence sobre o placar (coroa o lado que avançou)", () => {
    const match = makeMatch({
      status: "encerrado",
      homeScore: 0,
      awayScore: 1,
      advanceSide: "home",
    });
    expect(getAdvancingSide(match)).toBe("home");
  });

  it("sem advanceSide cai para o vencedor por placar", () => {
    const match = makeMatch({ status: "encerrado", homeScore: 2, awayScore: 1 });
    expect(getAdvancingSide(match)).toBe("home");
  });

  it("advanceSide null (ex.: 3º/final) cai para o vencedor por placar", () => {
    const match = makeMatch({
      status: "encerrado",
      homeScore: 0,
      awayScore: 2,
      advanceSide: null,
    });
    expect(getAdvancingSide(match)).toBe("away");
  });

  it("retorna null quando o jogo não está encerrado", () => {
    expect(getAdvancingSide(makeMatch({ status: "definido" }))).toBeNull();
  });

  it("WR-01: retorna null em jogo não-encerrado mesmo com advanceSide presente", () => {
    // Defesa de reuso: o gate de status vem ANTES de advanceSide.
    const match = makeMatch({ status: "definido", advanceSide: "home" });
    expect(getAdvancingSide(match)).toBeNull();
  });

  it("WR-02: sem advanceSide, desempata pelo shootout quando o tempo normal empatou", () => {
    // Snapshot legado sem advanceSide, mas com pênaltis → o shootout decide.
    const match = makeMatch({
      status: "encerrado",
      homeScore: 1,
      awayScore: 1,
      homeShootout: 5,
      awayShootout: 4,
      outcome: "penalties",
    });
    expect(getAdvancingSide(match)).toBe("home");
  });
});

// ---------------------------------------------------------------------------
// formatSideScore — placar + pênaltis "(n)". TASK-04.
// ---------------------------------------------------------------------------

describe("formatSideScore", () => {
  it("retorna apenas o placar quando não há pênaltis", () => {
    expect(formatSideScore(1)).toBe("1");
    expect(formatSideScore(0)).toBe("0");
  });

  it("anexa os pênaltis entre parênteses quando presentes", () => {
    expect(formatSideScore(1, 4)).toBe("1 (4)");
    expect(formatSideScore(1, 3)).toBe("1 (3)");
  });

  it("INVARIANTE: o shootout não é somado ao placar (fica entre parênteses)", () => {
    // 0 (3) — pênaltis NÃO viram 3 no placar de tempo normal.
    expect(formatSideScore(0, 3)).toBe("0 (3)");
  });
});

// ---------------------------------------------------------------------------
// formatKickoffBr — data/hora pt-BR no fuso local.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// buildMatchIndex — índice O(1) por id. TASK-09.
// ---------------------------------------------------------------------------

describe("buildMatchIndex", () => {
  it("H-01: indexa cada match pelo id", () => {
    const a = makeMatch({ id: "m73" });
    const b = makeMatch({ id: "m75" });
    const index = buildMatchIndex([a, b]);
    expect(index.get("m73")).toBe(a);
    expect(index.get("m75")).toBe(b);
    expect(index.size).toBe(2);
  });

  it("H-02: id duplicado — última ocorrência vence (defensivo, spec §6.4)", () => {
    const first = makeMatch({ id: "m73", phase: "oitavas" });
    const dup = makeMatch({ id: "m73", phase: "quartas" });
    const index = buildMatchIndex([first, dup]);
    expect(index.get("m73")).toBe(dup);
    expect(index.size).toBe(1);
  });

  it("H-03: retorna mapa vazio para lista vazia", () => {
    expect(buildMatchIndex([]).size).toBe(0);
  });

  it("H-03b: lookup de id ausente retorna undefined", () => {
    const index = buildMatchIndex([makeMatch({ id: "m73" })]);
    expect(index.get("m99")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildTreeOrder — ordem de chave (pais adjacentes ao filho). TASK-09.
// ---------------------------------------------------------------------------

describe("buildTreeOrder", () => {
  it("H-04: reordena os pais conforme os parentMatchIds dos filhos", () => {
    // R32 entra fora de ordem; R16 child liga slot p73+p75 e p74+p76.
    const r32 = [
      makeMatch({ id: "p73" }),
      makeMatch({ id: "p74" }),
      makeMatch({ id: "p75" }),
      makeMatch({ id: "p76" }),
    ];
    const r16 = [
      makeMatch({ id: "c1", parentMatchIds: ["p73", "p75"] }),
      makeMatch({ id: "c2", parentMatchIds: ["p74", "p76"] }),
    ];
    const [orderedR32, orderedR16] = buildTreeOrder([
      { matches: r32 },
      { matches: r16 },
    ]);
    // R16 (mais à direita) mantém ordem; R32 reordenado p/ pais adjacentes.
    expect(orderedR16!.map((m) => m.id)).toEqual(["c1", "c2"]);
    expect(orderedR32!.map((m) => m.id)).toEqual(["p73", "p75", "p74", "p76"]);
  });

  it("H-05: sem parentMatchIds mantém a ordem natural (degradação)", () => {
    const r32 = [makeMatch({ id: "p73" }), makeMatch({ id: "p74" })];
    const r16 = [makeMatch({ id: "c1" })]; // sem parentMatchIds
    const [orderedR32] = buildTreeOrder([{ matches: r32 }, { matches: r16 }]);
    expect(orderedR32!.map((m) => m.id)).toEqual(["p73", "p74"]);
  });

  it("H-06: pais não referenciados são acrescentados ao fim", () => {
    const r32 = [
      makeMatch({ id: "p73" }),
      makeMatch({ id: "p74" }),
      makeMatch({ id: "p75" }),
    ];
    const r16 = [makeMatch({ id: "c1", parentMatchIds: ["p75", "p73"] })];
    const [orderedR32] = buildTreeOrder([{ matches: r32 }, { matches: r16 }]);
    // p75,p73 referenciados (nessa ordem) → p74 órfão ao fim.
    expect(orderedR32!.map((m) => m.id)).toEqual(["p75", "p73", "p74"]);
  });

  it("H-07: coluna única retorna a própria lista", () => {
    const r32 = [makeMatch({ id: "p73" }), makeMatch({ id: "p74" })];
    const [ordered] = buildTreeOrder([{ matches: r32 }]);
    expect(ordered!.map((m) => m.id)).toEqual(["p73", "p74"]);
  });
});

describe("formatKickoffBr", () => {
  it("formata ISO 8601 em pt-BR no fuso local (UTC−3)", () => {
    // 19:00 UTC = 16:00 BRT, segunda-feira 29 jun 2026.
    expect(formatKickoffBr("2026-06-29T19:00:00.000Z")).toBe("Seg, 29 Jun · 16h00");
  });

  it("usa o fuso LOCAL, não UTC, quando o horário cruza a meia-noite", () => {
    // 01:00 UTC do dia 30 = 22:00 BRT do dia 29.
    expect(formatKickoffBr("2026-06-30T01:00:00.000Z")).toBe("Seg, 29 Jun · 22h00");
  });

  it("separa hora e minuto com 'h' (não ':')", () => {
    const result = formatKickoffBr("2026-06-29T19:00:00.000Z");
    expect(result).toContain("h00");
    expect(result).not.toContain(":");
  });

  it("retorna 'Data a confirmar' quando iso é undefined", () => {
    expect(formatKickoffBr(undefined)).toBe("Data a confirmar");
  });

  it("retorna 'Data a confirmar' quando iso é string inválida (sem lançar)", () => {
    expect(formatKickoffBr("não-é-data")).toBe("Data a confirmar");
  });
});
