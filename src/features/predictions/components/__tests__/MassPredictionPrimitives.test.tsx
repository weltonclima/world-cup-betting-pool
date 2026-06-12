// @vitest-environment jsdom
/**
 * Testes das primitivas UI do fluxo de palpites em massa (TASK-06).
 *
 * Cobre:
 * - CompactScoreInput: render + aria-label, digitação, filtro de não-dígitos,
 *   esvaziar → null, clamp no max, disabled/locked, invalid (aria-invalid +
 *   mensagem), inputMode numeric, navegação TAB (ordem do DOM, sem tabIndex+).
 * - ProgressBar: percentual, role/aria, fração "X / Y", total=0, clamp value>total.
 * - PhaseCard: navegável (link + aria), bloqueado (sem link), concluído (✓), pendentes.
 * - GroupCard: nome + fração, concluído ✓, selecionado (ring), link com aria.
 *
 * Padrão de asserção: espelha PredictionComponents.test.tsx (toBeTruthy / getAttribute).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompactScoreInput } from "../CompactScoreInput";
import { ProgressBar } from "../ProgressBar";
import { PhaseCard } from "../PhaseCard";
import { GroupCard } from "../GroupCard";

// ── CompactScoreInput ─────────────────────────────────────────────────────────

describe("CompactScoreInput", () => {
  it("renderiza com aria-label e inputMode numeric", () => {
    render(<CompactScoreInput label="Gols Brasil" value={null} onChange={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: "Gols Brasil" }) as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.getAttribute("inputmode")).toBe("numeric");
    expect(input.getAttribute("pattern")).toBe("[0-9]*");
    expect(input.value).toBe("");
  });

  it("exibe o valor numérico atual", () => {
    render(<CompactScoreInput label="Gols Brasil" value={3} onChange={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: "Gols Brasil" }) as HTMLInputElement;
    expect(input.value).toBe("3");
  });

  it("emite número ao digitar dígitos", () => {
    const onChange = vi.fn();
    render(<CompactScoreInput label="Gols Brasil" value={null} onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "Gols Brasil" });
    fireEvent.change(input, { target: { value: "2" } });
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("filtra caracteres não numéricos", () => {
    const onChange = vi.fn();
    render(<CompactScoreInput label="Gols Brasil" value={null} onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "Gols Brasil" });
    fireEvent.change(input, { target: { value: "a4b" } });
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("emite null ao esvaziar o campo", () => {
    const onChange = vi.fn();
    render(<CompactScoreInput label="Gols Brasil" value={2} onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "Gols Brasil" });
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("clampa no max configurado", () => {
    const onChange = vi.fn();
    render(<CompactScoreInput label="Gols Brasil" value={null} onChange={onChange} max={9} />);
    const input = screen.getByRole("textbox", { name: "Gols Brasil" });
    fireEvent.change(input, { target: { value: "99" } });
    expect(onChange).toHaveBeenCalledWith(9);
  });

  it("fica desabilitado quando disabled ou locked", () => {
    const { rerender } = render(
      <CompactScoreInput label="Gols Brasil" value={1} onChange={vi.fn()} disabled />,
    );
    expect((screen.getByRole("textbox", { name: "Gols Brasil" }) as HTMLInputElement).disabled).toBe(true);

    rerender(<CompactScoreInput label="Gols Brasil" value={1} onChange={vi.fn()} locked />);
    expect((screen.getByRole("textbox", { name: "Gols Brasil" }) as HTMLInputElement).disabled).toBe(true);
  });

  it("expõe aria-invalid e mensagem de erro quando invalid", () => {
    render(
      <CompactScoreInput
        label="Gols Brasil"
        value={null}
        onChange={vi.fn()}
        invalid
        errorMessage="Placar obrigatório"
      />,
    );
    const input = screen.getByRole("textbox", { name: "Gols Brasil" });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const error = screen.getByRole("alert");
    expect(error.textContent).toBe("Placar obrigatório");
    expect(input.getAttribute("aria-describedby")).toBe(error.getAttribute("id"));
  });

  it("permite navegação TAB pela ordem do DOM (sem tabIndex positivo)", () => {
    render(
      <div>
        <CompactScoreInput label="Gols Brasil" value={1} onChange={vi.fn()} />
        <CompactScoreInput label="Gols França" value={2} onChange={vi.fn()} />
      </div>,
    );
    const first = screen.getByRole("textbox", { name: "Gols Brasil" }) as HTMLInputElement;
    const second = screen.getByRole("textbox", { name: "Gols França" }) as HTMLInputElement;

    // Nenhum tabIndex positivo: ambos seguem a ordem natural do documento.
    expect(first.tabIndex).toBeLessThanOrEqual(0);
    expect(second.tabIndex).toBeLessThanOrEqual(0);

    first.focus();
    expect(document.activeElement).toBe(first);
    // Avança o foco para o próximo campo (simulação de TAB pela ordem do DOM).
    second.focus();
    expect(document.activeElement).toBe(second);
  });
});

// ── ProgressBar ───────────────────────────────────────────────────────────────

describe("ProgressBar", () => {
  it("renderiza role progressbar com aria de valor", () => {
    render(<ProgressBar value={72} total={104} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("72");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("104");
    expect(bar.getAttribute("aria-valuetext")).toContain("72 / 104");
  });

  it("exibe a fração e o percentual", () => {
    render(<ProgressBar value={72} total={104} />);
    expect(screen.getByText("72 / 104")).toBeTruthy();
    expect(screen.getByText("69%")).toBeTruthy();
  });

  it("trata total zero sem divisão por zero", () => {
    render(<ProgressBar value={0} total={0} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    expect(screen.getByText("0%")).toBeTruthy();
  });

  it("clampa value maior que total", () => {
    render(<ProgressBar value={150} total={100} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("oculta percentual quando showPercent é false", () => {
    render(<ProgressBar value={3} total={6} showPercent={false} />);
    expect(screen.queryByText("50%")).toBeNull();
    expect(screen.getByText("3 / 6")).toBeTruthy();
  });
});

// ── PhaseCard ─────────────────────────────────────────────────────────────────

describe("PhaseCard", () => {
  it("renderiza link navegável com aria-label e contagem de pendentes", () => {
    render(
      <PhaseCard
        title="Fase de Grupos"
        gamesCount={72}
        pendingCount={12}
        status="andamento"
        href="/predictions/groups"
      />,
    );
    const link = screen.getByRole("link", { name: /Fase de Grupos/ });
    expect(link.getAttribute("href")).toBe("/predictions/groups");
    expect(screen.getByText("12 pendentes · 72 jogos")).toBeTruthy();
  });

  it("não renderiza link quando bloqueado", () => {
    render(
      <PhaseCard
        title="Quartas de Final"
        gamesCount={4}
        pendingCount={4}
        status="bloqueado"
        href="/predictions/knockout/quartas"
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Bloqueado")).toBeTruthy();
    const card = screen.getByLabelText(/Quartas de Final/);
    expect(card.getAttribute("aria-disabled")).toBe("true");
  });

  it("mostra estado concluído", () => {
    render(
      <PhaseCard
        title="Fase de Grupos"
        gamesCount={72}
        pendingCount={0}
        status="concluido"
        href="/predictions/groups"
      />,
    );
    expect(screen.getByText("Concluído")).toBeTruthy();
  });
});

// ── GroupCard ─────────────────────────────────────────────────────────────────

describe("GroupCard", () => {
  it("renderiza nome, fração e link com aria-label", () => {
    render(
      <GroupCard
        name="Grupo C"
        filledCount={3}
        totalCount={6}
        status="andamento"
        href="/predictions/groups/C"
      />,
    );
    const link = screen.getByRole("link", { name: "Grupo C, 3 de 6 jogos, em andamento" });
    expect(link.getAttribute("href")).toBe("/predictions/groups/C");
    expect(screen.getByText("Grupo C")).toBeTruthy();
    expect(screen.getByText("3 / 6")).toBeTruthy();
  });

  it("marca aria-current quando selecionado", () => {
    render(
      <GroupCard name="Grupo A" filledCount={6} status="concluido" selected href="/x" />,
    );
    const link = screen.getByRole("link", { name: /Grupo A/ });
    expect(link.getAttribute("aria-current")).toBe("true");
  });

  it("renderiza sem link quando href ausente", () => {
    render(<GroupCard name="Grupo B" filledCount={0} status="nao-iniciado" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Grupo B")).toBeTruthy();
  });
});
