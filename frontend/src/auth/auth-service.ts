import { api } from "@/src/lib/api";
import AuthStorage from "./auth-storage";
import {
  LoginResponse,
  LoginSession,
  MeResponse,
  User,
} from "./types";

/**
 * Login
 */
export async function login(
  email: string,
  password: string
): Promise<LoginSession> {

  const response: LoginResponse = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });

  /**
   * API Response
   *
   * success
   * message
   * data
   *    message
   *    data
   *        accessToken
   *        refreshToken
   *        refreshExpiresAt
   *        user
   */

  const session = response.data.data;

  AuthStorage.save(session);

  return session;
}

export async function forgotPassword(email: string): Promise<void> {
  await api('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string, confirmPassword: string): Promise<void> {
  await api('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword, confirmPassword }),
  });
}

/**
 * Current Logged User
 */
export async function getCurrentUser(): Promise<User> {

  const session = AuthStorage.get();

  if (!session) {
    throw new Error("No active session");
  }

  const response: MeResponse = await api("/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  AuthStorage.updateUser(response.data.data);

  return response.data.data;
}

/**
 * Refresh Access Token
 */
export async function refreshAccessToken(): Promise<string> {

  const session = AuthStorage.get();

  if (!session) {
    throw new Error("No Session");
  }
  if (AuthStorage.getImpersonation()) {
    throw new Error("Impersonation sessions cannot be refreshed");
  }

  const response = await api<{ data: { data: { accessToken: string } } }>("/auth/refresh-token", {
    method: "POST",
    body: JSON.stringify({
      refreshToken: session.refreshToken,
    }),
  });

  const accessToken = response.data.data.accessToken;

  AuthStorage.updateAccessToken(accessToken);

  return accessToken;
}

/**
 * Logout
 */
export async function logout(): Promise<void> {

  const impersonationSession = AuthStorage.getImpersonation();
  if (impersonationSession) {
    try {
      await api("/auth/impersonation/stop", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${impersonationSession.accessToken}`,
        },
      });
    } catch (error) {
      console.error("Could not revoke impersonation session during logout", error);
    }
  }

  const session = AuthStorage.getPrimarySession() || AuthStorage.get();

  if (!session) {
    AuthStorage.clear();
    return;
  }

  try {

    await api("/auth/logout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        refreshToken: session.refreshToken,
      }),
    });

  } catch {

    // Ignore logout API failure

  } finally {

    AuthStorage.clear();

  }

}

/**
 * Get Current Session
 */
export function getSession(): LoginSession | null {

  return AuthStorage.get();

}

/**
 * Is User Logged In
 */
export function isAuthenticated(): boolean {

  return AuthStorage.isLoggedIn();

}