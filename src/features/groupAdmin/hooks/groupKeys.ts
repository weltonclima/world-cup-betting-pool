import type { UserStatus } from "@/types";

/**
 * Factory único das query keys da Administração de Grupo (PRD-10). Fonte única
 * evita strings mágicas e drift entre query e invalidação. Espelha `usersKeys`
 * (admin) e `groupsKeys` (PRD-09). Reusado por todas as telas.
 */
export const groupKeys = {
  all: ["group"] as const,
  dashboard: () => ["group", "dashboard"] as const,
  usersByStatus: (status: UserStatus) =>
    ["group", "users", status] as const,
  invites: () => ["group", "invites"] as const,
  settings: () => ["group", "settings"] as const,
  predictions: () => ["group", "predictions"] as const,
  // Catálogo público de campeonatos (TASK-08). Escopo global (estático, não
  // depende do pool) — chave própria fora de `settings`/`dashboard`.
  championshipsCatalog: () => ["championships", "catalog"] as const,
} as const;
