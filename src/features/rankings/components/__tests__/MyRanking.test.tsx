// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";
import type { RankingEntry, Statistics } from "@/types";

const { useMyRankingMock, useParticipantProfileMock } = vi.hoisted(() => ({
  useMyRankingMock: vi.fn(),
  useParticipantProfileMock: vi.fn(),
}));

// Mocka o barrel só para os hooks (o componente os importa dele).
vi.mock("@/features/rankings", () => ({
  useMyRanking: useMyRankingMock,
  useParticipantProfile: useParticipantProfileMock,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ firebaseUser: { uid: "u-me" } }),
}));

// Import por path direto p/ não cair no mock do barrel.
import { MyRanking } from "@/features/rankings/components/MyRanking";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const entry: RankingEntry = {
  uid: "u-me",
  nickname: "voce",
  name: "Voce Mesmo",
  position: 4,
  points: 12,
  accuracy: 25,
};

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
    { at: "2026-06-03T02:00:00Z", scope: "geral", position: 4, round: 3 },
    { at: "2026-06-02T02:00:00Z", scope: "oitavas", position: 2, round: 2 },
  ],
};

function loaded() {
  useMyRankingMock.mockReturnValue({
    data: { entry, total: 28 },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useParticipantProfileMock.mockReturnValue({
    data: statistics,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe("MyRanking", () => {
  it("mostra header verde com '#N de M participantes'", () => {
    loaded();
    render(<MyRanking />, { wrapper });
    // "#4" aparece no hero e em "Melhor Posição" (mesma posição) → usar getAllByText.
    expect(screen.getAllByText("#4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("de 28 participantes")).toBeTruthy();
    expect(screen.getByText("Você")).toBeTruthy();
  });

  it("grid mostra Pontos e Acertos com o mesmo valor (binário) + Aproveitamento", () => {
    loaded();
    render(<MyRanking />, { wrapper });
    expect(screen.getByText("Pontos")).toBeTruthy();
    expect(screen.getByText("Acertos")).toBeTruthy();
    // Pontos e Acertos compartilham o valor 12 (dois nós).
    expect(screen.getAllByText("12").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("25%")).toBeTruthy();
    expect(screen.getByText("12 de 48 jogos")).toBeTruthy();
  });

  it("deriva Melhor Posição e Média de Pontos do histórico geral", () => {
    loaded();
    render(<MyRanking />, { wrapper });
    expect(screen.getByText("Melhor Posição")).toBeTruthy();
    // melhor posição geral = #4 na rodada 3
    expect(screen.getByText("Rodada 3")).toBeTruthy();
    expect(screen.getAllByText("#4").length).toBeGreaterThanOrEqual(1);
    // média = 12 / 3 rodadas geral = 4
    expect(screen.getByText("Média de Pontos")).toBeTruthy();
    expect(screen.getByText("por rodada")).toBeTruthy();
  });

  it("estado vazio quando useMyRanking retorna null", () => {
    useMyRankingMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useParticipantProfileMock.mockReturnValue({
      data: statistics,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<MyRanking />, { wrapper });
    expect(screen.getByText("Você ainda não está no ranking")).toBeTruthy();
  });
});
