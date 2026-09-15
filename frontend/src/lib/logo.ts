const configuredApi = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API || '';

function assetOrigin() {
  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const configuredOrigin = configuredApi.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  const configuredIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configuredOrigin);

  // A localhost value can remain in a build-time env file after deployment.
  // In that case uploaded assets must use the deployed site's proxy origin.
  if (browserOrigin && configuredIsLocal && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(browserOrigin)) {
    return browserOrigin;
  }
  return configuredOrigin || browserOrigin;
}

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
    return `${assetOrigin()}${value.startsWith('/') ? '' : '/'}${value}`;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const candidate = obj.url ?? obj.secure_url ?? obj.path ?? null;
    return typeof candidate === 'string' ? resolveLogoUrl(candidate) : null;
  }

  return null;
}