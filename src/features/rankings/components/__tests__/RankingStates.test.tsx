// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RankingEmptyState } from "@/features/rankings/components/RankingEmptyState";
import { RankingErrorState } from "@/features/rankings/components/RankingErrorState";
import { RankingSkeleton } from "@/features/rankings/components/RankingSkeleton";

describe("RankingErrorState", () => {
  it("mostra mensagem padrão e chama onRetry ao clicar", () => {
    const onRetry = vi.fn();
    render(<RankingErrorState onRetry={onRetry} />);
    expect(screen.getByText("Erro ao carregar ranking")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("RankingEmptyState", () => {
  it("mostra mensagem padrão", () => {
    render(<RankingEmptyState />);
    expect(screen.getByText("Nenhum participante encontrado")).toBeTruthy();
  });

  it("mostra subtítulo quando fornecido", () => {
    render(<RankingEmptyState subtitle="Aguardando aprovações" />);
    expect(screen.getByText("Aguardando aprovações")).toBeTruthy();
  });
});

describe("RankingSkeleton", () => {
  it("renderiza o estado de carregamento acessível", () => {
    render(<RankingSkeleton rows={3} />);
    expect(
      screen.getByRole("status", { name: "Carregando ranking" }),
    ).toBeTruthy();
  });
});
