'use client';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, limit, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-col items-center gap-2.5 border-t border-[var(--border)] px-5 py-3.5 text-[var(--muted)]">
      <p className="text-[12px]" style={{ fontFamily: 'var(--font-mono)' }}>
        {total === 0 ? 'No results' : `${from}–${to} of ${total}`}
      </p>
      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-md border border-[var(--border)] px-2.5 py-1 text-[12.5px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)] transition-colors disabled:cursor-not-allowed disabled:opacity-30"
        >
          Prev
        </button>
        <span className="text-[12.5px] text-[var(--muted)] px-2" style={{ fontFamily: 'var(--font-mono)' }}>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-md border border-[var(--border)] px-2.5 py-1 text-[12.5px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)] transition-colors disabled:cursor-not-allowed disabled:opacity-30"
        >
          Next
        </button>
      </div>
    </div>
  );
}