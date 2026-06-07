# PRD 03 - JOGOS

## Objetivo

Permitir que o usuário visualize todos os jogos da Copa do Mundo, consulte detalhes das partidas e identifique rapidamente quais jogos possuem palpites pendentes ou já enviados.

---

# Fluxo

Home

↓

Jogos

↓

Lista de Jogos

↓

Detalhes do Jogo

↓

Enviar ou Editar Palpite

---

# Objetivos da Tela

A tela Jogos será o catálogo oficial de partidas da Copa.

Ela deve permitir:

* Visualizar todos os jogos
* Filtrar por fase
* Filtrar por seleção
* Ver status do palpite
* Acessar detalhes da partida
* Navegar para envio de palpite

---

# Layout Principal

## Header

Elementos:

* Título Jogos
* Campo de busca
* Botão de filtros

---

# Filtros

## Fase

* Fase de Grupos
* Oitavas
* Quartas
* Semifinal
* 3º Lugar
* Final

---

## Status

Todos

Palpite Enviado

Palpite Pendente

Jogo Encerrado

---

## Seleção

Pesquisa por país

Exemplo:

Brasil

Argentina

França

Alemanha

---

# Lista de Jogos

Cada item da lista deve exibir:

## Seleção Mandante

Bandeira

Nome

---

## Seleção Visitante

Bandeira

Nome

---

## Informações

Data

Hora

Estádio

Cidade

---

## Status do Jogo

Agendado

Ao Vivo

Encerrado

---

## Status do Palpite

Palpite Enviado

Palpite Pendente

Bloqueado

---

# Card de Jogo

Exemplo

Brasil 🇧🇷

x

França 🇫🇷

12/06/2026

16:00

Palpite Enviado

Botão

Ver Detalhes

---

# Tela Detalhes do Jogo

## Informações

Times

Escudos

Bandeiras

Data

Hora

Estádio

Cidade

Fase

Grupo

---

## Status do Palpite

Enviado

Pendente

Bloqueado

---

## Ações

Enviar Palpite

Editar Palpite

Visualizar Resultado

---

# Estados da Tela

## Loading

Skeleton List

Skeleton Card

---

## Empty

Nenhum jogo encontrado

---

## Error

Erro ao carregar jogos

Botão

Tentar novamente

---

# Regras de Negócio

Usuário pode visualizar todos os jogos.

Usuário pode filtrar jogos.

Usuário pode pesquisar por seleção.

Jogos encerrados não podem receber palpites.

Palpites são bloqueados no horário oficial de início.

Jogos ao vivo ficam somente para consulta.

---

# Integração com Firestore

Coleções

matches

predictions

---

## matches

* id
* homeTeam
* awayTeam
* matchDate
* matchStatus
* stage
* group
* venue

---

## predictions

* userId
* matchId
* homeScore
* awayScore
* createdAt

---

# Estratégia de Dados

Tela Jogos consulta apenas Firestore.

Nenhuma chamada direta para API-Football.

---

# Atualização de Dados

Cloud Function

Atualização automática

2 horas após encerramento dos jogos

Atualiza:

* resultados
* status
* próxima fase

---

# Tecnologias

Next.js App Router

TypeScript

Tailwind CSS

Shadcn UI

Firebase Auth

Firestore

React Query

Zod

React Hook Form

Lucide Icons

---

# Performance

Cache React Query

5 minutos

Tempo máximo de carregamento

2 segundos

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

Usuário visualiza todos os jogos.

Usuário filtra por fase.

Usuário pesquisa por seleção.

Usuário visualiza status do palpite.

Usuário acessa detalhes do jogo.

Jogos encerrados não aceitam palpites.

Dados carregam do Firestore.

Sem chamadas diretas para API-Football.

Layout responsivo.

Bottom Navigation funcional.
