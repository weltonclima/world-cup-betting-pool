// @vitest-environment jsdom
/**
 * Testes do hook useParticipantProfile — foco no stale-while-revalidate
 * (TASK-11 perf-hardening): `keepPreviousData` mantém o perfil anterior ao trocar
 * de uid, sem flash de skeleton entre perfis.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Statistics } from "@/types";

vi.mock("@/firebase", () => ({ firebaseAuth: {}, firestore: {} }));
vi.mock("@/services", () => ({ getParticipantProfile: vi.fn() }));

import { getParticipantProfile } from "@/services";
import { useParticipantProfile } from "../useParticipantProfile";

const mockGet = vi.mocked(getParticipantProfile);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

function makeStats(uid: string, totalCorrect: number): Statistics {
  return {
    uid,
    totalCorrect,
    accuracy: 50,
    longestStreak: 1,
    correctByStage: { grupos: totalCorrect },
    positionHistory: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useParticipantProfile — keepPreviousData (stale-while-revalidate)", () => {
  it("mantém o perfil anterior ao trocar de uid enquanto o novo carrega", async () => {
    const statsA = makeStats("A", 5);
    const statsB = makeStats("B", 9);

    let resolveB: (v: Statistics) => void = () => {};
    const bPromise = new Promise<Statistics>((r) => {
      resolveB = r;
    });

    mockGet.mockImplementation((uid: string) =>
      uid === "A" ? Promise.resolve(statsA) : bPromise,
    );

    const { wrapper } = createWrapper();
    const { result, rerender } = renderHook(
      ({ uid }: { uid: string }) => useParticipantProfile(uid),
      { wrapper, initialProps: { uid: "A" } },
    );

    // Perfil A carregado.
    await waitFor(() => expect(result.current.data).toEqual(statsA));

    // Troca para B (query pendente): o perfil A deve permanecer (sem flash).
    rerender({ uid: "B" });
    expect(result.current.data).toEqual(statsA);
    expect(result.current.isPlaceholderData).toBe(true);

    // B resolve → passa a exibir B.
    resolveB(statsB);
    await waitFor(() => expect(result.current.data).toEqual(statsB));
    expect(result.current.isPlaceholderData).toBe(false);
  });
});
