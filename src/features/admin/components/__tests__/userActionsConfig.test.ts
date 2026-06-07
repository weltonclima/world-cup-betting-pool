import { describe, expect, it } from "vitest";

import { USER_ACTIONS } from "@/features/admin/components/userActionsConfig";

describe("USER_ACTIONS", () => {
  it("T1: pares de transição corretos por status", () => {
    const pending = USER_ACTIONS.pending;
    const approve = pending.find((a) => a.id === "approve");
    const reject = pending.find((a) => a.id === "reject");
    expect(approve).toMatchObject({ to: "approved", flow: "success" });
    expect(reject).toMatchObject({ to: "blocked", flow: "confirm" });

    expect(USER_ACTIONS.approved.find((a) => a.id === "block")).toMatchObject({
      to: "blocked",
      flow: "confirm",
    });
    expect(USER_ACTIONS.blocked.find((a) => a.id === "unblock")).toMatchObject({
      to: "approved",
      flow: "confirm",
    });
  });

  it("T2: confirm-flow tem confirm+successToast; success-flow não tem", () => {
    for (const list of Object.values(USER_ACTIONS)) {
      for (const action of list) {
        if (action.flow === "confirm") {
          expect(action.confirm).toBeDefined();
          expect(action.successToast).toBeDefined();
        } else {
          expect(action.confirm).toBeUndefined();
          expect(action.successToast).toBeUndefined();
        }
      }
    }
  });
});
