import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { firestore } from "@/firebase";
import { userSchema } from "@/schemas";
import type { User, UserStatus } from "@/types";

/**
 * Camada de serviço de usuários (PRD-01.2, TASK-02).
 *
 * Funções puras de Firestore (Client SDK, A2) para o painel admin: leitura por
 * status e mutação de status. Sem React/cache — os hooks TanStack Query que as
 * consomem ficam na TASK-03. Os erros do Firebase propagam crus (com `code`)
 * para a UI traduzir (TASK-07) — esta camada NÃO traduz mensagens.
 */

/**
 * Lista os usuários de `users` com o `status` dado, ordenados por `createdAt`
 * (mais antigos primeiro). Cada doc é validado por `userSchema` — doc fora do
 * schema faz a Promise rejeitar (propaga `ZodError`), sem fallback silencioso.
 *
 * A ordenação é feita EM MEMÓRIA (não via `orderBy` do Firestore) de propósito:
 * `where status== + orderBy createdAt` exige índice composto e — pior — o
 * `orderBy("createdAt")` DESCARTA silenciosamente docs sem o campo `createdAt`
 * (que o schema marca como opcional: admin promovido por Cloud Function e docs
 * seedados não têm `createdAt`). Isso fazia o painel admin zerar/subcontar.
 * Filtrando só por `status` (campo único, sem índice composto) e ordenando aqui,
 * todos os docs aparecem; os sem `createdAt` vão para o fim.
 */
export async function listUsersByStatus(status: UserStatus): Promise<User[]> {
  const q = query(
    collection(firestore, "users"),
    where("status", "==", status),
  );
  const snapshot = await getDocs(q);
  const users = snapshot.docs.map((d) => userSchema.parse(d.data()));
  // Ascendente por `createdAt` (ISO 8601 → comparável lexicograficamente).
  // Docs sem `createdAt` (campo opcional) caem para o fim, sem serem descartados.
  return users.sort((a, b) => {
    if (a.createdAt === b.createdAt) return 0;
    if (a.createdAt === undefined) return 1;
    if (b.createdAt === undefined) return -1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/**
 * Atualiza o `status` de `users/{uid}`, gravando também `updatedAt` (ISO 8601).
 *
 * Escreve APENAS `status` + `updatedAt` — alinhado à Security Rule (TASK-01)
 * que libera o admin a alterar esses campos. A validação da transição
 * (`statusTransitionSchema`) é aplicada na borda (hook/ação, TASK-03/07): esta
 * primitiva não lê o estado atual nem embute a máquina de transição.
 */
export async function updateUserStatus(
  uid: string,
  nextStatus: UserStatus,
): Promise<void> {
  await updateDoc(doc(firestore, "users", uid), {
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Atualiza campos editáveis do PRÓPRIO perfil (PRD-06, decisão D-A2): apelido e
 * avatar (data URL base64). Grava SOMENTE `nickname`/`avatarUrl` informados +
 * `updatedAt` — nunca `role`/`status`/`email`/`uid` (alinhado à Security Rule
 * que libera o dono a atualizar o doc desde que role/status não mudem).
 *
 * `avatarUrl` é uma data URL JPEG comprimida no client (`imageToDataUrl`) — sem
 * Firebase Storage (compat. Spark). O caller deve garantir o teto de tamanho
 * (limite de 1MB do doc Firestore).
 */
export async function updateProfile(
  uid: string,
  fields: { nickname?: string; avatarUrl?: string },
): Promise<void> {
  const patch: Record<string, string> = { updatedAt: new Date().toISOString() };
  if (fields.nickname !== undefined) patch.nickname = fields.nickname;
  if (fields.avatarUrl !== undefined) patch.avatarUrl = fields.avatarUrl;
  await updateDoc(doc(firestore, "users", uid), patch);
}
