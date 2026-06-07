// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  MatchCardSkeleton,
  MatchListSkeleton,
} from "@/features/matches/components/MatchListSkeleton";

describe("MatchCardSkeleton", () => {
  it("T1: tem role='status'", () => {
    render(<MatchCardSkeleton />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("T2: tem aria-busy='true'", () => {
    render(<MatchCardSkeleton />);
    const el = screen.getByRole("status");
    expect(el.getAttribute("aria-busy")).toBe("true");
  });

  it("T3: tem aria-label 'Carregando jogo'", () => {
    render(<MatchCardSkeleton />);
    expect(screen.getByRole("status", { name: "Carregando jogo" })).toBeTruthy();
  });
});

describe("MatchListSkeleton", () => {
  it("T4: tem role='status' global com aria-label 'Carregando jogos'", () => {
    render(<MatchListSkeleton />);
    // O wrapper tem role="status"
    expect(screen.getByRole("status", { name: "Carregando jogos" })).toBeTruthy();
  });

  it("T5: renderiza 3 skeletons por default", () => {
    render(<MatchListSkeleton />);
    // Cada MatchCardSkeleton tem role="status" — o wrapper também tem, total 4
    // Verificamos pelo aria-label específico de cada card
    const cardSkeletons = screen.getAllByRole("status", { name: "Carregando jogo" });
    expect(cardSkeletons).toHaveLength(3);
  });

  it("T6: respeita prop count=5", () => {
    render(<MatchListSkeleton count={5} />);
    const cardSkeletons = screen.getAllByRole("status", { name: "Carregando jogo" });
    expect(cardSkeletons).toHaveLength(5);
  });

  it("T7: respeita prop count=1", () => {
    render(<MatchListSkeleton count={1} />);
    const cardSkeletons = screen.getAllByRole("status", { name: "Carregando jogo" });
    expect(cardSkeletons).toHaveLength(1);
  });
});
