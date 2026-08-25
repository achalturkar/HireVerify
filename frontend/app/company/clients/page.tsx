'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Building2,
  Mail,
  Phone,
  Power,
  PowerOff,
  Globe,
  Eye,
} from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import ClientFormModal from '@/src/components/layout/company/client/ClientFormModal';
import ClientConfirmDialog from '@/src/components/layout/company/client/ClientConfirmDialog';
// Clicking a client now navigates to the full detail page (/clients/[id]),
// which has an Overview tab covering what this modal used to show plus a
// Candidates tab — so the modal is no longer used here.
// import ClientViewModal from '@/src/components/layout/company/client/ClientViewModal';
import {
  listClients,
  createClient,
  updateClient,
  deleteClient,
  activateClient,
  inactivateClient,
  ApiError,
} from '@/src/lib/api/clients';
// import { listCompanyOptions } from '@/src/lib/api/users';
import type { Client, ClientFormValues, ClientStatus, PaginationMeta, CompanyRef } from '@/src/types/client';

const PAGE_SIZE = 10;

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// The backend's logoUrl validator only accepts an absolute external URL
// (or our own internal /uploads/... path, which we deliberately never
// re-send — see handleSubmit). Anything the user typed that isn't a real
// http(s) URL would otherwise 400 the whole update, so we filter it out
// client-side too instead of relying on the server alone to catch it.
function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function StatusBadge({ status }: { status: ClientStatus }) {
  const styles: Record<ClientStatus, string> = {
    ACTIVE: 'bg-[var(--primary)]/15 text-[var(--primary)]',
    INACTIVE: 'bg-[var(--muted)]/20 text-[var(--muted)]',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

export default function ClientsPage() {
  const { user: currentUser, accessToken } = useAuth();
  const router = useRouter();
  const isSuperAdmin = Boolean(currentUser?.role?.isSuperAdmin);

  const [clients, setClients] = useState<Client[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ClientStatus | ''>('');

  const [companies, setCompanies] = useState<CompanyRef[]>([]);

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [statusTarget, setStatusTarget] = useState<{ client: Client; next: ClientStatus } | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const [banner, setBanner] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await listClients(
        {
          page,
          limit: PAGE_SIZE,
          search,
          status,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
        accessToken
      );
      setClients(res.items);
      setMeta(res.meta);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, accessToken]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // useEffect(() => {
  //   if (isSuperAdmin) {
  //     listCompanyOptions()
  //       .then(setCompanies)
  //       .catch(() => setCompanies([]));
  //   }
  // }, [isSuperAdmin]);

  useEffect(() => {
    if (banner) {
      const t = setTimeout(() => setBanner(null), 6000);
      return () => clearTimeout(t);
    }
  }, [banner]);

  const openCreate = () => {
    setFormError(null);
    setActiveClient(null);
    setModalMode('create');
  };

  const openEdit = (client: Client) => {
    setFormError(null);
    setActiveClient(client);
    setModalMode('edit');
  };

  const goToDetail = (client: Client) => {
    router.push(`/company/clients/${client.id}`);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalMode(null);
    setActiveClient(null);
    setFormError(null);
  };

  const handleSubmit = async (values: ClientFormValues, logoFile: File | null) => {
    setSubmitting(true);
    setFormError(null);
    try {
      const payload = new FormData();
      payload.append('clientCode', values.clientCode.trim());
      payload.append('name', values.name.trim());

      if (!logoFile && values.logoUrl.trim() && isAbsoluteUrl(values.logoUrl)) {
        payload.append('logoUrl', values.logoUrl.trim());
      }

      if (values.website.trim()) payload.append('website', values.website.trim());
      if (values.industry.trim()) payload.append('industry', values.industry.trim());
      if (values.contactName.trim()) payload.append('contactName', values.contactName.trim());
      if (values.contactEmail.trim()) payload.append('contactEmail', values.contactEmail.trim());
      if (values.contactPhone.trim()) payload.append('contactPhone', values.contactPhone.trim());
      if (values.gstNumber.trim()) payload.append('gstNumber', values.gstNumber.trim());
      if (values.panNumber.trim()) payload.append('panNumber', values.panNumber.trim());
      if (values.addressLine1.trim()) payload.append('addressLine1', values.addressLine1.trim());
      if (values.addressLine2.trim()) payload.append('addressLine2', values.addressLine2.trim());
      if (values.city.trim()) payload.append('city', values.city.trim());
      if (values.state.trim()) payload.append('state', values.state.trim());
      if (values.country.trim()) payload.append('country', values.country.trim());
      if (values.postalCode.trim()) payload.append('postalCode', values.postalCode.trim());
      if (logoFile) payload.append('logo', logoFile);

      if (modalMode === 'create') {
        if (isSuperAdmin) payload.append('companyId', values.companyId);
        else payload.append('companyId', currentUser?.companyId ?? '');

        const created = await createClient(payload, accessToken);
        setBanner({ text: `Client "${created.name}" was created.`, tone: 'success' });
      } else if (activeClient) {
        const updated = await updateClient(activeClient.id, payload, accessToken);
        setBanner({ text: `Client "${updated.name}" was updated.`, tone: 'success' });
      }
      setModalMode(null);
      setActiveClient(null);
      fetchClients();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteClient(deleteTarget.id, accessToken);
      setBanner({ text: `Client "${deleteTarget.name}" was deleted.`, tone: 'success' });
      setDeleteTarget(null);
      fetchClients();
    } catch (err) {
      setBanner({
        text: err instanceof ApiError ? err.message : 'Failed to delete client.',
        tone: 'error',
      });
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!statusTarget) return;
    setTogglingStatus(true);
    try {
      if (statusTarget.next === 'ACTIVE') {
        await activateClient(statusTarget.client.id, accessToken);
      } else {
        await inactivateClient(statusTarget.client.id, accessToken);
      }
      setBanner({
        text: `Client "${statusTarget.client.name}" is now ${statusTarget.next.toLowerCase()}.`,
        tone: 'success',
      });
      setStatusTarget(null);
      fetchClients();
    } catch (err) {
      setBanner({
        text: err instanceof ApiError ? err.message : 'Failed to update client status.',
        tone: 'error',
      });
      setStatusTarget(null);
    } finally {
      setTogglingStatus(false);
    }
  };

  const rangeLabel = useMemo(() => {
    if (meta.total === 0) return '0 clients';
    const start = (meta.page - 1) * meta.limit + 1;
    const end = Math.min(meta.page * meta.limit, meta.total);
    return `${start}–${end} of ${meta.total}`;
  }, [meta]);

  return (
    <div className="max-w-6xl mx-auto space-y-7">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p
            className="text-[11px] uppercase tracking-[0.14em] text-[var(--primary)] mb-1.5"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Client Management
          </p>
          <h1 className="text-[26px] font-semibold tracking-tight text-[var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
            Clients
          </h1>
          <p className="text-[13.5px] text-[var(--muted)] mt-1">Manage company clients and their status</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="rounded-2xl bg-[var(--surface)] px-4 py-3 text-[13px] text-[var(--foreground)] border border-[var(--border)]">
            <span className="block text-[11px] text-[var(--muted)]">Total clients</span>
            <span className="text-[20px] font-semibold">{meta.total}</span>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-[13px] font-semibold px-4 py-2.5 hover:bg-[var(--primary)]/90 transition-colors shrink-0"
          >
            <Plus size={14} strokeWidth={2.5} />
            Add client
          </button>
        </div>
      </div>

      {/* Banner */}
      {banner && (
        <div
          className={`rounded-xl border px-4 py-3 text-[13px] flex items-center justify-between ${
            banner.tone === 'success'
              ? 'bg-[var(--primary)]/10 border-[var(--primary)]/25 text-[var(--primary)]'
              : 'bg-[#FF6B6B]/10 border-[#FF6B6B]/25 text-[#FF6B6B]'
          }`}
        >
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100 ml-3">
            ✕
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
            <Search size={15} />
          </span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, code, or contact…"
            className="w-full rounded-lg bg-[var(--surface)] border border-[var(--border)] pl-9 pr-3 py-2.5 text-[13.5px] text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/30 transition-colors"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ClientStatus | '');
            setPage(1);
          }}
          className="rounded-lg bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5 text-[13px] text-[var(--muted)] outline-none focus:border-[var(--primary)]/50 transition-colors"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-left">
            <thead>
              <tr
                className="text-[11px] uppercase tracking-wide text-[var(--muted)] border-b border-[var(--border)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                {isSuperAdmin && <th className="px-5 py-3 font-medium">Company</th>}
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={isSuperAdmin ? 6 : 5} className="px-5 py-10 text-center text-[13px] text-[var(--muted)]">
                    Loading clients…
                  </td>
                </tr>
              )}

              {!loading && loadError && (
                <tr>
                  <td colSpan={isSuperAdmin ? 6 : 5} className="px-5 py-10 text-center text-[13px] text-[#FF6B6B]">
                    {loadError}
                  </td>
                </tr>
              )}

              {!loading && !loadError && clients.length === 0 && (
                <tr>
                  <td colSpan={isSuperAdmin ? 6 : 5} className="px-5 py-10 text-center text-[13px] text-[var(--muted)]">
                    No clients match these filters.
                  </td>
                </tr>
              )}

              {!loading &&
                !loadError &&
                clients.map((c, i) => (
                  <tr
                    key={c.id}
                    onClick={() => goToDetail(c)}
                    className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)] cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {c.logoUrl ? (
                          <img
                            src={c.logoUrl}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover shrink-0 bg-[var(--surface-muted)]"
                          />
                        ) : (
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${
                              i % 2 === 0 ? 'bg-[var(--primary)]/15 text-[var(--primary)]' : 'bg-[#F2AE55]/15 text-[#F2AE55]'
                            }`}
                          >
                            {initials(c.name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[13.5px] text-[var(--foreground)] truncate">{c.name}</p>
                          <p
                            className="text-[11.5px] text-[var(--muted)] truncate"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            {c.clientCode}
                            {c.industry ? ` · ${c.industry}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[12.5px] text-[var(--muted)]">
                      {c.contactName && <p className="text-[13px] text-[var(--foreground)]">{c.contactName}</p>}
                      {c.contactEmail && (
                        <p className="flex items-center gap-1.5 text-[var(--muted)]">
                          <Mail size={11} /> {c.contactEmail}
                        </p>
                      )}
                      {c.contactPhone && (
                        <p className="flex items-center gap-1.5 text-[var(--muted)]">
                          <Phone size={11} /> {c.contactPhone}
                        </p>
                      )}
                      {!c.contactName && !c.contactEmail && !c.contactPhone && <span>—</span>}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-5 py-3 text-[13px] text-[var(--muted)]">
                        <span className="flex items-center gap-1.5">
                          <Building2 size={12} className="text-[var(--muted)]" />
                          {c.company?.name ?? '—'}
                        </span>
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-5 py-3 text-[12.5px] text-[var(--muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                      {new Date(c.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => goToDetail(c)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-muted)] transition-colors"
                          aria-label={`View ${c.name}`}
                        >
                          <Eye size={13} />
                        </button>
                        {c.website && (
                          <a
                            href={c.website}
                            target="_blank"
                            rel="noreferrer"
                            className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-muted)] transition-colors"
                            aria-label={`Visit ${c.name} website`}
                          >
                            <Globe size={13} />
                          </a>
                        )}
                        <button
                          onClick={() =>
                            setStatusTarget({ client: c, next: c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })
                          }
                          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                            c.status === 'ACTIVE'
                              ? 'text-[var(--muted)] hover:text-[#F2AE55] hover:bg-[#F2AE55]/10'
                              : 'text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10'
                          }`}
                          aria-label={c.status === 'ACTIVE' ? `Deactivate ${c.name}` : `Activate ${c.name}`}
                        >
                          {c.status === 'ACTIVE' ? <PowerOff size={13} /> : <Power size={13} />}
                        </button>
                        <button
                          onClick={() => openEdit(c)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
                          aria-label={`Edit ${c.name}`}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--muted)] hover:text-[#FF6B6B] hover:bg-[#FF6B6B]/10 transition-colors"
                          aria-label={`Delete ${c.name}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[var(--border)]">
          <p className="text-[12px] text-[var(--muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
            {rangeLabel}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={meta.page <= 1 || loading}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--muted)] border border-[var(--border)] hover:bg-[var(--surface-muted)] transition-colors disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[12.5px] text-[var(--muted)] px-2" style={{ fontFamily: 'var(--font-mono)' }}>
              {meta.page} / {Math.max(1, meta.totalPages)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages || 1, p + 1))}
              disabled={meta.page >= meta.totalPages || loading}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--muted)] border border-[var(--border)] hover:bg-[var(--surface-muted)] transition-colors disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {modalMode && (
        <ClientFormModal
          mode={modalMode}
          client={activeClient}
          companies={companies}
          isSuperAdmin={isSuperAdmin}
          submitting={submitting}
          error={formError}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}

      {deleteTarget && (
        <ClientConfirmDialog
          title="Delete client?"
          description={`This will soft-delete "${deleteTarget.name}" (${deleteTarget.clientCode}) and mark it inactive. This can be restored later if needed.`}
          confirmLabel="Delete client"
          tone="danger"
          submitting={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {statusTarget && (
        <ClientConfirmDialog
          title={statusTarget.next === 'ACTIVE' ? 'Activate client?' : 'Deactivate client?'}
          description={
            statusTarget.next === 'ACTIVE'
              ? `"${statusTarget.client.name}" will be marked active again.`
              : `"${statusTarget.client.name}" will be marked inactive.`
          }
          confirmLabel={statusTarget.next === 'ACTIVE' ? 'Activate' : 'Deactivate'}
          tone={statusTarget.next === 'ACTIVE' ? 'default' : 'danger'}
          submitting={togglingStatus}
          onConfirm={handleToggleStatus}
          onCancel={() => setStatusTarget(null)}
        />
      )}
    </div>
  );
}