import { describe, expect, expectTypeOf, it } from "vitest";

import {
  bracketResponseSchema,
  groupStandingSchema,
  groupsResponseSchema,
  knockoutMatchSchema,
} from "@/schemas/worldcup";
import type {
  BracketResponse,
  GroupStanding,
  KnockoutMatch,
} from "@/types/worldcup";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const validTeam = {
  id: "bra",
  name: "Brasil",
  code: "BRA",
} as const;

const validStanding = {
  position: 1,
  team: validTeam,
  played: 3,
  wins: 2,
  draws: 1,
  losses: 0,
  goalsFor: 5,
  goalsAgainst: 2,
  goalDifference: 3,
  points: 7,
  qualification: "classificado",
} as const;

// Partida "aguardando": pelo menos um lado é placeholder (defined:false)
const matchAguardando = {
  id: "jogo-74",
  phase: "oitavas",
  homeTeam: { name: "Vencedor Jogo 74", defined: false },
  awayTeam: { name: "Vencedor Jogo 75", defined: false },
  status: "aguardando",
} as const;

// Partida "definido": ambos os lados conhecidos, sem placar
const matchDefinido = {
  id: "jogo-74",
  phase: "oitavas",
  homeTeam: { name: "Brasil", code: "BRA", defined: true },
  awayTeam: { name: "Argentina", code: "ARG", defined: true },
  status: "definido",
} as const;

// Partida "em-andamento" (ao vivo): ambos definidos + placar parcial presente
const matchAoVivo = {
  id: "jogo-74",
  phase: "semifinal",
  homeTeam: { name: "Brasil", code: "BRA", defined: true },
  awayTeam: { name: "Argentina", code: "ARG", defined: true },
  homeScore: 1,
  awayScore: 1,
  status: "em-andamento",
} as const;

// Partida "encerrado": ambos definidos + ambos placares presentes
const matchEncerrado = {
  id: "jogo-74",
  phase: "final",
  homeTeam: { name: "Brasil", code: "BRA", defined: true },
  awayTeam: { name: "Argentina", code: "ARG", defined: true },
  homeScore: 1,
  awayScore: 0,
  status: "encerrado",
} as const;

// ─── groupStandingSchema ─────────────────────────────────────────────────────

describe("groupStandingSchema", () => {
  it("faz parse de standing válido (completo)", () => {
    expect(groupStandingSchema.safeParse(validStanding).success).toBe(true);
  });

  it("aceita goalDifference negativo", () => {
    expect(
      groupStandingSchema.safeParse({ ...validStanding, goalDifference: -3 })
        .success,
    ).toBe(true);
  });

  it("rejeita position 0 (mínimo é 1)", () => {
    expect(
      groupStandingSchema.safeParse({ ...validStanding, position: 0 }).success,
    ).toBe(false);
  });

  it("rejeita wins negativo", () => {
    expect(
      groupStandingSchema.safeParse({ ...validStanding, wins: -1 }).success,
    ).toBe(false);
  });

  it("rejeita losses negativo", () => {
    expect(
      groupStandingSchema.safeParse({ ...validStanding, losses: -1 }).success,
    ).toBe(false);
  });

  it("rejeita goalsFor negativo", () => {
    expect(
      groupStandingSchema.safeParse({ ...validStanding, goalsFor: -1 }).success,
    ).toBe(false);
  });

  it("rejeita qualification inválida", () => {
    expect(
      groupStandingSchema.safeParse({
        ...validStanding,
        qualification: "talvez",
      }).success,
    ).toBe(false);
  });

  it("rejeita campo extra (.strict)", () => {
    expect(
      groupStandingSchema.safeParse({ ...validStanding, extra: 1 }).success,
    ).toBe(false);
  });

  it("inferência de tipo: qualification e goalDifference", () => {
    expectTypeOf<GroupStanding["qualification"]>().toEqualTypeOf<
      "classificado" | "possivel" | "eliminado" | "indefinido"
    >();
    expectTypeOf<GroupStanding["goalDifference"]>().toEqualTypeOf<number>();
  });
});

// ─── knockoutMatchSchema ─────────────────────────────────────────────────────

describe("knockoutMatchSchema", () => {
  // Status: aguardando
  it("faz parse de partida aguardando (ambos os lados placeholder)", () => {
    expect(knockoutMatchSchema.safeParse(matchAguardando).success).toBe(true);
  });

  it("faz parse de partida aguardando (apenas um lado placeholder)", () => {
    expect(
      knockoutMatchSchema.safeParse({
        ...matchAguardando,
        awayTeam: { name: "Argentina", code: "ARG", defined: true },
      }).success,
    ).toBe(true);
  });

  // Status: definido
  it("faz parse de partida definida (ambos os lados definidos, sem placar)", () => {
    expect(knockoutMatchSchema.safeParse(matchDefinido).success).toBe(true);
  });

  // Status: em-andamento (ao vivo)
  it("faz parse de partida em-andamento (ambos definidos + placar parcial)", () => {
    expect(knockoutMatchSchema.safeParse(matchAoVivo).success).toBe(true);
  });

  it("aceita em-andamento com placar 0 x 0 (início do jogo)", () => {
    expect(
      knockoutMatchSchema.safeParse({
        ...matchAoVivo,
        homeScore: 0,
        awayScore: 0,
      }).success,
    ).toBe(true);
  });

  it("rejeita em-andamento sem placares (ambos ausentes)", () => {
    expect(
      knockoutMatchSchema.safeParse({
        ...matchAoVivo,
        homeScore: undefined,
        awayScore: undefined,
      }).success,
    ).toBe(false);
  });

  it("rejeita em-andamento com apenas um placar", () => {
    expect(
      knockoutMatchSchema.safeParse({
        ...matchAoVivo,
        awayScore: undefined,
      }).success,
    ).toBe(false);
  });

  it("rejeita em-andamento com lado defined:false (exige ambos definidos)", () => {
    expect(
      knockoutMatchSchema.safeParse({
        ...matchAoVivo,
        homeTeam: { name: "Vencedor Jogo 60", defined: false },
      }).success,
    ).toBe(false);
  });

  // Status: encerrado
  it("faz parse de partida encerrada (ambos os lados definidos + ambos placares)", () => {
    expect(knockoutMatchSchema.safeParse(matchEncerrado).success).toBe(true);
  });

  // Rejeições: placares em aguardando / definido
  it("rejeita placar em partida aguardando", () => {
    expect(
      knockoutMatchSchema.safeParse({
        ...matchAguardando,
        homeScore: 1,
        awayScore: 0,
      }).success,
    ).toBe(false);
  });

  it("rejeita placar em partida definida", () => {
    expect(
      knockoutMatchSchema.safeParse({
        ...matchDefinido,
        homeScore: 1,
        awayScore: 0,
      }).success,
    ).toBe(false);
  });

  // Rejeições: encerrado sem placar completo
  it("rejeita encerrado sem homeScore", () => {
    expect(
      knockoutMatchSchema.safeParse({
        ...matchEncerrado,
        homeScore: undefined,
      }).success,
    ).toBe(false);
  });

  it("rejeita encerrado sem awayScore", () => {
    expect(
      knockoutMatchSchema.safeParse({
        ...matchEncerrado,
        awayScore: undefined,
      }).success,
    ).toBe(false);
  });

  // Rejeições: aguardando com ambos os lados defined:true
  it("rejeita aguardando com ambos os lados defined:true", () => {
    expect(
      knockoutMatchSchema.safeParse({
        ...matchAguardando,
        homeTeam: { name: "Brasil", code: "BRA", defined: true },
        awayTeam: { name: "Argentina", code: "ARG", defined: true },
      }).success,
    ).toBe(false);
  });

  // Rejeições: lado defined:false com status "definido"
  it("rejeita lado defined:false com status definido", () => {
    expect(
      knockoutMatchSchema.safeParse({
        ...matchDefinido,
        homeTeam: { name: "Vencedor Jogo 74", defined: false },
      }).success,
    ).toBe(false);
  });

  it("rejeita campo extra no schema raiz (.strict)", () => {
    expect(
      knockoutMatchSchema.safeParse({ ...matchDefinido, extra: 1 }).success,
    ).toBe(false);
  });

  // kickoffAt e venue — novos campos opcionais (TASK-01)
  it("aceita kickoffAt quando presente (ISO string)", () => {
    expect(
      knockoutMatchSchema.safeParse({
        ...matchDefinido,
        kickoffAt: "2026-07-01T20:00:00-03:00",
      }).success,
    ).toBe(true);
  });

  it("aceita partida sem kickoffAt — backward compat com snapshots stale", () => {
    // matchDefinido não tem kickoffAt; deve continuar parseando após a mudança.
    expect(knockoutMatchSchema.safeParse(matchDefinido).success).toBe(true);
  });

  it("aceita venue válido quando presente", () => {
    expect(
      knockoutMatchSchema.safeParse({
        ...matchDefinido,
        venue: { name: "MetLife Stadium", city: "Nova Jersey" },
      }).success,
    ).toBe(true);
  });

  it("aceita partida sem venue — campo optional", () => {
    expect(knockoutMatchSchema.safeParse(matchDefinido).success).toBe(true);
  });

  it("rejeita venue com campo extra (.strict no knockoutVenueSchema)", () => {
    expect(
      knockoutMatchSchema.safeParse({
        ...matchDefinido,
        venue: { name: "MetLife Stadium", city: "Nova Jersey", country: "USA" },
      }).success,
    ).toBe(false);
  });

  it("rejeita venue sem city (campo obrigatório)", () => {
    expect(
      knockoutMatchSchema.safeParse({
        ...matchDefinido,
        venue: { name: "MetLife Stadium" },
      }).success,
    ).toBe(false);
  });

  it("inferência de tipo: status e phase", () => {
    expectTypeOf<KnockoutMatch["status"]>().toEqualTypeOf<
      "aguardando" | "definido" | "em-andamento" | "encerrado"
    >();
    expectTypeOf<KnockoutMatch["phase"]>().toEqualTypeOf<
      | "dezesseis-avos"
      | "oitavas"
      | "quartas"
      | "semifinal"
      | "terceiro"
      | "final"
    >();
  });

  it("inferência de tipo: kickoffAt é string opcional e venue é objeto opcional", () => {
    expectTypeOf<KnockoutMatch["kickoffAt"]>().toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf<KnockoutMatch["venue"]>().toEqualTypeOf<
      { name: string; city: string } | undefined
    >();
  });
});

// ─── groupsResponseSchema ────────────────────────────────────────────────────

describe("groupsResponseSchema", () => {
  it("faz parse de resposta mínima válida (array vazio)", () => {
    expect(
      groupsResponseSchema.safeParse({
        groups: [],
        hasLiveGroupMatch: false,
      }).success,
    ).toBe(true);
  });

  it("faz parse com um grupo completo", () => {
    expect(
      groupsResponseSchema.safeParse({
        groups: [{ groupId: "A", standings: [validStanding] }],
        hasLiveGroupMatch: true,
      }).success,
    ).toBe(true);
  });
});

// ─── bracketResponseSchema ───────────────────────────────────────────────────

describe("bracketResponseSchema", () => {
  const emptyBracket = {
    roundOf32: [],
    roundOf16: [],
    quarterFinals: [],
    semiFinals: [],
    thirdPlace: [],
    final: [],
  };

  it("faz parse de bracket mínimo válido (todos arrays vazios)", () => {
    expect(bracketResponseSchema.safeParse(emptyBracket).success).toBe(true);
  });

  it("faz parse com partidas reais em cada fase", () => {
    expect(
      bracketResponseSchema.safeParse({
        ...emptyBracket,
        roundOf32: [{ ...matchAguardando, phase: "dezesseis-avos" }],
        roundOf16: [{ ...matchAguardando, phase: "oitavas" }],
        quarterFinals: [{ ...matchDefinido, phase: "quartas" }],
        semiFinals: [{ ...matchDefinido, phase: "semifinal" }],
        thirdPlace: [{ ...matchEncerrado, phase: "terceiro" }],
        final: [{ ...matchEncerrado, phase: "final" }],
      }).success,
    ).toBe(true);
  });

  it("rejeita bracket com campo extra (.strict)", () => {
    expect(
      bracketResponseSchema.safeParse({ ...emptyBracket, extraRound: [] })
        .success,
    ).toBe(false);
  });

  it("inferência de tipo: BracketResponse.final é array de KnockoutMatch", () => {
    expectTypeOf<BracketResponse["final"]>().toEqualTypeOf<KnockoutMatch[]>();
  });
});
