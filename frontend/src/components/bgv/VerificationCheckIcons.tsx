import {
  BriefcaseBusiness,
  FileCheck2,
  FileText,
  Globe2,
  GraduationCap,
  MapPin,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type VerificationCheckSummary = {
  type: string;
  label?: string | null;
  status: string;
};

const iconByType: Array<{ matches: RegExp; icon: LucideIcon }> = [
  { matches: /ADDRESS|LOCATION/i, icon: MapPin },
  { matches: /EDUCATION|DEGREE|ACADEMIC/i, icon: GraduationCap },
  { matches: /EMPLOYMENT|EXPERIENCE|SALARY|UAN|EPFO/i, icon: BriefcaseBusiness },
  { matches: /PAN|AADHAAR|PASSPORT|VOTER|DRIVING_LICENSE|IDENTITY|DOCUMENT/i, icon: UserRound },
  { matches: /COURT|POLICE|CRIMINAL|LITIGATION/i, icon: ShieldCheck },
  { matches: /GLOBAL|WORLD|SANCTION|SOCIAL_MEDIA/i, icon: Globe2 },
  { matches: /REFERENCE/i, icon: FileText },
];

function getCheckAppearance(status: string) {
  switch (status.toUpperCase()) {
    case 'COMPLETED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'FAILED':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'IN_PROGRESS':
    case 'RETRYING':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'QUEUED':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'PENDING':
      return 'border-slate-200 bg-slate-100 text-slate-600';
    case 'CANCELLED':
      return 'border-gray-200 bg-gray-100 text-gray-500';
    default:
      return 'border-violet-200 bg-violet-50 text-violet-700';
  }
}

function getCheckIcon(type: string): LucideIcon {
  return iconByType.find(({ matches }) => matches.test(type))?.icon ?? FileCheck2;
}

export default function VerificationCheckIcons({ checks }: { checks: VerificationCheckSummary[] }) {
  if (!checks.length) return <span className="text-[var(--muted)]">—</span>;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {checks.map((check, index) => {
        const Icon = getCheckIcon(check.type);
        const label = check.label || check.type.replaceAll('_', ' ');
        const status = check.status.replaceAll('_', ' ');
        return (
          <span
            key={`${check.type}-${index}`}
            title={`${label} · ${status}`}
            aria-label={`${label}: ${status}`}
            tabIndex={0}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${getCheckAppearance(check.status)}`}
          >
            <Icon size={15} strokeWidth={2} aria-hidden="true" />
          </span>
        );
      })}
    </div>
  );
}
