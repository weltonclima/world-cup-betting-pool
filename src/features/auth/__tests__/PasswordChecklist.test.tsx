// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PasswordChecklist } from "@/features/auth/PasswordChecklist";

// O status de cada regra é exposto via data-state="satisfied|pending" no <li>,
// permitindo testar a lógica sem depender de cor/ícone.
function ruleState(label: RegExp): string | null {
  const item = screen.getByText(label).closest("li");
  return item?.getAttribute("data-state") ?? null;
}

describe("PasswordChecklist", () => {
  it("com valor vazio: regras reais ficam pendentes", () => {
    render(<PasswordChecklist value="" />);
    expect(ruleState(/8 caracteres/i)).toBe("pending");
    expect(ruleState(/letras e n[úu]meros/i)).toBe("pending");
  });

  it("senha curta só com letras: min8 e letra+número pendentes", () => {
    render(<PasswordChecklist value="abc" />);
    expect(ruleState(/8 caracteres/i)).toBe("pending");
    expect(ruleState(/letras e n[úu]meros/i)).toBe("pending");
  });

  it("8+ só com letras: min8 satisfeito, letra+número pendente", () => {
    render(<PasswordChecklist value="abcdefgh" />);
    expect(ruleState(/8 caracteres/i)).toBe("satisfied");
    expect(ruleState(/letras e n[úu]meros/i)).toBe("pending");
  });

  it("8+ só com números: min8 satisfeito, letra+número pendente", () => {
    render(<PasswordChecklist value="12345678" />);
    expect(ruleState(/8 caracteres/i)).toBe("satisfied");
    expect(ruleState(/letras e n[úu]meros/i)).toBe("pending");
  });

  it("8+ com letras e números: ambas as regras reais satisfeitas", () => {
    render(<PasswordChecklist value="abcd1234" />);
    expect(ruleState(/8 caracteres/i)).toBe("satisfied");
    expect(ruleState(/letras e n[úu]meros/i)).toBe("satisfied");
  });

  it("regra 'não pode ser igual à anterior' é informativa (nunca pendente)", () => {
    render(<PasswordChecklist value="" />);
    // Informativa: não bloqueia, não derivada do valor → não fica "pending".
    expect(ruleState(/igual [àa] anterior/i)).not.toBe("pending");
  });
});
