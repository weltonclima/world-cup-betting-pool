// Barrel de firebase. Reexporta APENAS o client SDK (browser-safe).
// admin.ts é server-only e NÃO é reexportado aqui para não vazar ao browser.
// Importe o admin diretamente: `import { adminFirestore } from "@/firebase/admin"`.
export { firebaseApp, firebaseAuth, firestore } from "./client";
