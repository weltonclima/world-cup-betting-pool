/**
 * Testes TDD (RED) de deriveBracket.
 *
 * Função sob teste (a ser criada em ../bracket):
 *   deriveBracket(matches: MatchWithId[], teams: TeamWithId[]): BracketPayload
 *
 * Regras autoritativas codificadas aqui (ver spec grupos-eliminatorias-task-03):
 *  1. Somente stage !== "grupos". Mapa de buckets:
 *     dezesseis-avos→roundOf32, oitavas→roundOf16, quartas→quarterFinals,
 *     semifinal→semiFinals, terceiro→thirdPlace, final→final.
 *  2. Ordenação por número extraído do id ("m73"→73) asc.
 *     Id sem padrão m\d+ → ordenar ao final (defensivo, estável).
 *  3. Resolução de lado (KnockoutSide):
 *     - teamId em teams → { name, code, flagUrl? (spread condicional), defined: true }.
 *     - placeholder → { name: rótulo pt-BR, defined: false }:
 *         /^1([A-L])$/ → "1º do Grupo A" etc.
 *         /^2([A-L])$/ → "2º do Grupo B" etc.
 *         /^3[A-Z](\/[A-Z])+$/ → "3º do Grupo A/B/C/D/F" etc.
 *         /^W(\d+)$/   → "Vencedor Jogo 74" etc.
 *         /^L(\d+)$/   → "Perdedor Jogo 101" etc.
 *     - corrompido (não-placeholder, fora de teams) → { name: <raw id>, defined: false }.
 *  4. Status: ambos defined + finished → "encerrado";
 *             ambos defined + não finished → "definido";
 *             qualquer lado não-defined → "aguardando".
 *  5. Placares somente em "encerrado". Demais status: campos omitidos.
 *  6. phase = slug do stage; id = id do match.
 *  7. Buckets vazios = arrays vazios.
 */

import { describe, it, expect } from "vitest";

// Import proposital de módulo inexistente — estado RED esperado.
import { deriveBracket } from "../bracket";
import type { BracketPayload } from "../bracket";

import { bracketResponseSchema } from "@/schemas/worldcup";
import type { MatchWithId } from "@/types/matches";
import type { TeamWithId } from "@/types/teams";

// ─── Fábricas de fixtures ────────────────────────────────────────────────────

/** Cria uma seleção sem flagUrl por padrão. */
function mkTeam(id: string, name: string, code: string, flagUrl?: string): TeamWithId {
  return { id, name, code, ...(flagUrl !== undefined ? { flagUrl } : {}) };
}

/** Cria uma partida de mata-mata agendada (sem placares). */
function mkMatch(
  id: string,
  stage: MatchWithId["stage"],
  homeTeamId: string,
  awayTeamId: string,
  opts?: {
    status?: "finished" | "scheduled" | "live";
    homeScore?: number;
    awayScore?: number;
  },
): MatchWithId {
  const status = opts?.status ?? "scheduled";
  // "finished" tem placar default; "live" só tem placar quando passado
  // explicitamente (null = início do jogo, ainda 0x0 na fonte).
  const scored = status === "finished";
  return {
    id,
    homeTeamId,
    awayTeamId,
    kickoffAt: "2026-07-01T20:00:00-03:00",
    stage,
    groupId: null,
    venue: null,
    status,
    homeScore: opts?.homeScore ?? (scored ? 1 : null),
    awayScore: opts?.awayScore ?? (scored ? 0 : null),
  };
}

// ─── Seleções reais reutilizadas ─────────────────────────────────────────────

const teamBra = mkTeam("bra", "Brasil", "BRA", "https://cdn.example.com/bra.svg");
const teamArg = mkTeam("arg", "Argentina", "ARG", "https://cdn.example.com/arg.svg");
const teamFra = mkTeam("fra", "França", "FRA"); // sem flagUrl

// ─── Suíte principal ─────────────────────────────────────────────────────────

describe("deriveBracket", () => {
  // ── Caso 1: Agrupamento — 6 stages → 6 buckets corretos; grupo excluído ────
  describe("agrupamento por stage", () => {
    it("distribui cada stage no bucket correto e exclui partida de grupos", () => {
      const matches: MatchWithId[] = [
        mkMatch("m73", "dezesseis-avos", "bra", "arg"),
        mkMatch("m80", "oitavas", "bra", "arg"),
        mkMatch("m90", "quartas", "bra", "arg"),
        mkMatch("m95", "semifinal", "bra", "arg"),
        mkMatch("m103", "terceiro", "bra", "arg"),
        mkMatch("m104", "final", "bra", "arg"),
        // Deve ser excluída — fase de grupos:
        mkMatch("m01", "grupos", "bra", "arg"),
      ];
      const teams = [teamBra, teamArg];
      const result = deriveBracket(matches, teams);

      // Cada bucket tem exatamente o jogo correspondente.
      expect(result.roundOf32.map((m) => m.id)).toContain("m73");
      expect(result.roundOf16.map((m) => m.id)).toContain("m80");
      expect(result.quarterFinals.map((m) => m.id)).toContain("m90");
      expect(result.semiFinals.map((m) => m.id)).toContain("m95");
      expect(result.thirdPlace.map((m) => m.id)).toContain("m103");
      expect(result.final.map((m) => m.id)).toContain("m104");

      // Nenhum bucket deve conter o jogo de grupos.
      const allIds = [
        ...result.roundOf32,
        ...result.roundOf16,
        ...result.quarterFinals,
        ...result.semiFinals,
        ...result.thirdPlace,
        ...result.final,
      ].map((m) => m.id);
      expect(allIds).not.toContain("m01");
    });

    it("atribui phase = slug do stage ao KnockoutMatch", () => {
      const match = mkMatch("m73", "dezesseis-avos", "bra", "arg");
      const result = deriveBracket([match], [teamBra, teamArg]);
      expect(result.roundOf32[0]!.phase).toBe("dezesseis-avos");
    });
  });

  // ── Caso 2: Ordenação por número do id ───────────────────────────────────
  describe("ordenação dentro do bucket", () => {
    it("ordena por número do id asc (m75 antes de m89 no mesmo bucket)", () => {
      // Inserimos m89 antes de m75 na entrada — saída deve ser m75, m89.
      const matches: MatchWithId[] = [
        mkMatch("m89", "oitavas", "bra", "arg"),
        mkMatch("m75", "oitavas", "bra", "arg"),
      ];
      const result = deriveBracket(matches, [teamBra, teamArg]);
      expect(result.roundOf16[0]!.id).toBe("m75");
      expect(result.roundOf16[1]!.id).toBe("m89");
    });

    it("ids sem padrão m\\d+ vão ao final, estável", () => {
      const matches: MatchWithId[] = [
        mkMatch("extra-x", "oitavas", "bra", "arg"),
        mkMatch("m80", "oitavas", "bra", "arg"),
        mkMatch("extra-y", "oitavas", "bra", "arg"),
      ];
      const result = deriveBracket(matches, [teamBra, teamArg]);
      // m80 deve ser primeiro; extras ao final (estáveis entre si).
      expect(result.roundOf16[0]!.id).toBe("m80");
      const restIds = result.roundOf16.slice(1).map((m) => m.id);
      expect(restIds).toContain("extra-x");
      expect(restIds).toContain("extra-y");
    });
  });

  // ── Caso 3: Rótulos placeholder exatos ───────────────────────────────────
  describe("rótulos placeholder pt-BR", () => {
    it("1A → '1º do Grupo A'", () => {
      const match = mkMatch("m73", "dezesseis-avos", "1A", "bra");
      const result = deriveBracket([match], [teamBra]);
      expect(result.roundOf32[0]!.homeTeam.name).toBe("1º do Grupo A");
      expect(result.roundOf32[0]!.homeTeam.defined).toBe(false);
    });

    it("2L → '2º do Grupo L'", () => {
      const match = mkMatch("m73", "dezesseis-avos", "bra", "2L");
      const result = deriveBracket([match], [teamBra]);
      expect(result.roundOf32[0]!.awayTeam.name).toBe("2º do Grupo L");
      expect(result.roundOf32[0]!.awayTeam.defined).toBe(false);
    });

    it("3A/B/C/D/F → '3º do Grupo A/B/C/D/F'", () => {
      const match = mkMatch("m73", "dezesseis-avos", "3A/B/C/D/F", "bra");
      const result = deriveBracket([match], [teamBra]);
      expect(result.roundOf32[0]!.homeTeam.name).toBe("3º do Grupo A/B/C/D/F");
      expect(result.roundOf32[0]!.homeTeam.defined).toBe(false);
    });

    it("W74 → 'Vencedor Jogo 74'", () => {
      const match = mkMatch("m80", "oitavas", "W74", "bra");
      const result = deriveBracket([match], [teamBra]);
      expect(result.roundOf16[0]!.homeTeam.name).toBe("Vencedor Jogo 74");
      expect(result.roundOf16[0]!.homeTeam.defined).toBe(false);
    });

    it("L101 → 'Perdedor Jogo 101'", () => {
      const match = mkMatch("m103", "terceiro", "bra", "L101");
      const result = deriveBracket([match], [teamBra]);
      expect(result.thirdPlace[0]!.awayTeam.name).toBe("Perdedor Jogo 101");
      expect(result.thirdPlace[0]!.awayTeam.defined).toBe(false);
    });
  });

  // ── Caso 4: Lado real — name/code/flagUrl de teams ───────────────────────
  describe("lado real (time encontrado em teams)", () => {
    it("retorna name/code/flagUrl quando time tem flagUrl", () => {
      const match = mkMatch("m73", "dezesseis-avos", "bra", "arg");
      const result = deriveBracket([match], [teamBra, teamArg]);
      const home = result.roundOf32[0]!.homeTeam;
      expect(home.defined).toBe(true);
      expect(home.name).toBe("Brasil");
      expect(home.code).toBe("BRA");
      expect(home.flagUrl).toBe("https://cdn.example.com/bra.svg");
    });

    it("omite chave flagUrl quando time não tem flagUrl", () => {
      const match = mkMatch("m73", "dezesseis-avos", "fra", "bra");
      const result = deriveBracket([match], [teamFra, teamBra]);
      const home = result.roundOf32[0]!.homeTeam;
      expect(home.defined).toBe(true);
      expect(home.name).toBe("França");
      expect(home.code).toBe("FRA");
      // Chave deve estar ausente, não undefined.
      expect(home).not.toHaveProperty("flagUrl");
    });
  });

  // ── Caso 5: Matriz de status ──────────────────────────────────────────────
  describe("status do confronto", () => {
    it("aguardando quando homeTeam é placeholder (1 placeholder)", () => {
      const match = mkMatch("m73", "dezesseis-avos", "1A", "bra");
      const result = deriveBracket([match], [teamBra]);
      const km = result.roundOf32[0]!;
      expect(km.status).toBe("aguardando");
      expect(km).not.toHaveProperty("homeScore");
      expect(km).not.toHaveProperty("awayScore");
    });

    it("aguardando quando ambos são placeholders (2 placeholders)", () => {
      const match = mkMatch("m73", "dezesseis-avos", "1A", "2B");
      const result = deriveBracket([match], []);
      const km = result.roundOf32[0]!;
      expect(km.status).toBe("aguardando");
      expect(km).not.toHaveProperty("homeScore");
      expect(km).not.toHaveProperty("awayScore");
    });

    it("definido quando ambos reais e status scheduled", () => {
      const match = mkMatch("m73", "dezesseis-avos", "bra", "arg", { status: "scheduled" });
      const result = deriveBracket([match], [teamBra, teamArg]);
      const km = result.roundOf32[0]!;
      expect(km.status).toBe("definido");
      expect(km).not.toHaveProperty("homeScore");
      expect(km).not.toHaveProperty("awayScore");
    });

    it("encerrado quando ambos reais e match finished — placares presentes", () => {
      const match = mkMatch("m73", "dezesseis-avos", "bra", "arg", {
        status: "finished",
        homeScore: 2,
        awayScore: 1,
      });
      const result = deriveBracket([match], [teamBra, teamArg]);
      const km = result.roundOf32[0]!;
      expect(km.status).toBe("encerrado");
      expect(km.homeScore).toBe(2);
      expect(km.awayScore).toBe(1);
    });

    it("em-andamento quando ambos reais e match live — placar parcial presente", () => {
      const match = mkMatch("m73", "dezesseis-avos", "bra", "arg", {
        status: "live",
        homeScore: 1,
        awayScore: 0,
      });
      const result = deriveBracket([match], [teamBra, teamArg]);
      const km = result.roundOf32[0]!;
      expect(km.status).toBe("em-andamento");
      expect(km.homeScore).toBe(1);
      expect(km.awayScore).toBe(0);
      // Saída ao vivo deve respeitar o contrato (placar parcial é válido).
      expect(() => bracketResponseSchema.parse(result)).not.toThrow();
    });

    it("em-andamento com 0 x 0 quando match live sem placar (início do jogo)", () => {
      const match = mkMatch("m73", "dezesseis-avos", "bra", "arg", { status: "live" });
      const result = deriveBracket([match], [teamBra, teamArg]);
      const km = result.roundOf32[0]!;
      expect(km.status).toBe("em-andamento");
      expect(km.homeScore).toBe(0);
      expect(km.awayScore).toBe(0);
    });
  });

  // ── Caso 6: Misto real + placeholder → aguardando, sem placares ──────────
  describe("misto: um real + um placeholder", () => {
    it("aguardando, sem placares, mesmo que o match estivesse finished (pathológico)", () => {
      // Dados patológicos: match "finished" mas awayTeam é placeholder.
      // status deve ser "aguardando" (regra 4) e placares OMITIDOS (regra 5).
      const match = mkMatch("m73", "dezesseis-avos", "bra", "W74", {
        status: "finished",
        homeScore: 2,
        awayScore: 0,
      });
      const result = deriveBracket([match], [teamBra]);
      const km = result.roundOf32[0]!;
      expect(km.status).toBe("aguardando");
      expect(km).not.toHaveProperty("homeScore");
      expect(km).not.toHaveProperty("awayScore");
    });
  });

  // ── Caso 7: teamId corrompido ─────────────────────────────────────────────
  describe("teamId corrompido (não-placeholder, fora de teams)", () => {
    it("defined:false com name cru, sem lançar", () => {
      const match = mkMatch("m73", "dezesseis-avos", "FOO", "bra");
      let result!: BracketPayload;
      expect(() => {
        result = deriveBracket([match], [teamBra]);
      }).not.toThrow();
      const home = result.roundOf32[0]!.homeTeam;
      expect(home.defined).toBe(false);
      expect(home.name).toBe("FOO");
      expect(home).not.toHaveProperty("code");
    });
  });

  // ── Caso 8: Buckets vazios ────────────────────────────────────────────────
  describe("entrada vazia → 6 buckets vazios", () => {
    it("retorna todos os buckets como arrays vazios", () => {
      const result = deriveBracket([], []);
      expect(result.roundOf32).toEqual([]);
      expect(result.roundOf16).toEqual([]);
      expect(result.quarterFinals).toEqual([]);
      expect(result.semiFinals).toEqual([]);
      expect(result.thirdPlace).toEqual([]);
      expect(result.final).toEqual([]);
    });
  });

  // ── Caso 9: Saída completa passa bracketResponseSchema.parse ─────────────
  describe("conformidade de schema", () => {
    it("saída realista completa passa bracketResponseSchema.parse", () => {
      const teams = [teamBra, teamArg, teamFra];
      const matches: MatchWithId[] = [
        // roundOf32: 1 jogo aguardando (placeholder)
        mkMatch("m73", "dezesseis-avos", "1A", "bra"),
        // roundOf16: 1 jogo definido
        mkMatch("m89", "oitavas", "bra", "arg", { status: "scheduled" }),
        // quarterFinals: 1 encerrado
        mkMatch("m97", "quartas", "bra", "arg", {
          status: "finished",
          homeScore: 3,
          awayScore: 0,
        }),
        // semiFinals: 1 aguardando (2 placeholders)
        mkMatch("m99", "semifinal", "W89", "W90"),
        // thirdPlace: 1 definido
        mkMatch("m103", "terceiro", "fra", "arg", { status: "scheduled" }),
        // final: 1 aguardando (placeholder)
        mkMatch("m104", "final", "W99", "W100"),
      ];

      let result!: BracketPayload;
      expect(() => {
        result = deriveBracket(matches, teams);
      }).not.toThrow();

      expect(() => bracketResponseSchema.parse(result)).not.toThrow();
    });
  });

  // ── Caso 10: Propagação de kickoffAt e venue ─────────────────────────────
  describe("propagação de kickoffAt e venue", () => {
    it("kickoffAt do match é propagado para KnockoutMatch", () => {
      const match = mkMatch("m73", "dezesseis-avos", "bra", "arg");
      const result = deriveBracket([match], [teamBra, teamArg]);
      // mkMatch usa "2026-07-01T20:00:00-03:00" como kickoffAt fixo.
      expect(result.roundOf32[0]!.kickoffAt).toBe("2026-07-01T20:00:00-03:00");
    });

    it("venue é propagado quando match.venue está presente", () => {
      const matchWithVenue: MatchWithId = {
        ...mkMatch("m80", "oitavas", "bra", "arg"),
        venue: { name: "MetLife Stadium", city: "Nova Jersey" },
      };
      const result = deriveBracket([matchWithVenue], [teamBra, teamArg]);
      expect(result.roundOf16[0]!.venue).toEqual({
        name: "MetLife Stadium",
        city: "Nova Jersey",
      });
    });

    it("chave venue está ausente (não undefined) quando match.venue é null", () => {
      // mkMatch padrão: venue: null
      const match = mkMatch("m73", "dezesseis-avos", "bra", "arg");
      const result = deriveBracket([match], [teamBra, teamArg]);
      expect(result.roundOf32[0]!).not.toHaveProperty("venue");
    });
  });

  // ── Caso edge: finished com lado placeholder → aguardando, sem placares ──
  describe("edge: dados patológicos — finished + placeholder → aguardando, placares omitidos", () => {
    it("status 'aguardando' e homeScore/awayScore ausentes", () => {
      const match = mkMatch("m104", "final", "L101", "L102", {
        status: "finished",
        homeScore: 1,
        awayScore: 0,
      });
      const result = deriveBracket([match], []);
      const km = result.final[0]!;
      expect(km.status).toBe("aguardando");
      // Deve passar no schema (refine exige ausência de placares em não-encerrado).
      expect(() => bracketResponseSchema.parse(result)).not.toThrow();
    });
  });
});
