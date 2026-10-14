// src/auth/auth-storage.ts

import { LoginSession, User } from "./types";

export const SESSION_KEY = "hireassess_session";
const IMPERSONATION_SESSION_KEY = "hireassess_impersonation_session";

class AuthStorage {

  save(session: LoginSession): void {
    if (typeof window === "undefined") return;

    this.clearImpersonation();
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify(session)
    );
  }

  saveImpersonation(session: LoginSession): void {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(IMPERSONATION_SESSION_KEY, JSON.stringify(session));
  }

  get(): LoginSession | null {
    return this.getImpersonation() || this.getPrimarySession();
  }

  getPrimarySession(): LoginSession | null {
    if (typeof window === "undefined") {
      return null;
    }

    const raw = localStorage.getItem(SESSION_KEY);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as LoginSession;
    } catch {
      this.clear();
      return null;
    }
  }

  getImpersonation(): LoginSession | null {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(IMPERSONATION_SESSION_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as LoginSession;
    } catch {
      this.clearImpersonation();
      return null;
    }
  }

  clearImpersonation(): void {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(IMPERSONATION_SESSION_KEY);
  }

  clear(): void {

    if (typeof window === "undefined") return;

    localStorage.removeItem(SESSION_KEY);
    this.clearImpersonation();
  }

  updateUser(user: User): void {

    const session = this.get();

    if (!session) return;

    session.user = user;

    if (this.getImpersonation()) this.saveImpersonation(session);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  updateAccessToken(accessToken: string): void {

    const session = this.get();

    if (!session) return;

    session.accessToken = accessToken;

    if (this.getImpersonation()) this.saveImpersonation(session);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  updateRefreshToken(refreshToken: string): void {

    const session = this.get();

    if (!session) return;

    session.refreshToken = refreshToken;

    if (this.getImpersonation()) this.saveImpersonation(session);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  isLoggedIn(): boolean {

    return this.get() !== null;

  }

}

const authStorage = new AuthStorage();
export default authStorage;