// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// FrozenStats importa `RankingEmptyState` do barrel de rankings — mocka o
// barrel inteiro (mesmo motivo de HistoryLanding/HistoryDetail: evita a cadeia
// GeneralRanking → @/services → Firebase client).
vi.mock("@/features/rankings", () => ({
  RankingEmptyState: ({ message }: { message?: string }) => (
    <div role="status">{message ?? "Nenhum participante encontrado"}</div>
  ),
}));

import { FrozenStats } from "@/features/history/components/FrozenStats";
import type { HistoryParticipantStat } from "@/schemas/history";
import type { RankingEntry } from "@/types";

const ranking: RankingEntry[] = [
  { uid: "u1", nickname: "ana", name: "Ana Silva", position: 1, points: 30 },
  { uid: "u2", nickname: "beto", name: "Beto Souza", position: 2, points: 20 },
  { uid: "u3", nickname: "caio", name: "Caio Lima", position: 3, points: 10 },
];

const statistics: HistoryParticipantStat[] = [
  { uid: "u1", totalCorrect: 6, accuracy: 80, longestStreak: 5 },
  { uid: "u2", totalCorrect: 4, accuracy: 60, longestStreak: 3 },
  { uid: "u3", totalCorrect: 2, accuracy: 40, longestStreak: 1 },
];

describe("FrozenStats", () => {
  it("agrega participantes, média de aproveitamento, maior sequência e total de acertos", () => {
    render(<FrozenStats statistics={statistics} ranking={ranking} />);

    expect(screen.getByText("Participantes")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy(); // 3 participantes

    expect(screen.getByText("Média de aproveitamento")).toBeTruthy();
    // (80+60+40)/3 = 60.0 → pt-BR "60,0%"
    expect(screen.getByText("60,0%")).toBeTruthy();

    expect(screen.getByText("Maior sequência")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy(); // max(5,3,1)

    expect(screen.getByText("Total de acertos exatos")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy(); // 6+4+2
  });

  it("statistics undefined → estado indisponível (sem cards)", () => {
    render(<FrozenStats statistics={undefined} ranking={ranking} />);
    expect(
      screen.getByText("Estatísticas indisponíveis para este campeonato"),
    ).toBeTruthy();
    expect(screen.queryByText("Participantes")).toBeNull();
  });

  it("statistics vazio ([]) → mesmo estado indisponível", () => {
    render(<FrozenStats statistics={[]} ranking={ranking} />);
    expect(
      screen.getByText("Estatísticas indisponíveis para este campeonato"),
    ).toBeTruthy();
  });
});
