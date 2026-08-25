'use client';

import { type CSSProperties, type ReactNode, useState } from 'react';
import { useAuth } from '@/src/auth/AuthProvider';
import CompanyNavbar from './CompanyNavbar';
import CompanySidebar from './CompanySidebar';

interface Props {
  children: ReactNode;
}

export default function CompanyDashboardShell({ children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const primaryColor = /^#[0-9a-f]{3,6}$/i.test(user?.company?.primaryColor || '')
    ? user?.company?.primaryColor
    : '#3FDCC0';
  const primaryForeground = primaryColor && (() => {
    const hex = primaryColor.length === 4
      ? primaryColor.slice(1).split('').map((part: string) => part + part).join('')
      : primaryColor.slice(1);
    const red = parseInt(hex.slice(0, 2), 16);
    const green = parseInt(hex.slice(2, 4), 16);
    const blue = parseInt(hex.slice(4, 6), 16);
    return (0.299 * red + 0.587 * green + 0.114 * blue) > 150 ? '#0B0F26' : '#FFFFFF';
  })();

  return (
    <div
      className="min-h-screen flex bg-[var(--background)] text-[var(--foreground)]"
      style={{
        '--primary': primaryColor,
        '--primary-foreground': primaryForeground,
        '--tenant-primary-soft': `color-mix(in srgb, ${primaryColor} 14%, transparent)`,
        '--tenant-primary-border': `color-mix(in srgb, ${primaryColor} 35%, transparent)`,
      } as CSSProperties}
    >
      <CompanySidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <CompanyNavbar onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-7">{children}</main>
      </div>
    </div>
  );
}