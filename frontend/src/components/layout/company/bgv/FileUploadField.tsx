'use client';

import { useEffect, useRef, useState } from 'react';
import { FileUp, Trash2, X } from 'lucide-react';
import type { VerificationCheck } from '@/src/types/bgv';
import { ApiError, deleteVerificationDocument, resolveFileUrl, uploadVerificationDocument } from '@/src/lib/api/bgv';

type DocumentRef = NonNullable<VerificationCheck['documents']>[number];

export default function FileUploadField({ check, token, onSaved }: { check: VerificationCheck; token: string | null; onSaved: (check: VerificationCheck) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocumentRef | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFile) {
      setPendingPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPendingPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const upload = async (file: File) => {
    setBusy(true); setError(null);
    try { onSaved(await uploadVerificationDocument(check.id, file, 'OTHER', token)); setPendingFile(null); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Could not upload file.'); }
    finally { setBusy(false); }
  };
  const remove = async (documentId: string) => {
    setBusy(true); setError(null);
    try { onSaved(await deleteVerificationDocument(check.id, documentId, token)); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Could not delete file.'); }
    finally { setBusy(false); }
  };

  return <>
    <div className="mt-5 border-t border-[var(--border)] pt-4">
      <div className="flex items-center justify-between gap-3"><div><p className="text-[12.5px] font-semibold">{check.type} Attachment</p><p className="text-[11.5px] italic text-[var(--muted)]">{check.documents?.length ? `${check.documents.length} file(s) attached` : 'No file attached.'}</p></div><input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) setPendingFile(file); event.target.value = ''; }} /><button type="button" disabled={busy || !!check.isLocked || !!pendingFile} onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#087BB8] px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"><FileUp size={14} />Select file</button></div>
      {pendingFile && pendingPreviewUrl && <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-[#3FDCC0]/40 bg-[#3FDCC0]/10 px-3 py-2 text-[12px]"><span className="truncate text-[var(--foreground)]">{pendingFile.name}</span><div className="flex shrink-0 items-center gap-3"><button type="button" onClick={() => setPreview({ id: 'pending', fileName: pendingFile.name, fileUrl: pendingPreviewUrl, documentType: 'OTHER', mimeType: pendingFile.type, uploadedAt: new Date().toISOString() })} className="text-[var(--primary)] hover:underline">Preview</button><button type="button" onClick={() => setPendingFile(null)} className="text-[var(--muted)]">Cancel</button><button type="button" disabled={busy} onClick={() => void upload(pendingFile)} className="rounded-md bg-[#087BB8] px-2.5 py-1.5 font-semibold text-white disabled:opacity-50">{busy ? 'Uploading...' : 'Upload file'}</button></div></div>}
      {check.documents?.map((file) => <div key={file.id} className="mt-2 flex items-center justify-between gap-2 rounded-md bg-[var(--surface-muted)] px-3 py-2 text-[12px]"><span className="truncate">{file.fileName}</span><div className="flex shrink-0 items-center gap-3"><button type="button" onClick={() => setPreview(file)} className="text-[var(--primary)] hover:underline">Preview</button><button type="button" disabled={busy || !!check.isLocked} onClick={() => void remove(file.id)} aria-label={`Delete ${file.fileName}`} className="text-[#FF6B6B] disabled:opacity-50"><Trash2 size={14} /></button></div></div>)}
      {error && <p className="mt-2 text-[12px] text-[#FF6B6B]">{error}</p>}
    </div>
    {preview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={`Preview ${preview.fileName}`}><div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-[var(--surface)]"><div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3"><p className="truncate text-[13px] font-semibold">{preview.fileName}</p><button type="button" onClick={() => setPreview(null)} aria-label="Close preview"><X size={18} /></button></div><div className="flex min-h-[50vh] items-center justify-center overflow-auto bg-[var(--surface-muted)] p-4">{preview.mimeType?.startsWith('image/') ? <img src={resolveFileUrl(preview.fileUrl)} alt={preview.fileName} className="max-h-[70vh] max-w-full object-contain" /> : <iframe src={resolveFileUrl(preview.fileUrl)} title={preview.fileName} className="h-[70vh] w-full bg-white" />}</div></div></div>}
  </>;
}
