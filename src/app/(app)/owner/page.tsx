"use client";

import React, { useState } from "react";
import { Building2, Wrench, DollarSign, Clock, CheckCircle, AlertTriangle, Eye, Calendar, HardHat, TrendingUp, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMaintenance, useProperties, useUnits, useWorkOrders, useVendors, useTenants } from "@/lib/hooks";
import { buildTimeline, getReporterLabel, getReporterBadge, formatTimeAgo } from "@/lib/maintenance-engine";
import type { MaintenancePriority } from "@/lib/types";

const priorityColors: Record<MaintenancePriority, string> = {
  emergency: "text-red-400", urgent: "text-amber-400", routine: "text-blue-400", scheduled: "text-violet-400",
};

export default function OwnerDashboard() {
  const { requests } = useMaintenance();
  const { properties } = useProperties();
  const { units } = useUnits();
  const { workOrders } = useWorkOrders();
  const { vendors } = useVendors();
  const { tenants } = useTenants();
  const [selectedProp, setSelectedProp] = useState<string>("all");

  const filtered = selectedProp === "all" ? requests : requests.filter(r => r.propertyId === selectedProp);
  const openReqs = filtered.filter(r => !["completed", "closed"].includes(r.status));
  const closedReqs = filtered.filter(r => ["completed", "closed"].includes(r.status));
  const totalSpend = workOrders.filter(wo => wo.status === "approved").reduce((s, wo) => s + (wo.totalCost || 0), 0);
  const avgResolution = closedReqs.length > 0 ? Math.round(closedReqs.reduce((s, r) => {
    const created = new Date(r.createdAt).getTime();
    const resolved = new Date(r.resolvedAt || r.updatedAt).getTime();
    return s + (resolved - created) / 86400000;
  }, 0) / closedReqs.length) : 0;

  // Build full activity feed
  const allEvents = filtered.flatMap(req => {
    const wo = req.workOrderId ? workOrders.find(w => w.id === req.workOrderId) : undefined;
    const vendor = req.assignedVendorId ? vendors.find(v => v.id === req.assignedVendorId) : undefined;
    const events = buildTimeline(req, wo, vendor);
    return events.map(e => ({ ...e, requestTitle: req.title, requestId: req.id, priority: req.priority, propertyId: req.propertyId }));
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">Owner Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Read-only overview of all maintenance activity across your portfolio</p>
      </div>

      {/* Property Filter */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant={selectedProp === "all" ? "default" : "outline"} className={`cursor-pointer text-xs ${selectedProp === 'all' ? 'gradient-brand text-white border-0' : ''}`} onClick={() => setSelectedProp("all")}>All Properties</Badge>
        {properties.map(p => (
          <Badge key={p.id} variant={selectedProp === p.id ? "default" : "outline"} className={`cursor-pointer text-xs ${selectedProp === p.id ? 'gradient-brand text-white border-0' : ''}`} onClick={() => setSelectedProp(p.id)}>{p.name}</Badge>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/50 bg-card/50"><CardContent className="p-4">
          <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-amber-500/15 flex items-center justify-center"><Wrench className="h-5 w-5 text-amber-400" /></div>
          <div><p className="text-2xl font-bold font-heading">{openReqs.length}</p><p className="text-xs text-muted-foreground">Open Requests</p></div></div>
        </CardContent></Card>
        <Card className="border-border/50 bg-card/50"><CardContent className="p-4">
          <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center"><CheckCircle className="h-5 w-5 text-emerald-400" /></div>
          <div><p className="text-2xl font-bold font-heading">{closedReqs.length}</p><p className="text-xs text-muted-foreground">Resolved</p></div></div>
        </CardContent></Card>
        <Card className="border-border/50 bg-card/50"><CardContent className="p-4">
          <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center"><DollarSign className="h-5 w-5 text-blue-400" /></div>
          <div><p className="text-2xl font-bold font-heading">${totalSpend.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Spend</p></div></div>
        </CardContent></Card>
        <Card className="border-border/50 bg-card/50"><CardContent className="p-4">
          <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-violet-500/15 flex items-center justify-center"><Clock className="h-5 w-5 text-violet-400" /></div>
          <div><p className="text-2xl font-bold font-heading">{avgResolution}d</p><p className="text-xs text-muted-foreground">Avg Resolution</p></div></div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="feed">
        <TabsList><TabsTrigger value="feed">Activity Feed</TabsTrigger><TabsTrigger value="requests">All Requests</TabsTrigger></TabsList>

        {/* Activity Feed */}
        <TabsContent value="feed" className="mt-4">
          <Card className="border-border/50 bg-card/50">
            <CardHeader><CardTitle className="text-sm font-heading flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Recent Activity</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/30 max-h-[600px] overflow-y-auto">
                {allEvents.slice(0, 50).map((evt) => {
                  const prop = properties.find(p => p.id === evt.propertyId);
                  return (
                    <div key={`${evt.requestId}-${evt.id}`} className="px-4 py-3 hover:bg-accent/20 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`h-2.5 w-2.5 rounded-full mt-1.5 flex-shrink-0 ${evt.type === 'resolved' ? 'bg-emerald-400' : evt.type === 'completed' ? 'bg-blue-400' : evt.type === 'submitted' ? 'bg-amber-400' : 'bg-primary'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{evt.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{evt.requestTitle} — {evt.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted-foreground">{prop?.name || "—"}</span>
                            <span className="text-[10px] text-muted-foreground">·</span>
                            <span className="text-[10px] text-muted-foreground">{evt.actor}</span>
                            <span className="text-[10px] text-muted-foreground">·</span>
                            <span className="text-[10px] text-muted-foreground">{formatTimeAgo(evt.timestamp)}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${priorityColors[evt.priority]}`}>{evt.priority}</Badge>
                      </div>
                    </div>
                  );
                })}
                {allEvents.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No activity yet</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Requests */}
        <TabsContent value="requests" className="mt-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(req => {
              const prop = properties.find(p => p.id === req.propertyId);
              const unit = units.find(u => u.id === req.unitId);
              const reporterName = getReporterLabel(req, tenants);
              const badge = getReporterBadge(req);
              return (
                <Card key={req.id} className="border-border/50 bg-card/50">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm font-heading">{req.title}</h3>
                      <Badge variant="outline" className={`text-[10px] ${priorityColors[req.priority]}`}>{req.priority}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{req.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className={`text-[10px] ${badge.color}`}>{badge.label}</Badge>
                      <Badge variant="outline" className="text-[10px]">{req.status.replace("_", " ")}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{prop?.name} · {unit ? `Unit ${unit.unitNumber}` : "—"} · {reporterName} · {formatTimeAgo(req.createdAt)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
