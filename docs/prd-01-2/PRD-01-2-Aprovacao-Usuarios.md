# PRD 01.2 - Aprovação de Usuários

## Objetivo
Permitir que administradores aprovem, rejeitem ou bloqueiem usuários cadastrados.

## Fluxo

Cadastro
→ Status Pending
→ Tela Aguardando Aprovação
→ Admin Aprova
→ Acesso Liberado

## Tela 01 - Aguardando Aprovação

Mensagem:
Seu cadastro foi realizado com sucesso e está aguardando aprovação.

Ações:
- Atualizar Status
- Sair

## Tela 02 - Usuários Pendentes

Informações:
- Nome
- Email
- Data Cadastro

Ações:
- Aprovar
- Rejeitar

## Tela 03 - Usuários Aprovados

Informações:
- Nome
- Status

Ações:
- Bloquear

## Tela 04 - Conta Bloqueada

Mensagem:
Sua conta foi bloqueada.

## Firestore

status:
- pending
- approved
- blocked

role:
- user
- admin

## Critérios de Aceite

- Usuário não aprovado não acessa o sistema.
- Admin aprova usuários.
- Usuário aprovado acessa Home.
- Usuário bloqueado perde acesso.
