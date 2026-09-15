import {
    LayoutDashboard,
    Building2,
    Users,
    Shield,
    KeyRound,
    ClipboardList,
    Settings
} from "lucide-react";

export const superAdminMenu = [

    {
        key: "dashboard",
        label: "Dashboard",
        path: "/super-admin/dashboard",
        icon: LayoutDashboard,
        permission: null
    },

    {
        key: "companies",
        label: "Companies",
        path: "/super-admin/companies",
        icon: Building2,
        permission: "company.view"
    },

    {
        key: "users",
        label: "Users",
        path: "/super-admin/users",
        icon: Users,
        permission: "users.view"
    },

    {
        key: "candidates",
        label: "Candidates",
        path: "/super-admin/candidates",
        icon: Users,
        permission: "candidate.view"
    },

    {
        key: "roles",
        label: "Roles",
        path: "/super-admin/roles",
        icon: Shield,
        permission: "roles.view"
    },

    {
        key: "permissions",
        label: "Permissions",
        path: "/super-admin/permissions",
        icon: KeyRound,
        permission: "permissions.view"
    },

    {
        key: "audit",
        label: "Audit Logs",
        path: "/super-admin/audit",
        icon: ClipboardList,
        permission: "audit.view"
    },

    {
        key: "settings",
        label: "Settings",
        path: "/super-admin/settings",
        icon: Settings,
        permission: null
    }

];