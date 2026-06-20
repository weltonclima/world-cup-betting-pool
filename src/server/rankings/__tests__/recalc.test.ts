/**
 * Testes de `ensureRankingsFresh` (dirty-by-finish: recomputa quando a assinatura
 * dos finalizados muda) e `recalcRankingsBestEffort` (encadeado no save do
 * resultado, nunca lança).
 *
 * `recalcRankings` roda de verdade com `getEffectiveMatches` mockado. Sinal de
 * "recalc rodou" = houve `set` em `rankings/geral` (capturado em `writes`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getEffectiveMatchesMock } = vi.hoisted(() => ({
  getEffectiveMatchesMock: vi.fn(),
}));

vi.mock("@/server/copaData/matchSource", () => ({
  getEffectiveMatches: getEffectiveMatchesMock,
}));

vi.mock("server-only", () => ({}));

import {
  computeFinishedSignature,
  ensureRankingsFresh,
  recalcRankingsBestEffort,
  RECALC_VERSION as CURRENT_VERSION,
} from "@/server/rankings/recalc";

/**
 * `fresh` controla o doc-sentinela `rankings/_freshness` lido pelo dirty-by-finish;
 * os demais docs retornam ausentes (suficiente para os cenários do guard).
 */
function makeDb(opts: { fresh?: { exists: boolean; data?: () => unknown } } = {}) {
  const writes: string[] = [];
  const docRef = (coll: string, id: string) => ({
    get: vi.fn().mockResolvedValue(
      coll === "rankings" && id === "_freshness"
        ? (opts.fresh ?? { exists: false, data: () => undefined })
        : { exists: false, data: () => undefined },
    ),
    set: vi.fn(async () => {
      writes.push(`${coll}/${id}`);
    }),
    ref: { delete: vi.fn() },
  });
  const collection = vi.fn((name: string) => ({
    get: vi.fn().mockResolvedValue({ docs: [] }),
    where: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ docs: [] }) }),
    doc: vi.fn((id: string) => docRef(name, id)),
  }));
  return { db: { collection } as never, writes };
}

const recalcRan = (writes: string[]) => writes.includes("rankings/geral");
const EMPTY_SIG = computeFinishedSignature([]); // assinatura de "[] finalizados"

beforeEach(() => {
  vi.clearAllMocks();
  getEffectiveMatchesMock.mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe("ensureRankingsFresh (dirty-by-finish)", () => {
  it("assinatura E versão batem → no-op (nada mudou desde o último recalc)", async () => {
    const { db, writes } = makeDb({
      fresh: { exists: true, data: () => ({ signature: EMPTY_SIG, version: CURRENT_VERSION }) },
    });
    await ensureRankingsFresh(db);
    expect(getEffectiveMatchesMock).toHaveBeenCalledTimes(1); // só p/ a assinatura
    expect(recalcRan(writes)).toBe(false);
  });

  it("doc de frescor ausente → recalc (cold start)", async () => {
    const { db, writes } = makeDb({ fresh: { exists: false } });
    await ensureRankingsFresh(db);
    expect(getEffectiveMatchesMock).toHaveBeenCalled();
    expect(recalcRan(writes)).toBe(true);
  });

  it("assinatura diverge (placar novo) → recalc", async () => {
    const { db, writes } = makeDb({
      fresh: { exists: true, data: () => ({ signature: "stale-signature", version: CURRENT_VERSION }) },
    });
    await ensureRankingsFresh(db);
    expect(recalcRan(writes)).toBe(true);
  });

  it("assinatura bate mas SEM campo version (doc pré-deploy) → recalc (gate de shape)", async () => {
    const { db, writes } = makeDb({
      fresh: { exists: true, data: () => ({ signature: EMPTY_SIG }) },
    });
    await ensureRankingsFresh(db);
    expect(recalcRan(writes)).toBe(true);
  });

  it("assinatura bate mas versão de formato diverge (deploy mudou shape) → recalc", async () => {
    const { db, writes } = makeDb({
      fresh: { exists: true, data: () => ({ signature: EMPTY_SIG, version: CURRENT_VERSION - 1 }) },
    });
    await ensureRankingsFresh(db);
    expect(recalcRan(writes)).toBe(true);
  });

  it("falha lendo partidas efetivas não lança nem recalcula", async () => {
    getEffectiveMatchesMock.mockRejectedValueOnce(new Error("fonte fora"));
    const { db, writes } = makeDb({ fresh: { exists: true, data: () => ({ signature: EMPTY_SIG }) } });
    await expect(ensureRankingsFresh(db)).resolves.toBeUndefined();
    expect(recalcRan(writes)).toBe(false);
  });

  it("falha no recálculo (cold start) não lança", async () => {
    getEffectiveMatchesMock
      .mockResolvedValueOnce([]) // assinatura calcula ok
      .mockRejectedValueOnce(new Error("fonte fora")); // recalc re-busca e falha
    const { db } = makeDb({ fresh: { exists: false } });
    await expect(ensureRankingsFresh(db)).resolves.toBeUndefined();
  });
});

describe("computeFinishedSignature", () => {
  const m = (over: Record<string, unknown>) => ({
    id: "m1",
    status: "finished",
    homeScore: 1,
    awayScore: 0,
    ...over,
  }) as never;

  it("ignora não-finalizados", () => {
    expect(computeFinishedSignature([m({ id: "x", status: "scheduled" })])).toBe(EMPTY_SIG);
  });

  it("muda quando um jogo novo finaliza", () => {
    const a = computeFinishedSignature([m({ id: "m1" })]);
    const b = computeFinishedSignature([m({ id: "m1" }), m({ id: "m2" })]);
    expect(a).not.toBe(b);
  });

  it("muda quando um placar finalizado é corrigido", () => {
    const a = computeFinishedSignature([m({ id: "m1", homeScore: 1, awayScore: 0 })]);
    const b = computeFinishedSignature([m({ id: "m1", homeScore: 2, awayScore: 0 })]);
    expect(a).not.toBe(b);
  });

  it("é estável independente da ordem de entrada", () => {
    const a = computeFinishedSignature([m({ id: "m1" }), m({ id: "m2" })]);
    const b = computeFinishedSignature([m({ id: "m2" }), m({ id: "m1" })]);
    expect(a).toBe(b);
  });
});

describe("recalcRankingsBestEffort", () => {
  it("recalcula (grava rankings/geral)", async () => {
    const { db, writes } = makeDb();
    await recalcRankingsBestEffort(db);
    expect(recalcRan(writes)).toBe(true);
  });

  it("nunca lança quando o recálculo falha", async () => {
    getEffectiveMatchesMock.mockRejectedValueOnce(new Error("boom"));
    const { db, writes } = makeDb();
    await expect(recalcRankingsBestEffort(db)).resolves.toBeUndefined();
    expect(recalcRan(writes)).toBe(false);
  });
});

// ── TASK-05: propagação de avatarUrl às entries do ranking ──────────────────
/**
 * DB mock que devolve usuários aprovados (com/sem `avatarUrl`) e captura o PAYLOAD
 * gravado em cada doc — diferente do `makeDb` (que só registra o path). Sem partidas
 * finalizadas: os usuários ainda entram no ranking geral (pontos 0), bastando para
 * exercitar `toEntry` + `applyAvatarBudget`.
 */
function makeUsersDb(users: Array<Record<string, unknown>>) {
  const setPayloads = new Map<string, unknown>();
  const collection = vi.fn((name: string) => {
    if (name === "users") {
      return {
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ docs: users.map((u) => ({ id: u["uid"], data: () => u })) }),
        }),
        get: vi.fn().mockResolvedValue({ docs: [] }),
        doc: vi.fn(),
      };
    }
    return {
      get: vi.fn().mockResolvedValue({ docs: [] }),
      where: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ docs: [] }) }),
      doc: vi.fn((id: string) => ({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
        set: vi.fn(async (payload: unknown) => {
          setPayloads.set(`${name}/${id}`, payload);
        }),
        ref: { delete: vi.fn() },
      })),
    };
  });
  return { db: { collection } as never, setPayloads };
}

const baseUser = (over: Record<string, unknown>) => ({
  name: "Fulano",
  nickname: "fulano",
  email: "f@x.com",
  role: "participant",
  status: "approved",
  ...over,
});

describe("recalc — avatarUrl nas entries (TASK-05)", () => {
  it("propaga avatarUrl do user para a entry correspondente", async () => {
    const { db, setPayloads } = makeUsersDb([
      baseUser({ uid: "comFoto", avatarUrl: "data:image/jpeg;base64,QUJD" }),
    ]);
    await recalcRankingsBestEffort(db);
    const geral = setPayloads.get("rankings/geral") as { entries: Array<Record<string, unknown>> };
    const entry = geral.entries.find((e) => e["uid"] === "comFoto");
    expect(entry?.["avatarUrl"]).toBe("data:image/jpeg;base64,QUJD");
  });

  it("entry de user sem avatarUrl não carrega o campo", async () => {
    const { db, setPayloads } = makeUsersDb([baseUser({ uid: "semFoto" })]);
    await recalcRankingsBestEffort(db);
    const geral = setPayloads.get("rankings/geral") as { entries: Array<Record<string, unknown>> };
    const entry = geral.entries.find((e) => e["uid"] === "semFoto");
    expect(entry).toBeDefined();
    expect("avatarUrl" in entry!).toBe(false);
  });
});

// ── Decomposição A/V/E nas entries (fix Tela 01) ────────────────────────────
/**
 * Mock que serve usuários aprovados E predictions cruas (`predictions.get()`),
 * capturando os payloads gravados. Exercita o scoring real do recalc geral.
 */
function makeScoringDb(
  users: Array<Record<string, unknown>>,
  preds: Array<Record<string, unknown>>,
) {
  const setPayloads = new Map<string, unknown>();
  const collection = vi.fn((name: string) => {
    if (name === "users") {
      return {
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            docs: users.map((u) => ({ id: u["uid"], data: () => u })),
          }),
        }),
        get: vi.fn().mockResolvedValue({ docs: [] }),
        doc: vi.fn(),
      };
    }
    if (name === "predictions") {
      return {
        get: vi.fn().mockResolvedValue({
          docs: preds.map((p, i) => ({ id: `p${i}`, data: () => p })),
        }),
        where: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ docs: [] }) }),
        doc: vi.fn(),
      };
    }
    return {
      get: vi.fn().mockResolvedValue({ docs: [] }),
      where: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ docs: [] }) }),
      doc: vi.fn((id: string) => ({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
        set: vi.fn(async (payload: unknown) => {
          setPayloads.set(`${name}/${id}`, payload);
        }),
        ref: { delete: vi.fn() },
      })),
    };
  });
  return { db: { collection } as never, setPayloads };
}

describe("recalc — decomposição A/V/E (correct/winner/draw)", () => {
  const match = (id: string, homeScore: number, awayScore: number) => ({
    id,
    status: "finished" as const,
    homeScore,
    awayScore,
    stage: "grupos",
    groupId: "A",
    kickoffAt: "2026-06-11T13:00:00-06:00",
  });
  const pred = (matchId: string, homeScore: number, awayScore: number) => ({
    uid: "u1",
    matchId,
    homeScore,
    awayScore,
  });

  it("conta A=exato, V=vencedor-parcial, E=empate-parcial e ignora erro", async () => {
    getEffectiveMatchesMock.mockResolvedValue([
      match("m1", 2, 0), // pred exato → A
      match("m2", 2, 0), // pred 1-0: mesmo vencedor, placar errado → V
      match("m3", 1, 1), // pred 2-2: empate previsto, placar errado → E
      match("m4", 1, 0), // pred 0-1: vencedor errado → wrong
    ] as never);
    const { db, setPayloads } = makeScoringDb(
      [baseUser({ uid: "u1" })],
      [
        pred("m1", 2, 0),
        pred("m2", 1, 0),
        pred("m3", 2, 2),
        pred("m4", 0, 1),
      ],
    );

    await recalcRankingsBestEffort(db);

    const geral = setPayloads.get("rankings/geral") as {
      entries: Array<Record<string, unknown>>;
    };
    const e = geral.entries.find((x) => x["uid"] === "u1")!;
    expect(e["correct"]).toBe(1); // A: placar exato (10)
    expect(e["winner"]).toBe(1); // V: vencedor parcial (5)
    expect(e["draw"]).toBe(1); // E: empate parcial (5)
    expect(e["wrong"]).toBe(1);
    expect(e["points"]).toBe(20); // 10 + 5 + 5 + 0

    // statistics: totalPartial = V+E (parciais); totalCorrect = exatos.
    const stats = setPayloads.get("statistics/u1") as Record<string, unknown>;
    expect(stats["totalCorrect"]).toBe(1);
    expect(stats["totalPartial"]).toBe(2); // 1 vencedor + 1 empate
    expect(stats["totalWrong"]).toBe(1);
  });

  it("entry sem palpites grava A/V/E zerados", async () => {
    getEffectiveMatchesMock.mockResolvedValue([match("m1", 2, 0)] as never);
    const { db, setPayloads } = makeScoringDb([baseUser({ uid: "semPalpite" })], []);
    await recalcRankingsBestEffort(db);
    const geral = setPayloads.get("rankings/geral") as {
      entries: Array<Record<string, unknown>>;
    };
    const e = geral.entries.find((x) => x["uid"] === "semPalpite")!;
    expect(e["correct"]).toBe(0);
    expect(e["winner"]).toBe(0);
    expect(e["draw"]).toBe(0);
  });
});

// ── Isolamento por pool na Tela 03 (fix vazamento entre pools) ──────────────
/**
 * Garante que fases e grupos da Copa ganham docs RECORTADOS por pool
 * (`pool-{poolId}-{scope}`, `pool-{poolId}-grupo-{groupId}`) contendo só os membros
 * daquele pool, enquanto os docs GLOBAIS seguem com todos — sem vazamento cruzado.
 */
describe("recalc — isolamento por pool (Tela 03)", () => {
  const matchA = {
    id: "mA",
    status: "finished" as const,
    homeScore: 2,
    awayScore: 0,
    stage: "grupos",
    groupId: "A",
    kickoffAt: "2026-06-11T13:00:00-06:00",
  };
  // u1 ∈ pool p1, u2 ∈ pool p2, u3 sem pool. Todos palpitam o MESMO jogo do grupo A.
  const users = [
    baseUser({ uid: "u1", groupId: "p1" }),
    baseUser({ uid: "u2", groupId: "p2" }),
    baseUser({ uid: "u3" }), // sem groupId → fora de qualquer pool
  ];
  const preds = [
    { uid: "u1", matchId: "mA", homeScore: 2, awayScore: 0 }, // exato
    { uid: "u2", matchId: "mA", homeScore: 1, awayScore: 0 }, // vencedor
    { uid: "u3", matchId: "mA", homeScore: 0, awayScore: 1 }, // errado
  ];
  const uids = (payload: unknown) =>
    (payload as { entries: Array<{ uid: string }> }).entries.map((e) => e.uid).sort();

  it("grava docs de fase/grupo por pool só com membros do pool; global com todos", async () => {
    getEffectiveMatchesMock.mockResolvedValue([matchA] as never);
    const { db, setPayloads } = makeScoringDb(users, preds);

    await recalcRankingsBestEffort(db);

    // Global: todos os 3 aprovados.
    expect(uids(setPayloads.get("rankings/grupo-A"))).toEqual(["u1", "u2", "u3"]);
    expect(uids(setPayloads.get("rankings/grupos"))).toEqual(["u1", "u2", "u3"]);

    // Pool p1: só u1. Pool p2: só u2. Sem vazamento cruzado.
    expect(uids(setPayloads.get("rankings/pool-p1-grupo-A"))).toEqual(["u1"]);
    expect(uids(setPayloads.get("rankings/pool-p2-grupo-A"))).toEqual(["u2"]);
    expect(uids(setPayloads.get("rankings/pool-p1-grupos"))).toEqual(["u1"]);
    expect(uids(setPayloads.get("rankings/pool-p2-grupos"))).toEqual(["u2"]);
  });

  it("usuário sem pool não gera doc de pool próprio (só entra no global)", async () => {
    getEffectiveMatchesMock.mockResolvedValue([matchA] as never);
    const { db, setPayloads } = makeScoringDb(users, preds);

    await recalcRankingsBestEffort(db);

    // u3 não tem pool → nenhum doc `pool-...` o referencia.
    const poolDocPaths = [...setPayloads.keys()].filter((k) => k.startsWith("rankings/pool-"));
    for (const path of poolDocPaths) {
      expect(uids(setPayloads.get(path))).not.toContain("u3");
    }
  });

  it("membro de pool é RE-RANKEADO em posição 1 dentro do próprio pool", async () => {
    getEffectiveMatchesMock.mockResolvedValue([matchA] as never);
    const { db, setPayloads } = makeScoringDb(users, preds);

    await recalcRankingsBestEffort(db);

    // u2 é #2 no global (atrás de u1, exato), mas #1 isolado no seu pool p2.
    const poolP2 = setPayloads.get("rankings/pool-p2-grupo-A") as {
      entries: Array<{ uid: string; position: number }>;
    };
    expect(poolP2.entries.find((e) => e.uid === "u2")?.position).toBe(1);
  });
});

describe("recalc — doc de frescor (dirty-by-finish)", () => {
  it("grava rankings/_freshness com a assinatura dos finalizados", async () => {
    const finished = [
      {
        id: "m1",
        status: "finished",
        homeScore: 2,
        awayScore: 1,
        stage: "grupos",
        groupId: "A",
        kickoffAt: "2026-06-11T13:00:00-06:00",
      },
    ];
    getEffectiveMatchesMock.mockResolvedValue(finished);
    const { db, setPayloads } = makeUsersDb([baseUser({ uid: "u1" })]);
    await recalcRankingsBestEffort(db);
    const fresh = setPayloads.get("rankings/_freshness") as
      | { signature: string; version: number }
      | undefined;
    expect(fresh).toBeDefined();
    // Persistido === o que o guard recomputa ao ler → no-op enquanto nada mudar.
    expect(fresh!.signature).toBe(computeFinishedSignature(finished as never));
    // Marca o formato regravado → guard só vira no-op com a MESMA versão de shape.
    expect(fresh!.version).toBe(CURRENT_VERSION);
  });
});
