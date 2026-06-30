/**
 * Testes TDD (red-first) do Route Handler POST /api/rankings/recalc (TASK-03).
 *
 * Mocks: firebaseAdmin (auth + firestore), next/headers (cookies),
 * matchSource (getEffectiveMatches — fonte efetiva ESPN+overrides),
 * server-only. scorePrediction usa implementação REAL (binário) via importActual.
 *
 * Cobre: auth dupla, exclusão de blocked/pending, pontuação PONDERADA por escopo/group
 * (TASK-03: pontos 5/10 vs acertos exatos separados), aproveitamento (exato),
 * positionHistory append, pool stats, idempotência, doc malformado.
 */

import { type NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifySessionCookieMock,
  getFirestoreMock,
  getEffectiveMatchesMock,
  cookiesMock,
  notifyRankingUpsMock,
} = vi.hoisted(() => ({
  verifySessionCookieMock: vi.fn(),
  getFirestoreMock: vi.fn(),
  getEffectiveMatchesMock: vi.fn(),
  cookiesMock: vi.fn(),
  notifyRankingUpsMock: vi.fn(),
}));

vi.mock("@/server/firebaseAdmin", () => ({
  getAdminAuth: () => ({ verifySessionCookie: verifySessionCookieMock }),
  getAdminFirestore: getFirestoreMock,
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));

vi.mock("@/server/copaData", () => ({
  fetchAllTeams: vi.fn(),
}));

// Fonte efetiva (ESPN base + overrides manuais) — o que recalcRankings realmente
// consome (src/server/rankings/recalc.ts importa getEffectiveMatches do matchSource).
vi.mock("@/server/copaData/matchSource", () => ({
  getEffectiveMatches: getEffectiveMatchesMock,
}));

vi.mock("server-only", () => ({}));

// TASK-05: o disparo `ranking` é mockado p/ isolar o wiring do route da escrita real
// de notificações (testada à parte). `notifyRankingUps` é best-effort (nunca lança).
vi.mock("@/server/notifications", () => ({
  notifyRankingUps: notifyRankingUpsMock,
}));

import { POST } from "@/app/api/rankings/recalc/route";
import { EspnFetchError } from "@/server/copaData/espnClient";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookie";

// ───────────────────────── Fixtures ─────────────────────────
const SECRET = "recalc-secret-abc";
const ADMIN_UID = "uid-admin";
const SESSION = "admin-session-value";

const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

const M_GRUPOS = {
  id: "g1",
  status: "finished" as const,
  stage: "grupos" as const,
  groupId: "A",
  kickoffAt: iso(-72 * 3_600_000),
  homeTeamId: "t1",
  awayTeamId: "t2",
  homeScore: 2,
  awayScore: 1,
  venue: null,
};
const M_OITAVAS = {
  id: "o1",
  status: "finished" as const,
  stage: "oitavas" as const,
  groupId: null,
  kickoffAt: iso(-48 * 3_600_000),
  homeTeamId: "t3",
  awayTeamId: "t4",
  homeScore: 1,
  awayScore: 0,
  venue: null,
};
const M_SCHEDULED = {
  ...M_GRUPOS,
  id: "s1",
  status: "scheduled" as const,
  homeScore: null,
  awayScore: null,
};

// Admin NÃO entra aqui: a identidade de auth do admin vem por opts.adminUser
// (users.doc(ADMIN_UID).get()), separada da query de participantes aprovados.
const USERS = [
  { uid: "u1", name: "Ana Lima", nickname: "ana", email: "a@x.com", role: "user", status: "approved" },
  { uid: "u2", name: "Bia Souza", nickname: "bia", email: "b@x.com", role: "user", status: "approved" },
  { uid: "u3", name: "Caio Réu", nickname: "caio", email: "c@x.com", role: "user", status: "blocked" },
  { uid: "u4", name: "Dora Paz", nickname: "dora", email: "d@x.com", role: "user", status: "pending" },
];

const PREDICTIONS = [
  { uid: "u1", matchId: "g1", homeScore: 2, awayScore: 1, createdAt: iso(-200 * 3_600_000) }, // correct (10)
  { uid: "u1", matchId: "o1", homeScore: 1, awayScore: 0, createdAt: iso(-190 * 3_600_000) }, // correct (10)
  { uid: "u2", matchId: "g1", homeScore: 0, awayScore: 0, createdAt: iso(-180 * 3_600_000) }, // wrong (real 2x1, palpite empate)
  { uid: "u2", matchId: "o1", homeScore: 3, awayScore: 0, createdAt: iso(-175 * 3_600_000) }, // partial (5): mandante certo (real 1x0), placar errado
  { uid: "u3", matchId: "g1", homeScore: 2, awayScore: 1, createdAt: iso(-170 * 3_600_000) }, // blocked → excluído
];

// ───────────────────────── Firestore mock ─────────────────────────
interface Captured {
  path: string;
  data: Record<string, unknown>;
  options: unknown;
}

function makeDb(opts: {
  users?: typeof USERS;
  predictions?: Array<Record<string, unknown>>;
  existingStats?: Record<string, Record<string, unknown>>;
  adminUser?: Record<string, unknown> | null;
} = {}) {
  const users = opts.users ?? USERS;
  const predictions = opts.predictions ?? PREDICTIONS;
  const existingStats = opts.existingStats ?? {};
  const usersById = Object.fromEntries(users.map((u) => [u.uid, u]));
  const writes: Captured[] = [];

  const docSnap = (id: string, data: Record<string, unknown>) => ({
    id,
    data: () => data,
  });

  const makeDocRef = (coll: string, id: string) => ({
    id,
    get: vi.fn().mockResolvedValue(
      coll === "statistics"
        ? existingStats[id]
          ? { exists: true, data: () => existingStats[id] }
          : { exists: false }
        : coll === "users"
          ? opts.adminUser !== undefined && id === ADMIN_UID
            ? opts.adminUser === null
              ? { exists: false }
              : { exists: true, data: () => opts.adminUser }
            : usersById[id]
              ? { exists: true, data: () => usersById[id] }
              : { exists: false }
          : { exists: false },
    ),
    set: vi.fn((data: Record<string, unknown>, options: unknown) => {
      writes.push({ path: `${coll}/${id}`, data, options });
      return Promise.resolve();
    }),
  });

  const collection = (name: string) => ({
    get: vi.fn().mockResolvedValue({
      docs:
        name === "predictions"
          ? predictions.map((d, i) => docSnap(`p${i}`, d))
          : [],
    }),
    where: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({
        docs: users
          .filter((u) => u.status === "approved")
          .map((u) => docSnap(u.uid, u)),
      }),
    }),
    doc: (id: string) => makeDocRef(name, id),
  });

  getFirestoreMock.mockReturnValue({ collection: vi.fn(collection) });
  return { writes };
}

const find = (writes: Captured[], path: string) =>
  writes.find((w) => w.path === path);

function setupAdminSession({
  hasCookie = true,
  cookieValid = true,
  role = "admin" as "admin" | "user" | null,
} = {}) {
  cookiesMock.mockResolvedValue({
    get: vi
      .fn()
      .mockReturnValue(
        hasCookie ? { name: SESSION_COOKIE_NAME, value: SESSION } : undefined,
      ),
  });
  if (cookieValid) verifySessionCookieMock.mockResolvedValue({ uid: ADMIN_UID });
  else verifySessionCookieMock.mockRejectedValue(new Error("invalid"));
  return makeDb({
    adminUser: role === null ? null : { role, status: "approved" },
  });
}

function postReq(headers: Record<string, string> = {}): NextRequest {
  return new Request("http://localhost/api/rankings/recalc", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
  }) as unknown as NextRequest;
}
const withSecret = (s: string) => postReq({ "x-cron-secret": s });

// ───────────────────────── Tests ─────────────────────────
describe("POST /api/rankings/recalc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("RANKINGS_SECRET", SECRET);
    getEffectiveMatchesMock.mockResolvedValue([M_GRUPOS, M_OITAVAS, M_SCHEDULED]);
    notifyRankingUpsMock.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe("autorização", () => {
    it("401 sem secret e sem cookie", async () => {
      cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) });
      getFirestoreMock.mockReturnValue({
        collection: vi.fn().mockReturnValue({ doc: vi.fn() }),
      });
      expect((await POST(postReq())).status).toBe(401);
    });

    it("401 secret errado e cookie inválido", async () => {
      setupAdminSession({ cookieValid: false });
      expect((await POST(withSecret("nope"))).status).toBe(401);
    });

    it("403 sessão válida mas role user", async () => {
      setupAdminSession({ role: "user" });
      expect((await POST(withSecret("nope"))).status).toBe(403);
    });

    it("200 com secret correto", async () => {
      makeDb();
      expect((await POST(withSecret(SECRET))).status).toBe(200);
    });

    it("200 com sessão admin (sem secret)", async () => {
      setupAdminSession({ role: "admin" });
      expect((await POST(postReq())).status).toBe(200);
    });

    it("não chama cookies() quando secret válido", async () => {
      makeDb();
      await POST(withSecret(SECRET));
      expect(cookiesMock).not.toHaveBeenCalled();
    });
  });

  describe("ranking geral + exclusão de não-aprovados", () => {
    it("u1 lidera, u2 segundo; blocked/pending ausentes", async () => {
      const { writes } = makeDb();
      await POST(withSecret(SECRET));
      const geral = find(writes, "rankings/geral");
      expect(geral).toBeDefined();
      const entries = geral!.data.entries as Array<Record<string, unknown>>;
      const uids = entries.map((e) => e.uid);
      expect(uids).toContain("u1");
      expect(uids).toContain("u2");
      expect(uids).not.toContain("u3"); // blocked
      expect(uids).not.toContain("u4"); // pending
      const u1 = entries.find((e) => e.uid === "u1")!;
      const u2 = entries.find((e) => e.uid === "u2")!;
      expect(u1.position).toBe(1);
      expect(u1.points).toBe(20); // 2 placares exatos × 10 (ponderado)
      expect(u2.position).toBe(2);
      expect(u2.points).toBe(5); // 1 partial (vencedor certo) × 5
      expect(u2.wrong).toBe(1); // só g1; partial NÃO é wrong
    });

    it("entries trazem name e nickname desnormalizados", async () => {
      const { writes } = makeDb();
      await POST(withSecret(SECRET));
      const entries = find(writes, "rankings/geral")!.data.entries as Array<
        Record<string, unknown>
      >;
      const u1 = entries.find((e) => e.uid === "u1")!;
      expect(u1.name).toBe("Ana Lima");
      expect(u1.nickname).toBe("ana");
    });

    it("accuracy geral = points / finalizadas elegíveis", async () => {
      const { writes } = makeDb();
      await POST(withSecret(SECRET));
      const entries = find(writes, "rankings/geral")!.data.entries as Array<
        Record<string, unknown>
      >;
      // accuracy = ACERTOS EXATOS / finalizadas elegíveis (não pontos ponderados).
      // finalizadas geral = 2 (g1, o1). u1 2 exatos/2=100; u2 0 exatos/2=0
      // (o partial de u2 dá 5 pts mas NÃO conta como exato → accuracy 0).
      expect(entries.find((e) => e.uid === "u1")!.accuracy).toBe(100);
      expect(entries.find((e) => e.uid === "u2")!.accuracy).toBe(0);
    });
  });

  describe("escopos de fase e grupo", () => {
    it("grava ranking por fase grupos e oitavas, não 'dezesseis-avos'", async () => {
      const { writes } = makeDb();
      await POST(withSecret(SECRET));
      expect(find(writes, "rankings/grupos")).toBeDefined();
      expect(find(writes, "rankings/oitavas")).toBeDefined();
      expect(find(writes, "rankings/dezesseis-avos")).toBeUndefined();
    });

    it("ranking 'oitavas' inclui só pontos de partidas oitavas", async () => {
      const { writes } = makeDb();
      await POST(withSecret(SECRET));
      const entries = find(writes, "rankings/oitavas")!.data.entries as Array<
        Record<string, unknown>
      >;
      expect(entries.find((e) => e.uid === "u1")!.points).toBe(10); // só o1 (exato × 10)
    });

    it("grava ranking por grupo grupo-A", async () => {
      const { writes } = makeDb();
      await POST(withSecret(SECRET));
      const grupoA = find(writes, "rankings/grupo-A");
      expect(grupoA).toBeDefined();
      expect(grupoA!.data.groupId).toBe("A");
      const entries = grupoA!.data.entries as Array<Record<string, unknown>>;
      expect(entries.find((e) => e.uid === "u1")!.points).toBe(10); // g1 (exato × 10)
    });
  });

  describe("statistics por usuário", () => {
    it("grava statistics/u1 com totalCorrect, correctByStage e positionHistory", async () => {
      const { writes } = makeDb();
      await POST(withSecret(SECRET));
      const stats = find(writes, "statistics/u1");
      expect(stats).toBeDefined();
      expect(stats!.data.totalCorrect).toBe(2); // EXATOS (não pontos ponderados = 20)
      expect(stats!.data.totalWrong).toBe(0);
      const cbs = stats!.data.correctByStage as Record<string, number>;
      expect(cbs.grupos).toBe(1); // contagem de exatos por fase (não pontos)
      expect(cbs.oitavas).toBe(1);
      const hist = stats!.data.positionHistory as Array<Record<string, unknown>>;
      expect(hist.length).toBeGreaterThanOrEqual(1);
      const last = hist[hist.length - 1]!;
      expect(last.scope).toBe("geral");
      expect(last.position).toBe(1);
      expect(last.round).toBe(1);
    });

    it("positionHistory faz append preservando histórico e incrementa round", async () => {
      const { writes } = makeDb({
        existingStats: {
          u1: {
            uid: "u1",
            totalCorrect: 0,
            accuracy: 0,
            longestStreak: 0,
            correctByStage: {},
            positionHistory: [
              { at: iso(-1000 * 3_600_000), scope: "geral", position: 9, round: 1 },
            ],
          },
        },
      });
      await POST(withSecret(SECRET));
      const hist = find(writes, "statistics/u1")!.data
        .positionHistory as Array<Record<string, unknown>>;
      expect(hist.length).toBe(2);
      expect(hist[0]!.round).toBe(1);
      expect(hist[1]!.round).toBe(2); // incrementa
    });
  });

  describe("pool stats", () => {
    it("grava pool_stats/current com agregados", async () => {
      const { writes } = makeDb();
      await POST(withSecret(SECRET));
      const pool = find(writes, "pool_stats/current");
      expect(pool).toBeDefined();
      expect(pool!.data.totalParticipants).toBe(2); // só aprovados não-admin? inclui admin aprovado
      expect(pool!.data.highestPoints).toBe(20); // PONDERADO (u1: 2 exatos × 10)
      expect(pool!.data.lowestPoints).toBe(5); // PONDERADO (u2: 1 partial × 5)
      expect(pool!.data.totalCorrect).toBe(2); // EXATOS (u1 2 + u2 0), não pontos (25)
      expect(Array.isArray(pool!.data.distribution)).toBe(true);
    });
  });

  describe("regra ponderada — pontos × exatos separados (TASK-03)", () => {
    it("partial soma pontos mas NÃO conta como exato (accuracy/totalCorrect)", async () => {
      const { writes } = makeDb();
      await POST(withSecret(SECRET));
      // u2 tem 1 partial (o1) + 1 wrong (g1): 5 pts ponderados, 0 exatos.
      const geral = find(writes, "rankings/geral")!.data.entries as Array<
        Record<string, unknown>
      >;
      const u2 = geral.find((e) => e.uid === "u2")!;
      expect(u2.points).toBe(5); // ponderado > 0
      expect(u2.accuracy).toBe(0); // exato = 0 → aproveitamento 0
      const stats = find(writes, "statistics/u2")!.data;
      expect(stats.totalCorrect).toBe(0); // partial não é exato
      expect(stats.totalWrong).toBe(1); // partial não é wrong
    });

    it("partial NÃO entra em correctByStage (contagem de exatos por fase)", async () => {
      const { writes } = makeDb();
      await POST(withSecret(SECRET));
      const cbs = find(writes, "statistics/u2")!.data.correctByStage as Record<
        string,
        number
      >;
      // o1 (oitavas) de u2 é partial → não conta como acerto exato de fase.
      expect(cbs.oitavas ?? 0).toBe(0);
    });

    it("longestStreak conta só exatos: partial não cria sequência (D3)", async () => {
      const { writes } = makeDb();
      await POST(withSecret(SECRET));
      // u1: correct, correct (cronológico) → streak 2.
      expect(find(writes, "statistics/u1")!.data.longestStreak).toBe(2);
      // u2: wrong + partial → nenhum exato → streak 0.
      expect(find(writes, "statistics/u2")!.data.longestStreak).toBe(0);
    });

    it("ranking ordena por pontos ponderados, accuracy desempata por exatos", async () => {
      const { writes } = makeDb();
      await POST(withSecret(SECRET));
      const geral = find(writes, "rankings/geral")!.data.entries as Array<
        Record<string, unknown>
      >;
      // u1 (20 pts, 100% exato) > u2 (5 pts, 0% exato).
      expect(geral[0]!.uid).toBe("u1");
      expect(geral[1]!.uid).toBe("u2");
    });
  });

  describe("idempotência", () => {
    it("duas execuções gravam os mesmos entries no ranking geral", async () => {
      const { writes: w1 } = makeDb();
      await POST(withSecret(SECRET));
      const { writes: w2 } = makeDb();
      await POST(withSecret(SECRET));
      expect(JSON.stringify(find(w1, "rankings/geral")!.data.entries)).toBe(
        JSON.stringify(find(w2, "rankings/geral")!.data.entries),
      );
    });
  });

  describe("disparo de notificações ranking (TASK-05)", () => {
    it("dispara notifyRankingUps com os deltas do recalc e um Date", async () => {
      makeDb();
      await POST(withSecret(SECRET));
      expect(notifyRankingUpsMock).toHaveBeenCalledTimes(1);
      const [dbArg, deltasArg, nowArg] = notifyRankingUpsMock.mock.calls[0]!;
      expect(dbArg).toBeDefined();
      expect(Array.isArray(deltasArg)).toBe(true);
      // deltas cobrem TODOS os aprovados (recalc expõe; o helper é quem filtra subida).
      const uids = (deltasArg as Array<{ uid: string }>).map((d) => d.uid).sort();
      expect(uids).toEqual(["u1", "u2"]);
      expect(nowArg).toBeInstanceOf(Date);
    });

    it("delta de quem subiu carrega previousPosition do histórico", async () => {
      makeDb({
        existingStats: {
          u1: {
            uid: "u1",
            totalCorrect: 0,
            accuracy: 0,
            longestStreak: 0,
            correctByStage: {},
            positionHistory: [
              { at: iso(-1000 * 3_600_000), scope: "geral", position: 9, round: 1 },
            ],
          },
        },
      });
      await POST(withSecret(SECRET));
      const deltas = notifyRankingUpsMock.mock.calls[0]![1] as Array<{
        uid: string;
        previousPosition: number | undefined;
        newPosition: number;
      }>;
      const u1 = deltas.find((d) => d.uid === "u1")!;
      expect(u1.previousPosition).toBe(9); // veio do positionHistory
      expect(u1.newPosition).toBe(1); // lidera agora → subiu
    });

    it("resposta NÃO expõe deltas (payload limpo) mas mantém o resumo", async () => {
      makeDb();
      const res = await POST(withSecret(SECRET));
      const body = (await res.json()) as Record<string, unknown>;
      expect("deltas" in body).toBe(false);
      expect(body.participants).toBe(2);
      expect(typeof body.finishedMatches).toBe("number");
    });

    it("notificação best-effort: recalc grava e responde 200 independentemente", async () => {
      // Contrato: notifyRankingUps nunca lança; aqui é no-op. O recalc segue íntegro.
      const { writes } = makeDb();
      const res = await POST(withSecret(SECRET));
      expect(res.status).toBe(200);
      expect(find(writes, "rankings/geral")).toBeDefined();
    });
  });

  describe("robustez", () => {
    it("ignora prediction malformada e prossegue", async () => {
      const { writes } = makeDb({
        predictions: [
          ...PREDICTIONS,
          { uid: "u1", matchId: "g1", homeScore: "x" }, // malformada
        ],
      });
      const res = await POST(withSecret(SECRET));
      expect(res.status).toBe(200);
      expect(find(writes, "rankings/geral")).toBeDefined();
    });

    it("502 quando getEffectiveMatches lança EspnFetchError", async () => {
      makeDb();
      getEffectiveMatchesMock.mockRejectedValue(new EspnFetchError(503));
      expect((await POST(withSecret(SECRET))).status).toBe(502);
    });
  });
});
