'use client';

import { useRef, useState } from 'react';
import { UploadCloud, FileText, ExternalLink } from 'lucide-react';
import type { CandidateDocumentRef } from '@/src/types/bgvmanual';

interface Props {
  label?: string;
  documents: CandidateDocumentRef[];
  disabled?: boolean;
  onUpload: (file: File) => Promise<void>;
}

export default function FileUploadField({ label = 'Attachment', documents, disabled, onUpload }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="bg-[#1B2A5B] px-4 py-2.5">
        <p className="text-[12px] font-semibold text-white">{label}</p>
      </div>
      <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
        {documents.length === 0 ? (
          <p className="text-[12.5px] text-[var(--muted)] italic">No file attached.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {documents.map((doc) => (
              <a
                key={doc.id}
                href={doc.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--primary)] hover:underline"
              >
                <FileText size={13} /> {doc.fileName} <ExternalLink size={11} />
              </a>
            ))}
          </div>
        )}
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-[12.5px] font-semibold px-3.5 py-2 disabled:opacity-50"
        >
          <UploadCloud size={14} /> {uploading ? 'Uploading…' : 'Upload File'}
        </button>
        <input ref={inputRef} type="file" className="hidden" onChange={handleChange} disabled={disabled} />
      </div>
    </div>
  );
}