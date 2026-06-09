// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EditProfileForm } from "@/features/profile/components/EditProfileForm";

const mutateAsync = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn() }),
}));

vi.mock("@/features/profile/hooks", () => ({
  useProfile: () => ({
    profile: {
      name: "Maria Silva",
      email: "maria@example.com",
      nickname: "mari",
      avatarUrl: null,
    },
  }),
  useUpdateProfile: () => ({ mutateAsync }),
}));

vi.mock("sonner", () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

// Duble do modal: expõe botões para disparar onConfirm/onCancel e marca `open`.
vi.mock("@/features/profile/components/AvatarCropModal", () => ({
  AvatarCropModal: ({
    open,
    file,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    file: File | null;
    onConfirm: (d: string) => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div data-testid="crop-modal" data-file={file?.name ?? ""}>
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

describe("EditProfileForm — integração do recorte de avatar", () => {
  it("seleção válida abre o modal de recorte", () => {
    const { container } = render(<EditProfileForm />);
    expect(screen.queryByTestId("crop-modal")).toBeNull();

    selectFile(
      fileInput(container),
      new File(["x"], "foto.png", { type: "image/png" }),
    );

    const modal = screen.getByTestId("crop-modal");
    expect(modal.getAttribute("data-file")).toBe("foto.png");
  });

  it("seleção inválida exibe toast e não abre o modal", () => {
    const { container } = render(<EditProfileForm />);

    selectFile(
      fileInput(container),
      new File(["x"], "doc.pdf", { type: "application/pdf" }),
    );

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("crop-modal")).toBeNull();
  });

  it("confirmar no modal persiste via updateProfile e mostra sucesso", async () => {
    const { container } = render(<EditProfileForm />);
    selectFile(
      fileInput(container),
      new File(["x"], "foto.png", { type: "image/png" }),
    );

    fireEvent.click(screen.getByText("confirm-double"));
    await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({
      avatarUrl: "data:image/jpeg;base64,QUJD",
    });
    await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    await vi.waitFor(() =>
      expect(screen.queryByTestId("crop-modal")).toBeNull(),
    );
  });

  it("cancelar fecha o modal sem persistir", () => {
    const { container } = render(<EditProfileForm />);
    selectFile(
      fileInput(container),
      new File(["x"], "foto.png", { type: "image/png" }),
    );

    fireEvent.click(screen.getByText("cancel-double"));
    expect(screen.queryByTestId("crop-modal")).toBeNull();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
