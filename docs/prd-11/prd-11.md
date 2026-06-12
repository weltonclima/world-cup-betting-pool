# PRD 11 – SUPER ADMIN

## Produto

Bolão dos Parças

## Versão

1.0

## Dependências

* PRD 09 – Gestão de Grupos
* PRD 10 – Administração de Grupo

---

# Objetivo

Disponibilizar uma área administrativa global responsável pelo gerenciamento completo da plataforma.

O Super Admin possui acesso irrestrito a:

* Todos os grupos
* Todos os usuários
* Todos os administradores
* Dados da Copa
* Sincronização OpenFootball
* Logs do sistema

---

# Escopo

## Gestão de Grupos

* Aprovar grupos
* Bloquear grupos
* Reativar grupos
* Alterar administrador

---

## Gestão Global

* Visualizar todos os grupos
* Visualizar todos os usuários
* Estatísticas globais

---

## Gestão da Copa

* Sincronizar OpenFootball
* Editar partidas
* Corrigir resultados

---

## Auditoria

* Logs
* Histórico de sincronização

---

# Permissões

## Super Admin

Acesso total.

Pode:

* Aprovar grupos
* Bloquear grupos
* Alterar administradores
* Sincronizar dados
* Editar jogos
* Visualizar métricas globais

---

# Navegação

Perfil

↓

Área Super Admin

---

# Telas

## PRD11-01 Dashboard Global

### Objetivo

Visão geral da plataforma.

---

### Cards

Grupos Ativos

Grupos Pendentes

Participantes

Administradores

Jogos

Última Sincronização

---

### Indicadores

Total de Grupos

Total de Usuários

Total de Palpites

Total de Jogos

---

# PRD11-02 Grupos Pendentes

### Objetivo

Aprovar novos grupos.

---

### Lista

Nome

Slug

Criador

Data

---

### Ações

Aprovar

Rejeitar

---

### Resultado

status = active

ou

status = rejected

---

# PRD11-03 Grupos Ativos

### Objetivo

Gerenciar grupos existentes.

---

### Lista

Nome

Admin

Participantes

Status

---

### Ações

Visualizar

Bloquear

Alterar Admin

---

# PRD11-04 Grupos Bloqueados

### Objetivo

Gerenciar grupos bloqueados.

---

### Ações

Reativar

Excluir

---

# PRD11-05 Administradores

### Objetivo

Gerenciar Group Admins.

---

### Lista

Nome

Grupo

Data de Criação

---

### Ações

Substituir

Remover

Transferir Grupo

---

# PRD11-06 Sincronização OpenFootball

### Objetivo

Atualizar Firestore utilizando OpenFootball.

---

### Fonte

https://github.com/openfootball/worldcup.json/tree/master/2026

---

### Botão

Sincronizar Agora

---

### Processo

1. Buscar dados OpenFootball
2. Normalizar
3. Atualizar Firestore
4. Gerar Log

---

### Resultado

Jogos Atualizados

Seleções Atualizadas

Grupos Atualizados

---

# PRD11-07 Jogos da Copa

### Objetivo

Visualizar todas as partidas.

---

### Filtros

Grupo

Fase

Seleção

Status

---

### Lista

Mandante

Visitante

Data

Resultado

Status

---

### Ações

Visualizar

Editar

---

# PRD11-08 Editar Resultado

### Objetivo

Permitir correções manuais.

---

### Campos

Mandante

Visitante

Data

Hora

Estádio

Gols Mandante

Gols Visitante

Status

---

### Botão

Salvar

---

### Campos Internos

editedBy

editedAt

isManualOverride

---

### Regra

Quando:

isManualOverride = true

A sincronização não sobrescreve o jogo.

---

# PRD11-09 Logs

### Objetivo

Auditoria.

---

### Tipos

Sincronização

Edição Manual

Aprovação de Grupo

Bloqueio de Grupo

Troca de Administrador

---

### Campos

Usuário

Ação

Data

Detalhes

---

# Firestore

## groups

```json
{
  "id": "",
  "name": "",
  "adminId": "",
  "status": "active"
}
```

---

## users

```json
{
  "groupId": "",
  "role": "participant"
}
```

---

## matches

```json
{
  "id": "",
  "homeTeam": "",
  "awayTeam": "",
  "homeScore": 0,
  "awayScore": 0,
  "status": "",
  "group": "",
  "stage": "",
  "stadium": "",
  "editedBy": "",
  "editedAt": "",
  "isManualOverride": false
}
```

---

## sync_logs

```json
{
  "id": "",
  "executedBy": "",
  "executedAt": "",
  "matchesUpdated": 0,
  "teamsUpdated": 0,
  "groupsUpdated": 0
}
```

---

# Route Handlers

## Dashboard

GET

/api/admin/dashboard

---

## Aprovar Grupo

POST

/api/admin/groups/approve

---

## Bloquear Grupo

POST

/api/admin/groups/block

---

## Sincronizar Copa

POST

/api/admin/worldcup/sync

---

## Editar Jogo

PUT

/api/admin/matches/[id]

---

## Logs

GET

/api/admin/logs

---

# React Query

## Query Keys

```ts
["admin-dashboard"]

["admin-groups"]

["admin-groups-pending"]

["admin-groups-active"]

["admin-admins"]

["admin-matches"]

["admin-logs"]

["admin-sync"]
```

---

# Segurança

Acesso exclusivo:

```ts
role === "super_admin"
```

---

Validação obrigatória no servidor.

Nunca confiar em permissões do frontend.

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

* Super Admin acessa dashboard global.
* Super Admin aprova grupos.
* Super Admin bloqueia grupos.
* Super Admin altera administradores.
* Super Admin sincroniza OpenFootball.
* Super Admin edita resultados.
* Sistema respeita isManualOverride.
* Logs são registrados.
* Firestore atualizado corretamente.
* Compatível com Firebase Spark.
* Sem Cloud Functions.
* Funciona em mobile.
* Funciona em desktop.
