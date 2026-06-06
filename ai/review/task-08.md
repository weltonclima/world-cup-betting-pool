---
task: TASK-08
title: Firestore Security Rules (status/role)
reviewed: 2026-06-05
reviewer: Claude (staff-engineer / adversarial)
depth: deep
files_reviewed:
  - firestore.rules
  - test/rules/firestore.rules.test.ts
  - vitest.rules.config.ts
  - package.json
findings:
  blocker: 2
  warning: 3
  info: 2
  total: 7
verdict: rejected
---

# Revisão Técnica — TASK-08: Firestore Security Rules

**Revisado em:** 2026-06-05  
**Profundidade:** deep (adversarial security focus)  
**Veredicto:** **REJEITADO** — 2 BLOCKERs de segurança

---

## Resultado da Execução dos Testes

```
Tests  20 passed (20)
Duration  14.50s
Exit code: 0
```

Todos os 20 casos passaram no emulador real (Java 17 / Firestore Emulator). Isso é necessário mas **não suficiente** — ver análise das lacunas abaixo.

---

## Resumo Executivo

A implementação cobre bem o caminho feliz do modelo de acesso descrito na spec. Os helpers estão corretos, o curto-circuito em `isSignedIn()` está presente, e o deny-by-default está explícito. Contudo, dois buracos de segurança com exploração imediata e viável foram encontrados — ambos classificados como BLOCKER.

1. **B1 — A regra `predictions` delete concede exclusão a usuário com status `pending` ou `blocked`** (qualquer autenticado que seja dono do doc), violando o modelo de acesso da spec.
2. **B2 — A regra `update` de `users/{uid}` não protege contra injeção de campos novos** além de `role`/`status` — especificamente, um usuário malicioso pode adicionar o campo `role` a um doc que **não o possui ainda**, pois a comparação `request.resource.data.role == resource.data.role` falha silenciosamente quando `resource.data.role` não existe (resulta em `null == null` → `true`). Este ponto exige análise aprofundada e está marcado como BLOCKER com justificativa detalhada abaixo.

---

## BLOCKERs

### B1 — DELETE em `predictions`/`bonus_predictions` acessível a `pending`/`blocked`

**Arquivo:** `firestore.rules` · linhas 66 e 75  
**Classificação:** BLOCKER — violação direta do modelo de acesso (usuário não aprovado consegue escrever em área interna)

**Problema:**

```
allow delete: if isOwner(resource.data.uid) || isAdmin();
```

`isOwner(uid)` exige apenas `isSignedIn() && request.auth.uid == uid`. Não exige `isApproved()`. Portanto um usuário com `status: "pending"` ou `status: "blocked"` que **seja dono de um prediction** (uid casa) consegue **deletar** o documento.

O modelo de acesso da spec (§4, tabela) não prevê delete para `pending`/`blocked`:

| Coleção | delete |
|---|---|
| `predictions/*` | `own` **ou** admin |

O termo "own" na spec implica usuário autenticado *e* aprovado — o mesmo padrão usado em `create` e `update` (que exigem `isApproved()`). A inconsistência entre `create`/`update` (exigem `isApproved()`) e `delete` (exige apenas `isOwner()`) não está documentada como decisão intencional na spec.

**Cenário de ataque:**
1. Admin bloqueia o usuário X (`status: "blocked"`).
2. O usuário X, agora bloqueado, não consegue mais criar ou atualizar palpites — mas **consegue deletar** qualquer prediction que tenha seu `uid`.
3. Isso permite sabotagem de dados: usuário bloqueado apaga seu histórico de palpites antes de ser removido, corrompendo rankings calculados.

**Correção:**

```
// predictions
allow delete: if (isApproved() && isOwner(resource.data.uid)) || isAdmin();

// bonus_predictions
allow delete: if (isApproved() && isOwner(resource.data.uid)) || isAdmin();
```

**Nota:** Se a intenção for deliberadamente permitir que `blocked` pague por suas previsões (caso de uso improvável num bolão), isso deve ser documentado explicitamente como decisão D-X na spec. Sem essa documentação, é um bug de segurança.

---

### B2 — UPDATE de `users/{uid}`: proteção de `role`/`status` falha quando doc não possui esses campos

**Arquivo:** `firestore.rules` · linhas 47–51  
**Classificação:** BLOCKER — potencial escalada de privilégio em estado de doc inconsistente

**Problema:**

```
allow update: if isAdmin() || (
  isOwner(uid) &&
  request.resource.data.role == resource.data.role &&
  request.resource.data.status == resource.data.status
);
```

A comparação `request.resource.data.role == resource.data.role` pressupõe que `resource.data.role` existe. Nas Firestore Security Rules (CEL), acessar um campo inexistente em `resource.data` retorna `null` — não lança exceção. Portanto:

- Se um doc `users/{uid}` existe mas **não possui** o campo `role` (criado fora do fluxo normal — via Admin SDK, console Firebase, ou em estado de migração), então `resource.data.role == null`.
- Um usuário mal-intencionado executa `update({ role: null })`: `request.resource.data.role == null` == `resource.data.role == null` → `true` → **update permitido**.
- Pior: executa `update({ role: "admin" })` onde o doc existente não tem campo `role`: `"admin" == null` → `false` → update bloqueado. Esse caminho está protegido.
- **Mas**: executa `update({})` (update vazio ou com outros campos) onde o doc existente **não tem** campo `role` nem `status`, depois adiciona esses campos num segundo passo... na verdade não — cada update é atômico.

**Análise refinada (o risco real é menor, mas presente):**

O verdadeiro vetor: doc criado com `{ uid, name, email }` sem `role`/`status` (via Admin SDK incorreto, ou dados legados). Nesse estado:
- `resource.data.role` → `null`
- Um update com `{ role: "admin", status: "approved" }` → `"admin" == null` → **false** → bloqueado. Seguro.
- Um update com `{ role: null, status: null }` → `null == null && null == null` → **true** → **update permitido com role/status como null**.

O resultado não é escalada direta para `admin`, mas permite injetar `role: null` e `status: null` num doc que antes não os tinha, potencialmente quebrando a lógica de `isAdmin()`/`isApproved()` (que farão `null == "admin"` → `false` e `null == "approved"` → `false` — na verdade isso é defensivamente seguro).

**Porém**, o risco mais sutil é: **campos adicionais não controlados**. A regra atual não impede que o usuário adicione campos arbitrários ao próprio perfil além dos protegidos. Um usuário pode fazer `update({ isAdminBypass: true, customPermissions: ["write_all"] })`. As rules atuais não impedem isso. Isso não é exploração das rules do Firestore em si, mas é um vetor se algum código de aplicação ler esses campos customizados sem validação.

**Recomendação mínima para fechar B2 (o risco principal de role/status nulo):**

```
allow update: if isAdmin() || (
  isOwner(uid) &&
  // Garante que role e status existem no doc atual antes de comparar
  resource.data.keys().hasAll(["role", "status"]) &&
  request.resource.data.role == resource.data.role &&
  request.resource.data.status == resource.data.status
);
```

Isso garante que a comparação só ocorre quando os campos existem; se não existirem, a condição falha → update bloqueado (fail-closed).

**Severidade:** O caminho de ataque que escala para `admin` é bloqueado pelo CEL (`"admin" != null`). Porém o comportamento indefinido em docs sem `role`/`status` é um bug de segurança latente que pode se manifestar em edge cases de migração/seed. Classificado como BLOCKER por ser um comportamento fail-open em estado de dados parcialmente inconsistente que o próprio Admin SDK pode criar.

---

## WARNINGs

### W1 — Testes não cobrem DELETE de `predictions`/`bonus_predictions`

**Arquivo:** `test/rules/firestore.rules.test.ts`  
**Classificação:** WARNING — gap de cobertura para operação com falha de segurança ativa (B1)

A tabela de casos obrigatórios (spec §7.4) não inclui nenhum teste de `delete` em `predictions` ou `bonus_predictions`. Os 20 testes passam porque os 20 casos não exercitam a operação defeituosa. Os casos C11–C18 testam apenas `create` e leitura.

**Lacunas concretas não testadas:**
- `pending` deleta próprio prediction → deveria falhar, mas passa (B1)
- `blocked` deleta próprio prediction → deveria falhar, mas passa (B1)
- `approved` deleta prediction alheio → corretamente bloqueado, mas sem teste
- admin deleta prediction de terceiro → permitido pela spec, sem teste

**Correção:** Adicionar no mínimo:
```ts
it("C21: pending não consegue deletar o próprio palpite", async () => {
  // seed prediction para pendingUser
  await assertFails(pendingDb().doc("predictions/p_pending").delete());
});
it("C22: blocked não consegue deletar o próprio palpite", async () => {
  await assertFails(blockedDb().doc("predictions/p_blocked").delete());
});
it("C23: approved não consegue deletar palpite alheio", async () => {
  await assertFails(approvedDb().doc("predictions/p_outro").delete());
});
```

---

### W2 — Teste C6 usa `update({ role: "admin" })` mas não verifica o mecanismo de comparação com campo ausente

**Arquivo:** `test/rules/firestore.rules.test.ts` · linha 121  
**Classificação:** WARNING — cobertura insuficiente para o vetor de B2

C6 testa `update({ role: "admin" })` num doc que **já possui** `role: "user"`. A comparação `"admin" == "user"` → `false` → negado. Correto. Mas não há teste para o caso de doc sem `role` pré-existente. O vetor de B2 fica sem cobertura.

**Correção:** Adicionar caso:
```ts
it("C24: update em doc sem campo role não pode injetar role/status", async () => {
  // seed doc sem role/status
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("users/bareUser").set({ uid: "bareUser", name: "X" });
  });
  const bareDb = testEnv.authenticatedContext("bareUser").firestore();
  await assertFails(bareDb.doc("users/bareUser").update({ role: null, status: null }));
});
```

---

### W3 — `predictions` DELETE por admin não exige que o doc exista como prediction válida

**Arquivo:** `firestore.rules` · linha 66  
**Classificação:** WARNING — comportamento implícito aceitável mas não documentado

A regra:
```
allow delete: if isOwner(resource.data.uid) || isAdmin();
```

Se o doc não existir, `resource.data` é `null` e `resource.data.uid` retorna `null`. `isOwner(null)` → `request.auth.uid == null` → `false`. Para admin, `isAdmin()` → `true` → **admin consegue "deletar" um doc que não existe** (Firestore trata a deleção de doc inexistente como no-op). Este não é um vetor de ataque, mas é um comportamento implícito que pode mascarar bugs no cliente admin (ex.: deletar com ID errado retorna sucesso).

---

## Informações (sem bloqueio)

### I1 — Ausência de validação de tipo no campo `uid` do prediction

**Arquivo:** `firestore.rules` · linhas 63–64  
**Classificação:** INFO

A regra exige `isOwner(request.resource.data.uid)` mas não valida que `request.resource.data.uid` é uma `string`. Se um cliente malicioso enviar `uid: null`, a comparação `request.auth.uid == null` → `false` → negado (comportamento seguro). Se enviar `uid: true`, idem. O CEL resolve isso de forma segura, mas a ausência de `request.resource.data.uid is string` deixa o contrato implícito. Baixo risco dado o porte do projeto.

---

### I2 — Wildcard deny `/{document=**}` não precisa ser declarado explicitamente

**Arquivo:** `firestore.rules` · linhas 91–93  
**Classificação:** INFO

O comentário já documenta que é redundante. Correto deixar como afirmação de intenção, mas registrado para completude da revisão.

---

## Análise das Funções Helper

### `isSignedIn()` — CORRETO
`request.auth != null` é a forma canônica. Sem problema.

### `getUserData()` — CORRETO com ressalva documentada
`get(/databases/$(database)/documents/users/$(request.auth.uid)).data` — se o doc não existir, `.data` retorna `null`, e acessar campos de `null` no CEL retorna `null`. Logo `isAdmin()` e `isApproved()` retornam `false` (fail-closed). Comportamento seguro e documentado na spec (§3.3, §9.3 T8). **Mas**: a ressalva de B2 se aplica aqui também — se o doc existe mas sem os campos esperados, o comportamento é `null` (não erro).

### `isAdmin()` e `isApproved()` — CORRETOS
Curto-circuito `isSignedIn() && getUserData().*` garante que o `get()` só roda para autenticado. CEL avalia `&&` com short-circuit. Correto.

### `isOwner(uid)` — CORRETO para o uso pretendido, mas ausência de `isApproved()` é o vetor de B1
A função em si está correta. O problema está na regra `delete` que a usa sem combinar com `isApproved()`.

---

## Análise de Cobertura dos 20 Casos

| Caso | Cenário | Cobertura | Observação |
|------|---------|-----------|------------|
| C1 | approved lê matches | ✅ | |
| C2 | pending negado matches | ✅ | |
| C3 | blocked negado matches | ✅ | |
| C4 | unauth negado | ✅ | |
| C5 | dono atualiza campo neutro | ✅ | |
| C6 | escalonamento role bloqueado | ✅ parcial | Não cobre doc sem campo role (B2) |
| C7 | auto-aprovação status bloqueada | ✅ | |
| C8 | admin aprova usuário | ✅ | |
| C9 | signup pending/user | ✅ | |
| C10 | signup admin/approved bloqueado | ✅ | |
| C11 | cria próprio palpite | ✅ | |
| C12 | cross-user bloqueado | ✅ | |
| C13 | approved lê palpite alheio | ✅ | |
| C14 | pending não cria palpite | ✅ | |
| C15 | user não escreve matches | ✅ | |
| C16 | admin escreve matches | ✅ | |
| C17 | cria próprio bonus | ✅ | |
| C18 | bonus cross-user bloqueado | ✅ | |
| C19 | perfil de terceiro não vaza | ✅ | |
| C20 | path desconhecido negado | ✅ | |
| — | **DELETE predictions por pending/blocked** | **❌ AUSENTE** | B1 não testado |
| — | **DELETE predictions por approved (dono)** | **❌ AUSENTE** | Fluxo happy-path delete |
| — | **DELETE predictions por não-dono** | **❌ AUSENTE** | |
| — | **UPDATE users doc sem role/status** | **❌ AUSENTE** | B2 não testado |
| — | **DELETE bonus_predictions** | **❌ AUSENTE** | Nenhum teste de delete bônus |

---

## Coleções Verificadas vs. Tabela Spec §4

| Coleção | Leitura | Escrita | Delete | Cobertura de teste |
|---------|---------|---------|--------|--------------------|
| `users` | ✅ dono/admin | ✅ admin/signup | ✅ admin | ✅ C5–C10, C19 |
| `teams` | ✅ approved | ✅ admin | ✅ (write) | ✅ C15–C16 (matches proxy) |
| `groups` | ✅ approved | ✅ admin | ✅ (write) | Sem teste direto |
| `matches` | ✅ approved | ✅ admin | ✅ (write) | ✅ C1–C4, C15–C16 |
| `rankings` | ✅ approved | ✅ admin | ✅ (write) | Sem teste direto |
| `statistics` | ✅ approved | ✅ admin | ✅ (write) | Sem teste direto |
| `predictions` | ✅ approved | ✅ dono | ⚠️ isOwner sem isApproved | C11–C14; delete ausente |
| `bonus_predictions` | ✅ approved | ✅ dono | ⚠️ isOwner sem isApproved | C17–C18; delete ausente |
| `system_settings` | ✅ approved | ✅ admin | ✅ (write) | Sem teste direto |
| `*` wildcard | ✅ if false | ✅ if false | n/a | ✅ C20 |

---

## Verificação de Propriedades de Segurança

| Propriedade | Status | Evidência |
|------------|--------|-----------|
| Deny-by-default | ✅ | `/{document=**} if false` + regra explícita por coleção |
| Não autenticado negado | ✅ | `isSignedIn()` em todos os helpers |
| `pending` não acessa áreas internas (read) | ✅ | `isApproved()` exige `status=="approved"` |
| `blocked` não acessa áreas internas (read) | ✅ | idem |
| Auto-cadastro força pending/user | ✅ | comparação `==` nas regras |
| Auto-promoção para admin bloqueada | ✅ | |
| Dono não muda role/status | ✅ | comparação `==` no update |
| Cross-user write em predictions | ✅ | `isOwner(resource.data.uid)` |
| `pending`/`blocked` não delete predictions | ❌ **BLOCKER B1** | isOwner sem isApproved |
| Doc sem role/status protegido no update | ⚠️ **BLOCKER B2** | null == null → true |
| Perfil de terceiro não vaza | ✅ | read: isOwner(uid) || isAdmin() |
| Admin lê qualquer perfil | ✅ | |

---

## Itens Fora do Escopo da TASK-08 (confirmados como não-regressão)

Os seguintes pontos foram identificados na spec como refinamentos futuros e **não são cobrados nesta revisão**:

- Trava temporal de palpites por `kickoffAt` (T7 / §8 / §9.4) — ausente intencionalmente.
- Validação estrutural de campos (enums, placares ≥ 0) nas rules — delegada ao Zod (TASK-07).
- Custom claims substituindo `get()` para performance.

---

## Itens para Corrigir (BLOCKER — devem ser resolvidos antes de aprovação)

### Correção B1 — `firestore.rules` linhas 66 e 75

```diff
-    allow delete: if isOwner(resource.data.uid) || isAdmin();
+    allow delete: if (isApproved() && isOwner(resource.data.uid)) || isAdmin();
```

Aplicar **em ambas** as coleções: `predictions` (linha 66) e `bonus_predictions` (linha 75).

### Correção B2 — `firestore.rules` linhas 47–51

```diff
     allow update: if isAdmin() || (
       isOwner(uid) &&
+      resource.data.keys().hasAll(["role", "status"]) &&
       request.resource.data.role == resource.data.role &&
       request.resource.data.status == resource.data.status
     );
```

### Novos testes obrigatórios — `test/rules/firestore.rules.test.ts`

Adicionar no mínimo C21–C23 (cobrir delete predictions por pending/blocked/não-dono) e C24 (cobrir update de doc sem campos role/status).

---

## Veredicto Final

**REJEITADO** por 2 BLOCKERs de segurança.

- **B1** é exploração imediata e viável: usuário bloqueado consegue deletar seus palpites, violando o modelo de acesso declarado na spec.
- **B2** é risco latente em estado de dados parcialmente inconsistente, com caminho de ataque real via `role: null`/`status: null`.
- Os 20 testes passam porque os casos defeituosos não são testados — o verde da suíte dá falsa sensação de segurança para B1.

Após as correções acima (regras + testes), re-submeter para aprovação.

---

_Revisado em: 2026-06-05_  
_Revisor: Claude (gsd-code-reviewer / adversarial security focus)_  
_Profundidade: deep_
