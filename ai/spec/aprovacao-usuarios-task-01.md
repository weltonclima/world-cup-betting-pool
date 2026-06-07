# SPEC — TASK-01: Cobertura de rules p/ ações admin (PRD-01.2)

> Requires screen: no · TDD: yes (emulator) · Type: infra/security/test

## Reframe (descoberta na execução)
`firestore.rules` **já existe e já está correto** para gestão de usuários (PRD-01/TASK-08):
- `match /users/{uid}`: `read: isOwner(uid) || isAdmin()`; `update: isAdmin() || (isOwner && role/status inalterados)`; `create` força `pending`/`user`; `delete: isAdmin()`.
- Cobre A1 (Rejeitar=blocked), A2 (client+rules), A5 (desbloquear) sem alteração.
- R4 (updatedAt junto de status) resolvido: regra admin libera qualquer campo.

**Rules file NÃO muda.** Tarefa = só ampliar cobertura de teste.

## Mudança
Arquivo único: `test/rules/firestore.rules.test.ts`, describe "perfil users (role/status)". Adicionar:
- C8b: admin grava `status + updatedAt` juntos → allow (prova caminho do service TASK-02).
- C21: admin `approved→blocked` → allow (Bloquear).
- C22: admin `blocked→approved` → allow (Desbloquear).
- C23: admin `pending→blocked` → allow (Rejeitar).
- C24: admin lê doc de terceiro → allow (base da listagem).
- C25: `user` (approved) muda status de terceiro → deny (defesa).

Reusa helpers/seeds existentes (`adminDb/approvedDb/pendingDb/blockedDb`, seeds `*User`).

## Critérios de aceite
- `npm run test:rules` verde, incluindo os 6 casos novos.
- Nenhuma alteração em `firestore.rules`.

## Resultado
31/31 testes passam (emulator Firestore, Java 17). ✔
