// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PoolStats } from "@/types";

const { usePoolStatsMock } = vi.hoisted(() => ({
  usePoolStatsMock: vi.fn(),
}));

// Mocka o hook (o componente importa por path direto).
vi.mock("@/features/rankings/hooks/usePoolStats", () => ({
  usePoolStats: usePoolStatsMock,
}));

// Import por path direto p/ não cair no barrel.
import { PoolStatsScreen } from "@/features/rankings/components/PoolStatsScreen";

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const populated: PoolStats = {
  updatedAt: "2026-06-05T02:00:00Z",
  totalParticipants: 28,
  highestPoints: 98,
  highestPointsName: "Joao Silva",
  lowestPoints: 12,
  averagePoints: 56.4,
  totalCorrect: 438,
  distribution: [
    { label: "90-100 pts", min: 90, max: 100, count: 3 },
    { label: "0-39 pts", min: 0, max: 39, count: 4 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  usePoolStatsMock.mockReturnValue({
    data: populated,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
});
afterEach(() => vi.clearAllMocks());

describe("PoolStatsScreen", () => {
  it("renderiza header com totalParticipants e os 4 cards", () => {
    renderWithClient(<PoolStatsScreen />);
    expect(screen.getByText("Visão Geral do Bolão")).toBeTruthy();
    expect(screen.getByText("28")).toBeTruthy();
    expect(screen.getByText("Maior Pontuação")).toBeTruthy();
    expect(screen.getByText("Menor Pontuação")).toBeTruthy();
    expect(screen.getByText("Média Geral")).toBeTruthy();
    expect(screen.getByText("Total de Acertos")).toBeTruthy();
    expect(screen.getByText("56,4")).toBeTruthy();
    expect(screen.getByText("Joao Silva")).toBeTruthy();
  });

  it("renderiza EmptyState quando totalParticipants === 0", () => {
    usePoolStatsMock.mockReturnValue({
      data: { ...populated, totalParticipants: 0 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderWithClient(<PoolStatsScreen />);
    expect(screen.getByText("Sem estatísticas ainda")).toBeTruthy();
  });

  it("renderiza ErrorState com retry quando isError", () => {
    usePoolStatsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });
    renderWithClient(<PoolStatsScreen />);
    expect(screen.getByText("Tentar Novamente")).toBeTruthy();
  });
});
