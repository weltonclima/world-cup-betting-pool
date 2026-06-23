// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CurrentStageBanner } from "@/features/home/components/CurrentStageBanner";

describe("CurrentStageBanner (TASK-04)", () => {
  it("renderiza 'Copa em:' + rótulo pt-BR da fase", () => {
    render(<CurrentStageBanner stage="oitavas" />);
    expect(screen.getByText(/Copa em:/)).toBeTruthy();
    expect(screen.getByText("Oitavas de Final")).toBeTruthy();
  });

  it("usa o rótulo do agregado mata-mata para dezesseis-avos", () => {
    render(<CurrentStageBanner stage="dezesseis-avos" />);
    expect(screen.getByText("16-avos de Final")).toBeTruthy();
  });

  it("não renderiza nada quando stage é null (degrada silenciosamente)", () => {
    const { container } = render(<CurrentStageBanner stage={null} />);
    expect(container.firstChild).toBeNull();
  });
});
