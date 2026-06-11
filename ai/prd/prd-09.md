# PRD — PRD-09 Gestão de Grupos (multi-tenancy + ranking por grupo)

> Fonte: `docs/prd-09/prd-09.md` + 5 telas em `docs/prd-09/*.png` (layout = fonte de verdade).
> Ênfase do solicitante: **cada grupo terá a visão do seu próprio ranking** (ranking escopado por grupo).

## 1. Feature summary

Introduz **multi-tenancy por grupo de bolão** ("pool"). Hoje o sistema é mono-bolão: todos os usuários aprovados competem num único ranking global. A PRD-09 transforma o produto em **N grupos independentes**, onde:

- Todo usuário pertence **obrigatoriamente** a um grupo (`user.groupId`).
- Cada grupo tem **um administrador** (criador vira `group_admin`).
- Grupos passam por **aprovação do Super Admin** (`status: pending → active`), análogo ao fluxo de aprovação de usuário já existente.
- **O ranking, as estatísticas e a visão de competição passam a ser escopados por grupo** — um participante vê apenas o ranking do seu próprio grupo, não o ranking global.

A PRD entrega: CRUD de grupo (criar), busca/seleção de grupo no cadastro, associação usuário→grupo, telas de detalhe e estados de erro, o **scaffold do modelo de papéis** (`participant | group_admin | super_admin`) e o **re-scoping do ranking/estatísticas por grupo**.

**Fora de escopo (PRD-10 / PRD-11):** aprovação de usuários pelo group_admin, dashboard de administração do grupo, dashboard do Super Admin. A PRD-09 apenas **define os papéis e a estrutura de dados** que essas PRDs vão consumir.

## 2. Consolidated scope

### Inclui
1. **Criar Grupo** (tela PRD09-01): nome (obrigatório), slug (obrigatório, único, `^[a-z0-9-]+$`), descrição (opcional, ≤160 chars), foto (opcional, PNG/JPG ≤2MB). Cria doc em `groups` com `status: pending`. Criador é registrado como `adminId`.
2. **Solicitação Enviada** (tela PRD09-02): confirmação pós-criação; CTA "Ir para meus grupos".
3. **Selecionar Grupo no cadastro** (tela PRD09-03): campo "Qual é o seu grupo?" com busca por nome/slug; lista grupos **ativos** com nome, slug e nº de membros; integra ao fluxo de signup existente. Ações secundárias "Não encontrei meu grupo" / "Criar novo grupo".
4. **Grupo Não Encontrado** (tela PRD09-04): estado vazio de busca; ações "Tentar novamente" / "Criar novo grupo".
5. **Detalhes do Grupo** (tela PRD09-05): nome, slug, status (badge), descrição, administrador, quantidade de participantes, data de criação.
6. **Associação usuário→grupo**: `groupId` obrigatório no doc do usuário, gravado no signup; usuário permanece `status: pending` (aprovação fica para PRD-10).
7. **Scaffold de papéis**: enum de role evolui de `user|admin` → `participant|group_admin|super_admin`. Criador de grupo aprovado vira `group_admin`. Super Admin é o papel global (sucessor do `admin` atual).
8. **Ranking escopado por grupo** (ênfase): recalc passa a produzir rankings/estatísticas **por grupo**; leitura de ranking filtra pelo `groupId` do usuário. `pool_stats` deixa de ser documento único global.
9. **Regras de negócio de grupo**: slug único; grupo `pending` não aparece na busca; grupo `blocked` não aceita novos membros; grupo `active` disponível para cadastro; um único admin principal; Super Admin pode trocar o admin.
10. **Firestore**: coleção de grupos, índices (`slug`, `status`, `users.groupId`, `users.role`, `users.status`), security rules.

### Não inclui (delega)
- Aprovação/bloqueio de **usuários** pelo group_admin → PRD-10.
- Dashboard administrativo do grupo → PRD-10.
- Dashboard do Super Admin (aprovar/bloquear grupos via UI, gerenciar admins) → PRD-11.
  > Nota: o **backend** de aprovação de grupo (transição `pending→active`) precisa existir em alguma forma mínima para a feature ser testável; ver Ambiguidade A2.

## 3. System understanding relevant to this feature

### Modelo atual (mono-bolão)
- **Usuário** (`src/schemas/users.ts`): `{ uid, name, nickname, email, role, status, avatarUrl?, ... }`. `role = "user"|"admin"` (`src/schemas/shared.ts`), `status = "pending"|"approved"|"blocked"`. **Sem `groupId`.**
- **Signup** (`src/services/auth.ts:234-273`): cria `users/{uid}` com `role:"user"`, `status:"pending"` hard-coded. Form em `src/features/auth/schemas.ts` (name, nickname, email, senha).
- **Papel/claim**: `functions/promoteFirstAdmin` (1º usuário vira admin), `functions/syncRoleClaimOnUserUpdate` (sincroniza claim `role`). Checagens `role === "admin"` em: `middleware.ts:46`, `AdminGuard.tsx:32`, `api/rankings/recalc:102`, `api/predictions/score:88`. `verifySession.ts` lê/normaliza `role` do JWT.
- **Ranking** (`src/app/api/rankings/recalc/route.ts`): agrega **todas** as predictions de **todos** os usuários `approved` (sem filtro de grupo). Produz docs globais: `rankings/geral`, `rankings/{stage}` (oitavas…final), `rankings/grupo-{A..L}` (grupos do torneio), `statistics/{uid}`, `pool_stats/current` (único). Leitura via `src/services/rankings.ts` (doc read direto por scope).
- **Rules** (`firestore.rules`): eixos `status`+`role`; `isAdmin()` = `role=="admin"`. `users` create força `status=="pending"` e `role=="user"`; update do owner **não pode** alterar role/status. `rankings`/`statistics`/`pool_stats` → `read: isApproved()`, `write: if false` (só Admin SDK via recalc).

### ⚠️ Colisão de nomenclatura "groups" (crítico)
Já existe coleção **`groups`** e schema `src/schemas/groups.ts` = **grupos do torneio** (Grupo A, B, C… da Copa, `{ name, teamIds }`), populada por copaData. O doc da PRD-09 pede coleção chamada **`groups`** para **grupos de bolão (pools)** — **mesmo nome, semântica diferente**. Resolver antes de planejar (ver Ambiguidade A1). Recomendação: pool de usuários = coleção **`pools`** (ou `bolao_groups`); reservar `groups` para o torneio. UI continua dizendo "grupo".

## 4. Technical impact analysis

### Módulos afetados
| Área | Arquivo(s) | Impacto |
|---|---|---|
| Schema usuário | `src/schemas/users.ts`, `src/schemas/shared.ts`, `src/types/users.ts` | `groupId` obrigatório; enum de role reescrito. **Quebra contrato.** |
| Schema grupo (novo) | `src/schemas/groups-pool.ts` (novo, evitar colisão) | Novo contrato `poolGroupSchema` + status `pending|active|blocked`. |
| Signup | `src/services/auth.ts`, `src/features/auth/*` | Injetar seleção de grupo; gravar `groupId`; novo role `participant`. |
| Feature nova | `src/features/groups/*` (novo slice) | Criar/buscar/detalhar grupo, hooks React Query (`["groups"]`, `["group",id]`, `["group-search",q]`). |
| Route Handlers | `src/app/api/groups/*` (novos) | `POST /api/groups`, `GET /api/groups/search`, `GET /api/groups/[id]`. Admin SDK para create (write server-side, padrão do projeto). |
| Ranking recalc | `src/app/api/rankings/recalc/route.ts` | Agregar por `groupId`; emitir rankings/stats por grupo; `pool_stats` por grupo. **Item mais pesado.** |
| Ranking leitura | `src/services/rankings.ts`, `src/features/rankings/*`, `src/features/home/hooks/*` | Parametrizar leitura pelo `groupId` do usuário. |
| Papéis/claims | `functions/syncRoleClaimOnUserUpdate.ts`, `promoteFirstAdmin.ts`, `verifySession.ts`, `middleware.ts`, `AdminGuard.tsx`, `api/*/route.ts` | Migrar `admin`→`super_admin`; introduzir `group_admin`; sincronizar `groupId` em claim (se usado em rules/edge). **Regressão ampla.** |
| Rules | `firestore.rules` | Bloco `pools`; ajustar `users` create (role `participant`, `groupId` presente); escopar leitura de ranking por grupo; helpers `isSuperAdmin`/`isGroupAdmin`. |
| Índices | `firestore.indexes.json` | `pools(slug)`, `pools(status)`, `users(groupId,status)`, `users(role)`. |

### Contratos / dados
- **Breaking:** `roleSchema` muda de valores. Todo dado persistido (`users/*.role`, custom claims, `system_logs`) e todo código que compara `=== "admin"`/`=== "user"` precisa migração coordenada. Backfill: usuários existentes ganham `groupId` (qual? ver A3) e `role` remapeado (`admin→super_admin`, `user→participant`).
- **Foto do grupo:** critério "Compatível com Firebase Spark" + decisão travada do projeto (avatar = base64, PRD-06/07/08) ⇒ foto do grupo provavelmente **base64 inline**, não Firebase Storage. Confirmar (A4).
- **Ranking por grupo:** `pool_stats/current` (singleton) → `pool_stats/{groupId}`; `rankings/geral` → `rankings/{groupId}/geral` (ou `rankings/pool-{groupId}`). Define formato de doc e impacta `getRankingByScope`.

### Performance / consistência
- Recalc hoje é O(usuários × predictions) global. Com grupos, agrupar por `groupId` dentro do mesmo passe é barato (mais um `Map`), **mas** o nº de documentos de ranking escritos cresce ~linear no nº de grupos. Em Spark (limites de escrita), avaliar lote/`BulkWriter` e custo (A5).
- Busca de grupo (`/api/groups/search` por nome/slug) sobre Firestore: sem full-text nativo. Slug = match exato; nome = prefixo/`array-contains` de tokens, ou filtro client-side sobre lista de ativos. Definir estratégia (A6).

### Migração / rollout
- Mudança de role é **stop-the-world** para autorização. Requer: (1) migração de dados, (2) deploy coordenado de rules + functions + app, (3) janela sem signups novos ou compat dupla (aceitar `admin` E `super_admin` durante transição).

## 5. Risks

- **R1 (alto) — Regressão de autorização.** Reescrever o enum de role toca middleware edge, rules, functions e múltiplos route handlers. Erro aqui = usuário sem acesso ou escalonamento indevido. Mitigar com período de compatibilidade dupla e testes de rules (`npm run test:rules`).
- **R2 (alto) — Colisão `groups`.** Reusar a coleção `groups` do torneio para pools corromperia dados da Copa. Decisão de nomenclatura é pré-requisito de planejamento.
- **R3 (alto) — Re-scoping do ranking.** É o coração da ênfase do solicitante e o ponto mais complexo: agregação, formato de doc, leitura, rules de leitura por grupo, e backfill. Regressão pode zerar/embaralhar rankings existentes.
- **R4 (médio) — Backfill de `groupId` obrigatório.** Usuários atuais não têm grupo. Tornar `groupId` obrigatório sem migração quebra parse de todos os usuários existentes (Zod `.strict()` + campo required).
- **R5 (médio) — Aprovação de grupo sem dashboard (escopo PRD-11).** Sem UI de Super Admin, não há como aprovar grupo → feature não testável fim-a-fim. Precisa de um caminho mínimo (script/endpoint admin/seed).
- **R6 (médio) — Firebase Spark.** Storage pago indisponível ⇒ foto base64; volume de writes de ranking por grupo pode pressionar cotas.
- **R7 (baixo) — Slug único.** Garantia de unicidade exige checagem server-side + (idealmente) doc-id = slug ou transação; race entre duas criações simultâneas.

## 5.1 Decisões travadas (resolvidas no checkpoint do PRD)

- **A1 → `pools`.** Coleção de grupos-de-bolão = **`pools`**. `groups` permanece exclusivo do torneio (Copa A/B/C). UI continua dizendo "grupo". Campo no usuário: `user.groupId` referencia `pools/{id}` (manter nome `groupId` na UX, mas aponta para `pools`).
- **A2 → endpoint admin mínimo.** PRD-09 inclui mecanismo backend de aprovação `pending→active` via **endpoint Admin SDK** (+ seed). **Sem UI** de Super Admin (fica para PRD-11). Feature testável fim-a-fim.
- **A3 → grupo-semente "Bolão dos Parças".** Migração cria pool semente **ativo** e migra todos os usuários existentes para ele. Admin atual → `super_admin` (global) e também `group_admin` do pool semente.
- **A4 → foto base64 comprimida client-side** (default adotado). Igual avatar (decisão PRD-06/07/08), redimensiona/comprime no client para ficar bem abaixo de 1MB (limite do doc Firestore). Compatível com Firebase Spark. Limite de exibição "2MB" tratado como teto de entrada antes da compressão.
- **A7 → 1 grupo por usuário.** `groupId` **escalar**. Criador vira `group_admin` E `participant` do pool que criou; sua predição conta no ranking do próprio pool (resolve A8). Texto "meus grupos" (tela PRD09-02) é ajuste de UI para singular. Convite de amigos (A9) fora de escopo.

## 6. Ambiguities and gaps

> A1–A4, A7, A8 **resolvidas** acima. Remanescentes para o `/plan`:

- **A1 — Nome da coleção de pools.** Doc diz `groups`, mas `groups` já é o torneio. **Decisão necessária.** Recomendado: `pools`.
- **A2 — Aprovação de grupo nesta PRD.** Escopo exclui dashboard Super Admin (PRD-11), mas o fluxo "Super Admin aprova → grupo ativo" é central. O **mecanismo backend** de transição `pending→active` entra na PRD-09 (endpoint/admin SDK) ou só na PRD-11? Sem ele, nada vira `active` e a busca fica vazia.
- **A3 — Backfill / grupo-semente.** Usuários e admin existentes vão para qual grupo? Criar um grupo "Bolão dos Parças" semente (`active`) e migrar todos para ele? (As telas usam exatamente esse nome como exemplo.)
- **A4 — Foto do grupo.** Base64 inline (como avatar, compat Spark) ou Storage? Limite 2MB bate com limite de doc Firestore (1MB) — 2MB base64 **estoura** o doc. Resolver (redimensionar/comprimir client-side, ou Storage).
- **A5 — Formato e escopo dos docs de ranking por grupo.** `rankings/{groupId}/...` subcoleção vs `rankings/pool-{groupId}-{scope}` flat? Mantém rankings por fase (oitavas…final) e por grupo-do-torneio **dentro de cada pool**? (multiplica documentos).
- **A6 — Estratégia de busca.** Match de slug exato + filtro client-side sobre ativos é suficiente para o MVP, ou precisa busca por nome server-side?
- **A7 — Multi-grupo.** Tela PRD09-02 diz "Ir para **meus grupos**" (plural) e "convidar amigos", sugerindo que um usuário/criador pode ter vários grupos. Mas regra de negócio diz "todo usuário pertence a um grupo" (singular) e `user.groupId` é escalar. Um criador é participante de qual grupo? **Conflito participante(1 grupo) × criador(N grupos).**
- **A8 — Relação criador↔membro.** Criador vira `group_admin` do grupo que criou. Ele também é `participant` desse grupo para fins de ranking? Sua predição conta no ranking do próprio grupo?
- **A9 — Convite de amigos** (PRD09-02 "convidar amigos para participar"): mencionado na tela mas sem requisito. Fora de escopo? 

## 7. Recommended implementation concerns

- **Resolver A1, A2, A3, A4, A7 antes do `/plan`** — são decisões de arquitetura/escopo que mudam a quebra de tasks. Sugiro um checkpoint de decisão junto da aprovação do PRD.
- **Sequência segura de tasks** (orientação, não plano): (1) contrato/schema de pool + enum de role com **compatibilidade dupla**; (2) coleção `pools` + rules + índices; (3) endpoints de grupo (create/search/detail); (4) seleção de grupo no signup + gravar `groupId`; (5) telas (frontend); (6) **re-scoping do ranking** (o item pesado, isolado); (7) migração/backfill + caminho de aprovação mínimo.
- **Compatibilidade dupla de role:** aceitar `admin`||`super_admin` e `user`||`participant` durante a transição; remover o legado só após backfill confirmado.
- **`groupId` opcional no schema durante migração**, promovido a obrigatório após backfill — evita quebrar parse de usuários legados (R4).
- **Frontend:** stack Next.js (App Router) + Tailwind v4 + shadcn/base-ui + React Query. As 5 telas são `is_frontend: true` → cada task de UI passa por `/ui-spec` + `/patterns:nextjs`. Layout dos PNGs é fonte de verdade (mobile-first 360/390/430, tablet 768, desktop 1024+).
- **Reaproveitar padrões existentes:** fluxo de aprovação de grupo espelha o de aprovação de usuário (status pending→approved/active); avatar base64 vira foto-de-grupo base64; Read/Write split (leitura client SDK, escrita via Route Handler+Admin SDK) aplica-se a `pools`.
- **Não tratar como uma feature única** — multi-tenancy + reescrita de role + re-scoping de ranking são três frentes de risco; manter task-by-task com review entre elas.
