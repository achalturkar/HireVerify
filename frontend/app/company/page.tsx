'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Camera,
  Mail,
  MapPin,
  Phone,
  Save,
  Stamp,
  PenTool,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Clock,
  Palette,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { getCompany, updateCompany } from '@/src/lib/api/companies';

const MAX_IMAGE_SIZE_BYTES = 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
const primaryColorPalette = ['#0E8C78', '#1F417A', '#2563EB', '#7C3AED', '#C2410C', '#BE123C', '#374151', '#0F766E'];

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

type ImageField = 'logo' | 'signature' | 'stamp';

/* ------------------------------------------------------------------
   Time-of-day theme — greeting, icon, and gradient shift through the
   day so the header banner actually feels alive rather than static.
   Boundaries: morning 5–11, afternoon 12–16, evening 17–20, night 21–4.
------------------------------------------------------------------- */

type Period = 'morning' | 'afternoon' | 'evening' | 'night';

const TIME_THEMES: Record<
  Period,
  {
    greeting: string;
    subtitle: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    gradient: string; // tailwind gradient stop classes
    ring: string;
    textMuted: string;
  }
> = {
  morning: {
    greeting: 'Good Morning',
    subtitle: 'A fresh start — polish your company profile before the day picks up.',
    icon: Sunrise,
    gradient: 'from-[#F59E0B] via-[#FB923C] to-[#F97316]',
    ring: 'ring-[#FED7AA]/40',
    textMuted: 'text-[#FFE8D1]',
  },
  afternoon: {
    greeting: 'Good Afternoon',
    subtitle: 'Mid-day check-in — make sure your branding is looking sharp.',
    icon: Sun,
    gradient: 'from-[#0EA5E9] via-[#2563EB] to-[#1D4ED8]',
    ring: 'ring-[#BFDBFE]/40',
    textMuted: 'text-[#DBEAFE]',
  },
  evening: {
    greeting: 'Good Evening',
    subtitle: 'Winding down — a good time to tidy up your company details.',
    icon: Sunset,
    gradient: 'from-[#F97316] via-[#DB2777] to-[#7C3AED]',
    ring: 'ring-[#FBCFE8]/40',
    textMuted: 'text-[#FCE7F3]',
  },
  night: {
    greeting: 'Good Night',
    subtitle: 'Burning the midnight oil? Your changes save instantly, whenever you are.',
    icon: Moon,
    gradient: 'from-[#0F172A] via-[#1E293B] to-[#4338CA]',
    ring: 'ring-[#C7D2FE]/40',
    textMuted: 'text-[#E0E7FF]',
  },
};

function periodForHour(hour: number): Period {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function useTimeTheme() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const period = useMemo(() => periodForHour(now.getHours()), [now]);
  const theme = TIME_THEMES[period];

  const timeLabel = useMemo(
    () => now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    [now]
  );
  const dateLabel = useMemo(
    () => now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    [now]
  );

  return { now, period, theme, timeLabel, dateLabel };
}

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-8 h-8 rounded-lg bg-[#3FDCC0]/12 text-[#3FDCC0] flex items-center justify-center shrink-0">
        <Icon size={15} />
      </div>
      <div>
        <h2 className="text-[13.5px] font-semibold text-[#F2F4FA]" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </h2>
        {description && <p className="text-[11.5px] text-[#565F8C]">{description}</p>}
      </div>
    </div>
  );
}

export default function CompanyPage() {
  const { user, accessToken } = useAuth();
  const companyId = user?.company?.id;
  const { theme, period, timeLabel, dateLabel } = useTimeTheme();
  const GreetingIcon = theme.icon;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    primaryColor: '',
  });

  const [imageFiles, setImageFiles] = useState<Record<ImageField, File | null>>({
    logo: null,
    signature: null,
    stamp: null,
  });
  const [imagePreviews, setImagePreviews] = useState<Record<ImageField, string | null>>({
    logo: null,
    signature: null,
    stamp: null,
  });
  const [imageErrors, setImageErrors] = useState<Record<ImageField, string | null>>({
    logo: null,
    signature: null,
    stamp: null,
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
          contactEmail: data.contactEmail ?? '',
          contactPhone: data.contactPhone ?? '',
          address: data.address ?? '',
          primaryColor: data.primaryColor ?? '',
        });
        setImagePreviews({
          logo: data.logoUrl ?? null,
          signature: data.signatureUrl ?? null,
          stamp: data.stampUrl ?? null,
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

  const handleImageSelection = (field: ImageField) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setImageFiles((f) => ({ ...f, [field]: null }));
      setImageErrors((e) => ({ ...e, [field]: null }));
      return;
    }

    const validationError = getImageValidationError(file);
    if (validationError) {
      setImageFiles((f) => ({ ...f, [field]: null }));
      setImageErrors((e) => ({ ...e, [field]: validationError }));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setImageFiles((f) => ({ ...f, [field]: file }));
    setImagePreviews((p) => ({ ...p, [field]: objectUrl }));
    setImageErrors((e) => ({ ...e, [field]: null }));
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
      if (form.contactEmail.trim()) payload.append('contactEmail', form.contactEmail.trim());
      if (form.contactPhone.trim()) payload.append('contactPhone', form.contactPhone.trim());
      if (form.address.trim()) payload.append('address', form.address.trim());
      if (form.primaryColor.trim()) payload.append('primaryColor', form.primaryColor.trim());
      if (imageFiles.logo) payload.append('logo', imageFiles.logo);
      if (imageFiles.signature) payload.append('signature', imageFiles.signature);
      if (imageFiles.stamp) payload.append('stamp', imageFiles.stamp);

      const updated = await updateCompany(companyId, payload, accessToken);
      setForm({
        name: updated.name ?? '',
        slug: updated.slug ?? '',
        contactEmail: updated.contactEmail ?? '',
        contactPhone: updated.contactPhone ?? '',
        address: updated.address ?? '',
        primaryColor: updated.primaryColor ?? '',
      });
      setImagePreviews({
        logo: updated.logoUrl ?? null,
        signature: updated.signatureUrl ?? null,
        stamp: updated.stampUrl ?? null,
      });
      setImageFiles({ logo: null, signature: null, stamp: null });
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

  const imageUploadBoxes: Array<{
    field: ImageField;
    label: string;
    hint: string;
    fallbackIcon: React.ReactNode;
  }> = [
    { field: 'logo', label: 'Company logo', hint: 'PNG, JPG, WEBP, or SVG up to 1 MB.', fallbackIcon: <Building2 size={26} /> },
    { field: 'signature', label: 'Signatory signature', hint: 'Signature of the authorized signatory.', fallbackIcon: <PenTool size={26} /> },
    { field: 'stamp', label: 'Company stamp', hint: 'Official company seal / stamp.', fallbackIcon: <Stamp size={26} /> },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Time-of-day greeting banner */}
      <div
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${theme.gradient} px-6 py-6 sm:px-8 sm:py-7 shadow-lg shadow-black/20 transition-colors duration-700`}
      >
        {/* Decorative glow blobs */}
        <div className="pointer-events-none absolute -top-10 -right-10 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-14 -left-10 w-48 h-48 rounded-full bg-black/10 blur-3xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 ring-4 ${theme.ring} transition-all duration-700`}
            >
              <GreetingIcon size={22} className="text-white" />
            </div>
            <div>
              <p className={`text-[11px] uppercase tracking-[0.16em] mb-0.5 flex items-center gap-1.5 ${theme.textMuted}`}>
                <Sparkles size={11} />
                {period}
              </p>
              <h1 className="text-[22px] sm:text-[25px] font-semibold text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {theme.greeting}
                {user?.firstName ? `, ${user.firstName}` : ''}
              </h1>
              <p className={`text-[13px] mt-1 max-w-md ${theme.textMuted}`}>{theme.subtitle}</p>
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1 shrink-0">
            <div className="flex items-center gap-1.5 rounded-xl bg-white/15 backdrop-blur-sm px-3.5 py-2">
              <Clock size={14} className="text-white/80" />
              <span className="text-[18px] font-semibold text-white tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                {timeLabel}
              </span>
            </div>
            <span className={`text-[11.5px] ${theme.textMuted}`}>{dateLabel}</span>
          </div>
        </div>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#3FDCC0] mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
          Company Profile
        </p>
        <h2 className="text-[20px] font-semibold tracking-tight text-[#F2F4FA]" style={{ fontFamily: 'var(--font-display)' }}>
          Your company details
        </h2>
        <p className="text-[13.5px] text-[#8891B8] mt-1">Update branding, contact info, logo, signature, and stamp.</p>
      </div>

      {banner && (
        <div
          className={`rounded-xl border px-4 py-3 text-[13px] ${
            banner.tone === 'success'
              ? 'bg-[#3FDCC0]/10 border-[#3FDCC0]/25 text-[#3FDCC0]'
              : 'bg-[#FF6B6B]/10 border-[#FF6B6B]/25 text-[#FF6B6B]'
          }`}
        >
          {banner.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-2xl border border-white/[0.08] bg-[#161C3A] p-6 space-y-8">
        {/* Branding */}
        <div>
          <SectionHeading icon={Palette} title="Branding assets" description="Shown on invites, certificates, and generated reports." />
          <div className="grid gap-4 sm:grid-cols-3">
            {imageUploadBoxes.map(({ field, label, hint, fallbackIcon }) => (
              <div
                key={field}
                className="group rounded-2xl border border-dashed border-white/[0.12] bg-[#0F1330] p-5 text-center transition-colors hover:border-[#3FDCC0]/30 hover:bg-[#0F1330]/80"
              >
                <p className="text-[12px] font-medium text-[#AAB2D4] mb-3">{label}</p>
                {imagePreviews[field] ? (
                  <img
                    src={imagePreviews[field] as string}
                    alt={label}
                    className="mx-auto h-20 w-20 rounded-xl object-contain bg-white/[0.03] border border-white/[0.08] transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-xl bg-[#3FDCC0]/10 text-[#3FDCC0] transition-transform duration-200 group-hover:scale-105">
                    {fallbackIcon}
                  </div>
                )}
                <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#3FDCC0]/25 bg-[#3FDCC0]/10 px-3 py-2 text-[12.5px] font-medium text-[#3FDCC0] hover:bg-[#3FDCC0]/20 transition-colors">
                  <Camera size={13} />
                  Upload
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={handleImageSelection(field)}
                  />
                </label>
                <p className="mt-2 text-[11.5px] text-[#8891B8]">{hint}</p>
                {imageErrors[field] && <p className="mt-2 text-[12px] text-[#FF6B6B]">{imageErrors[field]}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Company info */}
        <div>
          <SectionHeading icon={Building2} title="Company information" description="Core details and your accent color." />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-[12px] font-medium text-[#AAB2D4] mb-1.5">Company name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg bg-[#0F1330] border border-white/[0.08] px-3 py-2.5 text-[13.5px] text-[#F2F4FA] outline-none focus:border-[#3FDCC0]/50 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#AAB2D4] mb-1.5">Slug</label>
              <input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                className="w-full rounded-lg bg-[#0F1330] border border-white/[0.08] px-3 py-2.5 text-[13.5px] text-[#F2F4FA] outline-none focus:border-[#3FDCC0]/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#AAB2D4] mb-1.5">Contact email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#565F8C]" />
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                  className="w-full rounded-lg bg-[#0F1330] border border-white/[0.08] pl-9 pr-3 py-2.5 text-[13.5px] text-[#F2F4FA] outline-none focus:border-[#3FDCC0]/50 transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#AAB2D4] mb-1.5">Contact phone</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#565F8C]" />
                <input
                  value={form.contactPhone}
                  onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                  className="w-full rounded-lg bg-[#0F1330] border border-white/[0.08] pl-9 pr-3 py-2.5 text-[13.5px] text-[#F2F4FA] outline-none focus:border-[#3FDCC0]/50 transition-colors"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[12px] font-medium text-[#AAB2D4] mb-1.5">Primary color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(form.primaryColor) ? form.primaryColor : '#3FDCC0'}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value.toUpperCase() }))}
                  className="h-11 w-12 cursor-pointer rounded-lg border border-white/[0.08] bg-[#0F1330] p-1"
                  aria-label="Choose primary color"
                />
                <input
                  value={form.primaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                  placeholder="#3FDCC0"
                  pattern="^#[0-9a-fA-F]{6}$"
                  className="w-full rounded-lg bg-[#0F1330] border border-white/[0.08] px-3 py-2.5 text-[13.5px] text-[#F2F4FA] outline-none focus:border-[#3FDCC0]/50 transition-colors"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {primaryColorPalette.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, primaryColor: color }))}
                    className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                      form.primaryColor.toUpperCase() === color ? 'border-[#F2F4FA] ring-2 ring-[#3FDCC0]/40' : 'border-white/20'
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select ${color}`}
                    title={color}
                  />
                ))}
                <span className="text-[11px] text-[#8891B8]">Choose a palette color or enter a hex code.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <SectionHeading icon={MapPin} title="Registered address" description="Appears on formal documents and reports." />
          <div className="relative">
            <MapPin size={14} className="absolute left-3 top-3 text-[#565F8C]" />
            <textarea
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              rows={4}
              className="w-full rounded-lg bg-[#0F1330] border border-white/[0.08] pl-9 pr-3 py-2.5 text-[13.5px] text-[#F2F4FA] outline-none focus:border-[#3FDCC0]/50 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center justify-end pt-1 border-t border-white/[0.06]">
          <button
            type="submit"
            disabled={saving || loading}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#3FDCC0] px-4 py-2.5 text-[13.5px] font-semibold text-[#0B0F26] transition-colors hover:bg-[#3FDCC0]/90 disabled:opacity-60"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}