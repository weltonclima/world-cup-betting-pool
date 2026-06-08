// Barrel de services. Reexporta chamadas ao Firestore e APIs.
export {
  signIn,
  signUp,
  signOut,
  sendPasswordReset,
  verifyResetCode,
  confirmReset,
  type SignUpInput,
} from "./auth";

export { listUsersByStatus, updateUserStatus } from "./users";

// Serviços de ranking (PRD-02 Home + PRD-05 Ranking).
export {
  getGeneralRanking,
  getRankingByScope,
  getGroupRanking,
  getUserRanking,
  getParticipantProfile,
  getPoolStats,
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
