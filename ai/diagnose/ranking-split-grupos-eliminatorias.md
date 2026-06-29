# DIAGNOSIS — Ranking não separa fase de grupos da eliminatória

## 1. Bug summary
- **Título:** US — dividir ranking da fase de grupos e da fase eliminatória.
- **Reportado:** estamos na fase eliminatória, mas o ranking principal "ainda
  contabiliza os pontos da fase de grupos".

## 2. Root cause
**Não é defeito de código — é comportamento by-design + lacuna de produto.**

O ranking principal (Tela 01, `/rankings`) exibe o escopo **`geral`**, que por
projeto soma **TODOS** os pontos ponderados de **todas as fases** (grupos +
mata-mata) em `pointsGeral`:

- `recalc.ts:279` → `agg.pointsGeral += points` para **toda** prediction
  finalizada, sem filtrar `match.stage`.
- O doc `pool-{poolId}-geral` (`recalc.ts:791,829`) é gravado com esse total
  acumulado.
- `GeneralRanking.tsx:115` consome `usePoolRanking()` → `pool-{poolId}-geral`.

Ou seja: o "geral" é cumulativo de propósito. Na fase eliminatória ele continua
mostrando os pontos da fase de grupos somados — exatamente o sintoma relatado.

**A separação já existe**, mas em outra tela (`/rankings/phase`, `PhaseRanking`):
- escopo `grupos` → ranking só da fase de grupos;
- escopo `eliminatorias` (agregado das 5 fases mata-mata, incl. dezesseis-avos)
  → ranking só do mata-mata (`recalc.ts:484-525`);
- escopos por fase: `oitavas`/`quartas`/`semifinal`/`final`.

Logo, o dado "ranking só do mata-mata" **já é calculado e persistido**
(`pool-{poolId}-eliminatorias`). O que falta é decisão de **qual ranking é o
principal** durante a fase eliminatória.

## 3. Affected code
- `src/server/rankings/recalc.ts`
  - `:279` soma `pointsGeral` sem filtro de fase (origem do total cumulativo).
  - `:441-482` escopos por fase (`grupos`, `oitavas`...).
  - `:484-525` agregado `eliminatorias` (knockout-only) — **já existe**.
  - `:791,829` grava `pool-{poolId}-geral` (cumulativo).
- `src/features/rankings/components/GeneralRanking.tsx:115` — Tela 01 lê `geral`.
- `src/features/rankings/components/PhaseRanking.tsx:40-46` — cards de fase/agregado.
- `src/app/api/rankings/[scope]/route.ts` — serve qualquer escopo.

## 4. Reproduction path
`/rankings` → `GeneralRanking` → `usePoolRanking(groupId)` →
`GET /api/rankings/pool` → doc `pool-{poolId}-geral` → `entries[].points` =
`pointsGeral` (grupos + mata-mata somados) → exibido como ranking principal.

## 5. Blast radius
`pool-{poolId}-geral` (escopo `geral`) é consumido em **3 lugares**:
- `GeneralRanking.tsx` (Tela 01 `/rankings`).
- `useHomeDashboard.ts:69` — **hero/percentil da Home** depende do geral.
- `ParticipantProfile.tsx:73` — perfil do participante.

⚠️ Mudar a semântica do `geral` (ex.: zerar pontos de grupos na eliminatória)
**afeta Home e Perfil juntos**, não só `/rankings`. Por isso a direção do fix
precisa de decisão antes de tocar código.

## 6. Risk level
**Medium** — sem defeito, mas mudança de produto que pode tocar 3 telas +
recalc. Risco depende da direção escolhida (ver §7).

## 7. Recommended fix direction (a decidir com o usuário)
Três interpretações possíveis da US:

- **A) Tela principal vira phase-aware (recomendado):** durante a fase
  eliminatória, `/rankings` mostra o ranking `eliminatorias` (mata-mata, já
  pronto) como principal; grupos viram histórico em `/rankings/phase`. Menor
  risco — reusa dado existente, não muda semântica do `geral`. Decidir se Home/
  Perfil acompanham.
- **B) Redefinir `geral` como knockout-only na fase atual:** alto acoplamento —
  muda Home, Perfil e Tela 01 ao mesmo tempo; mexe em `recalc.ts:279`.
- **C) Só dar destaque/atalho** ao ranking de eliminatórias já existente
  (mínimo): nenhuma mudança de pontuação, só navegação/UX.

**Pendência:** qual o comportamento-alvo? E em quais telas (só `/rankings` ou
também Home/Perfil)?
