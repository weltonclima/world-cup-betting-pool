/**
 * Factory do cliente API-Football.
 *
 * Único ponto no código de produção que decide qual implementação usar.
 * Retorna MockApiFootballClient quando API_FOOTBALL_KEY não está configurada
 * ou quando API_FOOTBALL_USE_MOCK=true — permitindo desenvolvimento sem credenciais.
 */

import { HttpApiFootballClient } from "./client";
import { MockApiFootballClient } from "./mock";
import { isUseMockFallback } from "./config";
import type { ApiFootballClient } from "./client";

/**
 * Retorna a implementação adequada do cliente API-Football.
 * - Com API_FOOTBALL_KEY configurada e API_FOOTBALL_USE_MOCK!=true → HttpApiFootballClient
 * - Sem API_FOOTBALL_KEY ou com API_FOOTBALL_USE_MOCK=true → MockApiFootballClient
 */
export function getApiFootballClient(): ApiFootballClient {
  const apiKey = process.env["API_FOOTBALL_KEY"];
  if (!apiKey || isUseMockFallback()) {
    // Sem chave configurada → usar mock (ambiente de desenvolvimento / Copa sem fixtures)
    return new MockApiFootballClient();
  }
  return new HttpApiFootballClient(apiKey);
}
