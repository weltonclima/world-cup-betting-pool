import { firebaseAuth } from "@/firebase";

/**
 * Resgate de convite (PRD-10, A2) — camada de serviço client.
 *
 * Chamado após o `signUp` bem-sucedido no fluxo `/invite/[code]`: o usuário já
 * foi associado ao pool (gravado pelo signUp); aqui só registramos o consumo
 * (incremento de `usedCount`) via Route Handler, autenticando com o ID token do
 * usuário recém-criado (ainda `pending`, sem session cookie).
 *
 * BEST-EFFORT: qualquer falha é engolida (retorna `false`) — nunca quebra o
 * cadastro. O convite cheio/expirado não impede a entrada; o group_admin aprova
 * o usuário manualmente.
 */
export async function redeemInvite(code: string): Promise<boolean> {
  try {
    const user = firebaseAuth.currentUser;
    if (!user) return false;
    const idToken = await user.getIdToken();

    const response = await fetch(
      `/api/invite/${encodeURIComponent(code)}/redeem`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ idToken }),
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}
