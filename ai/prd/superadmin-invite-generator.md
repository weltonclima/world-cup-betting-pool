# PRD — Super Admin: Gerador de Convite por Grupo

## 1. Feature summary

Adicionar, no grid de grupos ativos do console `super_admin` (`GroupsActive.tsx`), a capacidade de gerar e visualizar links de convite para qualquer pool diretamente pelo super_admin. Hoje apenas o `group_admin` do próprio pool pode gerar convites — o fluxo `POST /api/group/invites` autentica via sessão e lê o `groupId` do doc do usuário logado. O `super_admin` é global (sem `groupId` no doc), então o endpoint existente retorna 403. O gap é crítico: ao criar um grupo via console (AdminGroupFormDialog), não existe `group_admin` nomeado ainda, então ninguém pode gerar o link inicial de convite exceto o próprio `super_admin`.

## 2. Consolidated scope

### O que muda (escopo mínimo: APENAS GERAR)
- **KebabMenu** de cada `ActiveRow` em `GroupsActive.tsx` ganha uma nova ação "Gerar convite" (ícone `Link`).
- Ao selecionar, abre um **Dialog** (`AdminGroupInviteDialog`) contendo:
  - Formulário (validityDays, maxUses) — **sem** campo `label`.
  - Aviso bloqueante quando `allowInvites === false` no pool.
  - Após gerar: exibe link + código do convite criado (reusa `InviteValue` + `inviteUrl` de `GroupInvites.tsx`) para copiar/compartilhar.
  - **Não** lista convites existentes, **não** revoga, **não** mostra card de configurações.
- **Novo Route Handler** `POST /api/admin/groups/[id]/invites` autorizado via `authorizeGroupAdmin()` (super_admin ou secret header). `groupId` = `params.id`. Aceita body `{ maxUses, validityDays }`. Verifica `allowInvites`, gera código, expira anteriores (A3), grava `system_logs` (auditoria). Retorna o invite criado.
- **Schema** — adicionar tipo `group_invite_created` ao enum append-only `systemLogTypeSchema`.
- **Serviço** — nova função `createAdminGroupInvite(poolId, input)` em `src/services/superAdmin.ts`.
- **Hook** — `useCreateAdminGroupInvite(poolId)` (mutation) em `src/features/superAdmin/hooks/`.

### O que NÃO muda
- Lógica de geração de código, unicidade, expiração de links anteriores (A3) e validação de `allowInvites` — espelhada do padrão existente.
- Endpoint `POST /api/group/invites` permanece inalterado (group_admin continua usando).
- Firestore Security Rules — escrita em `invites` continua `if false` (Admin SDK).
- Schema `inviteSchema` / `inviteCreateClientSchema` — sem alteração.
- **Sem** `GET /api/admin/groups/[id]/invites` (escopo apenas-gerar não lista).

## 3. System understanding relevant to this feature

### Fluxo atual de convites (group_admin)
1. `GroupInvites.tsx` chama `useCreateInvite()` → `createInvite()` → `POST /api/group/invites`.
2. `authorizeGroupAdminOfPool()` extrai `groupId` do doc `users/{uid}` na sessão.
3. `super_admin` sem `groupId` no doc → linha 71 de `_authorize.ts` → `forbidden("Você não administra nenhum grupo.")` → 403.
4. Portanto, `super_admin` **não pode usar** o endpoint existente — precisa de rota própria onde `groupId` vem do parâmetro de URL `[id]`.

### Autorização admin global
`src/app/api/admin/groups/_authorize.ts` → `authorizeGroupAdmin(request)`:
- Aceita header `x-admin-secret` (cron/seed) OU sessão de `super_admin`.
- Retorna `{ authorized: true, actorUid }` — sem `groupId` (o caller usa o `[id]` da URL).
- Padrão já usado em `GET|PATCH /api/admin/groups/[id]`, `/status`, `/admin`, `/members`.

### Lógica de criação de invite (para replicar)
`POST /api/group/invites`:
1. Verifica `pool.allowInvites !== false`.
2. Gera `code` via `randomBytes` + `CODE_ALPHABET` (sem 0/O/1/I), 6 chars, retry até 5x em colisão (gRPC 6).
3. Cria doc `invites/{code}` via `db.collection("invites").doc(code).create(...)` (atômico, falha em colisão).
4. A3: expira ativos anteriores com `createdAt < novoCreatedAt` em batch.
5. Retorna `{ invite }` com status 201.

Esta lógica deve ser **espelhada** no novo endpoint, não abstraída em shared util (evitar abstração prematura — os dois endpoints diferem em autorização e escopo).

### Componente de referência
`GroupInvites.tsx` (group_admin) contém toda a UI reutilizável:
- `InviteValue` — exibe link ou código, botão copiar + compartilhar.
- `InviteSettingsCard` — validade, limite de usos, usos atuais.
- `GenerateLink` — formulário com validityDays + maxUses, inline expand.
- Função `inviteUrl(code)` — monta URL pública a partir de `window.location.origin`.
- Função `validityDays(invite)` — dias restantes até `expiresAt`.

O Dialog novo pode importar/reusar esses sub-componentes ou cloná-los — preferência por importação se os componentes forem exportados.

## 4. Technical impact analysis

### Módulos afetados
| Módulo | Tipo de impacto |
|---|---|
| `src/features/superAdmin/components/GroupsActive.tsx` | Adiciona ação no KebabMenu + estado `inviteOpen` + renderiza `AdminGroupInviteDialog` |
| `src/features/superAdmin/components/AdminGroupInviteDialog.tsx` | **Novo** — Dialog com UI de convite scoped por poolId |
| `src/features/superAdmin/hooks/useAdminGroups.ts` | Adiciona `useAdminGroupInvites` + `useCreateAdminGroupInvite` |
| `src/features/superAdmin/hooks/superAdminKeys.ts` | Adiciona chave `groupInvites(poolId)` |
| `src/services/superAdmin.ts` | Adiciona `listAdminGroupInvites(poolId)` + `createAdminGroupInvite(poolId, input)` |
| `src/app/api/admin/groups/[id]/invites/route.ts` | **Novo** — GET + POST |
| `src/features/groupAdmin/components/GroupInvites.tsx` | Possivelmente exporta sub-componentes (`InviteValue`, `InviteSettingsCard`, `GenerateLink`, helpers) para reuso — ou são duplicados no dialog novo |

### Fluxo de dados novo
```
AdminGroupInviteDialog(poolId)
  → useAdminGroupInvites(poolId)     → GET /api/admin/groups/[id]/invites
  → useCreateAdminGroupInvite(poolId) → POST /api/admin/groups/[id]/invites
       ↓ authorizeGroupAdmin(request) [super_admin only]
       ↓ groupId = params.id (URL, não sessão)
       ↓ verifica allowInvites no pool
       ↓ gera code + cria invite + expira anteriores
```

### Contrato da nova API
**`GET /api/admin/groups/[id]/invites`**
- Resposta: `{ invites: Invite[] }` (ativos, `createdAt` desc) — mesmo shape do GET existente.

**`POST /api/admin/groups/[id]/invites`**
- Body: `{ label?, maxUses: number, validityDays: number }` — mesmo schema de `createSchema`.
- Resposta: `{ invite: Invite }` status 201 — mesmo shape do POST existente.

### React Query keys
Novo namespace para não invalidar queries do group_admin ao mutar:
```ts
superAdminKeys.groupInvites = (poolId: string) => ["superAdmin", "groupInvites", poolId]
```
Mutation invalida `superAdminKeys.groupInvites(poolId)` e `superAdminKeys.groups("active")` (para atualizar participantCount se relevante — mas irrelevante aqui; pode ser seletivo).

### Firestore
Sem alteração de schema ou regras. Writes via Admin SDK — já permitido pelo padrão.

## 5. Risks

| Risco | Severidade | Mitigação |
|---|---|---|
| super_admin gerando convite em pool com `allowInvites: false` | Médio | Endpoint verifica flag; Dialog exibe aviso visual |
| Validação de `[id]` inexistente | Médio | Route Handler verifica `poolSnap.exists` → 404 |
| Colisão de invalidação de cache entre group_admin e super_admin | Baixo | Keys separadas — sem interferência cruzada |
| Reuso de sub-componentes de `GroupInvites.tsx` sem exportá-los | Baixo | Exportar ou duplicar; preferência por exportação |
| Endpoint autorizado por secret header gerar convite indevido | Baixo | Secret header é para automação interna; risco operacional, não novo |
| Dialog abre e pool ainda não tem convite | Baixo | UI trata empty state (já existe em `InviteValue`) |

## 6. Decisões travadas (resolvidas com o usuário)

1. **Sub-componentes `GroupInvites.tsx`** — RESOLVIDO: **exportar** `InviteValue` + helper `inviteUrl` (UI de exibir/copiar/compartilhar link). O `AdminGroupInviteDialog` reusa essa parte. Sub-componentes não usados no escopo mínimo (`InviteSettingsCard`, `GenerateLink`) não precisam ser exportados — o Dialog tem form próprio simplificado.

2. **Dialog modal** — RESOLVIDO: Dialog modal sobre o grid de grupos ativos (não sai da tela). Mais natural que página dedicada.

3. **Escopo = APENAS GERAR** — RESOLVIDO: o Dialog **não** lista/gerencia convites existentes nem revoga. Fluxo mínimo: abrir → form (validade + limite de usos) → gerar → exibir link+código gerado pra copiar/compartilhar. Sem aba "convites ativos", sem `DELETE`. Consequência: o **`GET /api/admin/groups/[id]/invites` não é necessário** — apenas o `POST`.

4. **Campo `label`** — RESOLVIDO: **omitir** do form. O group_admin nem expõe esse campo no seu próprio console. POST envia só `validityDays` + `maxUses`.

5. **Auditoria em `system_logs`** — RESOLVIDO: **sim**, logar criação do convite. `authorizeGroupAdmin` retorna `actorUid` (uid do super_admin). Endpoint registra entrada em `system_logs` (quem gerou o convite, para qual pool).

## 7. Recommended implementation concerns

- **Novo endpoint admin-scoped**: criar `src/app/api/admin/groups/[id]/invites/route.ts` — copiar lógica de geração de código/expiração do `POST /api/group/invites`, substituindo `authorizeGroupAdminOfPool()` por `authorizeGroupAdmin()` e usando `params.id` como `groupId`. Não abstrair em shared util neste momento.

- **Serviço e hooks no namespace superAdmin**: adicionar ao `src/services/superAdmin.ts` (não ao `src/services/group.ts`) para manter isolamento de camada.

- **Dialog como componente independente**: `AdminGroupInviteDialog` em `src/features/superAdmin/components/`. Pode importar `InviteValue`, `InviteSettingsCard`, `GenerateLink` de `groupAdmin/components/GroupInvites.tsx` após exportá-los.

- **Sequência de alteração mínima**: (1) exportar sub-componentes em `GroupInvites.tsx`, (2) novo Route Handler GET+POST, (3) service + hooks, (4) Dialog, (5) adicionar item ao KebabMenu em `GroupsActive.tsx`. Ordem permite testar cada camada isoladamente.

- **TDD aplicável** para o Route Handler POST: validação `allowInvites`, retorno 404 para pool inexistente, formato de resposta — são business rules verificáveis.
