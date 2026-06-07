/**
 * Ponto de entrada das Firebase Functions do Bolão dos Parças.
 *
 * Exporta:
 * - promoteFirstAdmin: trigger onCreate users/{uid} que promove o primeiro usuário a admin
 * - syncRoleClaimOnUserUpdate: trigger onUpdate users/{uid} que sincroniza o custom claim `role`
 *
 * NOTA (TASK-11 / A7): o pipeline antigo de persistência da Copa no Firestore
 * (syncTeams callable + scheduledSync cron 0 2 * * *) foi removido. Os dados da
 * Copa agora vêm de Route Handlers Next.js + cache (src/server). A CF de ranking
 * (cron diário 02:00 que recalcula pontuação a partir dos resultados) será
 * reintroduzida no PRD de ranking — consumindo uma cópia controlada do client de
 * resultados, sem reintroduzir a gravação de matches/teams no Firestore.
 */

export { promoteFirstAdmin } from "./functions/promoteFirstAdmin";
export { syncRoleClaimOnUserUpdate } from "./functions/syncRoleClaimOnUserUpdate";
