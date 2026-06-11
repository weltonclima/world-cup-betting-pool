# SPEC

## 1. Task id and title
- Task: TASK-03
- Title: Firestore — rules + índices de `pools` e ajuste de `users`

## 2. Objective
Adicionar segurança e índices para a coleção `pools` (PRD-09) e ajustar as rules de `users` para a transição multi-tenant:
- Bloco de rules `pools/{poolId}`: leitura dos pools **ativos** por usuário **approved**; escrita **negada a todo cliente** (criação/aprovação/bloqueio são exclusivos do Admin SDK via Route Handlers — TASK-04/05).
- Helpers de role `isSuperAdmin()` / `isGroupAdmin()` nas rules, mantendo **dupla-compat** (`admin`||`super_admin`).
- Ajuste do `create`/`update` de `users` para aceitar `role:"participant"` (canônico novo) **e** o `groupId` presente no doc, sem regredir as travas anti-escalonamento existentes.
- Índices em `firestore.indexes.json`: `pools(slug)`, `pools(status)`, `users(groupId,status)`, `users(role)`.

Erro aqui = lockout (R1) ou vazamento de pool. Verificação por emulador (`npm run test:rules`).

## 3. In scope
- `firestore.rules`:
  - Helpers novos: `isSuperAdmin()` (dupla-compat `admin`||`super_admin`, via `getUserData().role`), `isGroupAdmin()` (`group_admin`). Manter `isAdmin()` existente como alias de super_admin durante a transição (não quebrar os matches atuais que usam `isAdmin()`).
  - Bloco `match /pools/{poolId}`: `read` se `isApproved()` **e** `resource.data.status == "active"`; `write: if false` (Admin SDK only). Documentar o motivo (criação nasce `pending`, aprovação é server-side — TASK-05).
  - `users` create: além do auto-cadastro legado (`status=="pending"` + `role=="user"`), **aceitar** `role=="participant"` como valor de auto-cadastro válido (canônico novo), mantendo `status=="pending"`. Admin (super_admin) continua criando livre.
  - `users` update: manter as travas (dono não muda `role`/`status`); o `groupId` presente no doc **não** deve quebrar o parse/igualdade — o dono pode gravar campos neutros (`nickname`, `avatarUrl`) com `groupId` já existente sem ser negado.
- `firestore.indexes.json`: adicionar os 4 índices compostos/simples acima.
- `test/rules/firestore.rules.test.ts`: casos novos para `pools` (read ativo/pending/blocked × approved/pending/unauth; write negado a todos) e para o auto-cadastro `participant`.

## 4. Out of scope
- ❌ Isolamento de leitura dos docs de **ranking por pool** (`rankings/pool-*`, `pool_stats/{poolId}`) → depende do layout A5 (TASK-10) e da claim `groupId` (TASK-06) → **TASK-11**.
- ❌ Sincronização de claim `groupId`/role nas custom claims → **TASK-06**.
- ❌ Route Handlers / service / criação real de pool → **TASK-04**.
- ❌ Endpoint admin de aprovação (`pending→active`) → **TASK-05**.
- ❌ Remoção da dupla-compat de role (corte do legado) → **TASK-12**.
- ❌ Tornar `groupId` obrigatório no `userSchema` → **TASK-12**.
- ❌ Mexer no bloco `match /groups/{groupId}` (coleção do torneio Copa) — permanece intacta.

## 5. Main technical areas involved
- `firestore.rules` — helpers de role + bloco `pools` + ajuste `users` create/update.
- `firestore.indexes.json` — 4 índices.
- `test/rules/firestore.rules.test.ts` — casos novos (emulador `@firebase/rules-unit-testing`).
- Referência: bloco `users` atual (linhas 34-55) e padrão `match /teams|groups` (read approved / write admin) já no arquivo.

## 6. Business rules and behavior
- **`pools` read:** apenas usuário `approved` lê, e **somente** pools com `status=="active"` (pending/blocked não vazam para a busca/cliente). Pool `pending` ou `blocked` → leitura negada ao cliente comum (visível só via Admin SDK).
- **`pools` write:** negado a **todo cliente** (incl. admin autenticado no client) — criação (`pending`), aprovação (`pending→active`), bloqueio são exclusivos do Admin SDK nos Route Handlers (TASK-04/05), espelhando a política de `predictions`/`webauthn_credentials`.
- **Helpers de role (dupla-compat):** `isSuperAdmin()` aceita `role=="admin" || role=="super_admin"`; `isGroupAdmin()` é `role=="group_admin"`. A checagem usa `getUserData().role` (doc do requisitante), igual ao `isAdmin()` atual. **Não** comparar string crua espalhada — centralizar nos helpers.
- **`users` create (auto-cadastro):** aceitar role canônico novo `participant` além do legado `user`; `status` continua forçado a `pending`. Não pode nascer `approved` nem `super_admin`/`group_admin`/`admin` pelo próprio usuário.
- **`users` update:** dono atualiza campos neutros sem alterar `role`/`status` (trava atual mantida). A presença de `groupId` no doc não altera essa lógica — não exigir nem proibir `groupId` aqui (escrita de `groupId` no signup é TASK-07; nesta task só garantimos que o doc com `groupId` não quebra as rules existentes).
- **Deny-by-default** continua cobrindo qualquer path não casado.

## 7. Contracts and interfaces
Rules (forma — não copiar literal, adaptar ao arquivo):
```
function isSuperAdmin() {
  return isSignedIn() &&
    (getUserData().role == "admin" || getUserData().role == "super_admin");
}
function isGroupAdmin() {
  return isSignedIn() && getUserData().role == "group_admin";
}
// isAdmin() existente passa a delegar para isSuperAdmin() (alias de transição).

match /pools/{poolId} {
  allow read:  if isApproved() && resource.data.status == "active";
  allow write: if false; // criação/aprovação/bloqueio só via Admin SDK (TASK-04/05)
}

// users create — aceitar participant além de user:
allow create: if isSuperAdmin() || (
  isOwner(uid) &&
  request.resource.data.status == "pending" &&
  (request.resource.data.role == "user" || request.resource.data.role == "participant")
);
```
Índices (`firestore.indexes.json`) — `queryScope: COLLECTION`:
```
pools: [status ASC]            // busca de ativos
pools: [slug ASC]              // lookup por slug (unicidade/detalhe)
users: [groupId ASC, status ASC]   // membros aprovados de um pool (TASK-10)
users: [role ASC]              // listagem por papel
```
> Nota: índices de campo único (`pools.slug`, `pools.status`, `users.role`) são automáticos no Firestore; declará-los aqui é redundante mas explícito e inofensivo. O índice composto `users(groupId,status)` é o que realmente exige declaração. Implementação pode declarar só o composto + os que o `firebase deploy` exigir; manter o composto obrigatório.

## 8. Data and persistence impact
- Sem migração de dados. Define as **rules** que protegem `pools/{id}` (forma definida na TASK-02) e os índices que suportam as queries de TASK-04/10.
- `pools` write client negado → nenhum dado de pool é gravável fora do Admin SDK (consistência com a forma `poolSchema` server-set).
- Índice composto `users(groupId,status)` habilita "participantes approved de um pool" sem full-scan (recalc por pool, TASK-10).

## 9. Required tests
TDD via emulador (`npm run test:rules`). Cobrir:
- **pools read:**
  - approved lê pool `active` → sucesso.
  - approved é negado em pool `pending` → falha.
  - approved é negado em pool `blocked` → falha.
  - pending/unauth negados em pool `active` → falha.
- **pools write:**
  - approved (client) não cria pool → falha.
  - admin (client autenticado) não cria/atualiza pool → falha (write exclusivo Admin SDK).
- **users create (participant):**
  - auto-cadastro com `role:"participant"` + `status:"pending"` (próprio uid) → sucesso.
  - auto-cadastro com `role:"participant"` + `status:"approved"` → falha (não pode nascer approved).
  - auto-cadastro com `role:"group_admin"`/`super_admin`/`admin` → falha (sem auto-promoção).
- **regressão users:** doc com `groupId` presente — dono atualiza `nickname` mantendo role/status/groupId → sucesso; dono tentando escalar role → falha (mantém C6/C28).
- Os casos legados existentes (C1–C63) continuam verdes (dupla-compat preservada).

## 10. Acceptance criteria
- `firestore.rules` tem helpers `isSuperAdmin()`/`isGroupAdmin()` e bloco `match /pools/{poolId}` (read active+approved / write false).
- `users` create aceita `role:"participant"` (além de `user`) com `status:"pending"`; auto-promoção continua negada.
- `firestore.indexes.json` inclui o índice composto `users(groupId,status)` (+ os demais declarados).
- `npm run test:rules` verde, incluindo os casos novos de `pools` e `participant`; **nenhum** caso legado (C1–C63) regrediu.
- Bloco `groups` (torneio) inalterado; dupla-compat de role preservada (`admin` ainda funciona).

## 11. Constraints
- Rules são a última linha de defesa — frontend nunca confiável. Deny-by-default mantido.
- **Dupla-compat obrigatória:** `admin` (legado) deve continuar funcionando como super_admin; corte é TASK-12. Não remover aceitação de `user`/`admin`.
- Centralizar role em helpers (`isSuperAdmin`/`isGroupAdmin`), não espalhar comparação de string crua.
- `pools` write `if false` (paridade com `predictions`/`webauthn_credentials`): Admin SDK bypassa rules por design.
- Não tocar `match /groups` (torneio) nem renomear coleções.
- Testes de rules ficam em `test/rules/` (fora de `src/`), rodados via `npm run test:rules` (emulador, requer Java). Se Java indisponível localmente, sinalizar gap no `/test` e entregar rules+testes mesmo assim.

## 12. Execution cost profile
- tdd: sonnet/high
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/high

## 13. Frontend indicator
- is_frontend: false
- reason: Infra de segurança (Firestore rules) + índices. Sem telas/componentes/interação.

## 14. Open questions
- **Índices de campo único:** Firestore cria automaticamente índices de campo único; declarar `pools.slug`/`pools.status`/`users.role` é redundante. O **obrigatório** é o composto `users(groupId,status)`. Implementação pode incluir os simples por clareza/CI ou omiti-los — não bloqueia. Sem outra ambiguidade que impeça implementação segura.
