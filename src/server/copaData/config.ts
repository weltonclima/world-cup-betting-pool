export const COPA_DATA_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

/** next.js `revalidate` em segundos — alinhar com os Route Handlers */
export const REVALIDATE_MATCHES = 300;    // 5min — alinhado ao ciclo ESPN (fonte primária, PRD-13)
export const REVALIDATE_TEAMS   = 86400;  // 24h — composição estática
