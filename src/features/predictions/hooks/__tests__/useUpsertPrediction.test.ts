// @vitest-environment jsdom
/**
 * Testes do hook useUpsertPrediction (feature predictions — TASK-06).
 *
 * Cenários:
 * - onSuccess invalida predictionsKeys.all()
 * - onSuccess invalida matchesKeys.predictions(uid)
 * - onSuccess invalida homeKeys.predictions(uid)
 * - onError chama toast.error com a mensagem do erro
 */
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── mocks declarados antes dos imports do módulo ─────────────────────────────

vi.mock("@/firebase", () => ({
  firebaseAuth: {},
  firestore: {},
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/services/predictions", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/predictions")>();
  return {
    ...original,
    upsertPrediction: vi.fn(),
  };
});

// ── imports pós-mock ──────────────────────────────────────────────────────────

import { toast } from "sonner";
import { upsertPrediction } from "@/services/predictions";
import { useUpsertPrediction } from "../useUpsertPrediction";
import { predictionsKeys } from "../predictionsKeys";
import { matchesKeys } from "@/features/matches/hooks/matchesKeys";
import { homeKeys } from "@/features/home/hooks/homeKeys";

const mockUpsertPrediction = vi.mocked(upsertPrediction);
const mockToastError = vi.mocked(toast.error);

// ── factory de wrapper QueryClient ───────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
  return {
    queryClient,
    invalidateQueriesSpy,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

// ── fixtures ──────────────────────────────────────────────────────────────────

const UID = "user-01";
const INPUT = { matchId: "match-01", homeScore: 2, awayScore: 1 };

// ── testes ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useUpsertPrediction — onSuccess: invalidação de queries", () => {
  it("invalida predictionsKeys.all() após sucesso", async () => {
    const { invalidateQueriesSpy, wrapper } = createWrapper();
    mockUpsertPrediction.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useUpsertPrediction(UID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(INPUT);
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: predictionsKeys.all() }),
    );
  });

  it("invalida matchesKeys.predictions(uid) após sucesso", async () => {
    const { invalidateQueriesSpy, wrapper } = createWrapper();
    mockUpsertPrediction.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useUpsertPrediction(UID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(INPUT);
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: matchesKeys.predictions(UID) }),
    );
  });

  it("invalida homeKeys.predictions(uid) após sucesso", async () => {
    const { invalidateQueriesSpy, wrapper } = createWrapper();
    mockUpsertPrediction.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useUpsertPrediction(UID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(INPUT);
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: homeKeys.predictions(UID) }),
    );
  });

  it("invalida exatamente as 3 queries esperadas (predictionsKeys + matchesKeys + homeKeys)", async () => {
    const { invalidateQueriesSpy, wrapper } = createWrapper();
    mockUpsertPrediction.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useUpsertPrediction(UID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(INPUT);
    });

    // Coleta todas as queryKeys invalidadas
    const invalidatedKeys = invalidateQueriesSpy.mock.calls.map(
      (call) => (call[0] as { queryKey: unknown }).queryKey,
    );

    expect(invalidatedKeys).toContainEqual(predictionsKeys.all());
    expect(invalidatedKeys).toContainEqual(matchesKeys.predictions(UID));
    expect(invalidatedKeys).toContainEqual(homeKeys.predictions(UID));
    expect(invalidateQueriesSpy).toHaveBeenCalledTimes(3);
  });

  it("usa o uid correto nas keys de matchesKeys e homeKeys", async () => {
    const { invalidateQueriesSpy, wrapper } = createWrapper();
    const specificUid = "specific-user-42";
    mockUpsertPrediction.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useUpsertPrediction(specificUid), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync(INPUT);
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: matchesKeys.predictions(specificUid),
      }),
    );
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: homeKeys.predictions(specificUid),
      }),
    );
  });
});

describe("useUpsertPrediction — onError: toast.error", () => {
  it("chama toast.error com a mensagem do erro quando a mutação falha", async () => {
    const { wrapper } = createWrapper();
    const error = new Error("Os dados do palpite são inválidos.");
    mockUpsertPrediction.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useUpsertPrediction(UID), { wrapper });

    await act(async () => {
      // mutate não rejeita (erro é capturado pelo onError do hook)
      result.current.mutate(INPUT);
      // Aguarda a mutação completar
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockToastError).toHaveBeenCalledWith(error.message);
  });

  it("toast.error exibe a mensagem pt-BR correta do PredictionServiceError", async () => {
    const { wrapper } = createWrapper();
    const { PredictionServiceError } = await import("@/services/predictions");
    // PredictionServiceError vem do módulo original (não mockado), portanto acessível via importOriginal
    const serviceError = new PredictionServiceError(
      422,
      "Os dados do palpite são inválidos.",
    );
    mockUpsertPrediction.mockRejectedValueOnce(serviceError);

    const { result } = renderHook(() => useUpsertPrediction(UID), { wrapper });

    await act(async () => {
      result.current.mutate(INPUT);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockToastError).toHaveBeenCalledWith(
      "Os dados do palpite são inválidos.",
    );
  });

  it("não invalida queries quando a mutação falha", async () => {
    const { invalidateQueriesSpy, wrapper } = createWrapper();
    mockUpsertPrediction.mockRejectedValueOnce(new Error("network error"));

    const { result } = renderHook(() => useUpsertPrediction(UID), { wrapper });

    await act(async () => {
      result.current.mutate(INPUT);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });
});

describe("useUpsertPrediction — mutationFn", () => {
  it("passa o input corretamente para upsertPrediction", async () => {
    const { wrapper } = createWrapper();
    mockUpsertPrediction.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useUpsertPrediction(UID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(INPUT);
    });

    expect(mockUpsertPrediction).toHaveBeenCalledOnce();
    // TanStack Query pode chamar mutationFn com args extras de contexto; verificamos apenas o primeiro argumento
    const [firstArg] = mockUpsertPrediction.mock.calls[0] as Parameters<typeof upsertPrediction>;
    expect(firstArg).toEqual(INPUT);
  });
});
