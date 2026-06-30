/**
 * Derivação do chaveamento eliminatório da Copa.
 *
 * Função pura — sem I/O, sem Date.now, determinística. Espelha o precedente de
 * `standings.ts` (módulo puro NÃO carrega `import "server-only"`).
 *
 * Regras de agrupamento/ordenação (ver spec grupos-eliminatorias-task-03, §6):
 *  1. Somente stage !== "grupos". Mapa de buckets:
 *     dezesseis-avos→roundOf32, oitavas→roundOf16, quartas→quarterFinals,
 *     semifinal→semiFinals, terceiro→thirdPlace, final→final.
 *  2. Ordenação por número extraído do id ("m73"→73) asc; ids sem padrão m\d+
 *     ficam ao final (estável, defensivo).
 *  3. Resolução de lado (KnockoutSide) com rótulos pt-BR para placeholders e
 *     fallback defensivo para ids corrompidos.
 *  4. Status: ambos defined + finished→encerrado; ambos defined→definido;
 *     qualquer não-defined→aguardando.
 *  5. Placares somente em "encerrado".
 */

import type { EspnBracketMap } from "@/server/copaData/espnBracketMap";
import type { MatchWithId } from "@/types/matches";
import type { TeamWithId } from "@/types/teams";
import type { KnockoutMatch, KnockoutSide } from "@/types/worldcup";

// ─── Tipo público exportado ───────────────────────────────────────────────────

/**
 * Payload completo do chaveamento eliminatório.
 * Validável por `bracketResponseSchema.parse`.
 */
export interface BracketPayload {
  roundOf32: KnockoutMatch[];
  roundOf16: KnockoutMatch[];
  quarterFinals: KnockoutMatch[];
  semiFinals: KnockoutMatch[];
  thirdPlace: KnockoutMatch[];
  final: KnockoutMatch[];
}

// ─── Mapa de stage → bucket ───────────────────────────────────────────────────

/** Chave de bucket dentro de BracketPayload. */
type BucketKey = keyof BracketPayload;

/** Mapa de slug de stage para a chave do bucket correspondente. */
const STAGE_TO_BUCKET: Partial<Record<string, BucketKey>> = {
  "dezesseis-avos": "roundOf32",
  oitavas:          "roundOf16",
  quartas:          "quarterFinals",
  semifinal:        "semiFinals",
  terceiro:         "thirdPlace",
  final:            "final",
};

// ─── Ordenação por número do id ───────────────────────────────────────────────

/** Regex para extrair número de ids no padrão "m{num}" (ex.: "m73" → 73). */
const MATCH_ID_REGEX = /^m(\d+)$/;

/**
 * Extrai o número de ordenação de um id de partida.
 * Ids sem padrão m\d+ retornam Infinity (ficam ao final).
 */
function matchNum(id: string): number {
  const m = MATCH_ID_REGEX.exec(id);
  return m ? parseInt(m[1]!, 10) : Infinity;
}

/** Comparador estável por número do id. */
function byMatchNum(a: KnockoutMatch, b: KnockoutMatch): number {
  return matchNum(a.id) - matchNum(b.id);
}

// ─── Resolução de lado (placeholder → rótulo pt-BR) ──────────────────────────

/**
 * Regex para 1º colocado de grupo: "1A".."1L".
 * Captura a letra do grupo.
 */
const PRIMEIRO_GRUPO_REGEX = /^1([A-L])$/;

/**
 * Regex para 2º colocado de grupo: "2A".."2L".
 * Captura a letra do grupo.
 */
const SEGUNDO_GRUPO_REGEX = /^2([A-L])$/;

/**
 * Regex para melhor terceiro: "3A/B/C/D/F" etc.
 * Captura a lista de grupos (ex.: "A/B/C/D/F").
 */
const TERCEIRO_GRUPO_REGEX = /^3([A-Z](\/[A-Z])+)$/;

/**
 * Regex para vencedor de jogo: "W74" etc.
 * Captura o número do jogo.
 */
const VENCEDOR_JOGO_REGEX = /^W(\d+)$/;

/**
 * Regex para perdedor de jogo: "L101" etc.
 * Captura o número do jogo.
 */
const PERDEDOR_JOGO_REGEX = /^L(\d+)$/;

/**
 * Converte um teamId placeholder para o rótulo pt-BR correspondente.
 * Retorna null se o teamId não for um placeholder reconhecido.
 */
function placeholderLabel(teamId: string): string | null {
  let m: RegExpExecArray | null;

  // "1A" → "1º do Grupo A"
  m = PRIMEIRO_GRUPO_REGEX.exec(teamId);
  if (m) return `1º do Grupo ${m[1]!}`;

  // "2L" → "2º do Grupo L"
  m = SEGUNDO_GRUPO_REGEX.exec(teamId);
  if (m) return `2º do Grupo ${m[1]!}`;

  // "3A/B/C/D/F" → "3º do Grupo A/B/C/D/F"
  m = TERCEIRO_GRUPO_REGEX.exec(teamId);
  if (m) return `3º do Grupo ${m[1]!}`;

  // "W74" → "Vencedor Jogo 74"
  m = VENCEDOR_JOGO_REGEX.exec(teamId);
  if (m) return `Vencedor Jogo ${m[1]!}`;

  // "L101" → "Perdedor Jogo 101"
  m = PERDEDOR_JOGO_REGEX.exec(teamId);
  if (m) return `Perdedor Jogo ${m[1]!}`;

  return null;
}

/** Slot da chave por lado (TASK-02/03) — jogo-fonte de um lado placeholder. */
type SideSlot = { round: string; game: number };

/**
 * Resolve um teamId para um KnockoutSide.
 *
 * Precedência:
 *  1. Time encontrado no índice → lado real (defined:true, sem slot).
 *  2. Lado placeholder (defined:false). Nome:
 *     a. `espnLabel` do match (TASK-03) — ex.: "Vencedor R32 jogo 3" — quando
 *        a ESPN fornece o rótulo legível;
 *     b. senão, reconstrução openfootball `placeholderLabel(teamId)`
 *        ("Vencedor Jogo 74"/"1º do Grupo A");
 *     c. senão (corrompido), o id cru — nunca lança.
 *     O `espnSlot`, quando presente, é anexado ao lado (carrega o jogo-fonte).
 */
function resolveSide(
  teamId: string,
  teamIndex: Map<string, TeamWithId>,
  espnLabel?: string,
  espnSlot?: SideSlot,
): KnockoutSide {
  // 1) Time real encontrado no índice → lado resolvido (slot não se aplica).
  const team = teamIndex.get(teamId);
  if (team !== undefined) {
    return {
      name: team.name,
      code: team.code,
      // Spread condicional: omite a chave quando flagUrl está ausente.
      ...(team.flagUrl !== undefined ? { flagUrl: team.flagUrl } : {}),
      defined: true,
    };
  }

  // 2) Lado placeholder. Precedência de rótulo: ESPN > openfootball > id cru.
  const name = espnLabel ?? placeholderLabel(teamId) ?? teamId;
  return {
    name,
    defined: false,
    // Slot só quando a ESPN o forneceu (ausente no fallback legado).
    ...(espnSlot !== undefined ? { bracketSlot: espnSlot } : {}),
  };
}

// ─── Derivação de status e placares ──────────────────────────────────────────

/**
 * Deriva o status e os placares (opcionais) de um KnockoutMatch.
 * Regras (spec §6, regras 4–5):
 *  - Qualquer lado não-defined → "aguardando" (sem placares).
 *  - Ambos defined + finished  → "encerrado"     (com placares).
 *  - Ambos defined + live      → "em-andamento"  (com placar parcial; ?? 0
 *    cobre o início do tempo, quando a ESPN ainda não reportou gols).
 *  - Ambos defined + demais    → "definido"      (sem placares).
 */
function deriveStatus(
  homeSide: KnockoutSide,
  awaySide: KnockoutSide,
  match: MatchWithId,
): Pick<KnockoutMatch, "status" | "homeScore" | "awayScore"> {
  // Qualquer lado indefinido → aguardando (placares omitidos).
  if (!homeSide.defined || !awaySide.defined) {
    return { status: "aguardando" };
  }

  // Ambos defined + finished → encerrado com placares.
  if (match.status === "finished") {
    return {
      status: "encerrado",
      homeScore: match.homeScore!,
      awayScore: match.awayScore!,
    };
  }

  // Ambos defined + live → em-andamento com placar parcial (ao vivo).
  // Placares `null` no início do jogo viram 0 (o schema exige ambos presentes).
  if (match.status === "live") {
    return {
      status: "em-andamento",
      homeScore: match.homeScore ?? 0,
      awayScore: match.awayScore ?? 0,
    };
  }

  // Ambos defined + não iniciado → definido (sem placares).
  return { status: "definido" };
}

/**
 * Deriva os campos de desfecho (TASK-03) — pênaltis, lado que avançou e como o
 * jogo foi decidido — para um KnockoutMatch.
 *
 * Gate: só em "encerrado" esses campos são significativos. Em
 * aguardando/definido/em-andamento retorna vazio (evita estados que conflitam
 * com os refines de placar↔status do knockoutMatchSchema).
 *
 * INVARIANTE de pênaltis: shootout JAMAIS somado a homeScore/awayScore — emitido
 * em campos próprios e somente quando o jogo foi decidido nos pênaltis.
 */
function deriveKnockoutExtras(
  match: MatchWithId,
  status: KnockoutMatch["status"],
): Pick<
  KnockoutMatch,
  "homeShootout" | "awayShootout" | "advanceSide" | "outcome"
> {
  if (status !== "encerrado") return {};

  const extras: Pick<
    KnockoutMatch,
    "homeShootout" | "awayShootout" | "advanceSide" | "outcome"
  > = {};

  // advanceSide pode ser null (Final/3º sem advance marcado) — preserva o null.
  if (match.advanceSide !== undefined) extras.advanceSide = match.advanceSide;

  // Pênaltis: outcome "penalties" e shootout andam JUNTOS. O knockoutMatchSchema
  // exige (refine) outcome "penalties" ⇔ ambos shootouts presentes. O matchSchema
  // já garante essa consistência upstream, mas a derivação é defensiva: se os
  // dados chegarem inconsistentes (penalties sem shootout numérico), degrada —
  // não emite outcome/shootout — em vez de produzir um payload que falha o schema.
  if (match.outcome === "penalties") {
    if (
      typeof match.homeShootout === "number" &&
      typeof match.awayShootout === "number"
    ) {
      extras.outcome = "penalties";
      extras.homeShootout = match.homeShootout;
      extras.awayShootout = match.awayShootout;
    }
    // penalties inconsistente → outcome omitido (degrada para "encerrado" cru).
  } else if (match.outcome !== undefined) {
    // normal/overtime — sem shootout por definição.
    extras.outcome = match.outcome;
  }

  return extras;
}

// ─── Arestas pai→filho (TASK-08/09) ───────────────────────────────────────────

/** Chave do reverse map: identifica unicamente um slot dentro de uma fase. */
function slotKey(round: string, slotInRound: number): string {
  return `${round}:${slotInRound}`;
}

/**
 * Fase-pai (round R−1) de cada fase de mata-mata. R32 não tem pai no mata-mata
 * (alimentado pelos grupos) e a disputa de 3º lugar fica fora da árvore — ambos
 * ausentes → sem arestas.
 */
const PARENT_ROUND: Readonly<Record<string, string>> = {
  "round-of-16": "round-of-32",
  quarterfinals: "round-of-16",
  semifinals: "quarterfinals",
  final: "semifinals",
};

/**
 * Pareamento FIFA FIXO (`slotInRound` do filho → os dois `slotInRound` dos pais
 * na fase anterior). NÃO é sequencial `[2k],[2k+1]`. É propriedade ESTÁVEL da
 * estrutura do torneio — independe de quais times já resolveram.
 *
 * Tabela VERIFICADA empiricamente contra a ESPN ao vivo (2026, varredura completa
 * do mata-mata): cada slot derivado do `matchNumber` (core API) + o feeder real de
 * cada lado (`displayName` "Round of N Winner") + qual jogo cada time venceu. Ver
 * `ai/diagnose/espn-bracket-pairing.md`. Usada como FALLBACK; a fonte primária é o
 * feeder por-lado da própria ESPN (resolveParentMatchIds) — esta só cobre o caso de
 * AMBOS os lados já resolvidos (sem displayName de feeder).
 *
 *   R16←R32: 1(2,5) 2(1,3) 3(4,6) 4(7,8) 5(11,12) 6(9,10) 7(14,16) 8(13,15)
 *   QF←R16:  1(1,2) 2(5,6) 3(3,4) 4(7,8)
 *   SF←QF:   1(1,2) 2(3,4)        Final←SF: 1(1,2)
 */
const FEEDER_SLOTS: Readonly<
  Record<string, Readonly<Record<number, readonly [number, number]>>>
> = {
  "round-of-16": {
    1: [2, 5], 2: [1, 3], 3: [4, 6], 4: [7, 8],
    5: [11, 12], 6: [9, 10], 7: [14, 16], 8: [13, 15],
  },
  quarterfinals: { 1: [1, 2], 2: [5, 6], 3: [3, 4], 4: [7, 8] },
  semifinals: { 1: [1, 2], 2: [3, 4] },
  final: { 1: [1, 2] },
};

/**
 * Inverte o EspnBracketMap (matchId → slot) em slot → matchId, para resolver,
 * a partir do slot de um pai, o id do jogo-pai. Mapa vazio/ausente → reverse
 * vazio (degrada para bracket sem arestas).
 */
function buildSlotToMatchId(bracketMap?: EspnBracketMap): Map<string, string> {
  const reverse = new Map<string, string>();
  if (!bracketMap) return reverse;
  for (const [matchId, slot] of bracketMap) {
    reverse.set(slotKey(slot.round, slot.slotInRound), matchId);
  }
  return reverse;
}

/**
 * Resolve os ids dos dois jogos-pai de um confronto (arestas da árvore).
 *
 * Fonte dos slots-pai, em ordem de precedência:
 *  1. **Feeder por-lado da ESPN** (`homeBracketSlot`/`awayBracketSlot`, do
 *     `displayName` "Round of N Winner") — a VERDADE da ESPN, presente enquanto
 *     algum lado é placeholder. Cobre todos os jogos FUTUROS/não-resolvidos com
 *     exatidão, sem depender de tabela hardcoded.
 *  2. **Tabela FIFA fixa** (`FEEDER_SLOTS`), keyed pelo slot do PRÓPRIO jogo
 *     (estável, via `matchNumber` do bracketMap) — fallback para quando AMBOS os
 *     lados já resolveram (o displayName de feeder some). Verificada contra a ESPN.
 *
 * Os slots-pai são então resolvidos a matchIds pelo reverse map. Retorna a tupla
 * só quando a fase tem pais (não-R32/3º) E ambos resolvem; caso contrário
 * `undefined` (degrada para sem arestas — nunca lança).
 */
function resolveParentMatchIds(
  match: MatchWithId,
  bracketMap: EspnBracketMap | undefined,
  slotToMatchId: Map<string, string>,
): [string, string] | undefined {
  const homeSlot = match.homeBracketSlot;
  const awaySlot = match.awayBracketSlot;

  let parentRound: string | undefined;
  let slotA: number | undefined;
  let slotB: number | undefined;

  // 1) Feeder por-lado da ESPN — verdade ao vivo, exata p/ jogos não-resolvidos.
  //    Não depende do bracketMap: o `displayName` ("Round of N Winner") já traz a
  //    fase-pai E o slot de cada lado.
  if (
    homeSlot &&
    awaySlot &&
    homeSlot.round === awaySlot.round &&
    typeof homeSlot.game === "number" &&
    typeof awaySlot.game === "number"
  ) {
    parentRound = homeSlot.round;
    slotA = homeSlot.game;
    slotB = awaySlot.game;
  } else {
    // 2) Fallback: tabela FIFA fixa pelo slot do PRÓPRIO jogo (ambos resolvidos →
    //    sem feeder no displayName). Requer o slot próprio via bracketMap.
    const ownSlot = bracketMap?.get(match.id);
    if (!ownSlot) return undefined;
    parentRound = PARENT_ROUND[ownSlot.round];
    const feeders = FEEDER_SLOTS[ownSlot.round]?.[ownSlot.slotInRound];
    if (!parentRound || !feeders) return undefined;
    [slotA, slotB] = feeders;
  }

  const parentA = slotToMatchId.get(slotKey(parentRound, slotA));
  const parentB = slotToMatchId.get(slotKey(parentRound, slotB));
  if (parentA === undefined || parentB === undefined) return undefined;

  return [parentA, parentB];
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Deriva o chaveamento eliminatório a partir das partidas e seleções.
 *
 * @param matches    partidas (qualquer fase — filtradas internamente para não-grupos)
 * @param teams      seleções do torneio (usadas para resolver nomes/bandeiras)
 * @param bracketMap (opcional, TASK-08) mapa matchId→slot do core API ESPN; quando
 *                   presente, cada confronto ganha `parentMatchIds` com os dois
 *                   jogos-pai. Ausente/vazio → bracket sem arestas (compat legado).
 * @returns          BracketPayload com 6 buckets, cada um ordenado por num do id asc
 */
export function deriveBracket(
  matches: MatchWithId[],
  teams: TeamWithId[],
  bracketMap?: EspnBracketMap,
): BracketPayload {
  // Índice id→TeamWithId para lookup O(1).
  const teamIndex = new Map<string, TeamWithId>(teams.map((t) => [t.id, t]));

  // Reverse map slot→matchId construído UMA vez (TASK-08). Vazio se sem mapa.
  const slotToMatchId = buildSlotToMatchId(bracketMap);

  // Inicializa todos os 6 buckets vazios.
  const payload: BracketPayload = {
    roundOf32:     [],
    roundOf16:     [],
    quarterFinals: [],
    semiFinals:    [],
    thirdPlace:    [],
    final:         [],
  };

  for (const match of matches) {
    // Regra 1: somente stage !== "grupos".
    const bucketKey = STAGE_TO_BUCKET[match.stage];
    if (bucketKey === undefined) continue;

    // Resolução dos lados — rótulo/slot ESPN por lado (TASK-03) têm precedência.
    const homeSide = resolveSide(
      match.homeTeamId,
      teamIndex,
      match.homePlaceholderLabel,
      match.homeBracketSlot,
    );
    const awaySide = resolveSide(
      match.awayTeamId,
      teamIndex,
      match.awayPlaceholderLabel,
      match.awayBracketSlot,
    );

    // Status e placares.
    const statusFields = deriveStatus(homeSide, awaySide, match);

    // Desfecho (pênaltis/advance/outcome) — só em "encerrado".
    const extras = deriveKnockoutExtras(match, statusFields.status);

    // Arestas pai→filho (TASK-09) — feeder por-lado da ESPN + fallback fixo.
    const parentMatchIds = resolveParentMatchIds(
      match,
      bracketMap,
      slotToMatchId,
    );

    // Monta o KnockoutMatch.
    const km: KnockoutMatch = {
      id:        match.id,
      phase:     match.stage as KnockoutMatch["phase"],
      homeTeam:  homeSide,
      awayTeam:  awaySide,
      kickoffAt: match.kickoffAt,
      ...(match.venue ? { venue: match.venue } : {}),
      ...statusFields,
      ...extras,
      ...(parentMatchIds !== undefined ? { parentMatchIds } : {}),
    };

    payload[bucketKey].push(km);
  }

  // Regra 2: ordena cada bucket por número do id asc (ids sem padrão → Infinity → ao final).
  for (const key of Object.keys(payload) as BucketKey[]) {
    payload[key].sort(byMatchNum);
  }

  return payload;
}
