# PRD 07.1 - ARQUITETURA ADMINISTRATIVA E PERMISSÕES

## Produto
Bolão dos Parças

## Versão
1.0

---

# Objetivo

Definir a arquitetura de autenticação, autorização, permissões, navegação e segurança da área administrativa.

Esta PRD complementa a PRD 07 e não adiciona novas funcionalidades de negócio.

---

# Conceitos

O sistema possui apenas uma aplicação.

Não existe portal administrativo separado.

Administradores utilizam a mesma aplicação dos usuários.

---

# Perfis

## USER

Permissões:

- Visualizar jogos
- Criar palpites
- Editar palpites
- Visualizar ranking
- Visualizar perfil

---

## ADMIN

Permissões:

- Todas do usuário
- Aprovar usuários
- Rejeitar usuários
- Bloquear usuários
- Reativar usuários
- Visualizar logs
- Monitorar API

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

# Fluxo de Login

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

# Regras

## Pending

Pode logar.

Não acessa sistema.

Visualiza tela:

"Aguardando Aprovação".

---

## Approved

Acesso completo.

---

## Blocked

Pode logar.

Visualiza:

"Conta Bloqueada".

Sem acesso.

---

# Navegação User

Bottom Tab Bar

- Home
- Jogos
- Palpites
- Ranking
- Perfil

---

# Navegação Admin

Mesmo Bottom Tab Bar.

A diferença:

Perfil exibe:

- Painel Administrativo

---

# Perfil Admin

Menus:

- Dados Pessoais
- Segurança
- Notificações
- Minhas Estatísticas
- Histórico de Palpites
- Painel Administrativo
- Sair

---

# Fluxo Administrativo

Perfil
↓
Painel Administrativo
↓
Dashboard Admin

---

# Rotas

/app

/home
/jogos
/palpites
/ranking
/perfil

/admin

/dashboard
/usuarios/pendentes
/usuarios/aprovados
/usuarios/bloqueados
/api-status
/logs

---

# Middleware

Protege:

/admin/*

Validação:

role === admin

---

# Guards Frontend

Menu Admin aparece apenas:

role === admin

---

# Firestore Rules

Usuário comum:

Pode ler apenas seus dados.

Admin:

Pode ler e atualizar usuários.

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

Nunca confiar apenas no frontend.

Todas validações devem ocorrer:

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

Usuário comum não acessa admin.

Admin acessa admin.

Middleware protege rotas.

Menu admin aparece apenas para admins.

Logs são registrados.

Firestore Rules aplicadas.

Funciona mobile.

Funciona desktop.
