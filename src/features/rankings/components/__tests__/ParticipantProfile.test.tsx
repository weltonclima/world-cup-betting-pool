// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";
import type { Ranking, Statistics } from "@/types";

const { useRankingMock, useParticipantProfileMock } = vi.hoisted(() => ({
  useRankingMock: vi.fn(),
  useParticipantProfileMock: vi.fn(),
}));

vi.mock("@/features/rankings", () => ({
  useRanking: useRankingMock,
  useParticipantProfile: useParticipantProfileMock,
}));

import { ParticipantProfile } from "@/features/rankings/components/ParticipantProfile";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const ranking: Ranking = {
  scope: "geral",
  updatedAt: "2026-06-05T02:00:00Z",
  entries: [
    { uid: "u-a", nickname: "ana", name: "Ana Souza", position: 1, points: 20, wrong: 28, accuracy: 41 },
    { uid: "u-x", nickname: "lucas", name: "Lucas Pereira", position: 5, points: 11, wrong: 13, accuracy: 23 },
  ],
};

const stats: Statistics = {
  uid: "u-x",
  totalCorrect: 11,
  totalWrong: 13,
  accuracy: 23,
  longestStreak: 2,
  correctByStage: { grupos: 6, oitavas: 3 },
  positionHistory: [],
};

function ok(rankingData: Ranking | null, statsData: Statistics | null) {
  useRankingMock.mockReturnValue({
    data: rankingData,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useParticipantProfileMock.mockReturnValue({
    data: statsData,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe("ParticipantProfile", () => {
  it("mostra nome, posição e métricas do participante", () => {
    ok(ranking, stats);
    render(<ParticipantProfile uid="u-x" />, { wrapper });
    expect(screen.getByText("Lucas Pereira")).toBeTruthy();
    expect(screen.getByText("#5")).toBeTruthy();
    expect(screen.getByText("de 2 participantes")).toBeTruthy();
    // Binário: Pontos e Acertos = mesmo valor (11), dois nós.
    expect(screen.getAllByText("11").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("23%")).toBeTruthy();
    // Desempenho por fase: grupos 6 pts.
    expect(screen.getByText("6 pts")).toBeTruthy();
  });

  it("NÃO renderiza o botão 'Ver histórico de palpites' (A5 privado)", () => {
    ok(ranking, stats);
    render(<ParticipantProfile uid="u-x" />, { wrapper });
    expect(screen.queryByText(/Ver histórico de palpites/i)).toBeNull();
  });

  it("estado 'não encontrado' quando uid não está no ranking", () => {
    ok(ranking, null);
    render(<ParticipantProfile uid="u-zzz" />, { wrapper });
    expect(screen.getByText("Participante não encontrado")).toBeTruthy();
  });
});
