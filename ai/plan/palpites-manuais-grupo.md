# Plano — Palpites Manuais pelo Admin de Grupo (PRD-12)

> Feature slug: `palpites-manuais-grupo` · PRD: `ai/prd/palpites-manuais-grupo.md`
> Gerado: 2026-06-12
> Decisões travadas: A1 (só jogos bloqueados), A2 (sobrescrita c/ confirmação), A4 (só group_admin, escopo pelo groupId da sessão).

## Objetivo (goal-backward)
Admin de grupo consegue, por uma tela em `(app)/group/predictions`, gravar/editar o palpite de um participante **aprovado do seu grupo** para um **jogo bloqueado** (encerrado/ao vivo/kickoff passado), com escopo seguro (só o próprio grupo), pontuação imediata, recalc de ranking, auditoria e marcação visível de origem.

## Sequência e dependências
```
TASK-01 (schemas) → TASK-02 (endpoint) → TASK-03 (service+hooks) → TASK-04 (tela) → TASK-05 (badge)
```
- TASK-02 depende de TASK-01 (input schema + campos de origem).
- TASK-03 depende de TASK-02 (contrato do endpoint).
- TASK-04 depende de TASK-03 (hooks/dados).
- TASK-05 depende de TASK-01 (campos de origem) — pode ir em paralelo a TASK-04, mas planejada por último.

---

## TASK-01 — Schemas: input manual, campos de origem, tipo de log
**Tipo:** persistence/domain · **Pontos:** 2 · **Criticidade:** medium · **Risco técnico:** low
**is_frontend:** false · **TDD:** sim (schemas têm `__tests__`; validação é lógica pura)
**Execution cost:** spec=opus/high, implement=sonnet/high, test=sonnet/medium, review=opus/high

**Escopo:**
- Novo `groupManualPredictionInputSchema = { targetUid, matchId, homeScore, awayScore }` em `src/schemas/predictions.ts` (reusa `scoreSchema`).
- Estender `predictionSchema` com campos **opcionais** de origem manual: `editedBy?: string`, `editedByRole?: <validado por `roleSchema`>`, `editedAt?: isoDateTime`. ⚠️ **`predictionSchema` é `.strict()`** — qualquer chave não declarada faz `safeParse` falhar, e o `recalc`/`score` **descartam silenciosamente** o doc malformado (some do ranking). Logo os campos têm de entrar **no schema** com validadores exatos; `editedByRole` validado por `roleSchema` (não string solta). **Não quebrar** palpites existentes nem testes atuais.
- Adicionar tipo `group_admin_manual_prediction` ao enum em `src/schemas/systemLogs.ts`.
- Tipos derivados em `src/types/*`.

**Critério de pronto:** schemas validam exemplos válidos/inválidos; campos novos opcionais; **teste round-trip**: um doc carregando os 3 campos novos passa em `predictionSchema.safeParse` e **não** é descartado pelo caminho do recalc (`.strict()` não pode rejeitá-lo); `pnpm vitest run` verde nos `__tests__` de schemas.

---

## TASK-02 — Endpoint `POST /api/group/predictions` (núcleo de segurança)
**Tipo:** api · **Pontos:** 5 · **Criticidade:** critical · **Risco técnico:** high
**is_frontend:** false · **TDD:** sim (autorização/escopo/override = regra crítica)
**Execution cost:** spec=opus/high, implement=sonnet/high, test=sonnet/high, review=opus/high

**Escopo:**
- Novo handler `src/app/api/group/predictions/route.ts` (`runtime=nodejs`, `force-dynamic`).
- Auth via `authorizeGroupAdminOfPool()` (sessão → role + `groupId`). **Não** reusar nada de `/api/predictions`.
- Validar body com `groupManualPredictionInputSchema`.
- **Escopo (fail-closed):** carregar `users/{targetUid}`; exigir `status === "approved"` **e** `targetUser.groupId === sessionGroupId`; **negar** se alvo for `super_admin`. 403 em qualquer falha.
- **Override de lock (A1):** buscar o jogo via `fetchAllMatches()` + filtro por id; **exigir** `isPredictionLocked(match, now) === true` (rejeitar jogo futuro/scheduled com **409** — esse não é papel do admin). **Não** chamar o gate de lock como bloqueio; ele vira pré-condição invertida.
- **Contrato com TASK-01 (dependência dura):** o objeto gravado **só** pode conter chaves declaradas em `predictionSchema` (`.strict()`) — `editedByRole` tem de bater com `roleSchema`. Drift de nome/tipo entre 01 e 02 = palpite descartado no recalc. **TASK-02 não pode mergear antes de TASK-01.**
- **A2 — read-before-write (ordenação explícita):** ler o doc anterior (`get`) **antes** do `set`; capturar placar anterior; depois gravar.
- **Write:** `predictionDocId(targetUid, matchId)`, `set({ uid: targetUid, matchId, homeScore, awayScore, editedBy, editedByRole, editedAt, updatedAt }, { merge: true })` via Admin SDK. Idempotente.
- **Audit:** `writeAuditLog({ type: "group_admin_manual_prediction", actorUid, targetUid, message com jogo + placar anterior→novo })` (best-effort), usando o valor anterior capturado acima.
- **Pontuação/ranking:** após o write, chamar `recalcRankingsBestEffort(getAdminFirestore())` **in-process** (espelha `api/group/users/_moderation.ts:152`). ⚠️ **NÃO** encadear `POST /api/predictions/score` — `recalcRankings()` re-pontua dos raw `predictions` internamente (`scorePrediction`), não lê `status/points` persistidos. Jogo `finished` → palpite pontua no recalc; jogo bloqueado-mas-não-finalizado (ao vivo/kickoff passado) → palpite **gravado e simplesmente ainda não pontuado** (recalc filtra `status==="finished"`), sem erro. **A6 resolvido: caminho único = recalc geral best-effort.**
- Respostas: 200 `{ saved }`; 400 input; 403 escopo; 404 jogo inexistente; 409 jogo não-bloqueado.

**Critério de pronto:** testes cobrindo — admin grava p/ membro do próprio grupo (jogo encerrado) ✓; **palpite manual NÃO é descartado pelo recalc** (round-trip com campos de origem) ✓; jogo bloqueado-não-finalizado é gravado sem pontuar e sem erro ✓; nega alvo de outro grupo ✓; nega alvo não-aprovado ✓; nega alvo super_admin ✓; nega jogo futuro (409) ✓; **read-before-write**: audit de sobrescrita contém anterior→novo ✓; uid do alvo nunca contamina a sessão ✓.

---

## TASK-03 — Service client + hooks (membros, jogos bloqueados, mutation)
**Tipo:** application · **Pontos:** 3 · **Criticidade:** medium · **Risco técnico:** low
**is_frontend:** false · **TDD:** não (wiring/data-access; mapeamento trivial — testar via TASK-02/04)
**Execution cost:** spec=opus/high, implement=sonnet/high, test=sonnet/medium, review=opus/high

**Escopo:**
- `src/services/predictions` (ou `services/group`): `createManualPredictionForMember(input)` → `POST /api/group/predictions`, com `parseWithId`/erro tipado pt-BR (padrão `_apiClient`).
- Hook mutation React Query (`useCreateManualPrediction`) + invalidação das queries de palpites/ranking do grupo.
- **Membros aprovados do grupo:** consumir o endpoint existente `GET /api/group/users/approved` via hook (client **não** pode ler docs de outros users — Rules). Não reimplementar leitura Firestore no client.
- Derivar lista de **jogos bloqueados** a partir de `useMatches()` + `isPredictionLocked`.

**Critério de pronto:** hook compila, erros mapeados pt-BR, invalidação correta; tipos strict (sem `any`).

---

## TASK-04 — Tela `(app)/group/predictions`
**Tipo:** application/ui · **Pontos:** 5 · **Criticidade:** medium · **Risco técnico:** medium
**is_frontend:** true · **TDD:** não (UI; lógica pura já coberta em 01/02) · **/ui-spec + patterns:nextjs obrigatórios**
**Execution cost:** spec=opus/high, ui-spec=sonnet/high, implement=sonnet/high, test=sonnet/medium, review=opus/high, ui-review=sonnet/high

**Escopo:**
- Rota `src/app/(app)/group/predictions/page.tsx` atrás de `GroupAdminGuard` (já no layout do grupo).
- Fluxo: seletor de **participante** (aprovados do grupo) → seletor de **jogo** (só bloqueados, com rótulo time×time + placar real se encerrado) → `ScoreInput` (reuso) → ao salvar, se já existe palpite, **diálogo de confirmação** mostrando atual→novo (A2) → submit via hook.
- Estados: vazio (sem participantes/jogos), sucesso, erro (escopo/lock), loading. Consistência com telas `(app)/group/*` + `design-system/MASTER.md`.
- Item de navegação "Palpites manuais" no menu do admin de grupo.

**Critério de pronto:** fluxo completo funciona local; estados cobertos; **role não-autorizado em `(app)/group/predictions` é redirecionado/negado** (confirmar que o layout do grupo envolve a rota com `GroupAdminGuard`); acessível (alvos ≥44px, foco, aria); build verde.

---

## TASK-05 — Badge "lançado pelo admin" no palpite (transparência)
**Tipo:** ui · **Pontos:** 1 · **Criticidade:** low · **Risco técnico:** low
**is_frontend:** true · **TDD:** não (apresentação)
**Execution cost:** spec=opus/high, implement=sonnet/high, test=sonnet/medium, review=opus/high

**Escopo:**
- No card/lista de palpites (onde o participante e o ranking vêem o palpite), exibir badge discreto quando `prediction.editedBy` presente ("lançado pelo admin"), com tooltip/rotulo acessível.
- Sem mudança de pontuação; puramente informativo.

**Critério de pronto:** badge aparece só quando `editedBy` presente; não vaza em palpites normais; build verde.

---

## Notas de execução
- **Ordem recomendada de início:** TASK-01 (fundação barata, destrava o resto).
- **Maior risco:** TASK-02 (critical/high) — núcleo de autorização + override de lock; TDD rígido obrigatório.
- **Gate de design:** TASK-04 dispara `/ui-spec` (ui-ux-pro-max, query estreita) + `/patterns:nextjs`. TASK-05 reusa decisões do ui-spec — não reinvocar ui-ux-pro-max.
- **Gate context7:** só se alguma task tocar API externa nomeada — aqui é domínio/infra própria → provável skip.
