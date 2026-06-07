// @vitest-environment jsdom
import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PasswordInput } from "@/components/auth/PasswordInput";

describe("PasswordInput", () => {
  it("inicia oculto (type password) com aria-label 'Mostrar senha'", () => {
    render(<PasswordInput placeholder="senha" />);

    const input = screen.getByPlaceholderText("senha");
    expect(input.getAttribute("type")).toBe("password");

    const toggle = screen.getByRole("button", { name: "Mostrar senha" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("alterna type e aria-label ao clicar no toggle", () => {
    render(<PasswordInput placeholder="senha" />);

    const input = screen.getByPlaceholderText("senha");
    const toggle = screen.getByRole("button", { name: "Mostrar senha" });

    fireEvent.click(toggle);

    expect(input.getAttribute("type")).toBe("text");
    const hideToggle = screen.getByRole("button", { name: "Ocultar senha" });
    expect(hideToggle.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(hideToggle);

    expect(input.getAttribute("type")).toBe("password");
    expect(
      screen.getByRole("button", { name: "Mostrar senha" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("o toggle é type='button' (não submete o form)", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput placeholder="senha" />
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("encaminha a ref para o elemento <input>", () => {
    const ref = createRef<HTMLInputElement>();
    render(<PasswordInput ref={ref} placeholder="senha" />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toBe(screen.getByPlaceholderText("senha"));
  });

  it("encaminha props nativas (name, value, onChange) ao input", () => {
    const onChange = vi.fn();
    render(
      <PasswordInput
        name="password"
        value="abc"
        onChange={onChange}
        placeholder="senha"
      />,
    );

    const input = screen.getByPlaceholderText("senha") as HTMLInputElement;
    expect(input.getAttribute("name")).toBe("password");
    expect(input.value).toBe("abc");

    fireEvent.change(input, { target: { value: "abcd" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("mescla className extra mantendo pr-12", () => {
    render(<PasswordInput placeholder="senha" className="custom-class" />);

    const input = screen.getByPlaceholderText("senha");
    expect(input.className).toContain("pr-12");
    expect(input.className).toContain("custom-class");
  });

  it("o toggle tem alvo de toque >= 44px (h-11 w-11) — WCAG 2.5.5", () => {
    render(<PasswordInput placeholder="senha" />);

    const toggle = screen.getByRole("button", { name: "Mostrar senha" });
    expect(toggle.className).toContain("h-11");
    expect(toggle.className).toContain("w-11");
    expect(toggle.className).not.toContain("h-8");
  });
});
