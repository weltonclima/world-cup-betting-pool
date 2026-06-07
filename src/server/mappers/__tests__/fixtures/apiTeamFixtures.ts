/**
 * Fixtures de teste para TeamResponse da API-Football (TASK-02).
 */

import type { TeamResponse } from "../../../apiFootball/types";

/** Seleção com todos os campos preenchidos (grupo incluído) */
export const teamCompleto: TeamResponse = {
  team: {
    id: 6,
    name: "Brasil",
    code: "BRA",
    logo: "https://media.api-sports.io/football/teams/6.png",
  },
  group: "A",
};

/** Seleção sem grupo (fase eliminatória) */
export const teamSemGrupo: TeamResponse = {
  team: {
    id: 9,
    name: "Espanha",
    code: "ESP",
    logo: "https://media.api-sports.io/football/teams/9.png",
  },
};

/** Seleção com logo vazia (flagUrl deve ficar undefined) */
export const teamSemLogo: TeamResponse = {
  team: {
    id: 10,
    name: "França",
    code: "FRA",
    logo: "",
  },
  group: "B",
};

/** Seleção com logo inválida (não-URL → ZodError pela regra z.url() do front) */
export const teamLogoInvalida: TeamResponse = {
  team: {
    id: 11,
    name: "Portugal",
    code: "POR",
    logo: "nao-e-uma-url",
  },
  group: "B",
};

/** Seleção com código inválido (4 caracteres — deve lançar ZodError) */
export const teamCodigoInvalido: TeamResponse = {
  team: {
    id: 999,
    name: "Inválido",
    code: "BRAZ",
    logo: "https://example.com/logo.png",
  },
  group: "A",
};

/** Seleção com nome vazio (deve lançar ZodError) */
export const teamNomeVazio: TeamResponse = {
  team: {
    id: 998,
    name: "",
    code: "TST",
    logo: "https://example.com/logo.png",
  },
  group: "A",
};
