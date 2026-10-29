'use client';

import { useMemo, useState } from 'react';
import { Download, FileCheck2, FileJson, Loader2, Search, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { ApiError, downloadStandaloneVerificationPdf, verifyStandalone, type StandaloneVerificationResponse, type StandaloneVerificationType } from '@/src/lib/api/bgv';

type Field = { key: string; label: string; placeholder: string; type?: string };

type CheckConfig = { type: StandaloneVerificationType; label: string; description: string; fields: Field[] };

const checks: CheckConfig[] = [
  { type: 'PAN', label: 'PAN verification', description: 'Verify a PAN number and display the provider response.', fields: [{ key: 'pan', label: 'PAN number', placeholder: 'ABCDE1234F' }] },
  { type: 'UAN', label: 'UAN verification', description: 'Verify a 12 digit UAN number and display employment data returned by the provider.', fields: [{ key: 'uan', label: 'UAN number', placeholder: '100276853285' }] },
  { type: 'ADDRESS', label: 'Address verification', description: 'Use the PAN identifier configured for your Surepass address endpoint.', fields: [{ key: 'pan', label: 'PAN number', placeholder: 'ABCDE1234F' }] },
  { type: 'COURT', label: 'Court search', description: 'Search court records using the PAN identifier configured for your provider endpoint.', fields: [{ key: 'pan', label: 'PAN number', placeholder: 'ABCDE1234F' }] },
  { type: 'POLICE_RECORD', label: 'Police record', description: 'Run the configured police or court provider search using PAN.', fields: [{ key: 'pan', label: 'PAN number', placeholder: 'ABCDE1234F' }] },
  { type: 'DOCUMENT', label: 'Document verification', description: 'Send the document reference fields required by your configured provider endpoint.', fields: [{ key: 'documentNumber', label: 'Document number', placeholder: 'Document number' }, { key: 'documentType', label: 'Document type', placeholder: 'Aadhaar, passport, driving licence...' }] },
];

function collectImageUrls(value: unknown, result: string[] = []) {
  if (typeof value === 'string' && /^(https?:|data:image\/)/i.test(value)) result.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectImageUrls(item, result));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => collectImageUrls(item, result));
  return result;
}

function formatHumanValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Not available';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatAddress(data: Record<string, unknown> | null | undefined) {
  if (!data || typeof data !== 'object') return 'Not available';
  const address = data as Record<string, unknown>;
  const parts = [
    address.full,
    address.line1,
    address.line2,
    address.streetName || address.street_name,
    [address.city, address.state, address.zip].filter(Boolean).join(', '),
    address.country,
  ].filter(Boolean);
  return parts.length ? parts.join(' • ') : 'Not available';
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function DocumentVerificationPage() {
  const { accessToken } = useAuth();
  const [activeType, setActiveType] = useState<StandaloneVerificationType>('PAN');
  const [apiVersion, setApiVersion] = useState<'v1' | 'v2'>('v1');
  const [values, setValues] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<StandaloneVerificationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const config = useMemo(() => checks.find((item) => item.type === activeType) || checks[0], [activeType]);
  const imageUrls = response ? collectImageUrls(response.resultData) : [];
  const rawPanDetails = activeType === 'PAN' && response && typeof response.resultData.rawPanDetails === 'object' && response.resultData.rawPanDetails ? response.resultData.rawPanDetails as Record<string, unknown> : null;
  const panSummary = activeType === 'PAN' && response ? {
    fullName: (response.resultData.fullName as string | undefined) || (rawPanDetails?.full_name as string | undefined) || 'Not available',
    panNumber: (response.resultData.panNumber as string | undefined) || (rawPanDetails?.pan_number as string | undefined) || 'Not available',
    dob: (response.resultData.dob as string | undefined) || (rawPanDetails?.dob as string | undefined) || 'Not available',
    gender: (response.resultData.gender as string | undefined) || (rawPanDetails?.gender as string | undefined) || 'Not available',
    email: (response.resultData.email as string | undefined) || (rawPanDetails?.email as string | undefined) || 'Not available',
    phoneNumber: (response.resultData.phoneNumber as string | undefined) || (rawPanDetails?.phone_number as string | undefined) || 'Not available',
    category: (response.resultData.category as string | undefined) || (rawPanDetails?.category as string | undefined) || 'Not available',
    aadhaarLinked: response.resultData.aadhaarLinked ?? rawPanDetails?.aadhaar_linked ?? null,
    address: formatAddress(response.resultData.address as Record<string, unknown> | null | undefined),
  } : null;

  const updateType = (type: StandaloneVerificationType) => {
    setActiveType(type);
    setValues({});
    setResponse(null);
    setError(null);
  };

  const verify = async () => {
    const missing = config.fields.find((field) => !values[field.key]?.trim());
    if (missing) return setError(`${missing.label} is required.`);
    setLoading(true);
    setError(null);
    try {
      setResponse(await verifyStandalone(activeType, values, apiVersion, accessToken));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Provider verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    setPdfLoading(true);
    setError(null);
    try {
      const blob = await downloadStandaloneVerificationPdf(activeType, values, apiVersion, accessToken);
      downloadBlob(blob, `${activeType.toLowerCase()}-verification.pdf`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  return <div className="mx-auto max-w-7xl space-y-6">
    <header>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--primary)]"><ShieldCheck size={14} /> Provider workspace</div>
      <h1 className="text-[28px] font-semibold tracking-tight">Document verification</h1>
      <p className="mt-1 text-[13px] text-[var(--muted)]">Run a standalone third-party verification using only the required number or document details. No candidate, client, or BGV case is required.</p>
    </header>

    <div className="overflow-x-auto border-b border-[var(--border)]"><div className="flex min-w-max gap-1">{checks.map((item) => <button key={item.type} type="button" onClick={() => updateType(item.type)} className={`inline-flex items-center gap-2 rounded-t-lg px-4 py-3 text-[12px] font-semibold ${activeType === item.type ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]' : 'text-[var(--muted)] hover:bg-[var(--surface-muted)]'}`}><FileCheck2 size={14} />{item.label}</button>)}</div></div>

    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-5 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]"><Search size={18} /></span><div><h2 className="text-[16px] font-semibold">{config.label}</h2><p className="mt-1 text-[12.5px] leading-5 text-[var(--muted)]">{config.description}</p></div></div>
      <div className="grid gap-4 md:grid-cols-[1fr_150px_auto] md:items-end">
        {config.fields.map((field) => <label key={field.key} className="text-[12px] font-medium text-[var(--muted)]">{field.label}<input type={field.type || 'text'} value={values[field.key] || ''} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[13px] text-[var(--foreground)]" /></label>)}
        <label className="text-[12px] font-medium text-[var(--muted)]">API version<select value={apiVersion} onChange={(event) => setApiVersion(event.target.value as 'v1' | 'v2')} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[13px] text-[var(--foreground)]"><option value="v1">v1</option><option value="v2">v2</option></select></label>
        <button type="button" onClick={verify} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2.5 text-[13px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50">{loading && <Loader2 size={15} className="animate-spin" />}Verify</button>
      </div>
      {error && <p className="mt-4 rounded-lg border border-[#FF6B6B]/25 bg-[#FF6B6B]/10 px-3 py-2.5 text-[12.5px] text-[#FF6B6B]">{error}</p>}
    </section>

    {response && <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Provider response</p>
            <p className="mt-1 text-2xl font-semibold">{response.result.replaceAll('_', ' ')}</p>
          </div>
          <button type="button" onClick={downloadPdf} disabled={pdfLoading} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-[12px] font-semibold disabled:opacity-50">{pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}Download PDF</button>
        </div>

        {panSummary && <div className="mb-5 rounded-2xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">PAN verification status</p>
              <h3 className="mt-1 text-xl font-semibold text-[var(--foreground)]">{panSummary.fullName}</h3>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${response.result === 'VERIFIED' ? 'bg-emerald-500/15 text-emerald-600' : response.result === 'NOT_VERIFIED' ? 'bg-rose-500/15 text-rose-600' : 'bg-amber-500/15 text-amber-600'}`}>{response.result.replaceAll('_', ' ')}</span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-[var(--surface-muted)] p-3"><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">PAN</p><p className="mt-1 font-medium">{panSummary.panNumber}</p></div>
            <div className="rounded-xl bg-[var(--surface-muted)] p-3"><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">DOB</p><p className="mt-1 font-medium">{panSummary.dob}</p></div>
            <div className="rounded-xl bg-[var(--surface-muted)] p-3"><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Gender</p><p className="mt-1 font-medium">{panSummary.gender}</p></div>
            <div className="rounded-xl bg-[var(--surface-muted)] p-3"><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Aadhaar linked</p><p className="mt-1 font-medium">{formatHumanValue(panSummary.aadhaarLinked)}</p></div>
            <div className="rounded-xl bg-[var(--surface-muted)] p-3 sm:col-span-2 xl:col-span-2"><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Email</p><p className="mt-1 break-all font-medium">{panSummary.email}</p></div>
            <div className="rounded-xl bg-[var(--surface-muted)] p-3 sm:col-span-2 xl:col-span-2"><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Phone</p><p className="mt-1 break-all font-medium">{panSummary.phoneNumber}</p></div>
            <div className="rounded-xl bg-[var(--surface-muted)] p-3 sm:col-span-2"><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Category</p><p className="mt-1 font-medium">{panSummary.category}</p></div>
            <div className="rounded-xl bg-[var(--surface-muted)] p-3 sm:col-span-2"><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Address</p><p className="mt-1 text-sm leading-5">{panSummary.address}</p></div>
          </div>
        </div>}

        <div className="mb-4 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-[var(--surface-muted)] p-3"><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Request ID</p><p className="mt-1 break-all font-mono text-[12px]">{response.providerRequestId || 'Not returned'}</p></div><div className="rounded-lg bg-[var(--surface-muted)] p-3"><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Reference ID</p><p className="mt-1 break-all font-mono text-[12px]">{response.providerReferenceId || 'Not returned'}</p></div></div><div className="flex items-center gap-2 border-b border-[var(--border)] pb-2 text-[12px] font-semibold"><FileJson size={15} className="text-[var(--primary)]" />Formatted JSON response</div><pre className="mt-3 max-h-[620px] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-[11px] leading-5">{JSON.stringify(response.resultData, null, 2)}</pre></div>
      {imageUrls.length > 0 && <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Returned document images</p><div className="mt-4 space-y-4">{imageUrls.map((url) => <img key={url} src={url} alt="Document returned by provider" className="max-h-[420px] w-full rounded-lg border border-[var(--border)] object-contain" />)}</div></div>}
    </section>}
  </div>;
}
