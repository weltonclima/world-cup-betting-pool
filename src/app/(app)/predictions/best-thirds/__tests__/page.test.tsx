// @vitest-environment jsdom
/**
 * Testes do gate cup/league da página Ranking dos Melhores Terceiros (TASK-10).
 *
 * O ranking de melhores terceiros é conceito de fase de grupos FIFA — só faz
 * sentido para copas. Liga ativa → aviso cup-only ANTES de disparar as queries
 * (useMatches/usePredictions/useTeams). Copa ativa → fluxo normal (sem regressão).
 *
 * Estratégia: mock dos hooks de dados (para espionar se são chamados), do
 * componente BestThirdsRanking (stub leve) e de useIsCupActive (gate).
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { isCupMock, useMatchesMock, usePredictionsMock, useTeamsMock } =
  vi.hoisted(() => ({
    isCupMock: vi.fn(() => true),
    useMatchesMock: vi.fn(),
    usePredictionsMock: vi.fn(),
    useTeamsMock: vi.fn(),
  }));

vi.mock("@/features/championships", () => ({
  useIsCupActive: () => isCupMock(),
  CupOnlyNotice: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ firebaseUser: { uid: "u1" } }),
}));

vi.mock("@/features/matches/hooks", () => ({
  useMatches: () => useMatchesMock(),
  useTeams: () => useTeamsMock(),
}));

vi.mock("@/features/predictions/hooks", () => ({
  usePredictions: (uid: string | null) => usePredictionsMock(uid),
}));

vi.mock("@/components/layout/BackButton", () => ({
  BackButton: () => <button type="button">voltar</button>,
}));

vi.mock("@/features/predictions/components/BestThirdsRanking", () => ({
  BestThirdsRanking: () => <div data-testid="best-thirds-ranking" />,
  buildThirdsRanking: () => ({
    thirds: [],
    allGroupsComplete: false,
    completedGroupsCount: 0,
    totalGroupsCount: 12,
  }),
}));

import BestThirdsPage from "@/app/(app)/predictions/best-thirds/page";

const IDLE_QUERY = {
  data: [],
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  isCupMock.mockReturnValue(true);
  useMatchesMock.mockReturnValue(IDLE_QUERY);
  usePredictionsMock.mockReturnValue(IDLE_QUERY);
  useTeamsMock.mockReturnValue(IDLE_QUERY);
});

describe("BestThirdsPage — gate cup/league (TASK-10)", () => {
  it("G1: liga ativa → aviso cup-only, sem disparar queries de dados", () => {
    isCupMock.mockReturnValue(false);
    render(<BestThirdsPage />);

    expect(
      screen.getByText("Ranking dos melhores terceiros disponível apenas para copas."),
    ).toBeTruthy();
    expect(screen.queryByTestId("best-thirds-ranking")).toBeNull();
    expect(useMatchesMock).not.toHaveBeenCalled();
    expect(usePredictionsMock).not.toHaveBeenCalled();
    expect(useTeamsMock).not.toHaveBeenCalled();
  });

  it("G2: copa ativa → fluxo normal (ranking renderizado, queries disparadas)", () => {
    isCupMock.mockReturnValue(true);
    render(<BestThirdsPage />);

    expect(screen.getByTestId("best-thirds-ranking")).toBeTruthy();
    expect(useMatchesMock).toHaveBeenCalled();
    expect(usePredictionsMock).toHaveBeenCalled();
    expect(useTeamsMock).toHaveBeenCalled();
    expect(
      screen.queryByText("Ranking dos melhores terceiros disponível apenas para copas."),
    ).toBeNull();
  });
});
