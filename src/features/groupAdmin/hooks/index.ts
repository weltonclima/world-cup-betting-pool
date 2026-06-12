// Barrel dos hooks da Administração de Grupo (PRD-10).
export { groupKeys } from "./groupKeys";
export { useGroupDashboard } from "./useGroupDashboard";
export { useGroupUsers } from "./useGroupUsers";
export {
  useModerateGroupUser,
  type ModerateGroupUserVars,
} from "./useModerateGroupUser";
export { usePromoteGroupAdmin } from "./usePromoteGroupAdmin";
export { useGroupSettings, useUpdateGroupSettings } from "./useGroupSettings";
export {
  useGroupInvites,
  useCreateInvite,
  useRevokeInvite,
} from "./useGroupInvites";
