'use client';

import { useEffect, useState } from 'react';
import { FileCheck2, Loader2, X } from 'lucide-react';
import { createClient, listClients } from '@/src/lib/api/clients';
import { listCandidates } from '@/src/lib/api/candidates';
import { useAuth } from '@/src/auth/AuthProvider';
import type { Client } from '@/src/types/client';
import type { Candidate } from '@/src/types/candidate';
import type { CreateBGVCasePayload, VerificationProvider, VerificationType } from '@/src/types/bgv';

interface Props {
  token: string | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: CreateBGVCasePayload) => void;
}

const checkTypes: { type: VerificationType; label: string; provider: VerificationProvider }[] = [
  { type: 'PAN', label: 'PAN', provider: 'SUREPASS' },
  { type: 'UAN', label: 'UAN', provider: 'SUREPASS' },
  { type: 'COURT', label: 'Court', provider: 'SUREPASS' },
  { type: 'IDENTITY', label: 'Identity', provider: 'MANUAL' },
  { type: 'ADDRESS', label: 'Address', provider: 'MANUAL' },
  { type: 'EDUCATION', label: 'Education', provider: 'MANUAL' },
  { type: 'EMPLOYMENT', label: 'Employment', provider: 'MANUAL' },
  { type: 'DOCUMENT', label: 'Document', provider: 'MANUAL' },
  { type: 'CIBIL', label: 'CIBIL', provider: 'MANUAL' },
  { type: 'TWENTY_SIX_AS', label: '26AS', provider: 'MANUAL' },
  { type: 'POLICE', label: 'Police Verification', provider: 'MANUAL' },
];

const inputClass = 'w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[#3FDCC0]/50';

export default function BGVCaseFormModal({ token, submitting, error, onClose, onSubmit }: Props) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [clientId, setClientId] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [clientReference, setClientReference] = useState('');
  const [packageName, setPackageName] = useState('Standard BGV');
  const [remarks, setRemarks] = useState('');
  const [selectedChecks, setSelectedChecks] = useState<VerificationType[]>(['PAN', 'UAN', 'COURT']);
  const [loading, setLoading] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listClients({ page: 1, limit: 200, status: 'ACTIVE', sortBy: 'name', sortOrder: 'asc' }, token),
      listCandidates({ page: 1, limit: 200, status: 'PENDING', sortBy: 'createdAt', sortOrder: 'desc' }, token),
    ]).then(([clientResult, candidateResult]) => {
      if (!cancelled) { setClients(clientResult.items); setCandidates(candidateResult.items); }
      const individual = clientResult.items.find((client) => client.name === 'Individual / Direct Candidate');
      if (!individual && user?.companyId) {
        const clientCode = `IND-${user.companyId.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
        return createClient({ companyId: user.companyId, clientCode, name: 'Individual / Direct Candidate', industry: 'Individual' }, token)
          .then((created) => { if (!cancelled) setClients((current) => [...current, created]); })
          .catch(() => undefined);
      }
      return undefined;
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, user?.companyId]);

  const availableCandidates = clientId ? candidates.filter((candidate) => candidate.clientId === clientId) : candidates;
  const toggleCheck = (type: VerificationType) => setSelectedChecks((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError(null);
    if (!clientId) return setValidationError('Select a client.');
    if (!candidateId) return setValidationError('Select a candidate.');
    if (!selectedChecks.length) return setValidationError('Select at least one verification check.');
    onSubmit({ clientId, candidateId, clientReference: clientReference.trim() || undefined, packageName: packageName.trim() || undefined, remarks: remarks.trim() || undefined, checks: selectedChecks.map((type) => { const config = checkTypes.find((item) => item.type === type)!; return { type, provider: config.provider }; }) });
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"><header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-6 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3FDCC0]/15 text-[#3FDCC0]"><FileCheck2 size={18} /></span><div><h2 className="text-[16px] font-semibold">New BGV Case</h2><p className="text-[12px] text-[var(--muted)]">Create a verification case and choose its checks.</p></div></div><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></header><form onSubmit={submit} className="flex min-h-0 flex-1 flex-col"><div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">{(error || validationError) && <div className="rounded-lg border border-[#FF6B6B]/25 bg-[#FF6B6B]/10 px-3 py-2.5 text-[13px] text-[#FF6B6B]">{validationError || error}</div>}<div className="grid gap-4 sm:grid-cols-2"><label className="text-[12px] text-[var(--muted)]">Client<select value={clientId} onChange={(event) => { setClientId(event.target.value); setCandidateId(''); }} disabled={loading} className={`${inputClass} mt-1`}><option value="">{loading ? 'Loading clients...' : 'Select client...'}</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name} ({client.clientCode})</option>)}</select></label><label className="text-[12px] text-[var(--muted)]">Candidate<select value={candidateId} onChange={(event) => setCandidateId(event.target.value)} disabled={loading || !clientId} className={`${inputClass} mt-1`}><option value="">{!clientId ? 'Select a client first' : 'Select candidate...'}</option>{availableCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.firstName} {candidate.lastName} ({candidate.candidateCode})</option>)}</select></label><label className="text-[12px] text-[var(--muted)]">Client reference<input value={clientReference} onChange={(event) => setClientReference(event.target.value)} placeholder="Optional reference" className={`${inputClass} mt-1`} /></label><label className="text-[12px] text-[var(--muted)]">Package name<input value={packageName} onChange={(event) => setPackageName(event.target.value)} className={`${inputClass} mt-1`} /></label></div><label className="block text-[12px] text-[var(--muted)]">Internal remarks<textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={3} className={`${inputClass} mt-1 resize-y`} placeholder="Optional case notes" /></label><fieldset><legend className="mb-2 text-[12px] font-medium text-[var(--muted)]">Verification checks</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{checkTypes.map((check) => <label key={check.type} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-[12px] ${selectedChecks.includes(check.type) ? 'border-[#3FDCC0]/60 bg-[#3FDCC0]/10 text-[#3FDCC0]' : 'border-[var(--border)] text-[var(--muted)]'}`}><input type="checkbox" checked={selectedChecks.includes(check.type)} onChange={() => toggleCheck(check.type)} className="accent-[#0E8C78]" />{check.label}</label>)}</div></fieldset></div><footer className="flex shrink-0 justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4"><button type="button" onClick={onClose} disabled={submitting} className="rounded-lg px-4 py-2.5 text-[13px] text-[var(--muted)]">Cancel</button><button type="submit" disabled={submitting || loading} className="inline-flex min-w-[145px] items-center justify-center gap-2 rounded-lg bg-[#3FDCC0] px-4 py-2.5 text-[13px] font-semibold text-[#0B0F26]">{submitting && <Loader2 size={14} className="animate-spin" />}Create case</button></footer></form></div></div>;
}
