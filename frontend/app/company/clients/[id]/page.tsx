'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Building2, Mail, Phone, Globe, Pencil, Users, MapPin, Power, PowerOff,
} from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { getClient, activateClient, inactivateClient, ApiError as ClientApiError } from '@/src/lib/api/clients';
import { listCandidates, createCandidate, ApiError as CandidateApiError } from '@/src/lib/api/candidates';
import ClientFormModal from '@/src/components/layout/company/client/ClientFormModal';
import ClientConfirmDialog from '@/src/components/layout/company/client/ClientConfirmDialog';
import CandidateFormModal from '@/src/components/layout/company/candidate/CandidateFormModal';
import type { Client } from '@/src/types/client';
import type { Candidate, CandidateFormValues, PaginationMeta } from '@/src/types/candidate';

const PAGE_SIZE = 10;
type TabKey = 'overview' | 'candidates';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'candidates', label: 'Candidates' },
];

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');

  const [editOpen, setEditOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<'ACTIVE' | 'INACTIVE' | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesMeta, setCandidatesMeta] = useState<PaginationMeta>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [candidatesPage, setCandidatesPage] = useState(1);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [candidateSubmitting, setCandidateSubmitting] = useState(false);

  const loadClient = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setClient(await getClient(id, accessToken));
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : 'Failed to load client.');
    } finally {
      setLoading(false);
    }
  }, [id, accessToken]);

  useEffect(() => { loadClient(); }, [loadClient]);

  const loadCandidates = useCallback(async () => {
    if (!id) return;
    setCandidatesLoading(true);
    setCandidatesError(null);
    try {
      const res = await listCandidates(
        { page: candidatesPage, limit: PAGE_SIZE, clientId: id, sortBy: 'createdAt', sortOrder: 'desc' },
        accessToken
      );
      setCandidates(res.items);
      setCandidatesMeta(res.meta);
    } catch (err) {
      setCandidatesError(err instanceof CandidateApiError ? err.message : 'Failed to load candidates.');
    } finally {
      setCandidatesLoading(false);
    }
  }, [id, candidatesPage, accessToken]);

  useEffect(() => { if (tab === 'candidates') loadCandidates(); }, [tab, loadCandidates]);

  const handleToggleStatus = async () => {
    if (!client || !statusTarget) return;
    setTogglingStatus(true);
    try {
      const updated = statusTarget === 'ACTIVE'
        ? await activateClient(client.id, accessToken)
        : await inactivateClient(client.id, accessToken);
      setClient(updated);
    } finally {
      setStatusTarget(null);
      setTogglingStatus(false);
    }
  };

  const handleCreateCandidate = async (values: CandidateFormValues) => {
    if (!client) return;
    setCandidateSubmitting(true);
    try {
      await createCandidate(
        {
          clientId: client.id,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          phone: values.phone.trim() || undefined,
          dateOfBirth: values.dateOfBirth || undefined,
          gender: values.gender || undefined,
          currentAddress: values.currentAddress || undefined,
          permanentAddress: values.permanentAddress || undefined,
        },
        accessToken
      );
      setCandidateModalOpen(false);
      await loadCandidates();
    } finally {
      setCandidateSubmitting(false);
    }
  };

  if (loading) return <div className="max-w-6xl mx-auto py-16 text-center text-[13px] text-[var(--muted)]">Loading client…</div>;

  if (error || !client) {
    return (
      <div className="max-w-6xl mx-auto py-16 text-center">
        <p className="text-[13px] text-[#FF6B6B] mb-3">{error || 'Client not found.'}</p>
        <button onClick={() => router.push('/clients')} className="text-[13px] text-[var(--primary)] underline">
          Back to clients
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button onClick={() => router.push('/clients')} className="inline-flex items-center gap-1.5 text-[13px] text-[var(--muted)] hover:text-[var(--foreground)]">
        <ArrowLeft size={14} /> Back to clients
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-center gap-4">
          {client.logoUrl ? (
            <img src={client.logoUrl} alt="" className="w-14 h-14 rounded-full object-cover bg-[var(--surface-muted)]" />
          ) : (
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-[15px] font-semibold bg-[var(--primary)]/15 text-[var(--primary)]">
              {initials(client.name)}
            </div>
          )}
          <div>
            <h1 className="text-[22px] font-semibold text-[var(--foreground)]">{client.name}</h1>
            <p className="text-[12.5px] text-[var(--muted)] font-mono">
              {client.clientCode}{client.industry ? ` · ${client.industry}` : ''}
            </p>
            <span className={`inline-flex mt-1.5 items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${client.status === 'ACTIVE' ? 'bg-[var(--primary)]/15 text-[var(--primary)]' : 'bg-[var(--muted)]/20 text-[var(--muted)]'}`}>
              {client.status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {client.website && (
            <a href={client.website} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--muted)] hover:bg-[var(--surface-muted)]">
              <Globe size={15} />
            </a>
          )}
          <button onClick={() => setStatusTarget(client.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')} className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--muted)] hover:bg-[var(--surface-muted)]">
            {client.status === 'ACTIVE' ? <PowerOff size={15} /> : <Power size={15} />}
          </button>
          <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-[13px] font-semibold px-3.5 py-2 hover:bg-[var(--primary)]/90">
            <Pencil size={13} /> Edit
          </button>
        </div>
      </div>

      <div className="border-b border-[var(--border)] flex items-center gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-[var(--primary)] text-[var(--foreground)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            {t.label}
            {t.key === 'candidates' && candidatesMeta.total > 0 && (
              <span className="ml-1.5 text-[11px] text-[var(--muted)]">({candidatesMeta.total})</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
            <h3 className="text-[13px] font-semibold text-[var(--foreground)]">Contact</h3>
            <p className="flex items-center gap-2 text-[13px] text-[var(--muted)]"><Building2 size={13} /> {client.contactName || '—'}</p>
            <p className="flex items-center gap-2 text-[13px] text-[var(--muted)]"><Mail size={13} /> {client.contactEmail || '—'}</p>
            <p className="flex items-center gap-2 text-[13px] text-[var(--muted)]"><Phone size={13} /> {client.contactPhone || '—'}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
            <h3 className="text-[13px] font-semibold text-[var(--foreground)]">Address</h3>
            <p className="flex items-start gap-2 text-[13px] text-[var(--muted)]">
              <MapPin size={13} className="mt-0.5" />
              <span>{[client.addressLine1, client.addressLine2, client.city, client.state, client.country, client.postalCode].filter(Boolean).join(', ') || '—'}</span>
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3 sm:col-span-2">
            <h3 className="text-[13px] font-semibold text-[var(--foreground)]">Compliance</h3>
            <div className="flex gap-6 text-[13px] text-[var(--muted)]">
              <span>GST: {client.gstNumber || '—'}</span>
              <span>PAN: {client.panNumber || '—'}</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'candidates' && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
            <p className="text-[13px] text-[var(--muted)]">Candidates linked to {client.name}</p>
            <button onClick={() => setCandidateModalOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#3FDCC0] text-[#0B0F26] text-[12.5px] font-semibold px-3 py-2">
              <Users size={13} /> Add candidate
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--muted)]">
                <tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Candidate</th><th className="px-5 py-3">Cases</th><th className="px-5 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {candidatesLoading ? (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-[var(--muted)]">Loading candidates…</td></tr>
                ) : candidatesError ? (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-[#FF6B6B]">{candidatesError}</td></tr>
                ) : candidates.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-[var(--muted)]">No candidates for this client yet.</td></tr>
                ) : candidates.map((c) => (
                  <tr key={c.id}>
                    <td className="px-5 py-3 font-mono text-[12px] text-[var(--muted)]">{c.candidateCode}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-[var(--foreground)]">{c.firstName} {c.lastName}</p>
                      <p className="text-[11px] text-[var(--muted)]">{c.email}</p>
                    </td>
                    <td className="px-5 py-3">{c.bgvCaseCount ?? 0}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full px-2.5 py-1 text-[11px] font-medium bg-[var(--surface-muted)] text-[var(--muted)]">{c.status.replaceAll('_', ' ')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)] text-[12px] text-[var(--muted)]">
            <span>{candidatesMeta.total} candidates</span>
            <div className="flex gap-2">
              <button disabled={candidatesPage <= 1} onClick={() => setCandidatesPage((p) => p - 1)} className="rounded-md border border-[var(--border)] px-3 py-1.5 disabled:opacity-40">Previous</button>
              <button disabled={candidatesPage >= candidatesMeta.totalPages} onClick={() => setCandidatesPage((p) => p + 1)} className="rounded-md border border-[var(--border)] px-3 py-1.5 disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      )}

      {statusTarget && (
        <ClientConfirmDialog
          title={statusTarget === 'ACTIVE' ? 'Activate client?' : 'Deactivate client?'}
          description={statusTarget === 'ACTIVE' ? `"${client.name}" will be marked active again.` : `"${client.name}" will be marked inactive.`}
          confirmLabel={statusTarget === 'ACTIVE' ? 'Activate' : 'Deactivate'}
          tone={statusTarget === 'ACTIVE' ? 'default' : 'danger'}
          submitting={togglingStatus}
          onConfirm={handleToggleStatus}
          onCancel={() => setStatusTarget(null)}
        />
      )}

      {candidateModalOpen && (
        <CandidateFormModal
          mode="create"
          candidate={null}
          submitting={candidateSubmitting}
          error={null}
          onClose={() => setCandidateModalOpen(false)}
          onSubmit={handleCreateCandidate}
        />
      )}
    </div>
  );
}