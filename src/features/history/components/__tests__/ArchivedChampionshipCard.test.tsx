// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ArchivedChampionshipCard } from "@/features/history/components/ArchivedChampionshipCard";

// Mesmo formatter do componente — evita hardcode de string sensível a locale/ICU.
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const ARCHIVED_AT = "2026-03-05T12:00:00.000Z";
const formattedDate = dateFormatter.format(new Date(ARCHIVED_AT));

describe("ArchivedChampionshipCard", () => {
  it("renderiza nome, temporada e o link para o detalhe do Histórico", () => {
    render(
      <ArchivedChampionshipCard
        championshipId="fifa.world"
        name="Copa do Mundo FIFA"
        season="2026"
        type="cup"
        archivedAt={ARCHIVED_AT}
      />,
    );
    expect(screen.getByText("Copa do Mundo FIFA")).toBeTruthy();
    expect(screen.getByText("Temporada 2026")).toBeTruthy();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/rankings/history/fifa.world");
  });

  it("mostra o badge textual do tipo — Copa (color-not-only)", () => {
    render(
      <ArchivedChampionshipCard
        championshipId="fifa.world"
        name="Copa do Mundo FIFA"
        season="2026"
        type="cup"
        archivedAt={ARCHIVED_AT}
      />,
    );
    expect(screen.getByText("Copa")).toBeTruthy();
  });

  it("mostra o badge textual do tipo — Liga (color-not-only)", () => {
    render(
      <ArchivedChampionshipCard
        championshipId="bra.1-2026"
        name="Brasileirão Série A"
        season="2026"
        type="league"
        archivedAt={ARCHIVED_AT}
      />,
    );
    expect(screen.getByText("Liga")).toBeTruthy();
  });

  it("formata a data de arquivamento em PT-BR", () => {
    render(
      <ArchivedChampionshipCard
        championshipId="fifa.world"
        name="Copa do Mundo FIFA"
        season="2026"
        type="cup"
        archivedAt={ARCHIVED_AT}
      />,
    );
    expect(screen.getByText(`Arquivado em ${formattedDate}`)).toBeTruthy();
  });

  it("expõe aria-label completo (nome, temporada, tipo, data) no link", () => {
    render(
      <ArchivedChampionshipCard
        championshipId="fifa.world"
        name="Copa do Mundo FIFA"
        season="2026"
        type="cup"
        archivedAt={ARCHIVED_AT}
      />,
    );
    expect(
      screen.getByLabelText(
        `Copa do Mundo FIFA, temporada 2026, Copa, arquivado em ${formattedDate}. Ver histórico.`,
      ),
    ).toBeTruthy();
  });
});
