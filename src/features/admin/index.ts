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
export { UsersPanel } from "./components/UsersPanel";
