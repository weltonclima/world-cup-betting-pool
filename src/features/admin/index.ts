// Barrel da feature admin (PRD-01.2). Camada de dados do painel administrativo.
export {
  useUsersByStatus,
  useUserStatusCounts,
  type UserStatusCounts,
} from "./hooks/useUsers";
export {
  useUpdateUserStatus,
  InvalidStatusTransitionError,
  type UpdateUserStatusVars,
} from "./hooks/useUpdateUserStatus";
export { usersKeys } from "./hooks/usersKeys";
export { useAdminStats, type AdminStats } from "./hooks/useAdminStats";
export { useSystemLogs, systemLogsKeys } from "./hooks/useSystemLogs";
export { UsersPanel } from "./components/UsersPanel";
export { UserStatusList } from "./components/UserStatusList";
export { AdminSubHeader } from "./components/AdminSubHeader";
export { AdminDashboard } from "./components/AdminDashboard";
export { ApiStatus } from "./components/ApiStatus";
export { SystemLogs } from "./components/SystemLogs";
