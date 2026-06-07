# SPEC — TASK-05: Endurecer Security Rules de `predictions`

> PRD: `ai/prd/palpites.md` | Plano: `ai/plan/palpites.md` | Branch: `feat/integracao-api-football`
> Tipo: infra | SP: 2 | Criticidade: critical | Risco técnico: medium
> Sem TDD. Sem tela. Verificação via emulator (`npm run test:rules`).

---

## 1. Objetivo

Alinhar as Security Rules de `predictions` ao modelo API-mediado: o cliente **nunca escreve** diretamente na coleção `predictions` — toda escrita (create/update) passa pelo Route Handler `/api/predictions` (Admin SDK, que bypassa Rules por design). O bloqueio temporal (`kickoffAt`) não pode ser verificado em Rule porque as partidas **não estão no Firestore** (servidas via Route Handlers — PRD-07 v2.0 / `[[architecture-copa-data]]`).

A operação se reduz a:

1. Remover as permissões de `create`, `update`, `delete` client-direto do bloco `match /predictions/{predictionId}`.
2. Manter `allow read: if isApproved()` intacto.
3. Comentar a razão técnica no arquivo.
4. Ajustar os testes de Rules existentes (suíte `test/rules/firestore.rules.test.ts`) para refletir o novo comportamento.
5. Confirmar que `firestore.indexes.json` não precisa de alteração.

---

## 2. Contexto e estado atual

### 2.1 Confirmação: nenhum write client-direto em `predictions` existe hoje

Grep de `setDoc|addDoc|updateDoc|deleteDoc` em `src/**/*.{ts,tsx}` retorna **zero ocorrências** relacionadas a `predictions`. Os únicos writes client-side encontrados são:

| Arquivo | Operação | Coleção |
|---|---|---|
| `src/services/auth.ts` | `setDoc` | `users` (auto-cadastro) |
| `src/services/users.ts` | `updateDoc` | `users` (aprovação/bloqueio) |

O serviço `src/services/predictions.ts` contém **somente** `listPredictionsByUid` via `getDocs` (leitura). **Não há write client-direto em `predictions` no código atual.**

### 2.2 Regras atuais (linhas 62–68 de `firestore.rules`)

```
match /predictions/{predictionId} {
  allow read:   if isApproved();
  allow create: if isApproved() && isOwner(request.resource.data.uid);
  allow update: if isApproved() && isOwner(resource.data.uid)
                                && isOwner(request.resource.data.uid);
  allow delete: if (isApproved() && isOwner(resource.data.uid)) || isAdmin();
}
```

As linhas `allow create`, `allow update` e `allow delete` **serão removidas** (substituídas por `allow write: if false`).

### 2.3 Índices (`firestore.indexes.json`)

O único índice customizado atual é composto (`users`: `status ASC + createdAt ASC`). A query `where("uid", "==", uid)` em `predictions` usa **índice simples de campo único** — criado automaticamente pelo Firestore. **Nenhum índice composto precisa ser adicionado.**

### 2.4 Testes existentes que serão impactados

No arquivo `test/rules/firestore.rules.test.ts`, os seguintes casos atualmente testam write client-direto em `predictions` e precisarão ser invertidos ou removidos:

| Case | Descrição atual | Ação |
|---|---|---|
| C11 | `approved` cria o próprio palpite → `assertSucceeds` | Inverter para `assertFails` |
| C12 | `approved` cria palpite cross-user → `assertFails` | Mantém (já `assertFails`) |
| C14 | `pending` não cria palpite → `assertFails` | Mantém (já `assertFails`) |
| C21+ | `approved` deleta o próprio palpite → `assertSucceeds` | Inverter para `assertFails` |
| C21 (delete block) | `pending` não deleta → `assertFails` | Mantém (já `assertFails`) |
| C22 (delete block) | `blocked` não deleta → `assertFails` | Mantém (já `assertFails`) |
| C23 (delete block) | `approved` não deleta palpite alheio → `assertFails` | Mantém (já `assertFails`) |

Novos casos a adicionar:

| Case | Descrição | Expectativa |
|---|---|---|
| C11b | `approved` tenta `update` no próprio palpite via client-direto | `assertFails` |
| C26 | `admin` tenta `create` via client-direto em `predictions` | `assertFails` |

---

## 3. Decisões travadas (não reabrir)

- **Motivo do bloqueio de write:** matches não estão no Firestore → Rules não conseguem ler `kickoffAt` → lock temporal só é verificável no Route Handler (servidor). Logo, write client-direto é **estruturalmente inseguro** e deve ser negado a todos os clientes, inclusive admin (admin usa Admin SDK direto quando necessário).
- **`allow write: if false`** em vez de simplesmente omitir as linhas: comunicação explícita de intenção. O deny-by-default do final do arquivo já cobriria a omissão, mas a linha explícita documenta a decisão no ponto exato.
- **`allow read` mantido intacto:** leitura client-side via `listPredictionsByUid` continua necessária para a UI (lista de palpites, badges no detalhe do jogo).
- **`bonus_predictions` não é alterado nesta tarefa:** tem semântica diferente (sem kickoffAt). Tarefa dedicada se necessário.
- **Nenhum índice novo:** query `where uid ==` é coberta por índice simples automático.

---

## 4. Alterações por arquivo

### 4.1 `firestore.rules` — bloco `predictions` (linhas 57–68)

**Substituir** o bloco atual:

```
// ---- predictions: leitura ampla (approved), escrita só do dono ----
// D7: approved lê todos os palpites (rankings/comparações sociais).
// Escrita restrita ao dono; no update exige ownership no estado atual
// E no novo (resource.data.uid + request.resource.data.uid) para
// impedir "roubar" um palpite reescrevendo o uid.
match /predictions/{predictionId} {
  allow read:   if isApproved();
  allow create: if isApproved() && isOwner(request.resource.data.uid);
  allow update: if isApproved() && isOwner(resource.data.uid)
                                && isOwner(request.resource.data.uid);
  allow delete: if (isApproved() && isOwner(resource.data.uid)) || isAdmin();
}
```

**Por:**

```
// ---- predictions: leitura ampla (approved); escrita APENAS via Admin SDK ----
// D7: approved lê todos os palpites (rankings/comparações sociais).
// MOTIVO DO BLOQUEIO DE WRITE CLIENT:
//   Partidas não estão no Firestore (servidas via Route Handlers — PRD-07 v2.0).
//   As Rules não conseguem ler `kickoffAt` para verificar o bloqueio temporal.
//   Toda escrita passa pelo Route Handler /api/predictions (Admin SDK),
//   que bypassa as Rules por design e aplica o lock server-side de forma
//   autoritativa. Write client-direto é negado a todos (incluindo admin).
match /predictions/{predictionId} {
  allow read:  if isApproved();
  allow write: if false; // write exclusivo do Admin SDK via Route Handler
}
```

**Nenhuma outra linha do arquivo é alterada.**

### 4.2 `firestore.indexes.json` — sem alteração

O arquivo permanece como está:

```json
{
  "indexes": [
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Query `where("uid", "==", uid)` em `predictions` usa índice simples automático do Firestore — não requer entrada em `indexes`.

### 4.3 `test/rules/firestore.rules.test.ts` — ajustar casos de predictions

As alterações são cirúrgicas: apenas os casos que testavam write client-direto em `predictions` com `assertSucceeds` precisam ser invertidos para `assertFails`. Novos casos documentam o novo contrato.

#### 4.3.1 Inverter C11 (create do próprio palpite)

**De:**
```ts
it("C11: cria o próprio palpite", async () => {
  await assertSucceeds(
    approvedDb().doc("predictions/p1").set({
      uid: "approvedUser",
      matchId: "m1",
      homeScore: 2,
      awayScore: 1,
    }),
  );
});
```

**Para:**
```ts
it("C11: write client-direto em predictions é negado (write só via Admin SDK)", async () => {
  // TASK-05: matches fora do Firestore → lock não verificável em rule →
  // write exclusivo do Route Handler /api/predictions (Admin SDK).
  await assertFails(
    approvedDb().doc("predictions/p1").set({
      uid: "approvedUser",
      matchId: "m1",
      homeScore: 2,
      awayScore: 1,
    }),
  );
});
```

#### 4.3.2 Adicionar C11b (update client-direto)

Inserir após C11:

```ts
it("C11b: update client-direto em predictions é negado (mesmo dono)", async () => {
  // Semeia um doc via Admin SDK (como faria o Route Handler).
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("predictions/p_own").set({
      uid: "approvedUser",
      matchId: "m1",
      homeScore: 1,
      awayScore: 0,
    });
  });
  await assertFails(
    approvedDb().doc("predictions/p_own").update({ homeScore: 2 }),
  );
});
```

#### 4.3.3 Inverter C21+ (delete do próprio palpite)

**De:**
```ts
it("C21+: approved consegue deletar o próprio palpite (caminho feliz)", async () => {
  // Confirma que a correção B1 não bloqueou o caso legítimo.
  await assertSucceeds(approvedDb().doc("predictions/p_approved_own").delete());
});
```

**Para:**
```ts
it("C21+: delete client-direto em predictions é negado (write só via Admin SDK)", async () => {
  // TASK-05: write bloqueado a todos os clientes, incluindo delete.
  await assertFails(approvedDb().doc("predictions/p_approved_own").delete());
});
```

#### 4.3.4 Adicionar C26 (admin não bypassa via client)

Inserir ao final do describe `delete de predictions`:

```ts
it("C26: admin client-direto não consegue criar palpite em predictions", async () => {
  // Admin SDK bypassa Rules; o cliente autenticado como admin não.
  await assertFails(
    adminDb().doc("predictions/p_admin").set({
      uid: "adminUser",
      matchId: "m1",
      homeScore: 0,
      awayScore: 0,
    }),
  );
});
```

#### 4.3.5 Casos que permanecem inalterados

Os seguintes casos **não precisam de alteração** (já testam `assertFails` para cenários que continuam proibidos):

- C12: create cross-user → `assertFails` ✓
- C13: leitura palpite alheio por approved → `assertSucceeds` ✓ (read mantido)
- C14: pending não cria palpite → `assertFails` ✓
- C21 (delete block): pending não deleta → `assertFails` ✓
- C22 (delete block): blocked não deleta → `assertFails` ✓
- C23 (delete block): approved não deleta palpite alheio → `assertFails` ✓

---

## 5. Estrutura de arquivos resultante

```
firestore.rules               # bloco predictions: allow write: if false
firestore.indexes.json        # sem alteração
test/
└── rules/
    └── firestore.rules.test.ts  # C11/C21+ invertidos; C11b/C26 adicionados
```

---

## 6. Como verificar

### 6.1 Testes automatizados (caminho preferencial)

O projeto tem suíte completa de Rules com `@firebase/rules-unit-testing` (v5.0.1) rodando contra o emulador real do Firestore:

```bash
npm run test:rules
# Equivale a:
# firebase emulators:exec --only firestore --project demo-bolao-dos-parcas \
#   "vitest run --config vitest.rules.config.ts"
```

**Pré-requisito:** Java instalado (necessário para o emulador do Firestore). Porta 8080 livre.

**Resultado esperado após as alterações:**
- Todos os casos `C1`–`C26` passam (verde).
- C11 e C21+ agora testam `assertFails` em vez de `assertSucceeds`.
- C11b e C26 passam como `assertFails`.
- Nenhum caso de leitura (C13 etc.) é afetado.

### 6.2 Verificação manual (fallback sem emulador)

Se o emulador não estiver disponível (ex.: sem Java no ambiente de CI atual):

1. Inspecionar o bloco `match /predictions/{predictionId}` em `firestore.rules` — deve conter apenas `allow read` e `allow write: if false`.
2. Fazer deploy das rules para o projeto de staging/dev:
   ```bash
   firebase deploy --only firestore:rules --project world-cup-betting-pool-8e93c
   ```
3. No console Firebase → Firestore → Rules Playground:
   - Simular `create` em `predictions/test` com usuário autenticado aprovado → deve retornar **denied**.
   - Simular `get` em `predictions/test` com usuário autenticado aprovado → deve retornar **allowed** (desde que o doc exista).

### 6.3 Verificação de regressão da leitura

Garantir que `listPredictionsByUid` continua funcional após deploy das rules:

```bash
# Na UI local (npm run dev), logar como usuário aprovado e navegar até
# a lista de jogos — os badges de palpite devem carregar sem erro de permissão.
```

---

## 7. Contrato de segurança após TASK-05

| Operação | Cliente autenticado (qualquer) | Admin SDK (Route Handler) |
|---|---|---|
| `read` em `predictions` | Permitido se `approved` | Sempre permitido |
| `create` em `predictions` | **Negado** | Permitido |
| `update` em `predictions` | **Negado** | Permitido |
| `delete` em `predictions` | **Negado** | Permitido |

O Route Handler `/api/predictions` (TASK-03) usa `src/firebase/admin.ts` (Admin SDK), que bypassa as Rules por design. O lock temporal (`kickoffAt`) é verificado no Route Handler antes de chamar o Admin SDK — essa é a única garantia autoritativa de bloqueio temporal.

---

## 8. Restrições de implementação

1. **Sem `any`** (não aplicável — sem TypeScript nesta tarefa).
2. **Sem alteração em `bonus_predictions`** — fora do escopo desta tarefa.
3. **Sem alteração em outros blocos de `firestore.rules`** (`users`, `matches`, `teams`, etc.).
4. **Sem novo índice** em `firestore.indexes.json`.
5. **O comentário da razão técnica** (matches fora do Firestore) é obrigatório no arquivo de rules — decisão de segurança de primeira classe (R1/R8 do PRD).

---

## 9. Critérios de aceitação

- [ ] Bloco `match /predictions/{predictionId}` em `firestore.rules` contém apenas `allow read: if isApproved()` e `allow write: if false`.
- [ ] O comentário explica: matches fora do Firestore → lock não verificável em rule → write via Route Handler.
- [ ] `firestore.indexes.json` não foi alterado.
- [ ] `npm run test:rules` passa completamente (todos C1–C26 verdes).
- [ ] C11 testa `assertFails` (create client-direto negado).
- [ ] C11b testa `assertFails` (update client-direto negado).
- [ ] C21+ testa `assertFails` (delete client-direto negado).
- [ ] C26 testa `assertFails` (admin client-direto negado em predictions).
- [ ] C13 (leitura palpite alheio por approved) continua `assertSucceeds`.
- [ ] Grep de `setDoc|addDoc|updateDoc|deleteDoc` em `src/**` não encontra nenhuma chamada à coleção `predictions`.
- [ ] Deploy das rules em staging não quebra a leitura de palpites na UI (`listPredictionsByUid` retorna dados sem erro de permissão).

---

## 10. O que esta tarefa NÃO faz

- Não implementa o Route Handler `/api/predictions` — TASK-03.
- Não altera o schema ou tipos de `predictions` — TASK-01.
- Não altera `bonus_predictions` (write ainda permitido client-direto, sem relação com kickoffAt).
- Não configura o cron de pontuação — infra externa (R7 do PRD).
- Não altera o serviço `listPredictionsByUid` — leitura client-side continua funcionando.
- Não cria índices compostos para `predictions`.
- Não afeta nenhuma outra coleção do Firestore.
