import { api } from '@/src/lib/api';
import type { LoginSession, User } from '@/src/auth/types';

export interface StartedImpersonation {
  accessToken: string;
  expiresAt: string;
  sessionId: string;
  user: User;
}

export async function startCompanyImpersonation(
  companyId: string,
  targetUserId: string,
  reason: string,
  accessToken: string
): Promise<StartedImpersonation> {
  const response = await api<{
    data: {
      message: string;
      data: StartedImpersonation;
    };
  }>('/auth/impersonation/start', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ companyId, targetUserId, reason }),
  });

  return response.data.data;
}

export async function stopCompanyImpersonation(accessToken: string): Promise<void> {
  await api('/auth/impersonation/stop', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function toImpersonationSession(
  result: StartedImpersonation,
  companyId: string,
  actorName: string
): LoginSession {
  return {
    user: result.user,
    accessToken: result.accessToken,
    refreshToken: '',
    impersonation: {
      sessionId: result.sessionId,
      companyId,
      expiresAt: result.expiresAt,
      actorName,
    },
  };
}
