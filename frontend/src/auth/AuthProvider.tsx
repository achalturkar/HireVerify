'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

import { useRouter } from "next/navigation";

import {
  getCurrentUser,
  getSession,
  logout as logoutService,
} from "./auth-service";
import AuthStorage from "./auth-storage";
import { stopCompanyImpersonation } from "@/src/lib/api/impersonation";

import { User } from "./types";

function getTokenExpiration(token: string | undefined): number | null {
  if (!token || typeof window === "undefined") return null;

  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const normalizedPayload = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const claims = JSON.parse(window.atob(normalizedPayload)) as { exp?: unknown };

    return typeof claims.exp === "number" ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  accessToken: string | null;
  isImpersonating: boolean;
  permissions: string[];
  refreshUser: () => Promise<void>;
  stopImpersonation: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [user, setUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);

  const router = useRouter();

  const loadUser = useCallback(async () => {

    try {

      const session = getSession();

      if (!session) {

        setLoading(false);

        return;

      }

      setAccessToken(session.accessToken);
      setIsImpersonating(Boolean(session.impersonation));

      const me = await getCurrentUser();

      setUser(me);

    } catch (e) {

      console.error("AUTH ERROR", e);

      if (AuthStorage.getImpersonation()) {
        AuthStorage.clearImpersonation();
        const baseSession = getSession();
        if (baseSession) {
          try {
            const baseUser = await getCurrentUser();
            setAccessToken(baseSession.accessToken);
            setIsImpersonating(false);
            setUser(baseUser);
            return;
          } catch (restoreError) {
            console.error("Could not restore superadmin session after impersonation", restoreError);
          }
        }
      }

      setUser(null);

      setAccessToken(null);
      setIsImpersonating(false);
      router.replace("/login");
      await logoutService();

    } finally {

      setLoading(false);

    }

  }, [router]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadUser();
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [loadUser]);

  const refreshUser = async () => {

    await loadUser();

  };

  const stopImpersonation = useCallback(async () => {
    const impersonation = AuthStorage.getImpersonation();
    if (!impersonation) return;

    await stopCompanyImpersonation(impersonation.accessToken);
    AuthStorage.clearImpersonation();

    const baseSession = getSession();
    if (!baseSession) {
      await logoutService();
      setUser(null);
      setAccessToken(null);
      setIsImpersonating(false);
      router.replace("/login");
      return;
    }

    try {
      const baseUser = await getCurrentUser();
      setUser(baseUser);
      setAccessToken(baseSession.accessToken);
      setIsImpersonating(false);
      router.replace(`/super-admin/companies/${impersonation.impersonation?.companyId}`);
    } catch (error) {
      console.error("Could not restore superadmin session after stopping impersonation", error);
      await logoutService();
      setUser(null);
      setAccessToken(null);
      setIsImpersonating(false);
      router.replace("/login");
    }
  }, [router]);

  const logout = useCallback(async () => {
    setUser(null);

    setAccessToken(null);
    setIsImpersonating(false);

    router.replace("/login");

    await logoutService();

  }, [router]);

  useEffect(() => {
    const session = getSession();
    if (!session) return;

    const impersonation = AuthStorage.getImpersonation();
    const primarySession = AuthStorage.getPrimarySession();
    const accessExpiration = getTokenExpiration(session.accessToken);
    const refreshExpiration = primarySession?.refreshExpiresAt
      ? Date.parse(primarySession.refreshExpiresAt)
      : getTokenExpiration(primarySession?.refreshToken ?? session.refreshToken);
    const expirations = [accessExpiration, refreshExpiration].filter(
      (expiration): expiration is number =>
        expiration !== null && Number.isFinite(expiration)
    );

    if (expirations.length === 0) return;

    const timer = window.setTimeout(() => {
      if (refreshExpiration !== null && refreshExpiration <= Date.now()) {
        void logout();
      } else if (impersonation) {
        void loadUser();
      } else {
        void logout();
      }
    }, Math.max(0, Math.min(...expirations) - Date.now()));

    return () => window.clearTimeout(timer);
  }, [accessToken, loadUser, logout]);

  return (

    <AuthContext.Provider
      value={{
        user,
        loading,
        accessToken,
        isImpersonating,
        permissions: user?.permissions ?? [],
        refreshUser,
        stopImpersonation,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>

  );

}

export function useAuth() {

  const context = useContext(AuthContext);

  if (!context) {

    throw new Error("useAuth must be used inside AuthProvider");

  }

  return context;

}