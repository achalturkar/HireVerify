'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Mail, Menu, X } from 'lucide-react';
import { ThemeToggle } from '@/src/components/layout/theme-toggle';
import BrandMark from '@/src/components/ui/BrandMark';

// These four were already theme-aware via var(--surface)/var(--border)/
// var(--primary)/var(--foreground) — left untouched below. Everything
// else in this file was hardcoded to dark-mode hex values (#AAB2D4,
// #F2F4FA, white/[0.05]), which is why links/icons disappeared or went
// low-contrast in light mode. Those get dark: pairs below instead.
const linkIdle = 'text-slate-500 dark:text-[#AAB2D4]';
const linkHover = 'hover:text-slate-900 dark:hover:text-[#F2F4FA] hover:bg-slate-100 dark:hover:bg-white/[0.05]';
const linkActive = 'text-[#3FDCC0] bg-[#3FDCC0]/10'; // brand accent, already reads fine on light or dark
const iconMuted = 'text-slate-500 dark:text-[#AAB2D4] hover:text-slate-900 dark:hover:text-[#F2F4FA] hover:bg-slate-100 dark:hover:bg-white/[0.05]';

const LINKS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/contact', label: 'Contact', icon: Mail },
];

export default function PublicNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-xl shadow-sm">
      <nav className="max-w-6xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)]/12 text-[var(--primary)] transition-colors group-hover:bg-[var(--primary)]/20">
            <BrandMark size={20} />
          </span>
          <span
            className="text-[15px] font-semibold text-[var(--foreground)] tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            HireVerify
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium  ${
                  active ? linkActive : `${linkIdle} ${linkHover}`
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
          <ThemeToggle />
          <Link
            href="/login"
            className="ml-2 rounded-lg bg-[#3FDCC0] text-[#0B0F26] text-[13px] font-semibold px-4 py-2 hover:bg-[#3FDCC0]/90 transition-colors"
          >
            Sign in
          </Link>
        </div>

        {/* Mobile controls: theme toggle, sign in, hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-lg bg-[#3FDCC0] text-[#0B0F26] text-[13px] font-semibold px-3.5 py-2 hover:bg-[#3FDCC0]/90 transition-colors"
          >
            Sign in
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${iconMuted}`}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {open && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-xl px-4 py-3 flex flex-col gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
                  active ? linkActive : `${linkIdle} ${linkHover}`
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}