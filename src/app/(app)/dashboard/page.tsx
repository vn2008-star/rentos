"use client";

import React from "react";
import {
  Building2, Home, Users, DollarSign, Wrench, FileText, TrendingUp,
  TrendingDown, ArrowUpRight, AlertTriangle, Calendar, BedDouble, Eye, Megaphone,
  Wifi, WifiOff
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProperties, useUnits, useTenants, useMaintenance, useApplications } from "@/lib/hooks";
import { useAuthStore } from "@/lib/store";
import { PendingTasks } from "@/components/pending-tasks";
import { mockDashboardStats } from "@/lib/mock-data";
import Link from "next/link";

const statusColors: Record<string, string> = {
  available: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  occupied: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  maintenance: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  reserved: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  sublet: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  offline: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

const priorityColors: Record<string, string> = {
  emergency: "bg-red-500/15 text-red-400",
  urgent: "bg-amber-500/15 text-amber-400",
  routine: "bg-blue-500/15 text-blue-400",
  scheduled: "bg-gray-500/15 text-gray-400",
};

const maintenanceStatusColors: Record<string, string> = {
  submitted: "bg-yellow-500/15 text-yellow-400",
  acknowledged: "bg-blue-500/15 text-blue-400",
  assigned: "bg-violet-500/15 text-violet-400",
  in_progress: "bg-amber-500/15 text-amber-400",
  completed: "bg-emerald-500/15 text-emerald-400",
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { properties, isLive: propLive, error: propError } = useProperties();
  const { units } = useUnits();
  const { tenants } = useTenants();
  const { requests: maintenanceRequests } = useMaintenance();
  const { applications } = useApplications();

  const isLive = propLive;

  // Compute live stats from hooks
  const totalUnits = units.length;
  const occupiedUnits = units.filter(u => u.status === "occupied").length;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100 * 10) / 10 : 0;
  const vacantUnits = units.filter(u => u.status === "available").length;
  const totalRent = units.filter(u => u.status === "occupied").reduce((s, u) => s + u.rent, 0);
  const pendingMaint = maintenanceRequests.filter(r => !["completed", "closed"].includes(r.status)).length;

  const revenueData = mockDashboardStats.revenueHistory;
  const maxRevenue = Math.max(...revenueData.map((d) => d.revenue));

  const stats = [
    { label: "Total Properties", value: properties.length, icon: Building2, change: `${properties.length} managed`, trend: "up" as const, color: "from-blue-500/20 to-cyan-500/20", iconColor: "text-blue-400" },
    { label: "Total Units", value: totalUnits, icon: Home, change: `${vacantUnits} vacant`, trend: "neutral" as const, color: "from-violet-500/20 to-purple-500/20", iconColor: "text-violet-400" },
    { label: "Occupancy Rate", value: `${occupancyRate}%`, icon: Users, change: `${occupiedUnits} of ${totalUnits} occupied`, trend: occupancyRate > 80 ? "up" as const : "neutral" as const, color: "from-emerald-500/20 to-teal-500/20", iconColor: "text-emerald-400" },
    { label: "Monthly Revenue", value: `$${(totalRent / 1000).toFixed(1)}k`, icon: DollarSign, change: `${pendingMaint} pending maint.`, trend: "up" as const, color: "from-amber-500/20 to-orange-500/20", iconColor: "text-amber-400" },
  ];

  const displayName = user?.displayName?.split(" ")[0] || "Manager";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Welcome back, {displayName}. Here&apos;s your portfolio overview.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          {/* Three distinct states — a failed read must never read as "Demo Mode",
              which would imply the numbers on screen are intentional samples. */}
          <Badge variant="outline" className={`gap-1.5 py-1 px-3 text-xs ${
            propError ? "text-red-400 border-red-500/30"
              : isLive ? "text-emerald-400 border-emerald-500/30"
              : "text-amber-400 border-amber-500/30"
          }`}>
            {propError
              ? <><WifiOff className="h-3 w-3" /> Connection Error</>
              : isLive
                ? <><Wifi className="h-3 w-3" /> Live Data</>
                : <><WifiOff className="h-3 w-3" /> Demo Mode</>}
          </Badge>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm hover:border-border transition-colors">
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-50`} />
            <CardContent className="relative p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold tracking-tight font-heading">{stat.value}</p>
                  <div className="flex items-center gap-1.5 text-xs">
                    {stat.trend === "up" ? (
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className={stat.trend === "up" ? "text-emerald-400" : "text-muted-foreground"}>
                      {stat.change}
                    </span>
                  </div>
                </div>
                <div className="rounded-xl bg-background/50 p-2.5">
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Revenue Overview</CardTitle>
              <Badge variant="outline" className="text-xs font-normal">Last 6 months</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {revenueData.map((d) => {
                const pct = (d.revenue / maxRevenue) * 100;
                const expPct = (d.expenses / maxRevenue) * 100;
                return (
                  <div key={d.month} className="group flex items-center gap-3">
                    <span className="w-8 text-xs font-medium text-muted-foreground">{d.month}</span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="h-3 rounded-full gradient-brand transition-all duration-500" style={{ width: `${pct}%` }} />
                        <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          ${(d.revenue / 1000).toFixed(1)}k
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 rounded-full bg-destructive/40 transition-all duration-500" style={{ width: `${expPct}%` }} />
                        <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                          ${(d.expenses / 1000).toFixed(1)}k exp
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full gradient-brand" /> Revenue
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/40" /> Expenses
              </div>
              <div className="ml-auto text-xs font-medium text-emerald-400 flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                Net: ${((totalRent - 17300) / 1000).toFixed(1)}k
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Add Property", icon: Building2, href: "/properties", color: "text-blue-400" },
              { label: "Post Vacancy", icon: Megaphone, href: "/listings", color: "text-violet-400" },
              { label: "New Application", icon: FileText, href: "/applications", color: "text-amber-400" },
              { label: "Maintenance", icon: Wrench, href: "/maintenance", color: "text-emerald-400" },
              { label: "View Leases", icon: BedDouble, href: "/leases", color: "text-cyan-400" },
              { label: "Financial Report", icon: DollarSign, href: "/financials", color: "text-orange-400" },
            ].map((action) => (
              <Link key={action.label} href={action.href}>
                <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent/50 transition-colors group cursor-pointer">
                  <div className="rounded-lg bg-accent/50 p-2 group-hover:bg-accent transition-colors">
                    <action.icon className={`h-4 w-4 ${action.color}`} />
                  </div>
                  <span className="text-sm font-medium">{action.label}</span>
                  <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Everything that needs chasing, derived from the records themselves. */}
      <PendingTasks />

      {/* Bottom Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent Maintenance */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                Recent Maintenance
              </CardTitle>
              <Link href="/maintenance">
                <Button variant="ghost" size="sm" className="text-xs h-7">
                  View all <ArrowUpRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {maintenanceRequests.slice(0, 4).map((req) => (
              <div key={req.id} className="flex items-start gap-3 rounded-lg p-3 bg-accent/30 hover:bg-accent/50 transition-colors">
                <div className={`mt-0.5 rounded-lg p-2 ${priorityColors[req.priority]}`}>
                  {req.priority === "emergency" ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <Wrench className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{req.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{req.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className={`text-[10px] ${maintenanceStatusColors[req.status]}`}>
                      {req.status.replace("_", " ")}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] ${priorityColors[req.priority]}`}>
                      {req.priority}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Unit Status Overview */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Home className="h-4 w-4 text-muted-foreground" />
                Unit Status
              </CardTitle>
              <Link href="/units">
                <Button variant="ghost" size="sm" className="text-xs h-7">
                  View all <ArrowUpRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { status: "available", count: units.filter(u => u.status === "available").length, label: "Available" },
                { status: "occupied", count: units.filter(u => u.status === "occupied").length, label: "Occupied" },
                { status: "maintenance", count: units.filter(u => u.status === "maintenance").length, label: "Maintenance" },
              ].map((s) => (
                <div key={s.status} className={`rounded-lg p-3 text-center border ${statusColors[s.status]}`}>
                  <p className="text-2xl font-bold font-heading">{s.count}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {units.slice(0, 5).map((unit) => {
                const property = properties.find(p => p.id === unit.propertyId);
                return (
                  <div key={unit.id} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-accent/30 transition-colors">
                    <div className={`h-2.5 w-2.5 rounded-full ${
                      unit.status === "available" ? "bg-emerald-400" :
                      unit.status === "occupied" ? "bg-blue-400" :
                      unit.status === "maintenance" ? "bg-amber-400" :
                      unit.status === "sublet" ? "bg-cyan-400" :
                      "bg-violet-400"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Unit {unit.unitNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">{property?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">${unit.rent.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{unit.beds}BR / {unit.baths}BA</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${statusColors[unit.status]}`}>
                      {unit.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
