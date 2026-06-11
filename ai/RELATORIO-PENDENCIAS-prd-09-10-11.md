# Relatório de Pendências — PRD-09 / PRD-10 / PRD-11

**Data:** 2026-06-11
**Branch:** `prd-09`
**Modo:** `/flow` automático (sem checkpoints) — execução noturna
**Build final:** ✅ `npx tsc --noEmit` limpo · ✅ `npx next build` 0 erros (19 warnings pré-existentes)
**Testes:** ✅ `npx vitest run` — **2181 pass · 0 fail** (180/180 suites) · ✅ `npm run typecheck` limpo

> **Atualização pós-noturna (reconcílio):** este relatório foi escrito após a fase
> de implementação inicial. Trabalho adicional aprovado em sessão (decision-gated)
> fechou vários itens antes marcados **ADIADO** — ver §0. As seções §4/§5 abaixo
> trazem o status corrente já reconciliado.

---

## 0. Reconcílio — fechado após a versão inicial

| Item (ref. original) | Status atual | Onde |
|---|---|---|
| §4.2 — Ranking por grupo | ✅ **Feito** | Recalc escopado por pool (`rankings/pool-{id}-geral`); scoring global, posição re-rankeada por pool |
| §4.4 — Rota pública `/invite/[code]` | ✅ **Feito** | `POST /api/invite/[code]/redeem` — redenção atômica (valida `isActive`/`expiresAt`/`maxUses`, isola por `groupId`) |
| §4.5 — Sincronização OpenFootball | ✅ **Feito** | `POST /api/admin/worldcup/sync` — overlay para `matches/{id}`, preserva `isManualOverride` |
| §4.6 — Edição manual de partida | ✅ **Feito** | `PUT /api/admin/matches/[id]` — `isManualOverride:true`, coerência placar↔status via `matchSchema` |
| §2 — Superfície de auth tocada | ✅ **Revisado** | `ai/review/REVIEW-prd-10-11-auth.md` (Task #7) |
| §5 — `/test` (authz escopada + convites) | ✅ **Feito** | 5 arquivos novos / 31 casos — overlay, sync, edição, redenção, escopo `group/invites` |

**Arquitetura de persistência de partidas (pré-requisito de §4.5/§4.6) — DECIDIDA e implementada:**
OpenFootball segue base ao vivo (`fetchAllMatches`); `matches/{id}` com `isManualOverride===true`
sobrepõe. `getEffectiveMatches()` faz o merge. Coleção vazia → idêntico ao comportamento de
hoje (zero regressão); falha de leitura Firestore → cai para a base ao vivo.

---

## 1. Visão geral

Três PRDs processadas em modo automático: PRD-09 (Gestão de Grupos), PRD-10 (Administração de Grupo) e PRD-11 (Super Admin). Foram executadas as skills `/prd`, `/plan`, `/spec` (implícito nos planos), `/ui-spec` (telas via PNGs como fonte de verdade) e `/implement`. As skills `/test`, `/review`, `/ui-review`, `/local-env` e `/release` ficaram para depois, conforme combinado.

**Prime directive cumprido:** build sempre verde, fatias coerentes e independentemente entregáveis, restante documentado abaixo com honestidade.

As PNGs de layout foram tratadas como fonte de verdade; conflitos PNG-vs-texto resolvidos a favor da PNG e listados por PRD.

**Requisito crítico atendido:** *"todas as telas do super admin adicionar no menu perfil"* — as 7 telas do Super Admin (PRD-11) e as 6 telas de Administração do Grupo (PRD-10) foram adicionadas ao menu de perfil (`ProfileHub.tsx`), com seções separadas e gating por papel.

---

## 2. Status por PRD

### PRD-09 — Gestão de Grupos

| Item | Status |
|---|---|
| Backend (TASK-01..05): coleção `pools`, criar/buscar/detalhe, rules | ✅ Feito (commits anteriores + review retroativo `69e66c7`) |
| Telas (TASK-07/08/09): seleção no cadastro, criar grupo, solicitação enviada, buscar, não encontrado, detalhe | ✅ Feito — build verde, tsc limpo, 46/46 testes |
| TASK-06 — Migração de autorização global ("stop-the-world") | ⏳ **ADIADO** (ver §4.1) |
| TASK-10/11 — Re-escopo do ranking por grupo | ⏳ **ADIADO** (ver §4.2) |
| TASK-12 — Backfill + corte de papéis legados | ⏳ **ADIADO** (ver §4.3) |

**Arquivos principais:** `src/features/groups/*`, `src/app/(app)/grupos/*`, `src/features/auth/schemas.ts` (+`groupId` obrigatório no cadastro), `src/services/auth.ts`, `src/services/pools.ts`.

### PRD-10 — Administração de Grupo

| Item | Status |
|---|---|
| Fundação: schema/tipos `invites`, campos `pools.maxParticipants`/`allowInvites`, `users.blockReason` | ✅ Feito |
| firestore.rules (`invites` Admin-SDK-only) + índices | ✅ Feito (aditivo, lockout-safe) |
| Rotas `/api/group/*`: dashboard, users pending/approve/reject, block/unblock, promote-to-admin, settings, invites | ✅ Feito — todas escopadas por `groupId` da sessão |
| Telas (PRD10-01..06): Dashboard, Pendentes, Aprovados, Bloqueados, Configurações, Convites | ✅ Feito — `src/features/groupAdmin/*`, `src/app/(app)/grupo/*` |
| `GroupAdminGuard` (group_admin OU super_admin) | ✅ Feito |
| TASK-13 — Wiring no menu de perfil | ✅ **Feito agora** (ver §3) |
| Rota pública de resgate de convite `/invite/[code]` | ⏳ **ADIADO** (ver §4.4) |

**Autorização:** todas as rotas exigem `user.groupId === resource.groupId` + papel group_admin/super_admin; `groupId` sempre vem da sessão, nunca do body.

### PRD-11 — Super Admin

| Item | Status |
|---|---|
| Dashboard Global (cards + indicadores) | ✅ Feito |
| Grupos Pendentes / Ativos / Bloqueados (aprovar/rejeitar/bloquear/reativar/excluir/alterar-admin) | ✅ Feito — reusa `PATCH /api/admin/groups/[id]/status` e `.../admin` |
| Administradores (substituir/remover/transferir) | ✅ Feito |
| Resultados da Copa (lista de partidas + filtros) | ✅ Feito — **somente leitura** |
| Logs Globais (lista filtrada + detalhe) | ✅ Feito |
| TASK-14 — Wiring no menu de perfil | ✅ **Feito agora** (ver §3) |
| Sincronização OpenFootball (`POST /api/admin/worldcup/sync`) | ⏳ **ADIADO** — stub (botão desabilitado) (ver §4.5) |
| Edição manual de partida (`PUT /api/admin/matches/[id]` + `isManualOverride`) | ⏳ **ADIADO** — lista read-only (ver §4.6) |

**Arquivos principais:** `src/features/superAdmin/*`, `src/app/(app)/admin/{dashboard-global,grupos-pendentes,grupos-ativos,grupos-bloqueados,administradores,jogos-da-copa,logs-globais}`.

**⚠️ Superfície de auth tocada:** o subagente da PRD-11 alterou `src/server/auth/verifySession.ts` (`normalizeRole` agora mapeia `super_admin`→bucket "admin" e `participant`→"user") e `src/components/layout/AdminGuard.tsx` (passou a usar `isSuperAdminRole`). Mantém dupla-compat com legado `admin`. **Precisa verificação dedicada** (ver §5).

---

## 3. Wiring do menu de perfil (feito nesta sessão)

`src/features/profile/components/ProfileHub.tsx` — adicionadas 3 seções role-gated:

- **Administração do Grupo** — `isGroupAdminRole(profile.role)` → 6 itens: Dashboard, Pendentes, Aprovados, Bloqueados, Convites, Configurações.
- **Super Admin** — `isSuperAdminRole(profile.role)` → 7 itens: Dashboard Global, Grupos Pendentes, Grupos Ativos, Grupos Bloqueados, Administradores, Resultados da Copa, Logs Globais.
- **Administração (Sistema)** — PRD-07 legado; gate ampliado de `role === "admin"` para `isSuperAdminRole(profile.role)` (super_admin agora também vê as telas globais de moderação de usuários).

Gating via helpers de `@/schemas/shared` (`isSuperAdminRole` cobre legado `admin` + `super_admin`).

---

## 4. Itens adiados (NÃO implementados) — detalhe e risco

> **Reconciliado (§0):** 4.2, 4.4, 4.5 e 4.6 foram **CONCLUÍDOS** após a versão
> inicial. Mantidos abaixo com o carimbo ✅ FEITO para rastreabilidade. Restam
> adiados apenas 4.1 e 4.3 (migração de auth + backfill — dívida técnica PRD-09).

### 4.1 PRD-09 TASK-06 — Migração de autorização global ⚠️ CRÍTICO
Substituição do esquema de papéis legado (`user`/`admin`) pelo canônico (`participant`/`group_admin`/`super_admin`) em toda a base, com normalização obrigatória via `roleSchema` antes dos helpers.
- **Por que adiado:** "stop-the-world" — toca toda a autorização; risco alto de lockout. As PRDs 10/11 introduzem helpers de auth próprios e escopados, então o legado `admin` continua funcionando sem essa migração.
- **Risco se não feito:** dualidade de papéis persiste; usuários novos gravam `participant`/`group_admin`, antigos seguem `user`/`admin`. Helpers já tratam ambos (fail-closed), mas é dívida técnica e fonte de bugs sutis de permissão.

### 4.2 PRD-09 TASK-10/11 — Re-escopo do ranking por grupo ✅ FEITO
Era global; agora escopado por pool. Scoring permanece **global**; apenas a **posição**
é re-rankeada por pool. Recalc grava `rankings/pool-{poolId}-geral`. A tela "Usuários
Aprovados" (PRD-10) passa a ler posição/pontos do ranking do pool.

### 4.3 PRD-09 TASK-12 — Backfill + corte de legado
Backfill de `groupId`/`status`/`role` canônico em docs antigos + remoção dos valores legados do `roleSchema`. Depende de 4.1 e 4.2. **Adiado.**

### 4.4 PRD-10 — Rota pública de resgate de convite ✅ FEITO
`POST /api/invite/[code]/redeem` — valida o `code` (formato canônico), verifica o ID token,
e numa transação re-valida `isActive`/`expiresAt`/`maxUses` e incrementa `usedCount`. O
incremento só ocorre se `user.groupId === invite.groupId` (impede inflar contagem de pool
alheio). 10 casos de teste cobrindo 400/401/403/404/409/200.

### 4.5 PRD-11 — Sincronização OpenFootball ✅ FEITO
`POST /api/admin/worldcup/sync` — busca openfootball → grava `matches/{id}` em batch,
**preservando** docs com `isManualOverride===true` (correções manuais nunca sobrescritas),
grava resumo em `sync_logs/{id}` e audita (best-effort). Botão "Sincronizar com a Copa"
ativo na tela Jogos da Copa. Persistência é **overlay** (ver §0): coleção vazia → zero
regressão.

### 4.6 PRD-11 — Edição manual de partida ✅ FEITO
`PUT /api/admin/matches/[id]` — grava `matches/{id}` com `isManualOverride:true` +
`editedBy`, herdando campos não-editáveis da partida efetiva. Coerência placar↔status
reforçada pelo `matchSchema` (refine) → body incoerente devolve 422. `EditMatchDialog`
disponível por jogo na lista (não mais read-only). Sync respeita o override.

---

## 5. Pendências transversais (skills do /flow não executadas)

| Skill | Status | Observação |
|---|---|---|
| `/test` | ✅ **Parcial-feito** | PRD-09: 46 testes. Adicionados **31 casos** (5 arquivos) cobrindo overlay de partidas, sync, edição manual, redenção de convite e escopo `group/invites`. Suite total: **2142 pass / 0 fail**. Cobertura de UI/telas ainda não testada. |
| `/review` (auth) | ✅ **Feito** | Superfície de auth PRD-10/11 revisada — `ai/review/REVIEW-prd-10-11-auth.md` (Task #7). |
| `/review` (amplo) | ✅ **Feito** | Revisão ampla PRD-10/11 (rotas, services, hooks, schemas, componentes super/group-admin). Achados **HIGH corrigidos** (ver §9); medium/low documentados em §10. |
| `/ui-review` | ⏳ Pendente | Telas novas (13) não passaram por revisão UX/a11y formal contra as PNGs. |
| `/local-env` | ⏳ Pendente | Validar ambiente local completo (emulador Firestore, rules). |
| `/release` | ⏳ Pendente | Plano de rollout não gerado. |

**Prioridade sugerida de retomada (atualizada):**
1. `/ui-review` das 13 telas contra as PNGs.
2. Medium/low do review amplo (§10) — frontend error-surfacing, mirror de bounds, etc.
3. `/local-env` — emulador Firestore + rules.
4. PRD-09 TASK-06 + TASK-12 — migração de auth + backfill (4.1/4.3), fechamento da
   multi-tenancy. **Alto risco (lockout)** — exige aprovação dedicada e plano de rollback.
5. `/release` — plano de rollout.

---

## 6. Conflitos PNG-vs-texto resolvidos

- **PRD-10-06:** link de convite exibido como `bolao.app/invite/abc123` → construído client-side como `${origin}/invite/${code}`; rota de destino não implementada (4.4).
- **PRD-10-03:** header "Participantes" (PNG); abas distinguem Participantes vs Admins.
- **PRD-11-03/04:** PNG usa kebab (⋮) por linha → KebabMenu em Ativos/Bloqueados; Pendentes manteve botões inline verde/vermelho (PNG mostrava explícitos).
- **PRD-11-07:** placar só renderiza para partidas finished/live; agendadas mostram horário (PNG).

---

## 7. Defaults aplicados em ambiguidades

- Convite: validade padrão 30 dias, `maxUses` 100 (amostra da PNG). Gerar novo expira o anterior. "Convites ativos" lista todos; card principal reflete o mais recente.
- `allowInvites` ausente → habilitado por padrão.
- PRD-11 "Visualizar" grupo → roteia para `/grupos/[id]` existente (sem detalhe super-admin dedicado no escopo).
- PRD-11 "Transferir Grupo" tratado como variante de "Substituir" (mesmo `PATCH /admin`, um grupo por entrada de admin).

---

## 8. Notas de build

- Build verde exigiu correções de breakage pré-existente surfado pelo tsc: barrel `src/types/index.ts` (`export * from "./pools"` faltando), imports de `Pool`/`PoolStatus` (`@/schemas`→`@/types`), `SOURCE_LABEL` de `SystemLogs.tsx` completado com os 7 tipos de log da PRD-11, `flagUrl` em `adminMatches.ts` tipado `string | null`. Todos corrigidos.
- Arquivos não rastreados pré-existentes (`tmp-bracket.json`, `image.png`, `docs/prd-11/*.png`) **não tocados**.
- **Nada commitado/pushado** — aguardando aprovação (conforme constraints).

---

## 9. Review amplo PRD-10/11 — achados HIGH corrigidos (esta sessão)

Revisão ampla além da auth. Achados de severidade **HIGH** corrigidos + cobertos por teste:

| # | Achado | Fix | Arquivo |
|---|---|---|---|
| H1 | `DELETE /api/admin/matches/[id]` (un-protect de override) não existia — sem caminho para reverter correção manual ao sync oficial | Handler `DELETE` adicionado: 404 se não há override, remove doc + invalida cache, devolve `cleared:true` | `src/app/api/admin/matches/[id]/route.ts` |
| H2 | Sync: falha no `batch.commit()` ficava invisível (catch silencioso) | `catch` grava `sync_logs/{id}` com `status:"error"` + mensagem antes do 500 | `src/app/api/admin/worldcup/sync/route.ts` |
| H3 | Criação de convite não-atômica (create depois expire-anterior) — janela de 2 convites ativos | Reordenado: expira o anterior **antes** do create, na mesma sequência | `src/app/api/group/invites/route.ts` |
| H4 | Audit log gravava actor vazio em ações system-triggered (sync/match) | Actor `"system"` explícito quando não há `actorUid` de sessão | `matches/[id]/route.ts`, `worldcup/sync/route.ts` |
| H5 | `KebabMenu` sem semântica de teclado/ARIA (a11y) | Reescrito com roles/foco/navegação por teclado | `src/features/groupAdmin/components/KebabMenu.tsx` |
| H6 | `PATCH /api/group/settings`: 422 vazava `issues` do Zod (WR-03) + `maxParticipants:""` sentinela frágil (BR-01) | 422 sem `issues`; `null` → `FieldValue.delete()` | `src/app/api/group/settings/route.ts` |

**Testes adicionados/ajustados:** `_moderation.test.ts`, `settings/route.test.ts`, `matches/[id]/route.test.ts` (DELETE), `worldcup/sync/route.test.ts` (error-log), `promote.test.ts`. Mocks tipados para evitar erro latente de tsc (`vi.fn` zero-arg → tupla vazia).

**Regressão corrigida (não-HIGH, achada na verificação):** `SignupForm.test.tsx` quebrava na carga — auth work (PRD-10 A2) adicionou `import { redeemInvite } from "@/services/invites"` no SignupForm; `invites` → `@/firebase` valida envs no nível de módulo → throw sem env no vitest. Fix: mock `@/services/invites` no teste.

---

## 10. Review amplo — medium/low NÃO corrigidos (fora do escopo HIGH)

Documentados pra retomada; nenhum bloqueia release, mas valem polimento:

- **Error-surfacing no frontend:** `ChangeAdminDialog` / `ConfirmActionDialog` engolem erro da mutação (sem toast). Usuário não vê falha.
- **Mirror de bounds client-side:** `maxParticipants` / `maxUses` validados só no servidor; UI não espelha o limite (UX, não segurança).
- **Magic-number `>= 6`:** completude de standings usa literal — extrair constante nomeada.
- **`editSchema` descarta `venue`/`kickoffAt`:** edição manual de partida perde esses campos no patch (herdados, mas não editáveis — confirmar intenção).
- **Filtro "Seleção" ausente** na tela Resultados da Copa (PNG sugere; não implementado).
- **`pool_admin_changed` sem invalidação de cache:** troca de admin não invalida cache React Query do grupo afetado.
- **Divergência reject/blocked vs PRD:** A1 trata `reject ≡ blocked`; texto da PRD em alguns pontos sugere estados distintos — alinhar doc ou código.
