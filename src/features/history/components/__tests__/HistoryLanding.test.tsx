// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useArchivedChampionshipsMock } = vi.hoisted(() => ({
  useArchivedChampionshipsMock: vi.fn(),
}));

// Mocka o hook (barrel de hooks) — evita bater no service real / fetch.
vi.mock("@/features/history/hooks", () => ({
  useArchivedChampionships: useArchivedChampionshipsMock,
}));
// Mocka o barrel de rankings: HistoryLanding só usa `RankingErrorState`, mas o
// barrel real reexporta `GeneralRanking` → `@/services` → cadeia do Firebase
// client (memória: "Firebase Env Test Coupling"). Mesmo padrão de
// GeneralRanking.test.tsx / PhaseRanking.test.tsx (mocka o barrel inteiro).
vi.mock("@/features/rankings", () => ({
  RankingErrorState: ({
    message,
    onRetry,
  }: {
    message?: string;
    onRetry: () => void;
  }) => (
    <div role="alert">
      <p>{message ?? "Erro ao carregar ranking"}</p>
      <button onClick={onRetry}>Tentar Novamente</button>
    </div>
  ),
}));

// Import por path direto p/ não cair no mock do barrel de history.
import { HistoryLanding } from "@/features/history/components/HistoryLanding";

function item(overrides: Record<string, unknown> = {}) {
  return {
    championshipId: "fifa.world",
    name: "Copa do Mundo FIFA",
    season: "2026",
    type: "cup" as const,
    archivedAt: "2026-01-10T00:00:00.000Z",
    hasPoolSnapshot: true,
    ...overrides,
  };
}

const okQuery = (data: unknown) => ({
  data,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => vi.clearAllMocks());

describe("HistoryLanding", () => {
  it("loading → mostra skeletons (sem cards nem empty state)", () => {
    useArchivedChampionshipsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    render(<HistoryLanding />);
    expect(screen.getByRole("status", { name: "Carregando histórico" })).toBeTruthy();
    expect(screen.queryByText("Nenhum campeonato no histórico")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("erro → mostra o estado de erro com retry", () => {
    const refetch = vi.fn();
    useArchivedChampionshipsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });
    render(<HistoryLanding />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Erro ao carregar o histórico")).toBeTruthy();
  });

  it("lista vazia → HistoryEmptyState ('Nenhum campeonato no histórico')", () => {
    useArchivedChampionshipsMock.mockReturnValue(okQuery([]));
    render(<HistoryLanding />);
    expect(screen.getByText("Nenhum campeonato no histórico")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("populado → renderiza um ArchivedChampionshipCard por item", () => {
    useArchivedChampionshipsMock.mockReturnValue(
      okQuery([
        item({ championshipId: "fifa.world", name: "Copa do Mundo FIFA" }),
        item({ championshipId: "bra.1-2026", name: "Brasileirão Série A", type: "league" }),
      ]),
    );
    render(<HistoryLanding />);
    expect(screen.getByText("Copa do Mundo FIFA")).toBeTruthy();
    expect(screen.getByText("Brasileirão Série A")).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.queryByText("Nenhum campeonato no histórico")).toBeNull();
  });
});
