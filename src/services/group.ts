import { z } from "zod";

import {
  groupManualPredictionSavedSchema,
  inviteSchema,
  poolSchema,
  userSchema,
} from "@/schemas";
import type { Invite } from "@/types/invites";
import type { Pool } from "@/types/pools";
import type {
  GroupManualPredictionInput,
  GroupManualPredictionSaved,
} from "@/types/predictions";
import type { User, UserStatus } from "@/types";

import { extractErrorDetail } from "./_apiClient";

/**
 * Camada de serviço da Administração de Grupo (PRD-10). TODAS as operações passam
 * pelos Route Handlers `/api/group/*` (Admin SDK server-side, escopados por sessão).
 * Leitura também via fetch (não Client SDK): o admin precisa enxergar pendentes/
 * bloqueados e convites que as Rules restringem no client.
 *
 * Erros HTTP → `GroupServiceError` com mensagem pt-BR (espelha PoolServiceError);
 * a UI nunca lida com status HTTP. `groupId` é SEMPRE da sessão server-side — esta
 * camada nunca o envia.
 */

export class GroupServiceError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GroupServiceError";
    this.status = status;
  }
}

const HTTP_ERROR_MESSAGES: Record<number, string> = {
  400: "Não foi possível processar os dados.",
  401: "Você precisa estar autenticado.",
  403: "Você não tem permissão para esta ação.",
  404: "Registro não encontrado.",
  409: "A operação não pôde ser concluída (conflito).",
  422: "Os dados informados são inválidos.",
  500: "Erro ao processar a solicitação. Tente novamente.",
};

const FALLBACK_HTTP_MESSAGE = "Ocorreu um erro inesperado. Tente novamente.";

async function toServiceError(response: Response): Promise<GroupServiceError> {
  const base = HTTP_ERROR_MESSAGES[response.status] ?? FALLBACK_HTTP_MESSAGE;
  const detail = await extractErrorDetail(response);
  const message = detail ? `${base} ${detail}` : base;
  return new GroupServiceError(response.status, message);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/** Item de "Últimos Cadastros" (subconjunto do usuário p/ a lista). */
export const recentUserSchema = z.object({
  uid: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["pending", "approved", "blocked"]),
  createdAt: z.string().optional(),
  avatarUrl: z.string().optional(),
});

export const groupDashboardSchema = z.object({
  pool: poolSchema,
  counts: z.object({
    participants: z.number().int().min(0),
    pending: z.number().int().min(0),
    blocked: z.number().int().min(0),
    activeInvites: z.number().int().min(0),
  }),
  recent: z.array(recentUserSchema),
});

export type RecentUser = z.infer<typeof recentUserSchema>;
export type GroupDashboard = z.infer<typeof groupDashboardSchema>;

export async function getGroupDashboard(): Promise<GroupDashboard> {
  const response = await fetch("/api/group/dashboard", {
    method: "GET",
    credentials: "same-origin",
  });
  if (!response.ok) throw await toServiceError(response);
  const body = (await response.json()) as unknown;
  return groupDashboardSchema.parse(body);
}

// ---------------------------------------------------------------------------
// Usuários (listas + moderação)
// ---------------------------------------------------------------------------

/** Usuário do pool, opcionalmente enriquecido com ranking (aprovados). */
export const groupUserSchema = z.object({
  user: userSchema,
  rankingPoints: z.number().int().min(0).optional(),
  rankingPosition: z.number().int().min(1).optional(),
});

export type GroupUser = z.infer<typeof groupUserSchema>;

/** Lista usuários do pool por status. `approved` vem com ranking (pts/posição). */
export async function listGroupUsers(status: UserStatus): Promise<GroupUser[]> {
  const response = await fetch(`/api/group/users/${status}`, {
    method: "GET",
    credentials: "same-origin",
  });
  if (!response.ok) throw await toServiceError(response);
  const body = (await response.json()) as { users: unknown[] };
  return body.users.map((u) => groupUserSchema.parse(u));
}

/** Ações de moderação suportadas pelas rotas `/api/group/users/{action}`. */
export type GroupModerationAction =
  | "approve"
  | "reject"
  | "block"
  | "unblock"
  | "remove";

export interface ModerateGroupUserInput {
  action: GroupModerationAction;
  uid: string;
  /** Motivo do bloqueio (somente `block`). */
  reason?: string;
}

/** Executa uma moderação de usuário escopada ao pool. Retorna o usuário atualizado. */
export async function moderateGroupUser(
  input: ModerateGroupUserInput,
): Promise<User> {
  const { action, uid, reason } = input;
  const response = await fetch(`/api/group/users/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ uid, ...(reason !== undefined ? { reason } : {}) }),
  });
  if (!response.ok) throw await toServiceError(response);
  const body = (await response.json()) as { user: unknown };
  return userSchema.parse(body.user);
}

/** Promove um participante aprovado a admin do pool (troca; D3). */
export async function promoteGroupUser(uid: string): Promise<Pool> {
  const response = await fetch("/api/group/users/promote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ uid }),
  });
  if (!response.ok) throw await toServiceError(response);
  const body = (await response.json()) as { pool: unknown };
  return poolSchema.parse(body.pool);
}

// ---------------------------------------------------------------------------
// Palpites manuais (PRD-12)
// ---------------------------------------------------------------------------

/**
 * Lança/sobrescreve o palpite de um membro aprovado do grupo num jogo bloqueado
 * (PRD-12). Toda a autorização/escopo é server-side (`POST /api/group/predictions`);
 * `targetUid` identifica o alvo, nunca autoriza. Resposta validada por schema
 * (não `as`) antes de chegar à UI.
 */
export async function createGroupManualPrediction(
  input: GroupManualPredictionInput,
): Promise<GroupManualPredictionSaved> {
  const response = await fetch("/api/group/predictions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await toServiceError(response);
  const body = (await response.json()) as { saved: unknown };
  return groupManualPredictionSavedSchema.parse(body.saved);
}

// ---------------------------------------------------------------------------
// Configurações do grupo
// ---------------------------------------------------------------------------

export interface UpdateGroupSettingsInput {
  name?: string;
  description?: string;
  photoBase64?: string;
  maxParticipants?: number | null;
  allowInvites?: boolean;
  predictionsLocked?: boolean;
}

export async function updateGroupSettings(
  input: UpdateGroupSettingsInput,
): Promise<Pool> {
  const response = await fetch("/api/group/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await toServiceError(response);
  const body = (await response.json()) as { pool: unknown };
  return poolSchema.parse(body.pool);
}

/** Lê o pool da sessão (para o form de configurações). */
export async function getGroupSettings(): Promise<Pool> {
  const response = await fetch("/api/group/settings", {
    method: "GET",
    credentials: "same-origin",
  });
  if (!response.ok) throw await toServiceError(response);
  const body = (await response.json()) as { pool: unknown };
  return poolSchema.parse(body.pool);
}

// ---------------------------------------------------------------------------
// Convites
// ---------------------------------------------------------------------------

export interface CreateInviteInput {
  label?: string;
  maxUses: number;
  validityDays: number;
}

export async function listInvites(): Promise<Invite[]> {
  const response = await fetch("/api/group/invites", {
    method: "GET",
    credentials: "same-origin",
  });
  if (!response.ok) throw await toServiceError(response);
  const body = (await response.json()) as { invites: unknown[] };
  return body.invites.map((i) => inviteSchema.parse(i));
}

export async function createInvite(input: CreateInviteInput): Promise<Invite> {
  const response = await fetch("/api/group/invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await toServiceError(response);
  const body = (await response.json()) as { invite: unknown };
  return inviteSchema.parse(body.invite);
}

export async function revokeInvite(id: string): Promise<void> {
  const response = await fetch(`/api/group/invites/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) throw await toServiceError(response);
}
