/**
 * Testes de teamMapper (TASK-02) — TDD (RED → GREEN).
 * Usa @/schemas como fonte única (teamSchema strict, flagUrl via z.url()).
 */

import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import { mapApiTeamToFirestore } from "../teamMapper";
import {
  teamCompleto,
  teamSemGrupo,
  teamSemLogo,
  teamLogoInvalida,
  teamCodigoInvalido,
  teamNomeVazio,
} from "./fixtures/apiTeamFixtures";

describe("mapApiTeamToFirestore", () => {
  it("T1: mapeia seleção com todos os campos preenchidos corretamente", () => {
    const r = mapApiTeamToFirestore(teamCompleto);
    expect(r.name).toBe("Brasil");
    expect(r.code).toBe("BRA");
    expect(r.flagUrl).toBe("https://media.api-sports.io/football/teams/6.png");
    expect(r.groupId).toBe("A");
  });

  it("T2: groupId injetado como parâmetro prevalece sobre o da resposta", () => {
    const r = mapApiTeamToFirestore(teamSemGrupo, "A");
    expect(r.groupId).toBe("A");
  });

  it("T3: usa groupId da resposta da API quando parâmetro não é fornecido", () => {
    const r = mapApiTeamToFirestore(teamCompleto);
    expect(r.groupId).toBe("A");
  });

  it("T4: flagUrl fica undefined quando logo está vazio na API", () => {
    const r = mapApiTeamToFirestore(teamSemLogo);
    expect(r.flagUrl).toBeUndefined();
  });

  it("T5: lança ZodError quando code tem mais de 3 caracteres", () => {
    expect(() => mapApiTeamToFirestore(teamCodigoInvalido)).toThrow(ZodError);
  });

  it("T6: lança ZodError quando name está vazio", () => {
    expect(() => mapApiTeamToFirestore(teamNomeVazio)).toThrow(ZodError);
  });

  it("T7: lança ZodError quando logo não é uma URL válida", () => {
    expect(() => mapApiTeamToFirestore(teamLogoInvalida)).toThrow(ZodError);
  });
});
