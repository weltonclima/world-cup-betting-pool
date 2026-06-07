/**
 * Barrel (entrada pública) da camada de integração API-Football.
 *
 * `import "server-only"` garante que qualquer tentativa de importar esta API
 * a partir de um Client Component falhe no build (o marker lança fora do
 * bundle de servidor). Route Handlers e código server devem consumir a API
 * exclusivamente por este barrel: `import { getApiFootballClient } from "@/server/apiFootball"`.
 *
 * Os módulos internos (./client, ./mock, ./factory, ./config, ./types) NÃO
 * contêm "server-only" para que possam ser testados diretamente sob vitest.
 */
import "server-only";

export { getApiFootballClient } from "./factory";

export {
  HttpApiFootballClient,
  ApiFootballQuotaError,
  ApiFootballAuthError,
  ApiFootballTimeoutError,
} from "./client";
export type { ApiFootballClient } from "./client";

export { MockApiFootballClient, MOCK_TEAMS, MOCK_FIXTURES } from "./mock";

export { COPA_2026_CONFIG, isUseMockFallback } from "./config";

export type {
  ApiTeamInfo,
  TeamResponse,
  FixtureInfo,
  FixtureResponse,
  ApiFootballResponse,
} from "./types";
