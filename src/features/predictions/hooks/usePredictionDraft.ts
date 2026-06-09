"use client";

import { useState, useRef, useEffect, useCallback } from "react";

/**
 * Debounce em ms para a escrita no localStorage.
 * Suficiente para absorver digitação contínua sem acumular muitas escritas.
 */
const DRAFT_DEBOUNCE_MS = 300;

/** Mapa de matchId → {homeScore, awayScore} persistido por usuário. */
type DraftStore = Record<string, { homeScore: number; awayScore: number }>;

/** Chave de localStorage por usuário. */
function draftKey(uid: string): string {
  return `palpites-rascunho-${uid}`;
}

export interface PredictionDraftAPI {
  /** Retorna o palpite em rascunho para um matchId, ou undefined se não existe. */
  getDraft(matchId: string): { homeScore: number; awayScore: number } | undefined;

  /** Atualiza o rascunho de um matchId (debounced para localStorage; síncrono para estado React). */
  setDraft(matchId: string, scores: { homeScore: number; awayScore: number }): void;

  /** Remove todos os rascunhos do usuário (localStorage + estado React). */
  clearDraft(): void;

  /** Mapa completo do rascunho (para inicializar formulários ou calcular progresso). */
  allDrafts: DraftStore;
}

/**
 * Store de rascunho local por usuário (TASK-05, A4).
 *
 * Persiste palpites não salvos em localStorage com chave por uid.
 * Escrita em localStorage é debounced (300ms) para não travar a digitação.
 * Estado React é atualizado síncronamente (sem debounce) — UI reflete imediatamente.
 *
 * SSR-safe: usa useState({}) + useEffect para leitura pós-mount.
 * Garantia de zero hydration mismatch no Next.js App Router.
 *
 * @param uid - UID do usuário autenticado. Obrigatório — muda a chave de storage.
 */
export function usePredictionDraft(uid: string): PredictionDraftAPI {
  // Inicia com {} no SSR e client-side igualmente — hidratação segura.
  const [draft, setDraftState] = useState<DraftStore>({});

  // Ref para debounce timer — persiste entre renders sem causar re-render.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref sempre apontando para o estado mais recente do rascunho. A escrita
  // debounced lê daqui (não de uma closure), evitando stale e mantendo o
  // updater do setState PURO (React pode invocá-lo 2x em Strict Mode).
  const latestDraftRef = useRef<DraftStore>(draft);
  useEffect(() => {
    latestDraftRef.current = draft;
  }, [draft]);

  // Ler localStorage após mount (SSR-safe: window existe neste ponto).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(draftKey(uid));
      if (raw) {
        const parsed = JSON.parse(raw) as DraftStore;
        setDraftState(parsed);
      }
    } catch {
      // JSON inválido ou erro de acesso — iniciar com {} sem lançar.
      setDraftState({});
    }
  }, [uid]);

  // Limpar debounce no unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const getDraft = useCallback(
    (matchId: string) => draft[matchId],
    [draft],
  );

  const setDraft = useCallback(
    (matchId: string, scores: { homeScore: number; awayScore: number }) => {
      // Atualização síncrona do estado React — updater PURO (sem side effects:
      // React pode invocá-lo mais de uma vez, ex.: Strict Mode).
      setDraftState((prev) => ({ ...prev, [matchId]: scores }));

      // Side effect FORA do updater: debounce da escrita em localStorage.
      // Lê latestDraftRef (atualizado por useEffect) no disparo do timer, que
      // ocorre após o commit do render — reflete o estado mais recente.
      if (typeof window !== "undefined") {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          try {
            localStorage.setItem(
              draftKey(uid),
              JSON.stringify(latestDraftRef.current),
            );
          } catch {
            // Falha silenciosa: localStorage pode estar indisponível (quota etc.)
          }
        }, DRAFT_DEBOUNCE_MS);
      }
    },
    [uid],
  );

  const clearDraft = useCallback(() => {
    setDraftState({});
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(draftKey(uid));
      } catch {
        // Falha silenciosa
      }
    }
  }, [uid]);

  return {
    getDraft,
    setDraft,
    clearDraft,
    allDrafts: draft,
  };
}
