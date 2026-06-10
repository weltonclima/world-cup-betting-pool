# SPEC

## 1. Task id and title
- Task: TASK-03
- Title: Schema, tipos e Firestore Rules da credencial WebAuthn

## 2. Objetivo
Definir o contrato de dados das credenciais de passkey (WebAuthn) e a autorização no banco. Criar o schema Zod + tipos derivados da coleção de credenciais e as Security Rules que **negam escrita ao cliente** (exclusiva do Admin SDK, como `predictions`), permitindo apenas leitura das próprias credenciais. Inclui o índice composto para a listagem por usuário. Sem endpoints e sem lógica WebAuthn (TASK-04+).

## 3. In scope
- **Schema Zod** `webauthnCredentialSchema` + tipo `WebauthnCredential` em `src/schemas/` (com `__tests__`), exportado no barrel `src/schemas/index.ts` e tipo em `src/types/`.
- Coleção **raiz `webauthn_credentials`**, doc id = `credentialId` (base64url). Campo `uid` referencia `users.uid`.
- **Firestore Rules** para `webauthn_credentials`:
  - leitura: `isApproved() && isOwner(resource.data.uid)` (ou admin) — espelha `predictions`;
  - escrita (create/update/delete): **negada** (`if false`) — só Admin SDK via Route Handler (TASK-05/07).
- **Índice composto** `webauthn_credentials`: `uid ASC, createdAt DESC` em `firestore.indexes.json` (listagem ordenada por usuário — TASK-06).
- **Testes de rules** no emulador (estender `test/rules/firestore.rules.test.ts`).
- **Testes de schema** (`src/schemas/__tests__/webauthnCredentials.test.ts`).

## 4. Out of scope
- Qualquer Route Handler / endpoint WebAuthn (registro, login) — TASK-05/07.
- Biblioteca `@simplewebauthn`, config `rpId`/origin, challenge cookie — TASK-04.
- Verificação de attestation/assertion, emissão de custom token — TASK-05/07.
- UI de gestão de passkeys — TASK-06.
- Schemas de payload dos endpoints (request/response) — pertencem às tasks dos endpoints.
- Migração de dados (coleção nova, vazia).

## 5. Áreas técnicas envolvidas
- `src/schemas/webauthnCredentials.ts` (novo) + `src/schemas/__tests__/webauthnCredentials.test.ts` (novo).
- `src/schemas/index.ts` — reexporta o novo schema/tipos.
- `src/types/*` — tipo derivado (seguindo o padrão dos demais tipos).
- `firestore.rules` — novo bloco `match /webauthn_credentials/{credentialId}`.
- `firestore.indexes.json` — índice composto `uid + createdAt`.
- `test/rules/firestore.rules.test.ts` — novos casos.

## 6. Regras e comportamento
- **Escrita client = negada a todos (inclusive admin):** credenciais só são gravadas pelo Admin SDK após verificação de attestation/assertion (TASK-05/07). Espelha o padrão `predictions` (`allow write: if false`). Motivo: a prova criptográfica WebAuthn não é verificável por Security Rules.
- **Leitura própria:** o dono `approved` lê as próprias credenciais (para a lista/gestão em TASK-06); admin lê todas. `pending`/`blocked`/não-autenticado: negado. `publicKey`/`counter` ficam legíveis pelo dono — aceitável (chave pública não é segredo; counter não é sensível).
- **Doc id = `credentialId`:** garante unicidade da credencial e lookup direto `credentialId → uid` (login usernameless, M5) sem collectionGroup.
- **`counter`:** inteiro não-negativo; a regra de regressão de counter (anti-clonagem) é aplicada no servidor (TASK-07), não aqui.
- **`.strict()`:** o doc não aceita campos extras (rejeita lixo).

## 7. Contratos e interfaces
Schema (campos do doc `webauthn_credentials/{credentialId}`):
- `credentialId: string` (não-vazio, base64url) — = id do doc.
- `uid: string` (não-vazio) — dono (referência `users.uid`).
- `publicKey: string` (não-vazio, base64url da chave pública COSE).
- `counter: number` (inteiro ≥ 0) — contador de assinatura.
- `transports: string[]` (opcional) — transportes do autenticador (ex.: `internal`, `hybrid`); lista permissiva (a spec WebAuthn evolui).
- `deviceLabel: string` (opcional) — rótulo amigável definido no enrollment (ex.: "iPhone do Welton").
- `createdAt: string` (ISO datetime).
- `lastUsedAt: string` (ISO datetime, opcional).

Tipo derivado `WebauthnCredential = z.infer<typeof webauthnCredentialSchema>`.

- Sem DTOs de endpoint, sem eventos. Reuso dos helpers de `src/schemas/shared` (`nonEmptyString`, `isoDateTime`).
- Constante do nome da coleção (`webauthn_credentials`) exportada para reuso server/teste, se o padrão do projeto usar (senão literal nas rules/endpoints).

## 8. Impacto de dados e persistência
- **Nova coleção** `webauthn_credentials` (vazia; sem migração).
- **Índice composto** `uid ASC, createdAt DESC` (listagem por usuário ordenada) em `firestore.indexes.json`.
- Sem impacto em coleções existentes.

## 9. Testes obrigatórios (TDD — escrever antes)
**Schema** (`webauthnCredentials.test.ts`):
- doc válido (com e sem campos opcionais) parseia.
- faltando `credentialId`/`uid`/`publicKey`/`counter`/`createdAt` → falha.
- `counter` negativo → falha; `counter` não-inteiro → falha.
- `publicKey`/`credentialId`/`uid` vazios → falha.
- campo extra → falha (`.strict()`).
- `transports`/`deviceLabel`/`lastUsedAt` ausentes → ok (opcionais).

**Rules** (`firestore.rules.test.ts`, novos casos; semear um doc `webauthn_credentials` do `approvedUser` e outro de terceiro no `beforeEach` privilegiado):
- `approved` dono lê a própria credencial → sucesso.
- `approved` lê credencial de terceiro → falha.
- `pending`/`blocked` lê a própria → falha (não-approved).
- não-autenticado lê → falha.
- admin lê credencial de terceiro → sucesso.
- qualquer cliente (incl. admin) faz create/update/delete → falha (write negado).

## 10. Critérios de aceite
- Schema valida o doc conforme §7; `__tests__` cobrindo válidos/ inválidos passam.
- Rules: leitura própria por `approved` permitida; leitura alheia e por não-approved negadas; **toda escrita client negada** (create/update/delete), confirmado por teste no emulador.
- Índice composto presente em `firestore.indexes.json`.
- Schema reexportado no barrel; tipo derivado disponível.
- `typecheck` (sem `any`), `lint`, suíte de schema e `test:rules` passam.

## 11. Constraints
- TypeScript strict, sem `any`. Sem `z.intersection`/`.and` (Zod 4 dropa `.refine`; usar `.strict()`/refine direto) — convenção do projeto.
- Nome da coleção em snake_case (`webauthn_credentials`), consistente com `system_logs`, `bonus_predictions`.
- Rules: deny-by-default mantido; novo bloco não pode afrouxar coleções existentes.
- Não importar `firebase-admin` no client; schema é isomórfico (client lê, server escreve).
- Comentários/domínio em pt-BR. Sem UI (N/A estilos).

## 12. Execution cost profile
- tdd: sonnet/high
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/medium

## 13. Frontend indicator
- is_frontend: false
- reason: Schema Zod, tipos e Firestore Security Rules + índice. Sem telas, componentes, layout ou interação.

## 14. Open questions
- `deviceLabel` obrigatório vs opcional: proposto **opcional** (enrollment pode auto-rotular "Dispositivo"); confirmar no /implement se a UI (TASK-06) exigir sempre. Não bloqueia.
- Leitura client direta vs via endpoint para a lista (TASK-06): esta task **permite** leitura própria (mais flexível, espelha `predictions`); se TASK-06 optar por endpoint server, a leitura permitida não causa dano (chave pública não é segredo). Decisão final fica na TASK-06.
