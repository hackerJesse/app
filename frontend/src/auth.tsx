import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { api, loadToken, saveToken, setUnauthorizedHandler } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { Lang, setLanguage } from "@/src/i18n";
import { storage } from "@/src/utils/storage";

const BIO_TOKEN_KEY = "ns_bio_token";
const BIO_ENABLED_KEY = "ns_bio_enabled";

WebBrowser.maybeCompleteAuthSession();

export type User = {
  user_id: string;
  email: string;
  name: string;
  picture: string;
  role: string;
  cpf?: string;
  phone?: string;
  address?: string;
  has_access: boolean;
  plan?: string;
  subscription_status?: string;
  contract_accepted_at?: string;
  language?: Lang;
};

export function needsOnboarding(u: User | null) {
  return !!u && u.role !== "admin" && u.role !== "operator" && (!u.has_access || !u.contract_accepted_at);
}

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (body: Record<string, string>) => Promise<void>;
  loginGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  setUser: (u: User | null) => void;
  loginBiometric: () => Promise<boolean>;
  hasBiometricToken: () => Promise<boolean>;
};

export const BIO_KEYS = { enabled: BIO_ENABLED_KEY, token: BIO_TOKEN_KEY };

const AuthContext = createContext<AuthState | null>(null);

const AUTH_URL = "https://auth.emergentagent.com/";
const usedSessionIds = new Set<string>();

function extractSessionId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pendingUrl = useRef<string | null>(null);

  const applySession = useCallback(async (sessionToken: string, u: User) => {
    await saveToken(sessionToken);
    if (u.language) setLanguage(u.language);
    setUser(u);
  }, []);

  const exchangeSessionId = useCallback(
    async (sessionId: string): Promise<boolean> => {
      if (usedSessionIds.has(sessionId)) return false;
      usedSessionIds.add(sessionId);
      try {
        const data = await api<{ session_token: string; user: User }>("/auth/session", {
          method: "POST",
          body: { session_id: sessionId },
          auth: false,
        });
        await applySession(data.session_token, data.user);
        return true;
      } catch (e) {
        console.warn("session exchange failed", e);
        return false;
      }
    },
    [applySession],
  );

  const clearAuth = useCallback(async () => {
    await saveToken(null);
    setUser(null);
    queryClient.clear();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearAuth();
    });
    return () => setUnauthorizedHandler(null);
  }, [clearAuth]);

  // Bootstrap: session_id in URL first, then existing token.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let handled = false;
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const sid = extractSessionId(window.location.hash) ?? extractSessionId(window.location.search);
          if (sid) {
            handled = await exchangeSessionId(sid);
            if (handled) {
              const clean = (s: string) => s.replace(/([?#&])session_id=[^&#]+&?/, "$1").replace(/[?#&]$/, "");
              const newUrl = window.location.pathname + clean(window.location.search) + clean(window.location.hash);
              window.history.replaceState(window.history.state, "", newUrl);
            }
          }
        } else {
          const initial = await Linking.getInitialURL();
          const sid = extractSessionId(initial);
          if (sid) handled = await exchangeSessionId(sid);
        }
        if (!handled) {
          const tok = await loadToken();
          if (tok) {
            try {
              const me = await api<User>("/auth/me");
              if (me.language) setLanguage(me.language);
              if (!cancelled) setUser(me);
            } catch {
              await saveToken(null);
            }
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exchangeSessionId]);

  // Hot deep links (mobile)
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Linking.addEventListener("url", ({ url }) => {
      pendingUrl.current = url;
      const sid = extractSessionId(url);
      if (sid) exchangeSessionId(sid);
    });
    return () => sub.remove();
  }, [exchangeSessionId]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api<{ session_token: string; user: User }>("/auth/login", {
        method: "POST",
        body: { email, password },
        auth: false,
      });
      await applySession(data.session_token, data.user);
    },
    [applySession],
  );

  const register = useCallback(
    async (body: Record<string, string>) => {
      const data = await api<{ session_token: string; user: User }>("/auth/register", { method: "POST", body, auth: false });
      await applySession(data.session_token, data.user);
    },
    [applySession],
  );

  const refreshUser = useCallback(async () => {
    try {
      const me = await api<User>("/auth/me");
      setUser(me);
      return me;
    } catch {
      return null;
    }
  }, []);

  const loginGoogle = useCallback(async () => {
    if (Platform.OS === "web") {
      const redirect = window.location.origin + "/";
      window.location.href = `${AUTH_URL}?redirect=${encodeURIComponent(redirect)}`;
      return;
    }
    const redirect = Linking.createURL("");
    pendingUrl.current = null;
    const result = await WebBrowser.openAuthSessionAsync(`${AUTH_URL}?redirect=${encodeURIComponent(redirect)}`, redirect);
    let url: string | null = result.type === "success" ? result.url : null;
    if (!url) url = pendingUrl.current;
    if (!url) url = await Linking.getInitialURL();
    const sid = extractSessionId(url);
    if (sid) await exchangeSessionId(sid);
  }, [exchangeSessionId]);

  const logout = useCallback(async () => {
    const bio = Platform.OS !== "web" && (await storage.getItem<boolean>(BIO_ENABLED_KEY, false));
    if (bio) {
      const { getToken } = await import("@/src/api");
      const tok = getToken();
      if (tok) await storage.secureSet(BIO_TOKEN_KEY, tok);
      // keep the server session alive for the biometric re-entry
    } else {
      try {
        await api("/auth/logout", { method: "POST" });
      } catch {
        /* ignore */
      }
    }
    await clearAuth();
  }, [clearAuth]);

  const loginBiometric = useCallback(async (): Promise<boolean> => {
    const tok = await storage.secureGet<string | null>(BIO_TOKEN_KEY, null);
    if (!tok) return false;
    const LocalAuth = await import("expo-local-authentication");
    const res = await LocalAuth.authenticateAsync({ promptMessage: "InfraManager", cancelLabel: "Cancelar", disableDeviceFallback: false });
    if (!res.success) return false;
    await saveToken(tok);
    try {
      const me = await api<User>("/auth/me");
      if (me.language) setLanguage(me.language);
      setUser(me);
      return true;
    } catch {
      await saveToken(null);
      await storage.secureRemove(BIO_TOKEN_KEY);
      return false;
    }
  }, []);

  const hasBiometricToken = useCallback(async () => {
    if (Platform.OS === "web") return false;
    return !!(await storage.secureGet<string | null>(BIO_TOKEN_KEY, null));
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, loginGoogle, logout, refreshUser, setUser, loginBiometric, hasBiometricToken }),
    [user, loading, login, register, loginGoogle, logout, refreshUser, loginBiometric, hasBiometricToken],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
