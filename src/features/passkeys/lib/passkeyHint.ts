/**
 * Hint local (best-effort) de que ESTE dispositivo já cadastrou um passkey
 * (login biométrico).
 *
 * O login é USERNAMELESS: o cliente não tem API para perguntar "existe um
 * passkey descoberto para este domínio?" antes de chamar `get()` — daí o
 * diálogo nativo "Nenhuma chave de acesso disponível" quando não há nenhum.
 * Este hint, gravado no cadastro e no login bem-sucedido (self-heal) e limpo
 * quando o último dispositivo é removido, permite à tela de login decidir se
 * habilita o atalho de biometria sem empurrar o usuário para esse beco.
 *
 * É só uma DICA, nunca fonte de verdade de segurança: o servidor (rotas de
 * verificação WebAuthn) continua sendo a única autoridade. Limpar/forjar o hint no máximo
 * habilita/desabilita um botão — nunca concede acesso. O fallback e-mail+senha
 * está sempre disponível. Client-only.
 *
 * Limitações conhecidas (aceitas — best-effort):
 *  - Escopo é por NAVEGADOR, não por conta: em device compartilhado, o hint de
 *    uma conta deixa o atalho habilitado para outra. Sem risco (a assertion é
 *    atrelada ao uid no servidor); só um ruído de UX em device compartilhado.
 *  - Hint pode ficar STALE: se o passkey for removido em outro device ou apagado
 *    no nível do SO, o botão segue habilitado → o clique cai no
 *    `NotAllowedError` → toast orientador. Não há auto-clear (login usernameless
 *    não dá sinal confiável de ausência). Re-cadastrar/limpar storage resolve.
 */

const PASSKEY_HINT_KEY = "bolao:passkey-hint";

/** Marca que este dispositivo tem (ou passou a ter) um passkey utilizável. */
export function markPasskeyRegistered(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PASSKEY_HINT_KEY, "1");
  } catch {
    // Storage indisponível (modo privado / quota): best-effort, segue sem hint.
  }
}

/** Limpa o hint (teardown explícito — ex.: logout/limpeza de dados). */
export function clearPasskeyHint(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PASSKEY_HINT_KEY);
  } catch {
    // best-effort.
  }
}

/** `true` se este dispositivo já registrou um passkey (dica local). */
export function hasPasskeyHint(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PASSKEY_HINT_KEY) === "1";
  } catch {
    return false;
  }
}
