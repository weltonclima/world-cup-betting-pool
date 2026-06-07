# PRD 07 - ADMINISTRAÇÃO DO SISTEMA (VERSÃO FINAL)

## Produto
Bolão dos Parças

## Objetivo
Permitir que administradores gerenciem usuários e monitorem a operação do sistema sem interferir nos dados oficiais da Copa do Mundo.

---

# Decisão Arquitetural

Não existe portal administrativo separado.

O administrador utiliza a mesma aplicação dos usuários.

Após login, administradores possuem acesso adicional ao módulo Administração.

---

# Perfis

## User

Acesso:
- Home
- Jogos
- Palpites
- Ranking
- Perfil

## Admin

Acesso:
- Home
- Jogos
- Palpites
- Ranking
- Perfil
- Administração

---

# Fluxo

Login
↓
Home
↓
Perfil
↓
Painel Administrativo
↓
Dashboard Admin

---

# Dashboard Admin

Indicadores:

- Total usuários
- Usuários pendentes
- Usuários aprovados
- Usuários bloqueados
- Total palpites
- Status API

---

# Tela Usuários Pendentes

Ações:
- Aprovar usuário
- Rejeitar usuário

---

# Tela Usuários Aprovados

Ações:
- Visualizar usuário
- Bloquear usuário

---

# Tela Usuários Bloqueados

Ações:
- Reativar usuário

---

# Tela Status API

Exibir:

- Status API-Football
- Última consulta
- Tempo resposta
- Cache Hit Rate

Sem sincronização manual.

---

# Tela Logs

Eventos:

- Login Admin
- Aprovação usuário
- Bloqueio usuário
- Erros API
- Atualização ranking

---

# Arquitetura Dados

## Firestore

users
predictions
rankings
notifications
system_logs

## API Football

matches
groups
teams
standings
fixtures

---

# Estratégia de Cache

Grupos: 24h

Seleções: 24h

Jogos futuros: 6h

Jogos do dia: 30min

Jogos ao vivo: 1min

Jogos encerrados: 5min durante primeiras 6h

---

# Ranking

Atualizado por Cloud Function.

Executa a cada 2 horas.

Processa:

- Resultados oficiais
- Pontuação
- Ranking Geral
- Ranking por Fase

---

# Segurança

role = user

role = admin

status = pending

status = approved

status = blocked

---

# Middleware

Proteção:

/admin/*

Apenas:

role === admin

---

# Tecnologias

Next.js
TypeScript
Firebase Auth
Firestore
React Query
Zod
Tailwind CSS
Shadcn UI

---

# Critérios de Aceite

Admin acessa dashboard.

Admin aprova usuários.

Admin bloqueia usuários.

Admin monitora API.

Logs registrados.

Sem gerenciamento manual da Copa.

Funciona em mobile.

Funciona em desktop.
