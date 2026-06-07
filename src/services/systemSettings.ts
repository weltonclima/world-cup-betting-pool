import { doc, getDoc } from "firebase/firestore";

import { firestore } from "@/firebase";
import { systemSettingsSchema } from "@/schemas";
import type { SystemSettings } from "@/types";

/**
 * Camada de serviço de configurações do sistema (PRD-02, TASK-03).
 *
 * Funções puras de Firestore (Client SDK) para leitura do documento global de
 * configurações. Sem React/cache — os hooks TanStack Query que as consomem
 * ficam na TASK-05.
 * Os erros do Firebase propagam crus (com `code`) — esta camada NÃO traduz mensagens.
 *
 * O documento global fica em `system_settings/global` (doc id = "global").
 */

/**
 * Retorna o documento global de configurações do sistema (`system_settings/global`).
 *
 * Contém flags como `registrationOpen`, `predictionsLocked` e `currentStage`,
 * usadas pela Home para derivar avisos e bloquear ações (R6 do PRD-02).
 *
 * @throws ZodError se o documento existir mas não passar na validação do schema.
 * @throws FirebaseError se a leitura falhar (propaga cru, sem tradução).
 * @returns SystemSettings validado, ou `null` se o documento não existir.
 */
export async function getSystemSettings(): Promise<SystemSettings | null> {
  const snap = await getDoc(doc(firestore, "system_settings", "global"));
  if (!snap.exists()) return null;
  return systemSettingsSchema.parse(snap.data());
}
