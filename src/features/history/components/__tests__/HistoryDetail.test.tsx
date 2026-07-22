// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useChampionshipHistoryMock, useAuthMock } = vi.hoisted(() => ({
  useChampionshipHistoryMock: vi.fn(),
  useAuthMock: vi.fn(),
}));

vi.mock("@/features/history/hooks", () => ({
  useChampionshipHistory: useChampionshipHistoryMock,
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: useAuthMock }));

// Mocka o barrel de rankings inteiro (mesmo motivo/padrão de
// HistoryLanding.test.tsx e GeneralRanking.test.tsx): evita a cadeia
// GeneralRanking → @/services → Firebase client. Fakes leves que preservam o
// comportamento observável (loading/error/empty/dados) usado por HistoryDetail.
vi.mock("@/features/rankings", () => ({
  RankingSkeleton: () => (
    <div role="status" aria-label="Carregando ranking">
      skeleton
    </div>
  ),
  RankingErrorState: ({ onRetry }: { onRetry: () => void }) => (
    <div role="alert">
      <button onClick={onRetry}>Tentar Novamente</button>
    </div>
  ),
  RankingEmptyState: ({ message }: { message?: string }) => (
    <div role="status">{message ?? "Nenhum participante encontrado"}</div>
  ),
  RankingView: ({
    query,
  }: {
    query: {
      data: { entries: Array<{ uid: string; name?: string; nickname: string; points: number }> } | null | undefined;
      isLoading: boolean;
      isError: boolean;
    };
  }) => {
    if (query.isLoading) return <div role="status">Carregando ranking</div>;
    if (query.isError) return <div role="alert">Erro no ranking</div>;
    if (!query.data || query.data.entries.length === 0) {
      return <div role="status">Nenhum participante encontrado</div>;
    }
    return (
      <ul aria-label="ranking congelado">
        {query.data.entries.map((e) => (
          <li key={e.uid}>
            {e.name ?? e.nickname} — {e.points} pts
          </li>
        ))}
      </ul>
    );
  },
}));

// FrozenMatchList depende de useTeams (react-query + fetch real) — fora do
// escopo desta tela (não listado nas cenas obrigatórias do detalhe); stub
// isolado evita rede/act warnings sem alterar produção.
vi.mock("@/features/history/components/FrozenMatchList", () => ({
  FrozenMatchList: () => <div data-testid="frozen-match-list">jogos congelados</div>,
}));

// Import por path direto p/ não cair no mock do barrel de history.
import { HistoryDetail } from "@/features/history/components/HistoryDetail";

function championshipHistory(overrides: Record<string, unknown> = {}) {
  return {
    championship: {
      id: "fifa.world",
      name: "Copa do Mundo FIFA",
      season: "2026",
      type: "cup" as const,
      status: "archived" as const,
    },
    ranking: [
      { uid: "u1", nickname: "ana", name: "Ana Silva", position: 1, points: 30 },
      { uid: "u2", nickname: "beto", name: "Beto Souza", position: 2, points: 20 },
    ],
    rankingScope: "pool" as const,
    statistics: [
      { uid: "u1", totalCorrect: 5, accuracy: 70, longestStreak: 3 },
      { uid: "u2", totalCorrect: 3, accuracy: 50, longestStreak: 2 },
    ],
    archivedAt: "2026-01-10T00:00:00.000Z",
    matches: [],
    ...overrides,
  };
}

const okQuery = (data: unknown) => ({ data, isLoading: false, isError: false, refetch: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
  useAuthMock.mockReturnValue({ firebaseUser: { uid: "u1" } });
});
afterEach(() => vi.clearAllMocks());

describe("HistoryDetail", () => {
  it("loading → skeleton", () => {
    useChampionshipHistoryMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    render(<HistoryDetail championshipId="fifa.world" />);
    expect(screen.getByRole("status", { name: "Carregando ranking" })).toBeTruthy();
    expect(screen.queryByText("Copa do Mundo FIFA")).toBeNull();
  });

  it("erro → estado de erro com retry", () => {
    useChampionshipHistoryMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });
    render(<HistoryDetail championshipId="fifa.world" />);
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("data null (404) → mensagem dedicada + link de volta ao Histórico", () => {
    useChampionshipHistoryMock.mockReturnValue(okQuery(null));
    render(<HistoryDetail championshipId="fifa.world" />);
    expect(screen.getByText("Campeonato não encontrado no histórico")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voltar ao Histórico" })).toBeTruthy();
  });

  it("renderiza FrozenBanner + as 3 abas (Ranking/Jogos/Estatísticas)", () => {
    useChampionshipHistoryMock.mockReturnValue(okQuery(championshipHistory()));
    render(<HistoryDetail championshipId="fifa.world" />);
    expect(
      screen.getByText("Campeonato encerrado — ranking, jogos e estatísticas congelados."),
    ).toBeTruthy();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Ranking", "Jogos", "Estatísticas"]);
  });

  it("aba Ranking mostra as entries do ranking congelado (via RankingView)", () => {
    useChampionshipHistoryMock.mockReturnValue(okQuery(championshipHistory()));
    render(<HistoryDetail championshipId="fifa.world" />);
    expect(screen.getByText("Ana Silva — 30 pts")).toBeTruthy();
    expect(screen.getByText("Beto Souza — 20 pts")).toBeTruthy();
  });

  it("aba Estatísticas COM statistics → mostra os cards agregados", () => {
    useChampionshipHistoryMock.mockReturnValue(okQuery(championshipHistory()));
    render(<HistoryDetail championshipId="fifa.world" />);
    expect(screen.getByText("Participantes")).toBeTruthy();
    // 2 participantes, médias/streak agregadas pela FrozenStats real.
    expect(screen.getByText("2")).toBeTruthy(); // contagem de participantes
  });

  it("aba Estatísticas SEM statistics (snapshot geral) → estado indisponível", () => {
    useChampionshipHistoryMock.mockReturnValue(
      okQuery(championshipHistory({ rankingScope: "geral", statistics: undefined })),
    );
    render(<HistoryDetail championshipId="fifa.world" />);
    expect(
      screen.getByText("Estatísticas indisponíveis para este campeonato"),
    ).toBeTruthy();
    expect(screen.queryByText("Participantes")).toBeNull();
  });
});
