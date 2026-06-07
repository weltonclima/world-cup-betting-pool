/**
 * Ponto de entrada das Firebase Functions do Bolão dos Parças.
 *
 * Exporta:
 * - syncTeams: função callable HTTPS para sincronizar seleções sob demanda
 * - scheduledSync: função agendada (cron 0 2 * * *) para atualização diária
 * - promoteFirstAdmin: trigger onCreate users/{uid} que promove o primeiro usuário a admin
 * - syncRoleClaimOnUserUpdate: trigger onUpdate users/{uid} que sincroniza o custom claim `role`
 */

export { syncTeams } from "./functions/syncTeams";
export { scheduledSync } from "./functions/scheduledSync";
export { promoteFirstAdmin } from "./functions/promoteFirstAdmin";
export { syncRoleClaimOnUserUpdate } from "./functions/syncRoleClaimOnUserUpdate";
