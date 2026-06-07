# SPEC — AUTH TASK-05: Cloud Function — primeiro usuário vira admin (A1)

> Entrada: `ai/plan/auth.md` (TASK-05) + `ai/prd/auth.md` (R1/B1) + `.claude/CLAUDE.md` (stack Firebase, controle de acesso) + `firestore.rules`.
> Tipo: `integration` · Criticidade: `critical` · Risco técnico: `medium` · Story points: 3.
> TDD: sim · Screen: não · Dependências: nenhuma — Wave 1.

> Nota de naming: o slot `ai/spec/task-05.md` já está ocupado pelo SPEC da TASK-05 do plano `feature.md` (fundação PRD-00, "Inicializar Firebase"). Para não sobrescrever artefato não relacionado, este SPEC do plano `auth.md` foi gravado como `ai/spec/auth-task-05.md` (mesma convenção de `auth-task-01.md`).

---

## 1. Task: AUTH-TASK-05 — Cloud Function: primeiro usuário vira admin

## 2. Objetivo

Promover automaticamente o **primeiro** documento criado em `users/{uid}` para `role: "admin"`, `status: "approved"`. Todos os usuários subsequentes permanecem `role: "user"`, `status: "pending"` (como o auto-cadastro client já grava). Isso roda **server-side** via Cloud Function (Admin SDK), porque as Security Rules (`firestore.rules`) **bloqueiam** o client de escrever `admin`/`approved` no `allow create`/`allow update` de `users/{uid}` — o sistema precisa de um caminho privilegiado para nascer com um admin (R1, bloqueante de produção).

### Truths que devem ser verdadeiras ao fim
- Existe um trigger Firestore `onDocumentCreated("users/{uid}")` (firebase-functions **v2**).
- O primeiro documento `users/{uid}` criado é atualizado para `{ role: "admin", status: "approved", updatedAt: <ISO string> }`.
- A flag `system_settings/bootstrap.firstAdminAssigned` passa a `true` na mesma transação.
- O segundo (e seguintes) documentos `users/{uid}` **não** são modificados (flag já `true`).
- A decisão (promover ou não) é feita dentro de uma **transação Firestore** sobre `system_settings/bootstrap` → seguro contra corrida em cadastros simultâneos e idempotente.
- A função é exportada de `functions/src/index.ts` seguindo o padrão `./functions/<nome>`.
- Admin SDK inicializado via o singleton existente (`functions/src/firebase/admin.ts`) — sem dupla inicialização.
- Sem `any`; TS strict.

---

## 3. In scope
- `functions/src/functions/promoteFirstAdmin.ts`:
  - Lógica central pura/testável `promoteFirstAdminTx(tx, db, uid)` que executa a leitura/decisão/escrita dentro de uma transação:
    - Lê `system_settings/bootstrap`.
    - Se `firstAdminAssigned !== true`: `tx.set(bootstrapRef, { firstAdminAssigned: true }, { merge: true })` e `tx.update(users/{uid}, { role: "admin", status: "approved", updatedAt })`.
    - Caso contrário: no-op.
  - Wrapper de trigger `promoteFirstAdmin = onDocumentCreated("users/{uid}", handler)` que extrai `uid` do `event.params`, obtém `db = getFirestore()`, e roda `db.runTransaction((tx) => promoteFirstAdminTx(tx, db, uid))`.
  - Import do singleton Admin: `import "../firebase/admin"` (mesmo padrão de `firestore/writer.ts`).
  - `updatedAt` em **ISO string** (`new Date().toISOString()`), coerente com o resto do projeto (`createdAt` ISO).
- Export em `functions/src/index.ts`: `export { promoteFirstAdmin } from "./functions/promoteFirstAdmin";`.
- Tests em `functions/src/__tests__/promoteFirstAdmin.test.ts`, mockando uma transação Firestore mínima.

## 4. Out of scope
- Painel admin para aprovar/bloquear usuários (outra PRD / TASK-07 do plano).
- Custom claims / auth guard de admin nas outras functions (TODO já anotado em `syncTeams`).
- Criação do doc `users/{uid}` pelo client (TASK-06 — serviços de auth).
- Regras Firestore (já existem; esta function depende do bypass do Admin SDK, por design).
- Deploy real da function (documentado no /release: deploy **antes** do 1º cadastro real).

## 5. Main technical areas
- `functions/src/functions/promoteFirstAdmin.ts` (novo).
- `functions/src/index.ts` (1 linha de export).
- `functions/src/firebase/admin.ts` (reuso do singleton — sem alteração).
- `functions/src/__tests__/promoteFirstAdmin.test.ts` (novo).

## 6. Business rules and behavior
- **Promoção do 1º usuário:** somente o documento inaugural vira `admin`/`approved`.
- **Idempotência / reentrância:** a decisão é gated pela flag `system_settings/bootstrap.firstAdminAssigned` lida dentro da transação. Reexecução do mesmo evento (retries do Functions) não promove um segundo usuário.
- **Corrida (B1):** dois cadastros simultâneos disparam dois eventos; a transação sobre o mesmo doc `bootstrap` serializa as decisões — apenas o primeiro a commitar promove; o segundo relê a flag já `true` e faz no-op.
- **updatedAt:** ISO string (consistente com `createdAt` ISO definido na TASK-06).
- **merge na flag:** `set(..., { merge: true })` para não apagar eventuais outros campos futuros de `system_settings/bootstrap`.

## 7. Contracts and interfaces
```ts
// firebase-functions v2
export const promoteFirstAdmin: CloudFunction<FirestoreEvent<...>>;

// núcleo testável
type PromotionResult = { promoted: boolean };
export async function promoteFirstAdminTx(
  tx: Transaction,
  db: Firestore,
  uid: string,
): Promise<PromotionResult>;
```
- A escrita no doc do usuário usa exatamente `{ role: "admin", status: "approved", updatedAt: string }`.
- A flag usa `{ firstAdminAssigned: true }` com `{ merge: true }`.

## 8. Data and persistence impact
- Escreve/atualiza `system_settings/bootstrap` (campo `firstAdminAssigned`).
- Atualiza `users/{uid}` (apenas o 1º): `role`, `status`, `updatedAt`.
- Nenhuma outra coleção tocada.

## 9. Required tests (TDD — escritos antes da implementação)
Mock de uma `Transaction` mínima (`get`/`set`/`update` espionáveis) + `db` com refs determinísticas:
- **T1 — 1º usuário:** `bootstrap` inexistente (ou `firstAdminAssigned` ausente) → `promoted: true`, `tx.update` chamado no ref de `users/{uid}` com `{ role: "admin", status: "approved", updatedAt: <ISO> }`, e `tx.set` do `bootstrap` com `{ firstAdminAssigned: true }` (merge).
- **T2 — 2º usuário:** `bootstrap.firstAdminAssigned === true` → `promoted: false`, `tx.update`/`tx.set` **não** chamados.
- **T3 — idempotência/reentrância:** rodar a transação duas vezes com a flag já `true` → sempre no-op; nenhum segundo usuário promovido.
- **T4 — formato updatedAt:** o valor gravado é uma ISO string válida (`Date.parse` não-NaN / regex ISO).

## 10. Acceptance criteria
- [ ] `functions/src/functions/promoteFirstAdmin.ts` exporta `promoteFirstAdmin` (trigger v2) e `promoteFirstAdminTx` (núcleo).
- [ ] Usa `onDocumentCreated` de `firebase-functions/v2/firestore` no path `users/{uid}`.
- [ ] Reusa o singleton `../firebase/admin` (sem `initializeApp` duplicado).
- [ ] Transação sobre `system_settings/bootstrap`; promove só se `firstAdminAssigned !== true`.
- [ ] `updatedAt` em ISO string.
- [ ] Export adicionado em `functions/src/index.ts` no padrão `./functions/<nome>`.
- [ ] Sem `any`; TS strict; mesmo estilo/imports das functions existentes.
- [ ] `npx vitest run` (em `functions/`) verde, cobrindo T1–T4.

## 11. UI/Screen requirement
- Requires screen: no
- Platform: n/a
- Screens involved: none

## 12. Constraints
- Não usar `any` (CLAUDE.md regra 1).
- Espelhar versão/estilo das functions existentes (firebase-functions **v2**, `firebase-functions/v2/*`).
- Não inicializar o Admin SDK duas vezes — usar o singleton existente.
- Não commitar (revisão central).

## 13. Open questions
- Nenhuma. Estratégia de transação sobre `system_settings/bootstrap` travada no plano (`ai/plan/auth.md` §3 TASK-05, B1).
