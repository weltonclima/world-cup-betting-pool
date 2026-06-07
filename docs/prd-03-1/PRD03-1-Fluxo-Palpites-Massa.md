# PRD03.1 — Fluxo de Palpites em Massa

## Visão Geral

Esta revisão da PRD03 substitui o modelo atual de palpites jogo a jogo por um fluxo otimizado de preenchimento em massa para Copa do Mundo.

Objetivo: reduzir drasticamente o tempo necessário para completar os palpites e aumentar a taxa de conclusão dos usuários.

---

# Problema Atual

O usuário precisa abrir cada partida individualmente para registrar um palpite.

Impactos:

- Alto número de cliques.
- Navegação repetitiva.
- Baixa taxa de conclusão.
- Experiência cansativa em torneios longos.

---

# Objetivos

## Objetivo Principal

Permitir que o usuário complete toda a Copa em poucos minutos.

## Objetivos Secundários

- Reduzir número de telas visitadas.
- Permitir preenchimento por grupo.
- Permitir preenchimento completo das eliminatórias.
- Exibir progresso de conclusão.
- Melhorar retenção e engajamento.

---

# Nova Arquitetura

## PRD03-01 — Hub de Palpites

### Descrição

Nova tela inicial dos palpites.

### Componentes

#### Header

- Logo Bolão dos Parças
- Notificações

#### Indicador de Progresso

Exemplo:

32 / 72 palpites enviados

Barra de progresso percentual.

#### Cards de Fase

- Fase de Grupos
- Oitavas
- Quartas
- Semifinais
- Final

Cada card apresenta:

- Quantidade de jogos
- Quantidade pendente
- Status
- CTA principal

### Regras

- Fases futuras permanecem bloqueadas até definição.
- Última fase acessada fica destacada.

---

## PRD03-02 — Seleção de Grupo

### Descrição

Permite escolher rapidamente qual grupo será preenchido.

### Layout

Grid com:

- Grupo A
- Grupo B
- Grupo C
- Grupo D
- Grupo E
- Grupo F
- Grupo G
- Grupo H

### Informações

Cada card mostra:

- Nome do grupo
- Quantidade de jogos
- Status de conclusão

### Regras

- Exibir percentual concluído.
- Mostrar indicador visual de grupo finalizado.

---

## PRD03-03 — Palpite Rápido por Grupo

### Descrição

Permite preencher todos os jogos do grupo em uma única tela.

### Estrutura

Cada linha representa uma partida.

Exemplo:

Brasil [2] x [0] França

### Componentes

- Bandeira equipe 1
- Nome equipe 1
- Campo placar equipe 1
- Campo placar equipe 2
- Nome equipe 2
- Bandeira equipe 2

### Funcionalidades

#### Navegação por teclado

TAB navega para próximo campo.

#### Auto Save

Salvar local automático.

#### CTA Principal

Salvar 6 Palpites

### Benefícios

- Menos cliques.
- Fluxo extremamente rápido.
- Melhor experiência mobile.

---

## Classificação Prevista

Após salvar os resultados:

Sistema calcula automaticamente:

- Pontos
- Saldo
- Gols pró
- Classificação final

### Exibição

1º colocado
2º colocado
3º colocado
4º colocado

### Regras

Usuário pode:

- Confirmar classificação.
- Ajustar critérios em caso de empate.

---

## Eliminatórias

### Objetivo

Substituir edição individual de jogos por montagem completa da chave.

### Oitavas

Usuário seleciona vencedores.

### Quartas

Sistema gera confrontos automaticamente.

### Semifinais

Sistema gera confrontos automaticamente.

### Final

Sistema gera finalistas automaticamente.

---

## Bracket Interativo

### Estrutura

Oitavas → Quartas → Semi → Final

### Interação

Clique diretamente na seleção vencedora.

### Benefícios

- Visual intuitivo.
- Menos esforço.
- Compatível com desktop e mobile.

---

## Modo Completar Copa

### Fluxo

1. Grupos
2. Classificados
3. Oitavas
4. Quartas
5. Semifinais
6. Final

### Tempo Médio

3 a 5 minutos.

---

## Resumo Final

Tela de revisão antes do envio.

### Informações

- Jogos preenchidos
- Classificados
- Campeão previsto
- Vice-campeão
- Terceiro lugar

### CTA

Confirmar e Enviar

---

# Métricas de Sucesso

## KPI Primário

Taxa de conclusão dos palpites.

## KPIs Secundários

- Tempo médio para concluir.
- Número médio de sessões.
- Taxa de abandono.
- Engajamento pré-Copa.

---

# Benefícios Esperados

- Menos cliques.
- Menos telas.
- Melhor experiência mobile.
- Maior taxa de conclusão.
- Fluxo semelhante aos principais produtos de bracket esportivo.
