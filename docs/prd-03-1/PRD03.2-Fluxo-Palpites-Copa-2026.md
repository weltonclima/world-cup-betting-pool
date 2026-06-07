# PRD03.2 — Fluxo de Palpites Copa do Mundo 2026

## Status
Versão atualizada da PRD03.1 alinhada ao formato oficial da Copa do Mundo FIFA 2026.

---

# Objetivo

Criar uma experiência de palpites extremamente rápida, permitindo que o usuário complete toda a Copa do Mundo em poucos minutos através de preenchimento em massa dos grupos e chaveamento automático das fases eliminatórias.

---

# Contexto

A Copa do Mundo 2026 possui:

- 48 seleções
- 12 grupos (A até L)
- 72 jogos na fase de grupos
- Classificação dos 2 melhores de cada grupo
- Classificação dos 8 melhores terceiros colocados
- 32 seleções classificadas para os 16 avos de final

---

# Estrutura do Torneio

## Fase de Grupos

- 12 grupos
- 6 jogos por grupo
- 72 jogos

## 16 Avos de Final

- 32 seleções
- 16 confrontos

## Oitavas de Final

- 16 seleções
- 8 confrontos

## Quartas de Final

- 8 seleções
- 4 confrontos

## Semifinais

- 4 seleções
- 2 confrontos

## Disputa de 3º Lugar

- 1 confronto

## Final

- 1 confronto

---

# Fluxo do Usuário

PRD03-01 Hub de Palpites

↓

PRD03-02 Seleção de Grupo

↓

PRD03-03 Palpites do Grupo

↓

PRD03-04 Classificação Prevista

↓

PRD03-05 Resumo dos 12 Grupos

↓

PRD03-06 Ranking dos Melhores Terceiros

↓

PRD03-07 Chave dos 16 Avos

↓

PRD03-08 Oitavas

↓

PRD03-09 Quartas

↓

PRD03-10 Semifinais

↓

PRD03-11 Final e 3º Lugar

↓

PRD03-12 Resumo Final

---

# PRD03-01 — Hub de Palpites

## Objetivo

Centralizar toda a jornada de palpites.

## Componentes

### Header

- Logo Bolão dos Parças
- Avatar do usuário
- Notificações

### Progresso

Exemplo:

72 / 104 palpites concluídos

Barra de progresso global.

### Cards

- Fase de Grupos
- 16 Avos
- Oitavas
- Quartas
- Semifinais
- 3º Lugar
- Final

---

# PRD03-02 — Seleção de Grupo

## Grupos

- Grupo A
- Grupo B
- Grupo C
- Grupo D
- Grupo E
- Grupo F
- Grupo G
- Grupo H
- Grupo I
- Grupo J
- Grupo K
- Grupo L

Cada card exibe:

- Jogos preenchidos
- Status
- Percentual concluído

---

# PRD03-03 — Palpite Rápido do Grupo

## Objetivo

Preencher os 6 jogos do grupo em uma única tela.

Exemplo:

Brasil [2] x [1] França

### Funcionalidades

- Navegação por TAB
- Auto Save
- Validação instantânea

Botão:

Salvar Grupo

---

# PRD03-04 — Classificação Prevista

Após salvar os jogos.

Sistema calcula:

- Pontos
- Saldo de gols
- Gols pró
- Gols contra

Exibe:

1º colocado
2º colocado
3º colocado
4º colocado

Botão:

Confirmar Classificação

---

# PRD03-05 — Resumo dos Grupos

Lista todos os grupos concluídos.

Exemplo:

Grupo A
1º Brasil
2º Holanda

Grupo B
1º Argentina
2º México

...

Botão:

Continuar

---

# PRD03-06 — Ranking dos Melhores Terceiros

## Objetivo

Determinar os 8 terceiros classificados.

Exemplo:

1. Japão
2. Canadá
3. Sérvia
4. Egito
5. Tunísia
6. Noruega
7. Ucrânia
8. Costa Rica

Botão:

Gerar 16 Avos

---

# PRD03-07 — Chave dos 16 Avos

Sistema gera automaticamente os confrontos.

Exemplo:

Brasil x Japão

Argentina x Canadá

França x Sérvia

16 confrontos no total.

Usuário seleciona vencedores.

---

# PRD03-08 — Oitavas

Sistema gera automaticamente os confrontos.

8 partidas.

---

# PRD03-09 — Quartas

4 partidas.

---

# PRD03-10 — Semifinais

2 partidas.

---

# PRD03-11 — Final e 3º Lugar

Final

Brasil x Argentina

3º Lugar

França x Portugal

---

# PRD03-12 — Resumo Final

## Informações

- Campeão
- Vice-campeão
- Terceiro Lugar
- Quarto Lugar

### Exemplo

Campeão: Brasil

Vice: Argentina

3º Lugar: França

4º Lugar: Portugal

Botão:

Confirmar e Enviar

---

# Regras de Negócio

1. Jogos encerrados não podem ser alterados.
2. Auto save a cada alteração.
3. Classificação calculada automaticamente.
4. Melhor terceiro definido por critérios FIFA.
5. Chave eliminatória gerada automaticamente.
6. Usuário pode revisar antes do envio final.

---

# Métricas de Sucesso

## KPI Principal

Taxa de conclusão dos palpites.

## KPIs Secundários

- Tempo médio para concluir.
- Taxa de abandono.
- Quantidade de palpites enviados.
- Engajamento pré-Copa.

---

# Benefícios Esperados

- Menos cliques.
- Menos navegação.
- Maior conversão.
- Melhor experiência mobile.
- Compatibilidade total com a Copa do Mundo 2026.
