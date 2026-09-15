const API_BASE = process.env.NEXT_PUBLIC_API || '/api/v1';

export interface PlatformDashboardData {
	stats: {
		companies: number;
		activeCompanies: number;
		suspendedCompanies: number;
		inactiveCompanies: number;
		users: number;
		activeUsers: number;
		roles: number;
		candidates: number;
		clients: number;
		bgvCases: number;
		auditEvents24h: number;
	};
	recentCompanies: Array<{
		id: string;
		name: string;
		slug: string;
		status: string;
		createdAt: string;
		_count: { users: number; clients: number; candidates: number };
	}>;
	recentActivity: Array<{
		id: string;
		action: string;
		entity: string;
		entityId: string | null;
		createdAt: string;
		company: { id: string; name: string } | null;
		user: { firstName: string; lastName: string; email: string } | null;
	}>;
	analytics: {
		period: 'monthly' | 'yearly';
		trends: Record<string, Array<{ key: string; label: string; value: number }>>;
		comparison: Record<string, { current: number; previous: number; percent: number }>;
	};
}

export async function getPlatformDashboard(accessToken: string | null, period: 'monthly' | 'yearly' = 'monthly'): Promise<PlatformDashboardData> {
	const response = await fetch(`${API_BASE}/platform/dashboard?period=${period}`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	const body = await response.json().catch(() => null);
	if (!response.ok) {
		const message = typeof body?.message === 'string' ? body.message : body?.message?.message || 'Unable to load platform dashboard';
		throw new Error(message);
	}
	const payload = (body?.data?.data || body?.data) as Partial<PlatformDashboardData>;
	const emptyTrends = { companies: [], users: [], candidates: [], bgvCases: [], auditEvents: [] };
	const emptyComparison = { companies: { current: 0, previous: 0, percent: 0 }, users: { current: 0, previous: 0, percent: 0 }, candidates: { current: 0, previous: 0, percent: 0 }, bgvCases: { current: 0, previous: 0, percent: 0 }, auditEvents: { current: 0, previous: 0, percent: 0 } };
	return {
		...payload,
		stats: { inactiveCompanies: 0, bgvCases: 0, ...(payload.stats || {}) },
		analytics: { period, trends: emptyTrends, comparison: emptyComparison, ...(payload.analytics || {}) },
	} as PlatformDashboardData;
}
