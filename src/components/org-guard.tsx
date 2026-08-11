"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { RentosMark } from "@/components/rentos-mark";
import { useAuthStore } from "@/lib/store";
import { useOrganization } from "@/lib/use-org";
import { isStaffRole } from "@/lib/roles";

/**
 * Keeps staff out of the app until their organization actually exists.
 *
 * Signing up mints an org id on the profile but no organization document. In
 * that half-created state the app looks like it works — the dashboard renders,
 * queries return nothing — while the public intake pages silently refuse writes,
 * because the rules require the named organization to be real. Sending the user
 * to onboarding is the difference between "empty portfolio" and "not set up".
 *
 * Only staff are gated. Tenants and contractors are attached to an organization
 * that already exists, and have nothing to found.
 */
export function OrgGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { exists, loading, error } = useOrganization();

  const needsOnboarding =
    !loading && !error && !!user && isStaffRole(user.role) && !exists;

  React.useEffect(() => {
    if (needsOnboarding) router.replace("/onboarding");
  }, [needsOnboarding, router]);

  if (loading || needsOnboarding) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-brand shadow-lg shadow-primary/25 animate-pulse">
            <RentosMark className="h-8 w-8 text-white" />
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            {needsOnboarding ? "Setting up your workspace..." : "Loading RentOS..."}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
