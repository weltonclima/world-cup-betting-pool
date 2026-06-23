# PRD — Otimização de custo de writes no cron de pontuação

- **Slug:** `scoring-write-cost`
- **Tipo:** otimização (performance / custo de infraestrutura)
- **Status:** draft (aguardando aprovação do checkpoint PRD)
- **Origem:** observação em sessão de diagnóstico do `score-cron` (GitHub Actions) — resposta estável `{"scoredMatches":44,"updatedPredictions":352}` revelou regravação total a cada run.
- **Área:** `src/app/api/predictions/score/route.ts` · coleção Firestore `predictions` · `score-cron.yml`

---

## 1. Contexto e problema

`POST /api/predictions/score` é disparado pelo cron a cada **30 min** (48×/dia). A cada execução ele:

1. Busca **todas** as partidas com `status === "finished"`.
2. Para cada partida, lê **todos** os palpites (`predictions where matchId ==`).
3. Recalcula `{ status, points }` com `scorePrediction` (função pura) e **regrava via `set merge` SEMPRE** — mesmo quando o valor não mudou (`route.ts:218`).

O design é **idempotente** de propósito, mas a regravação incondicional gera custo morto:

- **~352 writes/run × 48 runs/dia ≈ 17.000 writes/dia** desperdiçados no Firestore.
- **~352 reads/run × 48 ≈ 17.000 reads/dia** (também desperdiçados quando nada mudou).
- O número só cresce ao longo da Copa (mais partidas `finished`, mais palpites).

### Por que importa (driver de negócio)
O projeto roda no **Firebase Spark (free tier)**: limites de **20.000 writes/dia** e **50.000 reads/dia** por projeto. Os ~17k writes/dia do cron **já estão perigosamente perto do teto de writes** e somam com toda a escrita normal do app (palpites, perfis, notificações, rankings, pools). Risco real de estourar quota → `RESOURCE_EXHAUSTED` → app para de gravar.

### Sintoma observado
Resposta sempre `{"scoredMatches":44,"updatedPredictions":352}`: `updatedPredictions` conta **processados**, não **alterados**. Estável = saudável funcionalmente, mas mascara o desperdício.

---

## 2. Objetivos

- **O1.** Eliminar writes redundantes: não regravar um palpite cujo `{status, points}` já está correto.
- **O2.** Reduzir o pico diário de writes do cron de ~17k para um patamar proporcional a **mudanças reais** (próximo de 0 em runs sem partida nova/edição).
- **O3.** (Desejável) Reduzir também reads redundantes quando uma partida já foi totalmente pontuada e não mudou.
- **O4.** Preservar 100%: idempotência, efeitos best-effort (`notifyScoreHitsBestEffort`, `chainRecalc`) e a resposta `{ scoredMatches, updatedPredictions }`.

### Não-objetivos
- Não mudar a **regra de pontuação** (`scorePrediction` 10/5/0 permanece intacta).
- Não mudar o **agendamento** do cron (30 min).
- Não migrar de Firestore nem mexer em rankings/notificações além do encadeamento existente.
- Não alterar contrato de auth (`x-cron-secret` / sessão admin).

---

## 3. Soluções candidatas (decisão no checkpoint)

### Opção A — Skip write quando `{status, points}` não mudou *(recomendada, baixo risco)*
No loop por palpite, comparar o `{status, points}` já lido (`docSnap.data()`) com o recalculado; só chamar `set merge` se **diferente**.
- **Ganho:** elimina ~100% dos writes em runs sem mudança. Zero mudança de schema. Zero migração.
- **Custo:** ainda lê todos os palpites das partidas finished (reads permanecem).
- **Semântica de resposta:** decidir se `updatedPredictions` passa a contar **alterados** (mais honesto, mas muda o número observável) ou continua contando **processados** (compat 100%). → **questão aberta Q1.**
- **Cuidado:** comparação numérica robusta (`points` pode vir `number`; tratar `status` ausente vs definido).

### Opção B — Marcar partida pontuada (`scoredAt` / hash) e pular a partida inteira
Gravar em `matches/{id}` (ou doc de controle) um marcador após pontuar; no próximo run, pular partidas já pontuadas cujo placar/status não mudou.
- **Ganho:** elimina writes **e reads** da partida (não busca os palpites).
- **Custo:** +1 write por partida pontuada (amortizado); precisa de **invalidação** se o placar for corrigido depois (edição manual / re-sync). Risco de "partida corrigida não re-pontua" se a invalidação falhar.
- **Schema:** novo campo de controle.

### Opção C — Só pontuar partidas finished "recentes"
Filtrar finished por janela (ex.: encerradas nas últimas N horas).
- **Ganho:** reduz volume sem schema novo.
- **Risco alto:** partida corrigida fora da janela nunca re-pontua; depende de relógio/timezone; frágil. **Descartar como solução principal** (no máximo, complemento).

**DECISÃO TRAVADA (checkpoint):** adotar **A + B combinadas** — o objetivo do usuário é cortar **leitura E escrita**. A vira o "filtro fino" (por palpite); B vira o "filtro grosso" (pula a partida inteira, evitando os reads).

### Desenho de B (refinado pela análise de código)
Dois fatos sustentam a segurança de B:
1. **Palpites travam no kickoff** (`isPredictionLocked` → `true` quando o jogo começa). Uma partida `finished` **nunca** recebe palpite novo; só muda se o **placar for corrigido**.
2. As partidas vêm de **fetch externo** (ESPN/openfootball via `matchSource`/`copaData`), **não** de reads do Firestore. O custo Firestore está **exclusivamente** na coleção `predictions`.

Mecanismo:
- **Doc de controle único** `score_state/cron` (coleção nova, write `if false` nas rules → só Admin SDK): mapa `{ [matchId]: resultHash }`, onde `resultHash` = fingerprint de `{ status, homeScore, awayScore }` da partida.
- Cada run: **1 read** do doc de controle.
- Para cada partida `finished`: se `controle[matchId] === resultHash` → **pula tudo** (nenhuma query de palpites, nenhum write).
- Senão (nova ou placar corrigido) → query palpites → pontua → grava só os que mudaram (**Opção A por dentro**) → atualiza `controle[matchId] = resultHash`.
- Ao final: **1 write** do doc de controle (só se houve mudança).

**Regime estável:** ~**1 read + 0 writes** por run (vs ~352 + 352). Correção de placar invalida o hash → re-pontua só aquela partida.

---

## 4. Requisitos funcionais

- **RF1.** Para cada palpite de partida finished, o endpoint só executa `set merge` quando o `{status, points}` recalculado **difere** do persistido.
- **RF2.** A pontuação resultante de qualquer palpite é **idêntica** à do comportamento atual (mesma regra `scorePrediction`).
- **RF3.** Palpite sem `{status, points}` ainda persistido (primeira pontuação) **sempre** é gravado.
- **RF4.** Docs malformados continuam logados e ignorados (`route.ts:204-212`), sem virar write.
- **RF5.** Efeitos best-effort permanecem: candidatos a notificação `games` continuam derivados de `correct`/`partial` **independente de ter havido write** (um acerto já pontuado não deve re-notificar — `writeNotifications` já dedup por id; confirmar que skip de write não muda o conjunto de `hits` de forma indesejada). → **questão aberta Q2.**
- **RF6.** `chainRecalc` continua sendo chamado (recalc é barato e tem fallback próprio).
- **RF7.** Resposta mantém shape `{ scoredMatches, updatedPredictions }` (semântica de `updatedPredictions` → Q1).

## 5. Requisitos não-funcionais

- **RNF1.** Idempotência preservada: rodar N vezes seguidas converge e não gera writes após a 1ª.
- **RNF2.** Sem regressão de performance: a comparação extra é O(1) por palpite, em memória.
- **RNF3.** Cobertura de testes: casos unchanged (sem write), changed (com write), first-score (com write), malformado (ignorado).
- **RNF4.** Observabilidade: opcional logar contagem de writes evitados por run (sem dado sensível).

---

## 6. Critérios de aceite

- **CA1.** Run sem nenhuma mudança de placar/palpite ⇒ **0 writes** na coleção `predictions` (verificável por contador interno/teste).
- **CA2.** Novo palpite em partida finished ⇒ exatamente os writes necessários (só os novos/alterados).
- **CA3.** Correção de placar de uma partida ⇒ todos os palpites afetados são regravados na próxima run.
- **CA4.** Testes existentes de scoring/notificações continuam verdes (`route.test.ts`, `route.notifications.test.ts`).
- **CA5.** Resposta HTTP continua 200 com `{ scoredMatches, updatedPredictions }`.

---

## 7. Riscos e mitigações

| Risco | Sev | Mitigação |
|---|---|---|
| Comparação errada → palpite legítimo não regrava | Alta | Testes de igualdade explícitos; tratar `status` undefined; comparar `points` numérico estrito. |
| Skip de write some com `hit` de notificação esperado | Média | Q2: manter coleta de `hits` independente do write; confiar na dedup de `writeNotifications`. |
| Opção B: placar corrigido fora de invalidação não re-pontua | Alta | Se adotar B, invalidar por hash de `{status,homeScore,awayScore}` da partida, não por flag booleana. |
| Mudança de semântica de `updatedPredictions` quebra expectativa externa | Baixa | Q1: decidir contrato; ninguém externo consome além do log do cron. |

---

## 8. Métricas de sucesso

- **Writes/dia** do cron: de **~17.000** → **~0–100** em operação estável (só mudanças reais + doc de controle).
- **Reads/dia** do cron: de **~17.000** → **~48** (1 read do doc de controle por run) em regime estável.
- Margem de quota Spark recuperada nos **dois** eixos (teto 20k writes/dia, 50k reads/dia).
- `0` regressões nos testes de pontuação e notificações.

---

## 9. Questões — RESOLVIDAS no checkpoint

- **Q1.** `updatedPredictions` passa a contar **alterados** (decisão: mais honesto; vira termômetro do ganho no log do cron). Adicionar opcionalmente `skippedMatches` à resposta para observabilidade do filtro grosso.
- **Q2.** Notificação `games`: partida **pulada** (já pontuada) **não** re-coleta `hits` → **não** re-notifica. Isso é o comportamento desejado (acerto já foi notificado no run que de fato pontuou). `writeNotifications` mantém dedup como segunda barreira. **Sem ação extra.**
- **Q3.** Escopo: **A + B combinadas** (cortar reads e writes). Doc de controle `score_state/cron`.

---

## 10. Escopo de implementação (preliminar — detalhado no /plan)

Provavelmente **2–3 tasks** (api/persistence, criticidade média, risco baixo):
- **Filtro fino (A):** em `processMatch`, comparar `{status, points}` lido vs recalculado; só `set merge` se diferente.
- **Filtro grosso (B):** doc de controle `score_state/cron` (read 1× no início, fingerprint por partida, write 1× no fim); pular query de palpites de partida com hash inalterado.
- **Rules + observabilidade:** `score_state` write `if false` (Admin SDK only) em `firestore.rules`; resposta passa a contar `updatedPredictions` (alterados) e opcional `skippedMatches`.
- Testes: unchanged (0 writes), changed (writes só nos alterados), partida pulada (0 reads de palpites), placar corrigido (re-pontua), malformado (ignorado), idempotência.
- Sem migração de dados (doc de controle nasce vazio; 1º run popula).
