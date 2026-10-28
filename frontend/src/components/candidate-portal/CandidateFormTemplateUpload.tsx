'use client';

import { useRef, useState } from 'react';
import { Download, ExternalLink, FileUp, Loader2, Trash2 } from 'lucide-react';
import api from '@/services/api';
import { candidatePortalFileUrl } from '@/src/lib/candidate-portal-forms';

type FormDocument = {
  id: string;
  documentNumber?: string | null;
  fileName: string;
  fileUrl?: string;
  verificationStatus: string;
  uploadedAt: string;
};

type Props = {
  token: string;
  accent: string;
  form: { id: string; name: string; required: boolean; fileName: string };
  documents: FormDocument[];
  onUploaded: () => Promise<void>;
  readOnly?: boolean;
  downloadOnly?: boolean;
  downloadAvailable?: boolean;
  uploadAvailable?: boolean;
};

export default function CandidateFormTemplateUpload({ token, accent, form, documents, onUploaded, readOnly = false, downloadOnly = false, downloadAvailable = true, uploadAvailable = true }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const completedDocument = documents.find((document) => document.documentNumber === `CUSTOM_FORM:${form.id}`);

  const download = async () => {
    setDownloading(true);
    setMessage('');
    try {
      const response = await api.get(`/candidate-portal/${token}/forms/${form.id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = form.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error: unknown) {
      let responseMessage = '';
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = error.response;
        if (typeof response === 'object' && response !== null && 'data' in response) {
          const data = response.data;
          if (data instanceof Blob) {
            const responseText = await data.text();
            try {
              const payload: unknown = JSON.parse(responseText);
              if (typeof payload === 'object' && payload !== null && 'message' in payload && typeof payload.message === 'string') {
                responseMessage = payload.message;
              }
            } catch {
              responseMessage = '';
            }
          } else if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
            responseMessage = data.message;
          }
        }
      }
      setMessage(responseMessage || 'Could not download the blank form. Refresh the portal and try again.');
    } finally {
      setDownloading(false);
    }
  };

  const upload = async () => {
    if (!file) {
      setMessage('Choose your completed form first.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage('Choose a file that is 10 MB or smaller.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('documentType', 'OTHER');
      body.append('customFormId', form.id);
      await api.post(`/candidate-portal/${token}/documents`, body);
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      await onUploaded();
      setMessage('Completed form uploaded for review.');
    } catch (error: unknown) {
      let responseMessage = '';
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = error.response;
        if (typeof response === 'object' && response !== null && 'data' in response) {
          const data = response.data;
          if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
            responseMessage = data.message;
          }
        }
      }
      setMessage(responseMessage || 'Could not upload this completed form.');
    } finally {
      setSaving(false);
    }
  };

  const removeUpload = async () => {
    if (!completedDocument) return;
    if (!window.confirm(`Delete the uploaded file "${completedDocument.fileName}"? You can upload another file afterward.`)) return;
    setDeleting(true);
    setMessage('');
    try {
      await api.delete(`/candidate-portal/${token}/documents/${encodeURIComponent(completedDocument.id)}`);
      await onUploaded();
      setMessage('Uploaded form deleted. You can upload another file.');
    } catch (error: unknown) {
      let responseMessage = '';
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = error.response;
        if (typeof response === 'object' && response !== null && 'data' in response) {
          const data = response.data;
          if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
            responseMessage = data.message;
          }
        }
      }
      setMessage(responseMessage || 'Could not delete the uploaded form.');
    } finally {
      setDeleting(false);
    }
  };

  if (downloadOnly) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{form.name}{form.required && <><span className="ml-1 text-red-600">*</span><span className="sr-only"> required</span></>}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {completedDocument ? `Uploaded: ${completedDocument.fileName}` : form.required ? 'Required: download, complete and upload this form.' : 'Optional: download and return this form if requested.'}
          </p>
        </div>
        {downloadAvailable && (
          <button type="button" onClick={() => void download()} disabled={downloading} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {downloading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
            Download blank form
          </button>
        )}
        {message && <p role="status" className="w-full text-xs text-red-600">{message}</p>}
      </li>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{form.name}{form.required && <span className="ml-1 text-red-600">*</span>}</h3>
          {completedDocument ? (
            <div className="mt-1 space-y-0.5 text-xs">
              <p className="font-medium text-emerald-700">Uploaded</p>
              <p className="break-all text-slate-500">{completedDocument.fileName}</p>
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-500">{form.required ? 'Download, complete and upload this required form.' : 'Download and return this form if requested.'}</p>
          )}
          {completedDocument && (
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              {completedDocument.fileUrl && (
                <a href={candidatePortalFileUrl(completedDocument.fileUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline">
                  View uploaded form <ExternalLink size={12} aria-hidden="true" />
                </a>
              )}
              {!readOnly && (
                <button type="button" onClick={() => void removeUpload()} disabled={deleting || saving} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
                  {deleting ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Trash2 size={12} aria-hidden="true" />}
                  Delete uploaded form
                </button>
              )}
            </div>
          )}
        </div>
        {downloadAvailable && (
          <button type="button" onClick={() => void download()} disabled={downloading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {downloading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
            Download blank form
          </button>
        )}
      </div>
      {readOnly ? <p className="mt-4 text-xs text-slate-500">Uploads are locked after the verification case is completed or cancelled.</p> : completedDocument || !uploadAvailable ? (
        !completedDocument && <p className="mt-4 text-xs text-slate-500">This form is not currently enabled for upload.</p>
      ) : <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="min-w-0 flex-1">
          <input ref={fileInput} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.ms-word,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,.jpg,.jpeg,image/png,.png" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
          <p className="mt-1 text-xs text-slate-500">PDF, DOC, DOCX, JPG or PNG, up to 10 MB. File contents are checked against the file type.</p>
        </div>
        <button type="button" onClick={() => void upload()} disabled={!file || saving} className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: accent }}>
          {saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <FileUp size={15} aria-hidden="true" />}
          Upload completed form
        </button>
      </div>}
      {message && <p role="status" className="mt-2 text-xs text-slate-500">{message}</p>}
    </section>
  );
}
