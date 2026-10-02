const API_BASE = process.env.NEXT_PUBLIC_API || process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';

export interface GeoState { id: string; countryId: string; countryName: string; name: string; isActive: boolean; }
export interface GeoCountry { id: string; name: string; isActive: boolean; states: Omit<GeoState, 'countryName'>[]; }
export interface GeoCatalog { countries: GeoCountry[]; states: GeoState[]; }
export interface GeoImportResult { countriesAdded: number; statesAdded: number; existingRowsSkipped: number; }

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    throw new Error(typeof body?.message === 'string' ? body.message : body?.message?.message || 'Could not update the location catalog.');
  }
  return (body?.data?.data ?? body?.data) as T;
}

async function request<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  return readResponse<T>(response);
}

export function listGeoLocations(includeInactive = false, token: string | null = null): Promise<GeoCatalog> {
  return request<GeoCatalog>(`/platform/locations${includeInactive ? '/admin' : ''}`, token, { cache: 'no-store' });
}

export function createGeoCountry(name: string, token: string | null): Promise<GeoCountry> {
  return request('/platform/locations/countries', token, { method: 'POST', body: JSON.stringify({ name }) });
}

export function updateGeoCountry(id: string, payload: { name?: string; isActive?: boolean }, token: string | null): Promise<GeoCountry> {
  return request(`/platform/locations/countries/${id}`, token, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function createGeoState(countryId: string, name: string, token: string | null): Promise<GeoState> {
  return request('/platform/locations/states', token, { method: 'POST', body: JSON.stringify({ countryId, name }) });
}

export function updateGeoState(id: string, payload: { name?: string; isActive?: boolean }, token: string | null): Promise<GeoState> {
  return request(`/platform/locations/states/${id}`, token, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function importGeoCsv(file: File, token: string | null): Promise<GeoImportResult> {
  const form = new FormData();
  form.append('file', file);
  return request('/platform/locations/import', token, { method: 'POST', body: form });
}