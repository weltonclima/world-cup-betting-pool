# PRD 10 – ADMINISTRAÇÃO DE GRUPO

## Produto

Bolão dos Parças

## Versão

1.0

## Dependências

* PRD 09 – Gestão de Grupos

---

# Objetivo

Permitir que o administrador de um grupo gerencie seus participantes, convites e configurações sem acesso aos demais grupos do sistema.

O Group Admin possui acesso restrito apenas ao grupo que administra.

---

# Escopo

Esta PRD contempla:

* Dashboard do Grupo
* Aprovação de Usuários
* Bloqueio de Usuários
* Gestão de Participantes
* Convites
* Configurações do Grupo

Não contempla:

* Aprovação de grupos
* Gestão global
* Sincronização da Copa

Essas funcionalidades pertencem à PRD 11.

---

# Permissões

## Group Admin

Pode:

* Aprovar participantes
* Rejeitar participantes
* Bloquear participantes
* Desbloquear participantes
* Editar grupo
* Gerar convites

Não pode:

* Visualizar outros grupos
* Aprovar grupos
* Editar resultados da Copa
* Acessar dashboard global

---

# Navegação

Perfil

↓

Administração do Grupo

---

# Telas

## PRD10-01 – Dashboard do Grupo

### Objetivo

Visão geral do grupo.

---

### Cards

Participantes

Pendentes

Bloqueados

Convites Ativos

---

### Últimos Cadastros

Lista:

Nome

Data

Status

---

### Ações Rápidas

Aprovar Usuários

Convites

Configurações

---

# PRD10-02 – Usuários Pendentes

### Objetivo

Gerenciar solicitações de entrada.

---

### Lista

Nome

Email

Data de Cadastro

---

### Ações

Aprovar

Rejeitar

---

### Resultado

status = approved

ou

status = rejected

---

# PRD10-03 – Usuários Aprovados

### Objetivo

Visualizar participantes ativos.

---

### Lista

Nome

Email

Data de Entrada

Pontuação Atual

Posição Ranking

---

### Ações

Bloquear

Promover para Admin

---

# PRD10-04 – Usuários Bloqueados

### Objetivo

Gerenciar bloqueios.

---

### Lista

Nome

Motivo

Data do Bloqueio

---

### Ações

Desbloquear

Excluir

---

# PRD10-05 – Configurações do Grupo

### Objetivo

Editar informações do grupo.

---

### Campos

Nome

Descrição

Foto

Quantidade Máxima de Participantes

Permitir Convites

---

### Botão

Salvar Alterações

---

# PRD10-06 – Convites

### Objetivo

Gerar convites.

---

### Tipos

Link

Código

---

### Exemplo

```text
bolao.app/invite/ABC123
```

---

### Código

```text
ABC123
```

---

### Configurações

Validade

Quantidade de Usos

---

# Regras de Negócio

Grupo Admin visualiza apenas usuários do próprio grupo.

---

Participante aprovado:

status = approved

---

Participante bloqueado:

status = blocked

---

Participante rejeitado:

status = rejected

---

Grupo Admin não pode remover o Super Admin.

---

Somente um administrador principal por grupo.

---

# Firestore

## groups

```json
{
  "id": "",
  "name": "",
  "description": "",
  "adminId": "",
  "status": "active"
}
```

---

## users

```json
{
  "id": "",
  "groupId": "",
  "role": "participant",
  "status": "approved"
}
```

---

## invites

```json
{
  "id": "",
  "groupId": "",
  "code": "ABC123",
  "maxUses": 100,
  "usedCount": 0,
  "expiresAt": "timestamp",
  "isActive": true
}
```

---

# Índices Firestore

users.groupId

users.status

users.role

invites.groupId

invites.code

---

# Route Handlers

## Dashboard

GET

/api/group/dashboard

---

## Pendentes

GET

/api/group/users/pending

---

## Aprovar

POST

/api/group/users/approve

---

## Bloquear

POST

/api/group/users/block

---

## Convites

POST

/api/group/invites

GET

/api/group/invites

---

# React Query

## Query Keys

```ts
["group-dashboard"]

["group-users"]

["group-users-pending"]

["group-users-approved"]

["group-users-blocked"]

["group-invites"]
```

---

# Estados da UI

## Loading

Skeleton

---

## Empty

Nenhum registro encontrado.

---

## Error

Erro ao carregar informações.

Botão:

Tentar novamente

---

# Segurança

Validação obrigatória de groupId.

Todas as operações verificam:

```ts
user.groupId === resource.groupId
```

---

# Responsividade

Mobile First

360px

390px

430px

Tablet

768px

Desktop

1024px+

---

# Critérios de Aceite

* Admin visualiza dashboard.
* Admin aprova participantes.
* Admin rejeita participantes.
* Admin bloqueia participantes.
* Admin desbloqueia participantes.
* Admin edita grupo.
* Admin gera convites.
* Admin acessa apenas seu grupo.
* Firestore atualizado corretamente.
* Funciona em mobile.
* Funciona em desktop.
* Compatível com Firebase Spark.
