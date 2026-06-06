# SPEC

> Plano de origem: `ai/plan/auth.md` (PRD-01) → TASK-02.
> Nota de nomenclatura: o nome canônico `ai/spec/task-02.md` já está ocupado pelo
> spec da TASK-02 do plano de fundação (`ai/plan/feature.md` — "Configurar Shadcn UI").
> Para evitar sobrescrever trabalho não relacionado, este spec do plano de auth usa o
> prefixo `auth-` (`ai/spec/auth-task-02.md`). Ver "deviations" no relatório da task.

## 1. Task: TASK-02 (auth) – Mapeamento de erros Firebase Auth → pt-BR

## 2. Objective
Traduzir códigos de erro do Firebase Authentication em mensagens amigáveis em português (pt-BR), prontas para exibição ao usuário via `toast.error` (Sonner) nas telas de Login e Cadastro. Garantir privacidade: mensagens de credencial e de e-mail já em uso **não** devem confirmar a existência (ou não) de uma conta.

## 3. In scope
- Função pura `mapAuthError(code: string): string` em `src/features/auth/errors.ts`.
- Cobertura explícita dos códigos:
  - `auth/wrong-password`
  - `auth/user-not-found`
  - `auth/invalid-credential`
  - `auth/email-already-in-use`
  - `auth/weak-password`
  - `auth/too-many-requests`
  - `auth/network-request-failed`
- Fallback genérico para códigos desconhecidos / vazios / não mapeados.
- Reexport pela barrel da feature (`src/features/auth/index.ts`).
- Testes unitários (TDD) cobrindo cada código mapeado e o fallback.

## 4. Out of scope
- Serviços de auth (`signIn`/`signUp`/`signOut`) — TASK-06.
- Integração visual com toast/telas — TASK-07/TASK-08.
- Mapeamento exaustivo de todos os códigos do Firebase (apenas os relevantes ao fluxo do PRD-01 + fallback).
- i18n / múltiplos idiomas (projeto é pt-BR único).

## 5. Main technical areas
- `src/features/auth/errors.ts` (novo)
- `src/features/auth/index.ts` (reexport)
- `src/features/auth/__tests__/errors.test.ts` (novo)

## 6. Business rules and behavior
- **Privacidade (R6):** códigos de credencial — `auth/wrong-password`, `auth/user-not-found`, `auth/invalid-credential` — retornam **a mesma** mensagem neutra: `"E-mail ou senha inválidos."` (não revela se o e-mail existe ou se a senha está errada).
- **Privacidade (R6) no cadastro:** `auth/email-already-in-use` retorna mensagem neutra que não confirma existência de conta: `"Não foi possível concluir o cadastro com esses dados."`.
- Demais códigos recebem mensagem específica e acionável:
  - `auth/weak-password` → orientação de senha mínima (mínimo 6 caracteres, alinhado ao `signupFormSchema` da TASK-01).
  - `auth/too-many-requests` → orientar aguardar e tentar mais tarde.
  - `auth/network-request-failed` → orientar verificar conexão.
- **Fallback:** qualquer código não mapeado, string vazia ou desconhecida → mensagem genérica `"Ocorreu um erro inesperado. Tente novamente."`.
- Função **pura e determinística**: mesma entrada → mesma saída; sem efeitos colaterais; sem dependência de runtime do Firebase.

## 7. Contracts and interfaces
```ts
/**
 * Traduz um código de erro do Firebase Auth para mensagem pt-BR amigável.
 *
 * @param code Código do erro. Aceita a string do código (ex.: "auth/invalid-credential").
 *             As telas devem extrair `error.code` do FirebaseError antes de chamar.
 *             Entradas desconhecidas/vazias caem no fallback genérico.
 * @returns Mensagem pronta para exibição ao usuário (pt-BR).
 */
export function mapAuthError(code: string): string;
```
- Assinatura simples (`code: string`) por decisão do plano. Caso futuramente seja necessário aceitar um objeto `FirebaseError`-like, fazê-lo via `unknown` + narrowing (sem `any`); nesta task mantém-se `string`.
- Mapa interno tipado como `Record<string, string>` (`as const` para os valores), sem `any`.

## 8. Data and persistence impact
Nenhum. Função pura, sem I/O, sem Firestore.

## 9. Required tests
- Cada código mapeado retorna a mensagem esperada (tabela entrada→saída).
- `wrong-password`, `user-not-found` e `invalid-credential` retornam **a mesma** mensagem neutra (verificação de privacidade).
- `email-already-in-use` retorna mensagem que não confirma existência de conta (não menciona "já cadastrado"/"já existe").
- Código desconhecido → fallback genérico.
- String vazia → fallback genérico.
- Determinismo: duas chamadas com a mesma entrada retornam a mesma saída.

## 10. Acceptance criteria
- `mapAuthError` exportada de `src/features/auth/errors.ts` e reexportada pela barrel.
- Todos os 7 códigos do escopo mapeados; fallback funcional.
- Mensagens de credencial idênticas e neutras (privacidade).
- `email-already-in-use` não confirma existência de conta.
- `npx vitest run src/features/auth/__tests__/errors.test.ts` passa 100%.
- TypeScript strict, sem `any`.

## 11. UI/Screen requirement
- Requires screen: no
- Platform: n/a
- Screens involved: none

## 12. Constraints
- TypeScript strict; proibido `any`.
- Sem hardcode disperso: mensagens centralizadas no módulo `errors.ts`.
- Função pura, sem dependência de runtime Firebase.
- Teste em `__tests__` seguindo a convenção do repositório (vitest globals + imports explícitos, descrições em pt-BR).

## 13. Open questions
Nenhuma. O wording neutro foi definido conforme R6 e a nota do plano (judgment aplicado para pt-BR natural).
