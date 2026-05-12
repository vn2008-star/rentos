"use client";

import React, { useState, useMemo } from "react";
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Home, Users, Wrench,
  HardHat, Calendar, Download, Building2, ArrowUpRight, Wifi, WifiOff,
  PieChart, Activity, Target, Clock, CheckCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useProperties, useUnits, useTenants, useMaintenance,
  useLeases, useTransactions, useVendors, useWorkOrders,
  useApplications, useListings,
} from "@/lib/hooks";
import { mockDashboardStats } from "@/lib/mock-data";

function BarViz({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return <div className={`h-5 rounded-md ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />;
}

function MiniDonut({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <div className="h-24 w-24 rounded-full border-4 border-border/30" />;
  let offset = 0;
  const size = 96;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <div className="relative">
      <svg width={size} height={size} className="-rotate-90">
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dash = circ * pct;
          const gap = circ - dash;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r}
              fill="none" stroke="currentColor" strokeWidth={stroke}
              strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset}
              className={seg.color} strokeLinecap="round"
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold font-heading">{total}</span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { properties, isLive } = useProperties();
  const { units } = useUnits();
  const { tenants } = useTenants();
  const { requests: maintenance } = useMaintenance();
  const { leases } = useLeases();
  const { transactions } = useTransactions();
  const { vendors } = useVendors();
  const { workOrders } = useWorkOrders();
  const { applications } = useApplications();
  const { listings } = useListings();
  const [period, setPeriod] = useState("6m");

  const revenueData = mockDashboardStats.revenueHistory;

  // Occupancy
  const totalUnits = units.length;
  const occupied = units.filter(u => u.status === "occupied").length;
  const available = units.filter(u => u.status === "available").length;
  const underMaint = units.filter(u => u.status === "maintenance").length;
  const occupancyRate = totalUnits > 0 ? Math.round((occupied / totalUnits) * 1000) / 10 : 0;

  // Financial
  const totalRevenue = transactions.filter(t => t.type === "rent" && t.status === "completed").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === "maintenance" && t.status === "completed").reduce((s, t) => s + t.amount, 0);
  const netIncome = totalRevenue - totalExpenses;
  const monthlyRent = units.filter(u => u.status === "occupied").reduce((s, u) => s + u.rent, 0);
  const avgRent = occupied > 0 ? Math.round(monthlyRent / occupied) : 0;

  // Maintenance
  const openMaint = maintenance.filter(r => !["completed", "closed"].includes(r.status)).length;
  const completedMaint = maintenance.filter(r => ["completed", "closed"].includes(r.status)).length;
  const emergencyMaint = maintenance.filter(r => r.priority === "emergency").length;
  const avgWOCost = (() => {
    const approved = workOrders.filter(wo => wo.totalCost && wo.status === "approved");
    return approved.length > 0 ? Math.round(approved.reduce((s, wo) => s + (wo.totalCost || 0), 0) / approved.length) : 0;
  })();

  // Leases
  const activeLeases = leases.filter(l => l.status === "active").length;
  const expiringLeases = leases.filter(l => l.status === "expiring_soon").length;

  // Applications
  const pendingApps = applications.filter(a => !["approved", "denied", "withdrawn"].includes(a.status)).length;
  const approvedApps = applications.filter(a => a.status === "approved").length;

  // Per-property breakdown
  const propertyBreakdown = useMemo(() => properties.map(p => {
    const pUnits = units.filter(u => u.propertyId === p.id);
    const pOccupied = pUnits.filter(u => u.status === "occupied").length;
    const pRevenue = pUnits.filter(u => u.status === "occupied").reduce((s, u) => s + u.rent, 0);
    const pMaint = maintenance.filter(m => m.propertyId === p.id && !["completed", "closed"].includes(m.status)).length;
    return { ...p, unitCount: pUnits.length, occupied: pOccupied, occupancy: pUnits.length > 0 ? Math.round((pOccupied / pUnits.length) * 100) : 0, revenue: pRevenue, openMaint: pMaint };
  }), [properties, units, maintenance]);

  const maxRevData = Math.max(...revenueData.map(d => d.revenue), 1);

  const handleExport = () => {
    const rows = [
      ["Metric", "Value"],
      ["Total Properties", properties.length],
      ["Total Units", totalUnits],
      ["Occupied", occupied],
      ["Occupancy Rate", `${occupancyRate}%`],
      ["Monthly Rent Roll", `$${monthlyRent}`],
      ["Avg Rent", `$${avgRent}`],
      ["Open Maintenance", openMaint],
      ["Active Leases", activeLeases],
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `rentos-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">Analytics & Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            Portfolio performance overview
            <Badge variant="outline" className={`text-[10px] gap-1 ${isLive ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"}`}>
              {isLive ? <><Wifi className="h-2.5 w-2.5" /> Live</> : <><WifiOff className="h-2.5 w-2.5" /> Demo</>}
            </Badge>
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={v => v != null && setPeriod(v)}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1m">Last Month</SelectItem>
              <SelectItem value="3m">Last 3 Months</SelectItem>
              <SelectItem value="6m">Last 6 Months</SelectItem>
              <SelectItem value="1y">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-1.5" onClick={handleExport}><Download className="h-4 w-4" /> Export CSV</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Occupancy", value: `${occupancyRate}%`, sub: `${occupied}/${totalUnits} units`, icon: Target, color: "text-emerald-400", bg: "from-emerald-500/20 to-teal-500/20" },
          { label: "Monthly Revenue", value: `$${(monthlyRent / 1000).toFixed(1)}k`, sub: `Avg $${avgRent}/unit`, icon: DollarSign, color: "text-amber-400", bg: "from-amber-500/20 to-orange-500/20" },
          { label: "Open Requests", value: openMaint, sub: `${emergencyMaint} emergency`, icon: Wrench, color: "text-red-400", bg: "from-red-500/20 to-rose-500/20" },
          { label: "Active Leases", value: activeLeases, sub: `${expiringLeases} expiring`, icon: Calendar, color: "text-blue-400", bg: "from-blue-500/20 to-cyan-500/20" },
        ].map(kpi => (
          <Card key={kpi.label} className="relative overflow-hidden border-border/50 bg-card/50">
            <div className={`absolute inset-0 bg-gradient-to-br ${kpi.bg} opacity-50`} />
            <CardContent className="relative p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold font-heading mt-0.5">{kpi.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{kpi.sub}</p>
                </div>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="properties">By Property</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="leasing">Leasing</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Revenue Chart */}
            <Card className="lg:col-span-2 border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-heading">Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {revenueData.map(d => (
                  <div key={d.month} className="group flex items-center gap-3">
                    <span className="w-8 text-xs text-muted-foreground">{d.month}</span>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <BarViz value={d.revenue} max={maxRevData} color="gradient-brand h-4 rounded-md" />
                        <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">${(d.revenue / 1000).toFixed(1)}k</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BarViz value={d.expenses} max={maxRevData} color="bg-destructive/40 h-1.5 rounded-md" />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-6 pt-3 border-t border-border/30 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full gradient-brand" /> Revenue</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-destructive/40" /> Expenses</span>
                </div>
              </CardContent>
            </Card>

            {/* Unit Distribution */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-heading">Unit Distribution</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4 pt-2">
                <MiniDonut segments={[
                  { value: occupied, color: "text-blue-400", label: "Occupied" },
                  { value: available, color: "text-emerald-400", label: "Available" },
                  { value: underMaint, color: "text-amber-400", label: "Maintenance" },
                  { value: totalUnits - occupied - available - underMaint, color: "text-gray-500", label: "Other" },
                ]} />
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  {[
                    { label: "Occupied", value: occupied, color: "bg-blue-400" },
                    { label: "Available", value: available, color: "bg-emerald-400" },
                    { label: "Maintenance", value: underMaint, color: "bg-amber-400" },
                    { label: "Other", value: totalUnits - occupied - available - underMaint, color: "bg-gray-500" },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${s.color}`} />
                      <span className="text-muted-foreground">{s.label}: {s.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Financial Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Revenue", value: `$${totalRevenue.toLocaleString()}`, color: "text-emerald-400" },
              { label: "Total Expenses", value: `$${totalExpenses.toLocaleString()}`, color: "text-red-400" },
              { label: "Net Income", value: `$${netIncome.toLocaleString()}`, color: netIncome >= 0 ? "text-emerald-400" : "text-red-400" },
              { label: "Avg WO Cost", value: `$${avgWOCost}`, color: "text-blue-400" },
            ].map(s => (
              <Card key={s.label} className="border-border/50 bg-card/50">
                <CardContent className="p-3 text-center">
                  <p className={`text-xl font-bold font-heading ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* By Property Tab */}
        <TabsContent value="properties" className="mt-4 space-y-3">
          {propertyBreakdown.map(p => (
            <Card key={p.id} className="border-border/50 bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold font-heading">{p.name}</h3>
                      <p className="text-xs text-muted-foreground">{p.address.city}, {p.address.state}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-xs ${p.occupancy >= 80 ? "text-emerald-400 border-emerald-500/30" : p.occupancy >= 50 ? "text-amber-400 border-amber-500/30" : "text-red-400 border-red-500/30"}`}>
                    {p.occupancy}% occupied
                  </Badge>
                </div>
                <div className="grid grid-cols-4 gap-3 text-center text-sm">
                  <div><p className="font-bold">{p.unitCount}</p><p className="text-[10px] text-muted-foreground">Units</p></div>
                  <div><p className="font-bold">{p.occupied}</p><p className="text-[10px] text-muted-foreground">Occupied</p></div>
                  <div><p className="font-bold text-emerald-400">${p.revenue.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Revenue/mo</p></div>
                  <div><p className="font-bold text-amber-400">{p.openMaint}</p><p className="text-[10px] text-muted-foreground">Open Maint</p></div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-accent/50 overflow-hidden">
                  <div className="h-full rounded-full gradient-brand transition-all duration-700" style={{ width: `${p.occupancy}%` }} />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Open", value: openMaint, color: "text-amber-400" },
              { label: "Completed", value: completedMaint, color: "text-emerald-400" },
              { label: "Emergency", value: emergencyMaint, color: "text-red-400" },
              { label: "Avg Cost", value: `$${avgWOCost}`, color: "text-blue-400" },
            ].map(s => (
              <Card key={s.label} className="border-border/50 bg-card/50">
                <CardContent className="p-3 text-center">
                  <p className={`text-2xl font-bold font-heading ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {/* By category */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">Requests by Category</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(["plumbing", "electrical", "hvac", "appliance", "structural", "pest", "cleaning", "other"] as const).map(cat => {
                const count = maintenance.filter(m => m.category === cat).length;
                if (count === 0) return null;
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="w-20 text-xs text-muted-foreground capitalize">{cat}</span>
                    <div className="flex-1"><BarViz value={count} max={maintenance.length} color="gradient-brand h-4 rounded-md" /></div>
                    <span className="text-xs font-medium w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          {/* Vendor performance */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">Vendor Performance</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {vendors.filter(v => v.status === "active").map(v => {
                const vOrders = workOrders.filter(wo => wo.vendorId === v.id);
                const vCompleted = vOrders.filter(wo => ["approved", "invoiced"].includes(wo.status)).length;
                const vSpend = vOrders.reduce((s, wo) => s + (wo.totalCost || 0), 0);
                return (
                  <div key={v.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 transition-colors">
                    <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <HardHat className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{v.name}</p>
                      <p className="text-[10px] text-muted-foreground">{v.specialty.join(", ")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{v.rating}★</p>
                      <p className="text-[10px] text-muted-foreground">{vCompleted} jobs · ${vSpend}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leasing Tab */}
        <TabsContent value="leasing" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Active Leases", value: activeLeases, color: "text-blue-400" },
              { label: "Expiring Soon", value: expiringLeases, color: "text-amber-400" },
              { label: "Pending Apps", value: pendingApps, color: "text-violet-400" },
              { label: "Approved", value: approvedApps, color: "text-emerald-400" },
            ].map(s => (
              <Card key={s.label} className="border-border/50 bg-card/50">
                <CardContent className="p-3 text-center">
                  <p className={`text-2xl font-bold font-heading ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">Lease Status Breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(["active", "expiring_soon", "draft", "expired", "month_to_month"] as const).map(st => {
                  const count = leases.filter(l => l.status === st).length;
                  if (count === 0) return null;
                  return (
                    <div key={st} className="flex items-center gap-3">
                      <span className="w-28 text-xs text-muted-foreground capitalize">{st.replace(/_/g, " ")}</span>
                      <div className="flex-1"><BarViz value={count} max={leases.length} color="gradient-brand h-4 rounded-md" /></div>
                      <span className="text-xs font-medium w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">Active Listings</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-xl font-bold text-primary">{listings.filter(l => l.status === "active").length}</p><p className="text-[10px] text-muted-foreground">Active</p></div>
                <div><p className="text-xl font-bold text-emerald-400">{listings.reduce((s, l) => s + l.leads.length, 0)}</p><p className="text-[10px] text-muted-foreground">Total Leads</p></div>
                <div><p className="text-xl font-bold text-amber-400">{listings.filter(l => l.status === "filled").length}</p><p className="text-[10px] text-muted-foreground">Filled</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
