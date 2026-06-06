/**
 * Testes de teamMapper — TDD (ciclo RED → GREEN).
 * Casos T1–T6 conforme spec §10.3.
 */

import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import { mapApiTeamToFirestore } from "../mappers/teamMapper";
import {
  teamCompleto,
  teamSemGrupo,
  teamSemLogo,
  teamCodigoInvalido,
  teamNomeVazio,
} from "./fixtures/apiTeamFixtures";

describe("mapApiTeamToFirestore", () => {
  // T1: Mapeamento completo válido
  it("T1: mapeia seleção com todos os campos preenchidos corretamente", () => {
    const resultado = mapApiTeamToFirestore(teamCompleto);

    expect(resultado.name).toBe("Brasil");
    expect(resultado.code).toBe("BRA");
    expect(resultado.flagUrl).toBe(
      "https://media.api-sports.io/football/teams/6.png",
    );
    expect(resultado.groupId).toBe("A");
  });

  // T2: groupId injetado como parâmetro prevalece sobre o da resposta
  it("T2: groupId injetado como parâmetro é usado quando fornecido", () => {
    const resultado = mapApiTeamToFirestore(teamSemGrupo, "A");

    expect(resultado.groupId).toBe("A");
  });

  // T3: groupId da resposta da API quando parâmetro está ausente
  it("T3: usa groupId da resposta da API quando parâmetro não é fornecido", () => {
    const resultado = mapApiTeamToFirestore(teamCompleto);

    expect(resultado.groupId).toBe("A");
  });

  // T4: flagUrl ausente/vazia deve ficar undefined
  it("T4: flagUrl fica undefined quando logo está vazio na API", () => {
    const resultado = mapApiTeamToFirestore(teamSemLogo);

    expect(resultado.flagUrl).toBeUndefined();
  });

  // T5: code inválido (4 chars) deve lançar ZodError
  it("T5: lança ZodError quando code tem mais de 3 caracteres", () => {
    expect(() => mapApiTeamToFirestore(teamCodigoInvalido)).toThrow(ZodError);
  });

  // T6: name vazio deve lançar ZodError
  it("T6: lança ZodError quando name está vazio", () => {
    expect(() => mapApiTeamToFirestore(teamNomeVazio)).toThrow(ZodError);
  });
});
