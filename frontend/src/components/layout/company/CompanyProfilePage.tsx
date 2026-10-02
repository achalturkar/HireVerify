'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Building2, Camera, Mail, MapPin, Phone, Save, X, Loader2, PenTool, Stamp as StampIcon, Palette, Settings2, Pencil } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { getCompany, updateCompany } from '@/src/lib/api/companies';
import { resolveLogoUrl } from '@/src/lib/logo';
import GeoSelect from '@/src/components/common/GeoSelect';

const MAX_IMAGE_SIZE_BYTES = 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];

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
  Neutral surfaces use the `isDark` boolean; brand accents inherit
  the company shell's primary color through CSS variables.
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

const DEFAULT_PRIMARY_COLOR = '#0E8C78';
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
    accent: 'var(--primary)',
    accentSoftBg: 'color-mix(in srgb, var(--primary) 10%, transparent)',
    accentBorder: 'color-mix(in srgb, var(--primary) 25%, transparent)',
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
          borderColor: dragActive ? 'var(--primary)' : t.dropzoneBorder,
          background: dragActive ? t.accentSoftBg : t.dropzoneBg,
        }}
      >
        <div
          className={`relative flex items-center justify-center overflow-hidden rounded-xl ${boxSizeClass}`}
          style={checkerStyle(isDark)}
        >
          {displayed ? (
            <Image src={displayed} alt={label} fill sizes={shape === 'wide' ? '160px' : '96px'} unoptimized className="object-contain p-2" />
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
const isValidPrimaryColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);
const primaryForeground = (color: string) => {
  const channels = color.slice(1).match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16)) || [14, 140, 120];
  return (0.299 * channels[0] + 0.587 * channels[1] + 0.114 * channels[2]) > 150 ? '#0B0F26' : '#FFFFFF';
};
type ProfileTab = 'branding' | 'account' | 'settings';

export default function CompanyProfilePage() {
  const { user, accessToken, refreshUser } = useAuth();
  const companyId = user?.company?.id;
  const isDark = useIsDarkMode();
  const t = getTokens(isDark);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('branding');
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    shortCode: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    primaryColor: DEFAULT_PRIMARY_COLOR,
    gstNumber: '',
    panNumber: '',
    city: '',
    country: '',
    state: '',
    postalCode: '',
    bankAccountName: '',
    bankName: '',
    bankAccountNumber: '',
    bankIfscCode: '',
    bankSwiftCode: '',
    bankBranch: '',
    upiId: '',
  });
  const [savedForm, setSavedForm] = useState<typeof form | null>(null);

  const [images, setImages] = useState<Record<ImageField, ImageFieldState>>({
    logo: { ...emptyImageState },
    signature: { ...emptyImageState },
    stamp: { ...emptyImageState },
  });
  const [savedImages, setSavedImages] = useState<Record<ImageField, ImageFieldState> | null>(null);
  const previewPrimaryColor = isValidPrimaryColor(form.primaryColor) ? form.primaryColor : DEFAULT_PRIMARY_COLOR;
  const brandingImages: Array<{ label: string; url: string | null }> = [
    { label: 'Company logo', url: images.logo.savedUrl },
    { label: 'Signature', url: images.signature.savedUrl },
    { label: 'Company stamp', url: images.stamp.savedUrl },
  ];

  useEffect(() => {
    if (!companyId || !accessToken) {
      const task = Promise.resolve().then(() => setLoading(false));
      return () => { void task; };
    }

    const loadCompany = async () => {
      setLoading(true);
      try {
        const data = await getCompany(companyId, accessToken);
        const loadedForm = {
          name: data.name ?? '',
          slug: data.slug ?? '',
          shortCode: data.shortCode ?? '',
          contactEmail: data.contactEmail ?? '',
          contactPhone: data.contactPhone ?? '',
          address: data.address ?? '',
          primaryColor: isValidPrimaryColor(data.primaryColor || '') ? data.primaryColor! : DEFAULT_PRIMARY_COLOR,
          gstNumber: data.gstNumber ?? '',
          panNumber: data.panNumber ?? '',
          city: data.city ?? '',
          country: data.country ?? '',
          state: data.state ?? '',
          postalCode: data.postalCode ?? '',
          bankAccountName: data.bankAccountName ?? '',
          bankName: data.bankName ?? '',
          bankAccountNumber: data.bankAccountNumber ?? '',
          bankIfscCode: data.bankIfscCode ?? '',
          bankSwiftCode: data.bankSwiftCode ?? '',
          bankBranch: data.bankBranch ?? '',
          upiId: data.upiId ?? '',
        };
        setForm(loadedForm);
        setSavedForm(loadedForm);
        const loadedImages = {
          logo: { ...emptyImageState, savedUrl: resolveLogoUrl(data.logoUrl) },
          signature: { ...emptyImageState, savedUrl: resolveLogoUrl(data.signatureUrl) },
          stamp: { ...emptyImageState, savedUrl: resolveLogoUrl(data.stampUrl) },
        };
        setImages(loadedImages);
        setSavedImages(loadedImages);
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
    if (!isValidPrimaryColor(form.primaryColor)) {
      setBanner({ tone: 'error', text: 'Enter a valid six-digit hex color, such as #0E8C78.' });
      setActiveTab('branding');
      return;
    }

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
      payload.append('primaryColor', form.primaryColor.trim().toUpperCase());
      ['gstNumber', 'panNumber', 'city', 'country', 'state', 'postalCode'].forEach((key) => {
        payload.append(key, form[key as keyof typeof form].trim());
      });
      ['bankAccountName', 'bankName', 'bankAccountNumber', 'bankIfscCode', 'bankSwiftCode', 'bankBranch', 'upiId'].forEach((key) => {
        payload.append(key, form[key as keyof typeof form].trim());
      });

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
      const updatedForm = {
        name: updated.name ?? '',
        slug: updated.slug ?? '',
        shortCode: updated.shortCode ?? '',
        contactEmail: updated.contactEmail ?? '',
        contactPhone: updated.contactPhone ?? '',
        address: updated.address ?? '',
        primaryColor: isValidPrimaryColor(updated.primaryColor || '') ? updated.primaryColor! : DEFAULT_PRIMARY_COLOR,
        gstNumber: updated.gstNumber ?? '',
        panNumber: updated.panNumber ?? '',
        city: updated.city ?? '',
        country: updated.country ?? '',
        state: updated.state ?? '',
        postalCode: updated.postalCode ?? '',
        bankAccountName: updated.bankAccountName ?? '',
        bankName: updated.bankName ?? '',
        bankAccountNumber: updated.bankAccountNumber ?? '',
        bankIfscCode: updated.bankIfscCode ?? '',
        bankSwiftCode: updated.bankSwiftCode ?? '',
        bankBranch: updated.bankBranch ?? '',
        upiId: updated.upiId ?? '',
      };
      setForm(updatedForm);
      setSavedForm(updatedForm);
      const updatedImages = {
        logo: { ...emptyImageState, savedUrl: resolveLogoUrl(updated.logoUrl) },
        signature: { ...emptyImageState, savedUrl: resolveLogoUrl(updated.signatureUrl) },
        stamp: { ...emptyImageState, savedUrl: resolveLogoUrl(updated.stampUrl) },
      };
      setImages((prev) => {
        Object.values(prev).forEach((img) => {
          if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
        });
        return updatedImages;
      });
      setSavedImages(updatedImages);
      setEditing(false);
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

  const cancelEditing = () => {
    if (saving) return;
    if (savedForm) setForm(savedForm);
    if (savedImages) {
      Object.values(images).forEach((image) => {
        if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
      });
      setImages(savedImages);
    }
    setBanner(null);
    setEditing(false);
  };

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
            {form.name || 'Company details'}
          </h1>
          <p className="text-[13.5px] mt-1" style={{ color: t.textMuted }}>
            {editing ? 'Edit company branding, account information, and settings.' : 'Company identity, account information, branding, and payment settings.'}
          </p>
        </div>
        {!editing && <button type="button" onClick={() => { setBanner(null); setEditing(true); }} disabled={loading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}><Pencil size={15} />Edit details</button>}
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

      <div role="tablist" aria-label="Company profile sections" className="flex gap-1 overflow-x-auto border-b" style={{ borderColor: t.cardBorder }}>
        {([
          { id: 'branding', label: 'Branding', Icon: Palette },
          { id: 'account', label: 'Account info', Icon: Building2 },
          { id: 'settings', label: 'Settings', Icon: Settings2 },
        ] as const).map(({ id, label, Icon }) => (
          <button key={id} id={`${id}-tab`} type="button" role="tab" aria-selected={activeTab === id} aria-controls={`${id}-panel`} onClick={() => setActiveTab(id)} className="inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-[13px] font-semibold transition-colors" style={{ borderColor: activeTab === id ? t.accent : 'transparent', color: activeTab === id ? t.accent : t.textMuted }}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {!editing && activeTab === 'branding' && <div id="branding-panel" role="tabpanel" aria-labelledby="branding-tab" className="grid gap-4 md:grid-cols-2">
        <SectionCard eyebrow="Branding" title="Company identity" t={t}>
          <div className="flex items-center gap-3"><span className="h-9 w-9 shrink-0 rounded-md border" style={{ backgroundColor: form.primaryColor, borderColor: t.cardBorder }} /><div><p className="text-[13px] font-medium" style={{ color: t.textPrimary }}>Primary color</p><p className="font-mono text-[11px]" style={{ color: t.textMuted }}>{form.primaryColor}</p></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">{brandingImages.map(({ label, url }) => <div key={label} className="min-w-0"><div className="relative flex h-20 items-center justify-center overflow-hidden rounded-lg border p-2" style={{ background: t.dropzoneBg, borderColor: t.cardBorder }}>{url ? <Image src={url} alt={label} fill sizes="120px" unoptimized className="object-contain p-2" /> : <span className="text-[11px]" style={{ color: t.textFaint }}>Not uploaded</span>}</div><p className="mt-1.5 truncate text-[11px]" style={{ color: t.textMuted }}>{label}</p></div>)}</div>
        </SectionCard>
      </div>}

      {!editing && activeTab === 'account' && <div id="account-panel" role="tabpanel" aria-labelledby="account-tab" className="grid gap-4 md:grid-cols-2">
        <SectionCard eyebrow="Account info" title={form.name || 'Company'} t={t}>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {[['Slug', form.slug], ['Short code', form.shortCode], ['Contact email', form.contactEmail], ['Contact phone', form.contactPhone]].map(([label, value]) => <div key={label}><dt className="text-[11px]" style={{ color: t.textMuted }}>{label}</dt><dd className="mt-1 break-words text-[13px]" style={{ color: t.textPrimary }}>{value || 'Not set'}</dd></div>)}
          </dl>
        </SectionCard>
        <SectionCard eyebrow="Location & tax" title="Registered details" t={t}>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><dt className="text-[11px]" style={{ color: t.textMuted }}>Street address</dt><dd className="mt-1 whitespace-pre-wrap text-[13px]" style={{ color: t.textPrimary }}>{form.address || 'Not set'}</dd></div>
            {[['City', form.city], ['Country', form.country], ['State', form.state], ['Postal code', form.postalCode], ['GSTIN', form.gstNumber], ['PAN', form.panNumber]].map(([label, value]) => <div key={label}><dt className="text-[11px]" style={{ color: t.textMuted }}>{label}</dt><dd className="mt-1 break-words text-[13px]" style={{ color: t.textPrimary }}>{value || 'Not set'}</dd></div>)}
          </dl>
        </SectionCard>
      </div>}

      {!editing && activeTab === 'settings' && <div id="settings-panel" role="tabpanel" aria-labelledby="settings-tab">
        <SectionCard eyebrow="Settings" title="Payment bank account" t={t}>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{[['Account holder', form.bankAccountName], ['Bank', form.bankName], ['Account number', form.bankAccountNumber], ['IFSC', form.bankIfscCode], ['SWIFT / BIC', form.bankSwiftCode], ['Branch', form.bankBranch], ['UPI ID', form.upiId]].map(([label, value]) => <div key={label}><dt className="text-[11px]" style={{ color: t.textMuted }}>{label}</dt><dd className="mt-1 break-words text-[13px]" style={{ color: t.textPrimary }}>{value || 'Not set'}</dd></div>)}</dl>
        </SectionCard>
      </div>}

      {editing && <form onSubmit={handleSubmit} className="space-y-6" style={{ '--primary': previewPrimaryColor, '--primary-foreground': primaryForeground(previewPrimaryColor) } as React.CSSProperties}>

        {/* Branding */}
        {activeTab === 'branding' && <div id="branding-panel" role="tabpanel" aria-labelledby="branding-tab" className="space-y-6">
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

        <SectionCard eyebrow="Brand color" title="Primary color" description="Applied across your company workspace and new invoice PDFs." t={t}>
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="h-14 w-14 shrink-0 rounded-lg border" style={{ backgroundColor: form.primaryColor, borderColor: t.cardBorder }} aria-label={`Current brand color ${form.primaryColor}`} />
              <div className="min-w-0 flex-1">
                <FieldLabel hint="Six-digit hex" t={t}>Primary color</FieldLabel>
                <div className="flex gap-2">
                  <input type="color" value={form.primaryColor} onChange={(event) => setForm((current) => ({ ...current, primaryColor: event.target.value.toUpperCase() }))} disabled={loading} className="h-11 w-12 cursor-pointer rounded-lg border p-1 disabled:cursor-not-allowed" style={{ background: t.dropzoneBg, borderColor: t.dropzoneBorder }} aria-label="Choose primary color" />
                  <input value={form.primaryColor} onChange={(event) => setForm((current) => ({ ...current, primaryColor: event.target.value.toUpperCase() }))} placeholder="#0E8C78" maxLength={7} pattern="^#[0-9a-fA-F]{6}$" className={`${inputClasses} max-w-44 font-mono uppercase`} disabled={loading} aria-label="Primary color hex value" />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {primaryColorPalette.map((color) => {
                const selected = form.primaryColor.toUpperCase() === color;
                return <button key={color} type="button" onClick={() => setForm((current) => ({ ...current, primaryColor: color }))} disabled={loading} className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: color, borderColor: selected ? t.textPrimary : t.swatchRing, boxShadow: selected ? '0 0 0 2px var(--primary)' : undefined }} aria-label={`Select ${color}`} aria-pressed={selected} title={color} />;
              })}
            </div>
          </div>
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
        </div>}

        {/* Company details */}
        {activeTab === 'account' && <div id="account-panel" role="tabpanel" aria-labelledby="account-tab" className="space-y-6">
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
          </div>
        </SectionCard>

        {/* Address */}
        <SectionCard eyebrow="Location" title="Address" t={t}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><FieldLabel t={t}>Street address</FieldLabel><div className="relative"><MapPin size={14} className="pointer-events-none absolute left-3 top-3" style={{ color: t.textFaint }} /><textarea value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} rows={3} className={`${inputClasses} pl-9`} disabled={loading} placeholder="Street address" /></div></div>
            <div><FieldLabel t={t}>City</FieldLabel><input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} className={inputClasses} disabled={loading} maxLength={120} /></div>
            <div><FieldLabel t={t}>Country</FieldLabel><GeoSelect kind="country" value={form.country} onChange={(value) => setForm((current) => ({ ...current, country: value, state: current.country === value ? current.state : '' }))} className={inputClasses} disabled={loading} /></div>
            <div><FieldLabel t={t}>State</FieldLabel><GeoSelect kind="state" value={form.state} countryName={form.country} placeholder={form.country ? 'Select state' : 'Select a country first'} onChange={(value) => setForm((current) => ({ ...current, state: value }))} className={inputClasses} disabled={loading || !form.country} /></div>
            <div><FieldLabel t={t}>Postal code</FieldLabel><input value={form.postalCode} onChange={(event) => setForm((current) => ({ ...current, postalCode: event.target.value }))} className={inputClasses} disabled={loading} maxLength={20} /></div>
            <div><FieldLabel t={t}>GSTIN</FieldLabel><input value={form.gstNumber} onChange={(event) => setForm((current) => ({ ...current, gstNumber: event.target.value.toUpperCase() }))} className={inputClasses} disabled={loading} maxLength={30} /></div>
            <div><FieldLabel t={t}>PAN</FieldLabel><input value={form.panNumber} onChange={(event) => setForm((current) => ({ ...current, panNumber: event.target.value.toUpperCase() }))} className={inputClasses} disabled={loading} maxLength={20} /></div>
          </div>
        </SectionCard>
        </div>}

        {activeTab === 'settings' && <div id="settings-panel" role="tabpanel" aria-labelledby="settings-tab">
        <SectionCard eyebrow="Finance" title="Payment bank account" description="These company-level payment details are included on invoices created from now on." t={t}>
          <div className="grid gap-4 md:grid-cols-2">
            <div><FieldLabel t={t}>Account holder name</FieldLabel><input value={form.bankAccountName} onChange={(event) => setForm((current) => ({ ...current, bankAccountName: event.target.value }))} className={inputClasses} disabled={loading} maxLength={255} /></div>
            <div><FieldLabel t={t}>Bank name</FieldLabel><input value={form.bankName} onChange={(event) => setForm((current) => ({ ...current, bankName: event.target.value }))} className={inputClasses} disabled={loading} maxLength={255} /></div>
            <div><FieldLabel t={t}>Account number</FieldLabel><input value={form.bankAccountNumber} onChange={(event) => setForm((current) => ({ ...current, bankAccountNumber: event.target.value }))} className={inputClasses} disabled={loading} maxLength={80} autoComplete="off" /></div>
            <div><FieldLabel t={t}>IFSC code</FieldLabel><input value={form.bankIfscCode} onChange={(event) => setForm((current) => ({ ...current, bankIfscCode: event.target.value.toUpperCase() }))} className={inputClasses} disabled={loading} maxLength={20} /></div>
            <div><FieldLabel t={t}>SWIFT / BIC code</FieldLabel><input value={form.bankSwiftCode} onChange={(event) => setForm((current) => ({ ...current, bankSwiftCode: event.target.value.toUpperCase() }))} className={inputClasses} disabled={loading} maxLength={20} /></div>
            <div><FieldLabel t={t}>Branch</FieldLabel><input value={form.bankBranch} onChange={(event) => setForm((current) => ({ ...current, bankBranch: event.target.value }))} className={inputClasses} disabled={loading} maxLength={255} /></div>
            <div className="md:col-span-2"><FieldLabel t={t}>UPI ID (optional)</FieldLabel><input value={form.upiId} onChange={(event) => setForm((current) => ({ ...current, upiId: event.target.value }))} className={inputClasses} disabled={loading} maxLength={100} placeholder="accounts@bank" /></div>
          </div>
        </SectionCard>
        </div>}

        {/* Save bar */}
        <div className="flex items-center justify-end gap-3 rounded-2xl border px-6 py-4" style={{ background: t.cardBg, borderColor: t.cardBorder }}>
          {loading && (
            <span className="mr-auto flex items-center gap-2 text-[12.5px]" style={{ color: t.textFaint }}>
              <Loader2 size={13} className="animate-spin" />
              Loading company profile…
            </span>
          )}
          <button type="button" onClick={cancelEditing} disabled={saving || loading} className="mr-auto inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[13px] font-medium disabled:opacity-50" style={{ borderColor: t.cardBorder, color: t.textSubtle }}>
            <X size={14} />Cancel
          </button>
          <button
            type="submit"
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-[13.5px] font-semibold transition-colors disabled:opacity-60"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>}
    </div>
  );
}