'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Users,
  Briefcase,
  User,
  CheckCircle2,
  Clock,
  FileText,
  Activity,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { getCompanyDetails } from '@/src/lib/api/companies';
import { ApiError } from '@/src/lib/api';
import { resolveLogoUrl } from '@/src/lib/logo';

interface CompanyDetailsResponse {
  company: {
    id: string;
    name: string;
    slug: string;
    contactEmail: string | null;
    contactPhone: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    address: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  admin: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
    roleName: string | null;
  } | null;
  stats: {
    users: number;
    clients: number;
    candidates: number;
    bgvCases: number;
    pendingCases: number;
    inProgressCases: number;
    completedCases: number;
    reports: number;
  };
  auditLogs: Array<{
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    metadata: any;
    createdAt: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    } | null;
  }>;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusClasses(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-[var(--primary)]/12 text-[var(--primary)] border-[var(--primary)]/30';
    case 'SUSPENDED':
      return 'bg-[var(--accent)]/12 text-[var(--accent)] border-[var(--accent)]/30';
    default:
      return 'bg-[var(--surface-muted)] text-[var(--muted)] border-[var(--border)]';
  }
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[color-mix(in_srgb,var(--surface)_65%,var(--background))] p-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide">{label}</p>
          <p className="text-[28px] font-bold text-[var(--foreground)] mt-2" style={{ fontFamily: 'var(--font-display)' }}>
            {value}
          </p>
        </div>
        <Icon size={20} style={{ color }} />
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8 animate-pulse">
      <div className="h-64 rounded-2xl bg-[var(--surface)]" />
      <div className="h-40 rounded-2xl bg-[var(--surface)]" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-[var(--surface)]" />
        ))}
      </div>
    </div>
  );
}

export default function CompanyDetailPage() {
  const { accessToken } = useAuth();
  const params = useParams();
  const companyId = params?.id as string;

  const [details, setDetails] = useState<CompanyDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoBroken, setLogoBroken] = useState(false);

  useEffect(() => {
    if (!companyId || !accessToken) {
      setLoading(false);
      return;
    }

    const loadDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getCompanyDetails(companyId, accessToken);
        setDetails(data);
        setLogoBroken(false);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load company details');
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [companyId, accessToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <DetailSkeleton />
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <div className="max-w-4xl mx-auto space-y-4 p-6">
          <Link
            href="/super-admin/companies"
            className="inline-flex items-center gap-2 text-[var(--primary)] hover:opacity-80 text-[13px] font-medium"
          >
            <ArrowLeft size={14} />
            Back to companies
          </Link>
          <div className="flex items-start gap-2.5 rounded-xl border border-[var(--danger)]/25 bg-[var(--danger)]/10 px-4 py-3 text-[13px] text-[var(--danger)]">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error || 'Company not found'}
          </div>
        </div>
      </div>
    );
  }

  const { company, admin, stats, auditLogs } = details;
  const completionRate = stats.bgvCases > 0 ? Math.round((stats.completedCases / stats.bgvCases) * 100) : 0;
  const resolvedLogo = resolveLogoUrl(company.logoUrl);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface)]/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link
            href="/super-admin/companies"
            className="inline-flex items-center gap-2 text-[var(--primary)] hover:opacity-80 text-[13px] font-medium"
          >
            <ArrowLeft size={14} />
            Back to companies
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header card */}
        <div className="rounded-2xl border border-[var(--primary)]/20 bg-gradient-to-br from-[var(--surface)] via-[var(--surface)] to-[color-mix(in_srgb,var(--surface)_60%,var(--background))] p-8 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)]/5 rounded-full blur-3xl -z-10" />

          <div className="flex flex-col gap-8 lg:flex-row">
            <div className="lg:max-w-[280px] flex-shrink-0">
              {resolvedLogo && !logoBroken ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolvedLogo}
                  alt={company.name}
                  onError={() => setLogoBroken(true)}
                  className="w-full rounded-2xl border-2 border-[var(--primary)]/30 object-cover h-48 shadow-xl"
                />
              ) : (
                <div className="w-full flex items-center justify-center h-48 rounded-2xl bg-gradient-to-br from-[var(--primary)]/20 to-[var(--primary)]/5 border-2 border-[var(--primary)]/30">
                  <Building2 size={60} className="text-[var(--primary)]" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--primary)] mb-2 font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>
                  Company Overview
                </p>
                <h1 className="text-[32px] font-bold text-[var(--foreground)] leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  {company.name}
                </h1>
                <p className="text-[14px] text-[var(--muted)] mt-2 flex items-center gap-2">
                  <Calendar size={14} />
                  Created {formatDate(company.createdAt)}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Status</p>
                  <span className={`inline-flex px-4 py-2 rounded-xl border text-[13px] font-semibold ${getStatusClasses(company.status)}`}>
                    {company.status}
                  </span>
                </div>

                {company.slug && (
                  <div>
                    <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Slug</p>
                    <p className="text-[13px] font-mono text-[var(--primary)]">{company.slug}</p>
                  </div>
                )}

                {company.primaryColor && (
                  <div>
                    <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Brand Color</p>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg border-2 border-[var(--border)]" style={{ backgroundColor: company.primaryColor }} />
                      <span className="text-[13px] font-mono text-[var(--foreground)]">{company.primaryColor}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {company.contactEmail && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-muted)] border border-[var(--border)]">
                    <Mail size={16} className="text-[var(--primary)]" />
                    <div>
                      <p className="text-[11px] text-[var(--muted)] font-semibold">Email</p>
                      <p className="text-[13px] text-[var(--foreground)]">{company.contactEmail}</p>
                    </div>
                  </div>
                )}
                {company.contactPhone && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-muted)] border border-[var(--border)]">
                    <Phone size={16} className="text-[var(--primary)]" />
                    <div>
                      <p className="text-[11px] text-[var(--muted)] font-semibold">Phone</p>
                      <p className="text-[13px] text-[var(--foreground)]">{company.contactPhone}</p>
                    </div>
                  </div>
                )}
              </div>

              {company.address && (
                <div className="flex gap-3 p-4 rounded-lg bg-[var(--surface-muted)] border border-[var(--border)]">
                  <MapPin size={16} className="text-[var(--accent)] mt-0.5" />
                  <div>
                    <p className="text-[11px] text-[var(--muted)] font-semibold mb-1">Address</p>
                    <p className="text-[13px] text-[var(--foreground)]">{company.address}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Administrator */}
        {admin && (
          <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[color-mix(in_srgb,var(--surface)_65%,var(--background))] p-8">
            <div className="mb-6">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--primary)] mb-2 font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>
                Administrator
              </p>
              <h2 className="text-[20px] font-bold text-[var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                {admin.firstName} {admin.lastName}
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-[11px] text-[var(--muted)] font-semibold uppercase mb-2">Email</p>
                <p className="text-[13px] text-[var(--foreground)] font-mono">{admin.email}</p>
              </div>
              <div>
                <p className="text-[11px] text-[var(--muted)] font-semibold uppercase mb-2">Role</p>
                <p className="text-[13px] text-[var(--foreground)]">{admin.roleName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[11px] text-[var(--muted)] font-semibold uppercase mb-2">Status</p>
                <span className={`inline-flex px-3 py-1 rounded-lg border text-[12px] font-semibold ${getStatusClasses(admin.status)}`}>
                  {admin.status}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Users" value={stats.users} icon={Users} color="var(--primary)" />
          <StatCard label="Clients" value={stats.clients} icon={Briefcase} color="var(--primary)" />
          <StatCard label="Candidates" value={stats.candidates} icon={User} color="var(--accent)" />
          <StatCard label="BGV Cases" value={stats.bgvCases} icon={FileText} color="var(--danger)" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[color-mix(in_srgb,var(--surface)_65%,var(--background))] p-6">
            <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-4">Exam Attempts</p>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[12px] mb-2">
                  <span className="text-[var(--muted)]">Total</span>
                  <span className="text-[var(--foreground)] font-bold">{stats.pendingCases}</span>
                </div>
                <div className="w-full h-2 bg-[var(--surface-muted)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--primary)]" style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[12px] mb-2">
                  <span className="text-[var(--muted)]">Completed ({completionRate}%)</span>
                  <span className="text-[var(--primary)] font-bold">{stats.inProgressCases}</span>
                </div>
                <div className="w-full h-2 bg-[var(--surface-muted)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--primary)]" style={{ width: `${completionRate}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[color-mix(in_srgb,var(--surface)_65%,var(--background))] p-6">
            <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-4">BGV Reports</p>
            <div className="flex items-center gap-4">
              <CheckCircle2 size={32} className="text-[var(--primary)]" />
              <div>
                <p className="text-[32px] font-bold text-[var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                  {stats.reports}
                </p>
                <p className="text-[12px] text-[var(--muted)]">Reports Generated</p>
              </div>
            </div>
          </div>
        </div>

        {/* Audit trail */}
        {auditLogs.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[color-mix(in_srgb,var(--surface)_65%,var(--background))] overflow-hidden">
            <div className="p-6 border-b border-[var(--border)]">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--accent)] mb-2 font-semibold flex items-center gap-2" style={{ fontFamily: 'var(--font-mono)' }}>
                <Clock size={14} />
                Audit Trail
              </p>
              <h2 className="text-[18px] font-bold text-[var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                Recent Activity
              </h2>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-[var(--border)]">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-[var(--surface-muted)] transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <span className="inline-flex px-2 py-1 rounded text-[11px] font-semibold bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30 mr-2">
                        {log.action}
                      </span>
                      <span className="text-[12px] text-[var(--muted)]">{log.entity}</span>
                    </div>
                  </div>
                  <p className="text-[12px] text-[var(--muted)]">
                    <span className="text-[var(--foreground)] font-semibold">
                      {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'}
                    </span>
                    {' — '}
                    {formatDate(log.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {auditLogs.length === 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[color-mix(in_srgb,var(--surface)_65%,var(--background))] p-8 text-center">
            <Activity size={32} className="text-[var(--muted)] mx-auto mb-3 opacity-50" />
            <p className="text-[14px] text-[var(--muted)]">No audit activity recorded</p>
          </div>
        )}
      </div>
    </div>
  );
}