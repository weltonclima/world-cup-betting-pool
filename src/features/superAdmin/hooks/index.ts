// Barrel de hooks do Super Admin (PRD-11)
export { superAdminKeys } from "./superAdminKeys";
export { useDashboardStats } from "./useDashboardStats";
export {
  useAdminGroups,
  useUpdateGroupStatus,
  useDeleteGroup,
  useChangeGroupAdmin,
  useRemoveGroupAdmin,
  useCreateAdminGroup,
  useUpdateAdminGroup,
  useCreateAdminGroupInvite,
  useAdminGroupInvite,
  type UpdateGroupStatusVars,
  type ChangeGroupAdminVars,
  type UpdateAdminGroupVars,
  type CreateAdminGroupInviteInput,
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
export {
  useAssignableUsers,
  useAssignUserToGroup,
  type AssignUserToGroupVars,
} from "./useAdminUsers";
