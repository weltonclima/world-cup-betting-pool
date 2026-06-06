# PRD 00 - Arquitetura Base

## Projeto
Bolão dos Parças

Sistema de prognósticos da Copa do Mundo 2026 baseado em acertos de placares exatos, rankings e estatísticas.

---

# Objetivos Técnicos

- Mobile First
- Responsivo para Desktop
- Alta performance
- Baixo custo operacional
- Fácil manutenção
- Escalável para futuras Copas
- Otimizado para menos de 100 usuários

# Stack Oficial

## Frontend
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Shadcn UI

## Backend
- Firebase Authentication
- Firestore
- Firebase Cloud Functions
- Firebase Hosting

## Dados da Copa
- API-Football

# Bibliotecas Obrigatórias

## Validação
- Zod

## Formulários
- React Hook Form

## Data Fetching e Cache
- TanStack Query (React Query)

## Tabelas
- TanStack Table

## Datas
- date-fns

## Ícones
- Lucide React

## Notificações
- Sonner

## Animações
- Framer Motion

# Estrutura de Pastas

src/
├── app/
├── components/
├── features/
├── services/
├── hooks/
├── schemas/
├── types/
├── lib/
├── firebase/
└── providers/

# Organização por Feature

features/
├── auth/
├── home/
├── matches/
├── predictions/
├── rankings/
├── statistics/
├── profile/
└── admin/

# Banco de Dados

Coleções:
- users
- teams
- groups
- matches
- predictions
- rankings
- statistics
- bonus_predictions
- system_settings

# Regras da API-Football

A aplicação nunca deve consumir a API-Football diretamente pelo frontend.

Fluxo:

API-Football
→ Cloud Functions
→ Firestore
→ Frontend

# Estratégia de Armazenamento

## Dados Estáticos
Salvar permanentemente:
- Teams
- Groups
- Stages
- Venues

Atualização:
- Antes da Copa
- Sob demanda

## Dados Semi-Estáticos
- Matches

Atualização:
- 1 vez por dia

## Dados Dinâmicos
- Results
- Standings

Atualização:
- Scheduler diário às 02:00

# Estratégia de Cache

## React Query

- staleTime: 30 minutos
- gcTime: 24 horas

## Local Storage

Persistir:
- Sessão
- Preferências
- Filtros

# Autenticação

Firebase Auth

Método:
- Email e senha

# Controle de Acesso

Roles:
- user
- admin

Status:
- pending
- approved
- blocked

# Sistema de Pontuação

Acertou placar exato:
+1 acerto

Errou:
0

Não existe:
- Acerto parcial
- Acerto de vencedor
- Aproximação

# Rankings

- Geral
- Grupos
- Oitavas
- Quartas
- Semifinal
- Final

# Estatísticas

- Total de acertos
- Aproveitamento
- Maior sequência
- Acertos por fase
- Histórico de posições

# Regras de Desenvolvimento

- Nunca usar any
- Nunca usar estilos inline
- Nunca hardcodar dados
- Todo formulário usa React Hook Form + Zod
- Toda consulta usa React Query
- Componentes reutilizáveis e tipados

# Responsividade

Mobile First

Breakpoints:
- Mobile
- Tablet
- Desktop

# MVP

- Login
- Cadastro
- Aprovação de usuários
- Jogos
- Palpites
- Ranking Geral
- Ranking por fase
- Estatísticas
- Perfil
