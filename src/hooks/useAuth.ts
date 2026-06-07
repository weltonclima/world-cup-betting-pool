import { useContext } from "react";

import { AuthContext, type AuthContextValue } from "@/providers/AuthProvider";

/**
 * Lê o AuthContext. Lança se usado fora do <AuthProvider>.
 * Garante consumidor sempre com contexto definido (sem checagem de undefined).
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth deve ser usado dentro de <AuthProvider>.");
  }
  return ctx;
}
