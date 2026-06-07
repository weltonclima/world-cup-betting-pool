import { FirebaseError } from "firebase/app";
import { describe, expect, it, vi } from "vitest";

import { InvalidStatusTransitionError } from "@/features/admin/hooks/useUpdateUserStatus";
import { mapUserActionError } from "@/features/admin/components/userActionErrors";

// A cadeia de import alcança @/firebase (client valida env no load) — mockar.
vi.mock("@/firebase", () => ({ firestore: {}, firebaseAuth: {} }));

describe("mapUserActionError", () => {
  it("T3: InvalidStatusTransitionError → mensagem de transição", () => {
    expect(
      mapUserActionError(
        new InvalidStatusTransitionError("pending", "approved"),
      ),
    ).toBe("Não é possível alterar o status deste usuário.");
  });

  it("T4: FirebaseError permission-denied → mensagem de permissão", () => {
    expect(
      mapUserActionError(new FirebaseError("permission-denied", "denied")),
    ).toBe("Você não tem permissão para esta ação.");
  });

  it("T5: objeto cru com code, e erro desconhecido → fallback", () => {
    expect(mapUserActionError({ code: "permission-denied" })).toBe(
      "Você não tem permissão para esta ação.",
    );
    expect(mapUserActionError(new Error("x"))).toBe(
      "Ocorreu um erro inesperado. Tente novamente.",
    );
  });
});
