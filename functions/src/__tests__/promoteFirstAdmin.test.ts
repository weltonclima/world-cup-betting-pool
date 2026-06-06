/**
 * Testes da lógica de promoção do primeiro admin (AUTH TASK-05).
 *
 * Testa o núcleo transacional `promoteFirstAdminTx` com uma Transaction
 * e um Firestore mockados — sem subir emulador nem inicializar o Admin SDK real.
 *
 * Casos:
 * - T1: primeiro usuário → promovido a admin/approved + flag setada (ambos via merge-set).
 * - T2: segundo usuário (flag já true) → não modificado.
 * - T3: idempotência/reentrância → no-op em reexecuções com flag true.
 * - T4: updatedAt gravado é uma ISO string válida.
 * - T5: a promoção usa merge-set (tolera doc ausente; nunca chama update).
 */

import { describe, it, expect, vi } from "vitest";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { promoteFirstAdminTx } from "../functions/promoteFirstAdmin";

/** Ref opaca usada só para identidade (qual doc está sendo lido/escrito). */
interface FakeRef {
  readonly path: string;
}

/** Snapshot mínimo retornado por tx.get(). */
interface FakeSnap {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

/**
 * Constrói um Firestore fake que resolve `doc("a/b")` para refs estáveis,
 * permitindo asserir em qual ref o tx escreveu.
 */
function makeFakeDb(): { db: Firestore; refs: Map<string, FakeRef> } {
  const refs = new Map<string, FakeRef>();
  const docFn = vi.fn((path: string): FakeRef => {
    const existing = refs.get(path);
    if (existing) return existing;
    const ref: FakeRef = { path };
    refs.set(path, ref);
    return ref;
  });
  const db = { doc: docFn } as unknown as Firestore;
  return { db, refs };
}

/**
 * Constrói uma Transaction fake. `bootstrapData` define o estado da flag.
 * Espiona get/set/update.
 */
function makeFakeTx(bootstrapData: Record<string, unknown> | undefined): {
  tx: Transaction;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
} {
  const get = vi.fn((ref: FakeRef): Promise<FakeSnap> => {
    if (ref.path === "system_settings/bootstrap") {
      return Promise.resolve({
        exists: bootstrapData !== undefined,
        data: () => bootstrapData,
      });
    }
    return Promise.resolve({ exists: false, data: () => undefined });
  });
  const set = vi.fn();
  const update = vi.fn();

  const tx = { get, set, update } as unknown as Transaction;
  return { tx, get, set, update };
}

const USER_UID = "user-abc-123";
const BOOTSTRAP_PATH = "system_settings/bootstrap";
const USER_PATH = `users/${USER_UID}`;

/** Localiza a chamada de `set` cujo ref aponta para `path`. */
function findSetCall(
  set: ReturnType<typeof vi.fn>,
  path: string,
): [FakeRef, Record<string, unknown>, { merge: boolean } | undefined] {
  const call = set.mock.calls.find(
    (args) => (args[0] as FakeRef).path === path,
  );
  if (!call) throw new Error(`Nenhum set() encontrado para ${path}`);
  return call as [
    FakeRef,
    Record<string, unknown>,
    { merge: boolean } | undefined,
  ];
}

describe("promoteFirstAdminTx", () => {
  it("T1: primeiro usuário é promovido a admin/approved e marca a flag", async () => {
    const { db } = makeFakeDb();
    const { tx, set, update } = makeFakeTx(undefined); // bootstrap inexistente

    const result = await promoteFirstAdminTx(tx, db, USER_UID);

    expect(result.promoted).toBe(true);

    // Dois writes: flag + usuário, ambos via set; nenhum update.
    expect(set).toHaveBeenCalledTimes(2);
    expect(update).not.toHaveBeenCalled();

    // Flag setada com merge
    const [, flagData, flagOpts] = findSetCall(set, BOOTSTRAP_PATH);
    expect(flagData).toMatchObject({ firstAdminAssigned: true });
    expect(flagOpts).toEqual({ merge: true });

    // Usuário promovido via merge-set
    const [, userData, userOpts] = findSetCall(set, USER_PATH);
    expect(userData).toMatchObject({ role: "admin", status: "approved" });
    expect(userData).toHaveProperty("updatedAt");
    expect(userOpts).toEqual({ merge: true });
  });

  it("T2: segundo usuário (flag já true) não é modificado", async () => {
    const { db } = makeFakeDb();
    const { tx, set, update } = makeFakeTx({ firstAdminAssigned: true });

    const result = await promoteFirstAdminTx(tx, db, USER_UID);

    expect(result.promoted).toBe(false);
    expect(set).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("T3: idempotência — reexecuções com flag true são sempre no-op", async () => {
    const { db } = makeFakeDb();

    const first = makeFakeTx({ firstAdminAssigned: true });
    const r1 = await promoteFirstAdminTx(first.tx, db, USER_UID);

    const second = makeFakeTx({ firstAdminAssigned: true });
    const r2 = await promoteFirstAdminTx(second.tx, db, "outro-uid");

    expect(r1.promoted).toBe(false);
    expect(r2.promoted).toBe(false);
    expect(first.set).not.toHaveBeenCalled();
    expect(first.update).not.toHaveBeenCalled();
    expect(second.set).not.toHaveBeenCalled();
    expect(second.update).not.toHaveBeenCalled();
  });

  it("T4: updatedAt gravado é uma ISO string válida", async () => {
    const { db } = makeFakeDb();
    const { tx, set } = makeFakeTx(undefined);

    await promoteFirstAdminTx(tx, db, USER_UID);

    const [, userData] = findSetCall(set, USER_PATH);
    const updatedAt = (userData as { updatedAt: unknown }).updatedAt;
    expect(typeof updatedAt).toBe("string");
    const iso = updatedAt as string;
    expect(Number.isNaN(Date.parse(iso))).toBe(false);
    // Formato ISO 8601 com timezone Z
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("T5: promoção usa merge-set (tolera users/{uid} ausente — sem update, sem throw)", async () => {
    const { db } = makeFakeDb();
    // tx.get só conhece o bootstrap; users/{uid} retorna exists:false (doc ausente),
    // simulando a corrida com o rollback (user.delete) do TASK-06 ou um retry.
    const { tx, set, update } = makeFakeTx(undefined);

    // Não deve lançar mesmo que o doc do usuário não exista.
    await expect(promoteFirstAdminTx(tx, db, USER_UID)).resolves.toEqual({
      promoted: true,
    });

    // A escrita no usuário foi um set com merge (NUNCA update, que lançaria NOT_FOUND).
    expect(update).not.toHaveBeenCalled();
    const [, , userOpts] = findSetCall(set, USER_PATH);
    expect(userOpts).toEqual({ merge: true });
  });
});
