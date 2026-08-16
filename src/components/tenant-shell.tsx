"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, CreditCard, Wrench, FileText, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { SupportBanner } from "@/components/support-banner";
import { FeedbackWidget } from "@/components/feedback-widget";

const navItems = [
  { label: "Dashboard", href: "/portal", icon: Home },
  { label: "Payments", href: "/portal/payments", icon: CreditCard },
  { label: "Maintenance", href: "/portal/maintenance", icon: Wrench },
  { label: "My Lease", href: "/portal/lease", icon: FileText },
];

/**
 * The resident portal's chrome.
 *
 * Split out of the layout so that file can be a Server Component and mark the
 * group dynamic — see src/app/(tenant)/layout.tsx for why that matters. Nothing
 * about the markup changed in the move.
 */
export function TenantShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* An operator looking through a resident's eyes lands here. Mistaking
          someone else's tenancy for your own would do the most damage in this
          shell, so the banner belongs here more than anywhere. */}
      <SupportBanner />
      <FeedbackWidget />

      {/* Top Bar */}
      <header className="sticky top-0 z-50 h-14 border-b border-border/50 bg-card/80 backdrop-blur-xl flex items-center px-4 sm:px-6 justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg gradient-brand flex items-center justify-center">
            <Home className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold font-heading">RentOS</h1>
            <p className="text-[10px] text-muted-foreground">Tenant Portal</p>
          </div>
        </div>

        <nav className="hidden sm:flex items-center gap-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                pathname === item.href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{user?.displayName || "Tenant"}</span>
          </div>
          <button onClick={handleLogout} className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Mobile Nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-card/95 backdrop-blur-xl flex items-center justify-around py-2">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] transition-colors",
              pathname === item.href ? "text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Main Content */}
      <main className="p-4 sm:p-6 max-w-4xl mx-auto pb-24 sm:pb-6">
        {children}
      </main>
    </div>
  );
}
