const API_ASSET_BASE = (process.env.NEXT_PUBLIC_API || '/api/v1'  || 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '');

/**
 * Normalizes whatever the API sends back for a logo (or any uploaded image)
 * into a real string URL, or null. Handles:
 *  - a plain absolute URL ("https://...") — returned as-is
 *  - a relative path ("/uploads/x.png") — prefixed with the API host
 *  - an object shape ({ url } / { secure_url } / { path }) — unwrapped
 * Never lets an object get stringified straight into an <img src>, which is
 * what produces a broken "[object Object]" image.
 */
export function resolveLogoUrl(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === 'string') {
    if (/^(https?:|blob:|data:)/.test(value)) return value;
    return `${API_ASSET_BASE}${value.startsWith('/') ? '' : '/'}${value}`;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const candidate = obj.url ?? obj.secure_url ?? obj.path ?? null;
    return typeof candidate === 'string' ? resolveLogoUrl(candidate) : null;
  }

  return null;
}