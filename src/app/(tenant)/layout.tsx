import { AuthGuard } from "@/components/auth-guard";
import { TenantShell } from "@/components/tenant-shell";

/**
 * Rendered per request for the same reason the staff shell is: a prerendered
 * route is a file on the CDN, and a file cannot answer an `RSC: 1` navigation
 * request with anything but itself. Next asks for a flight payload, gets a whole
 * HTML document, and reloads the browser instead of navigating — which for a
 * resident moving between their payments and their lease meant re-downloading
 * and re-authenticating the entire application each time.
 *
 * See src/app/(app)/layout.tsx for the longer version.
 */
export const dynamic = "force-dynamic";

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <TenantShell>{children}</TenantShell>
    </AuthGuard>
  );
}
