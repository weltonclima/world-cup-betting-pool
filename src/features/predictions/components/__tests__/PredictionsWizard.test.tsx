// @vitest-environment jsdom
/**
 * Testes da casca do wizard (TASK-16).
 * Cobre o componente PredictionsWizard (render condicional, indicador de etapa,
 * Anterior/Próximo, sair) e a regressão de navegação A8 (item "Palpites" → Hub).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PredictionsWizard } from "@/features/predictions/components/PredictionsWizard";
import { NAV_ITEMS } from "@/components/layout/nav-items";

function renderBar(
  overrides: Partial<React.ComponentProps<typeof PredictionsWizard>> = {},
) {
  const onExit = vi.fn();
  render(
    <PredictionsWizard
      stepIndex={4}
      totalSteps={10}
      stepLabel="16 avos"
      prevHref="/predictions/melhores-terceiros"
      nextHref="/predictions/chave/oitavas"
      active
      onExit={onExit}
      {...overrides}
    />,
  );
  return { onExit };
}

describe("PredictionsWizard", () => {
  it("não renderiza quando o modo está inativo", () => {
    renderBar({ active: false });
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("não renderiza quando fora do wizard (stepIndex null)", () => {
    renderBar({ stepIndex: null });
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("renderiza o indicador de etapa (1-based) com rótulo", () => {
    renderBar();
    expect(screen.getByText("Etapa 5 de 10 · 16 avos")).toBeTruthy();
    expect(screen.getByText("Completar Copa")).toBeTruthy();
  });

  it("renderiza Anterior e Próximo com os hrefs corretos", () => {
    renderBar();
    const prev = screen.getByRole("link", { name: "Etapa anterior" });
    const next = screen.getByRole("link", { name: "Próxima etapa" });
    expect(prev.getAttribute("href")).toBe("/predictions/melhores-terceiros");
    expect(next.getAttribute("href")).toBe("/predictions/chave/oitavas");
  });

  it("oculta Anterior na primeira etapa", () => {
    renderBar({ prevHref: undefined });
    expect(screen.queryByRole("link", { name: "Etapa anterior" })).toBeNull();
    expect(screen.getByRole("link", { name: "Próxima etapa" })).toBeTruthy();
  });

  it("oculta Próximo na última etapa", () => {
    renderBar({ nextHref: undefined });
    expect(screen.queryByRole("link", { name: "Próxima etapa" })).toBeNull();
    expect(screen.getByRole("link", { name: "Etapa anterior" })).toBeTruthy();
  });

  it("chama onExit ao sair do modo guiado", () => {
    const { onExit } = renderBar();
    fireEvent.click(screen.getByRole("button", { name: /sair do modo guiado/i }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe("Navegação A8", () => {
  it("o item Palpites aponta para o Hub /predictions", () => {
    const palpites = NAV_ITEMS.find((i) => i.label === "Palpites");
    expect(palpites?.href).toBe("/predictions");
  });
});
