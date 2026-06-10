"use client";

import { useEffect, useState } from "react";
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from "@simplewebauthn/browser";

import { isInAppBrowser } from "../lib/deviceLabel";

export interface PasskeySupport {
  /** null enquanto resolve (platformAuthenticatorIsAvailable é async). */
  supported: boolean | null;
  /** Em WebView/in-app browser (A9) — orientar a abrir no navegador. */
  isWebView: boolean;
}

/**
 * Detecta se o dispositivo/navegador suporta passkey de plataforma (biometria).
 * Esconde/desabilita o registro quando indisponível (TASK-06).
 */
export function usePasskeySupport(): PasskeySupport {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [isWebView, setIsWebView] = useState(false);

  useEffect(() => {
    let mounted = true;
    setIsWebView(isInAppBrowser());

    if (!browserSupportsWebAuthn()) {
      if (mounted) setSupported(false);
      return;
    }
    platformAuthenticatorIsAvailable()
      .then((available) => {
        if (mounted) setSupported(available);
      })
      .catch(() => {
        if (mounted) setSupported(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { supported, isWebView };
}
