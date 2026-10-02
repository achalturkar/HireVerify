'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, CircleHelp, LoaderCircle } from 'lucide-react';
import { unsubscribeMarketingLead } from '@/src/lib/api/marketing';

export default function MarketingUnsubscribePage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center p-5 text-sm text-[var(--muted)]">Loading email preferences…</main>}>
      <MarketingUnsubscribeConfirmation />
    </Suspense>
  );
}

function MarketingUnsubscribeConfirmation() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState<'ready' | 'working' | 'done' | 'error'>('ready');
  const [message, setMessage] = useState('');

  const unsubscribe = async () => {
    setStatus('working');
    setMessage('');
    try {
      await unsubscribeMarketingLead(token);
      setStatus('done');
      setMessage('You have been removed from this marketing email list.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'The unsubscribe request could not be completed.');
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-5">
      <section className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-xl">
        <div className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${status === 'done' ? 'bg-emerald-50 text-emerald-700' : 'bg-[var(--surface-muted)] text-[var(--primary)]'}`}>
          {status === 'done' ? <CheckCircle2 size={26} /> : <CircleHelp size={26} />}
        </div>
        <h1 className="text-2xl font-semibold">Email preferences</h1>
        {status === 'done' ? (
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{message}</p>
        ) : (
          <>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Confirm that you want to stop receiving marketing emails from this sender.</p>
            {!token && <p role="alert" className="mt-4 text-sm text-red-700">This unsubscribe link is missing its verification token. Use the complete link from the email.</p>}
            {message && <p role="alert" className="mt-4 text-sm text-red-700">{message}</p>}
            <button type="button" onClick={unsubscribe} disabled={!token || status === 'working'} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50">
              {status === 'working' ? <LoaderCircle size={16} className="animate-spin" /> : null}
              {status === 'working' ? 'Processing…' : 'Confirm unsubscribe'}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
