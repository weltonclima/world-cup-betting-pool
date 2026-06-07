# REVIEW — TASK-03 · Constantes de cache + seleção de tier

> Commit: `0493352` · Spec: `ai/spec/integracao-api-football-task-03.md` · Plano: `ai/plan/integracao-api-football.md` (TASK-03)
> Revisão adversarial (stance FORCE) · READ-ONLY · Idioma: pt-BR

## 1. Objetivo da revisão

Confirmar a fonte única de faixas de cache (PRD-07) em segundos (`REVALIDATE`, p/ Next) com espelho derivado em ms (`STALE_TIME`, p/ React Query), e o helper `revalidateForMatch(match, now)` que escolhe o tier por status/data. Validar a correção da seleção de tier (live/finished janela quente/scheduled/postponed/canceled), determinismo (UTC) e cobertura de testes.

## 2. Evidências coletadas

- `REVALIDATE`: grupos/selecoes 24h, jogoFuturo 6h, jogoDia 30min, jogoAoVivo 1min, jogoEncerrado 5min — batem com PRD-07 e com a spec §2.
- `STALE_TIME` derivado via `Object.fromEntries(keys.map(k => [k, REVALIDATE[k]*1000]))`, tipado como `Record<CacheTier, number>` — sem números mágicos de ms duplicados (D4). Testes verificam mesmas chaves e `*1000`.
- `revalidateForMatch`: `live → jogoAoVivo`; `finished` com `differenceInHours(now,kickoff) < 6` → `jogoEncerrado`, senão `jogoFuturo`; `scheduled`/`postponed` mesmo dia UTC → `jogoDia`, senão `jogoFuturo`; `canceled → jogoFuturo`. Casa com a tabela da spec §3.
- "Mesmo dia" via helper próprio `isSameUtcDay` (componentes UTC) — independente do fuso do runner (D2). Correto.
- `switch` sobre `match.status` é exaustivo sobre `matchStatusSchema` (5 estados); TS aceita sem `default` porque cobre a união — função retorna em todos os ramos. tsc exit 0.
- Sem `import "server-only"` (D3) — correto, pois o módulo é consumido também no client (staleTime); conteúdo puro, sem segredo.
- `npx vitest run src/server` (JSON): 100/100; os 17 testes de `tiers.test.ts` verdes, incluindo o limite "exatamente 6h → jogoFuturo" e aceitação de `Match` sem `id`.

## 3. Achados

Nenhum BLOCKER. Nenhum WARNING acionável.

### Notas (informativas)

- **N-01 (edge case benigno):** Se `now < kickoffAt` para um jogo `finished` (dado inconsistente / clock skew), `differenceInHours` retorna negativo → `< 6` → cai em `jogoEncerrado` (janela quente). Comportamento conservador (revalida mais cedo), sem risco de correção; não justifica guarda extra.
- **N-02 (truncamento aceito):** `differenceInHours` trunca para inteiro; um jogo encerrado há 6h59m conta como 6 → `>= 6` → `jogoFuturo`. Coerente com a intenção da spec (~4h de janela quente real após o apito, dada a duração ~2h). OK.
- **N-03 (tier "encerrado frio" reusa jogoFuturo):** Decisão D1 documentada — `finished >= 6h` reaproveita `jogoFuturo` (6h) em vez de 24h, para manter o módulo enxuto e dar margem a correções tardias raras. Trade-off de quota explicitado e aceitável p/ <100 usuários.
- **N-04 (segurança — OK):** Módulo puro, sem I/O, sem segredos, sem `any`. `new Date(match.kickoffAt)` sobre string já validada por `isoDateTime` upstream (mapper). Sem superfície de ataque.

## 4. Verdict

**approved**

Fonte única correta (s↔ms derivado), seleção de tier por status/data correta e determinística em UTC, `switch` exaustivo, sem `server-only` (consumo client intencional), 17/17 testes cobrindo todos os ramos + limites, tsc limpo. Escopo cumprido exatamente.
