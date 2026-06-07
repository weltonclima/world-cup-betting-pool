/**
 * Testes de `syncRoleClaim` (TASK-08).
 *
 * Mocka `firebase-admin/auth` (getAuth().setCustomUserClaims) e
 * `../firebase/admin` (evita inicializar o Admin SDK real no import).
 *
 * Casos:
 * - S1: role "admin" → setCustomUserClaims(uid, { role: "admin" }).
 * - S2: role "user"  → setCustomUserClaims(uid, { role: null }) (remove privilégio).
 * - S3: erro de I/O do Auth propaga (chamador decide logar/retentar).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Evita efeito colateral de inicialização do Admin SDK ao importar o módulo.
vi.mock("../firebase/admin", () => ({ adminApp: {} }));

const setCustomUserClaims = vi.fn();
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ setCustomUserClaims }),
}));

import { syncRoleClaim } from "../functions/syncRoleClaim";

const UID = "user-xyz-1";

describe("syncRoleClaim", () => {
  beforeEach(() => {
    setCustomUserClaims.mockReset();
    setCustomUserClaims.mockResolvedValue(undefined);
  });

  it('S1: role "admin" grava { role: "admin" }', async () => {
    await syncRoleClaim(UID, "admin");

    expect(setCustomUserClaims).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, { role: "admin" });
  });

  it('S2: role "user" grava { role: null } (remove privilégio admin)', async () => {
    await syncRoleClaim(UID, "user");

    expect(setCustomUserClaims).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, { role: null });
  });

  it("S3: erro de I/O do Auth propaga", async () => {
    setCustomUserClaims.mockRejectedValueOnce(new Error("auth/internal"));

    await expect(syncRoleClaim(UID, "admin")).rejects.toThrow("auth/internal");
  });
});
