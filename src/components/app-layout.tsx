"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Building2, Home, Users, FileText, Wrench, DollarSign,
  Megaphone, ArrowLeftRight, Settings, LogOut, ChevronLeft, ChevronRight,
  Search, Plus, BedDouble, Menu, X, HardHat, BarChart3, Eye, Briefcase,
  CalendarDays, ClipboardCheck, CreditCard, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/store";
import { useApplications, useMaintenance } from "@/lib/hooks";
import { useOrganization } from "@/lib/use-org";
import { SupportBanner } from "@/components/support-banner";
import { FeedbackWidget } from "@/components/feedback-widget";
import { useQuickAddStore, type QuickAddTarget } from "@/lib/quick-add";
import { RentosMark } from "@/components/rentos-mark";

/**
 * `badgeKey` names a live count, resolved in the component below.
 *
 * These used to be the literals 2 and 3, so every organization was told it had
 * two applications and three maintenance requests waiting — including one
 * created a minute ago with neither.
 */
const navItems: {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: "applications" | "maintenance";
}[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Properties", href: "/properties", icon: Building2 },
  { label: "Units", href: "/units", icon: Home },
  { label: "Tenants", href: "/tenants", icon: Users },
  { label: "Applications", href: "/applications", icon: FileText, badgeKey: "applications" },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Inspections", href: "/inspections", icon: ClipboardCheck },
  { label: "Maintenance", href: "/maintenance", icon: Wrench, badgeKey: "maintenance" },
  { label: "Vendors", href: "/vendors", icon: HardHat },
  { label: "Owner View", href: "/owner", icon: Eye },
  { label: "Portfolio", href: "/portfolio", icon: Briefcase },
  { label: "Financials", href: "/financials", icon: DollarSign },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Listings", href: "/listings", icon: Megaphone },
  { label: "Sublets", href: "/sublets", icon: ArrowLeftRight },
  { label: "Leases", href: "/leases", icon: BedDouble },
];

/**
 * What Quick Add adds. Each entry navigates to the page that owns the record
 * and opens its existing add dialog — one shortcut rather than a second,
 * divergent copy of every form.
 */
const quickAddItems: {
  label: string;
  href: string;
  target: QuickAddTarget;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { label: "Property", href: "/properties", target: "property", icon: Building2 },
  { label: "Unit", href: "/units", target: "unit", icon: Home },
  { label: "Tenant", href: "/tenants", target: "tenant", icon: Users },
  { label: "Lease", href: "/leases", target: "lease", icon: BedDouble },
  { label: "Maintenance request", href: "/maintenance", target: "maintenance", icon: Wrench },
  { label: "Calendar event", href: "/calendar", target: "event", icon: CalendarDays },
  { label: "Vendor", href: "/vendors", target: "vendor", icon: HardHat },
];

const bottomItems = [
  { label: "Team", href: "/team", icon: Users },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logoutFn = useAuthStore((s) => s.logout);
  const requestQuickAdd = useQuickAddStore((s) => s.request);
  const isGuest = user?.role === "guest";
  const { org } = useOrganization();

  const { applications } = useApplications();
  const { requests: maintenanceRequests } = useMaintenance();

  // What is actually waiting for someone: applications still awaiting a
  // decision, and maintenance that is not finished. A badge showing every
  // record ever filed would never go down.
  const badgeCounts = {
    applications: applications.filter((a) =>
      ["submitted", "reviewing", "screening"].includes(a.status)
    ).length,
    maintenance: maintenanceRequests.filter(
      (r) => !["completed", "closed"].includes(r.status)
    ).length,
  };

  const handleLogout = async () => {
    await logoutFn();
    router.push("/login");
  };

  return (
    <TooltipProvider delay={0}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Mobile Overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out lg:relative",
            collapsed ? "w-[68px]" : "w-[260px]",
            mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg gradient-brand shadow-lg shadow-primary/25">
              <RentosMark className="h-6 w-6 text-white" />
            </div>
            {!collapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-base font-bold tracking-tight font-heading text-sidebar-foreground">
                  RentOS
                </span>
                <span className="text-[10px] font-medium uppercase tracking-widest text-sidebar-foreground/50">
                  Property Management
                </span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-7 w-7 shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent lg:flex hidden"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-7 w-7 shrink-0 text-sidebar-foreground/60 lg:hidden"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
              const badge = item.badgeKey ? badgeCounts[item.badgeKey] : 0;
              const linkContent = (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full gradient-brand" />
                  )}
                  <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-sidebar-primary")} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {badge > 0 && (
                        <Badge className="h-5 min-w-5 px-1.5 text-[10px] font-semibold gradient-brand text-white border-0">
                          {badge > 99 ? "99+" : badge}
                        </Badge>
                      )}
                    </>
                  )}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger render={linkContent} />
                    <TooltipContent side="right" className="flex items-center gap-2">
                      {item.label}
                      {badge > 0 && <Badge variant="secondary" className="h-5 text-[10px]">{badge}</Badge>}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return <React.Fragment key={item.href}>{linkContent}</React.Fragment>;
            })}
          </nav>

          {/* Bottom section */}
          <div className="border-t border-sidebar-border px-3 py-3 space-y-1">
            {/* RentOS operators only — customers never see this. */}
            {user?.role === "super_admin" && (
              <Link
                href="/admin"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  pathname === "/admin"
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                <ShieldCheck className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span>RentOS Admin</span>}
              </Link>
            )}
            {bottomItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}

            {/* User profile */}
            <div className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 mt-2",
              collapsed ? "justify-center" : ""
            )}>
              <Avatar className="h-8 w-8 shrink-0 ring-2 ring-sidebar-primary/30">
                <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs font-semibold">
                  {user?.displayName?.split(" ").map(n => n[0]).join("") || "U"}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium truncate">{user?.displayName || "User"}</p>
                  <p className="text-[11px] text-sidebar-foreground/50 truncate">{user?.role || "manager"}</p>
                </div>
              )}
              {!collapsed && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Bar */}
          <header className="flex h-16 items-center gap-4 border-b bg-card/80 glass px-4 lg:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search properties, tenants, units..."
                className="h-9 w-full rounded-lg border bg-muted/50 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {/* A demo visitor is shown the way out, not a Quick Add they
                  cannot use. Every write is refused by the rules regardless. */}
              {isGuest ? (
                <>
                  <Badge variant="outline" className="hidden gap-1.5 border-amber-500/30 py-1 text-xs text-amber-400 sm:flex">
                    <Eye className="h-3 w-3" /> Read-only demo
                  </Badge>
                  <Button
                    size="sm"
                    className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 gap-1.5"
                    render={<Link href="/register" />}
                  >
                    Start free trial
                  </Button>
                </>
              ) : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button size="sm" className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow gap-1.5">
                      <Plus className="h-4 w-4" />
                      <span className="hidden sm:inline">Quick Add</span>
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Add new</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {quickAddItems.map((item) => (
                    <DropdownMenuItem
                      key={item.target}
                      className="cursor-pointer gap-2.5"
                      onClick={() => {
                        // The dialog lives on the destination page; the store
                        // carries the intent across the navigation.
                        requestQuickAdd(item.target);
                        router.push(item.href);
                      }}
                    >
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              )}
            </div>
          </header>

          <SupportBanner />
      <FeedbackWidget />

          {isGuest && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-300 lg:px-6">
              <Eye className="h-3.5 w-3.5 shrink-0" />
              <span>
                You are exploring <strong>{org?.name ?? "a demo portfolio"}</strong> in
                read-only mode. Nothing you do here is saved, and this is not real data.
              </span>
              <Link href="/register" className="font-medium underline underline-offset-2 hover:text-amber-200">
                Start a free trial
              </Link>
            </div>
          )}

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
