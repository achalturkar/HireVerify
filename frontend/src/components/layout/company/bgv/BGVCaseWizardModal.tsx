'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FileCheck2, Loader2, Plus, UserRound, X } from 'lucide-react';
import { createClient, listClients } from '@/src/lib/api/clients';
import { createCandidate, getCandidate, listCandidates } from '@/src/lib/api/candidates';
import { useAuth } from '@/src/auth/AuthProvider';
import CandidateFormModal from '@/src/components/layout/company/candidate/CandidateFormModal';
import type { Client } from '@/src/types/client';
import type { Candidate, CandidateFormValues } from '@/src/types/candidate';
import type { BGVCase, CreateBGVCasePayload, VerificationProvider, VerificationType } from '@/src/types/bgv';

interface Props {
  token: string | null;
  submitting: boolean;
  error: string | null;
  initialDraft?: BGVCase | null;
  preselectedCandidateId?: string;
  onClose: () => void;
  onSubmit: (payload: CreateBGVCasePayload, intent: 'draft' | 'create', draftId?: string) => void;
}

const steps = [
  { title: 'Client', detail: 'Choose account' },
  { title: 'Candidate', detail: 'Select or add' },
  { title: 'Checks', detail: 'Choose scope' },
  { title: 'Review', detail: 'Confirm case' },
];

const checkTypes: { type: VerificationType; label: string; provider: VerificationProvider; description: string }[] = [
  { type: 'PAN', label: 'PAN', provider: 'SUREPASS', description: 'Verify tax identity details.' },
  { type: 'UAN', label: 'UAN', provider: 'SUREPASS', description: 'Verify employment provident fund history.' },
  { type: 'COURT', label: 'Court records', provider: 'SUREPASS', description: 'Search court records for the candidate.' },
  { type: 'IDENTITY', label: 'Identity documents', provider: 'MANUAL', description: 'Review government identity documents.' },
  { type: 'ADDRESS', label: 'Address', provider: 'MANUAL', description: 'Verify the candidate’s supplied address.' },
  { type: 'ADDRESS_PHYSICAL', label: 'Physical address', provider: 'MANUAL', description: 'Complete a physical address visit.' },
  { type: 'EDUCATION', label: 'Education', provider: 'MANUAL', description: 'Verify education and qualifications.' },
  { type: 'EMPLOYMENT', label: 'Employment', provider: 'MANUAL', description: 'Verify employment history.' },
  { type: 'GAP', label: 'Employment gaps', provider: 'MANUAL', description: 'Review gaps in employment history.' },
  { type: 'REFERENCE', label: 'References', provider: 'MANUAL', description: 'Contact professional references.' },
  { type: 'CV', label: 'CV validation', provider: 'MANUAL', description: 'Compare CV details with supplied records.' },
  { type: 'SOCIAL_MEDIA', label: 'Social media', provider: 'MANUAL', description: 'Review public social profiles.' },
  { type: 'DOCUMENT', label: 'Documents', provider: 'MANUAL', description: 'Review supporting documents.' },
  { type: 'CIBIL', label: 'CIBIL', provider: 'MANUAL', description: 'Review credit information.' },
  { type: 'TWENTY_SIX_AS', label: '26AS', provider: 'MANUAL', description: 'Review tax statement information.' },
  { type: 'POLICE', label: 'Police verification', provider: 'MANUAL', description: 'Complete police verification.' },
  { type: 'POLICE_RECORD', label: 'Police records', provider: 'MANUAL', description: 'Review police record details.' },
];

const inputClass = 'mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]';

export default function BGVCaseWizardModal({ token, submitting, error, initialDraft, preselectedCandidateId = '', onClose, onSubmit }: Props) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [clientId, setClientId] = useState(initialDraft?.clientId || '');
  const [candidateId, setCandidateId] = useState(initialDraft?.candidateId || preselectedCandidateId);
  const [clientReference, setClientReference] = useState(initialDraft?.clientReference || '');
  const [packageName, setPackageName] = useState(initialDraft?.packageName || 'Standard BGV');
  const [remarks, setRemarks] = useState(initialDraft?.remarks || '');
  const [selectedChecks, setSelectedChecks] = useState<VerificationType[]>(initialDraft?.checks?.map((check) => check.type) || ['PAN', 'UAN', 'COURT']);
  const [step, setStep] = useState(initialDraft ? 4 : preselectedCandidateId ? 3 : 1);
  const [loading, setLoading] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [candidateSubmitting, setCandidateSubmitting] = useState(false);
  const [candidateError, setCandidateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listClients({ page: 1, limit: 200, status: 'ACTIVE', sortBy: 'name', sortOrder: 'asc' }, token),
      listCandidates({ page: 1, limit: 200, sortBy: 'createdAt', sortOrder: 'desc' }, token),
      (initialDraft?.candidateId || preselectedCandidateId)
        ? getCandidate(initialDraft?.candidateId || preselectedCandidateId, token)
        : Promise.resolve(null),
    ]).then(async ([clientResult, candidateResult, savedCandidate]) => {
      let availableClients = clientResult.items;
      const individual = availableClients.find((client) => client.name === 'Individual / Direct Candidate');
      if (!individual && user?.companyId) {
        const clientCode = `IND-${user.companyId.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
        try {
          const createdClient = await createClient({ companyId: user.companyId, clientCode, name: 'Individual / Direct Candidate', industry: 'Individual' }, token);
          availableClients = [...availableClients, createdClient];
        } catch { /* The remaining clients are still available. */ }
      }
      if (!cancelled) {
        setClients(availableClients);
        setCandidates(savedCandidate && !candidateResult.items.some((candidate) => candidate.id === savedCandidate.id)
          ? [savedCandidate, ...candidateResult.items]
          : candidateResult.items);
        if (savedCandidate && preselectedCandidateId) {
          setClientId(savedCandidate.clientId);
          setCandidateId(savedCandidate.id);
        }
      }
    }).catch((cause) => {
      if (!cancelled) setValidationError(cause instanceof Error ? cause.message : 'Could not load clients and candidates.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [initialDraft, preselectedCandidateId, token, user?.companyId]);

  const selectedClient = clients.find((client) => client.id === clientId);
  const selectedCandidate = candidates.find((candidate) => candidate.id === candidateId);
  const selectedCandidateHasCase = (selectedCandidate?.bgvCaseCount ?? 0) > 0;
  const availableCandidates = candidates.filter((candidate) => candidate.clientId === clientId);
  const toggleCheck = (type: VerificationType) => setSelectedChecks((current) => current.includes(type)
    ? current.filter((item) => item !== type)
    : [...current, type]);

  const makePayload = (status: 'DRAFT' | 'INITIATED'): CreateBGVCasePayload => ({
    clientId,
    candidateId,
    status,
    clientReference: clientReference.trim() || undefined,
    packageName: packageName.trim() || undefined,
    remarks: remarks.trim() || undefined,
    checks: selectedChecks.map((type) => {
      const config = checkTypes.find((item) => item.type === type)!;
      return { type, provider: config.provider };
    }),
  });

  const save = (intent: 'draft' | 'create') => {
    setValidationError(null);
    if (!clientId) return setValidationError('Choose a client first.');
    if (!candidateId) return setValidationError('Choose or add a candidate first.');
    if (selectedCandidateHasCase) return setValidationError('This candidate already has a BGV case. Select a different candidate.');
    if (intent === 'create' && selectedChecks.length === 0) return setValidationError('Select at least one check before creating the case.');
    onSubmit(makePayload(intent === 'draft' ? 'DRAFT' : 'INITIATED'), intent, initialDraft?.id);
  };

  const continueStep = () => {
    setValidationError(null);
    if (step === 1 && !clientId) return setValidationError('Choose a client to continue.');
    if (step === 2 && !candidateId) return setValidationError('Choose or add a candidate to continue.');
    if (step === 3 && selectedChecks.length === 0) return setValidationError('Select at least one check to continue.');
    setStep((current) => Math.min(4, current + 1));
  };

  const handleCreateCandidate = async (values: CandidateFormValues) => {
    setCandidateSubmitting(true);
    setCandidateError(null);
    try {
      const candidate = await createCandidate({
        clientId,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim() || undefined,
        phone: values.phone.trim() || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
        gender: values.gender || undefined,
        currentAddress: values.currentAddress || undefined,
        permanentAddress: values.permanentAddress || undefined,
      }, token);
      setCandidates((current) => [candidate, ...current.filter((item) => item.id !== candidate.id)]);
      setCandidateId(candidate.id);
      setCandidateModalOpen(false);
    } catch (cause) {
      setCandidateError(cause instanceof Error ? cause.message : 'Could not add candidate.');
    } finally {
      setCandidateSubmitting(false);
    }
  };

  const renderStep = () => {
    if (step === 1) return <div className="space-y-5">
      <div><h3 className="text-[16px] font-semibold">Choose a client</h3><p className="mt-1 text-[12px] text-[var(--muted)]">The candidate and verification case will be linked to this client.</p></div>
      <label className="block text-[12px] font-medium text-[var(--muted)]">Client<select value={clientId} onChange={(event) => { setClientId(event.target.value); setCandidateId(''); }} disabled={loading || Boolean(initialDraft)} className={inputClass}><option value="">{loading ? 'Loading clients...' : 'Select client'}</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name} ({client.clientCode})</option>)}</select></label>
      {selectedClient && <div className="rounded-lg border border-[var(--primary)]/25 bg-[var(--primary)]/[0.06] p-4"><p className="text-[13px] font-semibold">{selectedClient.name}</p><p className="mt-1 text-[11px] text-[var(--muted)]">Client code: {selectedClient.clientCode}</p></div>}
    </div>;

    if (step === 2) return <div className="space-y-5">
      <div><h3 className="text-[16px] font-semibold">Choose or add a candidate</h3><p className="mt-1 text-[12px] text-[var(--muted)]">Candidates are filtered to {selectedClient?.name || 'the selected client'}.</p></div>
      <label className="block text-[12px] font-medium text-[var(--muted)]">Candidate<select value={candidateId} onChange={(event) => setCandidateId(event.target.value)} disabled={loading || Boolean(initialDraft)} className={inputClass}><option value="">Select candidate</option>{availableCandidates.map((candidate) => <option key={candidate.id} value={candidate.id} disabled={(candidate.bgvCaseCount ?? 0) > 0}>{candidate.firstName} {candidate.lastName} ({candidate.candidateCode}){(candidate.bgvCaseCount ?? 0) > 0 ? ' — Already has a BGV case' : ''}</option>)}</select></label>
      {selectedCandidate && (selectedCandidate.bgvCaseCount ?? 0) > 0 ? (
        <div role="status" className="rounded-lg border border-[var(--primary)]/25 bg-[var(--primary)]/[0.06] p-4">
          <p className="text-[13px] font-semibold">{selectedCandidate.firstName} {selectedCandidate.lastName} already has a BGV case.</p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">Select a different candidate. Only one BGV case can be created per candidate.</p>
        </div>
      ) : selectedCandidate ? <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]"><UserRound size={18} /></span><div className="min-w-0"><p className="truncate text-[13px] font-semibold">{selectedCandidate.firstName} {selectedCandidate.lastName}</p><p className="truncate text-[11px] text-[var(--muted)]">{selectedCandidate.email || 'No email on file'} · {selectedCandidate.phone || 'No phone on file'}</p></div></div> : !loading && <div className="rounded-lg border border-dashed border-[var(--border)] px-4 py-6 text-center"><p className="text-[12px] text-[var(--muted)]">No candidate selected yet.</p></div>}
      {!initialDraft && <button type="button" onClick={() => { setCandidateError(null); setCandidateModalOpen(true); }} disabled={!clientId || loading} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-[12px] font-semibold hover:border-[var(--primary)] disabled:opacity-50"><Plus size={15} />Add candidate for this client</button>}
      {candidateError && <p role="alert" className="text-[12px] text-rose-600">{candidateError}</p>}
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-[11px] text-[var(--muted)]">Client reference<input value={clientReference} onChange={(event) => setClientReference(event.target.value)} maxLength={100} placeholder="Optional" className={inputClass} /></label><label className="text-[11px] text-[var(--muted)]">Package name<input value={packageName} onChange={(event) => setPackageName(event.target.value)} maxLength={150} className={inputClass} /></label></div>
    </div>;

    if (step === 3) return <div className="space-y-4">
      <div><h3 className="text-[16px] font-semibold">Select verification checks</h3><p className="mt-1 text-[12px] text-[var(--muted)]">Choose the checks required for this case. You can revise these later.</p></div>
      <div className="grid gap-2 sm:grid-cols-2">{checkTypes.map((item) => {
        const selected = selectedChecks.includes(item.type);
        return <label key={item.type} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${selected ? 'border-[var(--primary)]/45 bg-[var(--primary)]/[0.06]' : 'border-[var(--border)] hover:bg-[var(--surface-muted)]'}`}>
          <input type="checkbox" checked={selected} onChange={() => toggleCheck(item.type)} className="mt-0.5 accent-[var(--primary)]" />
          <span className="min-w-0"><span className="block text-[12px] font-semibold text-[var(--foreground)]">{item.label}</span><span className="mt-0.5 block text-[10.5px] leading-4 text-[var(--muted)]">{item.description}</span><span className="mt-1 block text-[9px] font-semibold uppercase tracking-wide text-[var(--muted)]">{item.provider === 'SUREPASS' ? 'Provider check' : 'Manual review'}</span></span>
        </label>;
      })}</div>
      <p className="text-[11px] text-[var(--muted)]">{selectedChecks.length} check{selectedChecks.length === 1 ? '' : 's'} selected</p>
    </div>;

    return <div className="space-y-5">
      <div><h3 className="text-[16px] font-semibold">Review case</h3><p className="mt-1 text-[12px] text-[var(--muted)]">Confirm the details before creating or saving the draft.</p></div>
      <dl className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 sm:grid-cols-2"><div><dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Client</dt><dd className="mt-1 text-[13px] font-medium">{selectedClient?.name || initialDraft?.client?.name || 'Not selected'}</dd></div><div><dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Candidate</dt><dd className="mt-1 text-[13px] font-medium">{selectedCandidate ? `${selectedCandidate.firstName} ${selectedCandidate.lastName}` : `${initialDraft?.candidate?.firstName || ''} ${initialDraft?.candidate?.lastName || ''}`}</dd></div><div><dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Package</dt><dd className="mt-1 text-[13px]">{packageName || 'Not specified'}</dd></div><div><dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Client reference</dt><dd className="mt-1 text-[13px]">{clientReference || 'Not specified'}</dd></div></dl>
      <section><h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Selected checks ({selectedChecks.length})</h4>{selectedChecks.length ? <div className="flex flex-wrap gap-2">{selectedChecks.map((type) => <span key={type} className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-medium">{checkTypes.find((item) => item.type === type)?.label || type.replaceAll('_', ' ')}</span>)}</div> : <p className="text-[12px] text-rose-600">Select at least one check before creating.</p>}</section>
      <label className="block text-[11px] text-[var(--muted)]">Case notes<textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} maxLength={2000} rows={3} placeholder="Optional notes for your team" className={`${inputClass} resize-y`} /></label>
    </div>;
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5">
    <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]"><FileCheck2 size={18} /></span><div><h2 className="text-[15px] font-semibold">{initialDraft ? `Resume ${initialDraft.caseNumber}` : 'New BGV case'}</h2><p className="text-[11px] text-[var(--muted)]">{initialDraft ? 'Continue editing this saved draft.' : 'Set up a case in four short steps.'}</p></div></div>
        <button type="button" onClick={onClose} disabled={submitting} aria-label="Close wizard" className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)] disabled:opacity-50"><X size={17} /></button>
      </header>

      <nav aria-label="Case setup progress" className="grid grid-cols-4 border-b border-[var(--border)] px-4 py-3 sm:px-6">{steps.map((item, index) => {
        const itemStep = index + 1;
        const done = step > itemStep;
        return <button key={item.title} type="button" onClick={() => itemStep < step && setStep(itemStep)} disabled={itemStep > step || submitting} className="flex min-w-0 items-center gap-2 text-left disabled:cursor-default sm:gap-2.5">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${done || itemStep === step ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>{done ? <Check size={14} /> : itemStep}</span>
          <span className="min-w-0"><span className={`block truncate text-[10.5px] font-semibold sm:text-[11.5px] ${itemStep === step ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'}`}>{item.title}</span><span className="hidden text-[9.5px] text-[var(--muted)] sm:block">{item.detail}</span></span>
        </button>;
      })}</nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
        {(error || validationError) && <p role="alert" className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3.5 py-2.5 text-[12px] text-rose-600">{validationError || error}</p>}
        {loading ? <div className="flex min-h-48 items-center justify-center gap-2 text-[12px] text-[var(--muted)]"><Loader2 size={16} className="animate-spin" />Loading clients and candidates...</div> : renderStep()}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {step > 1 && <button type="button" disabled={submitting} onClick={() => { setValidationError(null); setStep((current) => Math.max(1, current - 1)); }} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-[11.5px] font-medium"><ArrowLeft size={14} />Back</button>}
          {!initialDraft && <button type="button" disabled={submitting || !clientId || !candidateId || selectedCandidateHasCase} onClick={() => save('draft')} className="rounded-lg px-3 py-2 text-[11.5px] font-semibold text-[var(--muted)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-40">Save draft</button>}
          {initialDraft && <span className="text-[10px] text-[var(--muted)]">Draft {initialDraft.caseNumber}</span>}
        </div>
        {step < 4 ? <button type="button" disabled={loading || submitting || selectedCandidateHasCase} onClick={continueStep} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[12px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50">Continue<ArrowRight size={14} /></button> : <div className="flex gap-2"><button type="button" disabled={submitting || selectedCandidateHasCase} onClick={() => save('draft')} className="rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-[11.5px] font-semibold disabled:opacity-50">{submitting ? 'Saving...' : 'Save draft'}</button><button type="button" disabled={submitting || loading || !selectedChecks.length || selectedCandidateHasCase} onClick={() => save('create')} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-[12px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50">{submitting && <Loader2 size={14} className="animate-spin" />}{submitting ? 'Creating...' : 'Create case'}</button></div>}
      </footer>
    </div>

    {candidateModalOpen && <CandidateFormModal key={clientId} mode="create" candidate={null} defaultClientId={clientId} submitting={candidateSubmitting} error={candidateError} onClose={() => setCandidateModalOpen(false)} onSubmit={handleCreateCandidate} />}
  </div>;
}