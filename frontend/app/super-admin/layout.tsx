import ProtectedRoute from "@/src/auth/ProtectedRoute";
import DashboardShell from "@/src/components/layout/DashboardShell";

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="super-admin-surface">
        <DashboardShell>
          {children}
        </DashboardShell>
      </div>
    </ProtectedRoute>
  );
}