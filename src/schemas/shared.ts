import { z } from "zod";

// Enums e primitivos reutilizáveis pelas coleções Firestore (fonte única de verdade).
// Valores em slug inglês minúsculo para chave de armazenamento estável (rótulos pt-BR ficam na UI).

export const roleSchema = z.enum(["user", "admin"]);

export const userStatusSchema = z.enum(["pending", "approved", "blocked"]);

export const stageSchema = z.enum([
  "grupos",
  "dezesseis-avos", // 16 avos de final — formato Copa 2026 (48 seleções); API-Football: "Round of 32"
  "oitavas",
  "quartas",
  "semifinal",
  "terceiro",       // disputa do 3º lugar (API: "3rd Place Final")
  "final",
]);

// Escopo de ranking: "geral" + as 5 fases de ranking.
// Exclui "terceiro" (disputa do 3º lugar, jogo único sem ranking próprio)
// e "dezesseis-avos" (Copa 2026 — sem ranking de fase previsto no PRD).
export const rankingScopeSchema = z.enum([
  "geral",
  "grupos",
  "oitavas",
  "quartas",
  "semifinal",
  "final",
]);

export const matchStatusSchema = z.enum([
  "scheduled",
  "live",
  "finished",
  "postponed",
  "canceled",
]);

export const predictionStatusSchema = z.enum([
  "pending",   // palpite registrado, partida não finalizada
  "correct",   // placar exato acertado (gravado pelo servidor)
  "wrong",     // placar errado (gravado pelo servidor)
  "locked",    // partida iniciada antes da finalização (não pontuada ainda)
]);

// Primitivos compartilhados.
export const nonEmptyString = z.string().min(1);
export const scoreSchema = z.int().min(0); // placar inteiro ≥ 0
export const percentageSchema = z.number().min(0).max(100); // aproveitamento 0–100
// Aceita tanto sufixo 'Z' quanto offset numérico (ex.: "+00:00", "-03:00").
// A API-Football retorna fixture.date com offset ("...+00:00"); sem offset:true o
// parse falharia e os Route Handlers de partidas quebrariam com dado real (TASK-04).
export const isoDateTime = z.iso.datetime({ offset: true }); // data/hora em ISO 8601
