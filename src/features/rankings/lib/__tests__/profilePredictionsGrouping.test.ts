import { describe, expect, it } from "vitest";

import type { PredictionDisplayStatus } from "@/features/predictions/lib";
import {
  groupProfilePredictions,
  type PredictionPhaseBucket,
  type ProfilePredictionItem,
} from "@/features/rankings/lib";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const team = { id: "bra", name: "Brasil", flagUrl: null };

function makeItem(
  overrides: Partial<ProfilePredictionItem> & {
    stage: ProfilePredictionItem["stage"];
    matchId?: string;
  },
): ProfilePredictionItem {
  return {
    matchId: overrides.matchId ?? "m001",
    kickoffAt: overrides.kickoffAt ?? "2026-06-15T13:00:00Z",
    stage: overrides.stage,
    groupId: overrides.groupId ?? null,
    homeTeam: overrides.homeTeam ?? team,
    awayTeam: overrides.awayTeam ?? team,
    prediction: overrides.prediction ?? { homeScore: 2, awayScore: 1 },
    actualScore: overrides.actualScore ?? null,
    matchStatus: overrides.matchStatus ?? "scheduled",
    displayStatus: overrides.displayStatus ?? "pendente",
  };
}

function makeGroupItem(
  groupId: string,
  matchId: string,
  kickoffAt = "2026-06-15T13:00:00Z",
  displayStatus: PredictionDisplayStatus = "pendente",
): ProfilePredictionItem {
  return makeItem({ stage: "grupos", groupId, matchId, kickoffAt, displayStatus });
}

function makeElimItem(
  stage: Exclude<ProfilePredictionItem["stage"], "grupos">,
  matchId: string,
  displayStatus: PredictionDisplayStatus = "pendente",
): ProfilePredictionItem {
  return makeItem({ stage, matchId, displayStatus });
}

// ---------------------------------------------------------------------------
// groupProfilePredictions
// ---------------------------------------------------------------------------

describe("groupProfilePredictions", () => {
  it("lista vazia retorna array vazio", () => {
    expect(groupProfilePredictions([])).toEqual([]);
  });

  // --- Fase de Grupos ---

  it("itens de grupo criam bucket 'Fase de Grupos'", () => {
    const items = [makeGroupItem("A", "m001")];
    const buckets = groupProfilePredictions(items);
    const fase = buckets.find((b) => b.phase === "grupos");
    expect(fase).toBeDefined();
    expect(fase!.label).toBe("Fase de Grupos");
  });

  it("sub-bucket do grupo correto contém o item", () => {
    const items = [makeGroupItem("A", "m001")];
    const buckets = groupProfilePredictions(items);
    const fase = buckets.find((b) => b.phase === "grupos")!;
    const grupoA = fase.subBuckets.find((s) => s.key === "A")!;
    expect(grupoA.items).toHaveLength(1);
    expect(grupoA.items[0]!.matchId).toBe("m001");
  });

  it("grupos A–L todos presentes quando há itens de grupo (grupos vazios preservados)", () => {
    // Só items do grupo A — grupos B–L devem aparecer com items: []
    const items = [makeGroupItem("A", "m001"), makeGroupItem("A", "m002")];
    const buckets = groupProfilePredictions(items);
    const fase = buckets.find((b) => b.phase === "grupos")!;
    const keys = fase.subBuckets.map((s) => s.key);
    // Todos os 12 grupos da Copa 2026
    expect(keys).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]);
    const grupoB = fase.subBuckets.find((s) => s.key === "B")!;
    expect(grupoB.items).toHaveLength(0);
  });

  it("sub-buckets de grupo ordenados alfabeticamente", () => {
    const items = [
      makeGroupItem("C", "m003"),
      makeGroupItem("A", "m001"),
      makeGroupItem("B", "m002"),
    ];
    const fase = groupProfilePredictions(items).find((b) => b.phase === "grupos")!;
    const keys = fase.subBuckets.map((s) => s.key);
    expect(keys[0]).toBe("A");
    expect(keys[1]).toBe("B");
    expect(keys[2]).toBe("C");
  });

  it("itens dentro de sub-bucket de grupo ordenados por kickoffAt ASC", () => {
    const items = [
      makeGroupItem("A", "m002", "2026-06-16T13:00:00Z"),
      makeGroupItem("A", "m001", "2026-06-15T13:00:00Z"),
    ];
    const fase = groupProfilePredictions(items).find((b) => b.phase === "grupos")!;
    const grupoA = fase.subBuckets.find((s) => s.key === "A")!;
    expect(grupoA.items[0]!.matchId).toBe("m001");
    expect(grupoA.items[1]!.matchId).toBe("m002");
  });

  it("item com stage='grupos' e groupId null vai para sub-bucket '?'", () => {
    const item = makeItem({ stage: "grupos", groupId: null, matchId: "m999" });
    const fase = groupProfilePredictions([item]).find((b) => b.phase === "grupos")!;
    const fallback = fase.subBuckets.find((s) => s.key === "?");
    expect(fallback).toBeDefined();
    expect(fallback!.items[0]!.matchId).toBe("m999");
  });

  it("label do sub-bucket de grupo é 'Grupo <key>'", () => {
    const fase = groupProfilePredictions([makeGroupItem("A", "m001")]).find(
      (b) => b.phase === "grupos",
    )!;
    expect(fase.subBuckets.find((s) => s.key === "A")!.label).toBe("Grupo A");
  });

  // --- Fase Eliminatória ---

  it("itens de eliminatória criam bucket 'Fase Eliminatória'", () => {
    const items = [makeElimItem("oitavas", "m010")];
    const buckets = groupProfilePredictions(items);
    const fase = buckets.find((b) => b.phase === "eliminatoria");
    expect(fase).toBeDefined();
    expect(fase!.label).toBe("Fase Eliminatória");
  });

  it("sub-buckets de eliminatória na ordem do enum (dezesseis-avos→oitavas→quartas→semifinal→terceiro→final)", () => {
    const items = [
      makeElimItem("final", "mF"),
      makeElimItem("oitavas", "mO"),
      makeElimItem("dezesseis-avos", "mD"),
    ];
    const fase = groupProfilePredictions(items).find((b) => b.phase === "eliminatoria")!;
    const keys = fase.subBuckets.map((s) => s.key);
    expect(keys.indexOf("dezesseis-avos")).toBeLessThan(keys.indexOf("oitavas"));
    expect(keys.indexOf("oitavas")).toBeLessThan(keys.indexOf("final"));
  });

  it("dezesseis-avos antes de oitavas (stage enum order)", () => {
    const items = [makeElimItem("oitavas", "mO"), makeElimItem("dezesseis-avos", "mD")];
    const fase = groupProfilePredictions(items).find((b) => b.phase === "eliminatoria")!;
    expect(fase.subBuckets[0]!.key).toBe("dezesseis-avos");
    expect(fase.subBuckets[1]!.key).toBe("oitavas");
  });

  it("terceiro aparece depois de semifinal e antes de final", () => {
    const items = [
      makeElimItem("final", "mF"),
      makeElimItem("terceiro", "mT"),
      makeElimItem("semifinal", "mS"),
    ];
    const fase = groupProfilePredictions(items).find((b) => b.phase === "eliminatoria")!;
    const keys = fase.subBuckets.map((s) => s.key);
    expect(keys.indexOf("semifinal")).toBeLessThan(keys.indexOf("terceiro"));
    expect(keys.indexOf("terceiro")).toBeLessThan(keys.indexOf("final"));
  });

  it("sub-bucket de eliminatória sem items é omitido", () => {
    const items = [makeElimItem("oitavas", "mO")];
    const fase = groupProfilePredictions(items).find((b) => b.phase === "eliminatoria")!;
    // "final" não tem items → não deve aparecer
    expect(fase.subBuckets.find((s) => s.key === "final")).toBeUndefined();
  });

  it("label de dezesseis-avos é 'Dezesseis Avos de Final'", () => {
    const fase = groupProfilePredictions([makeElimItem("dezesseis-avos", "mD")]).find(
      (b) => b.phase === "eliminatoria",
    )!;
    const sub = fase.subBuckets.find((s) => s.key === "dezesseis-avos")!;
    expect(sub.label).toBe("Dezesseis Avos de Final");
  });

  it("label de terceiro é 'Disputa 3º Lugar'", () => {
    const fase = groupProfilePredictions([makeElimItem("terceiro", "mT")]).find(
      (b) => b.phase === "eliminatoria",
    )!;
    expect(fase.subBuckets.find((s) => s.key === "terceiro")!.label).toBe("Disputa 3º Lugar");
  });

  it("itens dentro de sub-bucket de eliminatória ordenados por kickoffAt ASC", () => {
    const items = [
      makeElimItem("oitavas", "mO2"),
      makeElimItem("oitavas", "mO1"),
    ].map((item, i) => ({
      ...item,
      kickoffAt: i === 0 ? "2026-07-02T19:00:00Z" : "2026-07-01T19:00:00Z",
    }));
    const fase = groupProfilePredictions(items).find((b) => b.phase === "eliminatoria")!;
    const oitavas = fase.subBuckets.find((s) => s.key === "oitavas")!;
    expect(oitavas.items[0]!.matchId).toBe("mO1");
    expect(oitavas.items[1]!.matchId).toBe("mO2");
  });

  // --- Mix grupos + eliminatória ---

  it("mix retorna fase de grupos antes de fase eliminatória", () => {
    const items = [makeGroupItem("A", "m001"), makeElimItem("oitavas", "mO")];
    const buckets = groupProfilePredictions(items);
    expect(buckets[0]!.phase).toBe("grupos");
    expect(buckets[1]!.phase).toBe("eliminatoria");
  });

  it("mix: sem itens de grupos → fase de grupos ausente", () => {
    const items = [makeElimItem("final", "mF")];
    const buckets = groupProfilePredictions(items);
    expect(buckets.find((b) => b.phase === "grupos")).toBeUndefined();
  });

  // --- correctCount e totalItems ---

  it("correctCount conta displayStatus de acerto (acertou, acertou_vencedor, acertou_empate)", () => {
    const items = [
      makeGroupItem("A", "m001", "2026-06-15T13:00:00Z", "acertou"),
      makeGroupItem("A", "m002", "2026-06-15T14:00:00Z", "acertou_vencedor"),
      makeGroupItem("A", "m003", "2026-06-15T15:00:00Z", "acertou_empate"),
      makeGroupItem("A", "m004", "2026-06-15T16:00:00Z", "errou"),
      makeGroupItem("A", "m005", "2026-06-15T17:00:00Z", "pendente"),
    ];
    const fase = groupProfilePredictions(items).find((b) => b.phase === "grupos")!;
    expect(fase.correctCount).toBe(3);
    expect(fase.totalItems).toBe(5);
  });

  it("correctCount e totalItems por fase são independentes", () => {
    const items = [
      makeGroupItem("A", "m001", "2026-06-15T13:00:00Z", "acertou"),
      makeElimItem("oitavas", "mO"),
    ];
    const buckets = groupProfilePredictions(items);
    const grupo = buckets.find((b) => b.phase === "grupos")!;
    const elim = buckets.find((b) => b.phase === "eliminatoria")!;
    expect(grupo.correctCount).toBe(1);
    expect(grupo.totalItems).toBe(1);
    expect(elim.correctCount).toBe(0);
    expect(elim.totalItems).toBe(1);
  });
});
