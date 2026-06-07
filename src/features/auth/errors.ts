/**
 * Mapeamento de erros do Firebase Authentication para mensagens amigáveis em pt-BR.
 *
 * Usado pelas telas de Login e Cadastro (PRD-01) para exibir feedback via
 * `toast.error` (Sonner). As mensagens seguem a regra de privacidade R6:
 * erros de credencial e de e-mail já em uso NÃO confirmam a existência de uma
 * conta.
 *
 * Função pura e determinística — sem I/O, sem dependência de runtime do Firebase.
 */

/**
 * Mensagem neutra para erros de credencial. A mesma string é retornada para
 * `auth/wrong-password`, `auth/user-not-found` e `auth/invalid-credential` para
 * não revelar se o e-mail existe ou se apenas a senha está incorreta (R6).
 */
const CREDENTIAL_MESSAGE = "E-mail ou senha inválidos.";

/** Mensagem genérica para códigos desconhecidos ou não mapeados. */
const FALLBACK_MESSAGE = "Ocorreu um erro inesperado. Tente novamente.";

/**
 * Tabela de tradução código → mensagem pt-BR. Mantida centralizada (sem
 * hardcode disperso) e tipada como `Record<string, string>`.
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  // Credenciais — mensagem neutra e idêntica (privacidade R6).
  "auth/wrong-password": CREDENTIAL_MESSAGE,
  "auth/user-not-found": CREDENTIAL_MESSAGE,
  "auth/invalid-credential": CREDENTIAL_MESSAGE,
  // Cadastro — não confirma que o e-mail já está em uso (privacidade R6).
  "auth/email-already-in-use":
    "Não foi possível concluir o cadastro com esses dados.",
  // Senha fraca — orientação acionável (mínimo 6 caracteres, conforme TASK-01).
  "auth/weak-password": "A senha deve ter pelo menos 6 caracteres.",
  // Rate limit do Firebase.
  "auth/too-many-requests":
    "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  // Falha de rede.
  "auth/network-request-failed":
    "Falha de conexão. Verifique sua internet e tente novamente.",
  // Recuperação de senha — link de ação (oobCode) inválido ou já usado.
  "auth/invalid-action-code":
    "O link de redefinição é inválido. Solicite um novo.",
  // Recuperação de senha — link de ação expirado.
  "auth/expired-action-code":
    "O link de redefinição expirou. Solicite um novo.",
  // Conta desativada (ex.: usuário bloqueado tentando redefinir senha).
  "auth/user-disabled": "Esta conta está desativada. Contate o administrador.",
};

/**
 * Traduz um código de erro do Firebase Auth para uma mensagem pt-BR amigável.
 *
 * @param code Código do erro do Firebase Auth (ex.: `"auth/invalid-credential"`).
 *   As telas devem extrair `error.code` do `FirebaseError` antes de chamar esta
 *   função. Entradas desconhecidas, vazias ou não mapeadas retornam a mensagem
 *   genérica de fallback.
 * @returns Mensagem pronta para exibição ao usuário, em português.
 */
export function mapAuthError(code: string): string {
  return AUTH_ERROR_MESSAGES[code] ?? FALLBACK_MESSAGE;
}
