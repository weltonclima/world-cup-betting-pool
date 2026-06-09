# PRD03.3 — Sistema de Palpites Copa do Mundo 2026

## Status
Versão consolidada e definitiva da funcionalidade de palpites do Bolão dos Parças.

Esta PRD substitui integralmente a PRD03.1 e PRD03.2.

---

# Visão Geral

O sistema de palpites deve permitir que o usuário complete toda a Copa do Mundo 2026 em poucos minutos, utilizando preenchimento em massa, classificação automática e chaveamento dinâmico.

Objetivos:

- Reduzir quantidade de cliques
- Reduzir abandono
- Aumentar taxa de conclusão
- Melhorar experiência mobile
- Suportar Copa do Mundo 2026

---

# Estrutura da Competição

## Fase de Grupos

- 12 grupos (A-L)
- 4 seleções por grupo
- 6 jogos por grupo
- 72 partidas

Classificam:

- 12 primeiros colocados
- 12 segundos colocados
- 8 melhores terceiros

Total: 32 seleções

---

# Eliminatórias

## 16 Avos
16 confrontos

## Oitavas
8 confrontos

## Quartas
4 confrontos

## Semifinais
2 confrontos

## 3º Lugar
1 confronto

## Final
1 confronto

---

# Jornada Completa

Hub

↓

Grupo A-L

↓

Classificação

↓

Melhores Terceiros

↓

16 Avos

↓

Oitavas

↓

Quartas

↓

Semifinais

↓

3º Lugar

↓

Final

↓

Resumo

---

# PRD03-01 Hub de Palpites

## Componentes

- Header
- Avatar
- Notificações
- Barra de progresso

Exemplo:

72 / 104 palpites concluídos

### Cards

- Fase de Grupos
- 16 Avos
- Oitavas
- Quartas
- Semifinais
- 3º Lugar
- Final

---

# PRD03-02 Seleção de Grupo

Grid com:

Grupo A até Grupo L

Cada card apresenta:

- Jogos concluídos
- Percentual
- Status

Estados:

- Não iniciado
- Em andamento
- Concluído

---

# PRD03-03 Palpite em Massa

Usuário visualiza os 6 jogos do grupo em uma única tela.

Recursos:

- Navegação TAB
- Auto Save
- Scroll otimizado
- Salvar Grupo

---

# PRD03-04 Classificação Automática

Sistema calcula:

- Pontos
- Saldo
- Gols pró
- Gols contra

Resultado:

1º
2º
3º
4º

Usuário confirma.

---

# PRD03-05 Resumo dos Grupos

Lista dos 12 grupos preenchidos.

Exibe classificados.

---

# PRD03-06 Ranking dos Melhores Terceiros

Classificação automática dos terceiros colocados.

Seleciona os 8 melhores.

Botão:

Gerar 16 Avos

---

# PRD03-07 Chave Interativa

Visual estilo bracket.

16 Avos
↓
Oitavas
↓
Quartas
↓
Semi
↓
Final

Usuário toca no vencedor.

Avanço automático.

---

# PRD03-08 Modo Completar Copa

Botão:

⚡ Completar Copa

Fluxo contínuo.

Grupo A
↓
Grupo B
↓
...
↓
Grupo L
↓
Eliminatórias

---

# PRD03-09 Resumo Final

Exibe:

- Campeão
- Vice
- 3º Lugar
- 4º Lugar

Botão:

Confirmar Palpites

---

# Estados do Sistema

## Palpite

- Não iniciado
- Em andamento
- Concluído
- Bloqueado

## Fase

- Disponível
- Em andamento
- Concluída
- Encerrada

---

# Regras de Negócio

1. Auto save a cada alteração.
2. Jogos encerrados não podem ser alterados.
3. Classificação calculada automaticamente.
4. Critérios FIFA para desempate.
5. Melhores terceiros calculados automaticamente.
6. Chave gerada automaticamente.
7. Revisão antes da confirmação final.
8. Histórico de alterações.

---

# Modelo de Dados

## Tournament

- id
- year
- status

## Group

- id
- name

## Team

- id
- name
- flag

## Match

- id
- phase
- home_team
- away_team
- kickoff_at

## Prediction

- user_id
- match_id
- home_score
- away_score

## Bracket

- phase
- home_team
- away_team
- winner

---

# APIs

GET /groups

GET /matches

GET /predictions

POST /predictions

PUT /predictions

GET /bracket

POST /submit-predictions

---

# Critérios de Aceite

## Hub

- Exibe progresso corretamente.
- Exibe status das fases.

## Grupo

- Permite salvar os 6 jogos.
- Auto save funcionando.

## Classificação

- Calcula corretamente pontos e saldo.

## Melhores Terceiros

- Seleciona automaticamente os 8 melhores.

## Bracket

- Gera confrontos corretamente.
- Permite seleção dos vencedores.

## Resumo Final

- Exibe campeão e classificados.
- Permite envio final.

---

# KPIs

## Primário

Taxa de conclusão dos palpites.

## Secundários

- Tempo médio para conclusão.
- Número de sessões.
- Taxa de abandono.
- Engajamento.

---

# Benefícios

- Menos cliques
- Menos navegação
- Mais conversão
- Melhor UX mobile
- Compatível com Copa do Mundo 2026
