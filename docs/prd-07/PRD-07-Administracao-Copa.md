# PRD 07 - ADMINISTRAÇÃO DO SISTEMA

## Produto
Bolão dos Parças

## Versão
2.0 (Arquitetura Revisada)

---

# Objetivo

Permitir que administradores monitorem o sistema, aprovem usuários e acompanhem a saúde da integração com a API-Football.

O painel administrativo NÃO gerencia jogos, grupos, fases ou classificações da Copa.

Esses dados são consumidos diretamente da API-Football através de Route Handlers do Next.js com cache inteligente.

---

# Arquitetura

Frontend
↓
Next.js Route Handlers
↓
Cache
↓
API-Football

---

# Dados Persistidos no Firestore

users
predictions
rankings
notifications
system_logs

---

# Dados NÃO Persistidos

matches
groups
teams
standings
fixtures

---

# Dashboard Admin

## Usuários

### Pendentes
- Aprovar usuário
- Rejeitar usuário

### Aprovados
- Visualizar
- Bloquear

### Bloqueados
- Reativar acesso

---

# Estatísticas

- Total de usuários
- Usuários aprovados
- Usuários pendentes
- Usuários bloqueados
- Total de palpites
- Total de rankings calculados

---

# Monitoramento API

## Exibir

- Status API
- Última consulta
- Tempo de resposta
- Limite de requisições

---

# Logs

## Eventos

- Aprovação de usuário
- Bloqueio de usuário
- Login Admin
- Erros API
- Reprocessamento Ranking

---

# Cache Strategy

Grupos: 24h

Seleções: 24h

Jogos futuros: 6h

Jogos do dia: 30min

Jogos ao vivo: 1min

Jogos encerrados: 5min nas primeiras 6h

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

Acesso exclusivo para role=admin.

Firestore Rules bloqueiam usuários comuns.

Todas as ações são auditadas.

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

Logs são registrados.

Funciona em mobile.

Funciona em desktop.

Nenhum gerenciamento manual de jogos.
