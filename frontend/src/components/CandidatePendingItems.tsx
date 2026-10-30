'use client';

import { CheckCircle2, Clock, FileText } from 'lucide-react';
import { candidateDocumentDisplayName, isDocumentRejected } from '@/src/lib/candidate-document-display';
import { candidatePortalFileUrl } from '@/src/lib/candidate-portal-forms';

type PendingItem = { key: string; label: string; type: string };
type CandidateDocument = {
  id: string;
  documentType: string;
  documentNumber?: string | null;
  fileName: string;
  fileUrl: string;
  verificationStatus: string;
};

export default function CandidatePendingItems({
  pending,
  documents,
  candidate,
}: {
  pending: PendingItem[];
  documents: CandidateDocument[];
  candidate: object;
}) {
  const rejectedDocuments = documents.filter((document) => isDocumentRejected(document.verificationStatus));
  const context = candidate as Parameters<typeof candidateDocumentDisplayName>[1];
  const hasWork = pending.length > 0 || rejectedDocuments.length > 0;

  return (
    <div className="space-y-5">
      {!hasWork && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
          <div className="flex items-center gap-2 font-semibold"><CheckCircle2 size={17} />No pending candidate information or rejected documents.</div>
        </section>
      )}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Waiting for candidate</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">Required information, documents, and consent not yet submitted.</p>
          </div>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">{pending.length + rejectedDocuments.length} pending</span>
        </div>
        {pending.length ? (
          <ul className="divide-y divide-[var(--border)]">
            {pending.map((item) => (
              <li key={item.key} className="flex items-start gap-3 py-3 text-sm">
                {item.type === 'document' ? <FileText size={16} className="mt-0.5 shrink-0 text-[var(--muted)]" /> : <Clock size={16} className="mt-0.5 shrink-0 text-amber-600" />}
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--muted)]">No candidate submissions are currently outstanding.</p>
        )}
        {rejectedDocuments.length > 0 && (
          <ul className="mt-2 divide-y divide-[var(--border)] border-t border-[var(--border)]">
            {rejectedDocuments.map((document) => (
              <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">Re-upload {candidateDocumentDisplayName(document, context)}</p>
                  <p className="mt-0.5 text-xs text-rose-700">The uploaded file was rejected.</p>
                </div>
                <a href={candidatePortalFileUrl(document.fileUrl)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[var(--primary)] hover:underline">View file</a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
