"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { authPersistenceReady, firebaseAuth, firestore } from "@/firebase";
import { userSchema } from "@/schemas";
import type { Role, User, UserStatus } from "@/types";

/** Erros possíveis ao carregar/validar o perfil em `users/{uid}`. */
export type AuthProfileError = "not-found" | "parse-error" | "fetch-error";

export interface AuthContextValue {
  /** Usuário autenticado no Firebase Auth, ou null se deslogado. */
  firebaseUser: FirebaseUser | null;
  /** Perfil validado de `users/{uid}`, ou null (deslogado / sem doc / parse-fail). */
  profile: User | null;
  /** Status de acesso (derivado de profile), ou null se indisponível. */
  status: UserStatus | null;
  /** Papel (derivado de profile), ou null se indisponível. */
  role: Role | null;
  /** true enquanto resolve sessão e/ou carrega o perfil. */
  loading: boolean;
  /** Erro de carga/parse do perfil (ex.: doc inválido), senão null. */
  error: AuthProfileError | null;
  /**
   * Relê `users/{uid}` sob demanda, sem esperar um novo `onAuthStateChanged`.
   * Necessário para "Atualizar Status" (pending→approved não emite evento de auth).
   * No-op seguro se deslogado. Guarda contra estado obsoleto via contador de geração.
   */
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [error, setError] = useState<AuthProfileError | null>(null);
  // Começa carregando: ainda não sabemos se há sessão.
  const [loading, setLoading] = useState<boolean>(true);

  // true enquanto o provider está montado: bloqueia setState pós-desmontagem.
  const mountedRef = useRef<boolean>(true);
  // Token de geração monotônico: invalida resultados em voo de ciclos anteriores.
  // Incrementado a cada troca de usuário (onAuthStateChanged) E a cada refreshProfile,
  // unificando o guard de concorrência entre as duas fontes de carga do perfil.
  const generationRef = useRef<number>(0);
  // Espelho do firebaseUser corrente para refreshProfile lê-lo sem recriar o callback.
  const firebaseUserRef = useRef<FirebaseUser | null>(null);

  // Lê e valida users/{uid}. Só aplica setState se a geração ainda for a corrente
  // e o provider seguir montado (descarta resultado obsoleto/órfão).
  const loadProfile = useCallback(
    async (uid: string, generation: number): Promise<void> => {
      if (mountedRef.current) setLoading(true);
      try {
        const snapshot = await getDoc(doc(firestore, "users", uid));

        // Resultado obsoleto: desmontado ou usuário/refresh trocou entre o await.
        if (!mountedRef.current || generation !== generationRef.current) return;

        if (!snapshot.exists()) {
          // Autenticado, mas sem doc de perfil (ex.: cadastro incompleto).
          setProfile(null);
          setError("not-found");
          return;
        }

        const parsed = userSchema.safeParse(snapshot.data());
        if (!parsed.success) {
          // Doc existe mas não bate com o schema → não confiar nele.
          setProfile(null);
          setError("parse-error");
          return;
        }

        setProfile(parsed.data);
        setError(null);
      } catch {
        // Falha de rede/permissão ao ler o perfil.
        if (mountedRef.current && generation === generationRef.current) {
          setProfile(null);
          setError("fetch-error");
        }
      } finally {
        // Garante que loading é resetado apenas se o ciclo ainda for válido.
        if (mountedRef.current && generation === generationRef.current) {
          setLoading(false);
        }
      }
    },
    [],
  );

  // Releitura manual do perfil. Captura a geração corrente; se o usuário mudar
  // durante o await, loadProfile descarta o resultado. No-op se deslogado.
  const refreshProfile = useCallback(async (): Promise<void> => {
    const current = firebaseUserRef.current;
    if (!current) return;

    // Nova geração: invalida qualquer carga anterior em voo.
    const generation = ++generationRef.current;
    if (mountedRef.current) setError(null);
    await loadProfile(current.uid, generation);
  }, [loadProfile]);

  useEffect(() => {
    mountedRef.current = true;
    // Cancela o registro tardio do listener se o effect for limpo antes de
    // `authPersistenceReady` resolver (evita subscrever após desmontagem).
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    // Só registra `onAuthStateChanged` APÓS a persistência ser aplicada. Antes
    // disso o SDK usa a persistência default (in-memory) e emite um `null`
    // transiente — a restauração da sessão só ocorre após `setPersistence`. Sem
    // este gate, esse null falso baixaria `loading` e dispararia o redirect
    // /login → /home. Até resolver, `loading` permanece `true` (estado inicial).
    void authPersistenceReady.then(() => {
      if (cancelled || !mountedRef.current) return;
      // Subscription de sessão (idioma Firebase). Retorna o unsubscribe.
      unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
        // Cada mudança de auth reinicia a resolução do perfil.
        void resolveSession(nextUser);
      });
    });

    async function resolveSession(nextUser: FirebaseUser | null) {
      // Descarta imediatamente se o componente já foi desmontado.
      if (!mountedRef.current) return;

      // Nova geração: invalida cargas anteriores (effect ou refreshProfile).
      const generation = ++generationRef.current;
      firebaseUserRef.current = nextUser;
      setFirebaseUser(nextUser);
      setError(null);

      if (!nextUser) {
        // Não autenticado.
        if (mountedRef.current) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      await loadProfile(nextUser.uid, generation);
    }

    return () => {
      // Invalida qualquer loadProfile em voo antes de cancelar a subscription.
      cancelled = true;
      mountedRef.current = false;
      unsubscribe?.();
    };
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      status: profile?.status ?? null,
      role: profile?.role ?? null,
      loading,
      error,
      refreshProfile,
    }),
    [firebaseUser, profile, loading, error, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
