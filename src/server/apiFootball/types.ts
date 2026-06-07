/**
 * Interfaces TypeScript das respostas da API-Football.
 * Subconjunto mínimo dos campos consumidos pelo mapeamento.
 * Campos adicionais da API são ignorados pelo HttpApiFootballClient.
 */

export interface ApiTeamInfo {
  id: number;
  name: string;
  code: string;
  logo: string;
}

export interface TeamResponse {
  team: ApiTeamInfo;
  /** Grupo no torneio (injetado pelo contexto quando endpoints separados são combinados) */
  group?: string;
}

/**
 * Sede da partida (origem: fixture.venue da API-Football).
 * name/city podem vir `null` quando a sede ainda não foi definida (TBD).
 */
export interface ApiVenue {
  id: number | null;
  name: string | null;
  city: string | null;
}

export interface FixtureInfo {
  id: number;
  /** Data/hora em ISO 8601 */
  date: string;
  status: { short: string };
  /** Estádio/sede; pode estar ausente ou com campos null (TBD) */
  venue?: ApiVenue | null;
}

export interface FixtureResponse {
  fixture: FixtureInfo;
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  league: {
    /** Ex.: "Group Stage - 1", "Round of 16", "Quarter-finals" */
    round: string;
  };
}

/** Envelope de resposta paginada da API-Football */
export interface ApiFootballResponse<T> {
  results: number;
  response: T[];
}
