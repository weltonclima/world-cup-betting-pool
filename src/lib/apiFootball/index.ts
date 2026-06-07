// Barrel do módulo src/lib/apiFootball.
// Reexporta mapeadores e tipos públicos para consumo pelo script de ingestão
// (Node + Admin SDK) e por hooks/serviços futuros.
export { mapMatchStatus, parseRound } from "./mappers";
export type { ParsedRound } from "./mappers";
