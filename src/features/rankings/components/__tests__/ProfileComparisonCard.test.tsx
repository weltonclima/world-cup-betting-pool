// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProfileComparisonCard } from "@/features/rankings/components/profile";
import type { ProfileComparison } from "@/features/rankings/lib";
import type { RankingEntry } from "@/types/rankings";

function makeEntry(
  uid: string,
  points: number,
  position: number,
): RankingEntry {
  return { uid, nickname: uid, points, position, wrong: 0, accuracy: 100 };
}

function makeComparison(pointsDiff: number): ProfileComparison {
  return { pointsDiff, positionDiff: 0, otherCorrectMyWrong: 0 };
}

function renderCard(myPoints: number, otherPoints: number) {
  const my = makeEntry("me", myPoints, 3);
  const other = makeEntry("kaique", otherPoints, 4);
  // mesmo sinal usado em deriveProfileComparison: other - my
  const comparison = makeComparison(otherPoints - myPoints);
  render(
    <ProfileComparisonCard
      myEntry={my}
      otherEntry={other}
      comparison={comparison}
      displayName="Kaique da Silva Pereira"
    />,
  );
}

describe("ProfileComparisonCard — label de diferença de pontos", () => {
  it("eu na frente (regressão do bug): diz que VOCÊ está à frente, não o outro", () => {
    // Você 25 pts vs Kaique 20 pts → você 5 pts na frente
    renderCard(25, 20);
    expect(screen.getByText("Você está 5 pts à frente")).toBeTruthy();
    expect(screen.queryByText(/à sua frente/)).toBeNull();
  });

  it("eu atrás: diz que VOCÊ está atrás", () => {
    // Você 20 pts vs Kaique 26 pts → você 6 pts atrás
    renderCard(20, 26);
    expect(screen.getByText("Você está 6 pts atrás")).toBeTruthy();
  });

  it("empate em pontos", () => {
    renderCard(20, 20);
    expect(screen.getByText("Empatados em pontos")).toBeTruthy();
  });
});
