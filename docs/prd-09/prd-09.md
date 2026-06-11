# PRD 09 – GESTÃO DE GRUPOS

## Produto

Bolão dos Parças

## Versão

1.0

## Status

Em Planejamento

---

# Objetivo

Permitir que o sistema opere com múltiplos grupos independentes.

Cada participante pertence obrigatoriamente a um grupo.

Cada grupo possui um administrador responsável pela aprovação e gerenciamento dos participantes.

Os grupos são aprovados e administrados globalmente pelo Super Admin.

---

# Escopo

Esta PRD contempla:

* Criação de grupos
* Aprovação de grupos
* Validação de grupos no cadastro
* Associação usuário → grupo
* Administração básica do grupo
* Estrutura de permissões

Não contempla:

* Aprovação de usuários
* Dashboard administrativo do grupo
* Dashboard Super Admin

Essas funcionalidades pertencem às PRDs 10 e 11.

---

# Perfis do Sistema

## participant

Participante comum.

Permissões:

* Visualizar jogos
* Enviar palpites
* Visualizar ranking
* Editar perfil

---

## group_admin

Administrador do grupo.

Permissões:

* Aprovar usuários
* Bloquear usuários
* Editar informações do grupo

---

## super_admin

Administrador global.

Permissões:

* Aprovar grupos
* Bloquear grupos
* Gerenciar administradores
* Sincronizar dados da Copa
* Editar resultados

---

# Fluxo Geral

## Participante

Cadastro
↓
Seleciona Grupo
↓
Validação
↓
Conta criada
↓
Aguardando aprovação

---

## Criador do Grupo

Criar Grupo
↓
Solicitação enviada
↓
Super Admin aprova
↓
Grupo ativo
↓
Criador vira Group Admin

---

# Tela 01

## PRD09-01 – Criar Grupo

### Objetivo

Permitir criar um novo grupo.

### Campos

Nome do Grupo

Slug

Descrição

Foto do Grupo (opcional)

---

### Validações

Nome obrigatório

Slug obrigatório

Slug único

Descrição opcional

---

### Botão

Criar Grupo

---

### Resultado

Coleção:

groups

status:

pending

---

# Tela 02

## PRD09-02 – Solicitação Enviada

Mensagem:

Grupo criado com sucesso.

Aguardando aprovação do administrador global.

---

# Tela 03

## PRD09-03 – Selecionar Grupo

Adicionar ao fluxo de cadastro.

Campo:

Qual é o seu grupo?

---

### Busca

Nome

Slug

---

### Exemplo

Bolão dos Parças

amigos-do-trabalho

familia-2026

---

# Tela 04

## PRD09-04 – Grupo Não Encontrado

Mensagem:

Grupo não encontrado.

Verifique o código informado.

---

Ações

Tentar novamente

Criar Grupo

---

# Tela 05

## PRD09-05 – Detalhes do Grupo

Informações:

Nome

Descrição

Administrador

Quantidade de Participantes

Data de Criação

Status

---

# Regras de Negócio

Todo usuário deve pertencer a um grupo.

Não existe usuário sem grupo.

---

Slug deve ser único.

---

Um grupo possui apenas um administrador principal.

---

Super Admin pode alterar administrador.

---

Grupo bloqueado:

Não aceita novos usuários.

---

Grupo pendente:

Não aparece nas buscas.

---

Grupo ativo:

Disponível para cadastro.

---

# Firestore

## groups

```json
{
  "id": "group_001",
  "name": "Bolão dos Parças",
  "slug": "bolao-dos-parcas",
  "description": "Grupo principal",
  "photoUrl": "",
  "adminId": "user_001",
  "status": "pending",
  "membersCount": 0,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## users

```json
{
  "id": "user_001",
  "name": "João",
  "email": "joao@email.com",
  "groupId": "group_001",
  "role": "participant",
  "status": "pending"
}
```

---

# Índices Firestore

groups.slug

groups.status

users.groupId

users.role

users.status

---

# React Query

## Query Keys

```ts
["groups"]

["group", id]

["group-search", query]
```

---

# Route Handlers

## Criar Grupo

POST

/api/groups

---

## Buscar Grupo

GET

/api/groups/search

---

## Detalhe Grupo

GET

/api/groups/[id]

---

# Estados da UI

## Loading

Skeleton

---

## Empty

Nenhum grupo encontrado.

---

## Error

Erro ao carregar informações.

Botão:

Tentar novamente

---

# Segurança

Somente usuários autenticados.

Slug validado no backend.

Permissões verificadas no servidor.

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

* Usuário consegue criar grupo.
* Sistema valida slug único.
* Grupo é criado como pending.
* Usuário consegue buscar grupo.
* Sistema valida grupo existente.
* Usuário consegue vincular-se ao grupo.
* Grupo bloqueado não aceita participantes.
* Grupo pendente não aparece na busca.
* Firestore atualizado corretamente.
* Funciona em mobile.
* Funciona em desktop.
* Compatível com Firebase Spark.
