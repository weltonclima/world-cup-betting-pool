# PRD 04 - PALPITES

## Objetivo

Permitir que o usuário registre seus palpites para os jogos da Copa do Mundo antes do horário oficial de início de cada partida.

O sistema será responsável por calcular automaticamente os acertos após a atualização dos resultados oficiais.

---

# Fluxo

Home

↓

Jogos

↓

Detalhes do Jogo

↓

Enviar Palpite

↓

Palpite Registrado

↓

Ranking Atualizado

---

# Regras de Negócio

## Regra Principal

O usuário deve informar:

* Gols Time Mandante
* Gols Time Visitante

Exemplo:

Brasil 2 x 1 França

---

## Limite de Alteração

O usuário pode alterar quantas vezes desejar.

Condição:

Antes do horário oficial da partida.

---

## Bloqueio Automático

Quando:

Data/Hora Atual >= Data/Hora do Jogo

Status:

locked

Não será possível:

* Criar palpite
* Editar palpite
* Excluir palpite

---

# Tela 01 - Lista de Palpites

Objetivo:

Visualizar todos os palpites realizados.

Informações:

* Jogo
* Data
* Resultado Palpitado
* Status

Status:

Pendente

Acertou

Errou

Bloqueado

---

# Tela 02 - Detalhe do Jogo

Informações:

* Seleções
* Bandeiras
* Data
* Hora
* Estádio
* Grupo/Fase

Botão:

Enviar Palpite

ou

Editar Palpite

---

# Tela 03 - Enviar Palpite

Campos:

Gols Mandante

Gols Visitante

Exemplo:

Brasil [2]

França [1]

Botão:

Salvar Palpite

---

# Tela 04 - Editar Palpite

Mesmo layout da criação.

Diferença:

Campos preenchidos.

Botão:

Atualizar Palpite

---

# Tela 05 - Palpite Bloqueado

Mensagem:

"O prazo para este jogo foi encerrado."

Exibir:

Resultado informado

Data do jogo

Hora do jogo

---

# Tela 06 - Palpite Registrado

Mensagem:

"Seu palpite foi salvo com sucesso."

Exibir:

Brasil 2 x 1 França

Botão:

Voltar para Jogos

---

# Sistema de Pontuação

## Acerto Exato

Placar completo correto

Exemplo:

Palpite

Brasil 2 x 1 França

Resultado

Brasil 2 x 1 França

Pontos:

3

---

## Resultado Correto

Acertou vencedor

Errou placar

Exemplo:

Palpite

Brasil 2 x 0 França

Resultado

Brasil 3 x 1 França

Pontos:

1

---

## Erro Total

Palpite

Brasil 0 x 1 França

Resultado

Brasil 2 x 1 França

Pontos:

0

---

# Estrutura Firestore

Collection:

predictions

{
id,
userId,
matchId,
homeScorePrediction,
awayScorePrediction,
status,
points,
createdAt,
updatedAt
}

---

# Status

pending

correct

wrong

locked

---

# React Query

Query Key

["predictions"]

["prediction", matchId]

---

# Tecnologias

Next.js

Firebase Auth

Firestore

React Query

React Hook Form

Zod

Shadcn UI

Tailwind CSS

---

# Critérios de Aceite

Usuário consegue criar palpite.

Usuário consegue editar palpite.

Usuário não consegue editar após bloqueio.

Sistema calcula pontuação automaticamente.

Ranking é atualizado automaticamente.

Funciona em mobile.

Funciona em desktop.

Dados carregam via Firestore.

Sem chamadas diretas para API-Football.
