import { describe, expect, expectTypeOf, it } from "vitest";

import {
  MAX_POOL_PHOTO_BASE64_LENGTH,
  poolEditSchema,
  poolInputSchema,
  poolSchema,
  poolStatusSchema,
} from "@/schemas/pools";
import type { Pool, PoolInput, PoolStatus } from "@/types/pools";

const valid = {
  id: "pool-abc",
  name: "Bolão dos Parças",
  slug: "bolao-dos-parcas",
  status: "active",
  adminId: "uid-123",
  createdAt: "2026-06-05T12:00:00Z",
} as const;

describe("pools › poolSchema", () => {
  it("faz parse de um pool válido completo (todos os campos)", () => {
    const result = poolSchema.safeParse({
      ...valid,
      description: "Bolão da galera do trabalho.",
      photoBase64: "data:image/jpeg;base64,/9j/abc",
    });
    expect(result.success).toBe(true);
  });

  it("faz parse com description/photoBase64 ausentes (opcionais)", () => {
    expect(poolSchema.safeParse(valid).success).toBe(true);
  });

  it("aceita slugs válidos (minúsculas/dígitos/hífen)", () => {
    for (const slug of ["bolao-dos-parcas", "pool-1", "abc123"]) {
      expect(poolSchema.safeParse({ ...valid, slug }).success).toBe(true);
    }
  });

  it("rejeita slugs inválidos (maiúscula/underscore/espaço/vazio)", () => {
    for (const slug of ["Bolao", "pool_1", "pool 1", ""]) {
      expect(poolSchema.safeParse({ ...valid, slug }).success).toBe(false);
    }
  });

  it("description: aceita 160 chars, rejeita 161", () => {
    expect(
      poolSchema.safeParse({ ...valid, description: "a".repeat(160) }).success,
    ).toBe(true);
    expect(
      poolSchema.safeParse({ ...valid, description: "a".repeat(161) }).success,
    ).toBe(false);
  });

  it("photoBase64: aceita dentro do limite, rejeita acima", () => {
    expect(
      poolSchema.safeParse({
        ...valid,
        photoBase64: "a".repeat(MAX_POOL_PHOTO_BASE64_LENGTH),
      }).success,
    ).toBe(true);
    expect(
      poolSchema.safeParse({
        ...valid,
        photoBase64: "a".repeat(MAX_POOL_PHOTO_BASE64_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it("status: aceita pending/active/blocked, rejeita inválidos", () => {
    for (const status of ["pending", "active", "blocked"]) {
      expect(poolSchema.safeParse({ ...valid, status }).success).toBe(true);
    }
    expect(poolSchema.safeParse({ ...valid, status: "deleted" }).success).toBe(
      false,
    );
    expect(poolSchema.safeParse({ ...valid, status: "" }).success).toBe(false);
  });

  it("rejeita nonEmptyString vazios (id/name/adminId)", () => {
    expect(poolSchema.safeParse({ ...valid, id: "" }).success).toBe(false);
    expect(poolSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
    expect(poolSchema.safeParse({ ...valid, adminId: "" }).success).toBe(false);
  });

  it("rejeita createdAt não-ISO", () => {
    expect(
      poolSchema.safeParse({ ...valid, createdAt: "não-é-data" }).success,
    ).toBe(false);
  });

  it("updatedAt: opcional, aceita ISO, rejeita não-ISO", () => {
    // Ausente (docs criados na TASK-04 nascem sem ele) → ok.
    expect(poolSchema.safeParse(valid).success).toBe(true);
    // Presente e ISO (auditoria de mutação server-side, TASK-05) → ok.
    expect(
      poolSchema.safeParse({ ...valid, updatedAt: "2026-06-06T09:30:00Z" })
        .success,
    ).toBe(true);
    // Presente e não-ISO → rejeita.
    expect(
      poolSchema.safeParse({ ...valid, updatedAt: "ontem" }).success,
    ).toBe(false);
  });

  it("rejeita campo extra (.strict)", () => {
    expect(poolSchema.safeParse({ ...valid, extra: "x" }).success).toBe(false);
  });

  it("strip() descarta campos extras e faz parse com sucesso (regressão TASK-01 — resolveInvite no Firestore)", () => {
    // Docs Firestore podem ter campos de versões anteriores; .strip() na leitura
    // garante que o parse não rejeita por campos desconhecidos.
    const result = poolSchema.strip().safeParse({ ...valid, campoLegado: "ignorar" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("campoLegado");
  });

  it("rejeita campo obrigatório ausente (status)", () => {
    const { status: _status, ...semStatus } = valid;
    void _status;
    expect(poolSchema.safeParse(semStatus).success).toBe(false);
  });

  it("predictionsLocked: ausente → parse ok (default-na-leitura = liberado)", () => {
    // Pools criados antes do feature de lock não têm o campo → backward-compat.
    expect(poolSchema.safeParse(valid).success).toBe(true);
  });

  it("predictionsLocked: aceita true e false, rejeita não-boolean", () => {
    expect(
      poolSchema.safeParse({ ...valid, predictionsLocked: true }).success,
    ).toBe(true);
    expect(
      poolSchema.safeParse({ ...valid, predictionsLocked: false }).success,
    ).toBe(true);
    expect(
      poolSchema.safeParse({ ...valid, predictionsLocked: "true" }).success,
    ).toBe(false);
  });
});

describe("pools › poolStatusSchema", () => {
  it("aceita os 3 status e rejeita fora do enum", () => {
    expect(poolStatusSchema.safeParse("pending").success).toBe(true);
    expect(poolStatusSchema.safeParse("active").success).toBe(true);
    expect(poolStatusSchema.safeParse("blocked").success).toBe(true);
    expect(poolStatusSchema.safeParse("archived").success).toBe(false);
  });
});

describe("pools › poolInputSchema", () => {
  it("aceita input de criação (sem id/status/createdAt)", () => {
    const result = poolInputSchema.safeParse({
      name: "Bolão Novo",
      slug: "bolao-novo",
      adminId: "uid-999",
    });
    expect(result.success).toBe(true);
  });

  it("aplica as mesmas validações de slug no input", () => {
    expect(
      poolInputSchema.safeParse({
        name: "X",
        slug: "Inválido",
        adminId: "uid-1",
      }).success,
    ).toBe(false);
  });

  it("não é strict: ignora campos server-set (id/status/createdAt) em vez de rejeitar", () => {
    const result = poolInputSchema.safeParse({
      name: "Bolão Novo",
      slug: "bolao-novo",
      adminId: "uid-999",
      id: "deveria-ser-ignorado",
      status: "active",
      createdAt: "2026-06-05T12:00:00Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("id");
      expect(result.data).not.toHaveProperty("status");
      expect(result.data).not.toHaveProperty("createdAt");
    }
  });
});

describe("pools › poolEditSchema", () => {
  it("aceita patch só com predictionsLocked (true/false)", () => {
    expect(poolEditSchema.safeParse({ predictionsLocked: true }).success).toBe(
      true,
    );
    expect(poolEditSchema.safeParse({ predictionsLocked: false }).success).toBe(
      true,
    );
  });

  it("rejeita predictionsLocked não-boolean", () => {
    expect(
      poolEditSchema.safeParse({ predictionsLocked: "sim" }).success,
    ).toBe(false);
  });

  it("rejeita patch vazio (refine — ao menos um campo)", () => {
    expect(poolEditSchema.safeParse({}).success).toBe(false);
  });
});

describe("pools › inferência de tipos", () => {
  it("tipos derivados batem com os schemas", () => {
    expectTypeOf<PoolStatus>().toEqualTypeOf<"pending" | "active" | "blocked">();
    expectTypeOf<Pool["description"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Pool["photoBase64"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Pool["status"]>().toEqualTypeOf<PoolStatus>();
    expectTypeOf<Pool["predictionsLocked"]>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<PoolInput["name"]>().toEqualTypeOf<string>();
  });
});
