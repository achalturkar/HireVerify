'use client';

import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Search, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { listPermissions } from '@/src/lib/api/permission.api';
import { groupPermissionsByModule, type PermissionModuleGroup } from '@/src/types/permission';

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export default function SuperAdminPermissionsPage() {
  const { accessToken } = useAuth();
  const [groups, setGroups] = useState<PermissionModuleGroup[]>([]);
  const [search, setSearch] = useState('');
  const [activeModule, setActiveModule] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    listPermissions(accessToken)
      .then((permissions) => setGroups(groupPermissionsByModule(permissions)))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load permissions'))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    return groups
      .filter((group) => activeModule === 'all' || group.module === activeModule)
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter((permission) => !query
          || permission.key.toLowerCase().includes(query)
          || permission.action.toLowerCase().includes(query)
          || permission.description?.toLowerCase().includes(query)),
      }))
      .filter((group) => group.permissions.length > 0);
  }, [groups, search, activeModule]);

  const totalPermissions = groups.reduce((total, group) => total + group.permissions.length, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[#3FDCC0]" style={{ fontFamily: 'var(--font-mono)' }}>Administration / Access control</p>
        <h1 className="text-[28px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Permission catalogue</h1>
        <p className="mt-1 text-[13px] text-[#8891B8]">A platform-wide view of the capabilities available to enterprise roles.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#3FDCC0]/25 bg-[#161C3A] p-5"><div className="mb-3 flex items-center gap-2 text-[#3FDCC0]"><KeyRound size={17} /><span className="text-[11px] uppercase tracking-wide text-[#8891B8]">Total permissions</span></div><p className="text-[30px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{totalPermissions}</p></div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#161C3A] p-5"><div className="mb-3 flex items-center gap-2 text-[#F2AE55]"><ShieldCheck size={17} /><span className="text-[11px] uppercase tracking-wide text-[#8891B8]">Permission modules</span></div><p className="text-[30px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{groups.length}</p></div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#161C3A] p-5"><p className="mb-3 text-[11px] uppercase tracking-wide text-[#8891B8]">Current view</p><p className="text-[18px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{activeModule === 'all' ? 'All modules' : titleCase(activeModule)}</p><p className="mt-1 text-[11px] text-[#565F8C]">{filteredGroups.reduce((total, group) => total + group.permissions.length, 0)} visible permissions</p></div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#161C3A] p-4"><div className="flex flex-col gap-3 lg:flex-row"><label className="relative flex-1"><Search size={15} className="absolute left-3 top-3 text-[#565F8C]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search permission key, action, or description" className="w-full rounded-lg border border-white/[0.1] bg-[#0F1430] py-2.5 pl-9 pr-3 text-[12px] text-white outline-none focus:border-[#3FDCC0]" /></label><div className="flex flex-wrap gap-2">{['all', ...groups.map((group) => group.module)].map((module) => <button key={module} onClick={() => setActiveModule(module)} className={`rounded-lg border px-3 py-2 text-[11px] transition-colors ${activeModule === module ? 'border-[#3FDCC0]/50 bg-[#3FDCC0]/10 text-[#3FDCC0]' : 'border-white/[0.1] text-[#8891B8] hover:text-white'}`}>{module === 'all' ? 'All modules' : titleCase(module)}</button>)}</div></div></div>

      {error && <div className="rounded-xl border border-[#F48787]/30 bg-[#F48787]/10 px-5 py-4 text-[13px] text-[#F48787]">{error}</div>}
      {loading ? <div className="rounded-2xl border border-white/[0.08] bg-[#161C3A] px-5 py-12 text-center text-[13px] text-[#8891B8]">Loading permission catalogue...</div> : filteredGroups.length === 0 ? <div className="rounded-2xl border border-white/[0.08] bg-[#161C3A] px-5 py-12 text-center text-[13px] text-[#8891B8]">No permissions match this view.</div> : <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">{filteredGroups.map((group) => <section key={group.module} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#161C3A]"><div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4"><div><h2 className="text-[15px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{titleCase(group.module)}</h2><p className="mt-1 text-[11px] text-[#565F8C]">{group.permissions.length} capabilities</p></div><span className="rounded-lg bg-[#3FDCC0]/10 px-2.5 py-1 text-[10px] uppercase tracking-wide text-[#3FDCC0]" style={{ fontFamily: 'var(--font-mono)' }}>{group.module}</span></div><div className="divide-y divide-white/[0.06]">{group.permissions.map((permission) => <div key={permission.id} className="px-5 py-4"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="truncate text-[12px] font-semibold text-[#C7CBE0]">{permission.key}</p><p className="mt-1 text-[11px] text-[#8891B8]">{permission.description || 'No description provided'}</p></div><span className="shrink-0 rounded-md border border-white/[0.1] px-2 py-1 text-[10px] uppercase tracking-wide text-[#F2AE55]" style={{ fontFamily: 'var(--font-mono)' }}>{permission.action}</span></div></div>)}</div></section>)}</div>}
    </div>
  );
}