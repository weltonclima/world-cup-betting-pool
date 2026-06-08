import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";

import { firestore } from "@/firebase";
import {
  systemLogInputSchema,
  systemLogSchema,
  type SystemLog,
  type SystemLogInput,
  type SystemLogType,
} from "@/schemas/systemLogs";

/**
 * Camada de serviço de logs do sistema (PRD-07). Auditoria administrativa
 * gravada client-side (sem Cloud Function — compat. Spark); leitura admin-only
 * garantida pelas Firestore Rules (TASK-01). Erros propagam crus.
 */

const SYSTEM_LOGS = "system_logs";
const MAX_LOGS = 100;

/**
 * Registra um evento em `system_logs`. Id client-side; `createdAt` ISO 8601.
 * `level` default "info" (via schema). Best-effort para o caller: instrumentação
 * de auditoria não deve derrubar a ação de negócio — o caller decide try/catch.
 */
export async function createLog(input: SystemLogInput): Promise<string> {
  const parsed = systemLogInputSchema.parse(input);
  const ref = doc(collection(firestore, SYSTEM_LOGS));
  const payload: SystemLog = {
    id: ref.id,
    type: parsed.type,
    actorUid: parsed.actorUid,
    targetUid: parsed.targetUid ?? null,
    message: parsed.message,
    level: parsed.level,
    createdAt: new Date().toISOString(),
  };
  await setDoc(ref, systemLogSchema.parse(payload));
  return ref.id;
}

/** Lista logs (mais recentes primeiro), opcionalmente filtrados por tipo. */
export async function listLogs(type?: SystemLogType): Promise<SystemLog[]> {
  const base = collection(firestore, SYSTEM_LOGS);
  const q = type
    ? query(
        base,
        where("type", "==", type),
        orderBy("createdAt", "desc"),
        limit(MAX_LOGS),
      )
    : query(base, orderBy("createdAt", "desc"), limit(MAX_LOGS));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => systemLogSchema.parse(d.data()));
}
