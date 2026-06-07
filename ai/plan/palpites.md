# PLAN — Palpites (PRD-04)

> PRD: `ai/prd/palpites.md`. Branch: `feat/integracao-api-football`.
> Saída por tarefa: `ai/spec/palpites-task-NN.md`, `ai/screen/palpites-task-NN.md`.
> Layout: `docs/prd-04/PRD04-01..06`. Design system: `design-system/MASTER.md` (já existe).
> Molde de referência: feature `matches` (PRD-03) — `lib/` puro testável → hook compositor → componentes tipados → página; e Route Handlers `src/app/api/*` (PRD-07) para a camada de servidor.

## 1. Planning summary

9 tarefas. A feature é **fullstack leve**: contrato de dados, **camada de servidor nova** (Route Handlers que escrevem via Admin SDK), endurecimento de Security Rules, camada client (service fetch + hooks), e 3 frentes de UI (form, lista, ajuste do detalhe).

**Decisões travadas (resolvem as ambiguidades do PRD):**
- **Pontuação binária** (placar exato=1; senão 0). Telas 03/04 perdem o texto "3/1/0" (A6, tratado no `/screen`).
- **Sem Cloud Functions.** Cálculo de pontuação em **Route Handler Next** (Admin SDK), disparado por cron externo/admin (A1).
- **Write de palpite via Route Handler** (`/api/predictions`), não client-direto. Motivo: matches não estão no Firestore ([[architecture-copa-data]]), então as Rules **não podem** ler `kickoffAt`; o bloqueio temporal seguro vive no servidor (Admin SDK + cache de partidas). Rules **negam** write client-direto em `predictions`.
- **Schema** `predictionSchema` estende `status`(`pending|correct|wrong|locked`)+`points`(`0|1`), gravados pelo servidor; cliente envia só `homeScore/awayScore`. `id` do doc = `${uid}_${matchId}`.
- **Só create + update** (sem delete) — A3.
- **Form** em rota dedicada `/matches/[id]/predict` (full-screen) — A2.
- **Lista de Palpites** em `/predictions` com chips client-side single-select + persistência em `localStorage` — A4.
- **Bloqueio**: jogo iniciado (`agora >= kickoffAt` ou `status != scheduled`) ⇒ sem create/edit; jogo sem palpite não entra na lista — A5.

**Reuso direto:** `listPredictionsByUid` (read client-side) + `usePredictions` (matches/home); detalhe de jogo (`MatchDetail*`, PRD-03); `useMatch`/`useMatches`/`useTeams`; cache de partidas em `src/app/api/_lib/apiFootballData.ts`; padrão de sessão (`/api/auth/session`) para auth nos Route Handlers; `src/firebase/admin.ts` (Admin SDK).

Início recomendado: **TASK-01 + TASK-02 + TASK-05** (fundação, paralelas). Maior risco: TASK-03 (lock server-side autoritativo), TASK-04 (idempotência + segurança do endpoint), TASK-08 (compositor da lista + estados).

## 2. Recommended execution phases

1. **Fundação** — TASK-01 (contrato schema/types), TASK-02 (funções puras: lock, scoring, status de exibição), TASK-05 (Security Rules).
2. **Servidor** — TASK-03 (Route Handler upsert), TASK-04 (Route Handler pontuação).
3. **Client data** — TASK-06 (service fetch + hooks de mutação + invalidação).
4. **UI** — TASK-07 (form Enviar/Editar + Registrado), TASK-08 (Lista de Palpites + nav).
5. **Integração** — TASK-09 (ajuste de CTA/bloco no detalhe do jogo).

## 3. Tasks

### TASK-01 – Contrato de dados de `predictions` (schema + tipos)
- Type: persistence
- Goal: estender o contrato de palpite para suportar pontuação gravada pelo servidor e um schema de input separado para a escrita do cliente.
- Scope:
  - Adicionar `predictionStatusSchema = z.enum(["pending","correct","wrong","locked"])` em `src/schemas/shared.ts`.
  - Estender `predictionSchema` (`src/schemas/predictions.ts`): adicionar `status: predictionStatusSchema.optional()` e `points: z.literal(0).or(z.literal(1)).optional()` (ou `z.int().min(0).max(1)`), mantendo `.strict()` e o naming atual (`uid/matchId/homeScore/awayScore/createdAt/updatedAt`). **Não** quebrar `listPredictionsByUid` (campos opcionais).
  - Novo `predictionInputSchema` (`uid?` omitido — vem da sessão; `matchId`, `homeScore`, `awayScore`) para validar o body do Route Handler de upsert.
  - Atualizar tipos derivados em `src/types/predictions.ts` + `src/types/shared.ts`; exports em barrels.
  - `predictionDocId(uid, matchId)` helper de id determinístico (em `lib`/`shared`).
- Main modules/files: `src/schemas/shared.ts`, `src/schemas/predictions.ts`, `src/types/predictions.ts`, `src/types/shared.ts`, `src/schemas/__tests__/*`
- Dependencies: nenhuma
- Story points: 2
- Criticality: high
- Technical risk: low
- Recommended TDD: no (schema; teste de schema entra no /test)
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: contrato primeiro — bloqueia servidor e UI. Sem `any`.

### TASK-02 – Funções puras: lock, pontuação e status de exibição
- Type: domain
- Goal: centralizar a lógica não-React de palpites em `features/predictions/lib`, testável e fonte única para servidor e UI.
- Scope:
  - `isPredictionLocked(match, now)` → `true` se `now >= kickoffAt` **ou** `match.status !== "scheduled"`. (Mesma regra usada no Route Handler e na UI.)
  - `scorePrediction(prediction, match)` → `{ status: "correct"|"wrong", points: 0|1 }` para partida `finished` (placar exato → 1; senão 0). Binário. Indefinido/`pending` se não `finished`.
  - `derivePredictionDisplayStatus(prediction, match, now)` → `"pendente"|"acertou"|"errou"|"bloqueado"` para a Lista/badges (combina lock + resultado).
  - Constantes de rótulo+cor de status (reusar tokens; verde=acertou, vermelho/destructive=errou, âmbar=pendente, cinza=bloqueado) em arquivo dedicado.
- Main modules/files: `src/features/predictions/lib/{predictionsHelpers.ts,predictionLabels.ts}`, `src/features/predictions/lib/__tests__/predictionsHelpers.test.ts`
- Dependencies: TASK-01
- Story points: 3
- Criticality: critical
- Technical risk: medium (tempo/timezone — `kickoffAt` ISO com offset; injetar `now: Date` p/ testes)
- Recommended TDD: yes
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: zero React. `scorePrediction` e `isPredictionLocked` são reusados literalmente pelos Route Handlers (03/04).

### TASK-03 – Route Handler de upsert de palpite (`/api/predictions`)
- Type: api
- Goal: gravar palpite com bloqueio temporal autoritativo no servidor, já que as Rules não alcançam `kickoffAt`.
- Scope:
  - `POST /api/predictions` (create/update unificado — upsert): lê sessão (cookie httpOnly, padrão `/api/auth/session`) → `uid`; valida body com `predictionInputSchema`; busca a partida (cache `apiFootballData`) p/ obter `kickoffAt`/`status`; rejeita `409/423` se `isPredictionLocked`; rejeita `403` se não-aprovado; grava via Admin SDK em `predictions/${uid}_${matchId}` com `merge` (preserva `points`/`status`/`createdAt`; seta `updatedAt`). **Cliente nunca define `points`/`status`.**
  - Erros consistentes (reusar shape de `apiFootballError`/padrão do projeto): 401 sem sessão, 403 não-aprovado, 404 partida inexistente, 423 bloqueado, 422 validação.
  - Testes de rota (locked, sucesso create, sucesso update, não-aprovado, sem sessão, matchId inválido).
- Main modules/files: `src/app/api/predictions/route.ts`, `src/app/api/predictions/__tests__/route.test.ts`, helpers de auth de sessão (reuso)
- Dependencies: TASK-01, TASK-02
- Story points: 5
- Criticality: critical
- Technical risk: high (autoridade do lock; sessão server-side; Admin SDK)
- Recommended TDD: yes
- Recommended screen: no – n/a
- Notes: usa `isPredictionLocked` da TASK-02. Sem chamada à API-Football direto do browser (PRD §criteria).

### TASK-04 – Route Handler de pontuação (`/api/predictions/score`)
- Type: api
- Goal: calcular e gravar `status`/`points` binários dos palpites das partidas finalizadas, sem Cloud Function.
- Scope:
  - `POST /api/predictions/score`: protegido (header de segredo **ou** sessão admin); busca partidas `finished` (cache `apiFootballData`); para cada uma, lê os palpites via Admin SDK e grava `scorePrediction(...)` (`status`+`points`). **Idempotente** (re-rodar não altera resultado).
  - Resposta com sumário (`{ scoredMatches, updatedPredictions }`).
  - Testes: idempotência, binário (exato=1, qualquer outro=0), proteção (sem segredo → 401/403), partida não finalizada ignorada.
- Main modules/files: `src/app/api/predictions/score/route.ts`, `src/app/api/predictions/score/__tests__/route.test.ts`
- Dependencies: TASK-01, TASK-02
- Story points: 5
- Criticality: high
- Technical risk: high (idempotência + segurança do endpoint + escrita em lote Admin SDK)
- Recommended TDD: yes
- Recommended screen: no – n/a
- Notes: usa `scorePrediction` da TASK-02. Disparo (cron externo) é infra fora do código (R7 do PRD); fornecer fallback de chamada manual/admin. **Não** atualiza ranking (PRD próprio) — só grava points/status.

### TASK-05 – Endurecer Security Rules de `predictions`
- Type: infra
- Goal: alinhar as Rules ao modelo API-mediado — cliente não escreve palpite direto; leitura mantida.
- Scope:
  - `firestore.rules`: `predictions` → manter `allow read: if isApproved()`; **negar** `create`/`update`/`delete` pelo cliente (escrita só via Admin SDK, que bypassa Rules). Remover/ajustar as regras de write client atuais (linhas 64-67).
  - Comentar a razão (matches fora do Firestore ⇒ lock não verificável em rule ⇒ write via Route Handler).
  - Revisar `firestore.indexes.json` (query `where uid ==` já suportada por índice simples; adicionar só se necessário).
  - Testar via emulator/regras (se houver suíte) ou documentar verificação manual.
- Main modules/files: `firestore.rules`, `firestore.indexes.json`
- Dependencies: nenhuma (conceitualmente após TASK-01)
- Story points: 2
- Criticality: critical
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: no – n/a
- Notes: decisão de segurança de primeira classe (R1/R8 do PRD). Confirmar que nenhuma feature existente dependia de write client-direto em `predictions` (hoje só há leitura).

### TASK-06 – Client service (fetch) + hooks de mutação
- Type: application
- Goal: expor à UI uma API de escrita de palpite via `fetch` ao Route Handler, com cache TanStack Query e invalidação cruzada.
- Scope:
  - `src/services/predictions.ts`: adicionar `upsertPrediction(input)` via `fetch('/api/predictions')` (trata erros HTTP → erro tipado). Manter `listPredictionsByUid` (read client-direto continua permitido pelas Rules).
  - `src/features/predictions/hooks/predictionsKeys.ts` (namespace próprio: `["predictions"]`, `["predictions","item",matchId]`).
  - `usePredictions(uid)` da feature predictions (reusa service de leitura) **ou** reuso do existente — evitar duplicar lógica; decidir no spec.
  - `useUpsertPrediction()` — `useMutation`; `onSuccess` invalida `predictionsKeys`, `matchesKeys.predictions(uid)` e `homeKeys.predictions(uid)` (badge nos cards atualiza). Toast de erro (Sonner).
- Main modules/files: `src/services/predictions.ts`, `src/features/predictions/hooks/*`, `src/features/predictions/hooks/__tests__/*`, barrels
- Dependencies: TASK-01, TASK-03
- Story points: 3
- Criticality: high
- Technical risk: medium (invalidação cruzada de cache — R5 do PRD)
- Recommended TDD: no (hooks testados no /test)
- Recommended screen: no – n/a
- Notes: erros do Route Handler mapeados p/ mensagem pt-BR (ex.: 423 → "Prazo encerrado").

### TASK-07 – Tela: Enviar/Editar Palpite + confirmação (`/matches/[id]/predict`)
- Type: ui
- Goal: formulário full-screen de criação/edição de palpite, com guarda de bloqueio e estado de sucesso (Palpite Registrado).
- Scope:
  - Rota `src/app/(app)/matches/[id]/predict/page.tsx` + componentes em `features/predictions/components` (form com 2 steppers Mandante/Visitante, bandeiras+nomes, botão Salvar/Atualizar).
  - **React Hook Form + Zod** (`predictionInputSchema` adaptado ao form). Pré-preenche em modo edição (palpite existente).
  - Guarda: se `isPredictionLocked` → renderiza **Palpite Bloqueado** (`PRD04-05`: mensagem "O prazo para este jogo foi encerrado." + palpite informado + data/hora). Sem campos editáveis.
  - Sucesso (`PRD04-06`): "Seu palpite foi salvo com sucesso." + `Mandante X x Y Visitante` + botão **Voltar para Jogos** (`aria-live`).
  - **Remover** o texto de pontuação "3/1/0" das telas (regra binária — A6).
  - Estados: submitting, erro (toast), partida inexistente.
- Main modules/files: `src/app/(app)/matches/[id]/predict/page.tsx`, `src/features/predictions/components/{PredictionForm,PredictionLockedState,PredictionSuccess}.tsx` + `__tests__`
- Dependencies: TASK-02, TASK-06
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: **yes** – both – formulário novo + estados (bloqueado/sucesso), tela full-screen.
- Design domains: ux, forms, style, color, typography
- Design complexity: high (multi-estado: editar/bloqueado/sucesso)
- Accessibility level: critical (form com validação, steppers touch ≥44px, foco gerenciado, `aria-live`)
- Notes: referenciar `design-system/MASTER.md`. Steppers acessíveis (botões +/- com label + input numérico).

### TASK-08 – Tela: Lista de Palpites (`/predictions`) + nav
- Type: ui
- Goal: tela da aba "Palpites" com todos os jogos que o usuário palpitou, status derivado e filtro por chips.
- Scope:
  - Rota `src/app/(app)/predictions/page.tsx` (substitui placeholder se houver) + entrada "Palpites" no bottom nav/side nav.
  - Hook compositor `usePredictionsList()` — join `usePredictions(uid)` × `useMatches` × `useTeams`; aplica `derivePredictionDisplayStatus` + ordena por `kickoffAt` asc; expõe `{ items, isLoading, isError, refetch }`. Só jogos **com** palpite (A5).
  - Componentes: card de palpite (jogo, bandeiras, data, placar palpitado, badge de status), chips de filtro single-select (`Todos·Pendentes·Acertos·Erros·Bloqueados`) com persistência em `localStorage`; filtro puro em memória.
  - Estados: loading (skeleton), empty ("Nenhum palpite ainda"), error ("Tentar novamente").
- Main modules/files: `src/app/(app)/predictions/page.tsx`, `src/features/predictions/components/{PredictionListCard,PredictionFilters,PredictionList,*State}.tsx`, `src/features/predictions/hooks/usePredictionsList.ts`, nav component (reuso), `__tests__`
- Dependencies: TASK-02, TASK-06
- Story points: 5
- Criticality: high
- Technical risk: medium (compositor multi-query + estados)
- Recommended TDD: no
- Recommended screen: **yes** – both – nova página + lista + chips + estados.
- Design domains: ux, style, color, typography
- Design complexity: medium
- Accessibility level: enhanced (chips como toggles acessíveis, navegação por teclado, badges com texto não-só-cor)
- Notes: badge de status deve reusar `predictionLabels` (TASK-02). Persistir chip ativo (CLAUDE.md: persistir filtros).

### TASK-09 – Integração do CTA/bloco "Meu Palpite" no detalhe do jogo
- Type: ui
- Goal: ligar o detalhe (PRD-03) ao fluxo de palpite — CTA contextual + bloco do palpite atual.
- Scope:
  - Ajustar `features/matches/components/MatchDetailActions.tsx` + `MatchDetail.tsx`: CTA **Enviar Palpite** (sem palpite, não-travado) → `/matches/[id]/predict`; **Editar Palpite** (com palpite, não-travado); **Palpite bloqueado** (travado, sem ação); bloco "Meu Palpite" exibindo placar palpitado quando existir (`PRD04-02`).
  - Usar `isPredictionLocked` + `usePredictions` (já disponíveis).
- Main modules/files: `src/features/matches/components/{MatchDetailActions,MatchDetail}.tsx` + `__tests__`
- Dependencies: TASK-06, TASK-07
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD: no
- Recommended screen: **yes** – both – mudança de CTA/estado em tela existente.
- Design domains: ux, style
- Design complexity: low
- Accessibility level: standard
- Notes: tela já existe (PRD-03); aqui é wiring de estado + navegação. Reaproveitar componentes/badges de palpite da TASK-02.

## 4. Dependency map

```
TASK-01 (contrato) ─┬─> TASK-02 (lib pura) ─┬─> TASK-03 (api upsert) ─> TASK-06 (client) ─┬─> TASK-07 (form) ─> TASK-09 (detalhe)
                    │                       ├─> TASK-04 (api score)                       └─> TASK-08 (lista)
                    │                       └────────────────────────────────────────────────^ (07/08 usam lib)
                    └─> TASK-06 (contrato)
TASK-05 (rules) ── independente (pós-contrato conceitualmente)
```

- TASK-03 depende de 01,02 · TASK-04 depende de 01,02 · TASK-06 depende de 01,03 · TASK-07/08 dependem de 02,06 · TASK-09 depende de 06,07.

## 5. Execution waves (parallel groups)

- **Wave 1:** TASK-01, TASK-02, TASK-05 (fundação + rules, independentes entre si exceto 02→01; rodar 01 então 02; 05 paralela).
  - Ajuste: 02 depende de 01 → na prática Wave 1a = {01, 05}; Wave 1b = {02}.
- **Wave 2:** TASK-03, TASK-04 (paralelas; ambas dependem de 01,02).
- **Wave 3:** TASK-06 (depende de 03).
- **Wave 4:** TASK-07, TASK-08 (paralelas; dependem de 06,02).
- **Wave 5:** TASK-09 (depende de 07,06).

## 6. Recommended execution order (sequential fallback)

TASK-01 → TASK-02 → TASK-05 → TASK-03 → TASK-04 → TASK-06 → TASK-07 → TASK-08 → TASK-09

## 7. Planning risks and blockers

- **Lock autoritativo (TASK-03)** — toda a segurança do bloqueio depende do Route Handler ler `kickoffAt` do cache de partidas; garantir que `apiFootballData` expõe a partida por id de forma confiável no servidor. **Crítico.**
- **Segurança do endpoint de pontuação (TASK-04)** — não pode ser público; definir mecanismo de segredo/admin no spec. Cron externo é infra (R7 do PRD), fora do código.
- **Migração de Rules (TASK-05)** — negar write client-direto pode quebrar algo se houver caller oculto; confirmado que hoje só há leitura de `predictions` no client. Validar antes de aplicar.
- **Invalidação cruzada de cache (TASK-06)** — badge de palpite em Jogos/Home precisa atualizar pós-save; mapear todos os query keys afetados.
- **Pontuação automática real** — TASK-04 grava points/status, mas o **disparo** (cron) é externo; sem ele o critério "calcula automaticamente" só vale sob agendamento de infra. Sinalizar no `/release`.
- **Ranking automático** (critério do PRD) — fora do escopo; depende de PRD de ranking consumir `points`. Anotado, não bloqueia PRD-04.
