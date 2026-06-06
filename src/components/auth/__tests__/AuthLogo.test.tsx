// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthLogo } from "@/components/auth/AuthLogo";

describe("AuthLogo", () => {
  it("usa o logo dourado em variant='login'", () => {
    render(<AuthLogo variant="login" />);

    const img = screen.getByAltText("Bolão dos Parças");
    expect(img.getAttribute("src")).toContain("logo-login.png");
  });

  it("usa o logo verde em variant='cadastro'", () => {
    render(<AuthLogo variant="cadastro" />);

    const img = screen.getByAltText("Bolão dos Parças");
    expect(img.getAttribute("src")).toContain("logo-cadastro.png");
  });

  it("centraliza e aplica object-contain, mesclando className extra", () => {
    render(<AuthLogo variant="login" className="extra-class" />);

    const img = screen.getByAltText("Bolão dos Parças");
    expect(img.className).toContain("mx-auto");
    expect(img.className).toContain("object-contain");
    expect(img.className).toContain("extra-class");
  });
});
