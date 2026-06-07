/**
 * IDs do torneio Copa do Mundo 2026 na API-Football.
 *
 * ⚠️  PLACEHOLDER — os IDs reais ainda não estão disponíveis na API-Football
 * (copa de 2026; fixtures podem não existir no momento desta implementação).
 *
 * Quando os IDs forem publicados pela API-Football, atualizar apenas este arquivo.
 * Referência: https://www.api-football.com/documentation-v3#tag/Leagues
 *
 * Copa do Mundo 2018: leagueId = 1, season = 2018
 * Copa do Mundo 2022: leagueId = 1, season = 2022
 * Copa do Mundo 2026: leagueId provavelmente = 1, season = 2026 (CONFIRMAR)
 */
export const COPA_2026_CONFIG = {
  // World Cup = league 1 na API-Football (confirmado via /leagues?search=world cup).
  leagueId: 1,
  // ⚠️ season 2026 é BLOQUEADA no plano free ("Free plans do not have access to
  // this season, try from 2022 to 2024"). Usamos 2022 (Copa do Catar — 64 jogos
  // reais, plano free) até haver acesso/upgrade para 2026.
  // TODO: voltar para 2026 quando o plano liberar a temporada da próxima Copa.
  season: 2026,
} as const;

/**
 * Retorna true se a flag de mock estiver ativa no momento da chamada.
 * Lido via função para que mudanças em process.env após o import tenham efeito
 * (evita captura estática no módulo — útil em testes e hot-reload).
 * Configurar via API_FOOTBALL_USE_MOCK=true no .env local.
 */
export function isUseMockFallback(): boolean {
  return process.env["API_FOOTBALL_USE_MOCK"] === "true";
}
