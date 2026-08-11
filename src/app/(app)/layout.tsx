"use client";

import { AppLayout } from "@/components/app-layout";
import { AuthGuard } from "@/components/auth-guard";
import { OrgGuard } from "@/components/org-guard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <OrgGuard>
        <AppLayout>{children}</AppLayout>
      </OrgGuard>
    </AuthGuard>
  );
}
