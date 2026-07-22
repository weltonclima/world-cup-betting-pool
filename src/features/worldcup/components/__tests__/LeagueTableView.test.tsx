// @vitest-environment jsdom
/**
 * Testes do LeagueTableView (TASK-20).
 *
 * Gate INVERTIDO vs GroupsView: classificação só existe p/ liga. Copa ativa →
 * aviso, sem consultar useLeagueStandings (guard-before-query). Liga → estados
 * pending/error/empty/success com tabela única.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LeagueTableView } from "@/features/worldcup/components/LeagueTableView";
import type { LeagueStandingsResponse } from "@/types/leagues";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseLeagueStandings = vi.fn();
vi.mock("@/features/worldcup/hooks/useLeagueStandings", () => ({
  useLeagueStandings: () => mockUseLeagueStandings(),
}));

const { isCupMock } = vi.hoisted(() => ({ isCupMock: vi.fn(() => false) }));
vi.mock("@/features/championships", () => ({
  useIsCupActive: () => isCupMock(),
  useActiveChampionship: () => ({ activeChampionshipId: "bra.1-2026" }),
  CupOnlyNotice: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock("@/server/copaData/championshipCatalog", () => ({
  getChampionship: (id: string) =>
    id === "bra.1-2026" ? { id, name: "Brasileirão" } : undefined,
}));

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const RESPONSE: LeagueStandingsResponse = {
  hasLiveMatch: false,
  table: [
    {
      position: 1,
      team: { id: "83", name: "Flamengo", crestUrl: "https://espn/fla.png" },
      played: 1, wins: 1, draws: 0, losses: 0,
      goalsFor: 2, goalsAgainst: 1, goalDifference: 1, points: 3,
    },
    {
      position: 2,
      team: { id: "133", name: "Palmeiras" },
      played: 1, wins: 0, draws: 0, losses: 1,
      goalsFor: 1, goalsAgainst: 2, goalDifference: -1, points: 0,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  isCupMock.mockReturnValue(false);
});

// ---------------------------------------------------------------------------
// Gate cup/league
// ---------------------------------------------------------------------------

describe("LeagueTableView — gate league-only (TASK-20)", () => {
  it("L1: copa ativa → aviso, sem consultar useLeagueStandings", () => {
    isCupMock.mockReturnValue(true);
    render(<LeagueTableView />);
    expect(
      screen.getByText("Classificação de pontos corridos disponível apenas para ligas."),
    ).toBeTruthy();
    expect(mockUseLeagueStandings).not.toHaveBeenCalled();
  });

  it("L2: liga ativa → consulta a query", () => {
    mockUseLeagueStandings.mockReturnValue({
      isPending: true, isError: false, data: undefined, refetch: vi.fn(),
    });
    render(<LeagueTableView />);
    expect(mockUseLeagueStandings).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

describe("LeagueTableView — estados da query", () => {
  it("L3: pending → skeleton (role=status aria-busy)", () => {
    mockUseLeagueStandings.mockReturnValue({
      isPending: true, isError: false, data: undefined, refetch: vi.fn(),
    });
    render(<LeagueTableView />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-busy")).toBe("true");
  });

  it("L4: error → estado de erro + retry chama refetch", async () => {
    const refetch = vi.fn();
    mockUseLeagueStandings.mockReturnValue({
      isPending: false, isError: true, data: undefined, refetch,
    });
    render(<LeagueTableView />);
    expect(screen.getByText("Erro ao carregar informações.")).toBeTruthy();
    await userEvent.click(screen.getByText("Tentar novamente"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("L5: tabela vazia → empty state", () => {
    mockUseLeagueStandings.mockReturnValue({
      isPending: false, isError: false,
      data: { table: [], hasLiveMatch: false }, refetch: vi.fn(),
    });
    render(<LeagueTableView />);
    expect(screen.getByText("Nenhuma informação disponível.")).toBeTruthy();
  });

  it("L6: sucesso → tabela com clubes na ordem + legenda sem qualificação", () => {
    mockUseLeagueStandings.mockReturnValue({
      isPending: false, isError: false, data: RESPONSE, refetch: vi.fn(),
    });
    render(<LeagueTableView />);
    expect(screen.getByText("Flamengo")).toBeTruthy();
    expect(screen.getByText("Palmeiras")).toBeTruthy();
    // Legenda de abreviações presente
    expect(screen.getByText(/J Jogos/)).toBeTruthy();
    // Bloco de qualificação NÃO deve aparecer (liga não tem)
    expect(screen.queryByText("Classificado")).toBeNull();
    expect(screen.queryByText("Eliminado")).toBeNull();
  });

  it("L7: caption sr-only inclui nome do campeonato ativo (a11y — L-A)", () => {
    mockUseLeagueStandings.mockReturnValue({
      isPending: false, isError: false, data: RESPONSE, refetch: vi.fn(),
    });
    render(<LeagueTableView />);
    expect(screen.getByText("Classificação — Brasileirão")).toBeTruthy();
  });
});
