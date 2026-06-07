import { collection, getDocs } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listAllTeams } from "@/services/teams";

// --- Mocks de Firestore (sem rede/emulador) ---
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ __tag: "collection" })),
  getDocs: vi.fn(),
}));

vi.mock("@/firebase", () => ({
  firestore: { __tag: "firestore" },
}));

const collectionMock = vi.mocked(collection);
const getDocsMock = vi.mocked(getDocs);

function makeTeamData(overrides: Record<string, unknown> = {}) {
  return {
    name: "Brasil",
    code: "BRA",
    flagUrl: "https://media.api-sports.io/flags/br.svg",
    groupId: "Group D",
    ...overrides,
  };
}

function snapshotWith(docsData: Array<Record<string, unknown>>) {
  return {
    empty: docsData.length === 0,
    docs: docsData.map((data) => ({ data: () => data })),
  } as unknown as Awaited<ReturnType<typeof getDocs>>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listAllTeams", () => {
  it("busca toda a coleção 'teams' (sem filtros) e chama getDocs", async () => {
    getDocsMock.mockResolvedValueOnce(snapshotWith([makeTeamData()]));

    await listAllTeams();

    expect(collectionMock).toHaveBeenCalledWith(
      expect.anything(),
      "teams",
    );
    expect(getDocsMock).toHaveBeenCalled();
  });

  it("retorna array de Teams validados", async () => {
    getDocsMock.mockResolvedValueOnce(
      snapshotWith([
        makeTeamData({ name: "Brasil", code: "BRA" }),
        makeTeamData({ name: "Argentina", code: "ARG", groupId: "Group A" }),
      ]),
    );

    const result = await listAllTeams();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ name: "Brasil", code: "BRA" });
    expect(result[1]).toMatchObject({ name: "Argentina", code: "ARG" });
  });

  it("retorna array vazio quando a coleção está vazia", async () => {
    getDocsMock.mockResolvedValueOnce(snapshotWith([]));

    const result = await listAllTeams();

    expect(result).toEqual([]);
  });

  it("doc com código inválido (2 letras) faz rejeitar (ZodError)", async () => {
    getDocsMock.mockResolvedValueOnce(
      snapshotWith([makeTeamData({ code: "BR" })]),
    );

    await expect(listAllTeams()).rejects.toThrow();
  });

  it("erro do getDocs propaga cru (sem tradução)", async () => {
    const err = Object.assign(new Error("denied"), {
      code: "permission-denied",
    });
    getDocsMock.mockRejectedValueOnce(err);

    await expect(listAllTeams()).rejects.toBe(err);
  });
});
