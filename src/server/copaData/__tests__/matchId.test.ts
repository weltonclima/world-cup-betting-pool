import { describe, it, expect } from "vitest";

import { slugifyTeamName, buildMatchId } from "../matchId";

// ─── slugifyTeamName ──────────────────────────────────────────────────────────

describe("slugifyTeamName", () => {
  it("MID-01: lowercase + espaços viram '-'", () => {
    expect(slugifyTeamName("South Africa")).toBe("south-africa");
  });

  it("MID-02: acentos e símbolos viram '-' (Curaçao)", () => {
    expect(slugifyTeamName("Curaçao")).toBe("cura-ao");
  });

  it("MID-03: '&' e espaços colapsam num único '-' (Bosnia & Herzegovina)", () => {
    expect(slugifyTeamName("Bosnia & Herzegovina")).toBe("bosnia-herzegovina");
  });

  it("MID-04: apara '-' das bordas", () => {
    expect(slugifyTeamName("(Inglewood)")).toBe("inglewood");
  });
});

// ─── buildMatchId ─────────────────────────────────────────────────────────────

describe("buildMatchId", () => {
  it("MID-05: mata-mata com num → 'm{num}' (m73)", () => {
    expect(buildMatchId({ num: 73, date: "2026-06-28", team1: "2A", team2: "2B" })).toBe("m73");
  });

  it("MID-06: mata-mata final (m104)", () => {
    expect(buildMatchId({ num: 104, date: "2026-07-19", team1: "W101", team2: "W102" })).toBe("m104");
  });

  it("MID-07: grupo (sem num) → '{date}-{slug}-{slug}'", () => {
    expect(buildMatchId({ date: "2026-06-11", team1: "Mexico", team2: "South Africa" })).toBe(
      "2026-06-11-mexico-south-africa",
    );
  });

  it("MID-08: grupo com acento preserva a fórmula de slug", () => {
    expect(buildMatchId({ date: "2026-06-20", team1: "Brazil", team2: "Egypt" })).toBe(
      "2026-06-20-brazil-egypt",
    );
  });
});
