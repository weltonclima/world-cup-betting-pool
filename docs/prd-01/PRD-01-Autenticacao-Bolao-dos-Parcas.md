# PRD 01 - Autenticação

## Produto
Bolão dos Parças

## Objetivo
Permitir cadastro, login e aprovação manual de usuários antes do acesso à plataforma.

## Regras de Negócio

- Todo novo usuário inicia com status `pending`.
- Apenas usuários aprovados podem acessar o sistema.
- O administrador possui acesso apenas para aprovar ou bloquear usuários.
- Usuários não aprovados visualizam a tela "Aguardando Aprovação".

## Fluxo

1. Usuário cria conta.
2. Sistema salva usuário com status `pending`.
3. Administrador aprova cadastro.
4. Usuário recebe acesso ao sistema.

## Telas

### Login
Campos:
- E-mail
- Senha

Ações:
- Entrar
- Criar Conta
- Esqueci minha senha

### Cadastro
Campos:
- Nome
- Apelido
- E-mail
- Senha

Ações:
- Criar Conta

### Aguardando Aprovação
Mensagem:
"Seu cadastro foi realizado com sucesso e está aguardando aprovação."

Botão:
- Atualizar Status

## Firebase

Coleção users

```json
{
  "uid": "abc123",
  "name": "João Silva",
  "nickname": "joao",
  "email": "joao@email.com",
  "role": "user",
  "status": "pending"
}
```

## Critérios de Aceite

- Usuário consegue criar conta.
- Usuário não aprovado não acessa áreas internas.
- Admin consegue aprovar usuário.
- Após aprovação, login é liberado.
