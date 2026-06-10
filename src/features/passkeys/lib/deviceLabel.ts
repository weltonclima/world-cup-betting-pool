/**
 * Deriva um rótulo amigável do dispositivo a partir do user-agent (TASK-06),
 * para nomear o passkey sem pedir input ao usuário. Fallback "Dispositivo".
 * Client-only (usa `navigator`).
 */
export function deriveDeviceLabel(): string {
  if (typeof navigator === "undefined") return "Dispositivo";
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh|Mac OS X/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Dispositivo";
}

/**
 * Heurística de WebView / in-app browser (Instagram, Facebook, WhatsApp, etc.),
 * onde o WebAuthn costuma falhar (A9). Não é exata — orienta, não bloqueia.
 */
export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /FBAN|FBAV|Instagram|Line\/|WhatsApp|; wv\)/.test(ua);
}
