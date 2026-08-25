'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, UserPlus, User, Mail, Phone, Users, CalendarDays, MapPin, VenusAndMars } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { listClients } from '@/src/lib/api/clients';
import type { Client } from '@/src/types/client';
import type { Candidate, CandidateFormValues } from '@/src/types/candidate';

interface Props {
  mode: 'create' | 'edit';
  candidate: Candidate | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: CandidateFormValues) => void;
}

const inputClass = 'w-full rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] px-3 py-2.5 text-[13.5px] text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none focus:border-[#3FDCC0]/50 focus:ring-1 focus:ring-[#3FDCC0]/30 transition-colors';

function Field({ label, icon: Icon, children }: { label: string; icon?: React.ComponentType<{ size?: number }>; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-[12px] text-[var(--muted)] flex items-center gap-1.5">{Icon && <Icon size={12} />}{label}</label>{children}</div>;
}

export default function CandidateFormModal({ mode, candidate, submitting, error, onClose, onSubmit }: Props) {
  const { accessToken } = useAuth();
  const [values, setValues] = useState<CandidateFormValues>({
    clientId: candidate?.clientId ?? '',
    firstName: candidate?.firstName ?? '',
    lastName: candidate?.lastName ?? '',
    email: candidate?.email ?? '',
    phone: candidate?.phone ?? '',
    dateOfBirth: candidate?.dateOfBirth ? candidate.dateOfBirth.slice(0, 10) : '',
    gender: candidate?.gender ?? '',
    currentAddress: candidate?.currentAddress ?? '',
    permanentAddress: candidate?.permanentAddress ?? '',
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(mode === 'create');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingClients(true);
    listClients({ page: 1, limit: 200, status: 'ACTIVE', sortBy: 'name', sortOrder: 'asc' }, accessToken)
      .then((result) => { if (!cancelled) setClients(result.items); })
      .finally(() => { if (!cancelled) setLoadingClients(false); });
    return () => { cancelled = true; };
  }, [accessToken]);

  const set = (field: keyof CandidateFormValues) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setValues((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError(null);
    if (mode === 'create' && !values.clientId) return setValidationError('Select a client.');
    if (!values.firstName.trim() || !values.lastName.trim()) return setValidationError('First and last name are required.');
    if (!values.email.trim()) return setValidationError('Email is required.');
    onSubmit(values);
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div className="w-full max-w-2xl max-h-[92vh] rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0"><div className="flex items-center gap-2.5"><span className="w-8 h-8 rounded-lg bg-[#3FDCC0]/15 text-[#3FDCC0] flex items-center justify-center"><UserPlus size={16} /></span><div><h2 className="text-[15px] font-semibold">{mode === 'create' ? 'Add candidate' : 'Edit candidate'}</h2><p className="text-[11px] text-[var(--muted)]">Candidate information for background verification</p></div></div><button onClick={onClose} aria-label="Close"><X size={16} /></button></div>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-5">{(error || validationError) && <div className="rounded-lg bg-[#FF6B6B]/10 border border-[#FF6B6B]/25 text-[#FF6B6B] text-[13px] px-3.5 py-2.5">{validationError || error}</div>}
          <section className="space-y-3"><h3 className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Case relationship</h3><Field label="Client" icon={Users}><select value={values.clientId} onChange={set('clientId')} disabled={loadingClients} className={`${inputClass} disabled:opacity-60`}><option value="">{loadingClients ? 'Loading...' : 'Select client...'}</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name} ({client.clientCode})</option>)}</select></Field></section>
          <section className="space-y-3"><h3 className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Personal information</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field label="First name" icon={User}><input value={values.firstName} onChange={set('firstName')} className={inputClass} autoComplete="given-name" /></Field><Field label="Last name" icon={User}><input value={values.lastName} onChange={set('lastName')} className={inputClass} autoComplete="family-name" /></Field><Field label="Email" icon={Mail}><input type="email" value={values.email} onChange={set('email')} className={inputClass} autoComplete="email" /></Field><Field label="Phone" icon={Phone}><input value={values.phone} onChange={set('phone')} className={inputClass} autoComplete="tel" /></Field><Field label="Date of birth" icon={CalendarDays}><input type="date" value={values.dateOfBirth} onChange={set('dateOfBirth')} className={inputClass} /></Field><Field label="Gender" icon={VenusAndMars}><select value={values.gender} onChange={set('gender')} className={inputClass}><option value="">Prefer not to say</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="NON_BINARY">Non-binary</option><option value="OTHER">Other</option></select></Field></div></section>
          <section className="space-y-3"><h3 className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Address information</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field label="Current address" icon={MapPin}><textarea value={values.currentAddress} onChange={set('currentAddress')} className={`${inputClass} min-h-24 resize-y`} placeholder="Current residential address" /></Field><Field label="Permanent address" icon={MapPin}><textarea value={values.permanentAddress} onChange={set('permanentAddress')} className={`${inputClass} min-h-24 resize-y`} placeholder="Permanent residential address" /></Field></div></section>
        </div>
        <div className="sticky bottom-0 flex shrink-0 justify-end gap-2.5 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4"><button type="button" onClick={onClose} disabled={submitting} className="rounded-lg px-4 py-2.5 text-[13px] text-[var(--muted)]">Cancel</button><button type="submit" disabled={submitting || loadingClients} className="flex min-w-[128px] items-center justify-center gap-2 rounded-lg bg-[#3FDCC0] px-4 py-2.5 text-[13px] font-semibold text-[#0B0F26]">{submitting && <Loader2 size={14} className="animate-spin" />}{mode === 'create' ? 'Add candidate' : 'Save changes'}</button></div>
      </form>
    </div>
  </div>;
}
