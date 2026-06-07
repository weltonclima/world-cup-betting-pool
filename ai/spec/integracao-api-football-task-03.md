# SPEC — TASK-03 · Constantes de cache + seleção de tier

> PRD: `ai/prd/integracao-api-football.md` · Plano: `ai/plan/integracao-api-football.md` (TASK-03)
> Entregáveis: `src/server/cache/tiers.ts`, `src/server/cache/__tests__/tiers.test.ts`, esta spec.

## 1. Objetivo

Centralizar, em **fonte única**, as faixas de cache da Copa definidas no PRD-07 e expor um
helper que escolhe a faixa (tier) correta para uma partida conforme seu `status` e data.

O mesmo módulo alimenta dois consumidores:

- **Servidor (Next.js):** `revalidate` em segundos (`fetch(..., { next: { revalidate } })`).
- **Client (React Query):** `staleTime` em milissegundos.

Para evitar números mágicos duplicados, `STALE_TIME` (ms) é **derivado** de `REVALIDATE` (s) `* 1000`.

## 2. Tabela de tiers (PRD-07)

| Tier            | Significado                                   | Segundos (`REVALIDATE`) | Milissegundos (`STALE_TIME`) |
|-----------------|-----------------------------------------------|-------------------------|------------------------------|
| `grupos`        | Composição dos grupos (estático)              | 86400 (24h)             | 86_400_000                   |
| `selecoes`      | Seleções participantes (estático)             | 86400 (24h)             | 86_400_000                   |
| `jogoFuturo`    | Partida agendada em outro dia                  | 21600 (6h)              | 21_600_000                   |
| `jogoDia`       | Partida agendada para hoje (UTC)               | 1800 (30min)            | 1_800_000                    |
| `jogoAoVivo`    | Partida em andamento                           | 60 (1min)               | 60_000                       |
| `jogoEncerrado` | Partida finalizada (janela quente, < 6h)       | 300 (5min)              | 300_000                      |

## 3. Regra de seleção — `revalidateForMatch(match, now)`

Retorna o valor de `revalidate` (segundos) adequado:

| `status`                  | Condição                                   | Tier escolhido            |
|---------------------------|--------------------------------------------|---------------------------|
| `live`                    | —                                          | `jogoAoVivo` (1min)       |
| `finished`                | `now - kickoffAt < 6h`                      | `jogoEncerrado` (5min)    |
| `finished`                | `now - kickoffAt >= 6h`                     | `jogoFuturo` (6h)         |
| `scheduled` / `postponed` | mesmo dia de `now` (UTC)                    | `jogoDia` (30min)         |
| `scheduled` / `postponed` | dia diferente de `now` (UTC)               | `jogoFuturo` (6h)         |
| `canceled`                | —                                          | `jogoFuturo` (6h)         |

`kickoffAt` é ISO 8601 (`isoDateTime`); convertido com `new Date(...)`. A diferença de
horas (janela quente) usa **date-fns** (`differenceInHours`). A comparação "mesmo dia" é
feita em **UTC** via helper próprio `isSameUtcDay` — ver decisão D2.

## 4. Decisões

### D1 — Regra "encerrado por 6h"
O PRD-07 define que uma partida recém-encerrada deve continuar sendo revalidada com
frequência (janela quente) para corrigir placares/ajustes pós-jogo, e depois "esfriar".
Implementação:
- `finished` **e** `(now - kickoffAt) < 6h` → `jogoEncerrado` (5min) — janela quente.
- `finished` **e** `(now - kickoffAt) >= 6h` → tier **longo**. **Escolha: `jogoFuturo` (6h)**.
  - Por quê `jogoFuturo`/6h e não 24h: uma partida já jogada não muda mais, mas usar 6h
    mantém o módulo enxuto (reaproveita um tier existente) e dá margem para correções
    tardias raras sem custo relevante de quota (a partida não é mais consultada com
    frequência pelos usuários). Evita criar um tier extra só para "encerrado frio".
  - A janela é medida a partir do `kickoffAt` (início do jogo). Como um jogo dura ~2h,
    a janela quente real após o apito final fica em torno de ~4h — suficiente para
    estabilizar o resultado oficial.

### D2 — "Mesmo dia" em UTC
O `isSameDay` do date-fns compara no fuso **local** do runtime, o que tornaria a decisão
dependente do timezone da máquina (e dos testes). Como o servidor roda em UTC e
`kickoffAt` já vem em UTC (ISO com `Z`), usa-se um helper próprio `isSameUtcDay` que
compara os componentes de data em UTC (`getUTCFullYear/Month/Date`). Determinístico e
independente do fuso do runner.

### D3 — Sem `server-only`
Embora o módulo viva em `src/server/`, ele é **importado também pelo client** (React
Query `staleTime`). Por isso **não** se adiciona `import "server-only"` — seria um falso
acoplamento e quebraria o consumo client. O conteúdo é puro (constantes + função pura),
sem segredos nem I/O, então é seguro no bundle client.

### D4 — Derivação ms a partir de s
`STALE_TIME` é construído programaticamente a partir de `REVALIDATE` (`Object.fromEntries`
+ `* 1000`), tipado para preservar as mesmas chaves. Não há número mágico de ms no código.

## 5. Casos de teste (`tiers.test.ts`)

Coerência das constantes:
- Cada chave de `STALE_TIME` == `REVALIDATE[chave] * 1000`.
- Mesmas chaves nos dois objetos.
- Valores absolutos do PRD (24h, 6h, 30min, 1min, 5min) batem.

`revalidateForMatch` — um teste por ramo:
1. `live` → `jogoAoVivo`.
2. `finished` há 2h (< 6h) → `jogoEncerrado`.
3. `finished` há 10h (>= 6h) → `jogoFuturo`.
4. `finished` exatamente 6h → `jogoFuturo` (limite: `< 6h` é janela quente, então 6h cai no frio).
5. `scheduled` hoje (mesmo dia UTC) → `jogoDia`.
6. `scheduled` em dia futuro → `jogoFuturo`.
7. `postponed` hoje → `jogoDia`; `postponed` outro dia → `jogoFuturo`.
8. `canceled` → `jogoFuturo`.
9. Aceita `Match` e `MatchWithId` (com `id`).

## 6. Riscos / notas
- Tier "ao vivo" (1min) é o mais sensível a quota da API-Football (PRD risco 2).
- Se o PRD futuramente exigir um tier "encerrado frio" distinto de 24h, basta adicionar
  a chave em `REVALIDATE` e ajustar o ramo `finished >= 6h` (mudança localizada).
