'use client';

import { useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import api from '@/services/api';

type Props = {
  token: string;
  accent: string;
  title: string;
  description: string;
  types: string[];
  onUploaded: () => Promise<void>;
};

export default function CandidateDocumentUpload({ token, accent, title, description, types, onUploaded }: Props) {
  const [documentType, setDocumentType] = useState(types[0]);
  const [documentNumber, setDocumentNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = async () => {
    if (!file) return setMessage('Choose a file first.');
    setSaving(true); setMessage('');
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('documentType', documentType);
      body.append('documentNumber', documentNumber.trim());
      await api.post(`/candidate-portal/${token}/documents`, body);
      setFile(null); setDocumentNumber('');
      if (fileInput.current) fileInput.current.value = '';
      await onUploaded();
      setMessage('Uploaded for review.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Could not upload this document.');
    } finally { setSaving(false); }
  };

  return <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${accent}18`, color: accent }}><FileUp size={17} /></span><div><h3 className="font-semibold text-slate-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div></div><div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]"><select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">{types.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select><input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} placeholder="Number (optional)" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" /><input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setFile(event.target.files?.[0] || null)} className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /><button type="button" onClick={upload} disabled={!file || saving} className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: accent }}>{saving && <Loader2 size={15} className="animate-spin" />}Upload</button></div>{message && <p className="mt-2 text-xs text-slate-500">{message}</p>}</section>;
}
