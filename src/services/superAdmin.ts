import { z } from "zod";

import { extractErrorDetail } from "./_apiClient";
import {
  matchStatusSchema,
  poolStatusSchema,
  stageSchema,
  syncLogSchema,
} from "@/schemas";
import type { SyncLog } from "@/schemas/syncLogs";

/**
 * Camada de serviço da área global do Super Admin (PRD-11). Consome os Route
 * Handlers `/api/admin/*` (Admin SDK server-side; `authorizeGroupAdmin`). Erros
 * HTTP → `SuperAdminServiceError` com mensagem pt-BR. Nunca confia no client para
 * autorização — o gate é server-side.
 */

export class SuperAdminServiceError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "SuperAdminServiceError";
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
  502: "Falha ao buscar dados da Copa.",
  504: "A fonte de dados demorou para responder.",
};

const FALLBACK_HTTP_MESSAGE = "Ocorreu um erro inesperado. Tente novamente.";

async function toServiceError(response: Response): Promise<SuperAdminServiceError> {
  const base = HTTP_ERROR_MESSAGES[response.status] ?? FALLBACK_HTTP_MESSAGE;
  const detail = await extractErrorDetail(response);
  const message = detail ? `${base} ${detail}` : base;
  return new SuperAdminServiceError(response.status, message);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const dashboardStatsSchema = z.object({
  groups: z.object({
    active: z.number().int().min(0),
    pending: z.number().int().min(0),
    blocked: z.number().int().min(0),
    total: z.number().int().min(0),
  }),
  users: z.number().int().min(0),
  admins: z.number().int().min(0),
  predictions: z.number().int().min(0),
  matches: z.number().int().min(0),
  lastSync: syncLogSchema.nullable(),
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await fetch("/api/admin/dashboard", {
    method: "GET",
    credentials: "same-origin",
  });
  if (!response.ok) throw await toServiceError(response);
  return dashboardStatsSchema.parse(await response.json());
}

// ─── Grupos (pools) por status ────────────────────────────────────────────────

export const adminPoolRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  photoBase64: z.string().optional(),
  status: poolStatusSchema,
  adminId: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  maxParticipants: z.number().int().optional(),
  allowInvites: z.boolean().optional(),
  participantCount: z.number().int().min(0),
});

export type AdminPoolRow = z.infer<typeof adminPoolRowSchema>;

export async function listGroupsByStatus(
  status: "pending" | "active" | "blocked",
): Promise<AdminPoolRow[]> {
  const response = await fetch(`/api/admin/groups?status=${status}`, {
    method: "GET",
    credentials: "same-origin",
  });
  if (!response.ok) throw await toServiceError(response);
  const body = (await response.json()) as { pools: unknown[] };
  return body.pools.map((p) => adminPoolRowSchema.parse(p));
}

/** Transição de status do pool (aprovar/rejeitar/bloquear/reativar). Reuso PRD-09. */
export async function updateGroupStatus(
  id: string,
  status: "active" | "blocked",
): Promise<void> {
  const response = await fetch(`/api/admin/groups/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw await toServiceError(response);
}

/** Exclui (soft-delete) um pool bloqueado (B2). */
export async function deleteGroup(id: string): Promise<void> {
  const response = await fetch(`/api/admin/groups/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) throw await toServiceError(response);
}

/** Troca o admin do pool (substituir/transferir). Reuso PRD-09. */
export async function changeGroupAdmin(id: string, adminId: string): Promise<void> {
  const response = await fetch(`/api/admin/groups/${id}/admin`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ adminId }),
  });
  if (!response.ok) throw await toServiceError(response);
}

/** Remove o admin do pool (rebaixa a participant, B3). */
export async function removeGroupAdmin(id: string): Promise<void> {
  const response = await fetch(`/api/admin/groups/${id}/admin`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) throw await toServiceError(response);
}

// ─── Membros de um pool (seletor de novo admin) ───────────────────────────────

export const poolMemberSchema = z.object({
  uid: z.string().min(1),
  name: z.string().min(1),
  avatarUrl: z.string().nullable(),
});

export type PoolMember = z.infer<typeof poolMemberSchema>;

export async function listPoolMembers(poolId: string): Promise<PoolMember[]> {
  const response = await fetch(`/api/admin/groups/${poolId}/members`, {
    method: "GET",
    credentials: "same-origin",
  });
  if (!response.ok) throw await toServiceError(response);
  const body = (await response.json()) as { members: unknown[] };
  return body.members.map((m) => poolMemberSchema.parse(m));
}

// ─── Administradores ──────────────────────────────────────────────────────────

export const adminEntrySchema = z.object({
  uid: z.string().min(1),
  name: z.string().min(1),
  avatarUrl: z.string().nullable(),
  poolId: z.string().min(1),
  poolName: z.string().min(1),
  since: z.string().nullable(),
});

export type AdminEntry = z.infer<typeof adminEntrySchema>;

export async function listGroupAdmins(): Promise<AdminEntry[]> {
  const response = await fetch("/api/admin/admins", {
    method: "GET",
    credentials: "same-origin",
  });
  if (!response.ok) throw await toServiceError(response);
  const body = (await response.json()) as { admins: unknown[] };
  return body.admins.map((a) => adminEntrySchema.parse(a));
}

// ─── Jogos da Copa (read-only) ────────────────────────────────────────────────

const matchTeamViewSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  flagUrl: z.string().nullable(),
});

export const adminMatchViewSchema = z.object({
  id: z.string().min(1),
  home: matchTeamViewSchema,
  away: matchTeamViewSchema,
  kickoffAt: z.string(),
  stage: stageSchema,
  round: z.number().int().nullable(),
  groupId: z.string().nullable(),
  venue: z.object({ name: z.string(), city: z.string() }).nullable(),
  status: matchStatusSchema,
  homeScore: z.number().int().nullable(),
  awayScore: z.number().int().nullable(),
  isManualOverride: z.boolean(),
});

export type AdminMatchView = z.infer<typeof adminMatchViewSchema>;

export interface MatchFilters {
  group?: string | undefined;
  stage?: string | undefined;
  status?: string | undefined;
}

export async function listAdminMatches(
  filters: MatchFilters = {},
): Promise<AdminMatchView[]> {
  const params = new URLSearchParams();
  if (filters.group) params.set("group", filters.group);
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.status) params.set("status", filters.status);
  const qs = params.toString();
  const response = await fetch(`/api/admin/matches${qs ? `?${qs}` : ""}`, {
    method: "GET",
    credentials: "same-origin",
  });
  if (!response.ok) throw await toServiceError(response);
  const body = (await response.json()) as { matches: unknown[] };
  return body.matches.map((m) => adminMatchViewSchema.parse(m));
}

/**
 * Dispara o sync openfootball → Firestore (PRD-11 TASK-02). Persiste as partidas
 * preservando overrides manuais; retorna o resumo (`SyncLog`) já gravado.
 */
export async function syncWorldCup(): Promise<SyncLog> {
  const response = await fetch("/api/admin/worldcup/sync", {
    method: "POST",
    credentials: "same-origin",
  });
  if (!response.ok) throw await toServiceError(response);
  return syncLogSchema.parse(await response.json());
}

/** Campos editáveis de uma partida (edição manual, PRD-11 TASK-04). */
export interface MatchEditInput {
  status: AdminMatchView["status"];
  homeScore: number | null;
  awayScore: number | null;
}

/**
 * Edição manual de uma partida (PRD-11 TASK-04). Marca `isManualOverride` no
 * servidor → blinda do sync. O backend valida coerência placar↔status (422).
 */
export async function editMatch(
  id: string,
  input: MatchEditInput,
): Promise<void> {
  const response = await fetch(`/api/admin/matches/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await toServiceError(response);
}
