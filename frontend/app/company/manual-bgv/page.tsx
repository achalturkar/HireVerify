'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { listClients } from '@/src/lib/api/clients';
import { listCandidates } from '@/src/lib/api/candidates';
import { createBGVCase, ApiError } from '@/src/lib/api/bgv';
import type { Client } from '@/src/types/client';
import type { Candidate } from '@/src/types/candidate';

const DEFAULT_CHECKS = [
  { type: 'IDENTITY' as const, provider: 'MANUAL' as const },
  { type: 'ADDRESS' as const, provider: 'MANUAL' as const },
  { type: 'EMPLOYMENT' as const, provider: 'MANUAL' as const },
  { type: 'EDUCATION' as const, provider: 'MANUAL' as const },
  { type: 'COURT' as const, provider: 'MANUAL' as const },
];

export default function NewBGVCasePage() {
  const { accessToken } = useAuth();
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateId, setCandidateId] = useState('');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [packageName, setPackageName] = useState('');
  const [clientReference, setClientReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listClients({ page: 1, limit: 200, status: 'ACTIVE', sortBy: 'name', sortOrder: 'asc' }, accessToken)
      .then((res) => setClients(res.items))
      .catch(() => setClients([]));
  }, [accessToken]);

  useEffect(() => {
    if (!clientId) {
      setCandidates([]);
      setCandidateId('');
      return;
    }
    listCandidates(
      { page: 1, limit: 100, clientId, search: candidateSearch, sortBy: 'firstName', sortOrder: 'asc' },
      accessToken
    )
      .then((res) => setCandidates(res.items))
      .catch(() => setCandidates([]));
  }, [clientId, candidateSearch, accessToken]);

  const handleSubmit = async () => {
    if (!clientId || !candidateId) {
      setError('Select a client and a candidate.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createBGVCase(
        {
          clientId,
          candidateId,
          packageName: packageName.trim() || undefined,
          clientReference: clientReference.trim() || undefined,
          checks: DEFAULT_CHECKS,
        },
        accessToken
      );
      router.push(`/company/bgv-cases/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create case.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#3FDCC0]">New verification</p>
        <h1 className="text-[24px] font-semibold text-[var(--foreground)]">Start a BGV case</h1>
        <p className="text-[13px] text-[var(--muted)] mt-1">
          Pick an existing client and candidate — their details are pulled from your records, not retyped.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-[#FF6B6B]/25 bg-[#FF6B6B]/10 px-4 py-2.5 text-[13px] text-[#FF6B6B]">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
        <div>
          <label className="block text-[12.5px] font-medium text-[var(--foreground)] mb-1.5">Client</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px]"
          >
            <option value="">Select client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.clientCode})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[12.5px] font-medium text-[var(--foreground)] mb-1.5">Candidate</label>
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-3 text-[var(--muted)]" />
            <input
              value={candidateSearch}
              onChange={(e) => setCandidateSearch(e.target.value)}
              disabled={!clientId}
              placeholder={clientId ? 'Search candidates…' : 'Select a client first'}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 py-2.5 text-[13px] disabled:opacity-50"
            />
          </div>
          <select
            value={candidateId}
            onChange={(e) => setCandidateId(e.target.value)}
            disabled={!clientId}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] disabled:opacity-50"
          >
            <option value="">Select candidate…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName} · {c.email}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12.5px] font-medium text-[var(--foreground)] mb-1.5">Entity / Package</label>
            <input
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px]"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-[var(--foreground)] mb-1.5">Client Ref No</label>
            <input
              value={clientReference}
              onChange={(e) => setClientReference(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px]"
            />
          </div>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-[13px] font-semibold py-3 disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create case'}
      </button>
    </div>
  );
}