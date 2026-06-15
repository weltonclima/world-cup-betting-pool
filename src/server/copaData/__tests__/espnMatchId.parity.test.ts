/**
 * Teste de paridade 104/104 (TASK-02 / H2) — núcleo de risco da feature.
 *
 * Prova, contra um snapshot do calendário oficial coletado ao vivo (ver
 * `fixtures/espnParitySnapshot.ts`), que buildEspnMatchId reproduz byte-a-byte
 * os matchIds canônicos do openfootball. Divergência de 1 byte quebra
 * `predictions/{matchId}`, `matches/{id}` e rankings — por isso o set inteiro é
 * travado, não apenas uma amostra.
 *
 * Grupo: 72 eventos → 72 IDs `{data-local}-{slug}-{slug}` idênticos.
 * Mata-mata: 32 eventos em ordem cronológica → `m73`..`m104`.
 */

import { describe, it, expect } from "vitest";
import { buildEspnMatchId, isGroupStage } from "../espnMatchId";
import {
  ESPN_GROUP_EVENTS,
  ESPN_KO_EVENTS_CHRONO,
  EXPECTED_GROUP_IDS,
  EXPECTED_KO_IDS,
} from "./fixtures/espnParitySnapshot";

describe("buildEspnMatchId — paridade 104/104 (H2)", () => {
  it("snapshot íntegro: 72 grupo + 32 mata-mata", () => {
    expect(ESPN_GROUP_EVENTS).toHaveLength(72);
    expect(ESPN_KO_EVENTS_CHRONO).toHaveLength(32);
    expect(EXPECTED_GROUP_IDS).toHaveLength(72);
    expect(EXPECTED_KO_IDS).toHaveLength(32);
  });

  it("os 72 eventos de grupo geram exatamente os IDs canônicos openfootball", () => {
    const generated = ESPN_GROUP_EVENTS.map((ev) => {
      expect(isGroupStage(ev)).toBe(true);
      return buildEspnMatchId(ev);
    });
    // ordem-independente: o conjunto precisa bater 1:1.
    expect([...generated].sort()).toEqual([...EXPECTED_GROUP_IDS].sort());
  });

  it("mata-mata em ordem cronológica gera m73..m104", () => {
    const generated = ESPN_KO_EVENTS_CHRONO.map((ev, i) => {
      expect(isGroupStage(ev)).toBe(false);
      return buildEspnMatchId(ev, 73 + i);
    });
    expect(generated).toEqual([...EXPECTED_KO_IDS]);
  });

  it("zero divergência total (104/104)", () => {
    const group = ESPN_GROUP_EVENTS.map((ev) => buildEspnMatchId(ev));
    const ko = ESPN_KO_EVENTS_CHRONO.map((ev, i) => buildEspnMatchId(ev, 73 + i));
    const all = new Set([...group, ...ko]);
    expect(all.size).toBe(104); // sem colisões
  });
});
