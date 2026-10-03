"use client";

import type { PaginationMeta } from "@/src/types/user";

export function Pagination({
  meta,
  onPageChange,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  if (meta.totalPages <= 1) return null;

  return (
    <div className="mt-6 flex flex-col items-center gap-2.5 text-sm text-ink-muted">
      <span className="text-center">
        Showing page {meta.page} of {meta.totalPages} · {meta.total} results
      </span>
      <div className="flex justify-center gap-2">
        <button
          className="rounded-md border border-line px-3 py-1 disabled:opacity-40"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
        >
          Previous
        </button>
        <button
          className="rounded-md border border-line px-3 py-1 disabled:opacity-40"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}