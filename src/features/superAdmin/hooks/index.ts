// Barrel de hooks do Super Admin (PRD-11)
export { superAdminKeys } from "./superAdminKeys";
export { useDashboardStats } from "./useDashboardStats";
export {
  useAdminGroups,
  useUpdateGroupStatus,
  useDeleteGroup,
  useChangeGroupAdmin,
  useRemoveGroupAdmin,
  type UpdateGroupStatusVars,
  type ChangeGroupAdminVars,
} from "./useAdminGroups";
export { useAdminAdmins } from "./useAdminAdmins";
export { usePoolMembers } from "./usePoolMembers";
export {
  useAdminMatches,
  useSyncWorldCup,
  useEditMatch,
  type EditMatchVars,
} from "./useAdminMatches";
export { useAdminLogs } from "./useAdminLogs";
