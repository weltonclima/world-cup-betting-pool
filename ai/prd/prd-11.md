# PRD — PRD-11 Super Admin (administração global da plataforma)

> Fonte: `docs/prd-11/prd-11.md` + 7 PNGs em `docs/prd-11/PRD11-0X-*.png` (layout = **fonte de verdade**; PNG vence o texto em conflito).
> Construído sobre PRD-09 (multi-tenancy de `pools`, papéis `participant|group_admin|super_admin`, dupla-compat `user|admin`). Reaproveita endpoints admin de pool já entregues na PRD-09 (`/api/admin/groups/[id]/status`, `/api/admin/groups/[id]/admin`), a infra worldcup/copaData e a coleção `system_logs`.

## 1. Feature summary

Entrega a **área administrativa global** do Super Admin — o papel de plataforma (sucessor do `admin`). É a camada de UI + agregação que faltava sobre o backend já existente da PRD-09, mais quatro frentes net-new:

1. **Dashboard global** — estatísticas agregadas de toda a plataforma (grupos, usuários, palpites, jogos, última sincronização) + feed de atividade recente.
2. **Gestão de grupos (pools)** — aprovar/rejeitar pendentes, bloquear ativos, reativar/excluir bloqueados, trocar/transferir admin. **Reusa** as rotas PRD-09 `PATCH /api/admin/groups/[id]/status` e `PATCH /api/admin/groups/[id]/admin` — a PRD-11 entrega a **UI** sobre elas, mais as queries de listagem por status.
3. **Gestão de administradores** — lista de `group_admin`, substituir, remover (rebaixar a `participant`), transferir grupo.
4. **Gestão da Copa** — **sincronização OpenFootball → Firestore** (net-new: hoje os matches são buscados ao vivo e só cacheados em `worldcup_cache`; a PRD-11 **persiste** `matches/{id}` no Firestore) e **edição manual de partidas** com `isManualOverride`.
5. **Auditoria** — logs globais (sincronização, edição manual, aprovação/bloqueio de grupo, troca de admin), estendendo `system_logs`.

**Fora de escopo:** dashboard do group_admin (PRD-10), criação/busca de grupo pelo participante (PRD-09), recalc de ranking (PRD-09). A PRD-11 **consome** o que a PRD-09 definiu.

### Decisão de arquitetura central (sync de matches)
Hoje **não existe coleção `matches` no Firestore** — `src/server/copaData` busca o JSON openfootball ao vivo e `src/app/api/worldcup/{groups,bracket}` cacheiam o **resultado computado** em `worldcup_cache` (read-through, TTL dinâmico). A PRD-11 introduz a **persistência** de `matches/{id}` (doc-id = `buildMatchId`, já determinístico no mapper) via `POST /api/admin/worldcup/sync`. A partir daí, `matches` passa a ser fonte de verdade editável — e o sync **nunca pode sobrescrever** um match com `isManualOverride: true`.

## 2. Escopo consolidado

### Inclui
1. **Dashboard global** (PRD11-01): cards de KPI + painel "Última Sincronização" + feed "Atividade Recente".
2. **Grupos Pendentes** (PRD11-02): lista + aprovar/rejeitar.
3. **Grupos Ativos** (PRD11-03): lista + visualizar/bloquear/alterar admin.
4. **Grupos Bloqueados** (PRD11-04): lista + reativar/excluir.
5. **Administradores** (PRD11-05): lista de group_admins + substituir/remover/transferir grupo.
6. **Sincronização OpenFootball** (PRD11-06): botão "Sincronizar agora", painel da última sincronização, processo fetch→normaliza→escreve Firestore→log.
7. **Jogos da Copa** (PRD11-07): lista de partidas com filtros (grupo/fase/seleção/status) + ação editar.
8. **Editar Resultado** (PRD11-08): formulário de correção manual (placares, status, estádio, data/hora) → grava `editedBy/editedAt/isManualOverride`.
9. **Logs do Sistema** (PRD11-09) + **Detalhes do Log** (PRD11-10): tabela de auditoria + drill-down.
10. **Wiring no menu de perfil**: seção "Super Admin" role-gated (`role === "super_admin"`, dupla-compat `admin`) em `ProfileHub`.
11. **Schema/infra**: extensão do `matchSchema` (campos de edição + override), `syncLogSchema`, extensão do `systemLogTypeSchema`, rules + índices de `matches`/`sync_logs`.

### Não inclui (delega)
- Recalc/leitura de ranking por pool → PRD-09 (já entregue).
- Aprovação de **usuários** e dashboard do group_admin → PRD-10.
- Cloud Functions de qualquer espécie (restrição Spark) — toda escrita via Route Handler + Admin SDK.
- Reescrita do enum de role / backfill → PRD-09 (já entregue; PRD-11 apenas consome).

## 3. Entendimento do sistema relevante

### Já existe (reuso)
- **Autorização admin**: `src/app/api/admin/groups/_authorize.ts#authorizeGroupAdmin` — dois caminhos: secret `x-admin-secret == GROUPS_ADMIN_SECRET` (cron/seed) **ou** sessão super_admin (`requireApprovedUser` + `isSuperAdminRole`, dupla-compat `admin||super_admin`). **Todas as rotas `/api/admin/*` da PRD-11 reusam este helper.**
- **Transição de status de pool**: `PATCH /api/admin/groups/[id]/status` — transação `canTransitionPool` (`pending→active/blocked`, `active↔blocked`); 409 em transição inválida. **Backing das telas PRD11-02/03/04.**
- **Troca de admin de pool**: `PATCH /api/admin/groups/[id]/admin` — transação atômica pool↔users (promove novo a `group_admin`, rebaixa anterior a `participant`). **Backing de "Alterar Admin" / "Substituir" / "Transferir Grupo".**
- **copaData**: `fetchAllMatches()` / `fetchAllTeams()` (openfootball→`MatchWithId[]`), `mapOpenFootballMatch` + `buildMatchId` (doc-id determinístico: `m{num}` mata-mata, `{date}-{slug}-{slug}` grupo), `resolveTeam`/`teamRegistry`. **Reaproveitados pelo sync.**
- **matchSchema** (`src/schemas/matches.ts`): `{ homeTeamId, awayTeamId, kickoffAt, stage, round?, groupId?, venue?, status, homeScore, awayScore }` com refinement placar↔status. **PRD-11 estende** (campos de edição).
- **system_logs** (`src/schemas/systemLogs.ts` + `src/services/systemLogs.ts`): `{ id, type, actorUid, targetUid?, message, level, createdAt }`, append client-side, leitura admin-only. `systemLogTypeSchema` atual: `login_admin|user_approved|user_blocked|user_unblocked|api_error|ranking_update`. **PRD-11 estende o enum**, não duplica a coleção.
- **worldcup_cache**: read-through TTL para groups/bracket. **Não confundir com `matches`** — o sync grava `matches`; as rotas worldcup continuam cacheando o computado.

### Net-new
- Coleção **`matches`** (persistida pela 1ª vez), coleção **`sync_logs`**.
- Agregação de estatísticas globais (dashboard).
- Slice `src/features/admin/*` (telas globais) — distinto do `/admin/*` de usuários (PRD-07).

### Reconciliação `/admin` (PRD-07 vs PRD-11)
Já existe `/admin/*` (aprovação de usuários, logs, api-status — PRD-07) gated por `role === "admin"`. **Manter** essas telas. A PRD-11 adiciona as telas **globais de plataforma** sob `/admin/*` (dashboard global, grupos, administradores, copa, sync, logs globais) e **migra o gate** do `ProfileHub` para `role === "super_admin"` (dupla-compat `admin`). A seção do menu passa a se chamar **"Super Admin"** e agrupa ambas as famílias (usuários da PRD-07 + globais da PRD-11).

## 4. Telas (PNG = fonte de verdade)

> Estados comuns a todas (PNG + doc): **Loading** = skeleton; **Empty** = "Nenhum registro encontrado."; **Error** = "Erro ao carregar informações." + botão "Tentar novamente". Tab bar inferior fixa (Início, Jogos, Palpites, Ranking, Perfil) — as telas admin vivem dentro do app autenticado.

### PRD11-01 — Dashboard Global  (`is_frontend`)
- **Header**: saudação "Olá, Super Admin!" + avatar.
- **Cards KPI** (grid 2-col mobile): **Grupos Ativos**, **Grupos Pendentes**, **Participantes**, **Administradores**, **Jogos**, **Última Sincronização** (mostra contagem de jogos da última sync). Cada card: ícone + número grande + rótulo.
- **Painel "Última Sincronização"**: timestamp (`dd/MM/yyyy às HH:mm`) + botão **"Sincronizar agora"** (atalho que dispara o sync da PRD11-06).
- **"Atividade Recente"** com link **"Ver todos"** → leva aos logs (PRD11-09). Feed = últimos N `system_logs` (ícone por tipo, título, "Há X min").
- Fonte: `["admin-dashboard"]` (GET `/api/admin/dashboard`) + `["admin-logs"]` (preview).

### PRD11-06 — Sincronização OpenFootball  (`is_frontend`, alto risco)
- **Fonte**: "OpenFootball" + link **"Ver repositório"** (`https://github.com/openfootball/worldcup.json/tree/master/2026`).
- **Painel "Dados da última sincronização"**: Data, **Jogos atualizados**, **Seleções atualizadas**, **Grupos atualizados** (lê o último `sync_logs`).
- **Botão "Sincronizar agora"** (full-width, primary) → `POST /api/admin/worldcup/sync`; estados loading/disabled durante execução; toast de sucesso/erro.
- Processo (doc): 1) buscar OpenFootball, 2) normalizar, 3) atualizar Firestore, 4) gerar log. **Regra crítica**: matches com `isManualOverride: true` são **preservados** (não sobrescritos).

### PRD11-02 — Grupos Pendentes  (`is_frontend`)
- **Busca** ("Buscar por nome ou slug") + ícone de **filtro**.
- **Lista** de cards: avatar do grupo, **Nome**, **slug/subtítulo**, **data** de criação.
- **Ações por linha** (PNG): botão verde **✓ (Aprovar)** + botão vermelho **✗ (Rejeitar)**.
  - Aprovar → `PATCH /status {status:"active"}`. Rejeitar → `PATCH /status {status:"blocked"}` (ver Ambiguidade B1: doc diz `rejected`, mas o domínio só tem `pending|active|blocked`; default = `blocked`).
- Fonte: `["admin-groups-pending"]`.

### PRD11-03 — Grupos Ativos  (`is_frontend`)
- **Busca** + **filtro**.
- **Lista**: avatar, **Nome**, subtítulo, **nº participantes**, badge verde **"Ativo"**.
- **Ações**: **Visualizar** (detalhe), **Bloquear** (`PATCH /status {status:"blocked"}`), **Alterar Admin** (`PATCH /admin {adminId}` — abre seletor de membro do pool).
- Fonte: `["admin-groups-active"]`.

### PRD11-04 — Grupos Bloqueados  (`is_frontend`)
- **Busca**.
- **Lista**: avatar, Nome, subtítulo, badge vermelho **"Bloqueado"**.
- **Ações**: **Reativar** (`PATCH /status {status:"active"}`), **Excluir** (`DELETE /api/admin/groups/[id]` — ver Ambiguidade B2: net-new, soft-delete recomendado).
- Fonte: `["admin-groups-blocked"]` (variação de `["admin-groups", "blocked"]`).

### PRD11-05 — Administradores  (`is_frontend`)
- **Busca** ("Buscar administrador") + **filtro**.
- **Lista**: avatar, **Nome**, **"Grupo: {nome}"**, **"Desde {dd/MM/yyyy}"**.
- **Ações**: **Substituir** / **Remover** / **Transferir Grupo** — todas mapeiam para `PATCH /api/admin/groups/[id]/admin` (substituir/transferir = trocar `adminId`; remover = rebaixar a `participant` — ver Ambiguidade B3).
- Fonte: `["admin-admins"]` (GET `/api/admin/admins`).

### PRD11-07 — Jogos da Copa  (`is_frontend`)
- **3 dropdowns de filtro** (PNG): **"Todos os grupos"**, **"Todas as fases"**, **"Todos os status"**. (Doc lista 4 filtros incluindo "Seleção"; PNG mostra 3 — PNG vence; "Seleção" tratada como busca opcional/secundária, ver B4.)
- **Lista agrupada por dia** ("Hoje", "Amanhã"): card com **bandeira + nome mandante**, **horário** (`HH:mm`), **data** (`dd/MM/yyyy`), **fase + rodada** ("A - Rodada 1"), **estádio/cidade** ("Mexico City - Mexico City"), **bandeira + nome visitante**, **badge de status** ("Agendado").
- **Ações**: **Visualizar** / **Editar** → PRD11-08.
- Fonte: `["admin-matches", filtros]` (GET `/api/admin/matches`).

### PRD11-08 — Editar Resultado  (`is_frontend`, alto risco)
- **Header** do jogo: bandeiras + horário (somente leitura do confronto).
- **Campos editáveis**: **Gols Mandante**, **Gols Visitante** (numéricos), **Status** (dropdown: Agendado/Ao vivo/Encerrado/Adiado/Cancelado), **Estádio** ("Estádio Azteca - Mexico City"), **Data** + **Hora** (`kickoffAt`). PNG mostra um **toggle** no rodapé do form → mapeado para confirmar override (ou exibir `isManualOverride`).
- **Botão "Salvar Alterações"** → `PUT /api/admin/matches/[id]`.
- **Campos internos gravados**: `editedBy` (uid), `editedAt` (ISO), `isManualOverride: true`.
- Respeitar o refinement placar↔status do `matchSchema` (ex.: `finished` exige ambos placares).

### PRD11-09 — Logs do Sistema  (`is_frontend`) + PRD11-10 — Detalhes do Log
- **Logs**: busca ("Buscar logs") + filtro; lista de entradas com **ícone colorido por tipo**, **título** (Sincronização da Copa / Grupo aprovado / Resultado editado / Administrador alterado / Grupo bloqueado), **linha de detalhe** (ex.: "Grupo: Bolão da Firma", "Jogo: México 2 x 1 África do Sul") e **"Executado por: {nome}"** + timestamp.
- **Detalhes do Log**: drill-down — Executado por, Tipo de ação, data, **Resumo** (para sync: Jogos/Seleções/Grupos atualizados) + badge de status ("Concluído").
- Fonte: `["admin-logs", filtro]` (GET `/api/admin/logs`).

## 5. Regras de negócio

- **R-OVERRIDE (crítica)**: ao sincronizar, partidas com `isManualOverride === true` **não são sobrescritas**. O sync lê o doc atual antes de escrever; se override, pula (não toca `homeScore/awayScore/status/venue/kickoffAt`). Edição manual (`PUT /matches/[id]`) sempre seta `isManualOverride: true`, `editedBy`, `editedAt`.
- **R-STATUS**: transições de pool seguem `canTransitionPool` (reuso PRD-09): `pending→active`, `pending→blocked`, `active↔blocked`. Transição inválida → 409.
- **R-PLACAR**: edição manual respeita o refinement do `matchSchema` — `finished` exige ambos placares; `scheduled/postponed/canceled` exigem ambos `null`; `live` aceita ambos ou ambos `null`.
- **R-ADMIN**: "Remover" admin rebaixa a `participant` (não exclui usuário); "Substituir"/"Transferir" trocam `adminId` via transação (promove novo, rebaixa anterior).
- **R-LOG**: toda ação de mutação admin (sync, edição manual, aprovação/rejeição/bloqueio/reativação de grupo, troca/remoção de admin) **registra** em `system_logs` com `actorUid = super_admin`. `sync_logs` guarda o **resumo numérico** da sincronização (separado, para o painel da PRD11-06/10).
- **R-AUTH**: toda rota `/api/admin/*` exige `role === "super_admin"` (server-enforced via `authorizeGroupAdmin`, dupla-compat `admin`). Nunca confiar no frontend.

## 6. Modelo Firestore

### `pools/{slug}` (PRD-09, reuso)
`{ id, name, slug, description?, photoBase64?, status: pending|active|blocked, adminId, createdAt, updatedAt }`

### `users/{uid}` (PRD-09, reuso)
`{ uid, name, nickname, email, role: participant|group_admin|super_admin (dupla-compat user|admin), status, groupId?, ... }`

### `matches/{matchId}` (estendido — net-new persistência)
matchId = `buildMatchId` (determinístico). Campos atuais + **net-new**:
```json
{
  "homeTeamId": "", "awayTeamId": "", "kickoffAt": "ISO",
  "stage": "grupos", "round": 1, "groupId": "A",
  "venue": { "name": "", "city": "" },
  "status": "scheduled", "homeScore": null, "awayScore": null,
  "editedBy": null, "editedAt": null, "isManualOverride": false,
  "syncedAt": "ISO"
}
```
- `editedBy`/`editedAt`: `null` até a 1ª edição manual.
- `isManualOverride`: default `false`; `true` blinda do sync.
- `syncedAt`: último carimbo de sincronização (auditoria).

### `sync_logs/{id}` (net-new)
```json
{ "id": "", "executedBy": "uid", "executedAt": "ISO",
  "matchesUpdated": 0, "matchesSkipped": 0, "teamsUpdated": 0,
  "groupsUpdated": 0, "status": "success|partial|error", "message": "" }
```
(`matchesSkipped` = quantos overrides foram preservados; `status`/`message` para o badge "Concluído" da PRD11-10.)

### `system_logs/{id}` (estendido)
`systemLogTypeSchema` ganha: `worldcup_synced`, `match_edited`, `group_approved`, `group_rejected`, `group_blocked`, `group_reactivated`, `pool_admin_changed`. Demais campos inalterados.

### Índices (`firestore.indexes.json`)
- `pools(status, createdAt desc)` — listagens por status (pending/active/blocked).
- `matches(stage, kickoffAt)`, `matches(groupId, kickoffAt)`, `matches(status, kickoffAt)` — filtros da PRD11-07.
- `sync_logs(executedAt desc)` — painel da última sync.
- `system_logs(type, createdAt desc)` — já previsto na PRD-07; confirmar cobertura dos novos tipos.

## 7. Route Handlers (`/api/admin/*` — todos via `authorizeGroupAdmin`)

| Método | Rota | Origem | Função |
|---|---|---|---|
| GET | `/api/admin/dashboard` | **net-new** | Agrega KPIs (counts de pools por status, users, predictions, matches, última sync). |
| GET | `/api/admin/groups?status=` | **net-new** | Lista pools por status (pending/active/blocked) p/ PRD11-02/03/04. |
| PATCH | `/api/admin/groups/[id]/status` | **reuso PRD-09** | Aprovar/rejeitar/bloquear/reativar. + log. |
| PATCH | `/api/admin/groups/[id]/admin` | **reuso PRD-09** | Alterar/substituir/transferir admin. + log. |
| DELETE | `/api/admin/groups/[id]` | **net-new** | Excluir (soft-delete) grupo bloqueado (B2). |
| GET | `/api/admin/admins` | **net-new** | Lista group_admins (nome, grupo, desde). |
| POST | `/api/admin/worldcup/sync` | **net-new** | fetch→normaliza→escreve `matches` (skip override)→`sync_logs`+`system_logs`. BulkWriter. |
| GET | `/api/admin/matches?group=&stage=&status=` | **net-new** | Lista partidas filtradas. |
| PUT | `/api/admin/matches/[id]` | **net-new** | Edição manual → `isManualOverride/editedBy/editedAt` + log. |
| GET | `/api/admin/logs?type=` | **net-new** | Lista `system_logs` (já há `listLogs`; expor via rota admin se necessário). |

> Nota: o doc cita `POST /api/admin/groups/approve` e `/block` (rotas "flat"). **As rotas reais da PRD-09 são `PATCH /api/admin/groups/[id]/status`** — adotadas (evita duplicar lógica de transição). Ver Ambiguidade B5.

## 8. React Query keys

`["admin-dashboard"]` · `["admin-groups", status]` (pending/active/blocked) · `["admin-groups-pending"]` · `["admin-groups-active"]` · `["admin-admins"]` · `["admin-matches", filtros]` · `["admin-logs", filtro]` · `["admin-sync"]` (mutation + última sync). Invalidação cruzada: mutações de grupo/admin invalidam `admin-dashboard`; sync invalida `admin-matches`, `admin-dashboard`, `admin-logs`.

## 9. Segurança

- **`role === "super_admin"` server-enforced** em 100% das rotas via `authorizeGroupAdmin` (dupla-compat `admin`). Frontend nunca é fonte de autorização — o gate do menu é só UX.
- **Rules**: `matches` → `read: isApproved()`, `write: if false` (só Admin SDK via rota). `sync_logs` → `read: isSuperAdmin()`, `write: if false`. `system_logs` mantém leitura admin-only.
- **Middleware** `/admin/*` já protegido; estender gate a `super_admin`.
- **Sem Cloud Functions** — toda escrita via Route Handler + Admin SDK (Spark).
- Validar IDs (sem traversal), `secret` em tempo constante (`safeSecretEqual`, já existente).

## 10. Responsividade

Mobile-first 360/390/430 (PNGs nessas larguras), tablet 768, desktop 1024+. Cards KPI: grid 2-col mobile → 3/6-col desktop. Listas: cards empilhados mobile → tabela densa desktop. Forms (PRD11-08): full-width mobile.

## 11. Riscos

- **R1 (alto) — Sync + override + cotas Spark.** Persistir `matches` pela 1ª vez (~104 docs) com **proteção de override** (read-before-write por doc) e dentro das cotas de escrita do Spark exige `BulkWriter` e leitura prévia dos overrides. Erro = sobrescrever correção manual ou estourar cota. Mitigar: ler todos os matches existentes uma vez, montar set de overrides, escrever só os não-protegidos via `BulkWriter`.
- **R2 (alto) — Edição manual vs refinement de placar.** `PUT /matches/[id]` precisa respeitar o refinement `matchSchema` (status↔placar) e gravar `isManualOverride` atômico. Erro = doc inválido ou override perdido.
- **R3 (médio) — Agregação do dashboard.** Counts globais (pools, users, predictions, matches) sem agregação nativa barata no Spark; usar `count()` aggregation queries ou contadores. Risco de leitura cara.
- **R4 (médio) — Reconciliação `/admin` PRD-07 vs PRD-11.** Migrar o gate de `admin`→`super_admin` no `ProfileHub`/middleware sem quebrar as telas de usuário da PRD-07. Dupla-compat obrigatória.
- **R5 (baixo) — Semântica `rejected`/`excluir`.** Domínio de pool só tem `pending|active|blocked`; "rejeitar" e "excluir" precisam de mapeamento explícito (B1/B2).

## 12. Ambiguidades — resolvidas com default (PNG vence o texto)

- **B1 — "Rejeitar" grupo.** Doc diz `status = rejected`; domínio PRD-09 só tem `pending|active|blocked`. **Default: rejeitar = `blocked`** (com log `group_rejected`). Não introduzir novo status nesta PRD.
- **B2 — "Excluir" grupo (PRD11-04).** Net-new sem backend. **Default: soft-delete** (`deletedAt` + filtro nas listagens), não hard-delete — preserva integridade de `users.groupId` e ranking. `DELETE /api/admin/groups/[id]`.
- **B3 — "Remover" admin (PRD11-05).** **Default: rebaixar a `participant`** (não excluir usuário; pool fica sem admin até nova atribuição) — reusa a meia-transação de `PATCH /admin`.
- **B4 — Filtro "Seleção" (PRD11-07).** PNG mostra 3 dropdowns (grupo/fase/status); doc lista 4 (inclui Seleção). **PNG vence**: 3 filtros server-side; "Seleção" vira busca client-side opcional (não bloqueante).
- **B5 — Rotas de grupo flat vs `[id]`.** Doc cita `/api/admin/groups/approve|block`; PRD-09 entregou `PATCH /api/admin/groups/[id]/status`. **Default: adotar as rotas `[id]` existentes** (reuso, sem duplicar transição).
- **B6 — Status `live` no openfootball.** `mapStatus` só emite `scheduled|finished` (openfootball não tem live). `live` só existe via **edição manual**. OK — sem mudança no sync.
