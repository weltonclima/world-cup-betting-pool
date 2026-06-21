import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { moderationNotification } from "@/features/admin/lib/notificationFactory";
import {
  notifyModeration,
  notifyRankingUp,
  notifyScoreHit,
} from "@/server/notifications/factory";

describe("notifyScoreHit", () => {
  const base = {
    uid: "u1",
    matchId: "m10",
    homeTeam: "Brasil",
    awayTeam: "Argentina",
  };

  it("correct → 'acertou o placar' (+10), type games, id determinístico", () => {
    const n = notifyScoreHit({ ...base, result: "correct", predictionIsDraw: false });
    expect(n.type).toBe("games");
    expect(n.userId).toBe("u1");
    expect(n.id).toBe("games-u1-m10");
    expect(n.title).toBe("Você acertou o placar!");
    expect(n.message).toBe("🎯 Você acertou o placar! +10 pts em Brasil x Argentina");
  });

  it("partial + não-empate → 'acertou o vencedor' (+5)", () => {
    const n = notifyScoreHit({ ...base, result: "partial", predictionIsDraw: false });
    expect(n.id).toBe("games-u1-m10");
    expect(n.message).toBe("✅ Você acertou o vencedor! +5 pts em Brasil x Argentina");
  });

  it("partial + empate → 'acertou o empate' (+5)", () => {
    const n = notifyScoreHit({ ...base, result: "partial", predictionIsDraw: true });
    expect(n.message).toBe("🤝 Você acertou o empate! +5 pts em Brasil x Argentina");
  });

  it("result fora do contrato (ex.: 'wrong') → lança, não gera acerto falso (§6.1)", () => {
    expect(() =>
      notifyScoreHit({
        ...base,
        // força um valor inválido cruzando a fronteira de tipos (caller JSON).
        result: "wrong" as "correct" | "partial",
        predictionIsDraw: false,
      }),
    ).toThrow(/result inválido/);
  });
});

describe("notifyRankingUp", () => {
  it("subida comum (fora do pódio) → mensagem de subida + id por dia", () => {
    const n = notifyRankingUp({
      uid: "u1",
      newPosition: 7,
      previousPosition: 12,
      dateKey: "2026-06-20",
    });
    expect(n.type).toBe("ranking");
    expect(n.id).toBe("ranking-u1-2026-06-20");
    expect(n.message).toBe("📈 Você subiu para 7º no ranking!");
  });

  it("entrou no pódio (≤3) → mensagem de pódio", () => {
    const n = notifyRankingUp({
      uid: "u1",
      newPosition: 2,
      previousPosition: 5,
      dateKey: "2026-06-20",
    });
    expect(n.message).toBe("🏆 Você está no pódio! 2º lugar");
  });

  it("posição 3 ainda é pódio", () => {
    const n = notifyRankingUp({
      uid: "u1",
      newPosition: 3,
      previousPosition: 4,
      dateKey: "2026-06-20",
    });
    expect(n.message).toContain("pódio");
  });
});

describe("notifyModeration (paridade com moderationNotification legado)", () => {
  const cases = [
    { from: "pending", to: "approved", label: "aprovação" },
    { from: "blocked", to: "approved", label: "reativação" },
    { from: "approved", to: "blocked", label: "bloqueio" },
    { from: "pending", to: "blocked", label: "rejeição" },
  ] as const;

  it.each(cases)("$label: title/message/type idênticos ao legado", ({ from, to }) => {
    const legacy = moderationNotification({ uid: "u1", from, to, actorUid: "a1" });
    const n = notifyModeration({ uid: "u1", from, to });
    expect(n).not.toBeNull();
    expect(n!.type).toBe(legacy!.type);
    expect(n!.title).toBe(legacy!.title);
    expect(n!.message).toBe(legacy!.message);
    expect(n!.userId).toBe("u1");
  });

  it("sem id determinístico (auto-id no write — eventos repetíveis)", () => {
    const n = notifyModeration({ uid: "u1", from: "pending", to: "approved" });
    expect(n!.id).toBeUndefined();
  });

  it("transição que não notifica → null (ex.: approved→approved)", () => {
    expect(
      notifyModeration({ uid: "u1", from: "approved", to: "approved" }),
    ).toBeNull();
  });
});
