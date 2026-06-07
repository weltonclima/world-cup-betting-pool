/**
 * MockCopaDataClient — implementação mock sem I/O real.
 *
 * Usado quando COPA_DATA_USE_MOCK=true.
 * Importa fixtures de teste para fornecer dados consistentes em dev/CI.
 */

import type { CopaDataClient } from "./client";
import type { OpenFootballData } from "./types";
import { MOCK_COPA_DATA } from "./mockData";

export class MockCopaDataClient implements CopaDataClient {
  async getData(): Promise<OpenFootballData> {
    return MOCK_COPA_DATA;
  }
}
