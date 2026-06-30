import { describe, expect, expectTypeOf, it } from "vitest";

import { matchSchema } from "@/schemas/matches";
import type { Match } from "@/types/matches";

const scheduled = {
  homeTeamId: "bra",
  awayTeamId: "arg",
  kickoffAt: "2026-06-11T20:00:00Z",
  stage: "grupos",
  groupId: "A",
  status: "scheduled",
  homeScore: null,
  awayScore: null,
} as const;

const finished = {
  homeTeamId: "bra",
  awayTeamId: "arg",
  kickoffAt: "2026-06-11T20:00:00Z",
  stage: "grupos",
  groupId: "A",
  status: "finished",
  homeScore: 2,
  awayScore: 1,
} as const;

describe("matches", () => {
  it("faz parse de partida agendada (placares null)", () => {
    expect(matchSchema.safeParse(scheduled).success).toBe(true);
  });

  it("faz parse de partida finalizada (placares inteiros ≥ 0)", () => {
    expect(matchSchema.safeParse(finished).success).toBe(true);
  });

  it("aceita groupId null no mata-mata", () => {
    expect(
      matchSchema.safeParse({
        ...scheduled,
        stage: "final",
        groupId: null,
      }).success,
    ).toBe(true);
  });

  it("rejeita stage fora do enum", () => {
    expect(
      matchSchema.safeParse({ ...scheduled, stage: "terceiro_lugar" }).success,
    ).toBe(false);
  });

  it("rejeita status fora do enum", () => {
    expect(
      matchSchema.safeParse({ ...scheduled, status: "paused" }).success,
    ).toBe(false);
  });

  it("rejeita kickoffAt não-ISO", () => {
    expect(
      matchSchema.safeParse({ ...scheduled, kickoffAt: "ontem" }).success,
    ).toBe(false);
  });

  it("rejeita placar negativo quando finalizado", () => {
    expect(
      matchSchema.safeParse({ ...finished, homeScore: -1 }).success,
    ).toBe(false);
  });

  it("rejeita placar não inteiro quando finalizado", () => {
    expect(
      matchSchema.safeParse({ ...finished, homeScore: 1.5 }).success,
    ).toBe(false);
  });

  it("refinement: finished com homeScore null é rejeitado", () => {
    expect(
      matchSchema.safeParse({ ...finished, homeScore: null }).success,
    ).toBe(false);
  });

  it("refinement: finished sem ambos os placares é rejeitado", () => {
    expect(
      matchSchema.safeParse({
        ...finished,
        homeScore: null,
        awayScore: null,
      }).success,
    ).toBe(false);
  });

  it("refinement: scheduled com placar preenchido é rejeitado", () => {
    expect(
      matchSchema.safeParse({ ...scheduled, homeScore: 2, awayScore: 0 })
        .success,
    ).toBe(false);
  });

  it("refinement: live com ambos os placares preenchidos é válido (placar parcial real)", () => {
    expect(
      matchSchema.safeParse({
        ...scheduled,
        status: "live",
        homeScore: 1,
        awayScore: 0,
      }).success,
    ).toBe(true);
  });

  it("refinement: live com ambos null é válido (início do tempo)", () => {
    expect(
      matchSchema.safeParse({
        ...scheduled,
        status: "live",
        homeScore: null,
        awayScore: null,
      }).success,
    ).toBe(true);
  });

  it("refinement: live com placar assimétrico é rejeitado", () => {
    expect(
      matchSchema.safeParse({
        ...scheduled,
        status: "live",
        homeScore: 1,
        awayScore: null,
      }).success,
    ).toBe(false);
  });

  it("refinement: postponed com placares preenchidos é rejeitado", () => {
    expect(
      matchSchema.safeParse({
        ...scheduled,
        status: "postponed",
        homeScore: 1,
        awayScore: 0,
      }).success,
    ).toBe(false);
  });

  it("refinement: canceled com placares preenchidos é rejeitado", () => {
    expect(
      matchSchema.safeParse({
        ...scheduled,
        status: "canceled",
        homeScore: 1,
        awayScore: 0,
      }).success,
    ).toBe(false);
  });

  it("rejeita campo extra (.strict)", () => {
    expect(
      matchSchema.safeParse({ ...scheduled, extra: 1 }).success,
    ).toBe(false);
  });

  it("inferência de tipo", () => {
    expectTypeOf<Match["stage"]>().toEqualTypeOf<
      "grupos" | "dezesseis-avos" | "oitavas" | "quartas" | "semifinal" | "terceiro" | "final"
    >();
    expectTypeOf<Match["homeScore"]>().toEqualTypeOf<number | null>();
    expectTypeOf<Match["round"]>().toEqualTypeOf<number | null | undefined>();
    expectTypeOf<Match["venue"]>().toEqualTypeOf<
      { name: string; city: string } | null | undefined
    >();
  });

  it("aceita venue presente (name + city)", () => {
    expect(
      matchSchema.safeParse({
        ...scheduled,
        venue: { name: "Estádio Nacional", city: "Brasília" },
      }).success,
    ).toBe(true);
  });

  it("aceita venue null (TBD)", () => {
    expect(
      matchSchema.safeParse({ ...scheduled, venue: null }).success,
    ).toBe(true);
  });

  it("aceita venue ausente (campo omitido)", () => {
    // scheduled já não tem venue → passa pelo optional
    expect(matchSchema.safeParse(scheduled).success).toBe(true);
  });

  it("rejeita venue com name vazio", () => {
    expect(
      matchSchema.safeParse({
        ...scheduled,
        venue: { name: "", city: "São Paulo" },
      }).success,
    ).toBe(false);
  });

  it("rejeita venue com city vazio", () => {
    expect(
      matchSchema.safeParse({
        ...scheduled,
        venue: { name: "Maracanã", city: "" },
      }).success,
    ).toBe(false);
  });

  it("rejeita venue com campo extra (.strict interno)", () => {
    expect(
      matchSchema.safeParse({
        ...scheduled,
        venue: { name: "Maracanã", city: "Rio de Janeiro", country: "Brasil" },
      }).success,
    ).toBe(false);
  });

  it("aceita round presente (inteiro ≥ 1)", () => {
    expect(
      matchSchema.safeParse({ ...scheduled, round: 2 }).success,
    ).toBe(true);
  });

  it("aceita round null (fase sem número, ex.: Final)", () => {
    expect(
      matchSchema.safeParse({ ...finished, stage: "final", round: null }).success,
    ).toBe(true);
  });

  it("aceita round ausente (campo omitido)", () => {
    // scheduled já não tem round → passa pelo optional
    expect(matchSchema.safeParse(scheduled).success).toBe(true);
  });

  it("rejeita round 0 (< 1)", () => {
    expect(
      matchSchema.safeParse({ ...scheduled, round: 0 }).success,
    ).toBe(false);
  });

  it("rejeita round fracionário", () => {
    expect(
      matchSchema.safeParse({ ...scheduled, round: 1.5 }).success,
    ).toBe(false);
  });

  it("aceita stage 'terceiro' (disputa 3º lugar)", () => {
    expect(
      matchSchema.safeParse({
        ...finished,
        stage: "terceiro",
        groupId: null,
      }).success,
    ).toBe(true);
  });
});

// ─── TASK-02: campos de linkagem/desempate do mata-mata ──────────────────────

const koFinished = {
  homeTeamId: "bra",
  awayTeamId: "arg",
  kickoffAt: "2026-07-10T20:00:00Z",
  stage: "oitavas",
  groupId: null,
  status: "finished",
  homeScore: 1,
  awayScore: 1,
} as const;

describe("matches — TASK-02 bracketSlot / placeholderLabel (por-lado)", () => {
  it("aceita homeBracketSlot + awayBracketSlot (ambos placeholder)", () => {
    expect(
      matchSchema.safeParse({
        ...koFinished,
        homeBracketSlot: { round: "round-of-32", game: 3 },
        awayBracketSlot: { round: "round-of-32", game: 4 },
      }).success,
    ).toBe(true);
  });

  it("aceita homePlaceholderLabel + awayPlaceholderLabel", () => {
    expect(
      matchSchema.safeParse({
        ...koFinished,
        homePlaceholderLabel: "Vencedor R32 jogo 3",
        awayPlaceholderLabel: "Vencedor R32 jogo 4",
      }).success,
    ).toBe(true);
  });

  it("aceita apenas um lado placeholder (home resolvido, away slot)", () => {
    expect(
      matchSchema.safeParse({
        ...koFinished,
        awayBracketSlot: { round: "round-of-16", game: 2 },
        awayPlaceholderLabel: "Vencedor R16 jogo 2",
      }).success,
    ).toBe(true);
  });

  it("rejeita homeBracketSlot.game 0 (< 1)", () => {
    expect(
      matchSchema.safeParse({
        ...koFinished,
        homeBracketSlot: { round: "round-of-32", game: 0 },
      }).success,
    ).toBe(false);
  });

  it("rejeita homeBracketSlot sem round", () => {
    expect(
      matchSchema.safeParse({
        ...koFinished,
        homeBracketSlot: { game: 3 },
      }).success,
    ).toBe(false);
  });
});

describe("matches — TASK-02 advanceSide", () => {
  it("aceita advanceSide 'home'", () => {
    expect(
      matchSchema.safeParse({ ...koFinished, advanceSide: "home" }).success,
    ).toBe(true);
  });

  it("aceita advanceSide null", () => {
    expect(
      matchSchema.safeParse({ ...koFinished, advanceSide: null }).success,
    ).toBe(true);
  });

  it("rejeita advanceSide fora do enum", () => {
    expect(
      matchSchema.safeParse({ ...koFinished, advanceSide: "draw" }).success,
    ).toBe(false);
  });
});

describe("matches — TASK-02 outcome", () => {
  it("aceita outcome 'normal'", () => {
    expect(
      matchSchema.safeParse({ ...koFinished, outcome: "normal" }).success,
    ).toBe(true);
  });

  it("aceita outcome 'overtime'", () => {
    expect(
      matchSchema.safeParse({ ...koFinished, outcome: "overtime" }).success,
    ).toBe(true);
  });

  it("rejeita outcome fora do enum", () => {
    expect(
      matchSchema.safeParse({ ...koFinished, outcome: "shootout" }).success,
    ).toBe(false);
  });
});

describe("matches — TASK-02 invariante de pênaltis", () => {
  it("outcome 'penalties' com ambos shootout inteiros é válido", () => {
    expect(
      matchSchema.safeParse({
        ...koFinished,
        outcome: "penalties",
        homeShootout: 4,
        awayShootout: 3,
      }).success,
    ).toBe(true);
  });

  it("outcome 'penalties' sem homeShootout é rejeitado", () => {
    expect(
      matchSchema.safeParse({
        ...koFinished,
        outcome: "penalties",
        homeShootout: null,
        awayShootout: 3,
      }).success,
    ).toBe(false);
  });

  it("outcome 'penalties' sem nenhum shootout é rejeitado", () => {
    expect(
      matchSchema.safeParse({
        ...koFinished,
        outcome: "penalties",
      }).success,
    ).toBe(false);
  });

  it("outcome 'normal' com shootout preenchido é rejeitado", () => {
    expect(
      matchSchema.safeParse({
        ...koFinished,
        outcome: "normal",
        homeShootout: 4,
        awayShootout: 3,
      }).success,
    ).toBe(false);
  });

  it("outcome ausente com shootout preenchido é rejeitado", () => {
    expect(
      matchSchema.safeParse({
        ...koFinished,
        homeShootout: 4,
        awayShootout: 3,
      }).success,
    ).toBe(false);
  });

  it("aceita homeShootout/awayShootout null com outcome 'normal'", () => {
    expect(
      matchSchema.safeParse({
        ...koFinished,
        outcome: "normal",
        homeShootout: null,
        awayShootout: null,
      }).success,
    ).toBe(true);
  });

  it("rejeita shootout negativo em outcome 'penalties'", () => {
    expect(
      matchSchema.safeParse({
        ...koFinished,
        outcome: "penalties",
        homeShootout: -1,
        awayShootout: 3,
      }).success,
    ).toBe(false);
  });

  it("regressão grupo: match sem campos novos continua válido", () => {
    expect(matchSchema.safeParse(scheduled).success).toBe(true);
    expect(matchSchema.safeParse(finished).success).toBe(true);
  });
});
