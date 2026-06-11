/**
 * Testes TDD (RED) de computeGroupStandings.
 *
 * Função sob teste (a ser criada em ../standings):
 *   computeGroupStandings(matches: MatchWithId[], teams: TeamWithId[]): GroupTable[]
 *
 * Regras autoritativas codificadas aqui (ver PRD grupos/eliminatórias):
 *  1. Só contam partidas stage === "grupos" com groupId não-nulo. Grupos vêm de
 *     teams[].groupId; toda seleção com groupId aparece na tabela do seu grupo,
 *     mesmo com 0 jogos (linha zerada).
 *  2. Só partidas status === "finished" contam estatística. V=3, E=1, D=0.
 *     saldo (goalDifference) = GP − GC.
 *  3. Ordenação/desempate:
 *     a) pontos desc, b) saldo desc, c) gols pró desc (sobre TODOS os jogos do grupo).
 *     Empate persistente num subconjunto → CONFRONTO DIRETO: mini-tabela usando só
 *     partidas finalizadas ENTRE os times empatados, reordena por pts/saldo/gols-pró
 *     da mini-tabela. Separação parcial → RECURSÃO em cada sub-subconjunto ainda
 *     empatado. Se a mini-tabela não separa ninguém, para a recursão. Fallback
 *     terminal: ordem alfabética por `name` via localeCompare (determinístico).
 *  4. position = 1..N sequencial após a ordenação.
 *  5. Qualificação: grupo INCOMPLETO (qualquer partida não finalizada OU menos de 6
 *     partidas de grupo presentes nos dados) → TODOS "indefinido". Grupo COMPLETO
 *     (6 partidas finalizadas presentes) → 1º/2º "classificado", 3º "possivel",
 *     4º "eliminado".
 *  6. Saída: grupos ordenados por groupId asc; standings por position asc; objeto
 *     team {id,name,code,flagUrl?} copiado de TeamWithId (sem groupId interno).
 *  7. Robustez: partida de grupo referenciando teamId ausente de `teams` → ignorada
 *     silenciosamente (sem throw). Times sem groupId → fora de qualquer tabela.
 */

import { describe, it, expect } from "vitest";

// Import proposital de módulo inexistente — estado RED esperado.
import { computeGroupStandings } from "../standings";

import { groupTableSchema } from "@/schemas/worldcup";
import type { MatchWithId } from "@/types/matches";
import type { TeamWithId } from "@/types/teams";
import type { GroupStanding, GroupTable } from "@/types/worldcup";

// ─── Fábricas de fixtures ────────────────────────────────────────────────────

/** Cria uma seleção com id = code (minúsculo) por padrão. */
function team(
  code: string,
  groupId: string | undefined,
  name?: string,
): TeamWithId {
  return {
    id: code.toLowerCase(),
    name: name ?? code,
    code,
    groupId,
  };
}

let matchSeq = 0;

/**
 * Cria uma partida de grupo finalizada com placar.
 * homeTeamId/awayTeamId = code minúsculo (casa com team()).
 */
function gm(
  groupId: string,
  home: string,
  away: string,
  homeScore: number,
  awayScore: number,
): MatchWithId {
  matchSeq += 1;
  return {
    id: `m-${matchSeq}`,
    homeTeamId: home.toLowerCase(),
    awayTeamId: away.toLowerCase(),
    kickoffAt: "2026-06-11T13:00:00-06:00",
    stage: "grupos",
    groupId,
    venue: null,
    status: "finished",
    homeScore,
    awayScore,
  };
}

/** Helper: lê a linha de um time pelo code dentro de um GroupTable. */
function rowOf(table: GroupTable, code: string): GroupStanding | undefined {
  return table.standings.find((s) => s.team.code === code);
}

/** Helper: ordem dos codes na tabela (por position asc, como a função devolve). */
function order(table: GroupTable): string[] {
  return table.standings.map((s) => s.team.code);
}

// 4 seleções padrão do grupo "A".
function groupAteams(): TeamWithId[] {
  return [
    team("AAA", "A"),
    team("BBB", "A"),
    team("CCC", "A"),
    team("DDD", "A"),
  ];
}

describe("computeGroupStandings", () => {
  // ── Caso 1: grupo zerado (0 finalizadas) ──────────────────────────────────
  describe("grupo zerado (0 partidas finalizadas)", () => {
    it("produz 4 linhas zeradas, ordem alfabética, todas 'indefinido'", () => {
      const teams = groupAteams();
      const tables = computeGroupStandings([], teams);

      expect(tables).toHaveLength(1);
      const a = tables[0]!;
      expect(a.groupId).toBe("A");
      expect(a.standings).toHaveLength(4);

      // Sem jogos → tudo zerado.
      for (const s of a.standings) {
        expect(s.played).toBe(0);
        expect(s.wins).toBe(0);
        expect(s.draws).toBe(0);
        expect(s.losses).toBe(0);
        expect(s.goalsFor).toBe(0);
        expect(s.goalsAgainst).toBe(0);
        expect(s.goalDifference).toBe(0);
        expect(s.points).toBe(0);
        expect(s.qualification).toBe("indefinido");
      }

      // Fallback alfabético: AAA, BBB, CCC, DDD.
      expect(order(a)).toEqual(["AAA", "BBB", "CCC", "DDD"]);
      expect(a.standings.map((s) => s.position)).toEqual([1, 2, 3, 4]);

      // team não carrega groupId.
      expect(a.standings[0]!.team).toEqual({ id: "aaa", name: "AAA", code: "AAA" });
    });
  });

  // ── Caso 2: grupo parcial (2 de 6 finalizadas) ────────────────────────────
  describe("grupo parcial (2 de 6 partidas finalizadas)", () => {
    it("computa estatísticas corretas mas mantém todas 'indefinido'", () => {
      const teams = groupAteams();
      // Só 2 partidas finalizadas presentes (< 6) → grupo incompleto.
      const matches = [
        gm("A", "AAA", "BBB", 2, 0), // AAA vence
        gm("A", "CCC", "DDD", 1, 1), // empate
      ];
      const tables = computeGroupStandings(matches, teams);
      const a = tables[0]!;

      const aaa = rowOf(a, "AAA")!;
      expect(aaa.played).toBe(1);
      expect(aaa.wins).toBe(1);
      expect(aaa.points).toBe(3);
      expect(aaa.goalsFor).toBe(2);
      expect(aaa.goalsAgainst).toBe(0);
      expect(aaa.goalDifference).toBe(2);

      const ccc = rowOf(a, "CCC")!;
      expect(ccc.played).toBe(1);
      expect(ccc.draws).toBe(1);
      expect(ccc.points).toBe(1);
      expect(ccc.goalDifference).toBe(0);

      const ddd = rowOf(a, "DDD")!;
      expect(ddd.draws).toBe(1);
      expect(ddd.points).toBe(1);

      // Incompleto → todas indefinido.
      for (const s of a.standings) {
        expect(s.qualification).toBe("indefinido");
      }
    });
  });

  // ── Caso 3: grupo completo, sem empates ───────────────────────────────────
  describe("grupo completo sem empates", () => {
    it("ordena por pontos e atribui badges 1º/2º classificado, 3º possivel, 4º eliminado", () => {
      const teams = groupAteams();
      // 6 partidas (round-robin). Resultados desenhados p/ pontos distintos:
      //   AAA: vence BBB, CCC, DDD → 9 pts
      //   BBB: perde p/ AAA, vence CCC, DDD → 6 pts
      //   CCC: perde p/ AAA, BBB, vence DDD → 3 pts
      //   DDD: perde p/ todos → 0 pts
      const matches = [
        gm("A", "AAA", "BBB", 1, 0),
        gm("A", "AAA", "CCC", 1, 0),
        gm("A", "AAA", "DDD", 1, 0),
        gm("A", "BBB", "CCC", 1, 0),
        gm("A", "BBB", "DDD", 1, 0),
        gm("A", "CCC", "DDD", 1, 0),
      ];
      const tables = computeGroupStandings(matches, teams);
      const a = tables[0]!;

      expect(order(a)).toEqual(["AAA", "BBB", "CCC", "DDD"]);
      expect(rowOf(a, "AAA")!.points).toBe(9);
      expect(rowOf(a, "BBB")!.points).toBe(6);
      expect(rowOf(a, "CCC")!.points).toBe(3);
      expect(rowOf(a, "DDD")!.points).toBe(0);

      expect(rowOf(a, "AAA")!.qualification).toBe("classificado");
      expect(rowOf(a, "BBB")!.qualification).toBe("classificado");
      expect(rowOf(a, "CCC")!.qualification).toBe("possivel");
      expect(rowOf(a, "DDD")!.qualification).toBe("eliminado");
    });
  });

  // ── Caso 4a: desempate por saldo (goalDifference) ─────────────────────────
  describe("desempate por saldo de gols", () => {
    it("dois times com mesmos pontos são separados pelo saldo", () => {
      const teams = groupAteams();
      // AAA e BBB ficam ambos com 6 pts (cada vence CCC e DDD, perdem nada entre si?).
      // Para isolar SALDO precisamos AAA e BBB com mesmos pts mas saldos diferentes,
      // e SEM confronto direto decisivo entrando antes (saldo vem antes do H2H).
      //
      // Resultados:
      //   AAA vence CCC 3x0, vence DDD 3x0, perde p/ BBB 0x1
      //     → pts AAA = 6, GP=6, GC=1, saldo=+5
      //   BBB vence AAA 1x0, vence CCC 1x0, vence DDD 1x0
      //     → pts BBB = 9 (líder isolado)
      // Isso não isola saldo entre AAA/BBB. Redesenho:
      //
      //   AAA: vence CCC 5x0, vence DDD 5x0, perde BBB 0x1 → 6 pts, saldo +9
      //   BBB: vence AAA 1x0, vence CCC 1x0, perde DDD 0x1 → 6 pts, saldo +1
      //   CCC: perde AAA, perde BBB, vence DDD 1x0 → 3 pts
      //   DDD: perde AAA, vence BBB 1x0, perde CCC → 3 pts
      //
      // AAA e BBB ambos 6 pts; saldo AAA(+9) > BBB(+1) → AAA na frente.
      const matches = [
        gm("A", "AAA", "CCC", 5, 0),
        gm("A", "AAA", "DDD", 5, 0),
        gm("A", "BBB", "AAA", 1, 0),
        gm("A", "BBB", "CCC", 1, 0),
        gm("A", "DDD", "BBB", 1, 0),
        gm("A", "CCC", "DDD", 1, 0),
      ];
      const tables = computeGroupStandings(matches, teams);
      const a = tables[0]!;

      expect(rowOf(a, "AAA")!.points).toBe(6);
      expect(rowOf(a, "BBB")!.points).toBe(6);
      expect(rowOf(a, "AAA")!.goalDifference).toBe(9);
      expect(rowOf(a, "BBB")!.goalDifference).toBe(1);
      // AAA antes de BBB por saldo.
      expect(order(a).slice(0, 2)).toEqual(["AAA", "BBB"]);
    });
  });

  // ── Caso 4b: desempate por gols pró (goalsFor) ────────────────────────────
  describe("desempate por gols pró", () => {
    it("dois times com mesmos pontos E mesmo saldo são separados por gols pró", () => {
      const teams = groupAteams();
      // AAA e BBB: mesmos pontos (6) e mesmo saldo (+4), mas gols pró diferentes.
      //   AAA: vence CCC 4x0, vence DDD 2x2? não — precisa vitórias p/ 6 pts.
      //
      // Construção:
      //   AAA: vence CCC 4x1, vence DDD 3x2, perde BBB 0x1
      //     → pts 6, GP=7, GC=4, saldo +3
      //   BBB: vence AAA 1x0, vence CCC 2x0, perde DDD 0x1
      //     → pts 6, GP=3, GC=1, saldo +2  (saldo difere — não serve)
      //
      // Reconstrução p/ MESMO saldo +3 e gols pró distintos:
      //   AAA: vence CCC 5x1 (+4), vence DDD 1x0 (+1), perde BBB 0x2 (−2)
      //     → pts 6, GP=6, GC=3, saldo +3
      //   BBB: vence AAA 2x0 (+2), vence DDD 2x1 (+1), perde CCC 0x0? não, derrota
      //     precisa. BBB perde p/ CCC 1x2 (−1)
      //     → pts 6, GP=2+2+1=5, GC=0+1+2=3, saldo +2  (difere)
      //
      // Mais simples: dar a AAA e BBB exatamente os mesmos GP/GC totais e saldo,
      // variando só o gols-pró via um placar maior compensado por GC maior.
      //   AAA: vence CCC 4x1 (+3), vence DDD 2x0 (+2), perde BBB 1x3 (−2)
      //     → pts 6, GP = 4+2+1 = 7, GC = 1+0+3 = 4, saldo +3
      //   BBB: vence AAA 3x1 (+2), vence DDD 1x0 (+1), perde CCC 1x2 (−1)
      //     → pts 6, GP = 3+1+1 = 5, GC = 1+0+2 = 3, saldo +2  (difere de novo)
      //
      // O acoplamento do confronto AAA×BBB força saldos correlacionados.
      // Solução limpa: empatar AAA×BBB no confronto direto (assim H2H não separa)
      // e dar derrotas/vitórias contra CCC/DDD que igualem pts+saldo mas não gols-pró.
      //   AAA×BBB: 1x1 (empate) → cada um 1 pt aqui
      //   AAA: empata BBB 1x1, vence CCC 3x0, vence DDD 1x0
      //     → pts 1+3+3 = 7, GP = 1+3+1 = 5, GC = 1+0+0 = 1, saldo +4
      //   BBB: empata AAA 1x1, vence CCC 2x0, vence DDD 2x0
      //     → pts 1+3+3 = 7, GP = 1+2+2 = 5, GC = 1+0+0 = 1, saldo +4
      //   → pts iguais (7), saldo igual (+4), gols pró iguais (5)!  precisa diferir.
      //
      //   Ajuste: BBB vence CCC 1x0 e DDD 3x0 → GP = 1+1+3 = 5 ainda.
      //   Para gols-pró diferir mantendo saldo: subir GP e GC juntos num lado.
      //   AAA: empata BBB 1x1, vence CCC 4x1, vence DDD 1x0
      //     → pts 7, GP = 1+4+1 = 6, GC = 1+1+0 = 2, saldo +4
      //   BBB: empata AAA 1x1, vence CCC 2x0, vence DDD 2x0
      //     → pts 7, GP = 1+2+2 = 5, GC = 1+0+0 = 1, saldo +4
      //   → pts 7 = 7, saldo +4 = +4, gols pró AAA(6) > BBB(5) → AAA na frente.
      //   (CCC: perde AAA 1x4, perde BBB 0x2, vs DDD; DDD: perde AAA, perde BBB, vs CCC)
      const matches = [
        gm("A", "AAA", "BBB", 1, 1),
        gm("A", "AAA", "CCC", 4, 1),
        gm("A", "AAA", "DDD", 1, 0),
        gm("A", "BBB", "CCC", 2, 0),
        gm("A", "BBB", "DDD", 2, 0),
        gm("A", "CCC", "DDD", 0, 0),
      ];
      const tables = computeGroupStandings(matches, teams);
      const a = tables[0]!;

      expect(rowOf(a, "AAA")!.points).toBe(7);
      expect(rowOf(a, "BBB")!.points).toBe(7);
      expect(rowOf(a, "AAA")!.goalDifference).toBe(4);
      expect(rowOf(a, "BBB")!.goalDifference).toBe(4);
      expect(rowOf(a, "AAA")!.goalsFor).toBe(6);
      expect(rowOf(a, "BBB")!.goalsFor).toBe(5);
      // Empatados em pts e saldo; gols pró AAA(6) > BBB(5) → AAA antes.
      expect(order(a).slice(0, 2)).toEqual(["AAA", "BBB"]);
    });
  });

  // ── Caso 5: empate total (pts+saldo+gols-pró) resolvido por confronto direto ─
  describe("empate em pontos+saldo+gols-pró resolvido por confronto direto", () => {
    it("o vencedor do confronto direto fica à frente", () => {
      const teams = groupAteams();
      // Objetivo: AAA e BBB IDÊNTICOS em pts, saldo e gols-pró TOTAIS,
      // mas com um confronto direto decisivo (não empate) entre eles.
      //
      // AAA×BBB: AAA vence 2x1.  (H2H: AAA 3 pts, BBB 0 pts → AAA ganha)
      //
      // Totais alvo p/ AAA e BBB: pts 6, saldo +1, gols pró 4. Verificação:
      //   AAA: vence BBB 2x1 (+1), vence CCC 1x0 (+1), perde DDD 1x2 (−1)
      //     → pts = 3+3+0 = 6, GP = 2+1+1 = 4, GC = 1+0+2 = 3, saldo = +1 ✓
      //   BBB: perde AAA 1x2 (−1), vence CCC 2x1 (+1), vence DDD 1x0 (+1)
      //     → pts = 0+3+3 = 6, GP = 1+2+1 = 4, GC = 2+1+0 = 3, saldo = +1 ✓
      //   → AAA e BBB: pts 6=6, saldo +1=+1, gols pró 4=4 → empate triplo.
      //   Confronto direto AAA 2x1 BBB → AAA classifica à frente.
      //
      //   CCC: perde AAA 0x1, perde BBB 1x2, vs DDD
      //   DDD: vence AAA 2x1, perde BBB 0x1, vs CCC
      //   (CCC×DDD: 1x1 — irrelevante p/ topo)
      const matches = [
        gm("A", "AAA", "BBB", 2, 1), // confronto direto: AAA vence
        gm("A", "AAA", "CCC", 1, 0),
        gm("A", "DDD", "AAA", 2, 1), // AAA perde p/ DDD
        gm("A", "BBB", "CCC", 2, 1),
        gm("A", "BBB", "DDD", 1, 0),
        gm("A", "CCC", "DDD", 1, 1),
      ];
      const tables = computeGroupStandings(matches, teams);
      const a = tables[0]!;

      // Confirma o empate triplo nos critérios gerais.
      expect(rowOf(a, "AAA")!.points).toBe(6);
      expect(rowOf(a, "BBB")!.points).toBe(6);
      expect(rowOf(a, "AAA")!.goalDifference).toBe(1);
      expect(rowOf(a, "BBB")!.goalDifference).toBe(1);
      expect(rowOf(a, "AAA")!.goalsFor).toBe(4);
      expect(rowOf(a, "BBB")!.goalsFor).toBe(4);

      // Desempate por confronto direto: AAA venceu BBB → AAA antes.
      const idxA = order(a).indexOf("AAA");
      const idxB = order(a).indexOf("BBB");
      expect(idxA).toBeLessThan(idxB);
    });
  });

  // ── Caso 6: empate triplo totalmente separado pela mini-tabela ─────────────
  describe("empate triplo totalmente separado pela mini-tabela (confronto direto)", () => {
    it("ordena os três pela mini-tabela de confrontos diretos", () => {
      // 3 times empatados nos critérios gerais; mini-tabela (só jogos entre eles)
      // separa todos. Usamos um grupo de 3 (sem 4º) para focar — o grupo fica
      // incompleto (3 partidas < 6) mas a ORDENAÇÃO é o que importa aqui.
      const teams = [team("AAA", "A"), team("BBB", "A"), team("CCC", "A")];
      // Mini-tabela cíclica quebrada por saldo dentro dela:
      //   AAA vence BBB 3x0  (+3)
      //   BBB vence CCC 1x0  (+1)
      //   CCC vence AAA 1x0  (+1)
      // Mini-tabela (todos os 3 jogos são entre eles):
      //   AAA: V(BBB)+D(CCC) → 3 pts, GP=3, GC=1, saldo +2
      //   BBB: D(AAA)+V(CCC) → 3 pts, GP=1, GC=3, saldo −2
      //   CCC: V(AAA)+D(BBB) → 3 pts, GP=1, GC=1, saldo  0
      //   → todos 3 pts; saldo: AAA(+2) > CCC(0) > BBB(−2) → AAA, CCC, BBB.
      const matches = [
        gm("A", "AAA", "BBB", 3, 0),
        gm("A", "BBB", "CCC", 1, 0),
        gm("A", "CCC", "AAA", 1, 0),
      ];
      const tables = computeGroupStandings(matches, teams);
      const a = tables[0]!;

      // Critérios gerais: todos 3 pts. Saldo geral: AAA +2, BBB −2, CCC 0.
      // Como saldo GERAL já separa aqui (mini = geral, pois só há jogos entre eles),
      // a ordem final é AAA, CCC, BBB.
      expect(rowOf(a, "AAA")!.points).toBe(3);
      expect(rowOf(a, "BBB")!.points).toBe(3);
      expect(rowOf(a, "CCC")!.points).toBe(3);
      expect(order(a)).toEqual(["AAA", "CCC", "BBB"]);
    });
  });

  // ── Caso 7: empate triplo com separação parcial → recursão ────────────────
  describe("empate triplo com separação parcial seguida de recursão", () => {
    it("mini-tabela separa o líder; o par restante é re-resolvido por sub-mini (recursão)", () => {
      // Fixture verificado à mão (grupo de 4, 6 partidas finalizadas).
      // Nomes em ordem REVERSA-alfabética de propósito: se a função caísse num
      // fallback alfabético acidental, a ordem sairia INVERTIDA e o teste falharia.
      //   ZUL "Zulu"     → esperado 1º
      //   YAN "Yankee"   → esperado 2º
      //   XRA "Xray"     → esperado 3º
      //   WHI "Whiskey"  → esperado 4º
      const teams = [
        team("ZUL", "A", "Zulu"),
        team("YAN", "A", "Yankee"),
        team("XRA", "A", "Xray"),
        team("WHI", "A", "Whiskey"),
      ];

      // Partidas finalizadas (casa x fora):
      //   Zulu 3x0 Yankee
      //   Xray 2x1 Zulu
      //   Yankee 2x0 Xray
      //   Zulu 2x1 Whiskey
      //   Yankee 4x0 Whiskey
      //   Xray 4x0 Whiskey
      //
      // Aritmética verificada:
      //  Geral:
      //    Zulu:   V(Yankee 3x0) D(Xray 1x2) V(Whiskey 2x1) → 6pts GF6 GA3 SG+3
      //    Yankee: D(Zulu 0x3)   V(Xray 2x0) V(Whiskey 4x0) → 6pts GF6 GA3 SG+3
      //    Xray:   V(Zulu 2x1)   D(Yankee 0x2) V(Whiskey 4x0)→ 6pts GF6 GA3 SG+3
      //    Whiskey:D(Zulu 1x2)   D(Yankee 0x4) D(Xray 0x4)  → 0pts GF1 GA10 SG−9
      //    → empate TRIPLO total em pts/SG/GF entre Zulu, Yankee, Xray.
      //  Mini-tabela {Zulu,Yankee,Xray} (jogos entre si — 3 jogos):
      //    Zulu:   V(Yankee 3x0) D(Xray 1x2) → 3pts, mini GF4 GA2, mini SG +2
      //    Yankee: D(Zulu 0x3)   V(Xray 2x0) → 3pts, mini GF2 GA3, mini SG −1
      //    Xray:   V(Zulu 2x1)   D(Yankee 0x2)→3pts, mini GF2 GA3, mini SG −1
      //    → mini: todos 3pts; SG mini Zulu(+2) destaca Zulu em 1º;
      //      Yankee(−1) e Xray(−1) EMPATAM mini-SG e mini-GF(2) → RECURSÃO.
      //  Recursão {Yankee,Xray}: sub-mini restrita = só Yankee 2x0 Xray
      //    → Yankee 3pts, Xray 0pts → Yankee 2º, Xray 3º.
      //  Ordem final: Zulu, Yankee, Xray, Whiskey.
      //  Grupo completo (6 finalizadas) → badges:
      //    1º classificado, 2º classificado, 3º possivel, 4º eliminado.
      //
      // Observação: ordem alfabética daria Whiskey,Xray,Yankee,Zulu (oposto);
      // pontos puros não ordenam (empate triplo); SÓ mini-tabela + recursão
      // produzem esta ordem exata.
      const matches = [
        gm("A", "ZUL", "YAN", 3, 0),
        gm("A", "XRA", "ZUL", 2, 1),
        gm("A", "YAN", "XRA", 2, 0),
        gm("A", "ZUL", "WHI", 2, 1),
        gm("A", "YAN", "WHI", 4, 0),
        gm("A", "XRA", "WHI", 4, 0),
      ];
      const tables = computeGroupStandings(matches, teams);
      const a = tables[0]!;

      // Confirma o empate triplo nos critérios gerais.
      for (const code of ["ZUL", "YAN", "XRA"]) {
        expect(rowOf(a, code)!.points).toBe(6);
        expect(rowOf(a, code)!.goalDifference).toBe(3);
        expect(rowOf(a, code)!.goalsFor).toBe(6);
      }
      expect(rowOf(a, "WHI")!.points).toBe(0);
      expect(rowOf(a, "WHI")!.goalDifference).toBe(-9);

      // Ordem EXATA: mini-tabela isola Zulu; recursão {Yankee,Xray} resolve o par.
      expect(order(a)).toEqual(["ZUL", "YAN", "XRA", "WHI"]);

      // Grupo completo → badges.
      expect(rowOf(a, "ZUL")!.qualification).toBe("classificado");
      expect(rowOf(a, "YAN")!.qualification).toBe("classificado");
      expect(rowOf(a, "XRA")!.qualification).toBe("possivel");
      expect(rowOf(a, "WHI")!.qualification).toBe("eliminado");
    });
  });

  // ── Caso 8: empate total (mini-tabela não separa ninguém) → fallback alfabético ─
  describe("empate total na mini-tabela → fallback alfabético", () => {
    it("quando todos empatam tudo (até a mini), ordena por nome via localeCompare", () => {
      const teams = groupAteams();
      // Os 4 times empatam TUDO: cada confronto 0x0. Geral e mini idênticos:
      //   cada time: 3 jogos, 3 empates → 3 pts, GP0 GC0 saldo0.
      //   Mini-tabela entre quaisquer empatados = só empates 0x0 → não separa.
      //   → fallback alfabético por name: AAA, BBB, CCC, DDD.
      const matches = [
        gm("A", "AAA", "BBB", 0, 0),
        gm("A", "AAA", "CCC", 0, 0),
        gm("A", "AAA", "DDD", 0, 0),
        gm("A", "BBB", "CCC", 0, 0),
        gm("A", "BBB", "DDD", 0, 0),
        gm("A", "CCC", "DDD", 0, 0),
      ];
      const tables = computeGroupStandings(matches, teams);
      const a = tables[0]!;

      for (const s of a.standings) {
        expect(s.points).toBe(3);
        expect(s.goalDifference).toBe(0);
        expect(s.goalsFor).toBe(0);
      }
      // Fallback alfabético determinístico.
      expect(order(a)).toEqual(["AAA", "BBB", "CCC", "DDD"]);
    });

    it("fallback alfabético respeita localeCompare (acentos/ordem natural)", () => {
      // Times com nomes que exigem localeCompare (Á antes de B, etc.).
      const teams = [
        team("ZZZ", "A", "Ávila"),
        team("YYY", "A", "Bahia"),
      ];
      const matches = [gm("A", "ZZZ", "YYY", 0, 0)];
      const tables = computeGroupStandings(matches, teams);
      const a = tables[0]!;
      // "Ávila".localeCompare("Bahia") < 0 → Ávila (ZZZ) primeiro.
      expect(order(a)).toEqual(["ZZZ", "YYY"]);
    });
  });

  // ── Caso 9: aritmética de pontos (3/1/0) e saldo negativo ─────────────────
  describe("aritmética de pontos (3/1/0) e saldo negativo", () => {
    it("computa V=3, E=1, D=0 e saldo negativo corretamente", () => {
      const teams = [team("AAA", "A"), team("BBB", "A")];
      // AAA vence BBB 0x... não: 1 jogo só. Use 2 jogos (ida) — grupo incompleto,
      // mas a aritmética é o foco.
      const matches = [
        gm("A", "AAA", "BBB", 3, 1), // AAA V (3pts), BBB D (0pts)
        gm("A", "BBB", "AAA", 2, 2), // empate: cada 1 pt
      ];
      const tables = computeGroupStandings(matches, teams);
      const a = tables[0]!;

      const aaa = rowOf(a, "AAA")!;
      // AAA: V + E → 3+1 = 4 pts; GP = 3+2 = 5, GC = 1+2 = 3, saldo +2
      expect(aaa.points).toBe(4);
      expect(aaa.wins).toBe(1);
      expect(aaa.draws).toBe(1);
      expect(aaa.losses).toBe(0);
      expect(aaa.goalsFor).toBe(5);
      expect(aaa.goalsAgainst).toBe(3);
      expect(aaa.goalDifference).toBe(2);

      const bbb = rowOf(a, "BBB")!;
      // BBB: D + E → 0+1 = 1 pt; GP = 1+2 = 3, GC = 3+2 = 5, saldo −2
      expect(bbb.points).toBe(1);
      expect(bbb.wins).toBe(0);
      expect(bbb.draws).toBe(1);
      expect(bbb.losses).toBe(1);
      expect(bbb.goalsFor).toBe(3);
      expect(bbb.goalsAgainst).toBe(5);
      expect(bbb.goalDifference).toBe(-2);
    });
  });

  // ── Caso 10: multi-grupo + robustez (sem groupId, teamId desconhecido) ─────
  describe("multi-grupo, ordenação A→B e robustez de dados", () => {
    it("ordena grupos por groupId asc; ignora time sem groupId; ignora partida com teamId desconhecido sem lançar", () => {
      const teams = [
        // Grupo B primeiro na lista (a saída deve sair A antes de B).
        team("EEE", "B"),
        team("FFF", "B"),
        team("AAA", "A"),
        team("BBB", "A"),
        // Time sem groupId → não entra em tabela nenhuma.
        team("XXX", undefined),
      ];
      const matches = [
        gm("A", "AAA", "BBB", 2, 0),
        gm("B", "EEE", "FFF", 1, 1),
        // Partida referenciando teamId ausente de `teams` → ignorada (sem throw).
        gm("A", "AAA", "ZZZ", 5, 0),
        // Partida de outra fase → ignorada.
        { ...gm("A", "AAA", "BBB", 9, 9), stage: "final", groupId: null } as MatchWithId,
      ];

      let tables!: ReturnType<typeof computeGroupStandings>;
      expect(() => {
        tables = computeGroupStandings(matches, teams);
      }).not.toThrow();

      // Grupos A e B apenas, ordenados A→B.
      expect(tables.map((t) => t.groupId)).toEqual(["A", "B"]);

      // XXX (sem groupId) não aparece em nenhuma tabela.
      const allCodes = tables.flatMap((t) => t.standings.map((s) => s.team.code));
      expect(allCodes).not.toContain("XXX");

      // A partida com ZZZ foi ignorada: AAA não recebeu os 5 gols dela.
      const a = tables.find((t) => t.groupId === "A")!;
      expect(rowOf(a, "AAA")!.goalsFor).toBe(2); // só o 2x0 vs BBB
      expect(rowOf(a, "AAA")!.played).toBe(1);
    });
  });

  // ── Caso 11: saída de grupo completo valida no groupTableSchema ────────────
  describe("conformidade de schema", () => {
    it("cada tabela de um grupo completo passa em groupTableSchema.parse", () => {
      const teams = groupAteams();
      const matches = [
        gm("A", "AAA", "BBB", 1, 0),
        gm("A", "AAA", "CCC", 1, 0),
        gm("A", "AAA", "DDD", 1, 0),
        gm("A", "BBB", "CCC", 1, 0),
        gm("A", "BBB", "DDD", 1, 0),
        gm("A", "CCC", "DDD", 1, 0),
      ];
      const tables = computeGroupStandings(matches, teams);
      expect(tables).toHaveLength(1);
      for (const t of tables) {
        expect(() => groupTableSchema.parse(t)).not.toThrow();
      }
    });
  });
});
