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

vi.mock("@/features/predictions/hooks", () => ({
  usePredictions: vi.fn(() => ({ data: [], isLoading: false, isError: false })),
  predictionsKeys: { all: () => ["predictions"] },
  useUpsertPrediction: vi.fn(),
  usePredictionsList: vi.fn(() => ({ data: [], isLoading: false, isError: false })),
}));

// ── Importação após mock ────────────────────────────────────────────────────
import { useMatchDetail } from "@/features/matches/hooks/useMatchDetail";
import { usePredictions } from "@/features/predictions/hooks";
import { MatchDetail } from "@/features/matches/components/MatchDetail";
import type { Prediction } from "@/types";

const mockedUseMatchDetail = vi.mocked(useMatchDetail);
const mockedUsePredictions = vi.mocked(usePredictions);

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
  userPrediction: null,
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

  it("T10b: exibe 'Dezesseis Avos de Final' para stage dezesseis-avos (TASK-01)", () => {
    const dezesseisMatch: MatchListItem = {
      ...matchFixture,
      stage: "dezesseis-avos",
      round: null,
      groupId: null,
    };
    mockedUseMatchDetail.mockReturnValue(makeData({ match: dezesseisMatch }));
    render(<MatchDetail id="match-001" />);
    expect(screen.getByText("Dezesseis Avos de Final")).toBeTruthy();
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

  it("T18: renderiza placar parcial e badge 'Ao Vivo' para jogo ao vivo (TASK-07)", () => {
    const match: MatchListItem = {
      ...matchFixture,
      status: "live",
      homeScore: 1,
      awayScore: 0,
      predictionStatus: "bloqueado",
    };
    mockedUseMatchDetail.mockReturnValue(makeData({ match }));
    render(<MatchDetail id="match-001" />);
    // Placar parcial no separador
    expect(screen.getByText("1 × 0")).toBeTruthy();
    // Badge de status do jogo já mapeia live → "Ao Vivo"
    expect(screen.getByText("Ao Vivo")).toBeTruthy();
  });

  it("T19: ao vivo SEM placar mostra separador '×' (não inventa 0x0) (TASK-07)", () => {
    const match: MatchListItem = {
      ...matchFixture,
      status: "live",
      homeScore: null,
      awayScore: null,
      predictionStatus: "bloqueado",
    };
    mockedUseMatchDetail.mockReturnValue(makeData({ match }));
    render(<MatchDetail id="match-001" />);
    // Separador permanece "×" puro; badge "Ao Vivo" segue visível
    expect(screen.getByLabelText("versus").textContent).toBe("×");
    expect(screen.getByText("Ao Vivo")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Bloco "Meu Palpite" (TASK-09)
// ---------------------------------------------------------------------------

const predictionFixture: Prediction = {
  uid: "user-01",
  matchId: "match-001",
  homeScore: 2,
  awayScore: 1,
};

describe("MatchDetail — bloco Meu Palpite", () => {
  it("T-NOVO-A: exibe bloco 'Meu Palpite' quando existingPrediction está definido", () => {
    mockedUseMatchDetail.mockReturnValue(
      makeData({ match: { ...matchFixture, predictionStatus: "enviado" } }),
    );
    mockedUsePredictions.mockReturnValue({
      data: [predictionFixture],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof usePredictions>);
    render(<MatchDetail id="match-001" />);
    expect(screen.getByText("Meu Palpite")).toBeTruthy();
  });

  it("T-NOVO-B: exibe placar palpitado corretamente (homeScore × awayScore)", () => {
    mockedUseMatchDetail.mockReturnValue(
      makeData({ match: { ...matchFixture, predictionStatus: "enviado" } }),
    );
    mockedUsePredictions.mockReturnValue({
      data: [predictionFixture],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof usePredictions>);
    render(<MatchDetail id="match-001" />);
    // Os scores são exibidos como texto separados (não "2 × 1" num único nó)
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    // aria-label do bloco descreve o palpite completo
    const block = screen.getByRole("img", { name: /seu palpite/i });
    expect(block).toBeTruthy();
  });

  it("T-NOVO-C: bloco 'Meu Palpite' NÃO aparece quando prediction undefined", () => {
    mockedUseMatchDetail.mockReturnValue(makeData({ match: matchFixture }));
    mockedUsePredictions.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof usePredictions>);
    render(<MatchDetail id="match-001" />);
    expect(screen.queryByText("Meu Palpite")).toBeNull();
  });
});
