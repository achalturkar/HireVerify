import type { ComponentType, SVGProps } from 'react';
import {
  Building,
  BriefcaseBusiness,
  ContactRound,
  Users,
  Shield,
  Key,
  ClipboardList,
  Folder,
} from 'lucide-react'

export interface MenuItem {
  key: string;
  label: string;
  path: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/**
 * Known modules get a curated label / icon / route. Anything else (new
 * permission modules added later, e.g. "assessment" or "billing") still
 * shows up automatically — it just falls back to a generic look until
 * someone registers it here. That's what makes the menu "fully dynamic":
 * nothing needs to change on the frontend when a new module is added on
 * the backend, this registry is purely cosmetic.
 */
const MODULE_REGISTRY: Record<string, { label: string; path: string; icon: MenuItem['icon'] }> = {
  company: { label: 'Companies', path: '/super-admin/companies', icon: Building },
  user: { label: 'Users', path: '/super-admin/users', icon: Users },
  client: { label: 'Clients', path: '/super-admin/client', icon: BriefcaseBusiness },
  candidate: { label: 'Candidates', path: '/super-admin/candidate', icon: ContactRound },
  role: { label: 'Roles', path: '/super-admin/roles', icon: Shield },
  permission: { label: 'Permissions', path: '/super-admin/permissions', icon: Key },
  auditlog: { label: 'Audit Logs', path: '/super-admin/audit', icon: ClipboardList },
};

// Modules listed here (if present) are pinned to the top of the
// Administration section, in this order. Anything else found in the user's
// permissions is appended afterwards, alphabetically.
const PRIORITY_ORDER = ['company', 'client', 'candidate', 'user', 'role', 'permission', 'auditlog'];

function normalizeModule(rawModule: string): string {
  return rawModule.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function humanize(moduleKey: string): string {
  const spaced = moduleKey.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');
  const words = spaced.trim().split(/\s+/);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** Extracts the distinct set of modules a user has any permission in, from keys like "company.create". */
export function extractModules(permissions: string[]): string[] {
  const set = new Set<string>();
  permissions.forEach((p) => {
    const [moduleName] = p.split('.');
    if (moduleName) set.add(normalizeModule(moduleName));
  });
  return Array.from(set);
}

/** Builds the Administration section of the sidebar purely from the user's permission set. */
export function buildAdminMenu(permissions: string[]): MenuItem[] {
  // Dashboard is the primary navigation item rendered by Sidebar. Excluding
  // it here prevents a second permission-derived Dashboard entry.
  const modules = extractModules(permissions).filter((module) => module !== 'dashboard');

  const ordered = [
    ...PRIORITY_ORDER.filter((m) => modules.includes(m)),
    ...modules.filter((m) => !PRIORITY_ORDER.includes(m)).sort(),
  ];

  return ordered.map((moduleKey) => {
    const registered = MODULE_REGISTRY[moduleKey];
    if (registered) {
      return { key: moduleKey, ...registered };
    }
    // Fallback for unregistered modules — still shows up, just generically.
    const label = humanize(moduleKey);
    return {
      key: moduleKey,
      label,
      path: `/super-admin/${moduleKey}`,
      icon: Folder,
    };
  });
}

/** True if the user's permission list contains an exact permission key, e.g. "company.create". */
export function can(permissions: string[], key: string): boolean {
  return permissions.includes(key);
}

/** True if the user has any permission at all within a module, e.g. any "role.*". */
export function canAny(permissions: string[], moduleName: string): boolean {
  const target = normalizeModule(moduleName);
  return extractModules(permissions).includes(target);
}