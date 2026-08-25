'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Contact,
  FileCheck2,
  CheckCircle2,
  Percent,
  ArrowRight,
  Settings as SettingsIcon,
  FileBarChart,
  ShieldCheck,
  Building2,
  Sun,
  CloudSun,
  CloudMoon,
  Moon,
  Sparkles,
  Clock,
  Calendar,
  Trophy,
  Target,
  Activity,
  ClipboardList,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';
import { useAuth } from '@/src/auth/AuthProvider';
import { getCompanyStats } from '@/src/lib/api/companies';

/* ------------------------------------------------------------------
   Theme tokens — unchanged from the base dashboard so this page stays
   visually consistent with the rest of the app (cards, borders, text
   colors, chart palette). Time-of-day theming below only touches the
   hero card's ambient gradient/glow, not the app's core teal/amber
   semantic colors.
------------------------------------------------------------------- */

const card = 'bg-white dark:bg-[#161C3A] border border-slate-200 dark:border-white/[0.08]';
const cardBorderB = 'border-slate-200 dark:border-white/[0.08]';
const textPrimary = 'text-slate-900 dark:text-[#F2F4FA]';
const textMuted = 'text-slate-500 dark:text-[#8891B8]';
const textFaint = 'text-slate-400 dark:text-[#565F8C]';
const divide = 'divide-slate-100 dark:divide-white/[0.06]';
const skeleton = 'bg-slate-200 dark:bg-white/[0.06] animate-pulse rounded';

const tealChip = 'bg-[var(--primary)]/10 dark:bg-[var(--primary)]/15 text-[var(--primary)]';
const amberChip = 'bg-[#F2AE55]/10 dark:bg-[#F2AE55]/15 text-[#A6650F] dark:text-[#F2AE55]';
const tealBadge = 'bg-[var(--primary)]/10 dark:bg-[var(--primary)]/15 text-[var(--primary)]';
const dangerBadge = 'bg-[#FF6B6B]/10 dark:bg-[#FF6B6B]/15 text-[#C23B3B] dark:text-[#FF6B6B]';

const CHART_COLORS = ['var(--primary)', '#F2AE55', '#FF6B6B', '#8891B8'];

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

/* ------------------------------------------------------------------
   Time-of-day theme
------------------------------------------------------------------- */

type Period = 'morning' | 'afternoon' | 'evening' | 'night';

const PERIODS: Record<
  Period,
  {
    greeting: string;
    icon: LucideIcon;
    heroLight: string;
    heroDark: string;
    accent: string;
    quotes: string[];
  }
> = {
  morning: {
    greeting: 'Good Morning',
    icon: Sun,
    heroLight: 'from-amber-100/70 via-orange-50/60 to-white',
    heroDark: 'from-amber-500/[0.12] via-orange-500/[0.06] to-transparent',
    accent: '#F2AE55',
    quotes: [
      'A calm start makes for a clear-headed shortlist.',
      'The best hires start with the first hour.',
      'Small progress before noon compounds by evening.',
    ],
  },
  afternoon: {
    greeting: 'Good Afternoon',
    icon: CloudSun,
    heroLight: 'from-sky-100/70 via-cyan-50/60 to-white',
    heroDark: 'from-sky-500/[0.12] via-cyan-500/[0.06] to-transparent',
    accent: '#5EA8D9',
    quotes: [
      'Midday is when most cases move from pending to done.',
      'Keep the queue moving — momentum is easy to lose after lunch.',
      'Every case you close now is one less tomorrow.',
    ],
  },
  evening: {
    greeting: 'Good Evening',
    icon: CloudMoon,
    heroLight: 'from-violet-100/70 via-pink-50/60 to-white',
    heroDark: 'from-violet-500/[0.12] via-pink-500/[0.06] to-transparent',
    accent: '#B18AF2',
    quotes: [
      'A good close to the day sets tomorrow up well.',
      'Wrap up loose threads while they\u2019re still fresh.',
      'Review, don\u2019t just react — evenings are for the former.',
    ],
  },
  night: {
    greeting: 'Good Night',
    icon: Moon,
    heroLight: 'from-slate-200/70 via-indigo-50/60 to-white',
    heroDark: 'from-indigo-500/[0.12] via-slate-500/[0.06] to-transparent',
    accent: '#7C86C4',
    quotes: [
      'Everything here will still be waiting, patiently, tomorrow.',
      'Late-night decisions benefit from a morning re-read.',
      'Rest is part of the workflow, not a break from it.',
    ],
  },
};

function getPeriod(hour: number): Period {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'evening';
  return 'night';
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/* ------------------------------------------------------------------
   Small count-up used by stat cards for a genuine "animated counter"
   effect, driven entirely by real values from the API (no fake data).
------------------------------------------------------------------- */

function useCountUp(target: number | undefined, duration = 700) {
  const [value, setValue] = useState(0);
  const startedFor = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (target === undefined) return;
    if (startedFor.current === target) return;
    startedFor.current = target;
    const start = performance.now();
    const from = 0;
    let frame: number;
    const tick = (t: number) => {
      const progress = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return target === undefined ? undefined : value;
}

interface CompanyStats {
  users?: number;
  clients?: number;
  candidates?: number;
  bgvCases?: number;
  pendingCases?: number;
  inProgressCases?: number;
  completedCases?: number;
  reports?: number;
  // Not returned by getCompanyStats today — wire these up on the backend
  // and the sections below (Analytics, Schedule, Activity) will switch
  // from real-but-limited data / empty states to full detail on their own.
  usersByRole?: { name: string; value: number }[];
  clientsByStatus?: { name: string; value: number }[];
  upcomingSchedule?: { time: string; title: string; subtitle: string; status: 'confirmed' | 'tentative' | 'due' }[];
  recentActivity?: { id: string; label: string; actor: string; timestamp: string; kind: 'success' | 'info' | 'warning' }[];
}

const QUICK_LINKS: { label: string; href: string; description: string; icon: LucideIcon }[] = [
  { label: 'Clients', href: '/company/clients', description: 'Manage client accounts', icon: Contact },
  { label: 'Users', href: '/company/users', description: 'Team members & roles', icon: Users },
  { label: 'BGV Cases', href: '/company/bgv-cases', description: 'Track verification cases', icon: FileCheck2 },
  { label: 'Reports', href: '/company/reports', description: 'Approved client reports', icon: FileBarChart },
  { label: 'Settings', href: '/company/settings', description: 'Workspace configuration', icon: SettingsIcon },
];

export default function CompanyDashboardPage() {
  const { user, accessToken } = useAuth();
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const isDark = useIsDarkMode();
  const now = useNow();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        if (!user?.company?.id || !accessToken) return;
        const s = await getCompanyStats(user.company.id, accessToken);
        if (mounted) setStats(s);
      } catch {
        // dashboard falls back to empty/placeholder states below
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [user?.company?.id, accessToken]);

  const period = getPeriod(now.getHours());
  const theme = PERIODS[period];
  const quote = useMemo(
    () => theme.quotes[now.getDate() % theme.quotes.length],
    [theme, now]
  );

  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeLabel = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const completionRate = useMemo(() => {
    if (!stats?.bgvCases) return null;
    return Math.round(((stats.completedCases ?? 0) / stats.bgvCases) * 100);
  }, [stats]);

  const compositionData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Users', value: stats.users ?? 0 },
      { name: 'Clients', value: stats.clients ?? 0 },
      { name: 'Candidates', value: stats.candidates ?? 0 },
      { name: 'BGV Cases', value: stats.bgvCases ?? 0 },
    ].filter((d) => d.value > 0);
  }, [stats]);

  const attemptStatusData = useMemo(() => {
    if (!stats?.bgvCases) return [];
    const completed = stats.completedCases ?? 0;
    const pending = Math.max(stats.bgvCases - completed, 0);
    return [
      { name: 'Completed', value: completed },
      { name: 'Pending', value: pending },
    ].filter((d) => d.value > 0);
  }, [stats]);

  // KPIs derived entirely from real counts already returned by the API —
  // no invented targets or fabricated history.
  const kpis = useMemo(() => {
    if (!stats) return [];
    const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);
    return [
      {
        label: 'Verification Completion',
        value: pct(stats.completedCases ?? 0, stats.bgvCases ?? 0),
        fill: 'var(--primary)',
      },
      {
        label: 'Active Workload',
        value: pct(stats.inProgressCases ?? 0, stats.bgvCases ?? 0),
        fill: '#F2AE55',
      },
      {
        label: 'Cases per Candidate',
        value: Math.min(pct(stats.bgvCases ?? 0, stats.candidates ?? 0), 100),
        fill: '#8891B8',
      },
      {
        label: 'Report Issuance',
        value: Math.min(pct(stats.reports ?? 0, stats.completedCases ?? 0), 100),
        fill: '#FF6B6B',
      },
    ];
  }, [stats]);

  // Insight sentences built from the numbers that actually exist —
  // nothing here is generated by a model, it's just plain-language math.
  const insights = useMemo(() => {
    if (!stats) return [];
    const out: string[] = [];
    if (completionRate !== null) {
      out.push(
        `Verification completion is at ${completionRate}% across ${stats.bgvCases} tracked case${stats.bgvCases === 1 ? '' : 's'}.`
      );
    }
    if (stats.pendingCases) {
      out.push(
        `${stats.pendingCases} case${stats.pendingCases === 1 ? ' is' : 's are'} still pending out of ${stats.bgvCases ?? 0} total.`
      );
    }
    if (stats.clients && stats.users) {
      out.push(`Your workspace supports ${stats.clients} client account${stats.clients === 1 ? '' : 's'} with a team of ${stats.users}.`);
    }
    if (stats.reports && stats.completedCases) {
      out.push(`${stats.reports} report${stats.reports === 1 ? '' : 's'} issued against ${stats.completedCases} completed case${stats.completedCases === 1 ? '' : 's'}.`);
    }
    return out.slice(0, 3);
  }, [stats, completionRate]);

  return (
    <div className="max-w-6xl mx-auto space-y-7">
      <HeroGreeting
        period={period}
        theme={theme}
        quote={quote}
        dateLabel={dateLabel}
        timeLabel={timeLabel}
        firstName={user?.firstName}
        lastName={user?.lastName}
        role={user?.role?.name}
        isDark={isDark}
      />

      {/* Quick action center */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {QUICK_LINKS.map((link, i) => (
          <motion.div
            key={link.href}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.35 }}
          >
            <Link
              href={link.href}
              className={`group relative overflow-hidden rounded-2xl p-4 hover:border-[var(--primary)]/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[var(--primary)]/5 transition-all duration-200 block ${card}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${tealChip}`}>
                <link.icon size={15} />
              </div>
              <p className={`text-[13px] font-medium flex items-center gap-1 ${textPrimary}`}>
                {link.label}
                <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </p>
              <p className={`text-[11px] mt-0.5 ${textFaint}`}>{link.description}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={stats?.users} icon={Users} color="teal" loading={loading} />
        <StatCard title="Clients" value={stats?.clients} icon={Contact} color="amber" loading={loading} />
        <StatCard title="BGV Cases" value={stats?.bgvCases} icon={FileCheck2} color="teal" loading={loading} />
        <StatCard title="Completed Cases" value={stats?.completedCases} icon={CheckCircle2} color="amber" loading={loading} />
      </div>

      {/* Secondary metrics strip */}
      <div className={`rounded-2xl px-5 py-4 flex flex-wrap items-center gap-x-8 gap-y-3 ${card}`}>
        <MiniStat label="Candidates" value={stats?.candidates} loading={loading} />
        <MiniStat label="Pending Cases" value={stats?.pendingCases} loading={loading} />
        <MiniStat label="In progress" value={stats?.inProgressCases} loading={loading} />
        <MiniStat label="Reports" value={stats?.reports} loading={loading} />
      </div>

      {/* AI-style insight widget (real numbers, plain-language phrasing) */}
      <AIInsightCard insights={insights} loading={loading} isDark={isDark} />

      {/* Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PieCard
          title="Workspace Composition"
          description="Share of users, clients, candidates and BGV cases"
          data={compositionData}
          loading={loading}
          emptyLabel="No workspace data yet."
          isDark={isDark}
        />
        <PieCard
          title="BGV Case Status"
          description="Completed vs. pending across verification cases"
          data={attemptStatusData}
          loading={loading}
          emptyLabel="No cases recorded yet."
          isDark={isDark}
        />
      </div>

      {/* Performance overview */}
      <PerformanceOverview kpis={kpis} loading={loading} isDark={isDark} />

      {/* Schedule + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ScheduleCard items={stats?.upcomingSchedule} loading={loading} />
        <ActivityCard items={stats?.recentActivity} loading={loading} />
      </div>

      {/* Milestones */}
      <MilestonesCard completionRate={completionRate} kpis={kpis} loading={loading} />

      {/* Company snapshot */}
      <div className={`rounded-2xl overflow-hidden ${card}`}>
        <div className={`px-5 py-4 border-b flex items-center gap-2.5 ${cardBorderB}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tealChip}`}>
            <Building2 size={15} />
          </div>
          <h2 className={`text-[14px] font-semibold ${textPrimary}`} style={{ fontFamily: 'var(--font-display)' }}>
            Company Snapshot
          </h2>
        </div>
        <dl className={`divide-y ${divide}`}>
          <Row label="Company" value={user?.company?.name ?? '—'} />
          <Row label="Client accounts" value={loading ? '—' : String(stats?.clients ?? 0)} />
          <Row label="Team members" value={loading ? '—' : String(stats?.users ?? 0)} />
          <Row label="BGV cases" value={loading ? '—' : String(stats?.bgvCases ?? 0)} />
        </dl>
      </div>

      {/* Logged-in user */}
      <div className={`rounded-2xl overflow-hidden ${card}`}>
        <div className={`px-5 py-4 border-b flex items-center gap-2.5 ${cardBorderB}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${amberChip}`}>
            <ShieldCheck size={15} />
          </div>
          <h2 className={`text-[14px] font-semibold ${textPrimary}`} style={{ fontFamily: 'var(--font-display)' }}>
            Your Account
          </h2>
        </div>
        <dl className={`divide-y ${divide}`}>
          <Row label="Name" value={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || '—'} />
          <Row label="Email" value={user?.email || '—'} />
          <Row label="Role" value={user?.role?.name || '—'} />
          <Row
            label="Status"
            value={
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  user?.status === 'ACTIVE' ? tealBadge : dangerBadge
                }`}
              >
                {user?.status || '—'}
              </span>
            }
          />
          <Row label="Company" value={user?.company?.name ?? '—'} />
        </dl>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Hero greeting
------------------------------------------------------------------- */

function HeroGreeting({
  period,
  theme,
  quote,
  dateLabel,
  timeLabel,
  firstName,
  lastName,
  role,
  isDark,
}: {
  period: Period;
  theme: (typeof PERIODS)[Period];
  quote: string;
  dateLabel: string;
  timeLabel: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  isDark: boolean;
}) {
  const Icon = theme.icon;
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border ${cardBorderB} bg-gradient-to-br ${
        isDark ? theme.heroDark : theme.heroLight
      } ${isDark ? 'bg-[#161C3A]' : 'bg-white'}`}
    >
      {/* Floating particles — ambient, decorative, low-cost CSS animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full opacity-[0.18] animate-[float_ease-in-out_infinite]"
            style={{
              backgroundColor: theme.accent,
              width: 6 + (i % 4) * 4,
              height: 6 + (i % 4) * 4,
              left: `${(i * 9.7) % 100}%`,
              top: `${(i * 17.3) % 100}%`,
              animationDuration: `${6 + (i % 5)}s`,
              animationDelay: `${i * 0.4}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <motion.div
              initial={{ rotate: -8, scale: 0.9 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tealChip}`}
            >
              <Icon size={18} />
            </motion.div>
            <p
              className="text-[11px] uppercase tracking-[0.14em] text-[var(--primary)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {theme.greeting}
            </p>
          </div>
          <h1
            className={`text-[26px] font-semibold tracking-tight ${textPrimary}`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {theme.greeting}, {firstName} {lastName}
          </h1>
          <p className={`text-[13.5px] mt-1 ${textMuted}`}>{quote}</p>
          {role && (
            <span className={`inline-flex items-center mt-3 rounded-full px-2.5 py-1 text-[11px] font-medium ${tealBadge}`}>
              {role}
            </span>
          )}
        </div>

        <div className="flex gap-3">
          <div className={`rounded-2xl px-4 py-3 text-[13px] shrink-0 ${card}`}>
            <span className={`flex items-center gap-1.5 text-[11px] ${textMuted}`}>
              <Clock size={11} /> Time
            </span>
            <span
              className={`text-[18px] font-semibold tabular-nums ${textPrimary}`}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {timeLabel}
            </span>
          </div>
          <div className={`rounded-2xl px-4 py-3 text-[13px] shrink-0 ${card}`}>
            <span className={`flex items-center gap-1.5 text-[11px] ${textMuted}`}>
              <Calendar size={11} /> Date
            </span>
            <span className={`text-[13px] font-medium ${textPrimary}`}>{dateLabel}</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(6px, -10px); }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------
   Stat cards
------------------------------------------------------------------- */

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  loading,
}: {
  title: string;
  value?: number;
  icon: LucideIcon;
  color: 'teal' | 'amber';
  loading: boolean;
}) {
  const animated = useCountUp(value);
  return (
    <div className={`rounded-2xl p-5 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/[0.03] transition-all duration-200 ${card}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-4 ${color === 'teal' ? tealChip : amberChip}`}>
        <Icon size={17} />
      </div>
      {loading ? (
        <div className={`h-[26px] w-14 ${skeleton}`} />
      ) : (
        <p className={`text-[26px] font-semibold tracking-tight tabular-nums ${textPrimary}`} style={{ fontFamily: 'var(--font-display)' }}>
          {animated ?? '—'}
        </p>
      )}
      <p className={`text-[12.5px] mt-1 ${textMuted}`}>{title}</p>
    </div>
  );
}

function MiniStat({ label, value, loading }: { label: string; value?: number; loading: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      {loading ? (
        <div className={`h-[18px] w-8 ${skeleton}`} />
      ) : (
        <span className={`text-[16px] font-semibold ${textPrimary}`} style={{ fontFamily: 'var(--font-display)' }}>
          {value ?? '—'}
        </span>
      )}
      <span className={`text-[11.5px] ${textFaint}`}>{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------
   AI insight widget — typewriter over real, computed sentences
------------------------------------------------------------------- */

function AIInsightCard({ insights, loading, isDark }: { insights: string[]; loading: boolean; isDark: boolean }) {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (insights.length === 0) return;
    setTyped('');
    const text = insights[index % insights.length];
    let i = 0;
    const typeId = setInterval(() => {
      i += 1;
      setTyped(text.slice(0, i));
      if (i >= text.length) clearInterval(typeId);
    }, 18);
    const rotateId = setTimeout(() => setIndex((v) => v + 1), 5200);
    return () => {
      clearInterval(typeId);
      clearTimeout(rotateId);
    };
  }, [index, insights]);

  if (!loading && insights.length === 0) return null;

  return (
    <div
      className={`rounded-2xl p-5 border ${cardBorderB} bg-gradient-to-r ${
        isDark ? 'from-[var(--primary)]/[0.08] to-[#8891B8]/[0.05]' : 'from-[var(--primary)]/[0.06] to-slate-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tealChip}`}>
          <Sparkles size={15} />
        </div>
        <div className="min-h-[20px] flex-1">
          <p className={`text-[11px] uppercase tracking-[0.1em] mb-1 ${textFaint}`} style={{ fontFamily: 'var(--font-mono)' }}>
            Insight
          </p>
          {loading ? (
            <div className={`h-[16px] w-2/3 ${skeleton}`} />
          ) : (
            <p className={`text-[13.5px] ${textPrimary}`}>
              {typed}
              <span className="inline-block w-[2px] h-[14px] bg-[var(--primary)] ml-0.5 align-middle animate-pulse" />
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Pie charts
------------------------------------------------------------------- */

function PieCard({
  title,
  description,
  data,
  loading,
  emptyLabel,
  isDark,
}: {
  title: string;
  description: string;
  data: { name: string; value: number }[];
  loading: boolean;
  emptyLabel: string;
  isDark: boolean;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className={`rounded-2xl overflow-hidden ${card}`}>
      <div className={`px-5 py-4 border-b flex items-center gap-2.5 ${cardBorderB}`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tealChip}`}>
          <FileCheck2 size={15} />
        </div>
        <div>
          <h2 className={`text-[14px] font-semibold ${textPrimary}`} style={{ fontFamily: 'var(--font-display)' }}>
            {title}
          </h2>
          <p className={`text-[11.5px] ${textFaint}`}>{description}</p>
        </div>
      </div>

      <div className="p-5">
        {loading ? (
          <div className={`h-[220px] rounded-xl ${skeleton}`} />
        ) : total === 0 ? (
          <div className={`h-[220px] flex items-center justify-center text-[12.5px] text-center px-6 ${textFaint}`}>
            {emptyLabel}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                stroke="none"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: isDark ? 'var(--primary-foreground)' : '#FFFFFF',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.08)',
                  borderRadius: 10,
                  fontSize: 12.5,
                  color: isDark ? '#F2F4FA' : '#0F172A',
                }}
                itemStyle={{ color: isDark ? '#F2F4FA' : '#0F172A' }}
              />
              <Legend
                verticalAlign="bottom"
                height={32}
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span style={{ color: isDark ? '#AAB2D4' : '#475569', fontSize: 12 }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Performance overview — radial KPI charts
------------------------------------------------------------------- */

function PerformanceOverview({
  kpis,
  loading,
  isDark,
}: {
  kpis: { label: string; value: number; fill: string }[];
  loading: boolean;
  isDark: boolean;
}) {
  return (
    <div className={`rounded-2xl overflow-hidden ${card}`}>
      <div className={`px-5 py-4 border-b flex items-center gap-2.5 ${cardBorderB}`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${amberChip}`}>
          <Activity size={15} />
        </div>
        <div>
          <h2 className={`text-[14px] font-semibold ${textPrimary}`} style={{ fontFamily: 'var(--font-display)' }}>
            Performance Overview
          </h2>
          <p className={`text-[11.5px] ${textFaint}`}>Key ratios derived from current case data</p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-5">
        {(loading ? Array.from({ length: 4 }) : kpis).map((kpi: any, i: number) => (
          <div key={i} className="flex flex-col items-center">
            {loading ? (
              <div className={`h-[110px] w-[110px] rounded-full ${skeleton}`} />
            ) : (
              <ResponsiveContainer width={110} height={110}>
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="70%"
                  outerRadius="100%"
                  barSize={8}
                  data={[{ value: kpi.value }]}
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar background={{ fill: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }} dataKey="value" cornerRadius={8} fill={kpi.fill} />
                  <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={textPrimary}
                    style={{ fontSize: 16, fontWeight: 600, fill: isDark ? '#F2F4FA' : '#0F172A' }}
                  >
                    {kpi.value}%
                  </text>
                </RadialBarChart>
              </ResponsiveContainer>
            )}
            <p className={`text-[11.5px] text-center mt-1 ${textMuted}`}>{loading ? <span className={`inline-block h-[12px] w-16 ${skeleton}`} /> : kpi.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Schedule + activity — real data when the backend provides it,
   an honest empty state otherwise (no fabricated placeholder rows).
------------------------------------------------------------------- */

function ScheduleCard({
  items,
  loading,
}: {
  items?: { time: string; title: string; subtitle: string; status: 'confirmed' | 'tentative' | 'due' }[];
  loading: boolean;
}) {
  const statusStyle: Record<string, string> = {
    confirmed: tealBadge,
    tentative: amberChip,
    due: dangerBadge,
  };
  return (
    <div className={`rounded-2xl overflow-hidden ${card}`}>
      <div className={`px-5 py-4 border-b flex items-center gap-2.5 ${cardBorderB}`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tealChip}`}>
          <CalendarClock size={15} />
        </div>
        <h2 className={`text-[14px] font-semibold ${textPrimary}`} style={{ fontFamily: 'var(--font-display)' }}>
          Today's Schedule
        </h2>
      </div>
      <div className="p-5">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`h-[44px] rounded-xl ${skeleton}`} />
            ))}
          </div>
        ) : !items || items.length === 0 ? (
          <div className={`py-8 text-center text-[12.5px] ${textFaint}`}>Nothing scheduled for today.</div>
        ) : (
          <ul className="space-y-1">
            {items.map((item, i) => (
              <li key={i} className={`flex items-center gap-3 py-2.5 border-b last:border-0 ${divide}`}>
                <span className={`text-[11.5px] w-16 shrink-0 tabular-nums ${textFaint}`}>{item.time}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-medium truncate ${textPrimary}`}>{item.title}</p>
                  <p className={`text-[11.5px] truncate ${textFaint}`}>{item.subtitle}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${statusStyle[item.status]}`}>
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ActivityCard({
  items,
  loading,
}: {
  items?: { id: string; label: string; actor: string; timestamp: string; kind: 'success' | 'info' | 'warning' }[];
  loading: boolean;
}) {
  const dotStyle: Record<string, string> = {
    success: 'bg-[var(--primary)]',
    info: 'bg-[#8891B8]',
    warning: 'bg-[#F2AE55]',
  };
  return (
    <div className={`rounded-2xl overflow-hidden ${card}`}>
      <div className={`px-5 py-4 border-b flex items-center gap-2.5 ${cardBorderB}`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${amberChip}`}>
          <ClipboardList size={15} />
        </div>
        <h2 className={`text-[14px] font-semibold ${textPrimary}`} style={{ fontFamily: 'var(--font-display)' }}>
          Recent Activity
        </h2>
      </div>
      <div className="p-5">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`h-[36px] rounded-xl ${skeleton}`} />
            ))}
          </div>
        ) : !items || items.length === 0 ? (
          <div className={`py-8 text-center text-[12.5px] ${textFaint}`}>No recent activity to show yet.</div>
        ) : (
          <ul className="relative pl-4">
            <span className={`absolute left-[5px] top-1 bottom-1 w-px ${divide.includes('divide') ? 'bg-slate-100 dark:bg-white/[0.06]' : ''}`} />
            {items.map((item) => (
              <li key={item.id} className="relative pb-4 last:pb-0">
                <span className={`absolute -left-4 top-1 w-2 h-2 rounded-full ${dotStyle[item.kind]}`} />
                <p className={`text-[13px] ${textPrimary}`}>
                  <span className="font-medium">{item.actor}</span> {item.label}
                </p>
                <p className={`text-[11px] ${textFaint}`}>{item.timestamp}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Milestones — real progress toward defined targets, no fake badges
------------------------------------------------------------------- */

function MilestonesCard({
  completionRate,
  kpis,
  loading,
}: {
  completionRate: number | null;
  kpis: { label: string; value: number; fill: string }[];
  loading: boolean;
}) {
  const reportKpi = kpis.find((k) => k.label === 'Report Issuance');
  const milestones = [
    {
      icon: Trophy,
      label: 'Verification completion',
      value: completionRate ?? 0,
      goal: 100,
      celebratory: (completionRate ?? 0) >= 90,
    },
    {
      icon: Target,
      label: 'Report issuance coverage',
      value: reportKpi?.value ?? 0,
      goal: 100,
      celebratory: (reportKpi?.value ?? 0) >= 90,
    },
  ];

  return (
    <div className={`rounded-2xl overflow-hidden ${card}`}>
      <div className={`px-5 py-4 border-b flex items-center gap-2.5 ${cardBorderB}`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tealChip}`}>
          <Trophy size={15} />
        </div>
        <h2 className={`text-[14px] font-semibold ${textPrimary}`} style={{ fontFamily: 'var(--font-display)' }}>
          Milestones
        </h2>
      </div>
      <div className="p-5 space-y-4">
        {milestones.map((m, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`flex items-center gap-1.5 text-[12.5px] ${textPrimary}`}>
                <m.icon size={13} className={m.celebratory ? 'text-[var(--primary)]' : textFaint} />
                {m.label}
              </span>
              <span className={`text-[12px] tabular-nums ${textMuted}`}>{loading ? '—' : `${m.value}%`}</span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${skeleton.includes('animate-pulse') ? 'bg-slate-100 dark:bg-white/[0.06]' : ''}`}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: loading ? 0 : `${m.value}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${m.celebratory ? 'bg-[var(--primary)] shadow-[0_0_10px_var(--primary)]' : 'bg-[#8891B8]'}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <dt className={`text-[13px] ${textMuted}`}>{label}</dt>
      <dd className={`text-[13.5px] ${textPrimary}`}>{value}</dd>
    </div>
  );
}