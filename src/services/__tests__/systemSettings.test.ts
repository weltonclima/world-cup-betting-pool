import { doc, getDoc } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSystemSettings } from "@/services/systemSettings";

// --- Mocks de Firestore (sem rede/emulador) ---
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({ __tag: "doc" })),
  getDoc: vi.fn(),
}));

vi.mock("@/firebase", () => ({
  firestore: { __tag: "firestore" },
}));

const docMock = vi.mocked(doc);
const getDocMock = vi.mocked(getDoc);

function makeSystemSettingsData(overrides: Record<string, unknown> = {}) {
  return {
    registrationOpen: true,
    predictionsLocked: false,
    currentStage: "grupos",
    updatedAt: "2026-06-01T02:00:00.000Z",
    ...overrides,
  };
}

function snapExists(data: Record<string, unknown>) {
  return {
    exists: () => true,
    data: () => data,
  } as unknown as Awaited<ReturnType<typeof getDoc>>;
}

function snapMissing() {
  return {
    exists: () => false,
    data: () => undefined,
  } as unknown as Awaited<ReturnType<typeof getDoc>>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getSystemSettings", () => {
  it("acessa o doc system_settings/global correto", async () => {
    getDocMock.mockResolvedValueOnce(snapExists(makeSystemSettingsData()));

    await getSystemSettings();

    expect(docMock).toHaveBeenCalledWith(
      expect.anything(),
      "system_settings",
      "global",
    );
    expect(getDocMock).toHaveBeenCalled();
  });

  it("retorna SystemSettings validado quando doc existe", async () => {
    getDocMock.mockResolvedValueOnce(
      snapExists(makeSystemSettingsData({ predictionsLocked: true })),
    );

    const result = await getSystemSettings();

    expect(result).toMatchObject({
      registrationOpen: true,
      predictionsLocked: true,
      currentStage: "grupos",
    });
  });

  it("retorna SystemSettings mesmo sem campos opcionais (currentStage/updatedAt)", async () => {
    getDocMock.mockResolvedValueOnce(
      snapExists({ registrationOpen: false, predictionsLocked: false }),
    );

    const result = await getSystemSettings();

    expect(result).toMatchObject({
      registrationOpen: false,
      predictionsLocked: false,
    });
    expect(result?.currentStage).toBeUndefined();
  });

  it("retorna null quando o doc não existe", async () => {
    getDocMock.mockResolvedValueOnce(snapMissing());

    const result = await getSystemSettings();

    expect(result).toBeNull();
  });

  it("doc malformado (currentStage inválido) faz rejeitar (ZodError)", async () => {
    getDocMock.mockResolvedValueOnce(
      snapExists(makeSystemSettingsData({ currentStage: "invalido" })),
    );

    await expect(getSystemSettings()).rejects.toThrow();
  });

  it("erro do getDoc propaga cru (sem tradução)", async () => {
    const err = Object.assign(new Error("denied"), {
      code: "permission-denied",
    });
    getDocMock.mockRejectedValueOnce(err);

    await expect(getSystemSettings()).rejects.toBe(err);
  });
});
