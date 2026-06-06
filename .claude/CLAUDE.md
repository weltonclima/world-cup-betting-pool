# Bolão dos Parças — Contexto de Engenharia

Sistema de prognósticos da Copa do Mundo 2026. Usuários apostam em placares exatos de partidas. Pontuação binária: acertou o placar exato → +1; errou → 0. Sem acerto parcial ou de vencedor.

Público-alvo: menos de 100 usuários. Otimizado para custo baixo e manutenção fácil.

---

## Stack Oficial

### Frontend
- **Next.js 15** — App Router
- **React 19**
- **TypeScript** — strict, sem `any`
- **Tailwind CSS** — sem estilos inline
- **Shadcn UI** — componentes base

### Backend (Firebase)
- **Firebase Authentication** — email e senha
- **Firestore** — banco principal
- **Firebase Cloud Functions** — lógica de servidor e integração com API-Football
- **Firebase Hosting** — deploy

### Dados da Copa
- **API-Football** — consumida **exclusivamente** via Cloud Functions → Firestore → Frontend (nunca direto do browser)

---

## Bibliotecas Obrigatórias

| Categoria | Biblioteca |
|---|---|
| Validação | Zod |
| Formulários | React Hook Form + Zod |
| Data fetching / cache | TanStack Query (React Query) |
| Tabelas | TanStack Table |
| Datas | date-fns |
| Ícones | Lucide React |
| Notificações (toast) | Sonner |
| Animações | Framer Motion |

---

## Estrutura de Pastas

```
src/
├── app/               # Rotas Next.js (App Router)
├── components/        # Componentes reutilizáveis globais
├── features/          # Módulos por domínio (ver abaixo)
├── services/          # Chamadas ao Firestore e APIs
├── hooks/             # Custom hooks
├── schemas/           # Schemas Zod (validação e tipos derivados)
├── types/             # Tipos TypeScript globais
├── lib/               # Utilitários e helpers
├── firebase/          # Configuração e inicialização do Firebase
└── providers/         # Context providers (QueryClient, Auth, Theme…)
```

### Features

```
features/
├── auth/              # Login, cadastro, aprovação
├── home/              # Dashboard inicial
├── matches/           # Listagem e detalhe de partidas
├── predictions/       # Palpites do usuário
├── rankings/          # Rankings geral e por fase
├── statistics/        # Estatísticas individuais
├── profile/           # Perfil do usuário
└── admin/             # Painel administrativo
```

---

## Banco de Dados — Coleções Firestore

| Coleção | Descrição |
|---|---|
| `users` | Perfil, role e status do usuário |
| `teams` | Seleções participantes |
| `groups` | Grupos da fase de grupos |
| `matches` | Partidas (estático → semi-estático) |
| `predictions` | Palpites dos usuários |
| `rankings` | Rankings calculados |
| `statistics` | Estatísticas por usuário |
| `bonus_predictions` | Palpites bônus (campeão, artilheiro etc.) |
| `system_settings` | Configurações globais do sistema |

### Schema: coleção `users`

```json
{
  "uid": "string",
  "name": "string",
  "nickname": "string",
  "email": "string",
  "role": "user | admin",
  "status": "pending | approved | blocked"
}
```

---

## Controle de Acesso

- **Roles:** `user` | `admin`
- **Status:** `pending` | `approved` | `blocked`
- Todo novo usuário nasce com `status: pending`
- Usuários não aprovados veem a tela "Aguardando Aprovação" e não acessam áreas internas
- O admin aprova ou bloqueia usuários

---

## Estratégia de Dados e Cache

### Atualização de dados

| Tipo | Exemplos | Frequência |
|---|---|---|
| Estático | Teams, Groups, Stages, Venues | Antes da Copa / sob demanda |
| Semi-estático | Matches | 1 vez por dia |
| Dinâmico | Results, Standings | Scheduler diário às 02:00 |

### React Query

```ts
staleTime: 30 * 60 * 1000   // 30 minutos
gcTime:    24 * 60 * 60 * 1000 // 24 horas
```

### Local Storage

Persistir: sessão, preferências do usuário, filtros ativos.

---

## Sistema de Pontuação

- **Placar exato:** +1 acerto
- **Qualquer outro resultado:** 0
- Não existe acerto parcial, acerto de vencedor ou aproximação

---

## Rankings

- Geral
- Fase de Grupos
- Oitavas de Final
- Quartas de Final
- Semifinal
- Final

---

## Estatísticas por Usuário

- Total de acertos
- Aproveitamento (%)
- Maior sequência de acertos
- Acertos por fase
- Histórico de posições no ranking

---

## Regras de Desenvolvimento (obrigatórias)

1. **Nunca usar `any`** — TypeScript strict em todo o projeto.
2. **Nunca usar estilos inline** — toda estilização via Tailwind ou variáveis CSS de tema.
3. **Nunca hardcodar dados** — constantes em arquivos dedicados ou buscadas do Firestore.
4. **Todo formulário** usa `React Hook Form` + `Zod` (schema de validação obrigatório).
5. **Toda consulta** ao Firestore usa `TanStack Query` (sem fetch/useEffect manual).
6. **Componentes** devem ser reutilizáveis e totalmente tipados.
7. **API-Football** jamais é chamada diretamente pelo frontend — sempre via Cloud Functions.

---

## Responsividade

Mobile First. Breakpoints padrão Tailwind:
- `sm` → Tablet
- `md/lg` → Desktop

---

## MVP — Funcionalidades

1. Login
2. Cadastro
3. Aprovação de usuários (admin)
4. Listagem de jogos
5. Registro de palpites
6. Ranking geral
7. Ranking por fase
8. Estatísticas
9. Perfil do usuário

---

## Autenticação — Fluxo (PRD-01)

### Telas

**Login:** campos e-mail + senha; ações Entrar, Criar Conta, Esqueci minha senha.

**Cadastro:** campos Nome, Apelido, E-mail, Senha; ação Criar Conta.

**Aguardando Aprovação:** mensagem informativa + botão "Atualizar Status".

### Critérios de aceite

- Usuário consegue criar conta
- Usuário não aprovado não acessa áreas internas
- Admin consegue aprovar usuário
- Após aprovação, login é liberado

---

## PRDs de Referência

| Arquivo | Conteúdo |
|---|---|
| `docs/prd-00/PRD-00-Arquitetura-Bolao-dos-Parcas.md` | Arquitetura base, stack, estrutura de pastas, regras gerais |
| `docs/prd-01/PRD-01-Autenticacao-Bolao-dos-Parcas.md` | Feature de autenticação e aprovação de usuários |
