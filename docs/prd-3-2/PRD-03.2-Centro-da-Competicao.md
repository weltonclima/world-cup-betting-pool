# PRD 03.2 – GRUPOS E ELIMINATÓRIAS

## Produto

Bolão dos Parças

## Versão

1.0

## Dependências

* PRD 03 – Jogos
* PRD 03.1 – Tabela e Chaveamento

---

# Objetivo

Disponibilizar aos participantes uma visualização simples e rápida da classificação dos grupos e do chaveamento eliminatório da Copa do Mundo.

Esta PRD não permite edição de dados.

A funcionalidade é exclusivamente para consulta.

---

# Problema

Atualmente o usuário consegue:

* Visualizar jogos
* Consultar detalhes das partidas
* Registrar palpites

Porém não consegue acompanhar facilmente:

* Classificação dos grupos
* Seleções classificadas
* Cruzamentos eliminatórios
* Caminho até a final

O usuário acaba recorrendo a sites externos.

---

# Solução

Adicionar duas visualizações dentro da área Jogos:

## Aba Grupos

Classificação oficial dos grupos.

## Aba Eliminatórias

Chaveamento oficial da competição.

---

# Navegação

BottomTabBar:

```text
Home
Jogos
Palpites
Ranking
Perfil
```

Ao acessar Jogos:

```text
Jogos

[ Partidas ]

[ Grupos ]

[ Eliminatórias ]
```

---

# Fonte de Dados Oficial

Utilizar exclusivamente:

```text
https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
```

Não utilizar:

* API-Football
* Serviços pagos
* Cloud Functions

---

# Arquitetura

## Frontend

* Next.js App Router
* React Query
* TypeScript
* Tailwind CSS
* Shadcn UI

---

## Backend

Route Handlers Next.js

```text
/api/worldcup/groups
/api/worldcup/bracket
```

---

## Banco

Firestore apenas para cache opcional.

Dados oficiais vêm do OpenFootball.

---

# Tela 01

## PRD03.2-01 – Grupos

### Objetivo

Visualizar classificação dos grupos.

---

## Layout

Header:

```text
Copa do Mundo
```

Tabs:

```text
Grupos
Eliminatórias
```

---

### Seletor de Grupo

```text
Grupo A
Grupo B
Grupo C
Grupo D
Grupo E
Grupo F
Grupo G
Grupo H
```

Default:

```text
Grupo A
```

---

## Tabela

Colunas:

```text
#
Seleção
P
J
V
E
D
GP
GC
SG
PTS
```

Legenda:

| Campo | Descrição     |
| ----- | ------------- |
| J     | Jogos         |
| V     | Vitórias      |
| E     | Empates       |
| D     | Derrotas      |
| GP    | Gols Pró      |
| GC    | Gols Contra   |
| SG    | Saldo de Gols |
| PTS   | Pontos        |

---

## Exemplo

```text
1 Brasil      3 3 0 0 7 1 +6 9
2 França      3 2 0 1 5 3 +2 6
3 Japão       3 1 0 2 3 5 -2 3
4 Canadá      3 0 0 3 1 7 -6 0
```

---

## Regras

### Classificados

Primeiro colocado:

```text
Classificado
```

Segundo colocado:

```text
Classificado
```

---

### Eliminados

Terceiro colocado

Quarto colocado

---

### Critério de Desempate

Seguir regra oficial FIFA:

1. Pontos
2. Saldo de gols
3. Gols marcados
4. Confronto direto
5. Fair Play
6. Sorteio

---

# Tela 02

## PRD03.2-02 – Eliminatórias

### Objetivo

Visualizar o chaveamento oficial.

---

## Layout

Estrutura:

```text
Oitavas

Quartas

Semifinais

Final
```

---

## Oitavas

Exemplo:

```text
Brasil
x
Uruguai
```

```text
Argentina
x
México
```

---

## Quartas

Exemplo:

```text
Vencedor Jogo 1
x
Vencedor Jogo 2
```

---

## Semifinais

Exemplo:

```text
Vencedor Quarta 1
x
Vencedor Quarta 2
```

---

## Final

Exemplo:

```text
Brasil
x
Argentina
```

---

## Estados

### Antes da definição

```text
Aguardando definição
```

---

### Definido

Exibir seleções.

---

### Encerrado

Exibir resultado.

Exemplo:

```text
Brasil 2 x 1 França
```

---

# Modelos TypeScript

## GroupStanding

```ts
export interface GroupStanding {
  position: number;
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}
```

---

## KnockoutMatch

```ts
export interface KnockoutMatch {
  id: string;
  phase: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  status: string;
}
```

---

# Route Handlers

## Groups

```text
GET /api/worldcup/groups
```

Retorna:

```json
{
  "groups": []
}
```

---

## Bracket

```text
GET /api/worldcup/bracket
```

Retorna:

```json
{
  "roundOf16": [],
  "quarterFinals": [],
  "semiFinals": [],
  "final": []
}
```

---

# React Query

## Query Keys

```ts
["groups"]

["group", groupId]

["bracket"]
```

---

# Cache

## Grupos

24 horas

---

## Eliminatórias

24 horas

---

## Jogos em andamento

1 minuto

---

# Estados da UI

## Loading

Skeleton Loader

---

## Empty

```text
Nenhuma informação disponível.
```

---

## Error

```text
Erro ao carregar informações.
```

Botão:

```text
Tentar novamente
```

---

# Responsividade

## Mobile

360px

390px

430px

---

## Tablet

768px

---

## Desktop

1024px+

---

# Segurança

Usuários autenticados.

Sem edição.

Somente leitura.

---

# Performance

Tempo máximo:

```text
2 segundos
```

---

# Critérios de Aceite

* Usuário visualiza classificação dos grupos.
* Usuário troca entre grupos.
* Usuário visualiza classificados.
* Usuário visualiza eliminados.
* Usuário visualiza chave eliminatória.
* Usuário visualiza resultados eliminatórios.
* Integração com OpenFootball funcionando.
* Sem Cloud Functions.
* Compatível com Firebase Spark.
* Mobile First.
* Funciona em desktop.
