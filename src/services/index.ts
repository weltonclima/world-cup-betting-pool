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
