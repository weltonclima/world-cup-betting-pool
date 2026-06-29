// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";
import type { Ranking, Statistics } from "@/types";
import type { ProfilePredictionsResult } from "@/features/rankings/hooks";

const {
  usePoolRankingMock,
  usePoolRankingByScopeMock,
  useParticipantProfileMock,
  useProfilePredictionsMock,
  useMatchesMock,
  authMock,
} = vi.hoisted(() => ({
  usePoolRankingMock: vi.fn(),
  usePoolRankingByScopeMock: vi.fn(),
  useParticipantProfileMock: vi.fn(),
  useProfilePredictionsMock: vi.fn(),
  useMatchesMock: vi.fn(),
  authMock: vi.fn(),
}));

vi.mock("@/features/rankings/hooks", () => ({
  usePoolRanking: usePoolRankingMock,
  usePoolRankingByScope: usePoolRankingByScopeMock,
  useParticipantProfile: useParticipantProfileMock,
  useProfilePredictions: useProfilePredictionsMock,
}));
vi.mock("@/features/matches/hooks", () => ({
  useMatches: useMatchesMock,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: authMock,
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
    {
      uid: "u-a",
      nickname: "ana",
      name: "Ana Souza",
      position: 1,
      points: 20,
      wrong: 28,
      accuracy: 41,
    },
    {
      uid: "u-x",
      nickname: "lucas",
      name: "Lucas Pereira",
      position: 5,
      points: 11,
      wrong: 13,
      accuracy: 23,
    },
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

const emptyPredictions: ProfilePredictionsResult = {
  items: [],
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

function okRanking(rankingData: Ranking | null, statsData: Statistics | null) {
  usePoolRankingMock.mockReturnValue({
    data: rankingData,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  // Default: scope queries retornam null (splitPhaseRanking ausente → splitOn = false,
  // mas o hook ainda é chamado com enabled:false — precisa de mock válido).
  usePoolRankingByScopeMock.mockReturnValue({
    data: null,
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
  useProfilePredictionsMock.mockReturnValue(emptyPredictions);
  useMatchesMock.mockReturnValue({ data: [], isLoading: false, isError: false });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: viewing another user's profile (isSelf = false)
  authMock.mockReturnValue({ profile: { groupId: "pool-1", uid: "u-a" } });
});
afterEach(() => vi.clearAllMocks());

describe("ParticipantProfile", () => {
  it("mostra nome, posição e métricas do participante (perfil alheio)", () => {
    okRanking(ranking, stats);
    render(<ParticipantProfile uid="u-x" />, { wrapper });
    expect(screen.getAllByText("Lucas Pereira").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("#5")).toBeTruthy();
    expect(screen.getByText("de 2 participantes")).toBeTruthy();
    // Sem palpites encerrados carregados → Acertos = 0 (não é mais entry.points)
    expect(screen.getByText("Acertos")).toBeTruthy();
    // Desempenho por fase: grupos 6 pts, oitavas 3 pts.
    expect(screen.getByText("6 pts")).toBeTruthy();
  });

  it("grade de métricas tem 3 células: Acertos/Vitórias/Empates (sem Erros nem Aproveitamento)", () => {
    okRanking(ranking, stats);
    render(<ParticipantProfile uid="u-x" />, { wrapper });
    expect(screen.queryByText("Pontos")).toBeNull();
    expect(screen.queryByText("Erros")).toBeNull();
    expect(screen.queryByText("Aproveitamento")).toBeNull();
    expect(screen.getByText("Acertos")).toBeTruthy();
    expect(screen.getByText("Vitórias")).toBeTruthy();
    expect(screen.getByText("Empates")).toBeTruthy();
  });

  it("Acertos/Vitórias/Empates derivam de displayStatus: acertou=1, acertou_vencedor=2, acertou_empate=1", () => {
    okRanking(ranking, stats);
    const base: ProfilePredictionsResult["items"][number] = {
      matchId: "m1",
      kickoffAt: "2026-06-20T18:00:00.000Z",
      stage: "grupos",
      groupId: "A",
      homeTeam: { id: "t-h", name: "Brasil", flagUrl: null },
      awayTeam: { id: "t-a", name: "Argentina", flagUrl: null },
      prediction: { homeScore: 2, awayScore: 1 },
      actualScore: { homeScore: 2, awayScore: 1 },
      matchStatus: "finished",
      displayStatus: "acertou",
    };
    useProfilePredictionsMock.mockReturnValue({
      ...emptyPredictions,
      items: [
        { ...base, matchId: "m1", displayStatus: "acertou" },
        { ...base, matchId: "m2", displayStatus: "acertou_vencedor" },
        { ...base, matchId: "m3", displayStatus: "acertou_vencedor" },
        { ...base, matchId: "m4", displayStatus: "acertou_empate" },
      ],
    });
    render(<ParticipantProfile uid="u-x" />, { wrapper });
    // Lê o valor dentro de cada card (escopado por <dt> → card), evitando colisão
    // com placares 2×1 renderizados na lista de palpites.
    const cardValue = (label: string): string =>
      within(screen.getByText(label).closest("div")!).getByText(/^\d+$/).textContent ?? "";
    expect(cardValue("Acertos")).toBe("1"); // displayStatus === "acertou"
    expect(cardValue("Vitórias")).toBe("2"); // displayStatus === "acertou_vencedor"
    expect(cardValue("Empates")).toBe("1"); // displayStatus === "acertou_empate"
  });

  it("Vitórias e Empates mostram 0 quando items está vazio", () => {
    okRanking(ranking, stats);
    render(<ParticipantProfile uid="u-x" />, { wrapper });
    // With empty predictions, wins=0 and draws=0
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });

  it("StagePerformance oculta fases com correctByStage === 0", () => {
    const statsOnlyGrupos: Statistics = {
      ...stats,
      correctByStage: { grupos: 5 },
    };
    okRanking(ranking, statsOnlyGrupos);
    render(<ParticipantProfile uid="u-x" />, { wrapper });
    // Fase de Grupos visível
    expect(screen.getByText("Fase de Grupos")).toBeTruthy();
    // Oitavas ocultas (correctByStage não inclui oitavas → 0)
    expect(screen.queryByText("Oitavas de Final")).toBeNull();
  });

  it("estado 'não encontrado' quando uid não está no ranking", () => {
    okRanking(ranking, null);
    render(<ParticipantProfile uid="u-zzz" />, { wrapper });
    expect(screen.getByText("Participante não encontrado")).toBeTruthy();
  });

  it("próprio perfil: título 'Meu Perfil', BettorDnaCard presente, ProfileComparisonCard ausente", () => {
    authMock.mockReturnValue({ profile: { groupId: "pool-1", uid: "u-x" } });
    okRanking(ranking, stats);
    render(<ParticipantProfile uid="u-x" />, { wrapper });
    expect(screen.getByText("Meu Perfil")).toBeTruthy();
    // BettorDnaCard presente
    expect(screen.getByText("DNA do Palpiteiro")).toBeTruthy();
    // ProfileComparisonCard ausente (isSelf)
    expect(screen.queryByText(/Você ×/)).toBeNull();
  });

  it("perfil alheio: título exibe nome, legenda anti-cola visível, BettorDnaCard ausente", () => {
    okRanking(ranking, stats);
    render(<ParticipantProfile uid="u-x" />, { wrapper });
    expect(screen.getAllByText("Lucas Pereira").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Meu Perfil")).toBeNull();
    // Legenda anti-cola visível
    expect(screen.getAllByText(/apenas jogos encerrados/i).length).toBeGreaterThan(0);
    // BettorDnaCard ausente
    expect(screen.queryByText("DNA do Palpiteiro")).toBeNull();
  });

  it("loading state: exibe RankingSkeleton quando qualquer query carrega", () => {
    usePoolRankingByScopeMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    usePoolRankingMock.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    useParticipantProfileMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useProfilePredictionsMock.mockReturnValue(emptyPredictions);
    useMatchesMock.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<ParticipantProfile uid="u-x" />, { wrapper });
    // RankingSkeleton usa animate-pulse — confirma que não renderiza conteúdo
    expect(screen.queryByText("Lucas Pereira")).toBeNull();
    expect(screen.queryByText("Participante não encontrado")).toBeNull();
  });

  it("error state: exibe RankingErrorState quando alguma query falha", () => {
    usePoolRankingByScopeMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    usePoolRankingMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });
    useParticipantProfileMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useProfilePredictionsMock.mockReturnValue(emptyPredictions);
    useMatchesMock.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<ParticipantProfile uid="u-x" />, { wrapper });
    expect(screen.getByText("Tentar Novamente")).toBeTruthy();
  });

  it("CR-01: erro em scope query (flag ON) exibe RankingErrorState, não 'sem dados'", () => {
    const splitRanking = {
      ...ranking,
      splitPhaseRanking: true,
    } as unknown as Ranking;
    usePoolRankingMock.mockReturnValue({
      data: splitRanking,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    // grupos OK, eliminatorias falha → splitOn=true e isError deve propagar
    usePoolRankingByScopeMock.mockImplementation((scope: string) => ({
      data: null,
      isLoading: false,
      isError: scope === "eliminatorias",
      refetch: vi.fn(),
    }));
    useParticipantProfileMock.mockReturnValue({
      data: stats,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useProfilePredictionsMock.mockReturnValue(emptyPredictions);
    useMatchesMock.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<ParticipantProfile uid="u-x" />, { wrapper });
    expect(screen.getByText("Tentar Novamente")).toBeTruthy();
  });

  it("aceita avatarUrl no header e mantém iniciais + aria-label", () => {
    const withPhoto: Ranking = {
      ...ranking,
      entries: [
        { ...ranking.entries[1]!, avatarUrl: "data:image/jpeg;base64,QUJD" },
      ],
    };
    okRanking(withPhoto, stats);
    render(<ParticipantProfile uid="u-x" />, { wrapper });
    // Avatar acessível por nome (aria-label) preservado.
    expect(screen.getByLabelText("Lucas Pereira")).toBeTruthy();
    // Sem foto renderizada (jsdom) → iniciais "LP" no fallback.
    expect(screen.getByText("LP")).toBeTruthy();
  });

  it("seção de palpites ausente quando items está vazio", () => {
    okRanking(ranking, stats);
    render(<ParticipantProfile uid="u-x" />, { wrapper });
    expect(screen.queryByText("Histórico de Palpites")).toBeNull();
  });

  it("perfil alheio: ProfileComparisonCard presente (Você × Nome)", () => {
    okRanking(ranking, stats);
    render(<ParticipantProfile uid="u-x" />, { wrapper });
    // Card de comparação visível (espectador u-a vendo perfil de u-x)
    expect(screen.getByText(/Você ×/)).toBeTruthy();
  });

  it("accordion de palpites presente quando há items", () => {
    okRanking(ranking, stats);
    const finishedItem: ProfilePredictionsResult["items"][number] = {
      matchId: "m1",
      kickoffAt: "2026-06-20T18:00:00.000Z",
      stage: "grupos",
      groupId: "A",
      homeTeam: { id: "t-h", name: "Brasil", flagUrl: null },
      awayTeam: { id: "t-a", name: "Argentina", flagUrl: null },
      prediction: { homeScore: 2, awayScore: 1 },
      actualScore: { homeScore: 2, awayScore: 1 },
      matchStatus: "finished",
      displayStatus: "acertou",
    };
    useProfilePredictionsMock.mockReturnValue({
      ...emptyPredictions,
      items: [finishedItem],
    });
    render(<ParticipantProfile uid="u-x" />, { wrapper });
    expect(screen.getByText("Histórico de Palpites")).toBeTruthy();
    // Sub-bucket de grupo renderizado no accordion (label único)
    expect(screen.getByText("Grupo A")).toBeTruthy();
  });
});

describe("ParticipantProfile — split-phase-ranking", () => {
  it("flag OFF: CurrentPositionCard renderizado, sem blocos Grupos/Eliminatórias", () => {
    okRanking(ranking, stats);
    render(<ParticipantProfile uid="u-x" />, { wrapper });
    expect(screen.getByText("Posição Atual")).toBeTruthy();
    // Rótulos do DualPositionCard ausentes
    expect(screen.queryByText("Grupos")).toBeNull();
    expect(screen.queryByText("Eliminatórias")).toBeNull();
  });

  it("flag ON: DualPositionCard renderizado, CurrentPositionCard ausente", () => {
    const splitRanking = { ...ranking, splitPhaseRanking: true };
    usePoolRankingMock.mockReturnValue({
      data: splitRanking,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    // Grupos: ranking com u-x; Eliminatórias: null (fase não existe ainda)
    usePoolRankingByScopeMock.mockImplementation((scope: string) => ({
      data: scope === "grupos" ? ranking : null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
    useParticipantProfileMock.mockReturnValue({
      data: stats,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useProfilePredictionsMock.mockReturnValue(emptyPredictions);
    useMatchesMock.mockReturnValue({ data: [], isLoading: false, isError: false });

    render(<ParticipantProfile uid="u-x" />, { wrapper });

    expect(screen.getByText("Grupos")).toBeTruthy();
    expect(screen.getByText("Eliminatórias")).toBeTruthy();
    expect(screen.queryByText("Posição Atual")).toBeNull();
  });

  it("flag ON + eliminatorias null: bloco Eliminatórias mostra 'Ainda sem dados'", () => {
    const splitRanking = { ...ranking, splitPhaseRanking: true };
    usePoolRankingMock.mockReturnValue({
      data: splitRanking,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    // Ambos escopos sem dados → ambos os blocos mostram "Ainda sem dados"
    usePoolRankingByScopeMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useParticipantProfileMock.mockReturnValue({
      data: stats,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useProfilePredictionsMock.mockReturnValue(emptyPredictions);
    useMatchesMock.mockReturnValue({ data: [], isLoading: false, isError: false });

    render(<ParticipantProfile uid="u-x" />, { wrapper });

    expect(screen.getByLabelText(/Eliminatórias: ainda sem dados/i)).toBeTruthy();
    // Pelo menos um bloco sem dados (eliminatorias)
    expect(screen.getAllByText("Ainda sem dados").length).toBeGreaterThanOrEqual(1);
  });

  it("flag ON + grupos com dados: posição visível no bloco Grupos", () => {
    const splitRanking = { ...ranking, splitPhaseRanking: true };
    usePoolRankingMock.mockReturnValue({
      data: splitRanking,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    usePoolRankingByScopeMock.mockImplementation((scope: string) => ({
      // ranking tem u-x em position 5 de 2 participantes
      data: scope === "grupos" ? ranking : null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
    useParticipantProfileMock.mockReturnValue({
      data: stats,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useProfilePredictionsMock.mockReturnValue(emptyPredictions);
    useMatchesMock.mockReturnValue({ data: [], isLoading: false, isError: false });

    render(<ParticipantProfile uid="u-x" />, { wrapper });

    // Bloco Grupos tem posição: u-x position=5 de 2 participantes
    expect(screen.getByLabelText(/Grupos: posição 5 de 2 participantes/i)).toBeTruthy();
    expect(screen.getByLabelText(/Eliminatórias: ainda sem dados/i)).toBeTruthy();
  });
});
