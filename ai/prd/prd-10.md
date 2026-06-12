# PRD — PRD-10 Administração de Grupo (Group Admin)

> Fonte: `docs/prd-10/prd-10.md` + 6 telas em `docs/prd-10/PRD10-0X-*.png` (**layout = fonte de verdade**; onde o PNG contradiz o texto, o PNG vence — anotado inline com ⚠️).
> Depende de **PRD-09** (multi-tenancy `pools`, role `participant|group_admin|super_admin`, `user.groupId`). Reusa a infra de moderação de usuário já existente (`src/features/admin`) — **estende, não duplica**.
> Ênfase do solicitante: o **Group Admin gerencia APENAS o próprio pool**. Isolamento por `groupId` é **regra de segurança**, não cosmético — `user.groupId === resource.groupId` validado server-side em toda operação.

## 1. Feature summary

A PRD-10 entrega o **painel de administração do grupo** para o papel `group_admin`. Onde a PRD-09 criou a estrutura (coleção `pools`, papéis, `groupId` no usuário, fluxo de aprovação de **grupo** pelo super_admin), a PRD-10 dá ao admin do grupo as ferramentas para gerir **os participantes, os convites e as configurações do seu próprio pool**:

- **Dashboard do grupo** — visão geral (contadores + últimos cadastros + ações rápidas).
- **Moderação de participantes** — aprovar/rejeitar pendentes, bloquear/promover aprovados, desbloquear/excluir bloqueados.
- **Configurações do grupo** — editar nome, descrição, foto, limite de participantes e flag "permitir convites".
- **Convites** — gerar link + código de convite com validade e limite de usos (nova coleção `invites`).

O Group Admin **nunca** enxerga ou age sobre outro pool. Todas as telas são alcançáveis a partir de uma seção **"Administração do Grupo"** no menu de perfil (`ProfileHub`), role-gated por `role === group_admin` (e também visível ao `super_admin` como conveniência — ver §4 Decisões).

**Fora de escopo (PRD-11):** aprovação/bloqueio de **grupos**, gestão global, administradores globais, sincronização da Copa, dashboard do Super Admin.

## 2. Objetivo

Permitir que o `group_admin` gerencie participantes, convites e configurações **somente** do grupo que administra, sem acesso aos demais grupos do sistema.

## 3. Escopo consolidado

### Inclui
1. **Dashboard do Grupo** (PRD10-01).
2. **Usuários Pendentes** (PRD10-02): aprovar / rejeitar.
3. **Usuários Aprovados** (PRD10-03): bloquear / promover para admin.
4. **Usuários Bloqueados** (PRD10-04): desbloquear / excluir.
5. **Configurações do Grupo** (PRD10-05): nome, descrição, foto (base64), limite de participantes, permitir convites.
6. **Convites** (PRD10-06): nova coleção `invites` — link + código, validade, limite/contagem de usos.
7. **Route Handlers `/api/group/*`** (Admin SDK, escopados por sessão+`groupId`).
8. **Wiring no menu de perfil** — seção "Administração do Grupo" role-gated.
9. **Isolamento por `groupId`** enforced em route handlers e rules.

### Não inclui (delega à PRD-11)
- Aprovação/bloqueio de grupos · dashboard global · administradores globais · sync da Copa.
- O endpoint admin de **status de pool** e **troca de admin** já existe (PRD-09 TASK-05) — não é reescrito aqui.

## 4. Perfis e permissões

| Papel | Acesso PRD-10 |
|---|---|
| `participant` | Nenhum (menu admin oculto; route handlers 403). |
| `group_admin` | Gerencia **apenas** o próprio pool (`user.groupId`). Todas as telas/ações desta PRD. |
| `super_admin` | Pode usar as telas (conveniência operacional) e, via secret/sessão, alcançar qualquer pool pelos endpoints admin existentes. Não é o foco da PRD. |

**O Group Admin pode:** aprovar/rejeitar pendentes, bloquear/desbloquear participantes, excluir bloqueados, promover participante a admin, editar o grupo, gerar/gerir convites.
**O Group Admin NÃO pode:** ver outros grupos, aprovar grupos, editar resultados da Copa, acessar dashboard global, **remover/rebaixar o Super Admin**, promover um usuário de outro pool.

### Decisões travadas (resolvem ambiguidades do doc)
- **D1 — Coleção:** reusa `pools` (PRD-09). O texto do doc chama de `groups`; ⚠️ **`groups` é o torneio** — usar `pools`. `user.groupId` → `pools/{id}`.
- **D2 — Escopo da sessão:** o `groupId` do admin vem **da sessão server-side** (`users/{uid}.groupId`), nunca do body/query. Toda rota resolve o pool do admin e filtra por ele.
- **D3 — "Promover para Admin" (PRD10-03):** reusa o endpoint **troca de admin** da PRD-09 (`PATCH /api/admin/groups/[id]/admin`) ou um wrapper `/api/group/users/promote` escopado ao pool do admin. Regra "somente um admin principal por grupo" ⇒ promover **troca** o admin (o anterior vira `participant`). ⚠️ Default adotado: **troca de admin** (1 admin principal). Co-admins múltiplos ficam fora de escopo.
- **D4 — "Excluir" (PRD10-04):** ⚠️ o PNG mostra só o botão **Desbloquear**; "Excluir" vem do texto. Default: **soft-delete** — `status` permanece `blocked` e marca-se `removedFromGroupAt`/limpa `groupId`, sem apagar o `users/{uid}` (preserva auditoria/histórico de palpites e respeita Spark). Hard-delete do doc fica fora de escopo.
- **D5 — Pontuação/posição (PRD10-03):** os campos "2.450 pts" e "1º lugar" vêm do ranking **por pool** já produzido na PRD-09 (`rankings/pool-{poolId}-geral` / `statistics/{uid}`). A PRD-10 **lê**, não recalcula.
- **D6 — Foto do grupo:** base64 comprimido client-side (igual avatar PRD-06/PRD-09 A4). ⚠️ PNG diz "até 2MB" = teto de entrada antes da compressão; persistido bem abaixo de 1MB.
- **D7 — Convites:** nova coleção `invites`. `code` único global (slug curto). Link = `bolao.app/invite/{code}`. A **redenção** do convite no signup (entrar no pool via código) é tratada no fluxo de cadastro; a PRD-10 entrega **geração e gestão** (criar/listar/revogar). ⚠️ Se a redenção for requisito de aceite, ver Ambiguidade A2.
- **D8 — Visibilidade do menu:** seção "Administração do Grupo" visível para `group_admin` (e `super_admin`). ProfileHub hoje testa `role === "admin"` (legado) → ajustar para os helpers `isGroupAdminRole`/`isSuperAdminRole`.

## 5. Telas (fonte de verdade = PNG)

### PRD10-01 — Dashboard do Grupo
**Objetivo:** visão geral do grupo.
**Header:** "‹ Administração do Grupo" + faixa com foto do pool + nome ("Bolão dos Parças").
**Cards (Visão geral) — 4, grid 2×2:**
- **Participantes** (ícone usuários, ex. 128) — aprovados do pool.
- **Pendentes** (ícone relógio, ex. 12).
- **Bloqueados** (ícone escudo, ex. 5).
- **Convites Ativos** (ícone elo, ex. 8). ⚠️ Texto diz só "Convites"; PNG diz "Convites Ativos".

**Últimos Cadastros** — cabeçalho com link **"Ver todos"**; lista de itens: avatar (inicial), **Nome**, **Data** (`10/06/2026`), **Status** (badge colorido: Pendente=âmbar, Aprovado=verde), chevron ›.
**Ações Rápidas** — 3 botões/cards com ícone: **Pendentes**, **Convites**, **Configurações**. ⚠️ Texto diz "Aprovar Usuários"; PNG diz "Pendentes".
**Tab bar inferior:** Início · Jogos · Palpites · Ranking · Perfil (navegação global do app, não da PRD).
**Estados:** loading=skeleton dos cards/lista; error="Erro ao carregar informações." + "Tentar novamente"; empty (últimos cadastros)="Nenhum registro encontrado.".

### PRD10-02 — Usuários Pendentes
**Objetivo:** gerenciar solicitações de entrada no pool.
**Header:** "‹ Usuários Pendentes".
**Busca:** campo "Buscar por nome ou e-mail" + botão de **filtro** (ícone funil). ⚠️ Não no texto.
**Lista (cards):** avatar (inicial, fundo verde claro), **Nome** (negrito), **e-mail** (cinza), **Data de cadastro** (`10/06/2026`). À direita, **dois botões inline**: ✓ **Aprovar** (verde) · ✗ **Rejeitar** (vermelho).
**Rodapé:** contador "12 pendentes".
**Ações:** Aprovar → `status: pending→approved`. Rejeitar → `status: pending→blocked` (rejeição = bloqueado, alinhado à infra existente; ⚠️ o doc cita `rejected` mas a infra usa `approved|pending|blocked` — **mapear rejeitar→blocked**, ver A1).
**Confirmação:** reusa `ConfirmActionDialog` (padrão admin existente).
**Estados:** skeleton / "Nenhum usuário pendente." / erro+retry.

### PRD10-03 — Usuários Aprovados
**Objetivo:** visualizar e moderar participantes ativos.
**Header:** "‹ Usuários Aprovados".
**Busca:** "Buscar por nome" + filtro.
**Tabs segmentadas:** **Todos** · **Participantes** · **Admins**. ⚠️ Não no texto — filtra a lista por papel.
**Lista (ranqueada):** número de posição (1,2,3…), avatar, **Nome**, **e-mail**, **pontuação** ("2.450 pts"), **posição no ranking** ("1º lugar"), e **menu kebab** (⋮) à direita com as ações.
**Ações (no kebab):** **Bloquear** (`approved→blocked`) · **Promover para Admin** (troca de admin, D3). ⚠️ Texto lista as ações soltas; PNG as coloca no kebab.
**Rodapé:** "128 participantes".
**Regras:** não exibir/permitir bloquear ou rebaixar o `super_admin`; promover exige usuário **do mesmo pool**.
**Campos de ranking:** lidos da PRD-09 (D5); se ainda não houver recalc, exibir "—".
**Estados:** skeleton / "Nenhum participante." / erro+retry.

### PRD10-04 — Usuários Bloqueados
**Objetivo:** gerenciar bloqueios.
**Header:** "‹ Usuários Bloqueados".
**Busca:** "Buscar por nome" + filtro.
**Lista (cards):** avatar, **Nome**, **e-mail**, **"Motivo: …"** (ex.: "Ofensa a membros", "Spam", "Comportamento inadequado", "Violação de regras"), **"Bloqueado em DD/MM/YYYY"**, e botão **Desbloquear** (outline) à direita.
**Ações:** **Desbloquear** (`blocked→approved`). **Excluir** (D4: soft-delete) — ⚠️ não aparece no PNG; expor em kebab/overflow no card.
**Motivo do bloqueio:** ⚠️ exige um campo `blockReason` no usuário/registro de moderação — **net-new** (a infra atual não persiste motivo). Capturar no momento do bloqueio (PRD10-03) via dialog opcional; default "—" para bloqueios legados.
**Rodapé:** "5 bloqueados".
**Estados:** skeleton / "Nenhum usuário bloqueado." / erro+retry.

### PRD10-05 — Configurações do Grupo
**Objetivo:** editar informações do grupo.
**Header:** "‹ Configurações do Grupo".
**Seção "Informações do grupo":**
- **Nome do Grupo*** (obrigatório) — input ("Bolão dos Parças").
- **Descrição** — textarea com **contador `NN/160`** (PNG mostra `63/160`). Limite 160 = `poolSchema.description`.
- **Foto do Grupo** — preview (ícone/escudo) + botão **"Alterar foto"** + hint "PNG, JPG até 2MB" (D6).
**Seção "Configurações":**
- **Limite de participantes** — input numérico ("200"). ⚠️ Campo **net-new** no `poolSchema` (`maxParticipantes`/`maxParticipants`).
- **Permitir convites** — **toggle** + subtítulo "Permitir que membros convidem outros usuários através de link". ⚠️ Campo **net-new** (`permitirConvites`/`allowInvites`, boolean).
**Botão:** **"Salvar alterações"** (primário, verde, full-width).
**Estados:** validação inline (nome obrigatório, descrição ≤160); toast sucesso/erro; salvar desabilitado enquanto pendente.

### PRD10-06 — Convites
**Objetivo:** gerar e gerir convites do grupo.
**Header:** "‹ Convites".
**Tabs segmentadas:** **Link de convite** · **Código de convite**. ⚠️ PNG; texto cita os dois "tipos" soltos.
**Aba Link:** texto "Compartilhe o link abaixo…"; campo read-only **`bolao.app/invite/abc123`** + botão **copiar**; botão primário **"Compartilhar link"** (Web Share API).
**Aba Código:** exibe o **código** (ex.: `ABC123`) com copiar (mesma fonte de dado, view alternada).
**Card "Configurações do convite":** **Validade** ("30 dias"), **Limite de usos** ("100"), **Usos atuais** ("28"). ⚠️ "Usos atuais" não está no texto — vem de `invites.usedCount`.
**Botão:** **"Gerar novo link"** (cria novo `invite`, revoga/expira o anterior ou coexiste — ver A3).
**Card "Convites ativos":** link "Ver todos"; itens: rótulo ("Link principal"), "Criado em DD/MM/YYYY", "28/100 usos", chevron.
**Estados:** skeleton / "Nenhum convite ativo." / erro+retry; respeitar flag `permitirConvites` (PRD10-05) — se off, bloquear geração.

## 6. Regras de negócio

- **Isolamento:** Group Admin vê e age **apenas** sobre usuários/convites com `groupId === user.groupId`. Validado server-side em **toda** rota.
- **Transições de status do usuário** (reusa `canTransition` da infra existente): `pending→approved` (aprovar), `pending→blocked` (rejeitar), `approved→blocked` (bloquear), `blocked→approved` (desbloquear). Mapeamento `rejected ≡ blocked` (A1).
- **Promover para admin** = troca do admin principal do pool (1 admin/grupo); admin anterior → `participant`. Nunca rebaixa `super_admin`.
- **Proteção do Super Admin:** não pode ser bloqueado, rejeitado, excluído nem rebaixado por um `group_admin`.
- **Convites:** `code` único; `usedCount ≤ maxUses`; convite expira por `expiresAt` **ou** ao atingir `maxUses`; `isActive=false` o oculta. Geração respeita `permitirConvites`.
- **Limite de participantes:** `maxParticipants` é teto informativo/guard — aprovar além do limite ⇒ bloquear com mensagem (A4: enforced ou apenas exibido — default **soft**, só avisa).
- **Estados de UI padronizados:** Loading=skeleton; Empty="Nenhum registro encontrado."; Error="Erro ao carregar informações." + "Tentar novamente".

## 7. Modelo Firestore

### `pools/{id}` (estende PRD-09 — campos net-new)
```jsonc
{
  "id": "", "name": "", "slug": "", "description": "", "photoBase64": "",
  "status": "active", "adminId": "", "createdAt": "", "updatedAt": "",
  // NET-NEW PRD-10:
  "maxParticipants": 200,   // limite de participantes (PRD10-05)
  "allowInvites": true       // flag "permitir convites" (PRD10-05)
}
```
> Ambos opcionais no schema (aditivos — não quebram pools criados na PRD-09). Default na leitura: `maxParticipants` ausente = sem limite; `allowInvites` ausente = `true`.

### `users/{uid}` (estende PRD-09)
```jsonc
{
  "uid": "", "name": "", "email": "", "groupId": "",
  "role": "participant", "status": "approved",
  // NET-NEW PRD-10 (opcional):
  "blockReason": "",            // motivo do bloqueio (PRD10-04)
  "removedFromGroupAt": ""       // soft-delete (PRD10-04, D4)
}
```

### `invites/{id}` (NET-NEW)
```jsonc
{
  "id": "",                  // = id do doc
  "groupId": "",             // pool dono (isolamento)
  "code": "ABC123",          // único global, slug curto
  "label": "Link principal", // rótulo opcional (PRD10-06)
  "maxUses": 100,
  "usedCount": 0,
  "expiresAt": "<isoDateTime>",
  "isActive": true,
  "createdBy": "",           // uid do admin
  "createdAt": "<isoDateTime>"
}
```
> `code` único: doc-id derivado do code **ou** checagem transacional (espelha unicidade de slug, PRD-09 TASK-04). `usedCount`/redenção: incremento transacional no signup (A2).

## 8. Índices Firestore

- `users(groupId, status)` — listas pendentes/aprovados/bloqueados por pool (já previsto PRD-09; confirmar).
- `users(groupId, role)` — tab "Admins/Participantes" (PRD10-03).
- `invites(groupId, isActive)` — "convites ativos" por pool.
- `invites(code)` — lookup por código (unicidade/redenção). Se `code` = doc-id, dispensa índice.
- `invites(groupId, createdAt)` — ordenação "Ver todos".

## 9. Route Handlers (`/api/group/*`, Admin SDK, escopados por sessão)

Todas autorizam via novo helper `authorizeGroupAdminOfPool()` (espelha `authorizeGroupAdmin` da PRD-09, mas resolve `users/{uid}.groupId` e exige `isGroupAdminRole||isSuperAdminRole`; retorna `{ user, groupId }` ou 401/403). **`groupId` sempre da sessão.**

| Método | Rota | Função |
|---|---|---|
| GET | `/api/group/dashboard` | Contadores (participantes/pendentes/bloqueados/convites ativos) + últimos cadastros. |
| GET | `/api/group/users/pending` | Pendentes do pool. |
| GET | `/api/group/users/approved` | Aprovados do pool (com ranking lido). |
| GET | `/api/group/users/blocked` | Bloqueados do pool (com motivo). |
| POST | `/api/group/users/approve` | `pending→approved`. |
| POST | `/api/group/users/reject` | `pending→blocked`. |
| POST | `/api/group/users/block` | `approved→blocked` (+ `blockReason`). |
| POST | `/api/group/users/unblock` | `blocked→approved`. |
| POST | `/api/group/users/promote` | Promove a admin do pool (troca; wrapper sobre PRD-09 admin-swap, escopado). |
| POST | `/api/group/users/remove` | Soft-delete de bloqueado (D4). |
| PATCH | `/api/group/settings` | Atualiza nome/descrição/foto/`maxParticipants`/`allowInvites`. |
| GET | `/api/group/invites` | Lista convites ativos do pool. |
| POST | `/api/group/invites` | Cria convite (code único, validade, maxUses). |
| PATCH/DELETE | `/api/group/invites/[id]` | Revoga/expira convite (`isActive=false`). |

> **Read/Write split:** escritas via route handler + Admin SDK; leituras das telas podem ir por fetch (igual `pools.ts`) para o admin enxergar dados que as rules restringem no client. Side-effects de moderação (log + notificação) reusam `notificationFactory` + `recordModerationSideEffects` (PRD-07/08).

## 10. React Query — query keys

```ts
["group-dashboard"]
["group-users", "pending"]
["group-users", "approved"]
["group-users", "blocked"]
["group-invites"]
["group-settings"]
```
> Factory único (espelha `usersKeys`): `groupKeys.dashboard()`, `groupKeys.usersByStatus(status)`, `groupKeys.invites()`, `groupKeys.settings()`. Mutações invalidam origem+destino (mesma estratégia anti-drift do `useUpdateUserStatus`).

## 11. Segurança (isolamento por `groupId`)

- **Server-side obrigatório:** `user.groupId === resource.groupId` em toda rota. O `groupId` vem **sempre da sessão**, nunca do request — impede um admin do pool X moderar usuário/convite do pool Y forjando o body.
- **Rules `firestore.rules`:** `invites` → `read: isApproved() && resource.data.groupId == request.auth.token.groupId`; `write: if false` (só Admin SDK). `users` continua write-server-side. Reusa claim `groupId` (populada na PRD-09 TASK-06).
- **Proteções de papel:** helpers `isSuperAdminRole`/`isGroupAdminRole`/`isParticipantRole` (PRD-09) — nunca comparar strings cruas. Group Admin não pode tocar `super_admin`.
- **Path/ID validation:** validar IDs e nunca confiar em `groupId` do client (D2). `code` de convite não-adivinhável.

## 12. Responsividade

Mobile-first conforme PNGs: **360 / 390 / 430** (telefone), **768** (tablet), **1024+** (desktop). Cards do dashboard em grid 2×2 no mobile → linha no desktop. Listas em cards full-width; botões de ação com alvo de toque ≥44px. Tabs segmentadas roláveis no mobile.

## 13. Stack e reuso

- TS strict · Tailwind v4 · shadcn/base-ui · React Query v5 · Zod. App Router (`src/app/group/*` + `src/features/group/*`).
- **Reusa (não duplica):** `useUpdateUserStatus`/`canTransition`/`notificationFactory`/`ConfirmActionDialog`/`UserListItem`-família (PRD-07/08 admin); `poolSchema`/`pools.ts`/`authorizeGroupAdmin` (PRD-09); compressão de avatar (PRD-06) para a foto do grupo; ranking por pool (PRD-09) para pts/posição.
- **Net-new:** schema `invites`; campos `pools.maxParticipants`/`allowInvites`, `users.blockReason`; helper `authorizeGroupAdminOfPool`; rotas `/api/group/*`; feature slice `src/features/group`; seção no `ProfileHub`.

## 14. Critérios de aceite

- [ ] Admin visualiza o **dashboard** do próprio grupo (contadores + últimos cadastros + ações rápidas).
- [ ] Admin **aprova** e **rejeita** pendentes (status atualizado).
- [ ] Admin **bloqueia** e **desbloqueia** participantes.
- [ ] Admin **promove** participante a admin do grupo (troca; anterior vira participant; super_admin intocável).
- [ ] Admin **exclui** (soft-delete) usuário bloqueado.
- [ ] Admin **edita** o grupo (nome/descrição/foto/limite/permitir convites) e salva.
- [ ] Admin **gera** e **lista** convites (link + código, validade, usos).
- [ ] Admin acessa **apenas** o próprio grupo (rota 403 / rule deny ao tentar pool alheio).
- [ ] Telas alcançáveis pela seção **"Administração do Grupo"** no perfil (role-gated `group_admin`).
- [ ] Firestore atualizado corretamente; funciona em mobile e desktop; compatível com Firebase Spark.

## 15. Ambiguidades resolvidas com default

- **A1 — `rejected` vs `blocked`:** infra usa `pending|approved|blocked`. **Default: rejeitar = `blocked`** (reusa `canTransition`), preservando o vocabulário "rejeitar" na UI. Sem novo status.
- **A2 — Redenção de convite no signup:** a PRD-10 entrega **geração/gestão**; a redenção (entrar no pool via código, incrementar `usedCount`) é do fluxo de cadastro. **Default:** incluir o endpoint/serviço de redenção como dependência leve do signup, mas o critério de aceite da PRD-10 cobre só geração/listagem. Sinalizar se a redenção for exigida aqui.
- **A3 — "Gerar novo link":** **Default:** cria um novo `invite` ativo e **expira o anterior** (`isActive=false`) — um link principal por vez; "Convites ativos" pode conter históricos enquanto válidos.
- **A4 — `maxParticipants` enforcement:** **Default soft** — exibido e usado como aviso ao aprovar; bloqueio rígido (recusar aprovação acima do teto) fica como flag de configuração, não default.
- **A5 — `blockReason`:** campo net-new opcional; capturado num dialog no bloqueio (PRD10-03), "—" para bloqueios sem motivo.
