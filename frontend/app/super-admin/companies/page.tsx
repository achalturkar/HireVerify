'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import { useAuth } from '@/src/auth/AuthProvider';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
});
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-mono',
});

// ---------- Types ----------
type CompanyStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

interface Company {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  contactPhone: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  address: string | null;
  settings: Record<string, unknown>;
  status: CompanyStatus;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  admin: { firstName: string; lastName: string; email: string } | null;
}

interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface CreateCompanyForm {
  name: string;
  slug: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword: string;
}

interface FieldErrors {
  [key: string]: string | undefined;
}

const emptyForm: CreateCompanyForm = {
  name: '',
  slug: '',
  contactEmail: '',
  contactPhone: '',
  address: '',
  adminFirstName: '',
  adminLastName: '',
  adminEmail: '',
  adminPassword: '',
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API ||
  '/api/v1';
const MAX_LOGO_SIZE_BYTES = 500 * 1024;
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];

function getLogoValidationError(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const hasAllowedExtension = ['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(extension || '');
  const hasAllowedMime = ALLOWED_LOGO_TYPES.includes(file.type);
  if (!hasAllowedExtension || !hasAllowedMime) {
    return 'Only JPG, PNG, WEBP, or SVG images are allowed.';
  }
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return 'Logo image must be 500 KB or smaller.';
  }
  return null;
}

// The API wraps everything as { success, message: "Success", data: { message, data, meta? } }
// so every response body needs one extra level of unwrapping before you get to the real payload.
async function apiFetch(path: string, token: string | null, init?: RequestInit) {
  const headers = new Headers(init?.headers || {});
  if (!(init?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  } else {
    headers.delete('Content-Type');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload || payload.success === false) {
    const inner = payload?.message;
    const message =
      (typeof inner === 'object' && inner?.message) ||
      (typeof inner === 'string' ? inner : null) ||
      'Something went wrong. Please try again.';
    const errors: { field: string; message: string }[] =
      (typeof inner === 'object' && Array.isArray(inner?.errors) && inner.errors) || [];
    const err: any = new Error(message);
    err.fieldErrors = errors;
    throw err;
  }
  return payload?.data ?? {};
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function statusStyles(status: CompanyStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-[var(--primary)]/[0.12] text-[var(--primary)] border-[var(--primary)]/30';
    case 'SUSPENDED':
      return 'bg-[#F2AE55]/[0.12] text-[#F2AE55] border-[#F2AE55]/30';
    default:
      return 'bg-white/[0.06] text-[#8891B8] border-white/[0.14]';
  }
}

export default function CompaniesPage() {
  const { accessToken } = useAuth();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [statusFilter, setStatusFilter] = useState<'' | CompanyStatus>('');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CreateCompanyForm>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formBanner, setFormBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [credentialsModal, setCredentialsModal] = useState<{
    companyName: string;
    email: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const router = useRouter();
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Company | null>(null);

  const fetchIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const loadCompanies = useCallback(async () => {
    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (statusFilter) params.set('status', statusFilter);

      const result = await apiFetch(`/companies?${params.toString()}`, accessToken);
      if (fetchId !== fetchIdRef.current) return; // stale response, ignore

      setCompanies(Array.isArray(result?.data) ? result.data : []);
      setMeta(
        result?.meta ?? { page, limit: 20, total: result?.data?.length ?? 0, totalPages: 1 }
      );
    } catch (err: any) {
      if (fetchId !== fetchIdRef.current) return;
      setListError(err.message || 'Could not load companies.');
      setCompanies([]);
    } finally {
      if (fetchId === fetchIdRef.current) setLoading(false);
    }
  }, [accessToken, page, debouncedSearch, statusFilter]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  function openCreateModal() {
    setForm(emptyForm);
    setFieldErrors({});
    setFormBanner(null);
    setLogoFile(null);
    setLogoPreview(null);
    setLogoError(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setModalOpen(true);
  }

  function handleLogoSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      setLogoError(null);
      return;
    }

    const validationError = getLogoValidationError(file);
    if (validationError) {
      setLogoFile(null);
      setLogoPreview(null);
      setLogoError(validationError);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setLogoFile(file);
    setLogoPreview(objectUrl);
    setLogoError(null);
  }

  function updateField<K extends keyof CreateCompanyForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((f) => ({ ...f, [key]: undefined }));
  }

  function validateForm(): boolean {
    const next: FieldErrors = {};
    if (!form.name.trim()) next.name = 'Company name is required.';
    if (!form.adminFirstName.trim()) next.adminFirstName = 'First name is required.';
    if (!form.adminLastName.trim()) next.adminLastName = 'Last name is required.';
    if (!form.adminEmail.trim()) {
      next.adminEmail = 'Admin email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail.trim())) {
      next.adminEmail = 'Enter a valid email address.';
    }
    if (form.adminPassword && form.adminPassword.length < 8) {
      next.adminPassword = 'Password must be at least 8 characters.';
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormBanner(null);
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('name', form.name.trim());
      payload.append('adminFirstName', form.adminFirstName.trim());
      payload.append('adminLastName', form.adminLastName.trim());
      payload.append('adminEmail', form.adminEmail.trim());
      if (form.slug.trim()) payload.append('slug', form.slug.trim());
      if (form.contactEmail.trim()) payload.append('contactEmail', form.contactEmail.trim());
      if (form.contactPhone.trim()) payload.append('contactPhone', form.contactPhone.trim());
      if (form.address.trim()) payload.append('address', form.address.trim());
      if (form.adminPassword.trim()) payload.append('adminPassword', form.adminPassword.trim());
      if (logoFile) payload.append('logo', logoFile);

      const result = await apiFetch('/companies', accessToken, {
        method: 'POST',
        body: payload,
      });
      const created = result?.data;

      setModalOpen(false);
      setPage(1);
      loadCompanies();

      setCredentialsModal({
        companyName: created?.company?.name ?? form.name,
        email: created?.admin?.email ?? form.adminEmail,
        password: created?.admin?.generatedPassword ?? form.adminPassword,
      });
    } catch (err: any) {
      const next: FieldErrors = {};
      (err.fieldErrors || []).forEach((fe: { field: string; message: string }) => {
        next[fe.field] = fe.message;
      });
      setFieldErrors(next);
      if (Object.keys(next).length === 0) {
        setFormBanner(err.message || 'Could not create company.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(company: Company) {
    setActionMenuId(null);
    setPendingActionId(company.id);
    const endpoint = company.status === 'ACTIVE' ? 'suspend' : 'activate';
    try {
      await apiFetch(`/companies/${company.id}/${endpoint}`, accessToken, { method: 'POST' });
      loadCompanies();
    } catch (err: any) {
      setListError(err.message || 'Could not update company status.');
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setPendingActionId(confirmDelete.id);
    try {
      await apiFetch(`/companies/${confirmDelete.id}`, accessToken, { method: 'DELETE' });
      setConfirmDelete(null);
      loadCompanies();
    } catch (err: any) {
      setListError(err.message || 'Could not delete company.');
    } finally {
      setPendingActionId(null);
    }
  }

  function copyPassword() {
    if (!credentialsModal) return;
    navigator.clipboard.writeText(credentialsModal.password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} min-h-screen  text-[#F2F4FA]`}
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-[26px] font-semibold tracking-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Companies
            </h1>
            <p className="text-sm text-[#8891B8] mt-1">
              Manage tenant workspaces, admins, and access.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-[10px] bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold text-[14px] px-4 py-[11px] hover:brightness-[1.08] active:translate-y-px transition self-start sm:self-auto"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New company
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex-1 flex items-center rounded-[10px] border border-white/[0.09] bg-[#1B2145] focus-within:border-[var(--primary)] transition-colors">
            <svg className="ml-3.5 flex-shrink-0 text-[#565F8C]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, slug, or contact email"
              className="w-full bg-transparent border-none outline-none text-[14px] text-[#F2F4FA] placeholder:text-[#565F8C] px-3 py-[11px]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | CompanyStatus)}
            className="rounded-[10px] border border-white/[0.09] bg-[#1B2145] text-[14px] text-[#F2F4FA] px-3.5 py-[11px] outline-none focus:border-[var(--primary)] transition-colors"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {listError && (
          <div
            role="alert"
            className="rounded-[10px] border border-[#FF6B6B]/30 bg-[#FF6B6B]/[0.12] text-[#FFB3B3] text-[13px] leading-relaxed px-3.5 py-3 mb-4"
          >
            {listError}
          </div>
        )}

        {/* Table */}
        <div className="rounded-[14px] border border-white/[0.09] bg-[#141A38] overflow-hidden">
          <div className="grid grid-cols-[1.7fr_1.4fr_1.6fr_0.9fr_1fr_44px] gap-3 px-5 py-3 text-[11px] uppercase tracking-[0.08em] text-[#565F8C] border-b border-white/[0.09]">
            <span>Company</span>
            <span>Contact</span>
            <span>Company Admin</span>
            <span>Status</span>
            <span>Created</span>
            <span />
          </div>

          {loading ? (
            <div className="px-5 py-14 text-center text-sm text-[#565F8C]">Loading companies…</div>
          ) : companies.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <p className="text-sm text-[#8891B8]">No companies match your filters.</p>
              {(search || statusFilter) && (
                <button
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('');
                  }}
                  className="mt-2 text-[13px] text-[var(--primary)] hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            companies.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-[1.7fr_1.4fr_1.6fr_0.9fr_1fr_44px] gap-3 px-5 py-4 items-center border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.02] transition-colors"
              >
                <div className="min-w-0">
                  <Link href={`/super-admin/companies/${c.id}`} className="block">
                    <div className="text-[14.5px] font-medium truncate text-[#F2F4FA] hover:text-[var(--primary)]">
                      {c.name}
                    </div>
                    <div
                      className="text-[12px] text-[#565F8C] truncate"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      /{c.slug}
                    </div>
                  </Link>
                </div>
                <div className="min-w-0 text-[13.5px] text-[#8891B8] truncate">
                  {c.contactEmail || '—'}
                </div>
                <div className="min-w-0">
                  {c.admin ? (
                    <>
                      <div className="text-[13px] text-[#AAB2D4] truncate">
                        {c.admin.firstName} {c.admin.lastName}
                      </div>
                      <div className="text-[11.5px] text-[#565F8C] truncate">{c.admin.email}</div>
                    </>
                  ) : (
                    <span className="text-[12px] text-[#565F8C]">No admin assigned</span>
                  )}
                </div>
                <div>
                  <span
                    className={`inline-flex items-center rounded-full border text-[11.5px] font-medium px-2.5 py-1 ${statusStyles(
                      c.status
                    )}`}
                  >
                    {c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                  </span>
                </div>
                <div className="text-[13px] text-[#565F8C]">
                  {new Date(c.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
                <div className="relative flex justify-end">
                  <button
                    onClick={() => setActionMenuId(actionMenuId === c.id ? null : c.id)}
                    disabled={pendingActionId === c.id}
                    aria-label={`Actions for ${c.name}`}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8891B8] hover:text-[#F2F4FA] hover:bg-white/[0.06] disabled:opacity-50 transition"
                  >
                    {pendingActionId === c.id ? (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-[#565F8C]/40 border-t-[#F2F4FA] animate-spin" />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.8" />
                        <circle cx="12" cy="12" r="1.8" />
                        <circle cx="12" cy="19" r="1.8" />
                      </svg>
                    )}
                  </button>

                  {actionMenuId === c.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setActionMenuId(null)} />
                      <div className="absolute right-0 top-9 z-20 w-44 rounded-[10px] border border-white/[0.1] bg-[#1B2145] shadow-xl py-1.5">
                        <button
                          onClick={() => {
                            setActionMenuId(null);
                            router.push(`/super-admin/companies/${c.id}`);
                          }}
                          className="w-full text-left px-3.5 py-2 text-[13.5px] text-[var(--primary)] hover:bg-white/[0.06] transition"
                        >
                          View details
                        </button>
                        <button
                          onClick={() => handleToggleStatus(c)}
                          className="w-full text-left px-3.5 py-2 text-[13.5px] text-[#F2F4FA] hover:bg-white/[0.06] transition"
                        >
                          {c.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          onClick={() => {
                            setActionMenuId(null);
                            setConfirmDelete(c);
                          }}
                          className="w-full text-left px-3.5 py-2 text-[13.5px] text-[#FF6B6B] hover:bg-[#FF6B6B]/[0.08] transition"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {!loading && companies.length > 0 && (
          <div className="flex items-center justify-between mt-5 text-[13px] text-[#8891B8]">
            <span>
              Showing {(meta.page - 1) * meta.limit + 1}–
              {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={meta.page <= 1}
                className="rounded-lg border border-white/[0.09] px-3 py-1.5 disabled:opacity-40 hover:bg-white/[0.05] transition"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages || p + 1, p + 1))}
                disabled={meta.page >= (meta.totalPages || 1)}
                className="rounded-lg border border-white/[0.09] px-3 py-1.5 disabled:opacity-40 hover:bg-white/[0.05] transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create company modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-[14px] border border-white/[0.1] bg-[#141A38] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                New company
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                aria-label="Close"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8891B8] hover:text-[#F2F4FA] hover:bg-white/[0.06] transition"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {formBanner && (
              <div className="rounded-[10px] border border-[#FF6B6B]/30 bg-[#FF6B6B]/[0.12] text-[#FFB3B3] text-[13px] px-3.5 py-3 mb-4">
                {formBanner}
              </div>
            )}

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-[#565F8C] mb-3">
                  Company details
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Company name"
                    value={form.name}
                    onChange={(v) => updateField('name', v)}
                    error={fieldErrors.name}
                    span2
                  />
                  <Field
                    label="Slug (optional)"
                    value={form.slug}
                    onChange={(v) => updateField('slug', v)}
                    error={fieldErrors.slug}
                    placeholder="auto-generated if blank"
                    span2
                  />
                  <Field
                    label="Contact email"
                    value={form.contactEmail}
                    onChange={(v) => updateField('contactEmail', v)}
                    error={fieldErrors.contactEmail}
                  />
                  <Field
                    label="Contact phone"
                    value={form.contactPhone}
                    onChange={(v) => updateField('contactPhone', v)}
                    error={fieldErrors.contactPhone}
                  />
                  <Field
                    label="Address"
                    value={form.address}
                    onChange={(v) => updateField('address', v)}
                    error={fieldErrors.address}
                    span2
                  />
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-[#565F8C] mb-3">
                  Company logo
                </p>
                <div className="rounded-[10px] border border-dashed border-white/[0.12] bg-[#1B2145] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[14px] font-medium text-[#F2F4FA]">Upload a logo</p>
                      <p className="text-[12px] text-[#8891B8] mt-1">
                        JPG, PNG, WEBP, or SVG up to 500 KB.
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-[10px] border border-[var(--primary)]/30 bg-[var(--primary)]/[0.12] px-3.5 py-2 text-[13px] font-semibold text-[var(--primary)] transition hover:bg-[var(--primary)]/[0.2]">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={handleLogoSelection}
                      />
                      {logoFile ? 'Change logo' : 'Choose logo'}
                    </label>
                  </div>
                  {logoError && (
                    <p className="mt-3 text-[12px] text-[#FF6B6B]">{logoError}</p>
                  )}
                  {logoPreview ? (
                    <div className="mt-4 flex items-center gap-3 rounded-[10px] border border-white/[0.08] bg-[#141A38] p-3">
                      <img src={logoPreview} alt="Company logo preview" className="h-14 w-14 rounded-[8px] object-cover" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[#F2F4FA]">{logoFile?.name}</p>
                        <p className="text-[12px] text-[#565F8C]">{Math.round((logoFile?.size || 0) / 1024)} KB</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-[10px] border border-white/[0.06] bg-[#141A38] p-3 text-[12px] text-[#565F8C]">
                      No logo selected yet.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-[#565F8C] mb-3">
                  Company admin
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="First name"
                    value={form.adminFirstName}
                    onChange={(v) => updateField('adminFirstName', v)}
                    error={fieldErrors.adminFirstName}
                  />
                  <Field
                    label="Last name"
                    value={form.adminLastName}
                    onChange={(v) => updateField('adminLastName', v)}
                    error={fieldErrors.adminLastName}
                  />
                  <Field
                    label="Admin email"
                    value={form.adminEmail}
                    onChange={(v) => updateField('adminEmail', v)}
                    error={fieldErrors.adminEmail}
                    span2
                  />
                  <Field
                    label="Password (optional)"
                    value={form.adminPassword}
                    onChange={(v) => updateField('adminPassword', v)}
                    error={fieldErrors.adminPassword}
                    placeholder="auto-generated if blank"
                    span2
                    type="password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-[10px] px-4 py-[11px] text-[14px] text-[#8891B8] hover:text-[#F2F4FA] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-[10px] bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold text-[14px] px-5 py-[11px] hover:brightness-[1.08] disabled:opacity-65 transition"
                >
                  {submitting ? 'Creating…' : 'Create company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generated credentials modal */}
      {credentialsModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-[440px] rounded-[14px] border border-white/[0.1] bg-[#141A38] p-6">
            <div className="w-10 h-10 rounded-full bg-[var(--primary)]/[0.12] flex items-center justify-center mb-4">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
              {credentialsModal.companyName} created
            </h2>
            <p className="text-[13.5px] text-[#8891B8] mb-5">
              A welcome email was sent, but save this password now — it won't be shown again.
            </p>

            <div className="rounded-[10px] border border-white/[0.09] bg-[#1B2145] px-4 py-3 mb-2">
              <p className="text-[11px] uppercase tracking-[0.08em] text-[#565F8C] mb-1">Admin email</p>
              <p className="text-[14px]">{credentialsModal.email}</p>
            </div>
            <div className="rounded-[10px] border border-white/[0.09] bg-[#1B2145] px-4 py-3 mb-5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.08em] text-[#565F8C] mb-1">Password</p>
                <p className="text-[14px] truncate" style={{ fontFamily: 'var(--font-mono)' }}>
                  {credentialsModal.password}
                </p>
              </div>
              <button
                onClick={copyPassword}
                className="flex-shrink-0 text-[12.5px] font-medium text-[var(--primary)] hover:underline"
              >
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>

            <button
              onClick={() => setCredentialsModal(null)}
              className="w-full rounded-[10px] bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold text-[14px] px-4 py-[11px] hover:brightness-[1.08] transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-[400px] rounded-[14px] border border-white/[0.1] bg-[#141A38] p-6">
            <h2 className="text-lg font-semibold mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
              Delete {confirmDelete.name}?
            </h2>
            <p className="text-[13.5px] text-[#8891B8] mb-5">
              This soft-deletes the company. Its users will lose access, but the record is kept for
              audit history.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-[10px] px-4 py-[11px] text-[14px] text-[#8891B8] hover:text-[#F2F4FA] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={pendingActionId === confirmDelete.id}
                className="rounded-[10px] bg-[#FF6B6B] text-[#2B0A0A] font-semibold text-[14px] px-4 py-[11px] hover:brightness-[1.08] disabled:opacity-65 transition"
              >
                {pendingActionId === confirmDelete.id ? 'Deleting…' : 'Delete company'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Small field component ----------
function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  span2,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  span2?: boolean;
  type?: string;
}) {
  return (
    <div className={`flex flex-col gap-[6px] ${span2 ? 'col-span-2' : ''}`}>
      <label className="text-[12px] font-medium text-[#8891B8]">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-[10px] border bg-[#1B2145] text-[14px] text-[#F2F4FA] placeholder:text-[#565F8C] px-3 py-[10px] outline-none transition-colors ${
          error ? 'border-[#FF6B6B]' : 'border-white/[0.09] focus:border-[var(--primary)]'
        }`}
      />
      {error && <span className="text-[12px] text-[#FF6B6B]">{error}</span>}
    </div>
  );
}