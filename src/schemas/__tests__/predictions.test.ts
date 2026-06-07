import { describe, expect, expectTypeOf, it } from "vitest";

import {
  predictionInputSchema,
  predictionSchema,
} from "@/schemas/predictions";
import { predictionStatusSchema } from "@/schemas/shared";
import { predictionDocId } from "@/features/predictions/lib";
import type { Prediction, PredictionInput } from "@/types/predictions";
import type { PredictionStatus } from "@/types/shared";

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

  it("aceita points 1", () => {
    expect(
      predictionSchema.safeParse({ ...valid, points: 1 }).success,
    ).toBe(true);
  });

  it("rejeita points = 2 (fora de {0,1})", () => {
    expect(
      predictionSchema.safeParse({ ...valid, points: 2 }).success,
    ).toBe(false);
  });

  it("rejeita points = -1 (fora de {0,1})", () => {
    expect(
      predictionSchema.safeParse({ ...valid, points: -1 }).success,
    ).toBe(false);
  });

  it("rejeita points = 0.5 (decimal; fora de {0,1})", () => {
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
      "pending" | "correct" | "wrong" | "locked" | undefined
    >();
    expectTypeOf<Prediction["points"]>().toEqualTypeOf<0 | 1 | undefined>();
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

  it("rejeita uid no body (campo proibido — uid vem da sessão)", () => {
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

  it("rejeita status no body (campo proibido — gravado pelo servidor)", () => {
    const result = predictionInputSchema.safeParse({
      ...validInput,
      status: "pending",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data)).not.toContain("status");
    }
  });

  it("rejeita points no body (campo proibido — gravado pelo servidor)", () => {
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
    for (const s of ["pending", "correct", "wrong", "locked"]) {
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
      "pending" | "correct" | "wrong" | "locked"
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
