'use client';

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/auth/AuthProvider";

interface Props {
  children: ReactNode;
}

export default function PublicRoute({ children }: Props) {

  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {

    if (loading) return;

    if (!user) return;

    if (user.role.isClientUser) {
      router.replace(user.client?.parentClientId ? "/subclient-portal" : "/client-portal");
      return;
    }

    if (user.role.isSuperAdmin) {
      router.replace("/super-admin/dashboard");
      return;
    }

    if (user.role.isCompanyAdmin) {
      router.replace("/company/dashboard");
      return;
    }

    router.replace("/dashboard");

  }, [loading, user, router]);

  // Wait until auth check finishes
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0E1226] text-white">
        Loading...
      </div>
    );
  }

  // Logged in -> don't render login page
  if (user) {
    return null;
  }

  // Not logged in
  return <>{children}</>;
}