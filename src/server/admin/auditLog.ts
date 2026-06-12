import "server-only";

import { getAdminFirestore } from "@/server/firebaseAdmin";
import {
  systemLogInputSchema,
  systemLogSchema,
  type SystemLogInput,
} from "@/schemas/systemLogs";

/**
 * Auditoria server-side (PRD-11 TASK-05). Equivalente Admin SDK do `createLog`
 * client (`src/services/systemLogs.ts`), para uso nos Route Handlers `/api/admin/*`
 * — o client SDK não roda no servidor e as Rules negam write client em
 * `system_logs` (só Admin SDK).
 *
 * BEST-EFFORT: instrumentação de auditoria NUNCA derruba a ação de negócio. Em
 * caso de falha, loga no console e segue — o caller deve chamar sem `await` que
 * propague erro (ou envolver em try/catch). Retorna o id gravado ou `null` se
 * falhou.
 */
export async function writeAuditLog(
  input: SystemLogInput,
): Promise<string | null> {
  try {
    const parsed = systemLogInputSchema.parse(input);
    const db = getAdminFirestore();
    const ref = db.collection("system_logs").doc();
    const payload = systemLogSchema.parse({
      id: ref.id,
      type: parsed.type,
      actorUid: parsed.actorUid,
      targetUid: parsed.targetUid ?? null,
      message: parsed.message,
      level: parsed.level,
      createdAt: new Date().toISOString(),
    });
    await ref.set(payload);
    return ref.id;
  } catch (error) {
    console.error("[admin/auditLog] falha ao gravar system_log:", error);
    return null;
  }
}
