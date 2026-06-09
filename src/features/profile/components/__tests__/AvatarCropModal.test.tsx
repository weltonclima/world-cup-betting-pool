// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AvatarCropModal,
  displayCropToNatural,
} from "@/features/profile/components/AvatarCropModal";
import {
  AvatarImageError,
  cropRectToCompressedDataUrl,
} from "@/features/profile/lib/imageToDataUrl";

// Mocka apenas a compressão (canvas, browser-only); preserva validateImageInput
// e AvatarImageError reais.
vi.mock("@/features/profile/lib/imageToDataUrl", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/profile/lib/imageToDataUrl")>();
  return { ...actual, cropRectToCompressedDataUrl: vi.fn() };
});

const mockedCrop = vi.mocked(cropRectToCompressedDataUrl);

function makeFile(): File {
  return new File(["x"], "foto.png", { type: "image/png" });
}

/** Simula o carregamento do `<img>` com dimensões controladas (jsdom não pinta). */
function loadImage(
  displayW = 400,
  displayH = 300,
  naturalW = 800,
  naturalH = 600,
): HTMLElement {
  const img = screen.getByAltText("Pré-visualização da foto a recortar");
  Object.defineProperty(img, "clientWidth", {
    value: displayW,
    configurable: true,
  });
  Object.defineProperty(img, "clientHeight", {
    value: displayH,
    configurable: true,
  });
  Object.defineProperty(img, "naturalWidth", {
    value: naturalW,
    configurable: true,
  });
  Object.defineProperty(img, "naturalHeight", {
    value: naturalH,
    configurable: true,
  });
  fireEvent.load(img);
  return img;
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
  mockedCrop.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("displayCropToNatural", () => {
  it("escala recorte de exibição para a imagem natural (paisagem 2x)", () => {
    expect(
      displayCropToNatural(
        { x: 50, y: 0, side: 300 },
        { width: 400, height: 300 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ x: 100, y: 0, size: 600 });
  });

  it("escala em retrato e arredonda", () => {
    expect(
      displayCropToNatural(
        { x: 0, y: 33.4, side: 150 },
        { width: 150, height: 300 },
        { width: 300, height: 600 },
      ),
    ).toEqual({ x: 0, y: 67, size: 300 });
  });

  it("retorna recorte seguro quando display é zero (img não medida)", () => {
    expect(
      displayCropToNatural(
        { x: 0, y: 0, side: 0 },
        { width: 0, height: 0 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ x: 0, y: 0, size: 600 });
  });
});

describe("AvatarCropModal", () => {
  it("não renderiza conteúdo quando fechado", () => {
    render(
      <AvatarCropModal
        open={false}
        file={makeFile()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByText("Ajustar foto")).toBeNull();
  });

  it("renderiza título e botões quando aberto", () => {
    render(
      <AvatarCropModal
        open
        file={makeFile()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Ajustar foto")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Salvar Foto" })).not.toBeNull();
  });

  it("chama onCancel ao clicar em Cancelar e não confirma", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <AvatarCropModal
        open
        file={makeFile()}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Salvar Foto fica desabilitado até a imagem carregar", () => {
    render(
      <AvatarCropModal
        open
        file={makeFile()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const save = screen.getByRole("button", {
      name: "Salvar Foto",
    }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    loadImage();
    expect(save.disabled).toBe(false);
  });

  it("confirma com a data URL comprimida no sucesso", async () => {
    const onConfirm = vi.fn();
    mockedCrop.mockResolvedValue("data:image/jpeg;base64,QUJD");
    render(
      <AvatarCropModal
        open
        file={makeFile()}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    loadImage();
    fireEvent.click(screen.getByRole("button", { name: "Salvar Foto" }));
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith("data:image/jpeg;base64,QUJD"),
    );
    expect(mockedCrop).toHaveBeenCalledTimes(1);
  });

  it("exibe erro inline e não confirma quando a compressão falha", async () => {
    const onConfirm = vi.fn();
    mockedCrop.mockRejectedValue(
      new AvatarImageError("Não foi possível comprimir a imagem o suficiente."),
    );
    render(
      <AvatarCropModal
        open
        file={makeFile()}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    loadImage();
    fireEvent.click(screen.getByRole("button", { name: "Salvar Foto" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Não foi possível comprimir");
    expect(onConfirm).not.toHaveBeenCalled();
    // Modal permanece aberto.
    expect(screen.getByText("Ajustar foto")).not.toBeNull();
  });
});
