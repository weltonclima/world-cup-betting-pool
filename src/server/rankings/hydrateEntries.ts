import "server-only";

import type { Firestore } from "firebase-admin/firestore";

import type { RankingEntry } from "@/types";

/**
 * Hidrata os campos de EXIBIÇÃO (avatarUrl, nickname, name) de cada entry de ranking
 * com os valores VIVOS de `users/{uid}` no momento da LEITURA.
 *
 * Porquê (fix do bug "ranking mostra foto antiga"): o recalc (`recalc.ts`) grava um
 * SNAPSHOT desses campos nos docs `rankings/*`. Esse snapshot só é refeito quando um
 * recalc dispara (edição manual de jogo ou dirty-by-finish) — trocar foto/apelido no
 * perfil NÃO dispara recalc, então a foto no ranking ficava defasada. Resolver os
 * campos de exibição na leitura garante foto/nome sempre frescos sem acoplar o recalc
 * a mudanças de perfil.
 *
 * Lê os users em UM lote (`getAll`). Best-effort por entry: usuário ausente mantém o
 * valor já gravado (não quebra entries antigas). `avatarUrl` reflete o estado vivo
 * INCLUSIVE remoção — apagar a foto remove `avatarUrl` da entry (cai no fallback de
 * iniciais na UI). Não muta a entrada — devolve cópias.
 *
 * Best-effort no todo: se a leitura dos users falhar, devolve as entries com o
 * snapshot gravado (degrada pra foto possivelmente velha em vez de derrubar o
 * ranking inteiro — disponibilidade > frescor, igual ao `ensureRankingsFresh`).
 */
export async function hydrateRankingEntries(
  db: Firestore,
  entries: RankingEntry[],
): Promise<RankingEntry[]> {
  if (entries.length === 0) return entries;

  const liveByUid = new Map<string, Record<string, unknown>>();
  try {
    const refs = entries.map((e) => db.collection("users").doc(e.uid));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (snap.exists) liveByUid.set(snap.id, snap.data() as Record<string, unknown>);
    }
  } catch (err) {
    console.error("[rankings] hidratação de entries falhou — servindo snapshot:", err);
    return entries.map((e) => ({ ...e }));
  }

  return entries.map((entry) => {
    const live = liveByUid.get(entry.uid);
    if (!live) return { ...entry }; // usuário sumiu → mantém o snapshot gravado

    const next: RankingEntry = { ...entry };

    // avatarUrl: reflete o estado vivo, inclusive REMOÇÃO da foto.
    const liveAvatar = live["avatarUrl"];
    if (typeof liveAvatar === "string" && liveAvatar.length > 0) {
      next.avatarUrl = liveAvatar;
    } else {
      delete next.avatarUrl;
    }

    // nickname/name: sobrescreve só quando o valor vivo é utilizável (não apaga o
    // snapshot se o doc do usuário estiver sem o campo).
    const liveNickname = live["nickname"];
    if (typeof liveNickname === "string" && liveNickname.length > 0) {
      next.nickname = liveNickname;
    }
    const liveName = live["name"];
    if (typeof liveName === "string" && liveName.length > 0) {
      next.name = liveName;
    }

    return next;
  });
}
