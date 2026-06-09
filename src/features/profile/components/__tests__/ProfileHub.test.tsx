// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileHub } from "@/features/profile/components/ProfileHub";

const mutateAsync = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/features/profile/hooks", () => ({
  useProfile: () => ({
    profile: {
      name: "João Souza",
      nickname: "joao",
      avatarUrl: null,
      status: "approved",
      role: "user",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  }),
  useUpdateProfile: () => ({ mutateAsync }),
}));

vi.mock("sonner", () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

vi.mock("@/features/profile/components/AvatarCropModal", () => ({
  AvatarCropModal: ({
    open,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    file: File | null;
    onConfirm: (d: string) => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div data-testid="crop-modal">
        <button onClick={() => onConfirm("data:image/jpeg;base64,QUJD")}>
          confirm-double
        </button>
        <button onClick={onCancel}>cancel-double</button>
      </div>
    ) : null,
}));

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error("file input não encontrado");
  return input as HTMLInputElement;
}

function selectFile(input: HTMLInputElement, file: File): void {
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

beforeEach(() => {
  mutateAsync.mockReset().mockResolvedValue(undefined);
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("ProfileHub — integração do recorte de avatar", () => {
  it("seleção válida abre o modal; confirmar persiste e mostra sucesso", async () => {
    const { container } = render(<ProfileHub />);
    expect(screen.queryByTestId("crop-modal")).toBeNull();

    selectFile(
      fileInput(container),
      new File(["x"], "foto.png", { type: "image/png" }),
    );
    expect(screen.getByTestId("crop-modal")).not.toBeNull();

    fireEvent.click(screen.getByText("confirm-double"));
    await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({
      avatarUrl: "data:image/jpeg;base64,QUJD",
    });
    await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("seleção inválida exibe toast e não abre o modal", () => {
    const { container } = render(<ProfileHub />);

    selectFile(
      fileInput(container),
      new File(["x"], "arquivo.txt", { type: "text/plain" }),
    );

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("crop-modal")).toBeNull();
  });
});
