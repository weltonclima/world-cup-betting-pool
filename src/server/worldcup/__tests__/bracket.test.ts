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

import type { EspnBracketMap } from "@/server/copaData";

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

  // ═══ TASK-03 — propagação ESPN: label/slot/pênaltis/advance/outcome ═══════
  //
  // Comportamento NOVO (RED): deriveBracket passa a usar os campos TASK-02 do
  // MatchWithId (homePlaceholderLabel/awayPlaceholderLabel, homeBracketSlot/
  // awayBracketSlot, homeShootout/awayShootout, advanceSide, outcome).
  describe("TASK-03 — propagação dos campos ESPN", () => {
    // ── Precedência de rótulo do placeholder: ESPN > reconstrução de W{n} ──
    describe("rótulo placeholder do match (ESPN) tem precedência", () => {
      it("usa homePlaceholderLabel do match em vez de reconstruir de 'W74'", () => {
        const match: MatchWithId = {
          ...mkMatch("m80", "oitavas", "W74", "bra"),
          homePlaceholderLabel: "Vencedor R32 jogo 3",
          homeBracketSlot: { round: "round-of-32", game: 3 },
        };
        const result = deriveBracket([match], [teamBra]);
        const home = result.roundOf16[0]!.homeTeam;
        expect(home.defined).toBe(false);
        expect(home.name).toBe("Vencedor R32 jogo 3");
      });

      it("anexa bracketSlot por lado ao KnockoutSide placeholder", () => {
        const match: MatchWithId = {
          ...mkMatch("m80", "oitavas", "W74", "W75"),
          homePlaceholderLabel: "Vencedor R32 jogo 3",
          homeBracketSlot: { round: "round-of-32", game: 3 },
          awayPlaceholderLabel: "Vencedor R32 jogo 4",
          awayBracketSlot: { round: "round-of-32", game: 4 },
        };
        const result = deriveBracket([match], []);
        const km = result.roundOf16[0]!;
        expect(km.homeTeam.bracketSlot).toEqual({ round: "round-of-32", game: 3 });
        expect(km.awayTeam.bracketSlot).toEqual({ round: "round-of-32", game: 4 });
        expect(() => bracketResponseSchema.parse(result)).not.toThrow();
      });

      it("sem label ESPN → fallback de reconstrução openfootball ('Vencedor Jogo 74')", () => {
        // Match legado sem homePlaceholderLabel — comportamento atual preservado.
        const match = mkMatch("m80", "oitavas", "W74", "bra");
        const result = deriveBracket([match], [teamBra]);
        const home = result.roundOf16[0]!.homeTeam;
        expect(home.name).toBe("Vencedor Jogo 74");
        expect(home).not.toHaveProperty("bracketSlot");
      });

      it("label ESPN vence id corrompido (não-placeholder, fora de teams)", () => {
        const match: MatchWithId = {
          ...mkMatch("m80", "oitavas", "TBD", "bra"),
          homePlaceholderLabel: "Vencedor R32 jogo 5",
          homeBracketSlot: { round: "round-of-32", game: 5 },
        };
        const result = deriveBracket([match], [teamBra]);
        const home = result.roundOf16[0]!.homeTeam;
        expect(home.name).toBe("Vencedor R32 jogo 5");
        expect(home.defined).toBe(false);
        expect(home.bracketSlot).toEqual({ round: "round-of-32", game: 5 });
      });

      it("lado resolvido a time real não carrega bracketSlot", () => {
        const match: MatchWithId = {
          ...mkMatch("m80", "oitavas", "bra", "W75"),
          // slot do home presente nos dados, mas o lado resolve a um time real.
          homeBracketSlot: { round: "round-of-32", game: 1 },
        };
        const result = deriveBracket([match], [teamBra]);
        const home = result.roundOf16[0]!.homeTeam;
        expect(home.defined).toBe(true);
        expect(home).not.toHaveProperty("bracketSlot");
      });
    });

    // ── Pênaltis: invariante (shootout NUNCA somado ao placar normal) ──────
    describe("encerrado nos pênaltis", () => {
      it("propaga shootout/advanceSide/outcome; placar de tempo normal intacto", () => {
        const match: MatchWithId = {
          ...mkMatch("m97", "quartas", "bra", "arg", {
            status: "finished",
            homeScore: 1,
            awayScore: 1,
          }),
          homeShootout: 4,
          awayShootout: 2,
          advanceSide: "home",
          outcome: "penalties",
        };
        const result = deriveBracket([match], [teamBra, teamArg]);
        const km = result.quarterFinals[0]!;
        // INVARIANTE: placar normal preservado, shootout em campo próprio.
        expect(km.homeScore).toBe(1);
        expect(km.awayScore).toBe(1);
        expect(km.homeShootout).toBe(4);
        expect(km.awayShootout).toBe(2);
        expect(km.advanceSide).toBe("home");
        expect(km.outcome).toBe("penalties");
        expect(() => bracketResponseSchema.parse(result)).not.toThrow();
      });
    });

    // ── Outcome normal/overtime: outcome + advance, sem shootout ───────────
    describe("encerrado no tempo normal / prorrogação", () => {
      it("outcome 'normal' + advanceSide propagados, sem campos de shootout", () => {
        const match: MatchWithId = {
          ...mkMatch("m97", "quartas", "bra", "arg", {
            status: "finished",
            homeScore: 2,
            awayScore: 0,
          }),
          advanceSide: "home",
          outcome: "normal",
        };
        const result = deriveBracket([match], [teamBra, teamArg]);
        const km = result.quarterFinals[0]!;
        expect(km.outcome).toBe("normal");
        expect(km.advanceSide).toBe("home");
        expect(km).not.toHaveProperty("homeShootout");
        expect(km).not.toHaveProperty("awayShootout");
        expect(() => bracketResponseSchema.parse(result)).not.toThrow();
      });

      it("INVARIANTE: shootout em outcome 'normal' é descartado (não vaza)", () => {
        // Dados patológicos: outcome normal mas com shootout perdido nos dados.
        // O ramo else-if jamais copia shootout — protege o invariante.
        const match: MatchWithId = {
          ...mkMatch("m97", "quartas", "bra", "arg", {
            status: "finished",
            homeScore: 2,
            awayScore: 0,
          }),
          outcome: "normal",
          homeShootout: 3,
          awayShootout: 1,
        };
        const result = deriveBracket([match], [teamBra, teamArg]);
        const km = result.quarterFinals[0]!;
        expect(km.outcome).toBe("normal");
        // Placar normal intacto; shootout descartado.
        expect(km.homeScore).toBe(2);
        expect(km.awayScore).toBe(0);
        expect(km).not.toHaveProperty("homeShootout");
        expect(km).not.toHaveProperty("awayShootout");
        expect(() => bracketResponseSchema.parse(result)).not.toThrow();
      });

      it("encerrado sem advanceSide nos dados → chave advanceSide ausente", () => {
        const match: MatchWithId = {
          ...mkMatch("m97", "quartas", "bra", "arg", {
            status: "finished",
            homeScore: 2,
            awayScore: 0,
          }),
          outcome: "normal",
          // advanceSide ausente (undefined).
        };
        const result = deriveBracket([match], [teamBra, teamArg]);
        const km = result.quarterFinals[0]!;
        expect(km).not.toHaveProperty("advanceSide");
      });
    });

    // ── Gate: só 'encerrado' propaga outcome/advance/shootout ──────────────
    describe("gate de propagação: não-encerrado não emite outcome/advance/shootout", () => {
      it("em-andamento não propaga outcome/advanceSide/shootout", () => {
        const match: MatchWithId = {
          ...mkMatch("m97", "quartas", "bra", "arg", {
            status: "live",
            homeScore: 1,
            awayScore: 0,
          }),
          // Campos presentes nos dados, mas não devem vazar em jogo ao vivo.
          advanceSide: null,
        };
        const result = deriveBracket([match], [teamBra, teamArg]);
        const km = result.quarterFinals[0]!;
        expect(km.status).toBe("em-andamento");
        expect(km).not.toHaveProperty("outcome");
        expect(km).not.toHaveProperty("advanceSide");
        expect(km).not.toHaveProperty("homeShootout");
        expect(km).not.toHaveProperty("awayShootout");
      });

      it("aguardando (placeholder) não propaga outcome/advance/shootout", () => {
        const match: MatchWithId = {
          ...mkMatch("m99", "semifinal", "W89", "bra"),
          homePlaceholderLabel: "Vencedor QF jogo 1",
          homeBracketSlot: { round: "quarterfinal", game: 1 },
        };
        const result = deriveBracket([match], [teamBra]);
        const km = result.semiFinals[0]!;
        expect(km.status).toBe("aguardando");
        expect(km).not.toHaveProperty("outcome");
        expect(km).not.toHaveProperty("advanceSide");
        expect(km).not.toHaveProperty("homeShootout");
      });

      it("definido (ambos reais, scheduled) não propaga outcome/advance", () => {
        // Dados carregam outcome/advance, mas o jogo ainda não começou.
        const match: MatchWithId = {
          ...mkMatch("m97", "quartas", "bra", "arg", { status: "scheduled" }),
          advanceSide: "home",
          outcome: "normal",
        };
        const result = deriveBracket([match], [teamBra, teamArg]);
        const km = result.quarterFinals[0]!;
        expect(km.status).toBe("definido");
        expect(km).not.toHaveProperty("outcome");
        expect(km).not.toHaveProperty("advanceSide");
      });
    });

    // ── Prorrogação (overtime): outcome propagado, sem shootout ────────────
    describe("encerrado na prorrogação (overtime)", () => {
      it("outcome 'overtime' + advanceSide propagados, sem shootout", () => {
        const match: MatchWithId = {
          ...mkMatch("m95", "semifinal", "bra", "arg", {
            status: "finished",
            homeScore: 2,
            awayScore: 1,
          }),
          advanceSide: "away",
          outcome: "overtime",
        };
        const result = deriveBracket([match], [teamBra, teamArg]);
        const km = result.semiFinals[0]!;
        expect(km.outcome).toBe("overtime");
        expect(km.advanceSide).toBe("away");
        expect(km).not.toHaveProperty("homeShootout");
        expect(km).not.toHaveProperty("awayShootout");
        expect(() => bracketResponseSchema.parse(result)).not.toThrow();
      });
    });

    // ── Defesa: penalties inconsistente (sem shootout) degrada, não quebra ─
    describe("penalties inconsistente (sem shootout numérico)", () => {
      it("omite outcome/shootout e ainda passa no schema", () => {
        const match: MatchWithId = {
          ...mkMatch("m97", "quartas", "bra", "arg", {
            status: "finished",
            homeScore: 1,
            awayScore: 1,
          }),
          outcome: "penalties",
          // shootout ausente — estado patológico (matchSchema preveniria upstream).
        };
        const result = deriveBracket([match], [teamBra, teamArg]);
        const km = result.quarterFinals[0]!;
        expect(km).not.toHaveProperty("outcome");
        expect(km).not.toHaveProperty("homeShootout");
        expect(km).not.toHaveProperty("awayShootout");
        expect(() => bracketResponseSchema.parse(result)).not.toThrow();
      });
    });

    // ── Final/3º: advanceSide null preservado em encerrado (IN-02) ─────────
    describe("Final sem advance marcado (IN-02)", () => {
      it("preserva advanceSide null em jogo encerrado; passa no schema", () => {
        const match: MatchWithId = {
          ...mkMatch("m104", "final", "bra", "arg", {
            status: "finished",
            homeScore: 1,
            awayScore: 0,
          }),
          advanceSide: null,
          outcome: "normal",
        };
        const result = deriveBracket([match], [teamBra, teamArg]);
        const km = result.final[0]!;
        expect(km.advanceSide).toBeNull();
        expect(km.outcome).toBe("normal");
        expect(() => bracketResponseSchema.parse(result)).not.toThrow();
      });
    });
  });

  // ═══ TASK-09 — parentMatchIds: arestas via slot próprio + pareamento FIFA ════
  //
  // deriveBracket deriva parentMatchIds do SLOT DO PRÓPRIO JOGO (bracketMap) + a
  // tabela de pareamento FIFA fixa (FEEDER_SLOTS), NÃO do bracketSlot por-lado
  // (que some quando o lado vira time real — HIGH-1). Topologia ESTÁVEL em
  // qualquer estágio de resolução.
  //
  // Pareamento (ai/diagnose/espn-api-analise.md §2):
  //   R16←R32: 1(1,3) 2(2,5) 3(4,6) 4(7,8) 5(9,10) 6(11,12) 7(13,15) 8(14,16)
  //   QF←R16:  1(1,2) 2(5,6) 3(3,4) 4(7,8)   SF←QF: 1(1,2) 2(3,4)   Final←SF: 1(1,2)

  describe("TASK-09 — parentMatchIds (bracket edges via feeder table)", () => {
    function mkBracketMap(
      entries: [string, { round: string; slotInRound: number }][],
    ): EspnBracketMap {
      return new Map(entries);
    }

    // T-08-01: child R16 slot2 (ambos resolvidos) → fallback feeder [1,3].
    it("T-08-01: R16 slot2 (fallback feeder 1,3) → parentMatchIds corretos", () => {
      const match = mkMatch("m90", "oitavas", "bra", "arg");
      const bracketMap = mkBracketMap([
        ["m90", { round: "round-of-16", slotInRound: 2 }],
        ["m73", { round: "round-of-32", slotInRound: 1 }],
        ["m75", { round: "round-of-32", slotInRound: 3 }],
      ]);
      const result = deriveBracket([match], [teamBra, teamArg], bracketMap);
      expect(result.roundOf16[0]).toHaveProperty("parentMatchIds", ["m73", "m75"]);
    });

    // T-08-01b: feeder por-lado da ESPN é PRIMÁRIO (sobrepõe a tabela fallback).
    it("T-08-01b: homeBracketSlot/awayBracketSlot da ESPN têm precedência", () => {
      // slot2 na tabela = [1,3]; mas a ESPN entrega feeder por-lado [4,6] →
      // os lados ganham. Garante exatidão para jogos futuros não-resolvidos.
      const match: MatchWithId = {
        ...mkMatch("m90", "oitavas", "W76", "W78"),
        homeBracketSlot: { round: "round-of-32", game: 4 },
        awayBracketSlot: { round: "round-of-32", game: 6 },
      };
      const bracketMap = mkBracketMap([
        ["m90", { round: "round-of-16", slotInRound: 2 }],
        ["m76", { round: "round-of-32", slotInRound: 4 }],
        ["m78", { round: "round-of-32", slotInRound: 6 }],
        // slots 1 e 3 (da tabela) NÃO mapeados — se o fallback fosse usado, falharia.
      ]);
      const result = deriveBracket([match], [], bracketMap);
      expect(result.roundOf16[0]).toHaveProperty("parentMatchIds", ["m76", "m78"]);
    });

    // T-08-02: um slot-pai ausente no mapa → parentMatchIds omitido.
    it("T-08-02: slot-pai não encontrado no mapa → parentMatchIds ausente", () => {
      const match = mkMatch("m90", "oitavas", "bra", "arg");
      const bracketMap = mkBracketMap([
        ["m90", { round: "round-of-16", slotInRound: 2 }],
        // fallback feeder [1,3]: slot1 ausente, só slot3 mapeado
        ["m75", { round: "round-of-32", slotInRound: 3 }],
      ]);
      const result = deriveBracket([match], [teamBra, teamArg], bracketMap);
      expect(result.roundOf16[0]).not.toHaveProperty("parentMatchIds");
    });

    // T-08-03: child ausente do bracketMap → sem slot próprio → omitido.
    it("T-08-03: child sem slot no bracketMap → parentMatchIds omitido", () => {
      const match = mkMatch("m89", "oitavas", "bra", "arg");
      const bracketMap = mkBracketMap([
        // só os pais; o child m89 NÃO está no mapa
        ["m73", { round: "round-of-32", slotInRound: 1 }],
        ["m75", { round: "round-of-32", slotInRound: 3 }],
      ]);
      const result = deriveBracket([match], [teamBra, teamArg], bracketMap);
      expect(result.roundOf16[0]).not.toHaveProperty("parentMatchIds");
    });

    // T-08-04: sem bracketMap → nenhum match ganha parentMatchIds.
    it("T-08-04: sem bracketMap → nenhum KnockoutMatch tem parentMatchIds", () => {
      const match = mkMatch("m89", "oitavas", "bra", "arg");
      const result = deriveBracket([match], [teamBra, teamArg]);
      expect(result.roundOf16[0]).not.toHaveProperty("parentMatchIds");
    });

    // T-08-05: bracketMap vazio → parentMatchIds ausente em todos.
    it("T-08-05: bracketMap vazio → parentMatchIds ausente em todos", () => {
      const match = mkMatch("m89", "oitavas", "bra", "arg");
      const bracketMap: EspnBracketMap = new Map();
      const result = deriveBracket([match], [teamBra, teamArg], bracketMap);
      expect(result.roundOf16[0]).not.toHaveProperty("parentMatchIds");
    });

    // T-08-06: R32 não tem fase-pai no mata-mata → sem parentMatchIds.
    it("T-08-06: R32 (dezesseis-avos) não ganha parentMatchIds", () => {
      const match = mkMatch("m73", "dezesseis-avos", "1A", "2B");
      const bracketMap = mkBracketMap([
        ["m73", { round: "round-of-32", slotInRound: 1 }],
      ]);
      const result = deriveBracket([match], [], bracketMap);
      expect(result.roundOf32[0]).not.toHaveProperty("parentMatchIds");
    });

    // T-08-07: QF slot1 → feeder [1,2] → pais R16 slot1,slot2.
    it("T-08-07: QF slot1 (feeder 1,2) → parentMatchIds corretos", () => {
      const match = mkMatch("m97", "quartas", "bra", "arg");
      const bracketMap = mkBracketMap([
        ["m97", { round: "quarterfinals", slotInRound: 1 }],
        ["m89", { round: "round-of-16", slotInRound: 1 }],
        ["m90", { round: "round-of-16", slotInRound: 2 }],
      ]);
      const result = deriveBracket([match], [teamBra, teamArg], bracketMap);
      expect(result.quarterFinals[0]).toHaveProperty("parentMatchIds", ["m89", "m90"]);
    });

    // T-08-08: múltiplos KO — só os com slot próprio + pais resolvidos ganham aresta.
    it("T-08-08: múltiplos KO — apenas os resolvíveis ganham parentMatchIds", () => {
      const comSlot = mkMatch("m90", "oitavas", "bra", "arg");
      const semSlot = mkMatch("m91", "oitavas", "bra", "arg");
      const bracketMap = mkBracketMap([
        ["m90", { round: "round-of-16", slotInRound: 2 }], // fallback [1,3]
        // m91 ausente do mapa → sem slot próprio
        ["m73", { round: "round-of-32", slotInRound: 1 }],
        ["m75", { round: "round-of-32", slotInRound: 3 }],
      ]);
      const result = deriveBracket([comSlot, semSlot], [teamBra, teamArg], bracketMap);
      const [first, second] = result.roundOf16;
      expect(first).toHaveProperty("parentMatchIds", ["m73", "m75"]);
      expect(second).not.toHaveProperty("parentMatchIds");
    });

    // T-08-09: regressão — confronto-prova. Oitava slot3 → feeder [4,6] (Brasil×Japão
    // = R32 slot4, Marfim×Noruega = R32 slot6) → pais corretos, independem de resolução.
    it("T-08-09: regressão — oitava slot3 (feeder 4,6) resolve pais corretos", () => {
      const r16match = mkMatch("m91", "oitavas", "bra", "jpn");
      const bracketMap = mkBracketMap([
        ["m91", { round: "round-of-16", slotInRound: 3 }],
        ["m76", { round: "round-of-32", slotInRound: 4 }],
        ["m78", { round: "round-of-32", slotInRound: 6 }],
      ]);
      const result = deriveBracket([r16match], [teamBra], bracketMap);
      expect(result.roundOf16[0]).toHaveProperty("parentMatchIds", ["m76", "m78"]);
    });

    // T-08-10: bracketResponseSchema aceita payload com parentMatchIds.
    it("T-08-10: bracketResponseSchema aceita KnockoutMatch com parentMatchIds", () => {
      const match = mkMatch("m90", "oitavas", "bra", "arg");
      const bracketMap = mkBracketMap([
        ["m90", { round: "round-of-16", slotInRound: 2 }],
        ["m73", { round: "round-of-32", slotInRound: 1 }],
        ["m75", { round: "round-of-32", slotInRound: 3 }],
      ]);
      const result = deriveBracket([match], [teamBra, teamArg], bracketMap);
      expect(() => bracketResponseSchema.parse(result)).not.toThrow();
    });
  });
});
