// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";
import type { Statistics } from "@/types";

const { useParticipantProfileMock } = vi.hoisted(() => ({
  useParticipantProfileMock: vi.fn(),
}));

// Mocka o barrel só para o hook (o componente o importa dele).
vi.mock("@/features/rankings", () => ({
  useParticipantProfile: useParticipantProfileMock,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ firebaseUser: { uid: "u-me" } }),
}));

// Import por path direto p/ não cair no mock do barrel.
import { Evolution } from "@/features/rankings/components/Evolution";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const statistics: Statistics = {
  uid: "u-me",
  totalCorrect: 12,
  totalWrong: 36,
  accuracy: 25,
  longestStreak: 3,
  correctByStage: {},
  positionHistory: [
    { at: "2026-06-01T02:00:00Z", scope: "geral", position: 15, round: 1 },
    { at: "2026-06-02T02:00:00Z", scope: "geral", position: 10, round: 2 },
    { at: "2026-06-03T02:00:00Z", scope: "geral", position: 7, round: 3 },
    { at: "2026-06-04T02:00:00Z", scope: "geral", position: 4, round: 4 },
    // ruído de outro escopo — deve ser ignorado.
    { at: "2026-06-02T02:00:00Z", scope: "oitavas", position: 2, round: 2 },
  ],
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe("Evolution", () => {
  it("lista rodadas (recente→antiga) com 'Atual' na última e '—' na primeira", () => {
    useParticipantProfileMock.mockReturnValue({
      data: statistics,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<Evolution />, { wrapper });

    // 4 rodadas do escopo geral (oitavas ignorada).
    expect(screen.getByText("Rodada 4")).toBeTruthy();
    expect(screen.getByText("Rodada 1")).toBeTruthy();
    // Badge "Atual" na rodada mais recente.
    expect(screen.getByText("Atual")).toBeTruthy();
    // Posições renderizadas.
    expect(screen.getByText("#4")).toBeTruthy();
    expect(screen.getByText("#15")).toBeTruthy();
    // Rodada 1 (sem anterior) = manteve.
    expect(screen.getByLabelText("manteve a posição")).toBeTruthy();
    // Subidas: R2 (15→10, +5), R3 (10→7, +3), R4 (7→4, +3).
    expect(screen.getByLabelText("subiu 5 posições")).toBeTruthy();
    expect(screen.getAllByLabelText("subiu 3 posições").length).toBe(2);
  });

  it("estado vazio quando não há histórico geral", () => {
    useParticipantProfileMock.mockReturnValue({
      data: { ...statistics, positionHistory: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<Evolution />, { wrapper });
    expect(screen.getByText("Sem histórico ainda")).toBeTruthy();
  });

  it("estado de erro com retry", () => {
    const refetch = vi.fn();
    useParticipantProfileMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });
    render(<Evolution />, { wrapper });
    expect(screen.getByText("Tentar Novamente")).toBeTruthy();
  });
});
