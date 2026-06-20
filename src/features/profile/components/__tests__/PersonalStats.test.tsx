// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
// O barrel de componentes puxa o client do Firebase (GeneralRanking). Mocka só os
// estados usados aqui p/ o teste não exigir env do Firebase.
vi.mock("@/features/rankings/components", () => ({
  RankingEmptyState: ({ message }: { message?: string }) => <div>{message}</div>,
  RankingErrorState: () => <div>erro</div>,
  RankingSkeleton: () => <div>carregando</div>,
}));

// Import por path direto p/ não cair no mock do barrel.
import { PersonalStats } from "@/features/profile/components/PersonalStats";

// points (25) = PONDERADO; totalCorrect (12) = EXATOS. Distintos de propósito:
// garante que "Acertos Exatos" usa totalCorrect, não points (fix da mentira binária).
const entry: RankingEntry = {
  uid: "u-me",
  nickname: "voce",
  name: "Voce Mesmo",
  position: 4,
  points: 25,
  accuracy: 20,
};

const statistics: Statistics = {
  uid: "u-me",
  totalCorrect: 12,
  totalPartial: 10,
  totalWrong: 36,
  accuracy: 20,
  longestStreak: 3,
  correctByStage: { grupos: 8 }, // != 12/25 p/ não colidir com cards no getByText
  positionHistory: [],
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

describe("PersonalStats", () => {
  it("Acertos Exatos usa totalCorrect (não points) e Pontos usa o ponderado", () => {
    loaded();
    render(<PersonalStats />);
    expect(screen.getByText("Pontos")).toBeTruthy();
    expect(screen.getByText("Acertos Exatos")).toBeTruthy();
    // Pontos = 25 (ponderado); Acertos Exatos = 12 (exatos). DISTINTOS.
    expect(screen.getByText("25")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
  });

  it("Aproveitamento conta exatos + parciais + erros no denominador", () => {
    loaded();
    render(<PersonalStats />);
    expect(screen.getByText("20%")).toBeTruthy();
    // 12 exatos + 10 parciais + 36 erros = 58 jogos jogados.
    expect(screen.getByText("12 de 58 jogos")).toBeTruthy();
  });

  it("explica a pontuação PONDERADA (10/5), não a mentira binária de 1 ponto", () => {
    loaded();
    render(<PersonalStats />);
    expect(
      screen.getByText(
        "Placar exato vale 10 pontos. Acertar só o vencedor ou o empate vale 5.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/cada acerto vale 1 ponto/)).toBeNull();
  });

  it("denominador cai p/ exatos+erros sem totalPartial (retrocompat)", () => {
    const legacy = { ...statistics };
    delete (legacy as { totalPartial?: number }).totalPartial;
    useMyRankingMock.mockReturnValue({
      data: { entry, total: 28 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useParticipantProfileMock.mockReturnValue({
      data: legacy,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<PersonalStats />);
    // Sem totalPartial → parcial = 0 → 12 + 36 = 48 jogos.
    expect(screen.getByText("12 de 48 jogos")).toBeTruthy();
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
    render(<PersonalStats />);
    expect(screen.getByText("Você ainda não tem estatísticas")).toBeTruthy();
  });
});
