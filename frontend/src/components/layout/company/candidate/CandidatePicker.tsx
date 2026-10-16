'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X, ChevronDown, User, Building2, Loader2 } from 'lucide-react';
import { searchCandidates, ApiError } from '@/src/lib/api/candidates';
import { formatCandidateName } from '@/src/lib/candidate-name';
import type { CandidateOption } from '@/src/types/candidate';

interface Props {
  accessToken?: string | null;
  value: string; // candidateId, '' when nothing selected
  onChange: (candidateId: string, candidate: CandidateOption | null) => void;
  initialCandidate?: CandidateOption | null; // pre-hydrate the label without a search, e.g. from a URL param
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
}

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

export default function CandidatePicker({
  accessToken,
  value,
  onChange,
  initialCandidate = null,
  placeholder = 'Search candidates by name or email…',
  disabled,
  allowClear = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CandidateOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CandidateOption | null>(initialCandidate);
  const containerRef = useRef<HTMLDivElement>(null);

  // If a candidateId comes in as a prop but we don't have the object yet
  // (e.g. controlled from outside without initialCandidate), just trust
  // the caller supplied initialCandidate when it matters — otherwise the
  // chip shows the raw id as a fallback below.
  useEffect(() => {
    if (initialCandidate) setSelected(initialCandidate);
  }, [initialCandidate]);

  useEffect(() => {
    if (!value) setSelected(null);
  }, [value]);

  const runSearch = useCallback(
    async (q: string) => {
      setLoading(true);
      setError(null);
      try {
        const items = await searchCandidates({ search: q, limit: 20 }, accessToken);
        // Defensive: if the API ever hands back something other than an
        // array (a stale build, a shape regression, a network proxy that
        // rewrites the body, etc.), fail soft into an empty list instead
        // of crashing the whole picker on results.map() below.
        setResults(Array.isArray(items) ? items : []);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load candidates');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

//   Debounced search whenever the dropdown is open and query changes
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(t);
  }, [query, open, runSearch]);

  // Load an initial page of candidates the first time the dropdown opens
  useEffect(() => {
    if (open && results.length === 0 && !loading && !query) {
      runSearch('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (candidate: CandidateOption) => {
    setSelected(candidate);
    onChange(candidate.id, candidate);
    setOpen(false);
    setQuery('');
  };

  const clear = () => {
    setSelected(null);
    onChange('', null);
    setQuery('');
  };

  return (
    <div className="relative" ref={containerRef}>
      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] flex items-center justify-center text-[10.5px] font-semibold shrink-0">
              {initials(selected.firstName, selected.lastName)}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] text-[var(--foreground)] truncate">
                {formatCandidateName(selected)}
              </p>
              <p className="text-[11px] text-[var(--muted)] truncate flex items-center gap-1">
                {selected.client?.name && (
                  <>
                    <Building2 size={10} className="text-[var(--muted)] shrink-0" />
                    {selected.client.name}
                    <span className="text-[var(--muted)]">·</span>
                  </>
                )}
                {selected.email}
              </p>
            </div>
          </div>
          {allowClear && !disabled && (
            <button
              type="button"
              onClick={clear}
              className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-muted)] transition-colors shrink-0"
              aria-label="Clear selected candidate"
            >
              <X size={13} />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5 text-left text-[13.5px] text-[var(--muted)] hover:border-[var(--primary)]/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center gap-2">
            <User size={14} />
            {placeholder}
          </span>
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}

      {open && (
        <div className="absolute z-20 mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/10 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
            <Search size={13} className="text-[var(--muted)] shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a name or email…"
              className="w-full bg-transparent text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none"
            />
            {loading && <Loader2 size={13} className="animate-spin text-[var(--primary)] shrink-0" />}
          </div>

          <div className="max-h-64 overflow-y-auto">
            {error && <p className="px-3 py-3 text-[12.5px] text-[#FF6B6B]">{error}</p>}

            {!error && !loading && results.length === 0 && (
              <p className="px-3 py-3 text-[12.5px] text-[var(--muted)]">
                {query ? 'No candidates match that search.' : 'No candidates found.'}
              </p>
            )}

            {!error &&
              results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-[var(--surface-muted)] transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-[#F2AE55]/15 text-[#F2AE55] flex items-center justify-center text-[10.5px] font-semibold shrink-0">
                    {initials(c.firstName, c.lastName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] text-[var(--foreground)] truncate">
                      {formatCandidateName(c)}
                    </p>
                    <p className="text-[11px] text-[var(--muted)] truncate flex items-center gap-1">
                      {c.client?.name && (
                        <>
                          <Building2 size={10} className="text-[var(--muted)] shrink-0" />
                          {c.client.name}
                          <span className="text-[var(--muted)]">·</span>
                        </>
                      )}
                      {c.email}
                    </p>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}