# PRD03.4 — UX, Wireframes e Especificação de Interface
## Bolão dos Parças - Copa do Mundo 2026

### Status
Documento complementar da PRD03.3 contendo a especificação visual, UX, navegação e wireframes das telas de palpites.

---

# Objetivo

Definir a experiência completa do usuário para preenchimento dos palpites da Copa do Mundo 2026.

Objetivos:

- Reduzir atrito
- Maximizar taxa de conclusão
- Simplificar navegação
- Priorizar experiência mobile
- Permitir preenchimento completo em poucos minutos

---

# Design System

## Diretrizes

- Mobile First
- Cards elevados
- Bordas arredondadas
- Componentes reutilizáveis
- Layout consistente com autenticação e dashboard existentes

## Componentes Base

### Button

Estados:

- Default
- Hover
- Pressed
- Disabled
- Loading

### Card

Utilizado em:

- Grupos
- Fases
- Jogos
- Classificações

### Progress Bar

Utilizada em:

- Hub
- Wizard
- Completar Copa

---

# Fluxo Principal

Hub

↓

Grupo

↓

Palpite

↓

Classificação

↓

Resumo Grupos

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

Final

↓

Resumo Final

---

# Tela PRD03-01
## Hub de Palpites

### Objetivo

Centralizar acesso aos palpites.

### Estrutura

Header

Barra de progresso

Cards das fases

### Wireframe

[ Logo ]

72 / 104 palpites

████████░░░░

----------------

Fase de Grupos

72 jogos

[ Continuar ]

----------------

16 Avos

16 jogos

[ Bloqueado ]

----------------

Oitavas

8 jogos

---

# Tela PRD03-02
## Seleção de Grupo

### Layout

Grid 3x4

Grupo A
Grupo B
Grupo C

Grupo D
Grupo E
Grupo F

Grupo G
Grupo H
Grupo I

Grupo J
Grupo K
Grupo L

### Card

- Nome
- Progresso
- Status

---

# Tela PRD03-03
## Palpite em Massa

### Objetivo

Permitir preenchimento dos 6 jogos do grupo.

### Wireframe

Grupo C

Brasil [ ] x [ ] França

Sérvia [ ] x [ ] Japão

Brasil [ ] x [ ] Sérvia

França [ ] x [ ] Japão

Brasil [ ] x [ ] Japão

França [ ] x [ ] Sérvia

----------------

Salvar Grupo

### Recursos

- Navegação TAB
- Auto Save
- Validação instantânea

---

# Tela PRD03-04
## Classificação Prevista

### Objetivo

Exibir classificação automática.

### Wireframe

1º Brasil

2º França

3º Japão

4º Sérvia

----------------

Confirmar Grupo

---

# Tela PRD03-05
## Resumo dos Grupos

### Objetivo

Mostrar situação completa.

Grupo A ✓

Grupo B ✓

Grupo C ✓

...

Grupo L ✓

Botão:

Continuar

---

# Tela PRD03-06
## Ranking Melhores Terceiros

### Wireframe

1 Japão

2 Canadá

3 Sérvia

4 Egito

5 Tunísia

6 Ucrânia

7 Noruega

8 Costa Rica

----------------

Gerar 16 Avos

---

# Tela PRD03-07
## Chave Interativa

### Estrutura

16 Avos

Brasil x Japão

Argentina x Canadá

...

### Interação

Toque no vencedor.

Sistema promove automaticamente.

---

# Tela PRD03-08
## Oitavas

Estrutura idêntica ao bracket.

8 confrontos.

---

# Tela PRD03-09
## Quartas

4 confrontos.

---

# Tela PRD03-10
## Semifinais

2 confrontos.

---

# Tela PRD03-11
## Final e 3º Lugar

Final

Brasil x Argentina

3º Lugar

França x Portugal

---

# Tela PRD03-12
## Resumo Final

### Exibe

Campeão

Vice

3º Lugar

4º Lugar

### CTA

Confirmar Palpites

---

# Estados de Tela

## Loading

Skeletons

## Empty

Nenhum palpite encontrado

## Error

Falha ao carregar

Botão:

Tentar Novamente

---

# Responsividade

## Mobile

Prioridade principal.

## Tablet

Cards em grid.

## Desktop

Bracket expandido horizontal.

---

# Critérios UX

Tempo para preencher grupo:

< 60 segundos

Tempo para preencher copa:

3 a 5 minutos

Quantidade máxima de cliques:

Redução superior a 70% em relação ao fluxo tradicional.

---

# Critérios de Aceite UX

- Fluxo concluído sem sair da jornada.
- Auto Save funcionando.
- Navegação intuitiva.
- Bracket atualizado automaticamente.
- Resumo final consistente.

---

# Entregáveis Figma

- Fluxo completo mobile
- Componentes
- Estados
- Bracket
- Protótipo navegável
- Design tokens
