# PRD — Notificações: Disparos Automáticos

> **PRD-15** | Branch: `feat/notifications-triggers`

---

## 1. Feature Summary

O sistema de notificações existe na UI (lista, detalhe, preferências, sino com badge) e no Firestore (`notifications`, `notificationPreferences`), mas **só 4 eventos de moderação disparam notificações** (aprovação/rejeição/bloqueio/reativação de conta). Os tipos `games` e `ranking` nunca são disparados. O tipo `pool` (bolão) **será removido**.

Objetivo: **disparos automáticos**. Quando um jogo encerra e é pontuado, o usuário recebe notificação ("você acertou o placar / o vencedor / o empate"). Quando o recálculo muda a posição do usuário no ranking, ele recebe notificação. Sem clique manual no caminho feliz.

Três mudanças centrais:
1. **Remover o tipo `pool`** — schema, preferências e UI passam a ter só Sistema, Jogos, Ranking.
2. **Disparo automático server-side** — notificações criadas como efeito do scoring (jogos) e do recalc (ranking), via Admin SDK nos Route Handlers.
3. **Pré-requisito de automação** — hoje não há scheduler disparando scoring/recalc. Sem ele, "automático" não acontece. Esta feature inclui configurar o gatilho periódico.

Também corrige um **bug silencioso**: notificações de moderação criadas client-side por group_admin são bloqueadas pelas Firestore Rules (write denied), perdendo-se sem erro visível.

---

## 1.1 Catálogo completo de notificações

Três categorias finais: **Sistema**, **Jogos**, **Ranking** (tipo `pool`/bolão removido).

### 🛡️ SISTEMA (conta + moderação)
Disparo: ação do admin. **Sempre entregue** — ignora preferência `system` (status de conta é crítico).

| # | Evento | Trigger | Mensagem |
|---|---|---|---|
| S1 | Cadastro aprovado | `pending → approved` | "Cadastro aprovado — Bem-vindo ao Bolão dos Parças! Já pode registrar seus palpites." |
| S2 | Cadastro não aprovado | `pending → blocked` | "Seu cadastro não foi aprovado pelo administrador." |
| S3 | Conta bloqueada | `approved → blocked` | "Sua conta foi bloqueada. Entre em contato com o administrador." |
| S4 | Conta reativada | `blocked → approved` | "Sua conta foi reativada. Você já pode acessar o bolão novamente." |
| S5 | *(opcional)* Promovido a admin do grupo | `promote` | "Você agora é administrador do bolão {nome}." |
| S6 | *(opcional)* Atribuído a um bolão | assign group | "Você foi adicionado ao bolão {nome}." |

### ⚽ JOGOS (pontuação — automático ao encerrar jogo)
Disparo: scoring após jogo `finished`. Respeita preferência `games`. **Só notifica acerto** (erro não gera notificação — evita ruído negativo).

| # | Resultado | Pts | Mensagem |
|---|---|---|---|
| J1 | Acertou placar exato (`correct`) | +10 | "🎯 Você acertou o placar! +10 pts em {timeA} x {timeB}" |
| J2 | Acertou o vencedor (`partial`, não-empate) | +5 | "✅ Você acertou o vencedor! +5 pts em {timeA} x {timeB}" |
| J3 | Acertou o empate (`partial`, palpite empate) | +5 | "🤝 Você acertou o empate! +5 pts em {timeA} x {timeB}" |

### 📈 RANKING (mudança de posição — automático após recalc)
Disparo: recalc após scoring. Respeita preferência `ranking`. **Só notifica subida** (queda/igual não notifica).

| # | Evento | Mensagem |
|---|---|---|
| R1 | Subiu de posição | "📈 Você subiu para {N}º no ranking!" |
| R2 | Entrou no top 3 (pódio) | "🏆 Você está no pódio! {N}º lugar" |

**Totais:** 4 Sistema (+2 opcionais) · 3 Jogos · 2 Ranking.

**Princípios de copy:**
- Não notificar erro de palpite nem queda de posição (sem spam negativo).
- Mensagens de Jogos reusam os rótulos da tela de palpites (`acertou` / `acertou_vencedor` / `acertou_empate`) para consistência.
- Idempotência por ID determinístico: 1 notificação por jogo (`games-{uid}-{matchId}`), 1 subida por dia (`ranking-{uid}-{dateKey}`).

---

## 2. Consolidated Scope

### 2.1 Remoção do tipo `pool` (bolão)

`notificationType` hoje = `"system" | "games" | "ranking" | "pool"`. Remover `"pool"`:
- **Schema** (`src/schemas/notifications.ts`, `notificationPreferences.ts`) — tirar `pool` do enum e do objeto de preferências.
- **UI filtros** (`NotificationFilters.tsx`) — remover a pill "Bolão".
- **Preferências** (`PreferencesForm.tsx`) — remover o toggle "Bolão".
- **Meta** (`notificationMeta.ts`) — remover entrada `pool`.
- **Dados legados:** se houver docs `type: "pool"` no Firestore (improvável — nunca foi disparado), a lista filtra por tipos conhecidos; docs órfãos não quebram. Sem migração de dados necessária.

Tipos finais: `"system" | "games" | "ranking"`.

### 2.2 Disparo automático — `games` (pontuação de palpites)

**Gatilho:** `POST /api/predictions/score` — após pontuar cada palpite de um jogo `finished`.

A pontuação já é ponderada (`scorePrediction` em `predictionsHelpers.ts`):
- placar exato → `correct`, **10 pts**
- acertou o resultado (vencedor real ou empate) sem placar exato → `partial`, **5 pts**
- errou → `wrong`, 0 pts

**Notificação por palpite pontuado** (tipo `games`):

| Resultado | Notificação |
|---|---|
| `correct` (placar exato) | "Você acertou o placar! 🎯 +10 pts em {timeA} x {timeB}" |
| `partial` + palpite não-empate | "Você acertou o vencedor! +5 pts em {timeA} x {timeB}" |
| `partial` + palpite empate | "Você acertou o empate! +5 pts em {timeA} x {timeB}" |
| `wrong` | **sem notificação** (não notifica erro — evita ruído) |

**Granularidade:** uma notificação por palpite acertado por jogo. Idempotente — re-rodar o scoring não duplica (ID determinístico `games-{uid}-{matchId}`).

### 2.3 Disparo automático — `ranking` (mudança de posição)

**Gatilho:** `POST /api/rankings/recalc` e `POST /api/group/rankings/recalc` — após `recalcRankings()` persistir as novas posições.

`recalcRankings` já mantém `positionHistory` por usuário (fonte do delta). Após o recalc, comparar posição anterior vs nova:

| Condição | Notificação (tipo `ranking`) |
|---|---|
| Posição melhorou (subiu) | "Você subiu para {posição}º no ranking! 📈" |
| Entrou no top 3 | "Você está no pódio! {posição}º lugar 🏆" |
| Posição piorou ou igual | **sem notificação** |

**Threshold:** notifica qualquer subida (delta ≥ 1). Mensagem especial ao entrar no top 3. Idempotente por dia: ID determinístico `ranking-{uid}-{dateKey}` — um recalc no mesmo dia não gera notificações repetidas de subida.

### 2.4 Disparo automático — `system` (já existe, migrar para server-side)

Mantém os 4 eventos atuais + corrige o bug do group_admin movendo a criação para os Route Handlers:

| Evento | Destinatário | Trigger point |
|---|---|---|
| Cadastro aprovado | Usuário | `POST /api/group/users/approve` |
| Conta reativada | Usuário | `POST /api/group/users/unblock` |
| Cadastro não aprovado | Usuário | `POST /api/group/users/reject` |
| Conta bloqueada | Usuário | `POST /api/group/users/block` |

Eventos `system` adicionais (opcionais, baixa prioridade — avaliar no plano):
- Promovido/removido de group_admin (`POST /api/group/users/promote`)
- Atribuído a um bolão (`PATCH /api/admin/users/[uid]/group`)

**Exceção de preferência:** notificações `system` de moderação são criadas mesmo com preferência `system: false` — o usuário precisa saber seu status de conta.

### 2.5 Pré-requisito: scheduler automático

Hoje **nenhum cron dispara** scoring/recalc — o cron antigo foi removido (`functions/src/index.ts`) e nunca reintroduzido. Para "automático" funcionar de ponta a ponta, algo precisa chamar `/api/predictions/score` periodicamente (que encadeia o recalc via `chainRecalc`).

**Opções de scheduler:**

| Opção | Custo | Notas |
|---|---|---|
| **GitHub Actions cron** (recomendado) | Grátis | Workflow agendado faz `POST` com header `x-cron-secret`. Não exige Blaze. Externo ao Firebase. |
| Cloud Scheduler | Exige Blaze | Mais nativo, mas projeto está em constraint Spark. |
| Firebase Function `onSchedule` (pubsub) | Exige Blaze | Reintroduz a CF removida. |

Recomendação: **GitHub Actions cron** batendo em `/api/predictions/score` a cada ~15-30 min durante a janela da Copa, usando o `SCORE_SECRET` já suportado. O `chainRecalc` encadeia o recalc automaticamente, que por sua vez dispara as notificações de ranking.

### 2.6 Fora do escopo

- Push notifications (FCM/Web Push) e e-mail — UI já marca "em breve".
- Notificação de deadline de palpite (X min antes do kickoff) — exige scheduler de precisão por jogo, próximo PRD.
- Notificação de início de fase/Copa — depende de PRD-13 estável.
- Paginação (max 50 atual é suficiente).

---

## 3. System Understanding Relevant to This Feature

### 3.1 Arquitetura atual (com bug)

```
Admin UI (browser)
  → React hook (useUpdateUserStatus / useModerateGroupUser)
    → createNotification() [Client SDK — Firestore Rules aplicadas]
```
**Problemas:** group_admin bloqueado por Rules (`create: isAdmin() OR isOwner`); perda se browser fecha; preferências não checadas.

### 3.2 Arquitetura target

```
Cron (GitHub Actions) ──POST x-cron-secret──> /api/predictions/score
                                                  │ pontua palpites (Admin SDK)
                                                  │ ┌─ cria notificações `games` (batch)
                                                  │ └─ chainRecalc()
                                                  ▼
                                              /api/rankings/recalc
                                                  │ recalcula posições (Admin SDK)
                                                  └─ cria notificações `ranking` (batch)

Admin action ──> Route Handler (group/users/*) ──> cria notificação `system`
```

Toda criação de notificação é **server-side via Admin SDK** (bypassa Rules), como efeito da ação principal. Best-effort: falha de notificação loga mas não derruba a ação.

### 3.3 Módulos afetados

- **Schema/UI (remoção `pool`):** `src/schemas/notifications.ts`, `notificationPreferences.ts`, `NotificationFilters.tsx`, `PreferencesForm.tsx`, `notificationMeta.ts`
- **Novo server-only:** `src/server/notifications/` (factory + preferences helper)
- **Games:** `src/app/api/predictions/score/route.ts`
- **Ranking:** `src/app/api/rankings/recalc/route.ts`, `src/app/api/group/rankings/recalc/route.ts`, `src/server/rankings/recalc.ts` (expor delta de posição)
- **System (migração):** `src/app/api/group/users/{approve,reject,block,unblock}/route.ts`, `_moderation.ts`; remover criação de `useUpdateUserStatus.ts`, `useModerateGroupUser.ts`
- **Scheduler:** `.github/workflows/score-cron.yml` (novo)

### 3.4 Restrições de plataforma

- **Spark tier:** sem Cloud Scheduler/Functions agendadas → usar GitHub Actions cron (externo, grátis).
- **Admin SDK no server:** Route Handlers `runtime = "nodejs"` criam notificações sem passar por Rules.
- **Append-only:** notificações imutáveis (delete bloqueado nas Rules) exceto `isRead`.
- **`positionHistory`:** `recalc.ts` já persiste — fonte de verdade do delta de ranking.

---

## 4. Technical Impact Analysis

### 4.1 Novo módulo `src/server/notifications/`

```
src/server/notifications/
  factory.ts       — notifyScoreHit(), notifyRankingUp(), notifyModeration()
  preferences.ts   — fetchPreferencesMap(uids[]) via Admin SDK (batch read)
  write.ts         — batched create com ID determinístico (idempotência)
  index.ts
```
Server-only (`import "server-only"`). Nunca importado no client.

### 4.2 Scoring route — fan-out `games`

Em `processMatch`, após `scorePrediction`:
- Se `status === "correct" | "partial"`, acumular `{ uid, matchId, status, predictionIsDraw }`.
- Após todos os jogos, carregar preferências dos uids afetados (batch), filtrar `games: true`.
- Criar notificações em `batch.set` (chunks de 500), IDs `games-{uid}-{matchId}`.
- Fire-and-forget após o commit de pontuação — não bloqueia o response crítico.

### 4.3 Recalc route — fan-out `ranking`

`recalcRankings()` precisa **expor o delta de posição** por usuário (hoje só persiste `positionHistory`). Adicionar ao retorno: `[{ uid, previousPosition, newPosition, scope }]`.
- Filtrar `newPosition < previousPosition` (subiu).
- Carregar preferências, filtrar `ranking: true`.
- `batch.set` IDs `ranking-{uid}-{dateKey}`.

### 4.4 Idempotência

ID determinístico evita duplicatas em retries/re-runs do cron:
- Games: `games-{uid}-{matchId}` (um jogo pontua uma vez por usuário)
- Ranking: `ranking-{uid}-{dateKey}` (uma subida por dia por usuário)
- `adminFirestore.collection('notifications').doc(id).set(data)` — re-run sobrescreve o mesmo conteúdo, não cria novo.

### 4.5 Remoção de criação client-side

`useUpdateUserStatus` e `useModerateGroupUser` deixam de chamar `createNotification`. A responsabilidade migra para os Route Handlers de moderação.

---

## 5. Risks

| Risco | Severidade | Mitigação |
|---|---|---|
| Sem scheduler, nada é "automático" — depende do cron externo | **Alta** | Incluir `.github/workflows/score-cron.yml` no escopo; documentar `SCORE_SECRET` como secret do repo |
| Fan-out de notificações no scoring (N palpites × M jogos) | Alta | `batch.set` Admin SDK em chunks de 500; só jogos `finished`; só acertos |
| Notificação duplicada em re-run do cron | Média | IDs determinísticos (`games-{uid}-{matchId}`, `ranking-{uid}-{dateKey}`) |
| `recalc.ts` precisa expor delta — mudança em função central de ranking | Média | Aditivo (novo campo no retorno); cobrir com testes; não alterar lógica de cálculo existente |
| Lista de 50 notificações enche rápido com games+ranking a cada rodada | Média | IDs determinísticos limitam 1/jogo e 1/dia; lista já corta em 50 desc |
| Remoção de `pool` quebra docs/preferências legadas | Baixa | Enum filtra tipos conhecidos; preferências default não incluem mais `pool` |
| Notificação de ranking dispara sem mudança real | Baixa | Só cria se `newPosition < previousPosition` |

---

## 6. Ambiguities and Gaps

### 6.1 Resolvidas pelo usuário

1. ✅ Tipo `pool` **removido** — só Sistema, Jogos, Ranking.
2. ✅ Games = **por palpite acertado**, refletindo pontuação ponderada (placar/vencedor/empate).
3. ✅ Ranking = **automático ao subir de posição**.
4. ✅ Disparo **automático** (não manual) — via scheduler + side-effects server-side.

### 6.2 Abertas — decisão no plano

1. **Frequência do cron?** A cada 15min? 30min? Só durante janela de jogos? (Recomendação: 30min, simples; refinar depois.)
2. **Notificar acerto em palpite manual de group_admin?** Quando admin lança palpite por um user e o jogo é pontuado, o user recebe "você acertou"? (Recomendação: sim — o palpite é dele, mesmo que lançado pelo admin.)
3. **Eventos `system` extras** (promoção, atribuição a pool) entram nesta feature ou ficam pra depois? (Recomendação: incluir promoção; adiar o resto.)
4. **Mensagem com nomes dos times** exige carregar `teams` no scoring — ou usar matchId/genérico? (Recomendação: incluir nomes — scoring já tem o `match` em mãos.)

---

## 7. Recommended Implementation Concerns

### 7.1 Ordem sugerida (entrada para o `/plan`)

1. **TASK-01 — Remover tipo `pool`** (schema, preferências, UI filtros/meta). Baixo risco, desbloqueia o resto.
2. **TASK-02 — Módulo server-side `src/server/notifications/`** (factory, preferences batch, write idempotente).
3. **TASK-03 — Migrar `system` para server-side** (Route Handlers de moderação; remover client-side; corrige bug group_admin).
4. **TASK-04 — Notificações `games`** no scoring route (fan-out batch, idempotente).
5. **TASK-05 — Expor delta no recalc + notificações `ranking`** (recalc.ts retorno + fan-out nos 2 recalc routes).
6. **TASK-06 — Scheduler** (`.github/workflows/score-cron.yml` + doc de `SCORE_SECRET`).

### 7.2 Assinaturas da factory (server-only)

```typescript
// src/server/notifications/factory.ts
notifyScoreHit(ctx: { uid, match, result: "correct" | "partial", predictionIsDraw })
notifyRankingUp(ctx: { uid, newPosition, previousPosition, scope, dateKey })
notifyModeration(ctx: { uid, transition: "approved" | "reactivated" | "rejected" | "blocked" })
```

### 7.3 Notas de pontuação

A factory de `games` consome o `ScorePredictionResult` (`status: "correct" | "partial" | "wrong"`). Mapa de mensagem:
- `correct` → "acertou o placar" (+10)
- `partial` + `prediction.homeScore === prediction.awayScore` → "acertou o empate" (+5)
- `partial` (não-empate) → "acertou o vencedor" (+5)
- `wrong` → não notifica

Reusa a lógica de `derivePredictionDisplayStatus` (`acertou` | `acertou_vencedor` | `acertou_empate`) para consistência de copy com a tela de palpites.
