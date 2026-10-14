'use client';

import { type CSSProperties, type ReactNode, useState } from 'react';
import { useAuth } from '@/src/auth/AuthProvider';
import AuthStorage from '@/src/auth/auth-storage';
import CompanyNavbar from './CompanyNavbar';
import CompanySidebar from './CompanySidebar';
import AchuHelpAssistant from './AchuHelpAssistant';
import { ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

export default function CompanyDashboardShell({ children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isImpersonating, stopImpersonation } = useAuth();
  const [stoppingImpersonation, setStoppingImpersonation] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const impersonation = AuthStorage.getImpersonation()?.impersonation;
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
        {isImpersonating && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F2AE55]/40 bg-[#F2AE55]/15 px-4 py-3 text-sm text-[var(--foreground)]">
            <div className="flex items-center gap-2">
              <ShieldAlert size={17} className="shrink-0 text-[#F2AE55]" />
              <span>
                Temporary superadmin access — viewing {user?.company?.name || 'company'} as {user?.firstName} {user?.lastName}.
                {impersonation?.expiresAt && (
                  <span className="ml-1 text-[var(--muted)]">
                    Expires {new Date(impersonation.expiresAt).toLocaleTimeString()}.
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {stopError && <span role="alert" className="text-xs text-[var(--danger)]">{stopError}</span>}
              <button
                type="button"
                disabled={stoppingImpersonation}
                onClick={async () => {
                  setStoppingImpersonation(true);
                  setStopError(null);
                  try {
                    await stopImpersonation();
                  } catch (error) {
                    setStopError(error instanceof Error ? error.message : 'Unable to stop temporary access.');
                  } finally {
                    setStoppingImpersonation(false);
                  }
                }}
                className="rounded-md border border-[var(--foreground)]/20 px-3 py-1.5 text-xs font-semibold hover:bg-black/5 disabled:opacity-50"
              >
                {stoppingImpersonation ? 'Stopping…' : 'Stop access'}
              </button>
            </div>
          </div>
        )}
        <CompanyNavbar onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-32 md:px-7 md:pt-7 md:pb-32">{children}</main>
      </div>
      <AchuHelpAssistant />
    </div>
  );
}