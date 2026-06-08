# VERIFICATION

## 1. Task: TASK-14 – Firestore Rules + dark-mode token + carry-forwards (infra/security)

> Contrato: PLAN `ai/plan/ranking.md` §3 TASK-14 + bullets "Carry-forward dos reviews". Sem `/spec` (infra/security). Commit 22828d9.

## 2. Must-have truths
- T-01: Rules `predictions` read = owner-only (`isOwner(resource.data.uid) || isAdmin()`), gated em `isApproved()`; write `if false` — **VERIFIED**
- T-02: Rules `rankings`/`statistics`/`pool_stats` → read `isApproved()`, write `if false`; **match `pool_stats` EXISTE** (gap real corrigido) — **VERIFIED**
- T-03: `safeSecretEqual` usado nos DOIS endpoints (score + recalc); helper trata length-mismatch sem lançar e retorna false em ausente/vazio — **VERIFIED**
- T-04: `positionHistory` dedup — append só quando posição geral MUDOU vs. último snapshot; `round` incrementa só no append — **VERIFIED**
- T-05: `.refine` `min≤max` (distributionBucket) e `lowestPoints≤highestPoints` (poolStats) — **VERIFIED**
- T-06: Token dark `.dark .ranking-theme`/`.palpites-theme` → `--primary` ~0.72 + `--primary-foreground` escuro; light inalterado — **VERIFIED**
- T-07: Encadeamento `chainRecalc` após score, best-effort, guardado por `RANKINGS_SECRET` — **VERIFIED**
- T-08: tsc strict 0; suites alvo 62/62 verdes — **VERIFIED**

## 3. Evidence per truth
- **T-01:** `firestore.rules:68-71` — `match /predictions/{predictionId}` → `allow read: if isApproved() && (isOwner(resource.data.uid) || isAdmin())`; `allow write: if false`. Comentário (57-67) documenta A5=PRIVADO e a reversão do D7 (leitura ampla anterior). Helper `isOwner` (l.28) = `isSignedIn() && request.auth.uid == uid`.
- **T-02:** `firestore.rules:97-99` — `rankings/{scope}`, `statistics/{uid}`, `pool_stats/{id}` cada um `allow read: if isApproved(); allow write: if false`. O `match /pool_stats/{id}` existe; comentário (94-96) registra que a Tela 06 lê `pool_stats/current` e que sem o match o deny-by-default (l.103-105) bloquearia a leitura — gap real agora coberto. Recalc usa Admin SDK (`getAdminFirestore`, route l.83), que bypassa rules, então write:false não bloqueia o backend.
- **T-03:** `src/app/api/_lib/secret.ts` — `safeSecretEqual(expected, provided)`: retorna false se `expected===undefined || expected.length===0 || provided===null || provided.length===0`; depois `if (a.length !== b.length) return false`; só então `timingSafeEqual(a,b)`. Usado em `score/route.ts:60` e `recalc/route.ts:81` (ambos `safeSecretEqual(cronSecret, headerSecret)` com `SCORE_SECRET`/`RANKINGS_SECRET`).
- **T-04:** `recalc/route.ts:306-326` — `newPosition = geralPositionByUid.get(uid) ?? 1`; `last = prevHistory[len-1]`; `positionUnchanged = last && last.scope==="geral" && last.position===newPosition`; se unchanged → `positionHistory = prevHistory` (sem append); senão append `{at, scope:"geral", position:newPosition, round: prevMaxRound+1}`. `prevMaxRound` derivado do maior `round` existente (l.302-305) → incrementa só no append.
- **T-05:** `src/schemas/statistics.ts:47-50` `.refine((b)=>b.min<=b.max, …)` em `distributionBucketSchema`; l.66-69 `.refine((p)=>p.lowestPoints<=p.highestPoints, …)` em `poolStatsSchema`.
- **T-06:** `globals.css:246-255` — `.dark .palpites-theme, .dark .ranking-theme { --primary: oklch(0.72 0.16 150); --primary-foreground: oklch(0.205 0.02 150); --ring/--sidebar-primary: 0.72 }`; `.dark .ranking-theme { --chart-1: 0.72 }`. Blocos light (`.ranking-theme` l.232, `.palpites-theme` l.220) permanecem em 0.46 — light inalterado.
- **T-07:** `score/route.ts:19-34` `chainRecalc(request)`: `if (secret===undefined||secret.length===0) return;` → POST `new URL("/api/rankings/recalc", request.url)` com header `x-cron-secret`; `try/catch` apenas `console.warn` (não-fatal). Chamado em l.160 após gravar pontuação.
- **T-08:** `rtk tsc --noEmit` → "TypeScript compilation completed" (exit 0). `vitest run` nos 3 arquivos alvo → 3 files / 62 tests passed.

## 4. Test correlation
- `recalc/route.test.ts` (autorização 401/403, append/idempotência): l.328-343 grava `positionHistory` com `round===1`; l.346-366 **append preservando histórico + round incrementa (1→2)**; l.378 pool stats. Asserções sobre dados gravados reais (mock do Admin SDK retornando docs).
- `statistics.test.ts` (62 no conjunto, 28 deste arquivo): rejeita accuracy fora de 0–100, totalCorrect/totalWrong/count/totalParticipants negativos, scope/position/round inválidos, `.strict` campo extra. Asserções de valor real via `safeParse(...).success`.
- `score/route.test.ts`: cobre autorização por secret (`withSecret`) e fluxo de pontuação.

## 5. Out-of-scope drift
- Nenhum desvio funcional. `firestore.indexes.json` não foi tocado — coerente com o PLAN ("provável dispensável no doc-por-escopo"). O comentário do header da `firestore.rules` ainda diz "(TASK-08)" (l.3) — cosmético, não afeta comportamento.

## 6. Findings
- BLOCKER: nenhum.
- WARNING:
  - WV-01 (premissa do prompt incorreta — informativo): a afirmação "grep confirmed NO client code reads predictions collection directly" é FALSA. `src/services/predictions.ts:60` `listPredictionsByUid(uid)` lê `predictions where uid==uid` via Client SDK, consumida por 3 hooks `usePredictions` (home/matches/predictions). Verificado que TODOS os callers passam o uid da SESSÃO (`firebaseUser?.uid`, ex.: `useHomeDashboard.ts:58`, `MatchDetail.tsx:280`, `PredictionForm.tsx:147`) — logo a regra owner-only NÃO quebra nenhuma leitura legítima. A premissa estava errada, mas a conclusão (regra é compatível) se mantém.
  - WV-02 (cobertura de teste, menor): o caminho de dedup "posição inalterada → NÃO faz append" não tem teste dedicado (só o caminho de append+round é testado). E as `.refine` cross-field (min≤max, lowest≤highest) não têm asserção direta no `statistics.test.ts` (campos individuais sim). Lógica presente e type-correct; gap apenas de regressão.

## 7. Verdict: goal-achieved
