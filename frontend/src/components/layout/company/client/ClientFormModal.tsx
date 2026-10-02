'use client';

import { useEffect, useState } from 'react';
import { Camera, X } from 'lucide-react';
import type { Client, ClientFormValues, CompanyRef } from '@/src/types/client';
import GeoSelect from '@/src/components/common/GeoSelect';

interface Props {
  mode: 'create' | 'edit';
  client?: Client | null;
  companies: CompanyRef[];
  isSuperAdmin: boolean;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: ClientFormValues, logoFile: File | null) => void;
}

// Sits inside a --surface panel, so it uses --surface-muted as a "sunken"
// background — same convention as the other form panels.
const inputClass =
  'w-full rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] px-3 py-2.5 text-[13.5px] text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none focus:border-[#3FDCC0]/50 focus:ring-1 focus:ring-[#3FDCC0]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const labelClass = 'block text-[11.5px] font-medium text-[var(--muted)] mb-1.5';

const sectionTitleClass =
  'text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] mb-3 mt-1';

const MAX_LOGO_SIZE_BYTES = 1024 * 1024;
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];

function getLogoValidationError(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const hasAllowedExtension = ['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(extension || '');
  const hasAllowedMime = ALLOWED_LOGO_TYPES.includes(file.type);
  if (!hasAllowedExtension || !hasAllowedMime) {
    return 'Only JPG, PNG, WEBP, or SVG images are allowed.';
  }
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return 'Logo image must be 1 MB or smaller.';
  }
  return null;
}

function empty(v: string | null | undefined) {
  return v ?? '';
}

export default function ClientFormModal({
  mode,
  client,
  companies,
  isSuperAdmin,
  submitting,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<ClientFormValues>({
    companyId: client?.companyId ?? '',
    clientCode: empty(client?.clientCode),
    name: empty(client?.name),
    logoUrl: empty(client?.logoUrl),
    website: empty(client?.website),
    industry: empty(client?.industry),
    contactName: empty(client?.contactName),
    contactEmail: empty(client?.contactEmail),
    contactPhone: empty(client?.contactPhone),
    gstNumber: empty(client?.gstNumber),
    panNumber: empty(client?.panNumber),
    addressLine1: empty(client?.addressLine1),
    addressLine2: empty(client?.addressLine2),
    city: empty(client?.city),
    state: empty(client?.state),
    country: empty(client?.country),
    postalCode: empty(client?.postalCode),
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(empty(client?.logoUrl));
  const [logoError, setLogoError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    setLogoFile(null);
    setLogoPreview(empty(client?.logoUrl));
    setLogoError(null);
  }, [client?.id]);

  const set = (key: keyof ClientFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const handleLogoSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setLogoFile(null);
      setLogoError(null);
      return;
    }

    const validationError = getLogoValidationError(file);
    if (validationError) {
      setLogoFile(null);
      setLogoError(validationError);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setLogoFile(file);
    setLogoPreview(objectUrl);
    setLogoError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values, logoFile);
  };

  const isValid =
    values.clientCode.trim() &&
    values.name.trim() &&
    (mode === 'edit' || !isSuperAdmin || values.companyId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={submitting ? undefined : onClose}
      />

      <div className="relative w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/40 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] sticky top-0 bg-[var(--surface)] z-10">
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.14em] text-[#3FDCC0] mb-0.5"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {mode === 'create' ? 'New client' : 'Edit client'}
            </p>
            <h2 className="text-[15px] font-semibold text-[var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
              {mode === 'create' ? 'Add a client' : client?.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-muted)] transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">
          {error && (
            <div className="rounded-lg bg-[#FF6B6B]/10 border border-[#FF6B6B]/25 px-3 py-2.5 text-[12.5px] text-[#FF6B6B]">
              {error}
            </div>
          )}

          {/* Basics */}
          <div>
            <p className={sectionTitleClass}>Basics</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Client code</label>
                  <input
                    className={inputClass}
                    value={values.clientCode}
                    onChange={set('clientCode')}
                    placeholder="ACME-01"
                    disabled={submitting}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Client name</label>
                  <input
                    className={inputClass}
                    value={values.name}
                    onChange={set('name')}
                    placeholder="Acme Corp"
                    disabled={submitting}
                    required
                  />
                </div>
              </div>

              {isSuperAdmin && mode === 'create' && (
                <div>
                  <label className={labelClass}>Company</label>
                  <select
                    className={inputClass}
                    value={values.companyId}
                    onChange={(e) => setValues((v) => ({ ...v, companyId: e.target.value }))}
                    disabled={submitting}
                    required
                  >
                    <option value="">Select a company…</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Industry</label>
                  <input
                    className={inputClass}
                    value={values.industry}
                    onChange={set('industry')}
                    placeholder="Manufacturing"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className={labelClass}>Website</label>
                  <input
                    className={inputClass}
                    value={values.website}
                    onChange={set('website')}
                    placeholder="https://acme.com"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Logo</label>
                <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] text-[var(--muted)]">PNG, JPG, WEBP, or SVG up to 1 MB.</span>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#3FDCC0]/25 bg-[#3FDCC0]/10 px-3 py-2 text-[12px] font-medium text-[#3FDCC0] hover:bg-[#3FDCC0]/20 transition-colors">
                      <Camera size={13} />
                      Choose file
                      <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoSelection} />
                    </label>
                  </div>
                  {logoError && <p className="mt-2 text-[12px] text-[#FF6B6B]">{logoError}</p>}
                  {logoPreview ? (
                    <div className="mt-3 flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5">
                      <img src={logoPreview} alt="Client logo preview" className="h-12 w-12 rounded-lg object-cover" />
                      <div>
                        <p className="text-[13px] text-[var(--foreground)]">{logoFile ? logoFile.name : 'Current logo'}</p>
                        <p className="text-[12px] text-[var(--muted)]">{logoFile ? `${Math.round(logoFile.size / 1024)} KB` : 'Existing logo will be kept if no new file is chosen.'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-[12px] text-[var(--muted)]">No logo selected yet.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className={sectionTitleClass}>Contact</p>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Contact name</label>
                <input
                  className={inputClass}
                  value={values.contactName}
                  onChange={set('contactName')}
                  placeholder="Jane Doe"
                  disabled={submitting}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Contact email</label>
                  <input
                    type="email"
                    className={inputClass}
                    value={values.contactEmail}
                    onChange={set('contactEmail')}
                    placeholder="jane@acme.com"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className={labelClass}>Contact phone</label>
                  <input
                    className={inputClass}
                    value={values.contactPhone}
                    onChange={set('contactPhone')}
                    placeholder="+1 555 000 0000"
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tax IDs */}
          <div>
            <p className={sectionTitleClass}>Tax identifiers</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>GST number</label>
                <input
                  className={inputClass}
                  value={values.gstNumber}
                  onChange={set('gstNumber')}
                  placeholder="Optional"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className={labelClass}>PAN number</label>
                <input
                  className={inputClass}
                  value={values.panNumber}
                  onChange={set('panNumber')}
                  placeholder="Optional"
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <p className={sectionTitleClass}>Address</p>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Address line 1</label>
                <input
                  className={inputClass}
                  value={values.addressLine1}
                  onChange={set('addressLine1')}
                  placeholder="Street address"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className={labelClass}>Address line 2</label>
                <input
                  className={inputClass}
                  value={values.addressLine2}
                  onChange={set('addressLine2')}
                  placeholder="Suite, floor, etc."
                  disabled={submitting}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>City</label>
                  <input
                    className={inputClass}
                    value={values.city}
                    onChange={set('city')}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className={labelClass}>Country</label>
                  <GeoSelect
                    kind="country"
                    className={inputClass}
                    value={values.country}
                    onChange={(value) => setValues((current) => ({ ...current, country: value, state: current.country === value ? current.state : '' }))}
                    disabled={submitting}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>State</label>
                  <GeoSelect
                    kind="state"
                    className={inputClass}
                    value={values.state}
                    countryName={values.country}
                    placeholder={values.country ? 'Select state' : 'Select a country first'}
                    onChange={(value) => setValues((current) => ({ ...current, state: value }))}
                    disabled={submitting || !values.country}
                  />
                </div>
                <div>
                  <label className={labelClass}>Postal code</label>
                  <input
                    className={inputClass}
                    value={values.postalCode}
                    onChange={set('postalCode')}
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 pt-1 sticky bottom-0 bg-[var(--surface)] pb-0.5">
            <button
              type="submit"
              disabled={!isValid || submitting}
              className="flex-1 rounded-lg bg-[#3FDCC0] text-[#0B0F26] text-[13.5px] font-semibold py-2.5 hover:bg-[#3FDCC0]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving…' : mode === 'create' ? 'Create client' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-[var(--border)] text-[var(--muted)] text-[13.5px] font-medium py-2.5 px-4 hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}