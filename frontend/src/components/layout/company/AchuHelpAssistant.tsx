'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { Bot, MessageCircle, Send, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { findAchuAnswer, getAchuNextStep } from '@/src/lib/help/achuKnowledge';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  href?: string;
  linkLabel?: string;
  nextSteps?: string[];
}

const QUICK_QUESTIONS = ['What should I do next?', 'How do I start a BGV case?', 'How do I send a report?', 'How do I create an invoice?'];

export default function AchuHelpAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: 'assistant',
      text: 'Hi, I’m ACHU, your HireVerify guide. Ask me how to use a module or what to do next.',
      nextSteps: ['What should I do next?', 'How do I start a BGV case?'],
    },
  ]);
  const [messageId, setMessageId] = useState(1);
  const [announcement, setAnnouncement] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages, open]);

  const ask = (rawQuestion: string) => {
    const text = rawQuestion.trim();
    if (!text) return;

    const normalized = text.toLowerCase();
    const isNextQuestion = /\b(next|what now|what should i do)\b/.test(normalized);
    const answer = isNextQuestion ? getAchuNextStep(pathname) : findAchuAnswer(text);
    const nextMessageId = messageId + 2;
    const assistantMessage: ChatMessage = answer
      ? {
          id: messageId + 1,
          role: 'assistant',
          text: answer.answer,
          href: answer.href,
          linkLabel: answer.linkLabel,
          nextSteps: answer.nextSteps,
        }
      : {
          id: messageId + 1,
          role: 'assistant',
          text: 'I don’t have a confident answer for that yet. Try asking about clients, candidates, BGV cases, checks, reports, invoices, users, or settings. For account-specific help, the Help page has the support contact details.',
          href: '/company/help',
          linkLabel: 'Open Help and support',
          nextSteps: ['What should I do next?', 'How do I contact support?'],
        };

    setMessages((current) => [
      ...current,
      { id: messageId, role: 'user', text },
      assistantMessage,
    ]);
    setMessageId(nextMessageId);
    setQuestion('');
    setAnnouncement(`ACHU replied about ${answer?.title ?? 'your question'}.`);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    ask(question);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <section
          aria-label="ACHU HireVerify help assistant"
          className="mb-3 flex h-[min(620px,calc(100vh-7rem))] w-[min(390px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        >
          <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--primary)]/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)]"><Bot size={21} /></span>
              <div>
                <h2 className="text-sm font-semibold">ACHU</h2>
                <p className="text-[11px] text-[var(--muted)]">HireVerify help assistant</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close ACHU assistant" className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"><X size={17} /></button>
          </header>

          <div ref={feedRef} role="log" aria-live="polite" aria-relevant="additions" className="flex-1 space-y-3 overflow-y-auto p-3.5">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-2xl px-3 py-2.5 ${message.role === 'user' ? 'rounded-br-md bg-[var(--primary)] text-[var(--primary-foreground)]' : 'rounded-bl-md border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)]'}`}>
                  <p className="whitespace-pre-line text-[12px] leading-5">{message.text}</p>
                  {message.role === 'assistant' && message.nextSteps && (
                    <ol className="mt-2 space-y-1.5 border-t border-[var(--border)]/70 pt-2">
                      {message.nextSteps.map((step, index) => <li key={step} className="flex gap-2 text-[11px] leading-4 text-[var(--muted)]"><span className="font-semibold text-[var(--primary)]">{index + 1}.</span><span>{step}</span></li>)}
                    </ol>
                  )}
                  {message.role === 'assistant' && message.href && message.linkLabel && (
                    <Link href={message.href} onClick={() => setOpen(false)} className="mt-2 inline-flex text-[11px] font-semibold text-[var(--primary)] hover:underline">{message.linkLabel} →</Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {messages.length < 3 && (
            <div className="flex gap-2 overflow-x-auto px-3.5 pb-2">
              {QUICK_QUESTIONS.slice(0, 3).map((prompt) => (
                <button key={prompt} type="button" onClick={() => ask(prompt)} className="shrink-0 rounded-full border border-[var(--border)] px-2.5 py-1.5 text-[10px] text-[var(--muted)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]">{prompt}</button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="flex items-center gap-2 border-t border-[var(--border)] p-3">
            <label htmlFor="achu-question" className="sr-only">Ask ACHU a question</label>
            <input
              id="achu-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about a HireVerify workflow..."
              maxLength={500}
              className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[12px] outline-none focus:border-[var(--primary)]"
            />
            <button type="submit" disabled={!question.trim()} aria-label="Send question" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"><Send size={16} /></button>
          </form>
          <span className="sr-only" role="status">{announcement}</span>
          <p className="px-3 pb-2 text-center text-[9px] text-[var(--muted)]">ACHU answers from the built-in HireVerify guide; it does not access case or candidate data.</p>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? 'Close ACHU help assistant' : 'Open ACHU help assistant'}
        className="ml-auto flex h-12 items-center gap-2 rounded-full bg-[var(--primary)] px-4 text-[var(--primary-foreground)] shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
      >
        {open ? <X size={20} /> : <MessageCircle size={19} />}
        <span className="text-[13px] font-semibold">{open ? '' : 'Ask Achu'}</span>
      </button>
    </div>
  );
}
