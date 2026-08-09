"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import type { UserRole } from "@/lib/types";
import { Loader2, ShieldX } from "lucide-react";
import { RentosMark } from "@/components/rentos-mark";

export function AuthGuard({
  children,
  roles,
}: {
  children: React.ReactNode;
  /** When set, the signed-in user's role must be one of these. */
  roles?: UserRole[];
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuthStore();

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-brand shadow-lg shadow-primary/25 animate-pulse">
            <RentosMark className="h-8 w-8 text-white" />
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading RentOS...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  if (roles && user && !roles.includes(user.role)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-3 max-w-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
            <ShieldX className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold font-heading">Not available for your account</h2>
          <p className="text-sm text-muted-foreground">
            This area is limited to {roles.join(" or ")} accounts. You are signed in as{" "}
            <span className="font-medium">{user.role}</span>.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
