"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FilterX,
  Search,
} from "lucide-react";
import { useAuth } from "@/src/auth/AuthProvider";
import { listAuditLogs, type AuditLog } from "@/src/lib/api/audit";

const formatAction = (action: string) =>
  action.replaceAll("_", " ").replaceAll(".", " ");
const actorName = (item: AuditLog) =>
  item.user ? `${item.user.firstName} ${item.user.lastName}`.trim() : "System";
const formatTiming = (createdAt: string) => {
  const date = new Date(createdAt);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

export default function CompanyAuditPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAuditLogs(
        {
          page,
          limit: 25,
          search: search || undefined,
          entity: entity || undefined,
          from: from || undefined,
          to: to || undefined,
        },
        accessToken,
      );
      setItems(result.items);
      setMeta(result.meta);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load company activity.",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, entity, from, page, search, to]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const updateFilter = (setter: (value: string) => void, value: string) => {
    setPage(1);
    setter(value);
  };
  const hasFilters = Boolean(search || entity || from || to);
  const clearFilters = () => {
    setPage(1);
    setSearch(""); setEntity(""); setFrom(""); setTo("");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">
            <Activity size={13} /> Live company trail
          </div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--primary)]">
            Company governance
          </p>
          <h1 className="mt-1 text-[30px] font-semibold tracking-tight">Audit activity</h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Review every recorded action across your company workspace.
          </p>
        </div>
        <div className="min-w-[170px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]"><ClipboardList size={14} className="text-[var(--primary)]" /> Total events</div>
          <p className="mt-1 text-2xl font-semibold">{meta.total}</p>
        </div>
      </div>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-[13px] font-semibold">Find an activity</p><p className="mt-0.5 text-[11px] text-[var(--muted)]">Narrow the company trail by actor, entity, or date.</p></div>{hasFilters && <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--foreground)]"><FilterX size={14} /> Clear filters</button>}</div>
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_160px_160px]">
        <label className="relative block text-[12px] text-[var(--muted)]">
          <span className="sr-only">Search activity</span>
          <Search
            size={15}
            className="absolute left-3 top-3 text-[var(--muted)]"
          />
          <input
            value={search}
            onChange={(event) => updateFilter(setSearch, event.target.value)}
            placeholder="Search actions, users, entities..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] py-2.5 pl-9 pr-3 text-[13px]"
          />
        </label>
        <select
          value={entity}
          onChange={(event) => updateFilter(setEntity, event.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[13px]"
        >
          <option value="">All entities</option>
          <option value="User">Users</option>
          <option value="Candidate">Candidates</option>
          <option value="Client">Clients</option>
          <option value="BGVCase">BGV cases</option>
          <option value="VerificationCheck">Verification checks</option>
          <option value="Company">Company</option>
        </select>
        <input
          type="date"
          value={from}
          onChange={(event) => updateFilter(setFrom, event.target.value)}
          aria-label="Activity from"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[13px]"
        />
        <input
          type="date"
          value={to}
          onChange={(event) => updateFilter(setTo, event.target.value)}
          aria-label="Activity to"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[13px]"
        />
        </div>
      </section>
      {error && (
        <div className="rounded-lg border border-[#FF6B6B]/25 bg-[#FF6B6B]/10 px-4 py-3 text-[13px] text-[#FF6B6B]">
          {error}
        </div>
      )}
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[13px]">
            <thead className="border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-5 py-3">Activity</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Entity</th>
                <th className="px-5 py-3">Reference</th>
                <th className="px-5 py-3">Timing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-14 text-center text-[var(--muted)]"
                  >
                    Loading activity...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-14 text-center text-[var(--muted)]"
                  >
                    No activity found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-[var(--surface-muted)]"
                  >
                    <td className="px-5 py-4 align-top">
                      <div className="flex items-start gap-3"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]"><Activity size={15} /></span><div className="min-w-0"><p className="font-semibold capitalize">{formatAction(item.action)}</p>
                      <p className="mt-1 max-w-[320px] truncate text-[11px] text-[var(--muted)]">
                        {item.metadata
                          ? JSON.stringify(item.metadata)
                          : "Recorded system event"}
                      </p>
                      </div></div>
                    </td>
                    <td className="px-5 py-4 align-top"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[11px] font-semibold text-[var(--muted)]">{actorName(item).slice(0, 1).toUpperCase()}</span><span className="font-medium">{actorName(item)}</span></div>
                      <p className="mt-1 text-[11px] text-[var(--muted)]">
                        {item.user?.email || "Automated event"}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top"><span className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">
                      {item.entity}
                    </span>
                    </td>
                    <td className="max-w-[190px] truncate px-5 py-4 align-top font-mono text-[11px] text-[var(--muted)]">
                      {item.entityId || "-"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 align-top"><p className="font-semibold text-[var(--foreground)]">{formatTiming(item.createdAt)}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{new Date(item.createdAt).toLocaleString()}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3 text-[12px] text-[var(--muted)]">
            <span>
            Showing {items.length} of {meta.total} events · Page {meta.page} of {meta.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1 || loading}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 disabled:opacity-40"
            >
              <ChevronLeft size={14} />
              Previous
            </button>
            <button
              type="button"
              onClick={() =>
                setPage((value) => Math.min(meta.totalPages, value + 1))
              }
              disabled={page >= meta.totalPages || loading}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 disabled:opacity-40"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
