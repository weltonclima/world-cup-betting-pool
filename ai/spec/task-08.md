# SPEC — TASK-08: Firestore Security Rules (status/role)

> Entrada: `ai/plan/feature.md` (TASK-08) + `ai/prd/feature.md` + `.claude/CLAUDE.md` (coleções, controle de acesso: roles `user`/`admin`, status `pending`/`approved`/`blocked`) + `ai/spec/task-07.md` (formatos das 9 coleções) + `firestore.rules` (placeholder atual) + `firebase.json` (emuladores).
> Tipo: `infra` · Criticidade: `critical` · Risco técnico: `high` · Story points: 5.
> TDD: **sim (obrigatório)** · Screen: não · Dependências: **TASK-05** (firebase init), **TASK-07** (formatos) — Wave 4.

---

## 1. Objetivo

Substituir o **placeholder deny-by-default** de `firestore.rules` por **regras reais de controle de acesso** que decidem leitura/escrita combinando **dois eixos**: o **status** do usuário (`pending` | `approved` | `blocked`) e o **role** (`user` | `admin`). As regras são a **última linha de defesa** de segurança do projeto (o frontend nunca é confiável) e por isso entram com **TDD obrigatório** via `@firebase/rules-unit-testing` rodando contra o **emulador do Firestore**.

Modelo em uma frase: **só usuário autenticado e `approved` enxerga as áreas internas**; **cada um escreve apenas os próprios palpites**; **só `admin` muda `role`/`status` de terceiros e administra dados do torneio**; **o auto-cadastro nasce sempre `pending`/`user`** e não pode se auto-promover.

### Truths que devem ser verdadeiras ao fim
- `firestore.rules` deixa de ser `allow read, write: if false` global e passa a expressar o modelo abaixo, mantendo **deny-by-default** para qualquer path não casado.
- Existem 5 helper functions reutilizadas: `isSignedIn()`, `isAdmin()`, `isApproved()`, `isOwner(uid)`, `getUserData()`.
- `isAdmin()`/`isApproved()` leem o doc `users/{request.auth.uid}` via `get(/databases/$(database)/documents/users/$(uid))`.
- Auto-cadastro força `status == "pending"` **e** `role == "user"` — impossível se auto-conceder `admin`/`approved`.
- Coleções internas (`matches`, `teams`, `groups`, `rankings`, `statistics`, `predictions`, `bonus_predictions`, `system_settings`) só são lidas por `approved`; `pending`/`blocked` são negados.
- `predictions`/`bonus_predictions`: criar/atualizar **só o próprio** (uid casa). Escrita administrativa em `teams`/`groups`/`matches`/`rankings`/`statistics`/`system_settings`: **só admin** (Cloud Functions usam o Admin SDK, que **ignora** as rules).
- Suíte `@firebase/rules-unit-testing` cobre os casos críticos (§5) e passa no emulador — **ou**, se o JDK Java não estiver disponível, as rules + testes ficam escritos e a execução é sinalizada como **gap manual** (§6).

---

## 2. Escopo

### Dentro do escopo
- Reescrita de `firestore.rules` com helpers + `match` por coleção.
- Suíte de testes de regras em `test/rules/firestore.rules.test.ts` (ver §5).
- Ajuste de `package.json`: devDependency `@firebase/rules-unit-testing` + script de execução dos testes de regras contra o emulador.
- Documentação inline (comentários) das **decisões de modelagem** dentro do `.rules` (em pt-BR, conciso).

### Fora do escopo (tarefas posteriores / refinamentos)
- **Validação de schema dentro das rules** (forma dos campos, enums, placares ≥ 0): a forma é garantida pelos schemas Zod na escrita via `services/` (TASK-07). As rules validam **apenas** os campos de controle de acesso (`role`, `status`, `uid`) — não reimplementam o Zod. Validação estrutural completa nas rules fica como refinamento futuro.
- **Trava "partida não começou"** para `predictions` (impedir palpite após o `kickoffAt`): **refinamento futuro** — exige `get()` do doc `matches/{matchId}` e comparação com `request.time`. Registrado em §8/§9, não implementado aqui.
- **`firestore.indexes.json`**: nenhum índice composto novo é exigido por esta task (sem queries novas). Arquivo permanece como está.
- Cloud Functions e seu acesso via Admin SDK → TASK-09 (apenas **referenciado** aqui: o Admin SDK bypassa rules).
- UI de "Aguardando Aprovação"/painel admin → tarefas de UI.

> Não alterar `.claude/`, `docs/`, `next.config.ts`, `tsconfig.json`, configs de Tailwind/ESLint. Esta task toca `firestore.rules`, adiciona `test/rules/*` e ajusta `package.json` (devDep + script).

---

## 3. Decisões técnicas

### 3.1 `rules_version = '2'`
**Decisão D1:** manter `rules_version = '2'` (já no placeholder). Necessário para `getAfter`, funções com `get()` e semântica moderna de `match`.

### 3.2 Deny-by-default preservado
**Decisão D2:** nenhuma regra "abre" um path por engano. Cada coleção tem `match` explícito; o que não casar fica **negado** (não há `match /{document=**} { allow read, write: if true }`). Não usar wildcard permissivo.

### 3.3 Leitura do doc do requester via `get()`
**Decisão D3:** `role` e `status` **não** estão em custom claims do Auth nesta fase — vivem em `users/{uid}` (TASK-07). Logo as rules leem o doc do próprio requisitante:

```
function getUserData() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
}
```

> **Custo:** cada decisão que chama `isAdmin()`/`isApproved()` faz **1 `get()`** (cobrado como leitura de documento, mas barato no porte < 100 usuários). O `get()` exige `isSignedIn()` antes — caso contrário `request.auth.uid` é `null` e o path fica inválido. Por isso os helpers **sempre** curto-circuitam em `isSignedIn()` primeiro (ver §3.4). Custom claims podem substituir o `get()` num refinamento futuro de performance (§9).

### 3.4 Ordem de avaliação / curto-circuito
**Decisão D4:** `isAdmin()` e `isApproved()` devem ser **seguros quando não autenticado**. Padrão: `isSignedIn() && getUserData().<campo> == <valor>`. Como CEL avalia `&&` com curto-circuito, o `get()` só roda para usuário autenticado, evitando erro de path com `uid` nulo.

### 3.5 Imutabilidade de `role`/`status` no update do próprio doc
**Decisão D5:** o usuário pode atualizar o próprio `users/{uid}` (ex.: `name`, `nickname`), **mas não** `role` nem `status`. Isso é verificado comparando `request.resource.data` (novo) com `resource.data` (atual):

```
request.resource.data.role == resource.data.role &&
request.resource.data.status == resource.data.status
```

> Só `admin` pode alterar `role`/`status` de qualquer doc `users` (aprovar/bloquear/promover).

### 3.6 Defaults forçados no auto-cadastro (create)
**Decisão D6:** no `create` de `users/{uid}` feito pelo próprio usuário (signup), as rules **forçam**:

```
request.auth.uid == uid &&
request.resource.data.status == "pending" &&
request.resource.data.role == "user"
```

Impossível nascer `approved` ou `admin`. O `admin` (via console/Functions/Admin SDK) cria/edita sem essa amarra. Reflete `.claude/CLAUDE.md`: "Todo novo usuário nasce com `status: pending`".

### 3.7 Leitura de palpites de terceiros — decisão explícita
**Decisão D7:** **usuários `approved` podem ler todos os `predictions`** (não só os próprios). Justificativa: rankings, comparações e telas sociais do bolão exibem palpites alheios após o jogo; restringir leitura por uid quebraria essas telas e o cálculo client-side de comparação. **Escrita** permanece restrita ao dono (cada um só cria/edita o próprio palpite). A trava temporal ("não revelar palpite antes do `kickoffAt`") é um **refinamento futuro** (§8) — no MVP, a leitura ampla entre `approved` é aceitável e documentada. O mesmo vale para `bonus_predictions` (leitura por `approved`, escrita só do dono).

### 3.8 Escrita administrativa vs. Cloud Functions (Admin SDK)
**Decisão D8:** dados do torneio (`teams`, `groups`, `matches`, `rankings`, `statistics`, `system_settings`) têm **escrita só para `admin`** pelas rules. Na prática, quem popula/atualiza essas coleções em produção são as **Cloud Functions** (sync API-Football, recálculo de ranking/estatística) usando o **Firebase Admin SDK**, que **bypassa as Security Rules por design**. Logo a regra `isAdmin()` cobre o caso de escrita manual via cliente admin, e as Functions operam por fora. Não é necessário (nem possível) "liberar" o service account nas rules.

> **Nota:** `statistics/{uid}` e `rankings/*` são **derivados** (calculados por Functions). Nenhum cliente comum escreve neles → `write: if isAdmin()` é suficiente e seguro.

### 3.9 Estrutura dos paths
**Decisão D9 (assumido, alinhado a TASK-07):**
- `users/{uid}` — id = Firebase Auth uid.
- `predictions/{predictionId}` — doc guarda `uid` e `matchId` no payload (TASK-07 §4.5 sugere id `"{uid}_{matchId}"`); a regra de ownership compara `request.resource.data.uid == request.auth.uid`, **não** depende do formato do id.
- `bonus_predictions/{bonusId}` — idem, ownership por `data.uid`.
- `system_settings/{settingId}` (ex.: `global`), `statistics/{uid}`, `rankings/{scope}`, `teams/{teamId}`, `groups/{groupId}`, `matches/{matchId}`.

### 3.10 Validação mínima de tipo nas rules
**Decisão D10:** nos pontos de controle de acesso, validar **tipo/enum** apenas do que importa para segurança: no `create` de `users`, exigir `status is string` e valores exatos (`"pending"`/`"user"`). Não duplicar o Zod inteiro (D fora de escopo §2). Mantém as rules legíveis e a responsabilidade de forma no `services/`+Zod.

---

## 4. Modelo de acesso — tabela coleção × operação

> `own` = doc pertence ao requisitante (uid casa). `approved` = autenticado **e** `status == "approved"`. `admin` = autenticado **e** `role == "admin"`. `self@signup` = create do próprio `users/{uid}` com defaults forçados. Tudo que não estiver na tabela é **negado** (deny-by-default).

| Coleção | read | create | update | delete |
|---|---|---|---|---|
| `users/{uid}` | dono **ou** admin | `self@signup` (uid casa, `status="pending"`, `role="user"`) **ou** admin | dono (sem mudar `role`/`status`) **ou** admin (pode mudar `role`/`status`) | admin |
| `teams/*` | approved | admin | admin | admin |
| `groups/*` | approved | admin | admin | admin |
| `matches/*` | approved | admin | admin | admin |
| `rankings/*` | approved | admin | admin | admin |
| `statistics/{uid}` | approved | admin | admin | admin |
| `predictions/*` | approved (lê todos — D7) | own (`data.uid == auth.uid`) | own | own **ou** admin |
| `bonus_predictions/*` | approved (lê todos — D7) | own | own | own **ou** admin |
| `system_settings/*` | approved | admin | admin | admin |
| `*` (qualquer outro path) | negado | negado | negado | negado |

> Observações:
> - `users` read: **só o dono e o admin** leem o perfil — não é `approved`-amplo (perfil tem e-mail/role/status; não deve vazar para todos). Telas que precisam do **apelido** de terceiros usam o campo desnormalizado em `rankings.entries[].nickname` / `statistics` (TASK-07), não a coleção `users`.
> - `predictions`/`bonus_predictions` delete por admin: permitido para moderação/limpeza; o MVP pode não usar, mas a regra contempla.
> - Cloud Functions (Admin SDK) ignoram esta tabela inteira (D8).

---

## 5. Helper functions (lógica)

Definidas **uma vez** dentro de `match /databases/{database}/documents`, reusadas por todos os `match` de coleção.

```
function isSignedIn() {
  return request.auth != null;
}

function getUserData() {
  // requer isSignedIn() garantido pelo chamador (curto-circuito)
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
}

function isAdmin() {
  return isSignedIn() && getUserData().role == "admin";
}

function isApproved() {
  return isSignedIn() && getUserData().status == "approved";
}

function isOwner(uid) {
  return isSignedIn() && request.auth.uid == uid;
}
```

Notas de implementação:
- `getUserData()` faz `get(/databases/$(database)/documents/users/$(request.auth.uid)).data` — **o doc do próprio requisitante** (D3). Se o doc `users/{uid}` não existir ainda (ex.: signup em andamento), `isAdmin()`/`isApproved()` resultam `false` (acesso negado), o que é o comportamento seguro desejado.
- `isOwner(uid)` recebe o **uid alvo** — usado tanto com o `{uid}` do path (`users`) quanto com `resource.data.uid`/`request.resource.data.uid` (`predictions`, `bonus_predictions`).
- Curto-circuito `&&` garante que o `get()` nunca roda para não autenticado (D4).

### 5.1 Como `role`/`status` são checados via `get()`

A consulta `get(/databases/$(database)/documents/users/$(request.auth.uid))` retorna um snapshot; `.data` expõe os campos do doc. Daí:
- `getUserData().role == "admin"` → admin.
- `getUserData().status == "approved"` → liberado para áreas internas.
`pending` e `blocked` simplesmente **não satisfazem** `status == "approved"`, logo qualquer `match` de coleção interna que exija `isApproved()` os nega automaticamente — sem regra negativa explícita.

---

## 6. Estrutura proposta de `firestore.rules`

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ---- Helpers (status/role via get() do doc do requisitante) ----
    function isSignedIn() { return request.auth != null; }
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    function isAdmin()    { return isSignedIn() && getUserData().role == "admin"; }
    function isApproved() { return isSignedIn() && getUserData().status == "approved"; }
    function isOwner(uid) { return isSignedIn() && request.auth.uid == uid; }

    // ---- users: perfil/role/status ----
    match /users/{uid} {
      allow read: if isOwner(uid) || isAdmin();

      // auto-cadastro: força status="pending" + role="user"; ou admin cria livre
      allow create: if isAdmin() || (
        isOwner(uid) &&
        request.resource.data.status == "pending" &&
        request.resource.data.role == "user"
      );

      // dono atualiza o próprio doc SEM mudar role/status; admin muda tudo
      allow update: if isAdmin() || (
        isOwner(uid) &&
        request.resource.data.role == resource.data.role &&
        request.resource.data.status == resource.data.status
      );

      allow delete: if isAdmin();
    }

    // ---- predictions: leitura ampla (approved), escrita só do dono ----
    match /predictions/{predictionId} {
      allow read:   if isApproved();
      allow create: if isApproved() && isOwner(request.resource.data.uid);
      allow update: if isApproved() && isOwner(resource.data.uid)
                                    && isOwner(request.resource.data.uid);
      allow delete: if isOwner(resource.data.uid) || isAdmin();
    }

    // ---- bonus_predictions: mesma política de predictions ----
    match /bonus_predictions/{bonusId} {
      allow read:   if isApproved();
      allow create: if isApproved() && isOwner(request.resource.data.uid);
      allow update: if isApproved() && isOwner(resource.data.uid)
                                    && isOwner(request.resource.data.uid);
      allow delete: if isOwner(resource.data.uid) || isAdmin();
    }

    // ---- Coleções do torneio: approved lê, admin escreve (Functions usam Admin SDK) ----
    match /teams/{teamId}        { allow read: if isApproved(); allow write: if isAdmin(); }
    match /groups/{groupId}      { allow read: if isApproved(); allow write: if isAdmin(); }
    match /matches/{matchId}     { allow read: if isApproved(); allow write: if isAdmin(); }
    match /rankings/{scope}      { allow read: if isApproved(); allow write: if isAdmin(); }
    match /statistics/{uid}      { allow read: if isApproved(); allow write: if isAdmin(); }
    match /system_settings/{id}  { allow read: if isApproved(); allow write: if isAdmin(); }

    // ---- Deny-by-default: qualquer outro path ----
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

> O `match /{document=**} { if false }` final é **redundante** (não casar já nega), mas é mantido como afirmação explícita de intenção. `allow write` = `create, update, delete` agregados.
> No `update` de `predictions`/`bonus_predictions`, exigir ownership **no estado atual e no novo** (`resource.data.uid` e `request.resource.data.uid`) impede "roubar" um palpite reescrevendo o `uid`.

---

## 7. Tooling de teste (TDD)

### 7.1 Dependência e infraestrutura
- **Já presentes** no projeto (`package.json`): `vitest`, `firebase-tools` e scripts `emulators` / `emulators:exec` (project `demo-bolao-dos-parcas`); `firebase.json` já configura o emulador Firestore na porta **8080**.
- **A adicionar** no passo de implementação:

```bash
npm i -D @firebase/rules-unit-testing
```

- Script sugerido em `package.json` (executa os testes de regras **dentro** do emulador Firestore):

```json
"test:rules": "firebase emulators:exec --only firestore --project demo-bolao-dos-parcas \"vitest run test/rules\""
```

> O `emulators:exec` sobe o emulador, roda o comando e derruba o emulador ao final — ideal para CI e execução pontual.

### 7.2 Layout de arquivos de teste

```
test/
└── rules/
    └── firestore.rules.test.ts     # suíte @firebase/rules-unit-testing
```

> Os testes de **rules** ficam **fora** de `src/` (são testes de infraestrutura, não de unidade de código app) e usam `@firebase/rules-unit-testing` — distinto dos testes Zod da TASK-07 (`src/schemas/__tests__/`). O glob `test/rules` no script `test:rules` os isola; o `vitest run` padrão (sem caminho) pode incluí-los, mas eles **só passam** dentro do emulador, então a recomendação é rodá-los via `test:rules`.

### 7.3 Esqueleto da suíte

```ts
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-bolao-dos-parcas",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Semear docs users/{uid} com role/status via contexto privilegiado
  // (withSecurityRulesDisabled) para que getUserData() encontre o perfil.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc("users/approvedUser").set({
      uid: "approvedUser", name: "Ana", nickname: "ana",
      email: "ana@x.com", role: "user", status: "approved",
    });
    await db.doc("users/pendingUser").set({
      uid: "pendingUser", name: "Beto", nickname: "beto",
      email: "beto@x.com", role: "user", status: "pending",
    });
    await db.doc("users/adminUser").set({
      uid: "adminUser", name: "Cida", nickname: "cida",
      email: "cida@x.com", role: "admin", status: "approved",
    });
  });
});
```

Contextos por ator:
- `testEnv.authenticatedContext("approvedUser").firestore()` → cliente autenticado/approved.
- `testEnv.authenticatedContext("pendingUser").firestore()` → pending.
- `testEnv.authenticatedContext("adminUser").firestore()` → admin.
- `testEnv.unauthenticatedContext().firestore()` → anônimo.

### 7.4 Casos de teste concretos (mínimos obrigatórios)

| # | Cenário | Ator | Operação | Esperado |
|---|---|---|---|---|
| C1 | **Approved lê área interna** | approvedUser | `get matches/m1` | `assertSucceeds` |
| C2 | **Pending negado em área interna** | pendingUser | `get matches/m1` | `assertFails` |
| C3 | **Blocked negado** | blockedUser (seed) | `get matches/m1` | `assertFails` |
| C4 | **Não autenticado negado** | unauth | `get matches/m1` | `assertFails` |
| C5 | **Dono atualiza o próprio perfil** (campo neutro) | approvedUser | `update users/approvedUser {nickname}` | `assertSucceeds` |
| C6 | **Escalonamento de role negado** | approvedUser | `update users/approvedUser {role:"admin"}` | `assertFails` |
| C7 | **Auto-aprovação de status negada** | pendingUser | `update users/pendingUser {status:"approved"}` | `assertFails` |
| C8 | **Admin aprova usuário** | adminUser | `update users/pendingUser {status:"approved"}` | `assertSucceeds` |
| C9 | **Signup força pending/user** | newUser (auth) | `create users/newUser {status:"pending",role:"user",...}` | `assertSucceeds` |
| C10 | **Signup tentando admin/approved** | newUser (auth) | `create users/newUser {status:"approved",role:"admin"}` | `assertFails` |
| C11 | **Cria o próprio palpite** | approvedUser | `create predictions/p1 {uid:"approvedUser",...}` | `assertSucceeds` |
| C12 | **Cria palpite de terceiro (cross-user)** | approvedUser | `create predictions/p2 {uid:"adminUser",...}` | `assertFails` |
| C13 | **Approved lê palpite alheio (D7)** | approvedUser | `get predictions/p_outro` | `assertSucceeds` |
| C14 | **Pending não cria palpite** | pendingUser | `create predictions/p3 {uid:"pendingUser"}` | `assertFails` |
| C15 | **Usuário comum não escreve em matches/teams** | approvedUser | `set matches/m9` | `assertFails` |
| C16 | **Admin escreve em matches** | adminUser | `set matches/m9` | `assertSucceeds` |
| C17 | **Bônus: cria só o próprio** | approvedUser | `create bonus_predictions/b1 {uid:"approvedUser"}` | `assertSucceeds` |
| C18 | **Bônus: cross-user negado** | approvedUser | `create bonus_predictions/b2 {uid:"adminUser"}` | `assertFails` |
| C19 | **Perfil de terceiro não vaza** | approvedUser | `get users/adminUser` | `assertFails` |
| C20 | **Path desconhecido negado** | adminUser | `get foo/bar` | `assertFails` |

> Seeds adicionais necessários: `blockedUser` (status `blocked`) para C3; um `predictions/p_outro` (uid de terceiro) via contexto privilegiado para C13. Usar `assertSucceeds`/`assertFails` do próprio pacote. Disciplina TDD: escrever os testes (red), depois ajustar `firestore.rules` até verde.

---

## 8. ⚠️ DEPENDÊNCIA CRÍTICA — Java JDK para o emulador Firestore

> **O Firestore Emulator exige Java (JDK) instalado e no `PATH`.** Sem Java, o emulador **não sobe** e os testes de regras **não executam** — mesmo com as rules e a suíte 100% escritas.

Procedimento e fallback:
1. Verificar disponibilidade: `java -version` (precisa de **JDK 11+**; recomendado JDK 17 LTS).
2. **Se Java estiver disponível:** rodar a suíte via emulador e exigir verde:
   ```bash
   npm run test:rules
   # equivalente:
   firebase emulators:exec --only firestore --project demo-bolao-dos-parcas "vitest run test/rules"
   ```
3. **Se Java NÃO estiver disponível:**
   - **Entregar mesmo assim** `firestore.rules` reescrito + `test/rules/firestore.rules.test.ts` completo + devDependency + script `test:rules` no `package.json`.
   - **NÃO** marcar a task como concluída-com-testes-verdes. Em vez disso, **sinalizar explicitamente ao usuário** que existe um **gap manual de execução**: instalar o JDK e rodar o comando acima localmente/CI para validar.
   - Registrar no relatório final, em destaque: *"Rules e testes escritos; execução do emulador bloqueada por ausência de Java JDK — rodar `firebase emulators:exec --only firestore --project demo-bolao-dos-parcas \"vitest run test/rules\"` após instalar o JDK."*

> Esta é a razão de o risco técnico ser **alto**: a corretude do controle de acesso só é **comprovada** com os testes rodando no emulador. Entregar rules sem rodar a suíte é um risco de segurança a ser fechado pelo usuário.

---

## 9. Critérios de aceite, riscos e notas

### 9.1 Passo a passo de implementação
1. Adicionar devDependency `@firebase/rules-unit-testing` e o script `test:rules` no `package.json`.
2. Escrever `test/rules/firestore.rules.test.ts` com os seeds (§7.3) e os casos C1–C20 (§7.4) — **antes** de finalizar as rules (TDD red).
3. Reescrever `firestore.rules` conforme §6 (helpers + matches + deny-by-default).
4. Verificar Java (`java -version`).
5. Rodar `npm run test:rules` → verde (ou acionar o fallback de §8).
6. Reportar a saída real e, se aplicável, o gap manual.

### 9.2 Critérios de aceite (checklist)
- [ ] `firestore.rules` não é mais `allow read, write: if false` global; expressa o modelo da §4 com deny-by-default preservado.
- [ ] Helpers `isSignedIn()`, `getUserData()`, `isAdmin()`, `isApproved()`, `isOwner(uid)` definidos e reusados.
- [ ] `isAdmin()`/`isApproved()` leem `users/{request.auth.uid}` via `get(/databases/$(database)/documents/users/$(uid))`, com curto-circuito em `isSignedIn()`.
- [ ] Auto-cadastro força `status == "pending"` **e** `role == "user"`; auto-promoção a admin/approved é negada.
- [ ] Dono atualiza o próprio `users` sem alterar `role`/`status`; só admin altera `role`/`status`.
- [ ] `pending`/`blocked`/anônimo não leem coleções internas; `approved` lê.
- [ ] `predictions`/`bonus_predictions`: create/update só do dono (uid casa nos dois estados); leitura ampla para `approved` (D7 documentada).
- [ ] `teams`/`groups`/`matches`/`rankings`/`statistics`/`system_settings`: escrita só admin (Functions via Admin SDK bypassam — documentado).
- [ ] `@firebase/rules-unit-testing` adicionado; suíte `test/rules/firestore.rules.test.ts` com C1–C20.
- [ ] `npm run test:rules` verde no emulador **ou** gap de Java JDK sinalizado em destaque (§8).
- [ ] Nenhuma alteração em `.claude/`, `docs/`, configs fora de escopo.

### 9.3 Riscos e mitigações

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| T1 | **Java JDK ausente** → emulador não sobe → testes não rodam | Alta | Verificar `java -version`; se faltar, entregar rules+testes e sinalizar gap manual (§8) |
| T2 | `get()` com `request.auth.uid` nulo quebra avaliação | Média | Curto-circuito `isSignedIn() && getUserData()...` (D4) |
| T3 | Custo de `get()` por decisão (1 leitura) | Baixa | Porte < 100 usuários; custom claims como refinamento futuro (D3/§9.4) |
| T4 | Update de `predictions` reescrevendo `uid` para roubar palpite | Média | Exigir ownership no estado atual **e** novo (`resource.data.uid` + `request.resource.data.uid`) |
| T5 | Vazamento de perfil de terceiros (e-mail/role) | Média | `users` read só para dono/admin; apelido vem desnormalizado de `rankings`/`statistics` |
| T6 | Rules sem validar forma dos campos (placar, enums) | Baixa | Forma garantida por Zod no `services/` (TASK-07); validação estrutural nas rules é refinamento futuro |
| T7 | Palpite enviado/lido após início do jogo | Média | Trava temporal por `kickoffAt` é refinamento futuro (precisa `get(matches/{id})` vs `request.time`) — registrado, fora do MVP |
| T8 | Doc `users/{uid}` inexistente durante signup faz helper falhar | Baixa | Comportamento seguro: `isAdmin()/isApproved()` viram `false` (nega) — coberto por teste |

### 9.4 Notas para próximas tarefas / refinamentos futuros
- **Trava temporal de palpites:** adicionar em `predictions` `allow create/update` uma condição comparando `get(/databases/$(database)/documents/matches/$(request.resource.data.matchId)).data.kickoffAt` com `request.time`, negando após o início. Exige índice de leitura cruzada e custa +1 `get()` por escrita.
- **Custom claims** (`role`/`status` no token Auth) podem substituir o `get()` de `getUserData()` por leitura de `request.auth.token.*`, eliminando o custo de leitura — requer Cloud Function que sincroniza claims ao aprovar/promover (TASK-09+).
- **Validação estrutural nas rules** (enums, placares ≥ 0, campos obrigatórios) pode espelhar parte do Zod como defesa em profundidade — avaliar custo/benefício.
- **TASK-09** (Functions) escreve em `matches`/`teams`/`rankings`/`statistics` via Admin SDK, ignorando estas rules por design — não depende de "abrir" nada aqui.
