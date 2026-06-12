import { describe, expect, expectTypeOf, it } from "vitest";

import {
  groupManualPredictionInputSchema,
  predictionInputSchema,
  predictionSchema,
} from "@/schemas/predictions";
import { predictionStatusSchema } from "@/schemas/shared";
import { predictionDocId } from "@/features/predictions/lib";
import type {
  GroupManualPredictionInput,
  Prediction,
  PredictionInput,
} from "@/types/predictions";
import type { PredictionStatus, Role } from "@/types/shared";

const valid = {
  uid: "abc123",
  matchId: "match-1",
  homeScore: 2,
  awayScore: 1,
} as const;

describe("predictions › predictionSchema (doc Firestore)", () => {
  it("faz parse de palpite válido", () => {
    expect(predictionSchema.safeParse(valid).success).toBe(true);
  });

  it("aceita placar 0 a 0", () => {
    expect(
      predictionSchema.safeParse({ ...valid, homeScore: 0, awayScore: 0 })
        .success,
    ).toBe(true);
  });

  it("rejeita placar negativo", () => {
    expect(
      predictionSchema.safeParse({ ...valid, homeScore: -1 }).success,
    ).toBe(false);
  });

  it("rejeita placar não inteiro", () => {
    expect(
      predictionSchema.safeParse({ ...valid, awayScore: 1.5 }).success,
    ).toBe(false);
  });

  it("rejeita uid vazio", () => {
    expect(predictionSchema.safeParse({ ...valid, uid: "" }).success).toBe(
      false,
    );
  });

  it("rejeita matchId ausente", () => {
    const { matchId: _matchId, ...sem } = valid;
    void _matchId;
    expect(predictionSchema.safeParse(sem).success).toBe(false);
  });

  it("rejeita campo extra (.strict)", () => {
    expect(
      predictionSchema.safeParse({ ...valid, extra: 1 }).success,
    ).toBe(false);
  });

  // ---- retrocompatibilidade: docs antigos sem status/points ----

  it("aceita doc sem status e sem points (retrocompatibilidade)", () => {
    // docs gravados antes de TASK-01 não têm esses campos — parse não deve lançar
    expect(predictionSchema.safeParse(valid).success).toBe(true);
  });

  // ---- status/points opcionais gravados pelo servidor ----

  it("aceita status 'pending'", () => {
    expect(
      predictionSchema.safeParse({ ...valid, status: "pending" }).success,
    ).toBe(true);
  });

  it("aceita status 'correct'", () => {
    expect(
      predictionSchema.safeParse({ ...valid, status: "correct" }).success,
    ).toBe(true);
  });

  it("aceita status 'partial' (acertou o vencedor, +5)", () => {
    expect(
      predictionSchema.safeParse({ ...valid, status: "partial" }).success,
    ).toBe(true);
  });

  it("aceita status 'wrong'", () => {
    expect(
      predictionSchema.safeParse({ ...valid, status: "wrong" }).success,
    ).toBe(true);
  });

  it("aceita status 'locked'", () => {
    expect(
      predictionSchema.safeParse({ ...valid, status: "locked" }).success,
    ).toBe(true);
  });

  it("rejeita status fora do enum", () => {
    expect(
      predictionSchema.safeParse({ ...valid, status: "unknown" }).success,
    ).toBe(false);
  });

  it("aceita points 0", () => {
    expect(
      predictionSchema.safeParse({ ...valid, points: 0 }).success,
    ).toBe(true);
  });

  it("aceita points 1 (legado binário — R1)", () => {
    expect(
      predictionSchema.safeParse({ ...valid, points: 1 }).success,
    ).toBe(true);
  });

  it("aceita points 5 (acertou o vencedor — ponderado)", () => {
    expect(
      predictionSchema.safeParse({ ...valid, points: 5 }).success,
    ).toBe(true);
  });

  it("aceita points 10 (placar exato — ponderado)", () => {
    expect(
      predictionSchema.safeParse({ ...valid, points: 10 }).success,
    ).toBe(true);
  });

  it("rejeita points = 2 (fora de {0,1,5,10})", () => {
    expect(
      predictionSchema.safeParse({ ...valid, points: 2 }).success,
    ).toBe(false);
  });

  it("rejeita points = 3 (fora de {0,1,5,10})", () => {
    expect(
      predictionSchema.safeParse({ ...valid, points: 3 }).success,
    ).toBe(false);
  });

  it("rejeita points = -1 (fora de {0,1,5,10})", () => {
    expect(
      predictionSchema.safeParse({ ...valid, points: -1 }).success,
    ).toBe(false);
  });

  it("rejeita points = 0.5 (decimal; fora de {0,1,5,10})", () => {
    expect(
      predictionSchema.safeParse({ ...valid, points: 0.5 }).success,
    ).toBe(false);
  });

  it("aceita doc completo: status + points juntos", () => {
    expect(
      predictionSchema.safeParse({ ...valid, status: "correct", points: 1 })
        .success,
    ).toBe(true);
  });

  // ---- combos semanticamente inconsistentes: validação cruzada é responsabilidade do Route Handler (TASK-04) ----

  it("aceita {status:'correct', points:0} — o schema não valida a coerência status/points (TASK-04)", () => {
    // O schema trata status e points como campos independentes e opcionais.
    // A regra "correct implica points:1" é uma invariante de negócio que deve ser
    // aplicada pelo Route Handler ao gravar o doc, não pelo schema de leitura.
    expect(
      predictionSchema.safeParse({ ...valid, status: "correct", points: 0 })
        .success,
    ).toBe(true);
  });

  it("aceita {status:'wrong', points:1} — o schema não valida a coerência status/points (TASK-04)", () => {
    // Idem: "wrong implica points:0" é regra do Route Handler, não do schema.
    expect(
      predictionSchema.safeParse({ ...valid, status: "wrong", points: 1 })
        .success,
    ).toBe(true);
  });

  it("rejeita campo extra mesmo com status/points presentes (.strict)", () => {
    expect(
      predictionSchema.safeParse({
        ...valid,
        status: "correct",
        points: 1,
        extra: "x",
      }).success,
    ).toBe(false);
  });

  it("inferência de tipo", () => {
    expectTypeOf<Prediction["homeScore"]>().toEqualTypeOf<number>();
    expectTypeOf<Prediction["uid"]>().toEqualTypeOf<string>();
    expectTypeOf<Prediction["status"]>().toEqualTypeOf<
      "pending" | "correct" | "partial" | "wrong" | "locked" | undefined
    >();
    expectTypeOf<Prediction["points"]>().toEqualTypeOf<
      0 | 1 | 5 | 10 | undefined
    >();
    expectTypeOf<Prediction["editedBy"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Prediction["editedByRole"]>().toEqualTypeOf<
      Role | undefined
    >();
    expectTypeOf<Prediction["editedAt"]>().toEqualTypeOf<string | undefined>();
  });
});

// ---------------------------------------------------------------------------
// TASK-01 (PRD-12): campos de origem manual no doc + .strict() não-descarte.
// ---------------------------------------------------------------------------
describe("predictions › predictionSchema (campos de origem manual)", () => {
  const origin = {
    editedBy: "admin-uid",
    editedByRole: "group_admin" as const,
    editedAt: "2026-06-12T15:00:00+00:00",
  };

  it("aceita doc com editedBy/editedByRole/editedAt válidos", () => {
    expect(
      predictionSchema.safeParse({ ...valid, ...origin }).success,
    ).toBe(true);
  });

  it("aceita doc SEM campos de origem (retrocompat — palpite normal)", () => {
    expect(predictionSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita editedByRole fora de roleSchema", () => {
    expect(
      predictionSchema.safeParse({ ...valid, ...origin, editedByRole: "boss" })
        .success,
    ).toBe(false);
  });

  it("rejeita editedBy vazio", () => {
    expect(
      predictionSchema.safeParse({ ...valid, ...origin, editedBy: "" }).success,
    ).toBe(false);
  });

  it("rejeita editedAt com formato inválido", () => {
    expect(
      predictionSchema.safeParse({ ...valid, ...origin, editedAt: "ontem" })
        .success,
    ).toBe(false);
  });

  it("round-trip não-descarte: doc completo que o endpoint grava passa em safeParse (.strict não rejeita)", () => {
    // Doc exatamente como TASK-02 vai gravar — se .strict() rejeitar, o recalc
    // descarta o palpite e ele some do ranking. Este teste é o guard-rail.
    const docGravado = {
      uid: "alvo-uid",
      matchId: "match-9",
      homeScore: 2,
      awayScore: 0,
      status: "correct" as const,
      points: 1 as const,
      editedBy: "admin-uid",
      editedByRole: "group_admin" as const,
      editedAt: "2026-06-12T15:00:00+00:00",
      createdAt: "2026-06-12T15:00:00+00:00",
      updatedAt: "2026-06-12T15:00:00+00:00",
    };
    expect(predictionSchema.safeParse(docGravado).success).toBe(true);
  });

  it(".strict() ainda rejeita campo extra não-declarado mesmo com campos de origem", () => {
    expect(
      predictionSchema.safeParse({ ...valid, ...origin, extra: "x" }).success,
    ).toBe(false);
  });
});

describe("predictions › groupManualPredictionInputSchema (body do admin de grupo)", () => {
  const validInput = {
    targetUid: "membro-uid",
    matchId: "match-1",
    homeScore: 2,
    awayScore: 1,
  } as const;

  it("aceita input válido", () => {
    expect(groupManualPredictionInputSchema.safeParse(validInput).success).toBe(
      true,
    );
  });

  it("aceita placar 0 a 0", () => {
    expect(
      groupManualPredictionInputSchema.safeParse({
        ...validInput,
        homeScore: 0,
        awayScore: 0,
      }).success,
    ).toBe(true);
  });

  it("rejeita targetUid ausente", () => {
    const { targetUid: _t, ...sem } = validInput;
    void _t;
    expect(groupManualPredictionInputSchema.safeParse(sem).success).toBe(false);
  });

  it("rejeita targetUid vazio", () => {
    expect(
      groupManualPredictionInputSchema.safeParse({ ...validInput, targetUid: "" })
        .success,
    ).toBe(false);
  });

  it("rejeita matchId ausente", () => {
    const { matchId: _m, ...sem } = validInput;
    void _m;
    expect(groupManualPredictionInputSchema.safeParse(sem).success).toBe(false);
  });

  it("rejeita placar negativo", () => {
    expect(
      groupManualPredictionInputSchema.safeParse({
        ...validInput,
        homeScore: -1,
      }).success,
    ).toBe(false);
  });

  it("rejeita placar não inteiro", () => {
    expect(
      groupManualPredictionInputSchema.safeParse({
        ...validInput,
        awayScore: 1.5,
      }).success,
    ).toBe(false);
  });

  it("inferência de tipo GroupManualPredictionInput", () => {
    expectTypeOf<GroupManualPredictionInput["targetUid"]>().toEqualTypeOf<string>();
    expectTypeOf<GroupManualPredictionInput["matchId"]>().toEqualTypeOf<string>();
    expectTypeOf<GroupManualPredictionInput["homeScore"]>().toEqualTypeOf<number>();
    expectTypeOf<GroupManualPredictionInput["awayScore"]>().toEqualTypeOf<number>();
  });
});

describe("predictions › predictionInputSchema (body do cliente)", () => {
  const validInput = {
    matchId: "match-1",
    homeScore: 2,
    awayScore: 1,
  } as const;

  it("aceita input válido com matchId/homeScore/awayScore", () => {
    expect(predictionInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("aceita placar 0 a 0", () => {
    expect(
      predictionInputSchema.safeParse({
        ...validInput,
        homeScore: 0,
        awayScore: 0,
      }).success,
    ).toBe(true);
  });

  it("remove uid do body (stripped, não rejeitado — uid vem da sessão)", () => {
    // predictionInputSchema não inclui uid; se passado, não deve ser incluído no output
    // (sem .strict() a validação passa, mas uid é stripped — garantir que uid NÃO está no schema)
    const result = predictionInputSchema.safeParse({
      ...validInput,
      uid: "abc123",
    });
    // O schema não usa .strict(), mas uid simplesmente não existe no shape — parse ok mas campo ignorado
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data)).not.toContain("uid");
    }
  });

  it("remove status do body (stripped, não rejeitado — gravado pelo servidor)", () => {
    const result = predictionInputSchema.safeParse({
      ...validInput,
      status: "pending",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data)).not.toContain("status");
    }
  });

  it("remove points do body (stripped, não rejeitado — gravado pelo servidor)", () => {
    const result = predictionInputSchema.safeParse({
      ...validInput,
      points: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data)).not.toContain("points");
    }
  });

  it("rejeita matchId ausente", () => {
    const { matchId: _matchId, ...sem } = validInput;
    void _matchId;
    expect(predictionInputSchema.safeParse(sem).success).toBe(false);
  });

  it("rejeita homeScore ausente", () => {
    const { homeScore: _homeScore, ...sem } = validInput;
    void _homeScore;
    expect(predictionInputSchema.safeParse(sem).success).toBe(false);
  });

  it("rejeita awayScore ausente", () => {
    const { awayScore: _awayScore, ...sem } = validInput;
    void _awayScore;
    expect(predictionInputSchema.safeParse(sem).success).toBe(false);
  });

  it("rejeita placar negativo", () => {
    expect(
      predictionInputSchema.safeParse({ ...validInput, homeScore: -1 }).success,
    ).toBe(false);
  });

  it("rejeita placar não inteiro", () => {
    expect(
      predictionInputSchema.safeParse({ ...validInput, awayScore: 2.5 })
        .success,
    ).toBe(false);
  });

  it("inferência de tipo PredictionInput", () => {
    expectTypeOf<PredictionInput["matchId"]>().toEqualTypeOf<string>();
    expectTypeOf<PredictionInput["homeScore"]>().toEqualTypeOf<number>();
    expectTypeOf<PredictionInput["awayScore"]>().toEqualTypeOf<number>();
  });
});

describe("predictions › predictionStatusSchema (enum)", () => {
  it("aceita todos os valores válidos do enum", () => {
    for (const s of ["pending", "correct", "partial", "wrong", "locked"]) {
      expect(predictionStatusSchema.safeParse(s).success).toBe(true);
    }
  });

  it("rejeita valor fora do enum", () => {
    expect(predictionStatusSchema.safeParse("scored").success).toBe(false);
    expect(predictionStatusSchema.safeParse("unknown").success).toBe(false);
    expect(predictionStatusSchema.safeParse("").success).toBe(false);
  });

  it("inferência de tipo PredictionStatus", () => {
    expectTypeOf<PredictionStatus>().toEqualTypeOf<
      "pending" | "correct" | "partial" | "wrong" | "locked"
    >();
  });
});

describe("predictions › predictionDocId (helper)", () => {
  it("retorna uid_matchId", () => {
    expect(predictionDocId("abc", "123")).toBe("abc_123");
  });

  it("retorna uid_matchId com valores reais", () => {
    expect(predictionDocId("user-42", "fixture-999")).toBe(
      "user-42_fixture-999",
    );
  });

  it("preserva separador _ quando uid ou matchId contém hifens", () => {
    expect(predictionDocId("u-1", "m-2")).toBe("u-1_m-2");
  });

  it("é determinístico: mesmos args → mesmo resultado", () => {
    const a = predictionDocId("x", "y");
    const b = predictionDocId("x", "y");
    expect(a).toBe(b);
  });

  it("retorna string", () => {
    expect(typeof predictionDocId("u", "m")).toBe("string");
  });
});
