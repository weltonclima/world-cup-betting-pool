# PRD 05 - RANKING

## Produto

Bolão dos Parças

## Versão

1.0

## Objetivo

Permitir que os participantes acompanhem sua posição no bolão através de rankings gerais e rankings por fase da Copa do Mundo.

O sistema deve atualizar automaticamente as posições após a apuração dos resultados dos jogos.

---

# Fluxo

Home

↓

Ranking

↓

Ranking Geral

↓

Ranking por Fase

↓

Perfil do Participante

---

# Objetivos da Tela

O usuário deve conseguir visualizar:

* Sua posição atual
* Evolução da posição
* Total de pontos
* Quantidade de acertos
* Aproveitamento
* Ranking Geral
* Ranking por Fase
* Ranking por Grupo
* Histórico de evolução

---

# Navegação

Bottom Tab Bar

Home

Jogos

Palpites

Ranking

Perfil

---

# Tela 01 - Ranking Geral

## Objetivo

Exibir a classificação completa dos participantes.

### Informações

Posição

Nome

Apelido

Pontos

Acertos

Aproveitamento

### Exemplo

#1 João Silva

98 pontos

15 acertos

---

#2 Maria Souza

95 pontos

14 acertos

---

#3 Pedro Lima

90 pontos

13 acertos

---

## Destaque do Usuário

O usuário logado deve ficar destacado.

Exemplo:

Fundo Verde Claro

Badge:

Você

---

# Tela 02 - Meu Ranking

## Objetivo

Resumo rápido do desempenho pessoal.

### Informações

Posição Atual

Pontuação

Acertos

Erros

Aproveitamento

### Exemplo

Posição

#4

Pontos

87

Acertos

12

Erros

12

Aproveitamento

25%

---

# Tela 03 - Ranking por Fase

## Objetivo

Mostrar desempenho por etapa da Copa.

### Fases

Grupos

Oitavas

Quartas

Semifinal

Final

---

### Exemplo

Fase de Grupos

#2

35 pontos

---

Oitavas

#5

12 pontos

---

# Tela 04 - Evolução no Ranking

## Objetivo

Mostrar histórico de crescimento.

### Exemplo

Rodada 1

#15

↑

Rodada 2

#10

↑

Rodada 3

#4

↑

---

## Indicadores

Subiu

Manteve

Caiu

---

# Tela 05 - Perfil do Participante

## Objetivo

Visualizar estatísticas de outro participante.

### Informações

Nome

Posição

Pontos

Acertos

Aproveitamento

---

# Tela 06 - Estatísticas Gerais

## Objetivo

Comparação com a comunidade.

### Informações

Maior pontuação

Menor pontuação

Média geral

Total de participantes

---

# Sistema de Pontuação

## Acerto Exato

3 pontos

---

## Acertou Vencedor

1 ponto

---

## Errou Resultado

0 pontos

---

# Critérios de Desempate

## Ordem

Maior Pontuação

Maior Quantidade de Acertos Exatos

Maior Aproveitamento

Menor Quantidade de Erros

Data do Primeiro Palpite

---

# Regras de Negócio

Ranking é atualizado automaticamente.

Usuários bloqueados não aparecem.

Usuários pendentes não aparecem.

Apenas usuários aprovados participam.

Ranking deve ser recalculado após atualização dos resultados.

---

# Estrutura Firestore

## rankings

{
id,
userId,
position,
points,
exactHits,
correctWinners,
wrongPredictions,
accuracy,
updatedAt
}

---

## rankingStages

{
id,
userId,
stage,
points,
position
}

---

# Índices Firestore

rankings

position ASC

points DESC

---

rankingStages

stage ASC

position ASC

---

# React Query

["ranking"]

["ranking-general"]

["ranking-stage"]

["ranking-user"]

---

# Atualização

Cloud Function

Executa:

2 horas após encerramento dos jogos

Atualiza:

* Pontuação
* Acertos
* Ranking Geral
* Ranking por Fase
* Estatísticas

---

# Performance

Tempo máximo

2 segundos

Cache

5 minutos

Paginação

20 usuários por página

---

# Estados da Tela

## Loading

Skeleton Ranking

---

## Empty

Nenhum participante encontrado

---

## Error

Erro ao carregar ranking

Botão

Tentar Novamente

---

# Tecnologias

Next.js App Router

Firebase Auth

Firestore

React Query

Tailwind CSS

Shadcn UI

Zod

Lucide Icons

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

# Segurança

Usuário não pode alterar ranking.

Pontuação calculada apenas pelo backend.

Firestore Rules bloqueiam escrita.

---

# Critérios de Aceite

Usuário visualiza ranking geral.

Usuário visualiza ranking por fase.

Usuário visualiza sua posição.

Usuário visualiza evolução.

Usuário visualiza estatísticas.

Sistema recalcula ranking automaticamente.

Ranking funciona em mobile.

Ranking funciona em desktop.

Dados carregam do Firestore.

Nenhuma chamada direta para API-Football.
