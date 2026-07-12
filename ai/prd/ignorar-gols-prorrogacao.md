# PRD — Ignorar gols de prorrogação nas eliminatórias (config por grupo)

## 1. Resumo da feature
Adicionar uma configuração por grupo (pool) que, quando habilitada, faz a
**pontuação dos palpites nas fases eliminatórias** desconsiderar os gols marcados
na **prorrogação** — comparando o palpite contra o **placar do tempo normal
(90 min + acréscimos)** em vez do placar final. O placar de 90min é
**reconstruído automaticamente** a partir dos dados de gol-a-gol da ESPN
(array `details`), sem edição manual.

Escopo confirmado com o usuário: **apenas** o critério de prorrogação. O toggle de
"ignorar pênaltis" foi **descartado** — os pênaltis (shootout) já são, por
invariante do sistema, sempre separados de `homeScore/awayScore` e nunca entram
na comparação de placar do palpite. Nada muda nesse aspecto.

## 2. Escopo consolidado
- **Nova flag de pool** `ignoreOvertimeGoals` (nome final a definir no plano/spec),
  booleana, opcional, default `false` na leitura — seguindo exatamente o padrão de
  `splitPhaseRanking`/`predictionsLocked` (`src/schemas/pools.ts`).
- **Persistência/edição** via `PATCH /api/group/settings` + um `Switch` em
  `GroupSettingsForm.tsx`, só para `group_admin`/`super_admin`.
- **Placar regulamentar (90min)** derivado no servidor a partir do array `details`
  da ESPN: somar os gols de cada lado com minuto ≤ fim do tempo normal, excluindo
  gols de prorrogação e de disputa de pênaltis (`shootout`).
- **Pontuação**: quando a flag do pool está ligada, para partidas de **mata-mata**
  (`stage !== "grupos"`) que foram à prorrogação, `scorePrediction` compara o
  palpite contra o placar de 90min. Fora disso (flag off, fase de grupos, ou jogo
  sem prorrogação), o comportamento é idêntico ao atual.
- Efeito só se materializa no **recálculo** do ranking (`recalc.ts`) após ligar a
  flag; é retroativo para os jogos já finalizados quando recalculado.

## 3. Entendimento do sistema relevante
- **Pontuação (função pura):** `src/features/predictions/lib/predictionsHelpers.ts:138`
  (`scorePrediction`) compara `prediction.homeScore/awayScore` contra
  `match.homeScore/awayScore` (placar FINAL). Pênaltis nunca entram (invariante).
  Consumida no recálculo agregado em `src/server/rankings/recalc.ts` (loop de
  agregação por usuário/escopo) e no `recalcPoolRanking` (escopo por pool).
- **Modelo de partida:** `src/schemas/matches.ts` — só há `homeScore/awayScore`
  (final), `homeShootout/awayShootout` (pênaltis, separados) e `outcome`
  (`"normal"|"overtime"|"penalties"`, rótulo). **Não existe placar de 90min.**
- **Fonte ESPN:** `src/server/copaData/espn{Types,Mapper,Client}.ts`. O
  `espnCompetitorSchema` só mapeia `score` (final) e `shootoutScore`. O array
  `details` (gols individuais com `clock`, `scoringPlay`, `shootout`,
  `penaltyKick`, `ownGoal`, `team.id`) **existe no payload mas NÃO é mapeado
  hoje** (cai no `.passthrough()`). É a fonte para reconstruir o placar de 90min.
- **Config de pool:** `src/schemas/pools.ts` (`poolSchema`/`poolEditSchema`),
  `src/app/api/group/settings/route.ts` (`settingsSchema` + montagem do patch),
  `src/features/groupAdmin/components/GroupSettingsForm.tsx` (bloco `Switch`).
  Precedente exato: `splitPhaseRanking`. **Porém**: nenhuma flag de pool hoje é
  lida DENTRO de `recalc.ts`/`scorePrediction` — todas as flags atuais são de
  exibição. Esta seria a **primeira flag de pool que entra no pipeline de
  pontuação**.

## 4. Análise de impacto técnico
- **Schema/ESPN (persistência do dado novo):**
  - Mapear `details` no `espnTypes.ts` (novo sub-schema de evento de gol).
  - Derivar, no `espnMapper.ts`, o placar regulamentar por lado e persistir em
    **novos campos** de `matchSchema` (ex.: `homeScoreRegulation`/
    `awayScoreRegulation`), opcionais, só em jogos de mata-mata finalizados com
    prorrogação. Aditivos (não quebram parse de docs/base sem eles).
  - **Corrigir a detecção de prorrogação:** `mapOutcome` hoje só reconhece
    `"STATUS_OVERTIME"`, mas a ESPN real (dados 2026) usa **`STATUS_FINAL_AET`**.
    Sem corrigir, jogos de prorrogação são classificados como `"normal"` e a
    feature não dispara. **Bug pré-existente** que esta feature precisa sanar.
- **Pontuação:** `scorePrediction` passa a receber um parâmetro/contexto opcional
  (flag do pool + placar regulamentar do match) e, quando aplicável, compara
  contra o placar de 90min. Manter função pura e default = comportamento atual.
- **Recálculo:** `recalc.ts` precisa ler a flag do pool (já tem o pool em escopo
  no `recalcPoolRanking`) e repassá-la ao `scorePrediction`. Aplicar só a
  mata-mata.
- **Config de pool:** aditivos em `poolSchema`, `poolEditSchema`,
  `settingsSchema` (route), patch do PATCH e um `Switch` no form. Baixo risco
  (padrão consolidado).
- **UI de resultado (secundário):** telas que exibem placar/breakdown podem, no
  futuro, sinalizar "placar considerado: 90min". Fora do escopo mínimo, mas anotar.

## 5. Riscos
- **Reconstrução do placar de 90min (principal):** depende de interpretar o
  `clock` dos gols no `details`. Evidência dos dados 2026: gols de acréscimo têm
  `clock` "travado" no limite do período (ex.: gol aos "45'+2'" vem com
  `clock=2700s`=45min), e gols de prorrogação aparecem a partir de 91' — então o
  corte `clock ≤ 5400s (90min)` = tempo normal parece confiável. **Risco:** amostra
  pequena (2 jogos); casos de borda a validar: gol contra (`ownGoal` — a quem
  creditar), pênalti DENTRO dos 90min (`penaltyKick=true` mas `shootout=false` →
  conta), jogos sem `details` disponível, e a hipótese do "cap" de acréscimo.
- **`details` ausente/atrasado:** se a ESPN não trouxer `details` para um jogo, não
  há como reconstruir 90min → fallback seguro = usar placar final (comportamento
  atual) e não travar a pontuação.
- **Primeira flag de pool no pipeline de scoring:** aumenta o acoplamento
  `recalc → pool flags → scorePrediction`. Precisa manter `scorePrediction` puro
  e testável (flag/placar via parâmetro, não fetch interno).
- **Retroatividade:** ligar a flag muda posições no ranking no próximo recálculo.
  Esperado, mas comunicar. Sem migração de dados.
- **Bug do `STATUS_FINAL_AET`:** ao corrigir `mapOutcome`, jogos já classificados
  como `"normal"` passam a `"overtime"` — verificar que nada mais depende do valor
  antigo incorreto (ex.: exibição de bracket).

## 6. Ambiguidades e lacunas
1. **Fonte do placar de 90min:** confirmado = **automático via `details` da ESPN**
   (não manual). O algoritmo exato de corte (por `clock.value` vs. parse de
   `displayValue` "90'+X'") fica para o spec — ambos viáveis; recomendação: usar
   `clock.value ≤ 5400` com verificação por `displayValue` como reforço.
2. **Gol contra na reconstrução:** definir no spec a quem creditar `ownGoal`
   (na ESPN, `team.id` do detalhe normalmente é o time que se beneficia — validar).
3. **Nome dos campos/flag:** `ignoreOvertimeGoals` (pool) e
   `homeScoreRegulation/awayScoreRegulation` (match) — sujeitos a ajuste no plano.
4. **Escopo "eliminatórias":** aplicar quando `stage !== "grupos"`. Fase de grupos
   nunca tem prorrogação, então o corte é naturalmente inócuo lá, mas gatear por
   stage evita processamento desnecessário.

## 7. Recomendações para o planejamento
- Quebrar em tarefas independentes, provável sequência:
  1. **Dados ESPN:** mapear `details` + corrigir `mapOutcome` (AET) + derivar e
     persistir placar regulamentar (`matchSchema`). Tipo integration/persistence,
     TDD sim (parsing + casos de borda).
  2. **Config de pool:** flag em schema + route + form (padrão `splitPhaseRanking`).
     Tipo api/domain, TDD parcial.
  3. **Pontuação:** `scorePrediction` + `recalc.ts` passam a considerar o placar
     regulamentar quando a flag do pool está ligada e o jogo é de mata-mata. Tipo
     domain, criticidade alta (mexe no núcleo de pontuação), TDD obrigatório.
- Manter `scorePrediction` **puro**: recebe placar-a-usar + flag por parâmetro.
- Fallback seguro sempre que o placar de 90min não existir → placar final.
- Sem migração; efeito no próximo recálculo.
