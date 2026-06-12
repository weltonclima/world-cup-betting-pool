import { z } from "zod";

import { poolStatusSchema } from "@/schemas/pools";
import type { PoolStatus } from "@/types/pools";

/**
 * Transições de status de pool permitidas (PRD-09, TASK-05). Espelha
 * `userStatusTransition`.
 *
 * - `pending → active`  — Aprovar grupo (decisão A2)
 * - `pending → blocked` — Rejeitar
 * - `active → blocked`  — Bloquear (não aceita novos membros)
 * - `blocked → active`  — Desbloquear
 *
 * Qualquer outro par é inválido — inclusive no-op (`x→x`) e reversões para
 * `pending` (`active→pending`, `blocked→pending`).
 */
export const ALLOWED_POOL_STATUS_TRANSITIONS = {
  pending: ["active", "blocked"],
  active: ["blocked"],
  blocked: ["active"],
} as const satisfies Record<PoolStatus, readonly PoolStatus[]>;

/** Valida o par `{ from, to }` de status de pool. */
export const poolStatusTransitionSchema = z
  .object({ from: poolStatusSchema, to: poolStatusSchema })
  .refine(
    ({ from, to }) =>
      (ALLOWED_POOL_STATUS_TRANSITIONS[from] as readonly PoolStatus[]).includes(to),
    { message: "Transição de status do grupo não permitida." },
  );

export type PoolStatusTransition = z.infer<typeof poolStatusTransitionSchema>;

/** Conveniência sem lançar: `true` se a transição `from→to` é permitida. */
export function canTransitionPool(from: PoolStatus, to: PoolStatus): boolean {
  return poolStatusTransitionSchema.safeParse({ from, to }).success;
}
