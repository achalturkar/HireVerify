const API_BASE = process.env.NEXT_PUBLIC_API || process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';

export interface PlatformBranding {
  primaryColor: string;
}

async function readResponse(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    throw new Error(body?.message?.message || body?.message || 'Unable to load platform branding.');
  }
  return body?.data?.data ?? body?.data;
}

export async function getPlatformBranding(): Promise<PlatformBranding> {
  const response = await fetch(`${API_BASE}/platform/branding`, { cache: 'no-store' });
  return readResponse(response) as Promise<PlatformBranding>;
}

export async function updatePlatformBranding(
  primaryColor: string,
  accessToken: string | null
): Promise<PlatformBranding> {
  const response = await fetch(`${API_BASE}/platform/branding`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ primaryColor }),
  });
  return readResponse(response) as Promise<PlatformBranding>;
}