import { describe, expect, it } from "vitest";

import {
  AVATAR_CLASSES,
  formatUserCreatedAt,
  getAvatarVariant,
  getInitials,
} from "@/features/admin/components/userAvatar";

describe("getInitials", () => {
  it("T1: duas palavras → 1ª de cada extremo", () => {
    expect(getInitials("João da Silva")).toBe("JS");
    expect(getInitials("Maria Santos")).toBe("MS");
    expect(getInitials("Pedro Ramos")).toBe("PR");
  });

  it("T2: 1 palavra → 2 letras; 1 letra; vazio → ?", () => {
    expect(getInitials("João")).toBe("JO");
    expect(getInitials("A")).toBe("A");
    expect(getInitials("   ")).toBe("?");
  });
});

describe("getAvatarVariant", () => {
  it("T3: determinística e sempre um membro válido", () => {
    const v1 = getAvatarVariant("uid-123");
    const v2 = getAvatarVariant("uid-123");
    expect(v1).toBe(v2);
    expect(Object.keys(AVATAR_CLASSES)).toContain(v1);
  });
});

describe("formatUserCreatedAt", () => {
  it("T4: ISO válida → dd/MM/yyyy HH:mm; undefined/inválida → null", () => {
    expect(formatUserCreatedAt("2026-06-15T14:32:00.000Z")).toMatch(
      /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/,
    );
    expect(formatUserCreatedAt(undefined)).toBeNull();
    expect(formatUserCreatedAt("não-é-data")).toBeNull();
  });
});
