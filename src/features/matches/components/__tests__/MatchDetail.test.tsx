// @vitest-environment jsdom
/**
 * Testes do componente MatchDetail (TASK-06).
 * Mock de useMatchDetail — isola o componente sem depender de Firebase/React Query.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MatchDetailData } from "@/features/matches/hooks/useMatchDetail";
import type { MatchListItem } from "@/features/matches/hooks/useMatchesList";

// ── Mocks declarados ANTES dos imports de módulo (hoisting) ─────────────────
// Firebase e auth precisam estar mockados antes que qualquer módulo os importe.

vi.mock("@/firebase", () => ({
  firebaseAuth: {},
  firestore: {},
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    firebaseUser: { uid: "user-01" },
    profile: null,
    status: null,
    role: null,
    loading: false,
    error: null,
    refreshProfile: vi.fn(),
  })),
}));

vi.mock("@/features/matches/hooks/useMatchDetail");

// ── Importação após mock ────────────────────────────────────────────────────
import { useMatchDetail } from "@/features/matches/hooks/useMatchDetail";
import { MatchDetail } from "@/features/matches/components/MatchDetail";

const mockedUseMatchDetail = vi.mocked(useMatchDetail);

// ── Fixture de match ────────────────────────────────────────────────────────

const matchFixture: MatchListItem = {
  id: "match-001",
  kickoffAt: "2026-06-14T16:00:00Z",
  stage: "grupos",
  round: 1,
  groupId: "Grupo C",
  status: "scheduled",
  homeScore: null,
  awayScore: null,
  venue: { name: "Estádio Lusail", city: "Lusail" },
  homeTeamId: "team-bra",
  awayTeamId: "team-fra",
  homeTeam: { name: "Brasil", flagUrl: "https://example.com/br.png" },
  awayTeam: { name: "França", flagUrl: "https://example.com/fr.png" },
  predictionStatus: "pendente",
};

const makeData = (overrides: Partial<MatchDetailData>): MatchDetailData => ({
  match: null,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MatchDetail — estado loading", () => {
  it("T1: renderiza skeleton com aria-busy quando isLoading=true", () => {
    mockedUseMatchDetail.mockReturnValue(makeData({ isLoading: true }));
    render(<MatchDetail id="match-001" />);
    const skeleton = screen.getByRole("status", { name: "Carregando detalhes do jogo" });
    expect(skeleton.getAttribute("aria-busy")).toBe("true");
  });

  it("T2: NÃO renderiza conteúdo de jogo durante loading", () => {
    mockedUseMatchDetail.mockReturnValue(makeData({ isLoading: true }));
    render(<MatchDetail id="match-001" />);
    expect(screen.queryByText("Brasil")).toBeNull();
    expect(screen.queryByText("França")).toBeNull();
  });
});

describe("MatchDetail — estado error", () => {
  it("T3: renderiza mensagem de erro quando isError=true", () => {
    mockedUseMatchDetail.mockReturnValue(makeData({ isError: true }));
    render(<MatchDetail id="match-001" />);
    expect(screen.getByText("Erro ao carregar detalhes do jogo")).toBeTruthy();
  });

  it("T4: exibe botão 'Tentar novamente'", () => {
    mockedUseMatchDetail.mockReturnValue(makeData({ isError: true }));
    render(<MatchDetail id="match-001" />);
    expect(screen.getByText("Tentar novamente")).toBeTruthy();
  });

  it("T5: chama refetch ao clicar em 'Tentar novamente'", () => {
    const refetch = vi.fn();
    mockedUseMatchDetail.mockReturnValue(makeData({ isError: true, refetch }));
    render(<MatchDetail id="match-001" />);
    screen.getByText("Tentar novamente").click();
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe("MatchDetail — estado 404 (match=null)", () => {
  it("T6: exibe 'Jogo não encontrado' quando match=null e não loading/error", () => {
    mockedUseMatchDetail.mockReturnValue(makeData({ match: null }));
    render(<MatchDetail id="match-xxx" />);
    expect(screen.getByText("Jogo não encontrado")).toBeTruthy();
  });

  it("T7: exibe mensagem descritiva no 404", () => {
    mockedUseMatchDetail.mockReturnValue(makeData({ match: null }));
    render(<MatchDetail id="match-xxx" />);
    expect(screen.getByText("Não foi possível encontrar este jogo.")).toBeTruthy();
  });

  it("T8: exibe link 'Voltar para Jogos' apontando para /matches", () => {
    mockedUseMatchDetail.mockReturnValue(makeData({ match: null }));
    render(<MatchDetail id="match-xxx" />);
    const link = screen.getByText("Voltar para Jogos");
    expect(link).toBeTruthy();
    // O link está dentro de um elemento com href /matches
    const anchor = link.closest("a");
    expect(anchor?.getAttribute("href")).toBe("/matches");
  });
});

describe("MatchDetail — estado sucesso", () => {
  it("T9: renderiza nomes das seleções", () => {
    mockedUseMatchDetail.mockReturnValue(makeData({ match: matchFixture }));
    render(<MatchDetail id="match-001" />);
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("França")).toBeTruthy();
  });

  it("T10: renderiza subtítulo de fase e grupo", () => {
    mockedUseMatchDetail.mockReturnValue(makeData({ match: matchFixture }));
    render(<MatchDetail id="match-001" />);
    expect(screen.getByText("Fase de Grupos · Grupo C")).toBeTruthy();
  });

  it("T11: renderiza headings de seção", () => {
    mockedUseMatchDetail.mockReturnValue(makeData({ match: matchFixture }));
    render(<MatchDetail id="match-001" />);
    expect(screen.getByText("Detalhes do Jogo")).toBeTruthy();
    expect(screen.getByText("Status do Jogo")).toBeTruthy();
    expect(screen.getByText("Status do Palpite")).toBeTruthy();
    expect(screen.getByText("Ações")).toBeTruthy();
  });

  it("T12: renderiza estádio quando venue está presente", () => {
    mockedUseMatchDetail.mockReturnValue(makeData({ match: matchFixture }));
    render(<MatchDetail id="match-001" />);
    expect(screen.getByText("Estádio Lusail")).toBeTruthy();
  });

  it("T13: renderiza cidade quando venue está presente", () => {
    mockedUseMatchDetail.mockReturnValue(makeData({ match: matchFixture }));
    render(<MatchDetail id="match-001" />);
    expect(screen.getByText("Lusail")).toBeTruthy();
  });

  it("T14: renderiza link de volta apontando para /matches", () => {
    mockedUseMatchDetail.mockReturnValue(makeData({ match: matchFixture }));
    render(<MatchDetail id="match-001" />);
    // O BackButton usa Button asChild com Link — o <a> tem href=/matches
    const backLink = screen.getByRole("link", { name: /voltar/i });
    expect(backLink.getAttribute("href")).toBe("/matches");
  });

  it("T15: renderiza mensagem descritiva do palpite pendente", () => {
    mockedUseMatchDetail.mockReturnValue(makeData({ match: matchFixture }));
    render(<MatchDetail id="match-001" />);
    expect(screen.getByText("Você ainda não enviou um palpite para este jogo.")).toBeTruthy();
  });

  it("T16: renderiza mensagem descritiva do palpite enviado", () => {
    const match: MatchListItem = { ...matchFixture, predictionStatus: "enviado" };
    mockedUseMatchDetail.mockReturnValue(makeData({ match }));
    render(<MatchDetail id="match-001" />);
    expect(screen.getByText("Seu palpite foi enviado com sucesso.")).toBeTruthy();
  });

  it("T17: renderiza placar para jogo encerrado", () => {
    const match: MatchListItem = {
      ...matchFixture,
      status: "finished",
      homeScore: 2,
      awayScore: 1,
      predictionStatus: "bloqueado",
    };
    mockedUseMatchDetail.mockReturnValue(makeData({ match }));
    render(<MatchDetail id="match-001" />);
    // Placar exibido como "2 × 1" no separador
    expect(screen.getByText("2 × 1")).toBeTruthy();
  });
});
