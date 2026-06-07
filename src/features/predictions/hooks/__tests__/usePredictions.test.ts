// @vitest-environment jsdom
/**
 * Testes do hook usePredictions (feature predictions — TASK-06).
 *
 * Cenários:
 * - uid=null → query desabilitada (enabled: false), queryFn não é chamada
 * - uid!=null → query habilitada, chama listPredictionsByUid com o uid correto
 * - queryKey é predictionsKeys.all() → ["predictions"]
 * - dados retornados são passados para o resultado da query
 */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Prediction } from "@/types";

// ── mocks declarados antes dos imports do módulo ─────────────────────────────

vi.mock("@/firebase", () => ({
  firebaseAuth: {},
  firestore: {},
}));

vi.mock("@/services", () => ({
  listPredictionsByUid: vi.fn(),
}));

// ── imports pós-mock ──────────────────────────────────────────────────────────

import { listPredictionsByUid } from "@/services";
import { usePredictions } from "../usePredictions";
import { predictionsKeys } from "../predictionsKeys";

const mockListPredictionsByUid = vi.mocked(listPredictionsByUid);

// ── factory de wrapper QueryClient ───────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

// ── fixtures ──────────────────────────────────────────────────────────────────

function makePrediction(matchId: string): Prediction {
  return { uid: "user-01", matchId, homeScore: 1, awayScore: 0 };
}

// ── testes ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("usePredictions — enabled (uid)", () => {
  it("query está desabilitada quando uid é null", () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePredictions(null), { wrapper });

    // Com enabled=false, a query não é executada — status 'pending' mas sem fetch
    expect(mockListPredictionsByUid).not.toHaveBeenCalled();
    // fetchStatus idle quando disabled
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("listPredictionsByUid não é chamada quando uid é null", () => {
    const { wrapper } = createWrapper();

    renderHook(() => usePredictions(null), { wrapper });

    expect(mockListPredictionsByUid).not.toHaveBeenCalled();
  });

  it("query é habilitada e chama listPredictionsByUid com o uid correto", async () => {
    const { wrapper } = createWrapper();
    const predictions = [makePrediction("match-01")];
    mockListPredictionsByUid.mockResolvedValueOnce(predictions);

    const { result } = renderHook(() => usePredictions("user-01"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockListPredictionsByUid).toHaveBeenCalledWith("user-01");
  });

  it("retorna os dados retornados por listPredictionsByUid", async () => {
    const { wrapper } = createWrapper();
    const predictions = [
      makePrediction("match-01"),
      makePrediction("match-02"),
    ];
    mockListPredictionsByUid.mockResolvedValueOnce(predictions);

    const { result } = renderHook(() => usePredictions("user-01"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(predictions);
  });
});

describe("usePredictions — queryKey", () => {
  it("usa predictionsKeys.all() como queryKey → ['predictions']", async () => {
    const { queryClient, wrapper } = createWrapper();
    mockListPredictionsByUid.mockResolvedValueOnce([makePrediction("m1")]);

    renderHook(() => usePredictions("user-01"), { wrapper });

    await waitFor(() =>
      queryClient.getQueryState(predictionsKeys.all()) !== undefined,
    );

    // Confirma que a chave correta está no cache
    expect(predictionsKeys.all()).toEqual(["predictions"]);
    const state = queryClient.getQueryState(predictionsKeys.all());
    expect(state).toBeDefined();
  });
});

describe("usePredictions — troca de uid", () => {
  it("busca novamente quando uid muda de null para string válida", async () => {
    const { wrapper } = createWrapper();
    mockListPredictionsByUid.mockResolvedValue([makePrediction("m1")]);

    const { result, rerender } = renderHook(
      ({ uid }: { uid: string | null }) => usePredictions(uid),
      { wrapper, initialProps: { uid: null as string | null } },
    );

    // Inicialmente desabilitado
    expect(mockListPredictionsByUid).not.toHaveBeenCalled();

    // Rerender com uid válido
    rerender({ uid: "user-01" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockListPredictionsByUid).toHaveBeenCalledWith("user-01");
  });
});
