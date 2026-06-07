import { z } from "zod";

import { userStatusSchema } from "@/schemas/shared";
import type { UserStatus } from "@/types/shared";

/**
 * Transições de status permitidas (PRD-01.2, decisões §0).
 *
 * - `pending → approved` — Aprovar
 * - `pending → blocked`  — Rejeitar (A1: rejeitar = blocked, sem delete)
 * - `approved → blocked` — Bloquear
 * - `blocked → approved` — Desbloquear (A5)
 *
 * Qualquer outro par é inválido — inclusive no-op (`x→x`) e reversões não
 * previstas (`approved→pending`, `blocked→pending`).
 */
export const ALLOWED_STATUS_TRANSITIONS = {
  pending: ["approved", "blocked"],
  approved: ["blocked"],
  blocked: ["approved"],
} as const satisfies Record<UserStatus, readonly UserStatus[]>;

/**
 * Valida o par `{ from, to }` de status. Defensivo/UX no client — a autoridade
 * real de acesso são as Security Rules (TASK-01). Não é embutido na primitiva
 * de escrita `updateUserStatus`; a borda (hook/ação) valida antes de chamar.
 */
export const statusTransitionSchema = z
  .object({ from: userStatusSchema, to: userStatusSchema })
  .refine(
    ({ from, to }) =>
      (ALLOWED_STATUS_TRANSITIONS[from] as readonly UserStatus[]).includes(to),
    { message: "Transição de status não permitida." },
  );

export type StatusTransition = z.infer<typeof statusTransitionSchema>;

/** Conveniência sem lançar: `true` se a transição `from→to` é permitida. */
export function canTransition(from: UserStatus, to: UserStatus): boolean {
  return statusTransitionSchema.safeParse({ from, to }).success;
}
