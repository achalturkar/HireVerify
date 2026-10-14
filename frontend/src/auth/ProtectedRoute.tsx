'use client';

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

interface Props {
  children: ReactNode;
}

export default function ProtectedRoute({
  children,
}: Props) {

  const {
    user,
    loading,
  } = useAuth();

  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role.isClientUser) {
      router.replace("/client-portal");
      return;
    }

    if (user.role.isCompanyAdmin && window.location.pathname.startsWith('/super-admin')) {
      router.replace('/company/dashboard');
      return;
    }

    if (user.role.isSuperAdmin && window.location.pathname.startsWith('/company')) {
      router.replace('/super-admin/dashboard');
      return;
    }

    if (user.role.isCompanyAdmin === false && user.role.isSuperAdmin === false && window.location.pathname.startsWith('/company')) {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-lg">
        Loading...
      </div>
    );
  }

  if (!user || user.role.isClientUser) {
    return null;
  }

  if (user.role.isCompanyAdmin && window.location.pathname.startsWith('/super-admin')) {
    return null;
  }

  if (user.role.isSuperAdmin && window.location.pathname.startsWith('/company')) {
    return null;
  }

  return <>{children}</>;

}