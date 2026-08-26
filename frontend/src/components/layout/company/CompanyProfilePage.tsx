'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, Camera, Mail, MapPin, Phone, Save, X, Loader2, PenTool, Stamp as StampIcon } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { getCompany, updateCompany } from '@/src/lib/api/companies';

const MAX_IMAGE_SIZE_BYTES = 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API ||
  'http://localhost:5000/api/v1';

// The API base includes a path suffix like "/api/v1" — uploaded files are
// served from the origin, not under that path, so it has to be stripped
// before a relative url ("uploads/companies/xyz.png") is joined to it.
const FILE_ORIGIN = API_BASE.replace(/\/api(\/v\d+)?\/?$/, '');

/**
 * Resolves whatever shape a stored image url comes back from the API in —
 * a bare relative path, a path with a leading slash, or a full URL — into
 * something an <img> tag can actually load. Shared by logo, signature, and
 * stamp since all three are stored the same way.
 */
function resolveFileUrl(url?: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  return `${FILE_ORIGIN}/${url.replace(/^\/+/, '')}`;
}

function getImageValidationError(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const hasAllowedExtension = ['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(extension || '');
  const hasAllowedMime = ALLOWED_IMAGE_TYPES.includes(file.type);
  if (!hasAllowedExtension || !hasAllowedMime) {
    return 'Only JPG, PNG, WEBP, or SVG images are allowed.';
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'Image must be 1 MB or smaller.';
  }
  return null;
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/* ------------------------------------------------------------------
   Theme tokens
   ------------------------------------------------------------------
   This page was previously hardcoded to a single dark palette
   (#161C3A, #0B0F26, #8891B8, etc.) with no light-mode branch at all.
   Everything below is resolved from the `isDark` boolean, driven by
   the same MutationObserver pattern used elsewhere in the app, and
   applied via inline `style` rather than Tailwind's `dark:` variant
   (which was found to be unreliable in this project). Brand accents
   (teal, red, amber) keep their hue in both themes; only their text
   shade shifts for contrast against a light background.
------------------------------------------------------------------- */

function useIsDarkMode() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains('dark'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

type Tokens = ReturnType<typeof getTokens>;

const ACCENT = '#3FDCC0';
const ACCENT_LIGHT_TEXT = '#0E8C78';
const DANGER = '#FF6B6B';
const DANGER_LIGHT_TEXT = '#C23B3B';
const WARNING = '#F2AE55';
const WARNING_LIGHT_TEXT = '#A6650F';

function getTokens(isDark: boolean) {
  return {
    cardBg: isDark ? '#161C3A' : '#FFFFFF',
    cardBorder: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
    textPrimary: isDark ? '#F2F4FA' : '#0F172A',
    textSubtle: isDark ? '#AAB2D4' : '#475569',
    textMuted: isDark ? '#8891B8' : '#64748B',
    textFaint: isDark ? '#565F8C' : '#94A3B8',
    accent: isDark ? ACCENT : ACCENT_LIGHT_TEXT,
    accentSoftBg: 'rgba(63,220,192,0.10)',
    accentBorder: 'rgba(63,220,192,0.25)',
    dropzoneBg: isDark ? '#0F1330' : '#F8FAFC',
    dropzoneBorder: isDark ? 'rgba(255,255,255,0.12)' : '#CBD5E1',
    checkerBg: isDark ? '#0B0F26' : '#FFFFFF',
    checkerLine: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
    removeBtnBg: isDark ? '#161C3A' : '#FFFFFF',
    removeBtnBorder: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
    swatchRing: isDark ? 'rgba(255,255,255,0.2)' : '#E2E8F0',
    danger: isDark ? DANGER : DANGER_LIGHT_TEXT,
    dangerSoftBg: 'rgba(255,107,107,0.10)',
    dangerBorder: 'rgba(255,107,107,0.25)',
    warning: isDark ? WARNING : WARNING_LIGHT_TEXT,
  };
}

function checkerStyle(isDark: boolean): React.CSSProperties {
  const line = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.045)';
  return {
    backgroundImage: `linear-gradient(45deg, ${line} 25%, transparent 25%), linear-gradient(-45deg, ${line} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${line} 75%), linear-gradient(-45deg, transparent 75%, ${line} 75%)`,
    backgroundSize: '12px 12px',
    backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
    backgroundColor: isDark ? '#0B0F26' : '#F8FAFC',
  };
}

function FieldLabel({ children, hint, t }: { children: React.ReactNode; hint?: string; t: Tokens }) {
  return (
    <label className="mb-1.5 flex items-baseline justify-between">
      <span className="text-[12px] font-medium" style={{ color: t.textSubtle }}>{children}</span>
      {hint && <span className="text-[11px]" style={{ color: t.textFaint }}>{hint}</span>}
    </label>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
  t,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  t: Tokens;
}) {
  return (
    <div className="rounded-2xl border p-6" style={{ background: t.cardBg, borderColor: t.cardBorder }}>
      <div className="mb-5">
        <p
          className="text-[10.5px] uppercase tracking-[0.14em] mb-1"
          style={{ fontFamily: 'var(--font-mono)', color: t.accent, opacity: 0.85 }}
        >
          {eyebrow}
        </p>
        <h2 className="text-[16px] font-semibold" style={{ fontFamily: 'var(--font-display)', color: t.textPrimary }}>
          {title}
        </h2>
        {description && <p className="text-[12.5px] mt-1" style={{ color: t.textMuted }}>{description}</p>}
      </div>
      {children}
    </div>
  );
}

const inputClasses =
  'w-full rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] px-3 py-2.5 text-[13.5px] text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none transition-colors focus:border-[var(--primary)]/50 focus:ring-1 focus:ring-[var(--primary)]/30 disabled:opacity-50 disabled:cursor-not-allowed';

// ---- Shared image state, one instance per field (logo / signature / stamp) ----

interface ImageFieldState {
  savedUrl: string | null;   // resolved URL of what the server currently has
  file: File | null;         // newly picked file, not yet saved
  previewUrl: string | null; // object URL for `file`
  remove: boolean;           // user asked to clear the image on next save
  error: string | null;
}

const emptyImageState: ImageFieldState = {
  savedUrl: null,
  file: null,
  previewUrl: null,
  remove: false,
  error: null,
};

function ImageDropzone({
  label,
  description,
  hint,
  fallbackIcon,
  fallbackInitials,
  state,
  onFile,
  onRemove,
  disabled,
  shape = 'square',
  isDark,
  t,
}: {
  label: string;
  description: React.ReactNode;
  hint: string;
  fallbackIcon: React.ReactNode;
  fallbackInitials?: string;
  state: ImageFieldState;
  onFile: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
  shape?: 'square' | 'wide';
  isDark: boolean;
  t: Tokens;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const displayed = state.previewUrl ?? state.savedUrl;

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFile(file);
    event.target.value = '';
  };

  const boxSizeClass = shape === 'wide' ? 'h-24 w-40' : 'h-24 w-24';

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={disabled ? undefined : handleDrop}
        className="group relative shrink-0 rounded-2xl border border-dashed p-1 transition-colors"
        style={{
          borderColor: dragActive ? ACCENT : t.dropzoneBorder,
          background: dragActive ? t.accentSoftBg : t.dropzoneBg,
        }}
      >
        <div
          className={`relative flex items-center justify-center overflow-hidden rounded-xl ${boxSizeClass}`}
          style={checkerStyle(isDark)}
        >
          {displayed ? (
            <img src={displayed} alt={label} className="h-full w-full object-contain p-2" />
          ) : (
            <div className="flex flex-col items-center gap-1" style={{ color: t.accent }}>
              {fallbackInitials ? (
                <span className="text-[20px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                  {fallbackInitials}
                </span>
              ) : (
                fallbackIcon
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-transparent transition-all group-hover:text-white disabled:cursor-not-allowed"
            style={{ background: 'transparent' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(11,15,38,0.7)' : 'rgba(15,23,42,0.55)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            aria-label={`Upload ${label.toLowerCase()}`}
          >
            <Camera size={16} />
            <span className="text-[11px] font-medium">Change</span>
          </button>
        </div>

        {displayed && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm transition-colors disabled:cursor-not-allowed"
            style={{ background: t.removeBtnBg, borderColor: t.removeBtnBorder, color: t.textMuted }}
            onMouseEnter={(e) => (e.currentTarget.style.color = t.danger)}
            onMouseLeave={(e) => (e.currentTarget.style.color = t.textMuted)}
            aria-label={`Remove ${label.toLowerCase()}`}
            title={`Remove ${label.toLowerCase()}`}
          >
            <X size={12} />
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      <div className="flex-1 space-y-2 pt-1">
        <p className="text-[13px]" style={{ color: t.textSubtle }}>
          {description}{' '}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="font-medium hover:underline disabled:cursor-not-allowed"
            style={{ color: t.accent }}
          >
            browse your files
          </button>
          .
        </p>
        <p className="text-[12px]" style={{ color: t.textFaint }}>{hint}</p>
        {state.error && <p className="text-[12px]" style={{ color: t.danger }}>{state.error}</p>}
        {state.file && !state.error && (
          <p className="text-[12px]" style={{ color: t.accent }}>&quot;{state.file.name}&quot; selected — save changes to upload.</p>
        )}
        {state.remove && !state.file && (
          <p className="text-[12px]" style={{ color: t.warning }}>{label} will be removed when you save.</p>
        )}
      </div>
    </div>
  );
}

type ImageField = 'logo' | 'signature' | 'stamp';
const primaryColorPalette = ['#0E8C78', '#1F417A', '#2563EB', '#7C3AED', '#C2410C', '#BE123C', '#374151', '#0F766E'];

export default function CompanyProfilePage() {
  const { user, accessToken, refreshUser } = useAuth();
  const companyId = user?.company?.id;
  const isDark = useIsDarkMode();
  const t = getTokens(isDark);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    shortCode: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    primaryColor: '',
  });

  const [images, setImages] = useState<Record<ImageField, ImageFieldState>>({
    logo: { ...emptyImageState },
    signature: { ...emptyImageState },
    stamp: { ...emptyImageState },
  });

  useEffect(() => {
    if (!companyId || !accessToken) {
      setLoading(false);
      return;
    }

    const loadCompany = async () => {
      setLoading(true);
      try {
        const data = await getCompany(companyId, accessToken);
        setForm({
          name: data.name ?? '',
          slug: data.slug ?? '',
          shortCode: data.shortCode ?? '',
          contactEmail: data.contactEmail ?? '',
          contactPhone: data.contactPhone ?? '',
          address: data.address ?? '',
          primaryColor: data.primaryColor ?? '',
        });
        setImages({
          logo: { ...emptyImageState, savedUrl: resolveFileUrl(data.logoUrl) },
          signature: { ...emptyImageState, savedUrl: resolveFileUrl(data.signatureUrl) },
          stamp: { ...emptyImageState, savedUrl: resolveFileUrl(data.stampUrl) },
        });
      } catch (err) {
        setBanner({
          tone: 'error',
          text: err instanceof Error ? err.message : 'Could not load company profile.',
        });
      } finally {
        setLoading(false);
      }
    };

    loadCompany();
  }, [companyId, accessToken]);

  // Revoke object URLs on unmount so picked-but-unsaved files don't leak.
  useEffect(() => {
    return () => {
      Object.values(images).forEach((img) => {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = (field: ImageField) => (file: File) => {
    const validationError = getImageValidationError(file);
    setImages((prev) => {
      const current = prev[field];
      if (validationError) {
        return { ...prev, [field]: { ...current, error: validationError } };
      }
      if (current.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return {
        ...prev,
        [field]: {
          ...current,
          file,
          previewUrl: URL.createObjectURL(file),
          remove: false,
          error: null,
        },
      };
    });
  };

  const handleRemove = (field: ImageField) => () => {
    setImages((prev) => {
      const current = prev[field];
      if (current.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return {
        ...prev,
        [field]: { ...emptyImageState, remove: true },
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyId || !accessToken) return;

    setSaving(true);
    setBanner(null);
    try {
      const payload = new FormData();
      payload.append('name', form.name.trim());
      payload.append('slug', form.slug.trim());
      if (form.shortCode.trim()) payload.append('shortCode', form.shortCode.trim().toUpperCase());
      if (form.contactEmail.trim()) payload.append('contactEmail', form.contactEmail.trim());
      if (form.contactPhone.trim()) payload.append('contactPhone', form.contactPhone.trim());
      if (form.address.trim()) payload.append('address', form.address.trim());
      if (form.primaryColor.trim()) payload.append('primaryColor', form.primaryColor.trim());

      const fieldToFormKey: Record<ImageField, { file: string; remove: string }> = {
        logo: { file: 'logo', remove: 'removeLogo' },
        signature: { file: 'signature', remove: 'removeSignature' },
        stamp: { file: 'stamp', remove: 'removeStamp' },
      };

      (Object.keys(images) as ImageField[]).forEach((field) => {
        const state = images[field];
        const keys = fieldToFormKey[field];
        if (state.file) {
          payload.append(keys.file, state.file);
        } else if (state.remove) {
          payload.append(keys.remove, 'true');
        }
      });

      const updated = await updateCompany(companyId, payload, accessToken);
      await refreshUser();
      setForm({
        name: updated.name ?? '',
        slug: updated.slug ?? '',
        shortCode: updated.shortCode ?? '',
        contactEmail: updated.contactEmail ?? '',
        contactPhone: updated.contactPhone ?? '',
        address: updated.address ?? '',
        primaryColor: updated.primaryColor ?? '',
      });
      setImages((prev) => {
        Object.values(prev).forEach((img) => {
          if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
        });
        return {
          logo: { ...emptyImageState, savedUrl: resolveFileUrl(updated.logoUrl) },
          signature: { ...emptyImageState, savedUrl: resolveFileUrl(updated.signatureUrl) },
          stamp: { ...emptyImageState, savedUrl: resolveFileUrl(updated.stampUrl) },
        };
      });
      setBanner({ tone: 'success', text: 'Company profile updated successfully.' });
    } catch (err) {
      setBanner({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Could not update company profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  const swatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(form.primaryColor.trim())
    ? form.primaryColor.trim()
    : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p
            className="text-[11px] uppercase tracking-[0.14em] mb-1.5"
            style={{ fontFamily: 'var(--font-mono)', color: t.accent }}
          >
            Company Profile
          </p>
          <h1 className="text-[26px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)', color: t.textPrimary }}>
            Your company details
          </h1>
          <p className="text-[13.5px] mt-1" style={{ color: t.textMuted }}>
            Update branding, contact info, logo, signature, and stamp.
          </p>
        </div>
      </div>

      {banner && (
        <div
          className="flex items-center justify-between rounded-xl border px-4 py-3 text-[13px]"
          style={
            banner.tone === 'success'
              ? { background: t.accentSoftBg, borderColor: t.accentBorder, color: t.accent }
              : { background: t.dangerSoftBg, borderColor: t.dangerBorder, color: t.danger }
          }
        >
          <span>{banner.text}</span>
          <button type="button" onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100 ml-3">
            <X size={14} />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Branding */}
        <SectionCard
          eyebrow="Identity"
          title="Logo"
          description="Your logo appears on BGV reports, verification emails, and the HireVerify portal."
          t={t}
        >
          <ImageDropzone
            label="Logo"
            description="Drag an image onto the logo, or"
            hint="PNG, JPG, WEBP, or SVG · up to 1 MB · square logos display best"
            fallbackIcon={<Building2 size={26} />}
            fallbackInitials={form.name ? initialsFromName(form.name) : undefined}
            state={images.logo}
            onFile={handleFile('logo')}
            onRemove={handleRemove('logo')}
            disabled={loading}
            isDark={isDark}
            t={t}
          />
        </SectionCard>

        {/* Signature */}
        <SectionCard
          eyebrow="Authorization"
          title="Signatory signature"
          description="Appears on generated reports and certificates as the authorized signature."
          t={t}
        >
          <ImageDropzone
            label="Signature"
            description="Drag a signature image here, or"
            hint="PNG, JPG, WEBP, or SVG · up to 1 MB · transparent background recommended"
            fallbackIcon={<PenTool size={24} />}
            state={images.signature}
            onFile={handleFile('signature')}
            onRemove={handleRemove('signature')}
            disabled={loading}
            shape="wide"
            isDark={isDark}
            t={t}
          />
        </SectionCard>

        {/* Stamp */}
        <SectionCard
          eyebrow="Authorization"
          title="Company stamp"
          description="Your official seal, shown alongside the signature on reports and certificates."
          t={t}
        >
          <ImageDropzone
            label="Stamp"
            description="Drag a stamp image here, or"
            hint="PNG, JPG, WEBP, or SVG · up to 1 MB · transparent background recommended"
            fallbackIcon={<StampIcon size={24} />}
            state={images.stamp}
            onFile={handleFile('stamp')}
            onRemove={handleRemove('stamp')}
            disabled={loading}
            isDark={isDark}
            t={t}
          />
        </SectionCard>

        {/* Company details */}
        <SectionCard eyebrow="Details" title="Company information" t={t}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel t={t}>Company name</FieldLabel>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClasses}
                disabled={loading}
                required
              />
            </div>
            <div>
              <FieldLabel hint="Used in your portal URL" t={t}>Slug</FieldLabel>
              <input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                className={inputClasses}
                disabled={loading}
              />
            </div>
            <div>
              <FieldLabel hint="Used in BGV references" t={t}>Company short code</FieldLabel>
              <input
                value={form.shortCode}
                onChange={(e) => setForm((f) => ({ ...f, shortCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) }))}
                placeholder="CWW"
                maxLength={10}
                className={inputClasses}
                disabled={loading}
              />
            </div>
            <div>
              <FieldLabel t={t}>Contact email</FieldLabel>
              <div className="relative">
                <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textFaint }} />
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                  className={`${inputClasses} pl-9`}
                  disabled={loading}
                />
              </div>
            </div>
            <div>
              <FieldLabel t={t}>Contact phone</FieldLabel>
              <div className="relative">
                <Phone size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textFaint }} />
                <input
                  value={form.contactPhone}
                  onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                  className={`${inputClasses} pl-9`}
                  disabled={loading}
                />
              </div>
            </div>
            <div>
              <FieldLabel hint="Used on reports & the portal" t={t}>Primary color</FieldLabel>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(form.primaryColor) ? form.primaryColor : '#3FDCC0'}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value.toUpperCase() }))}
                  disabled={loading}
                  className="h-11 w-12 cursor-pointer rounded-lg border p-1 disabled:cursor-not-allowed"
                  style={{ background: t.dropzoneBg, borderColor: t.dropzoneBorder }}
                  aria-label="Choose primary color"
                />
                <input
                  value={form.primaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                  placeholder="#3FDCC0"
                  pattern="^#[0-9a-fA-F]{6}$"
                  className={inputClasses}
                  disabled={loading}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {primaryColorPalette.map((color) => {
                  const selected = form.primaryColor.toUpperCase() === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, primaryColor: color }))}
                      disabled={loading}
                      className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        backgroundColor: color,
                        borderColor: selected ? t.textPrimary : t.swatchRing,
                        boxShadow: selected ? `0 0 0 2px ${ACCENT}66` : undefined,
                      }}
                      aria-label={`Select ${color}`}
                      title={color}
                    />
                  );
                })}
                <span className="text-[11px]" style={{ color: t.textMuted }}>Select a palette color or enter a hex code.</span>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Address */}
        <SectionCard eyebrow="Location" title="Address" t={t}>
          <div className="relative">
            <MapPin size={14} className="pointer-events-none absolute left-3 top-3" style={{ color: t.textFaint }} />
            <textarea
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              rows={4}
              className={`${inputClasses} pl-9`}
              disabled={loading}
              placeholder="Street, city, state, postal code, country"
            />
          </div>
        </SectionCard>

        {/* Save bar */}
        <div className="flex items-center justify-end gap-3 rounded-2xl border px-6 py-4" style={{ background: t.cardBg, borderColor: t.cardBorder }}>
          {loading && (
            <span className="mr-auto flex items-center gap-2 text-[12.5px]" style={{ color: t.textFaint }}>
              <Loader2 size={13} className="animate-spin" />
              Loading company profile…
            </span>
          )}
          <button
            type="submit"
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-[13.5px] font-semibold transition-colors disabled:opacity-60"
            style={{ background: ACCENT, color: '#0B0F26' }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}