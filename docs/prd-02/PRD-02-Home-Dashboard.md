# PRD 02 - HOME DASHBOARD

## Produto

Bolão dos Parças

## Versão

1.0

## Objetivo

A Home Dashboard será a primeira tela exibida após o login de um usuário aprovado.

Sua função é centralizar todas as informações importantes do bolão e da Copa do Mundo em um único lugar.

O usuário deve conseguir entender rapidamente:

* Sua posição no ranking
* Quantos acertos possui
* Seu aproveitamento
* Próximo jogo disponível para palpite
* Últimos resultados
* Fase atual da Copa
* Avisos do sistema

---

# Fluxo

Login

↓

Validação Firebase Auth

↓

Status Approved

↓

Home Dashboard

↓

Jogos

Palpites

Ranking

Perfil

---

# Layout da Tela

## Header

### Elementos

Logo Bolão dos Parças

Avatar do usuário

Nome do usuário

Botão de notificações

### Exemplo

Olá João 👋

Bem-vindo ao Bolão dos Parças

---

# Card Ranking Geral

## Objetivo

Mostrar posição atual do usuário.

### Informações

Posição

Total participantes

Pontuação

### Exemplo

Ranking Geral

#4

de 28 participantes

87 pontos

---

# Card Acertos

## Objetivo

Mostrar quantidade de resultados corretos.

### Informações

Acertos totais

### Exemplo

12

placares exatos

---

# Card Aproveitamento

## Objetivo

Mostrar percentual de acertos.

### Fórmula

(acertos ÷ jogos palpitados) × 100

### Exemplo

25%

12 de 48 jogos

---

# Card Próximo Jogo

## Objetivo

Destacar o próximo jogo disponível.

### Informações

Seleção A

Seleção B

Data

Hora

Status do palpite

### Exemplo

Brasil 🇧🇷

x

França 🇫🇷

12/06/2026

16:00

Palpite Enviado

ou

Palpite Pendente

### Ações

Ver Jogo

Enviar Palpite

Editar Palpite

---

# Card Fase Atual

## Objetivo

Mostrar estágio atual da Copa.

### Possíveis valores

Fase de Grupos

Oitavas

Quartas

Semifinal

Disputa 3º Lugar

Final

### Exemplo

Fase de Grupos

Rodada 2 de 3

---

# Card Últimos Resultados

## Objetivo

Exibir últimos jogos encerrados.

### Informações

Países

Resultado

Status do usuário

### Exemplo

Brasil 2 x 1 França

Acertou

---

Argentina 1 x 0 México

Errou

---

Alemanha 3 x 2 Espanha

Acertou

---

Limite

Últimos 5 jogos

---

# Card Meu Desempenho

## Objetivo

Resumo completo do usuário.

### Informações

Jogos Palpitados

Acertos

Erros

Aproveitamento

### Exemplo

Jogos Palpitados

24

Acertos

12

Erros

12

Aproveitamento

25%

---

# Card Avisos

## Objetivo

Comunicação do sistema.

### Exemplos

Prazo para palpites encerra em 3 horas

Nova fase liberada

Resultados atualizados

Ranking atualizado

---

# Bottom Navigation

## Obrigatória

### Home

Ícone Casa

### Jogos

Ícone Bola

### Palpites

Ícone Checklist

### Ranking

Ícone Troféu

### Perfil

Ícone Usuário

---

# Estados da Tela

## Loading

Skeleton Cards

Skeleton Header

Skeleton Ranking

---

## Empty

Nenhum jogo disponível

Nenhum resultado encontrado

---

## Error

Erro ao carregar dashboard

Botão

Tentar Novamente

---

# Firestore

## users

```json
{
  "id": "uid",
  "name": "João",
  "email": "joao@email.com",
  "avatarUrl": "",
  "role": "user",
  "status": "approved"
}
```

## rankings

```json
{
  "userId": "uid",
  "position": 4,
  "points": 87,
  "correctScores": 12,
  "accuracy": 25
}
```

## predictions

```json
{
  "userId": "uid",
  "matchId": "123",
  "homeScore": 2,
  "awayScore": 1,
  "isCorrect": true
}
```

## matches

```json
{
  "id": "123",
  "homeTeam": "Brasil",
  "awayTeam": "França",
  "status": "scheduled"
}
```

## statistics

```json
{
  "userId": "uid",
  "gamesPredicted": 24,
  "correct": 12,
  "wrong": 12,
  "accuracy": 25
}
```

---

# Integração API

Origem

API-Football

---

# Estratégia de Cache

Nunca consultar API-Football diretamente pela Home.

A Home deve consumir apenas Firestore.

---

## Atualização de Dados

Cloud Function Agendada

Executa:

2 horas após o encerramento dos jogos.

Atualiza:

* Resultados
* Ranking
* Estatísticas
* Próxima fase

---

# Tecnologias

Next.js App Router

TypeScript

Tailwind CSS

Shadcn UI

Firebase Auth

Firestore

React Query

React Hook Form

Zod

Lucide Icons

---

# Performance

Tempo máximo de carregamento

2 segundos

React Query Cache

5 minutos

Realtime apenas para:

Notificações

Status do usuário

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

Usuário visualiza ranking.

Usuário visualiza posição atual.

Usuário visualiza aproveitamento.

Usuário visualiza próximos jogos.

Usuário visualiza últimos resultados.

Usuário visualiza fase atual.

Dashboard funciona em mobile.

Dashboard funciona em desktop.

Dados carregam do Firestore.

Nenhuma chamada direta para API-Football.

Tempo de carregamento menor que 2 segundos.

Bottom Navigation funciona corretamente.
