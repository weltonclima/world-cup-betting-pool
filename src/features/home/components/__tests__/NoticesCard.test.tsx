// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NoticesCard, NoticesCardSkeleton } from "@/features/home/components/NoticesCard";
import type { SystemNotice } from "@/features/home/lib/homeDashboardHelpers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WARNING_NOTICE: SystemNotice = {
  id: "predictions-locked",
  message: "Palpites encerrados para esta fase.",
  severity: "warning",
};

const INFO_NOTICE: SystemNotice = {
  id: "registration-closed",
  message: "Cadastros encerrados.",
  severity: "info",
};

const KICKOFF_NOTICE: SystemNotice = {
  id: "kickoff-soon",
  message: "Prazo encerra em 1h 30min.",
  severity: "warning",
};

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("NoticesCard", () => {
  it("T1: renderiza lista de avisos corretamente", () => {
    render(<NoticesCard notices={[WARNING_NOTICE, INFO_NOTICE]} />);

    expect(screen.getByText("Palpites encerrados para esta fase.")).toBeTruthy();
    expect(screen.getByText("Cadastros encerrados.")).toBeTruthy();
  });

  it("T2: exibe estado vazio quando notices está vazio", () => {
    render(<NoticesCard notices={[]} />);

    expect(screen.getByText("Nenhum aviso no momento")).toBeTruthy();
  });

  it("T3: <section> tem aria-label='Avisos do sistema'", () => {
    render(<NoticesCard notices={[]} />);

    // <section> com aria-label mapeia para o papel ARIA "region"
    const section = screen.getByRole("region", { name: "Avisos do sistema" });
    expect(section).toBeTruthy();
  });

  it("T4: exibe título 'Avisos' no card", () => {
    render(<NoticesCard notices={[WARNING_NOTICE]} />);

    // O heading deve conter o texto "Avisos"
    expect(screen.getByRole("heading", { name: /Avisos/i })).toBeTruthy();
  });

  it("T5: múltiplos avisos são todos renderizados", () => {
    render(
      <NoticesCard
        notices={[WARNING_NOTICE, INFO_NOTICE, KICKOFF_NOTICE]}
      />
    );

    expect(screen.getByText("Palpites encerrados para esta fase.")).toBeTruthy();
    expect(screen.getByText("Cadastros encerrados.")).toBeTruthy();
    expect(screen.getByText("Prazo encerra em 1h 30min.")).toBeTruthy();
  });

  it("T6: estado vazio não exibe mensagens de aviso", () => {
    render(<NoticesCard notices={[]} />);

    // Texto de aviso não deve aparecer
    expect(
      screen.queryByText("Palpites encerrados para esta fase.")
    ).toBeNull();
  });

  it("T7: aviso único é renderizado sem listar outros", () => {
    render(<NoticesCard notices={[WARNING_NOTICE]} />);

    expect(screen.getByText("Palpites encerrados para esta fase.")).toBeTruthy();
    // Aviso de info não deve aparecer
    expect(screen.queryByText("Cadastros encerrados.")).toBeNull();
  });
});

describe("NoticesCardSkeleton", () => {
  it("T8: skeleton é renderizado com aria-label de carregamento", () => {
    render(<NoticesCardSkeleton />);

    // Skeleton usa aria-label explícito e role="status"
    const skeleton = screen.getByRole("status", { name: "Carregando Avisos" });
    expect(skeleton).toBeTruthy();
  });
});
