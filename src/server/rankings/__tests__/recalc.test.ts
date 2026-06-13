/**
 * Testes de `ensureRankingsFresh` (cold start: popula-se-ausente) e
 * `recalcRankingsBestEffort` (encadeado no save do resultado, nunca lança).
 *
 * `recalcRankings` roda de verdade com `getEffectiveMatches` mockado → []. Sinal de
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

import { ensureRankingsFresh, recalcRankingsBestEffort } from "@/server/rankings/recalc";

function makeDb(opts: { geral: { exists: boolean; data?: () => unknown } }) {
  const writes: string[] = [];
  const docRef = (coll: string, id: string) => ({
    get: vi.fn().mockResolvedValue(
      coll === "rankings" && id === "geral"
        ? opts.geral
        : { exists: false, data: () => undefined },
    ),
    set: vi.fn(async () => {
      writes.push(`${coll}/${id}`);
    }),
  });
  const collection = vi.fn((name: string) => ({
    get: vi.fn().mockResolvedValue({ docs: [] }),
    where: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ docs: [] }) }),
    doc: vi.fn((id: string) => docRef(name, id)),
  }));
  return { db: { collection } as never, writes };
}

const recalcRan = (writes: string[]) => writes.includes("rankings/geral");

beforeEach(() => {
  vi.clearAllMocks();
  getEffectiveMatchesMock.mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe("ensureRankingsFresh (cold start)", () => {
  it("doc já existe → no-op (o save do resultado mantém fresco)", async () => {
    const { db, writes } = makeDb({ geral: { exists: true, data: () => ({}) } });
    await ensureRankingsFresh(db);
    expect(getEffectiveMatchesMock).not.toHaveBeenCalled();
    expect(recalcRan(writes)).toBe(false);
  });

  it("doc ausente → popula (recalc bloqueante)", async () => {
    const { db, writes } = makeDb({ geral: { exists: false } });
    await ensureRankingsFresh(db);
    expect(getEffectiveMatchesMock).toHaveBeenCalledTimes(1);
    expect(recalcRan(writes)).toBe(true);
  });

  it("falha de recálculo no cold start não lança", async () => {
    getEffectiveMatchesMock.mockRejectedValueOnce(new Error("fonte fora"));
    const { db } = makeDb({ geral: { exists: false } });
    await expect(ensureRankingsFresh(db)).resolves.toBeUndefined();
  });
});

describe("recalcRankingsBestEffort", () => {
  it("recalcula (grava rankings/geral)", async () => {
    const { db, writes } = makeDb({ geral: { exists: true, data: () => ({}) } });
    await recalcRankingsBestEffort(db);
    expect(recalcRan(writes)).toBe(true);
  });

  it("nunca lança quando o recálculo falha", async () => {
    getEffectiveMatchesMock.mockRejectedValueOnce(new Error("boom"));
    const { db, writes } = makeDb({ geral: { exists: true, data: () => ({}) } });
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
