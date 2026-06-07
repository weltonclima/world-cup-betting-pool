/**
 * Testes da decisão pura `decideClaimSync` do trigger onUpdate (TASK-08).
 *
 * Cobre a lógica que decide se o custom claim deve ser ressincronizado a partir
 * dos valores de `role` antes/depois — sem subir o trigger nem o Admin SDK.
 *
 * Casos:
 * - U1: user → admin  → sincroniza com role "admin" (promoção).
 * - U2: admin → user  → sincroniza com role "user" (rebaixamento → claim null).
 * - U3: role inalterado (admin → admin) → no-op.
 * - U4: role inalterado (user → user)   → no-op.
 * - U5: doc deletado (after undefined)  → no-op (não toca o token).
 * - U6: novo role inválido/ausente      → no-op (defensivo).
 */

import { describe, it, expect } from "vitest";
import { decideClaimSync } from "../functions/syncRoleClaimOnUserUpdate";

describe("decideClaimSync", () => {
  it("U1: user → admin sincroniza com role admin", () => {
    expect(decideClaimSync("user", "admin")).toEqual({
      shouldSync: true,
      role: "admin",
    });
  });

  it("U2: admin → user sincroniza com role user (rebaixamento)", () => {
    expect(decideClaimSync("admin", "user")).toEqual({
      shouldSync: true,
      role: "user",
    });
  });

  it("U3: role inalterado (admin → admin) é no-op", () => {
    expect(decideClaimSync("admin", "admin")).toEqual({ shouldSync: false });
  });

  it("U4: role inalterado (user → user) é no-op", () => {
    expect(decideClaimSync("user", "user")).toEqual({ shouldSync: false });
  });

  it("U5: doc deletado (after undefined) é no-op", () => {
    expect(decideClaimSync("admin", undefined)).toEqual({ shouldSync: false });
  });

  it("U6: novo role inválido/ausente é no-op (defensivo)", () => {
    expect(decideClaimSync("user", "root")).toEqual({ shouldSync: false });
    expect(decideClaimSync("user", undefined)).toEqual({ shouldSync: false });
    expect(decideClaimSync("user", 42)).toEqual({ shouldSync: false });
  });
});
