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

// Serviços da Home Dashboard (PRD-02, TASK-03).
export { getGeneralRanking } from "./rankings";
export { getStatistics } from "./statistics";
export {
  listMatches,
  getMatchById,
  getNextScheduledMatch,
  getRecentFinishedMatches,
} from "./matches";
export { listAllTeams } from "./teams";
export { listPredictionsByUid } from "./predictions";
export { getSystemSettings } from "./systemSettings";
