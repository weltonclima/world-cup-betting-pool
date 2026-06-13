// Barrel de services. Reexporta chamadas ao Firestore e APIs.
export {
  signIn,
  signUp,
  signOut,
  sendPasswordReset,
  verifyResetCode,
  confirmReset,
  changePassword,
  type SignUpInput,
} from "./auth";

export { listUsersByStatus, updateUserStatus } from "./users";

// Serviços de ranking (PRD-02 Home + PRD-05 Ranking).
export {
  getGeneralRanking,
  getPoolRanking,
  getRankingByScope,
  getGroupRanking,
  getUserRanking,
  getParticipantProfile,
  getPoolStats,
  triggerGroupRankingRecalc,
  type UserRankingResult,
} from "./rankings";
export { getStatistics } from "./statistics";
export {
  listMatches,
  getMatchById,
  getNextScheduledMatch,
  getRecentFinishedMatches,
} from "./matches";
export { listAllTeams } from "./teams";
export {
  listPredictionsByUid,
  upsertPrediction,
  PredictionServiceError,
  type UpsertPredictionInput,
} from "./predictions";
export { getSystemSettings } from "./systemSettings";
export {
  listNotifications,
  getNotification,
  markAsRead,
  markAllAsRead,
  createNotification,
  getPreferences,
  updatePreferences,
} from "./notifications";
export { createLog, listLogs } from "./systemLogs";
export { getGroups, getBracket } from "./worldcup";
export {
  createPool,
  searchPools,
  getPool,
  PoolServiceError,
  type CreatePoolInput,
} from "./pools";
