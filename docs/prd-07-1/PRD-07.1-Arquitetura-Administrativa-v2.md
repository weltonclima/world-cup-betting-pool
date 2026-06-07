# PRD 07.1 - ARQUITETURA ADMINISTRATIVA E PERMISSÕES (VERSÃO FINAL)

## Produto
Bolão dos Parças

## Objetivo

Definir a arquitetura de autenticação, autorização, permissões e navegação administrativa do sistema.

A PRD 07.1 não adiciona novas funcionalidades de negócio, apenas define regras de acesso.

---

# Conceito

Existe apenas uma aplicação.

Não existe:

- Portal Admin separado
- Domínio Admin separado
- Menu Admin separado
- Área Admin isolada

Administradores utilizam exatamente a mesma aplicação dos usuários.

---

# Perfis

## USER

Permissões:

- Home
- Jogos
- Palpites
- Ranking
- Perfil

---

## ADMIN

Permissões:

- Todas do usuário
- Dashboard Admin
- Usuários Pendentes
- Usuários Aprovados
- Usuários Bloqueados
- Status API
- Logs do Sistema

---

# Roles

```ts
type Role =
  | "user"
  | "admin"
```

---

# Status

```ts
type UserStatus =
  | "pending"
  | "approved"
  | "blocked"
```

---

# Estrutura Firestore

## users

```json
{
  "id":"uid",
  "name":"João Silva",
  "email":"joao@email.com",
  "role":"admin",
  "status":"approved",
  "createdAt":"timestamp",
  "updatedAt":"timestamp"
}
```

---

# Navegação

Todos os usuários visualizam:

- Home
- Jogos
- Palpites
- Ranking
- Perfil

BottomTabBar permanece igual para todos.

---

# Perfil Usuário

Menus:

- Dados Pessoais
- Segurança
- Notificações
- Minhas Estatísticas
- Histórico de Palpites
- Sair

---

# Perfil Admin

Menus:

- Dados Pessoais
- Segurança
- Notificações
- Minhas Estatísticas
- Histórico de Palpites

---

## Administração

Dashboard

Gerenciar Aprovações

Usuários Ativos

Usuários Bloqueados

Status da API

Logs do Sistema

---

Sair

---

# Regras

A seção Administração aparece apenas quando:

role === admin

---

Usuários comuns nunca visualizam:

- Dashboard
- Aprovações
- Status API
- Logs

---

# Fluxo Login

Login
↓
Firebase Auth
↓
Consultar users
↓
Validar role
↓
Validar status

---

# Status Pending

Pode autenticar.

Visualiza:

"Aguardando Aprovação"

---

# Status Approved

Acesso normal.

---

# Status Blocked

Pode autenticar.

Visualiza:

"Conta Bloqueada"

---

# Rotas

/app

/home
/jogos
/palpites
/ranking
/perfil

/admin/dashboard
/admin/usuarios/pendentes
/admin/usuarios/aprovados
/admin/usuarios/bloqueados
/admin/api-status
/admin/logs

---

# Middleware

Proteção:

/admin/*

Validação:

role === admin

---

# Firestore Rules

Usuário:

Pode acessar apenas seus dados.

Admin:

Pode gerenciar usuários.

Pode acessar logs.

---

# Auditoria

Registrar:

- Login Admin
- Aprovação
- Rejeição
- Bloqueio
- Reativação

---

# Segurança

Validação obrigatória:

- Frontend
- Middleware
- API Routes
- Firestore Rules

---

# Tecnologias

Next.js App Router
Firebase Auth
Firestore
React Query
Zod
Tailwind CSS
Shadcn UI

---

# Critérios de Aceite

Admin visualiza seção Administração no Perfil.

Usuário comum não visualiza seção Administração.

BottomTabBar é igual para todos.

Middleware protege rotas.

Firestore Rules aplicadas.

Logs registrados.

Funciona mobile.

Funciona desktop.
