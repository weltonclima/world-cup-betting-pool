# PRD 08 - CENTRAL DE NOTIFICAÇÕES

## Produto
Bolão dos Parças

## Versão
1.0

---

# Objetivo

Permitir que os participantes acompanhem eventos importantes do bolão através de notificações internas do sistema.

A solução será compatível com o plano Firebase Spark, sem utilização de Cloud Functions ou serviços pagos.

---

# Escopo

O sistema possuirá uma Central de Notificações integrada ao aplicativo.

As notificações serão armazenadas no Firestore e exibidas através de um sino no Header.

---

# Fora do Escopo (V1)

- Push Notification
- Firebase Cloud Messaging
- E-mail
- WhatsApp
- Telegram
- Cloud Functions

---

# Tipos de Notificação

## Sistema

- Cadastro aprovado
- Cadastro rejeitado
- Conta bloqueada
- Conta reativada

---

## Jogos

- Novos jogos disponíveis
- Prazo de palpites próximo do encerramento
- Fase liberada

---

## Ranking

- Ranking atualizado
- Mudança de posição
- Entrada no Top 10

---

## Bolão

- Início da Copa
- Encerramento da fase
- Encerramento do bolão

---

# Tela 01 - Central de Notificações

## Objetivo

Exibir todas as notificações do usuário.

### Informações

- Título
- Mensagem resumida
- Data
- Status de leitura

### Filtros

- Todas
- Sistema
- Jogos
- Ranking
- Bolão

---

# Tela 02 - Detalhe da Notificação

## Objetivo

Visualizar detalhes completos da notificação.

### Informações

- Título
- Mensagem completa
- Data
- Hora

### Ações

- Ver Ranking
- Ver Jogo
- Voltar

Dependendo do tipo da notificação.

---

# Tela 03 - Preferências de Notificação

Localização:

Perfil → Notificações

### Opções

Sistema

Jogos

Ranking

Bolão

### Tipo

Switch On/Off

---

# Header

Adicionar ícone:

🔔 Notificações

---

# Badge

Quando existirem notificações não lidas:

Exibir contador.

Exemplo:

🔔 3

---

# Fluxo

Usuário acessa sistema
↓
Nova notificação criada
↓
Badge atualizado
↓
Usuário abre central
↓
Notificação marcada como lida

---

# Firestore

## notifications

```json
{
  "id":"notificationId",
  "userId":"uid",
  "type":"ranking",
  "title":"Ranking atualizado",
  "message":"Você subiu para a posição #4",
  "isRead":false,
  "createdAt":"timestamp"
}
```

---

## notificationPreferences

```json
{
  "userId":"uid",
  "system":true,
  "games":true,
  "ranking":true,
  "pool":true
}
```

---

# API Routes

## Aprovação Usuário

/api/admin/approve-user

Cria notificação.

---

## Bloqueio Usuário

/api/admin/block-user

Cria notificação.

---

## Atualização Ranking

/api/ranking/update

Cria notificações de ranking.

---

## Jogos

/api/worldcup/matches

Gera notificações relacionadas a jogos.

---

# React Query

## Query Keys

["notifications"]

["notification", id]

["notification-preferences"]

---

# Estados da Tela

## Loading

Skeleton

---

## Empty

Nenhuma notificação encontrada

---

## Error

Erro ao carregar notificações

Botão:

Tentar novamente

---

# Segurança

Usuário visualiza apenas suas notificações.

Firestore Rules devem impedir acesso a notificações de outros usuários.

---

# Tecnologias

Next.js App Router

Firebase Auth

Firestore

React Query

React Hook Form

Zod

Tailwind CSS

Shadcn UI

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

Usuário visualiza notificações.

Usuário visualiza badge.

Usuário marca notificações como lidas.

Usuário altera preferências.

Usuário acessa detalhes da notificação.

Funciona mobile.

Funciona desktop.

Compatível com Firebase Spark.

Sem Cloud Functions.
