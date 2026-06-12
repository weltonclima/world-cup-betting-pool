// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeHeader } from "@/features/home/components/HomeHeader";

describe("HomeHeader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("T1: renderiza saudação com nome quando name é fornecido", () => {
    render(<HomeHeader name="Ana Lima" uid="abc123" />);

    expect(screen.getByText("Olá, Ana Lima 👋")).toBeTruthy();
  });

  it("T2: exibe fallback 'Olá 👋' quando name é null", () => {
    render(<HomeHeader name={null} uid={null} />);

    expect(screen.getByText("Olá 👋")).toBeTruthy();
  });

  it("T3: exibe subtítulo fixo 'Bem-vindo ao bolão'", () => {
    render(<HomeHeader name="João Silva" uid="uid-001" />);

    expect(screen.getByText("Bem-vindo ao bolão")).toBeTruthy();
  });

  it("T4: avatar exibe iniciais corretas para nome completo", () => {
    render(<HomeHeader name="Ana Lima" uid="abc123" />);

    // getInitials("Ana Lima") → "AL"
    expect(screen.getByText("AL")).toBeTruthy();
  });

  it("T5: avatar exibe '?' quando name é null", () => {
    render(<HomeHeader name={null} uid={null} />);

    expect(screen.getByText("?")).toBeTruthy();
  });

  it("T6: avatar tem classe de cor determinística por uid", () => {
    render(<HomeHeader name="Ana Lima" uid="abc123" />);

    // Verifica que as iniciais têm alguma classe de cor de avatar (bg-*)
    const iniciais = screen.getByText("AL");
    expect(iniciais.className).toMatch(/bg-/);
  });

  it("T7: sino está presente e desabilitado com aria-label correto", () => {
    render(<HomeHeader name="Ana Lima" uid="abc123" />);

    const bell = screen.getByRole("button", {
      name: "Notificações (em breve)",
    });
    expect(bell).toBeTruthy();
    expect(bell).toHaveProperty("disabled", true);
  });

  it("T8: sino tem aria-disabled='true'", () => {
    render(<HomeHeader name="Ana Lima" uid="abc123" />);

    const bell = screen.getByRole("button", {
      name: "Notificações (em breve)",
    });
    expect(bell.getAttribute("aria-disabled")).toBe("true");
  });

  it("T9: <section> container tem aria-label='Boas-vindas'", () => {
    render(<HomeHeader name="Ana Lima" uid="abc123" />);

    const section = screen.getByRole("region", { name: "Boas-vindas" });
    expect(section).toBeTruthy();
  });

  it("T10: renderiza <img> com a foto (avatarUrl) quando fornecida", async () => {
    // jsdom não carrega imagens reais: o Radix AvatarImage só monta o <img>
    // após o onload. Simula o carregamento disparando onload ao setar src.
    class MockImage {
      onload: (() => void) | null = null;
      set src(_value: string) {
        this.onload?.();
      }
    }
    vi.stubGlobal("Image", MockImage);

    const dataUrl = "data:image/jpeg;base64,QUJD";
    const { container } = render(
      <HomeHeader name="Ana Lima" uid="abc123" avatarUrl={dataUrl} />,
    );

    await waitFor(() => {
      expect(container.querySelector("img")).not.toBeNull();
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe(dataUrl);
  });

  it("T11: sem avatarUrl não renderiza <img> — cai no fallback de iniciais", () => {
    const { container } = render(
      <HomeHeader name="Ana Lima" uid="abc123" avatarUrl={null} />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("AL")).toBeTruthy();
  });
});
