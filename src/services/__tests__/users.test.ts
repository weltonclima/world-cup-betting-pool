import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listUsersByStatus, updateUserStatus } from "@/services/users";

// --- Mocks de Firestore (sem rede/emulador), espelhando auth.test.ts ---
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ __tag: "collection" })),
  query: vi.fn(() => ({ __tag: "query" })),
  where: vi.fn(() => ({ __tag: "where" })),
  orderBy: vi.fn(() => ({ __tag: "orderBy" })),
  getDocs: vi.fn(),
  doc: vi.fn(() => ({ __tag: "doc" })),
  updateDoc: vi.fn(),
}));

vi.mock("@/firebase", () => ({
  firestore: { __tag: "firestore" },
}));

const collectionMock = vi.mocked(collection);
const queryMock = vi.mocked(query);
const whereMock = vi.mocked(where);
const orderByMock = vi.mocked(orderBy);
const getDocsMock = vi.mocked(getDocs);
const docMock = vi.mocked(doc);
const updateDocMock = vi.mocked(updateDoc);

function makeUserDoc(overrides: Record<string, unknown> = {}) {
  return {
    uid: "u1",
    name: "Fulano de Tal",
    nickname: "fulano",
    email: "fulano@email.com",
    role: "user",
    status: "pending",
    createdAt: "2026-06-01T10:00:00.000Z",
    ...overrides,
  };
}

function snapshotWith(docsData: Array<Record<string, unknown>>) {
  return {
    docs: docsData.map((data) => ({ data: () => data })),
  } as unknown as Awaited<ReturnType<typeof getDocs>>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listUsersByStatus", () => {
  it("T5: monta a query SÓ com where status== (sem orderBy) e chama getDocs", async () => {
    getDocsMock.mockResolvedValueOnce(snapshotWith([makeUserDoc()]));

    await listUsersByStatus("pending");

    expect(collectionMock).toHaveBeenCalledWith(
      expect.anything(),
      "users",
    );
    expect(whereMock).toHaveBeenCalledWith("status", "==", "pending");
    // Regressão (bug "dashboard zerado"): orderBy("createdAt") exigia índice
    // composto e descartava docs sem createdAt. A ordenação é em memória agora.
    expect(orderByMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalled();
    expect(getDocsMock).toHaveBeenCalled();
  });

  it("T5b: ordena em memória por createdAt ascendente (mais antigo primeiro)", async () => {
    getDocsMock.mockResolvedValueOnce(
      snapshotWith([
        makeUserDoc({ uid: "novo", createdAt: "2026-06-05T10:00:00.000Z" }),
        makeUserDoc({ uid: "antigo", createdAt: "2026-06-01T10:00:00.000Z" }),
        makeUserDoc({ uid: "meio", createdAt: "2026-06-03T10:00:00.000Z" }),
      ]),
    );

    const result = await listUsersByStatus("pending");

    expect(result.map((u) => u.uid)).toEqual(["antigo", "meio", "novo"]);
  });

  it("T5c: doc SEM createdAt não é descartado e vai para o fim", async () => {
    getDocsMock.mockResolvedValueOnce(
      snapshotWith([
        makeUserDoc({ uid: "sem-data", createdAt: undefined }),
        makeUserDoc({ uid: "com-data", createdAt: "2026-06-01T10:00:00.000Z" }),
      ]),
    );

    const result = await listUsersByStatus("pending");

    expect(result).toHaveLength(2); // nenhum descartado
    expect(result.map((u) => u.uid)).toEqual(["com-data", "sem-data"]);
  });

  it("T6a: parseia cada doc com userSchema e retorna User[]", async () => {
    getDocsMock.mockResolvedValueOnce(
      snapshotWith([
        makeUserDoc({ uid: "u1", status: "approved" }),
        makeUserDoc({ uid: "u2", status: "approved", email: "b@email.com" }),
      ]),
    );

    const result = await listUsersByStatus("approved");

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ uid: "u1", status: "approved" });
    expect(result[1]).toMatchObject({ uid: "u2", email: "b@email.com" });
  });

  it("T6b: doc malformado faz a leitura rejeitar (propaga ZodError)", async () => {
    getDocsMock.mockResolvedValueOnce(
      snapshotWith([makeUserDoc({ email: "nao-e-email" })]),
    );

    await expect(listUsersByStatus("pending")).rejects.toThrow();
  });

  it("T8a: erro do getDocs propaga cru (sem tradução)", async () => {
    const err = Object.assign(new Error("denied"), {
      code: "permission-denied",
    });
    getDocsMock.mockRejectedValueOnce(err);

    await expect(listUsersByStatus("pending")).rejects.toBe(err);
  });
});

describe("updateUserStatus", () => {
  it("T7: escreve apenas status + updatedAt (ISO) via updateDoc", async () => {
    updateDocMock.mockResolvedValueOnce(undefined);

    await updateUserStatus("u1", "approved");

    expect(docMock).toHaveBeenCalledWith(expect.anything(), "users", "u1");
    expect(updateDocMock).toHaveBeenCalledTimes(1);
    const call = updateDocMock.mock.calls[0] as unknown as [
      unknown,
      Record<string, unknown>,
    ];
    const payload = call[1];
    expect(payload.status).toBe("approved");
    expect(typeof payload.updatedAt).toBe("string");
    expect(
      Number.isNaN(Date.parse(payload.updatedAt as string)),
    ).toBe(false);
    expect(Object.keys(payload).sort()).toEqual(["status", "updatedAt"]);
  });

  it("T8b: erro do updateDoc propaga cru (sem tradução)", async () => {
    const err = Object.assign(new Error("denied"), {
      code: "permission-denied",
    });
    updateDocMock.mockRejectedValueOnce(err);

    await expect(updateUserStatus("u1", "blocked")).rejects.toBe(err);
  });
});
