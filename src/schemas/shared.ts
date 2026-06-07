import { z } from "zod";

// Enums e primitivos reutilizáveis pelas coleções Firestore (fonte única de verdade).
// Valores em slug inglês minúsculo para chave de armazenamento estável (rótulos pt-BR ficam na UI).

export const roleSchema = z.enum(["user", "admin"]);

export const userStatusSchema = z.enum(["pending", "approved", "blocked"]);

export const stageSchema = z.enum([
  "grupos",
  "oitavas",
  "quartas",
  "semifinal",
  "terceiro", // disputa do 3º lugar (API: "3rd Place Final")
  "final",
]);

// Escopo de ranking: "geral" + as 5 fases de ranking (exclui "terceiro", que não tem ranking próprio).
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

// Primitivos compartilhados.
export const nonEmptyString = z.string().min(1);
export const scoreSchema = z.int().min(0); // placar inteiro ≥ 0
export const percentageSchema = z.number().min(0).max(100); // aproveitamento 0–100
export const isoDateTime = z.iso.datetime(); // data/hora em ISO 8601
