export const COPA_DATA_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

/** next.js `revalidate` em segundos — alinhar com os Route Handlers */
export const REVALIDATE_MATCHES = 3600;   // 1h — dados mudam quando score.ft é populado
export const REVALIDATE_TEAMS   = 86400;  // 24h — composição estática

/**
 * Retorna true se o flag de mock estiver ativo.
 * Usa COPA_DATA_USE_MOCK=true (substitui API_FOOTBALL_USE_MOCK).
 * Lida via função (não captura estática) para funcionar em testes e hot-reload.
 */
export function isUseMockFallback(): boolean {
  return process.env["COPA_DATA_USE_MOCK"] === "true";
}
