# PRD 06 - PERFIL DO USUÁRIO

## Produto
Bolão dos Parças

## Objetivo
Permitir que o usuário visualize e gerencie suas informações pessoais, estatísticas, histórico de participação e configurações da conta.

---

# Funcionalidades

## Meu Perfil
- Nome completo
- Apelido
- E-mail
- Avatar
- Data de cadastro
- Status da conta

## Estatísticas Pessoais
- Ranking atual
- Pontos totais
- Acertos exatos
- Acertos de vencedor
- Erros
- Aproveitamento

## Histórico de Palpites
- Jogos palpitados
- Resultado previsto
- Resultado oficial
- Pontuação obtida

## Segurança
- Alterar senha
- Recuperar senha
- Encerrar sessões ativas

## Configurações
- Tema claro/escuro (futuro)
- Preferências de notificações
- Aceite de termos

## Logout
- Encerrar sessão
- Limpar cache local

---

# Estrutura Firestore

## users
```json
{
  "id":"uid",
  "name":"João Silva",
  "nickname":"João",
  "email":"joao@email.com",
  "avatarUrl":"",
  "role":"user",
  "status":"approved"
}
```

## statistics
```json
{
  "userId":"uid",
  "points":87,
  "exactHits":12,
  "correctWinners":8,
  "wrongPredictions":10,
  "accuracy":25
}
```

---

# Tecnologias
- Next.js
- TypeScript
- Firebase Auth
- Firestore
- React Query
- React Hook Form
- Zod
- Tailwind CSS
- Shadcn UI

---

# Critérios de Aceite
- Usuário visualiza seus dados.
- Usuário altera senha.
- Usuário consulta estatísticas.
- Usuário consulta histórico.
- Usuário realiza logout.
- Funciona em mobile e desktop.
