import { describe, expect, it } from "vitest";

import {
  AvatarImageError,
  dataUrlByteSize,
  scaledDimensions,
  validateImageInput,
  MAX_INPUT_BYTES,
} from "@/features/profile/lib/imageToDataUrl";

describe("validateImageInput", () => {
  it("aceita imagem dentro do limite", () => {
    expect(() =>
      validateImageInput({ type: "image/png", size: 1000 }),
    ).not.toThrow();
  });

  it("rejeita não-imagem", () => {
    expect(() =>
      validateImageInput({ type: "application/pdf", size: 1000 }),
    ).toThrow(AvatarImageError);
  });

  it("rejeita arquivo acima do teto de entrada", () => {
    expect(() =>
      validateImageInput({ type: "image/jpeg", size: MAX_INPUT_BYTES + 1 }),
    ).toThrow(AvatarImageError);
  });
});

describe("dataUrlByteSize", () => {
  it("estima bytes de data URL base64", () => {
    // "AAAA" base64 = 3 bytes.
    expect(dataUrlByteSize("data:image/jpeg;base64,AAAA")).toBe(3);
  });

  it("desconta padding", () => {
    // "AA==" = 1 byte.
    expect(dataUrlByteSize("data:image/jpeg;base64,AA==")).toBe(1);
  });

  it("vazio = 0", () => {
    expect(dataUrlByteSize("data:image/jpeg;base64,")).toBe(0);
  });
});

describe("scaledDimensions", () => {
  it("não amplia imagem pequena", () => {
    expect(scaledDimensions(100, 80, 256)).toEqual({ width: 100, height: 80 });
  });

  it("limita lado maior (paisagem)", () => {
    expect(scaledDimensions(1024, 512, 256)).toEqual({ width: 256, height: 128 });
  });

  it("limita lado maior (retrato)", () => {
    expect(scaledDimensions(512, 1024, 256)).toEqual({ width: 128, height: 256 });
  });
});
