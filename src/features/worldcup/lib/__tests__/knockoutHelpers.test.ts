import { describe, expect, it } from "vitest";

import type { KnockoutMatch } from "@/types/worldcup";

import { formatKickoffBr, getWinningSide } from "../knockoutHelpers";

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
// formatKickoffBr — data/hora pt-BR no fuso local.
// ---------------------------------------------------------------------------

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
