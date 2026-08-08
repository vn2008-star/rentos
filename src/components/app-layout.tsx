"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Building2, Home, Users, FileText, Wrench, DollarSign,
  Megaphone, ArrowLeftRight, Settings, LogOut, ChevronLeft, ChevronRight,
  Bell, Search, Plus, BedDouble, Menu, X, HardHat, BarChart3, Eye, Briefcase,
  CalendarDays, ClipboardCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import { useAuthStore } from "@/lib/store";
import { NotificationBell } from "@/components/notification-bell";
import { RentosMark } from "@/components/rentos-mark";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Properties", href: "/properties", icon: Building2 },
  { label: "Units", href: "/units", icon: Home },
  { label: "Tenants", href: "/tenants", icon: Users },
  { label: "Applications", href: "/applications", icon: FileText, badge: 2 },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Inspections", href: "/inspections", icon: ClipboardCheck },
  { label: "Maintenance", href: "/maintenance", icon: Wrench, badge: 3 },
  { label: "Vendors", href: "/vendors", icon: HardHat },
  { label: "Owner View", href: "/owner", icon: Eye },
  { label: "Portfolio", href: "/portfolio", icon: Briefcase },
  { label: "Financials", href: "/financials", icon: DollarSign },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Listings", href: "/listings", icon: Megaphone },
  { label: "Sublets", href: "/sublets", icon: ArrowLeftRight },
  { label: "Leases", href: "/leases", icon: BedDouble },
];

const bottomItems = [
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logoutFn = useAuthStore((s) => s.logout);

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
                      {item.badge && (
                        <Badge className="h-5 min-w-5 px-1.5 text-[10px] font-semibold gradient-brand text-white border-0">
                          {item.badge}
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
                      {item.badge && <Badge variant="secondary" className="h-5 text-[10px]">{item.badge}</Badge>}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return <React.Fragment key={item.href}>{linkContent}</React.Fragment>;
            })}
          </nav>

          {/* Bottom section */}
          <div className="border-t border-sidebar-border px-3 py-3 space-y-1">
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
              <NotificationBell />
              <Button size="sm" className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow gap-1.5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Quick Add</span>
              </Button>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
