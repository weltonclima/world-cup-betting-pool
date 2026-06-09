# REVIEW — TASK-14 (Firestore Rules + dark-mode token + carry-forwards) — infra/security

**Depth:** adversarial + SECURITY focus · **Files:** firestore.rules, _lib/secret.ts, score/route.ts, recalc/route.ts, schemas/statistics.ts, globals.css · **Status:** issues_found (2 WARNING; 0 BLOCKER)

## Summary
Pass de segurança sólido. Rules: `predictions` read agora owner-only (`isApproved() && (isOwner(resource.data.uid) || isAdmin())`) implementando A5=PRIVADO, write `if false`; `rankings`/`statistics`/`pool_stats` read-approved/write-false com `match pool_stats` adicionado (gap real — Tela 06 lê `pool_stats/current`). Comparação de secret constante-no-tempo e length-safe nos dois endpoints. `chainRecalc` best-effort, guardado por `RANKINGS_SECRET`. Dedup de `positionHistory` por posição. Tokens dark AA para os temas verdes. tsc 0, 62/62 testes alvo verdes.

## Critical Issues
Nenhum.

## Security Review (adversarial)

### Rules — bypass?
- **predictions read:** `resource.data.uid` é a forma correta para `get` E `list` no Firestore (em `list`, a regra é avaliada por documento candidato — `resource.data` refere-se a cada doc; uma query `where("uid","==",own)` satisfaz a regra, e tentar listar sem o filtro de uid faz a query inteira falhar). Sem bypass. Owner-only + admin é exatamente A5.
- **Não quebra leitura legítima:** confirmado que todo client read de `predictions` passa pelo `listPredictionsByUid(uid)` com uid de sessão (3 hooks `usePredictions`, callers usam `firebaseUser?.uid`). NENHUM caller passa uid de terceiro. (Nota: a premissa do prompt de que "nenhum client lê predictions" é factualmente incorreta — o client LÊ, mas sempre o próprio uid; a regra continua compatível.)
- **write:false correto** dado que recalc/score usam Admin SDK (`getAdminFirestore`), que bypassa rules por design. Cliente jamais escreve pontuação — atende ao critério de aceite do PRD-05.
- **Exposição de coleções:** nenhuma sub/super-exposta. `bonus_predictions` permanece com read amplo por `approved` (fora do escopo desta task; A5 cobre só `predictions` no contrato). `rankings/statistics/pool_stats` expõem apenas dados derivados desnormalizados (nickname/name/pontos) — comparação social intencional, sem PII sensível.
- **Deny-by-default** (l.103-105) mantido como afirmação explícita; helper `getUserData()` curto-circuita em `isSignedIn()` (get() nunca roda anônimo).

### Secrets — constante-no-tempo / length-safe?
- `safeSecretEqual` retorna false ANTES de qualquer `timingSafeEqual` quando `expected` é undefined/vazio → **um env secret vazio NUNCA autoriza** (fecha o buraco clássico "secret não setado em prod = bypass"). Provided null/vazio idem.
- `timingSafeEqual` exige buffers de mesmo tamanho; o guard `a.length !== b.length → false` evita o throw. Tecnicamente o early-return por tamanho vaza o comprimento do secret via timing — irrelevante na prática (secret de tamanho fixo, alvo <100 users, sem oráculo explorável). Aceitável.

### chainRecalc — SSRF / loop?
- POST para `new URL("/api/rankings/recalc", request.url)` — host derivado do próprio request; não há input de usuário no destino → **sem SSRF** (não dá pra redirecionar para host arbitrário). Não há recursão: recalc NÃO chama score de volta → **sem loop**.
- Corretamente **não-fatal** (`try/catch`+`console.warn`) e **pulado quando `RANKINGS_SECRET` ausente/vazio** → testes e deploys score-only não quebram. O recalc também roda no cron como fallback (documentado).

### Dedup — pode descartar snapshot necessário?
- Dedup é **baseado em POSIÇÃO** (intenção declarada = "evolução" de posição na Tela 04). Se os PONTOS mudarem mas a posição permanecer idêntica, nenhum snapshot é gravado. Para o gráfico de evolução de posição isso é correto e desejável (evita poluição e crescimento ilimitado). É um WARNING leve só se o produto algum dia quiser plotar pontos-por-rodada — hoje não é o caso. Alinhado ao WR-02 da TASK-03.

## Warnings

### WR-01 (informativo, P3): premissa "nenhum client lê predictions" é incorreta
**Issue:** O client LÊ `predictions` via `listPredictionsByUid` (services/predictions.ts:60), em 3 hooks. **Não é bug** — todos passam o uid de sessão, então a regra owner-only é compatível. Registrado para a base de conhecimento (a afirmação do prompt estava errada; a decisão de segurança permanece correta).

### WR-02 (cobertura de teste, P3, menor): caminhos sem asserção direta
**Issue:** (a) dedup "posição inalterada → não faz append" não tem teste dedicado (só append+round); (b) as `.refine` cross-field (min≤max, lowest≤highest) não têm teste negativo direto em `statistics.test.ts`. Lógica presente, type-correct e não-bloqueante.
**Fix sugerido (nice-to-have):** 2 testes — um recalc com posição estável assertando `positionHistory.length` constante; um `safeParse` com `min>max`/`lowest>highest` esperando `success===false`.

## Build health
- `rtk tsc --noEmit` → "TypeScript compilation completed" (0 erros).
- `vitest run` (score, recalc, statistics) → **3 files / 62 tests passed**.

## Verdict: approved with adjustments

Segurança correta e completa: A5=PRIVADO aplicado (owner-only read), write travado, secret constante-no-tempo e à prova de env-vazio nos dois endpoints, chainRecalc sem SSRF/loop e degradável, dedup coerente com a intenção de evolução, tokens dark AA. Nenhum bloqueador. Ajustes sugeridos são apenas cobertura de teste (WR-02) e correção da premissa do prompt (WR-01). Cosmético: header da `firestore.rules` ainda rotula "(TASK-08)".
