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

    console.log({
      loading,
      user,
    });

    if (loading) {

      return;

    }

    if (!user) {

      router.replace("/login");

    } else if (user.role.isClientUser) {

      router.replace("/client-portal");

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

  return <>{children}</>;

}