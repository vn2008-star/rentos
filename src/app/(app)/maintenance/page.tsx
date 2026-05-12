"use client";

import React, { useState } from "react";
import { Plus, Search, AlertTriangle, Clock, CheckCircle, Wrench, Wifi, WifiOff, MoreHorizontal, Edit2, Trash2, Eye, Camera, HardHat, DollarSign, Calendar, User, MapPin, ArrowRight, X, LayoutGrid, List, UserCircle, Phone, Mail, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PhotoUpload } from "@/components/photo-upload";
import { useMaintenance, useUnits, useProperties, useTenants, useVendors, useWorkOrders } from "@/lib/hooks";
import type { MaintenanceCategory, MaintenancePriority, MaintenanceStatus, ReporterType } from "@/lib/types";
import { buildTimeline, getReporterLabel, getReporterBadge, formatTimeAgo, KANBAN_COLUMNS, STATUS_STEPS, getStatusStep } from "@/lib/maintenance-engine";
import toast from "react-hot-toast";

const priorityConfig: Record<MaintenancePriority, { label: string; color: string; icon: typeof AlertTriangle }> = {
  emergency: { label: "Emergency", color: "text-red-400 bg-red-500/15 border-red-500/30", icon: AlertTriangle },
  urgent: { label: "Urgent", color: "text-amber-400 bg-amber-500/15 border-amber-500/30", icon: AlertTriangle },
  routine: { label: "Routine", color: "text-blue-400 bg-blue-500/15 border-blue-500/30", icon: Clock },
  scheduled: { label: "Scheduled", color: "text-violet-400 bg-violet-500/15 border-violet-500/30", icon: Clock },
};

const statusLabels: Record<MaintenanceStatus, string> = {
  submitted: "Submitted", acknowledged: "Acknowledged", assigned: "Assigned",
  in_progress: "In Progress", completed: "Completed", closed: "Closed",
};

const categoryLabels: Record<MaintenanceCategory, string> = {
  plumbing: "🔧 Plumbing", electrical: "⚡ Electrical", hvac: "❄️ HVAC", appliance: "🍽️ Appliance",
  structural: "🏗️ Structural", pest: "🐛 Pest", cleaning: "🧹 Cleaning", landscaping: "🌳 Landscaping", other: "📋 Other",
};

const woStatusLabels: Record<string, { label: string; color: string }> = {
  assigned: { label: "Assigned", color: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
  accepted: { label: "Accepted", color: "text-violet-400 border-violet-500/30 bg-violet-500/10" },
  in_progress: { label: "In Progress", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  pending_approval: { label: "Pending Approval", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  approved: { label: "Approved", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  completed: { label: "Completed", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
};

export default function MaintenancePage() {
  const { requests, loading, isLive, addRequest, updateRequest, removeRequest } = useMaintenance();
  const { units } = useUnits();
  const { properties } = useProperties();
  const { tenants } = useTenants();
  const { vendors } = useVendors();
  const { workOrders, createWorkOrder, approveOrder, rejectOrder } = useWorkOrders();

  const [showAdd, setShowAdd] = useState(false);
  const [showAssign, setShowAssign] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [showResolve, setShowResolve] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [photos, setPhotos] = useState<(File | string)[]>([]);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [resolveNotes, setResolveNotes] = useState("");
  const [reporterType, setReporterType] = useState<ReporterType>("tenant");
  const [externalReporter, setExternalReporter] = useState({ name: "", phone: "", email: "" });
  const [form, setForm] = useState({ title: "", description: "", category: "plumbing" as MaintenanceCategory, priority: "routine" as MaintenancePriority, unitId: "", propertyId: "", tenantId: "" });
  const [assignForm, setAssignForm] = useState({ vendorId: "", scheduledDate: "", accessInstructions: "" });
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const openRequests = requests.filter(r => !["completed", "closed"].includes(r.status));
  const completedRequests = requests.filter(r => ["completed", "closed"].includes(r.status));
  const totalCost = workOrders.filter(wo => wo.status === "approved").reduce((s, wo) => s + (wo.totalCost || 0), 0);
  const pendingApproval = workOrders.filter(wo => wo.status === "pending_approval").length;

  const filtered = (reqs: typeof requests) => reqs.filter(r => {
    const q = search.toLowerCase();
    return r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
  });

  const handleAdd = async () => {
    setSaving(true);
    try {
      const reporter = reporterType === "tenant"
        ? { type: "tenant" as const, name: tenants.find(t => t.id === form.tenantId) ? `${tenants.find(t => t.id === form.tenantId)!.firstName} ${tenants.find(t => t.id === form.tenantId)!.lastName}` : "Tenant" }
        : reporterType === "manager"
        ? { type: "manager" as const, name: "Property Manager" }
        : { type: "external" as const, name: externalReporter.name, phone: externalReporter.phone || undefined, email: externalReporter.email || undefined };
      await addRequest({ title: form.title, description: form.description, category: form.category, priority: form.priority, unitId: form.unitId, propertyId: form.propertyId, tenantId: reporterType === "tenant" ? form.tenantId : undefined, reporter, photos: photos.filter((p): p is File => p instanceof File) });
      toast.success("Maintenance request created");
      setShowAdd(false);
      setForm({ title: "", description: "", category: "plumbing", priority: "routine", unitId: "", propertyId: "", tenantId: "" });
      setPhotos([]); setReporterType("tenant"); setExternalReporter({ name: "", phone: "", email: "" });
    } catch { toast.error("Failed to create request"); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (id: string, status: MaintenanceStatus) => {
    await updateRequest(id, { status, ...(status === "completed" ? { completedAt: new Date().toISOString() } : {}) });
    toast.success(`Status updated to ${statusLabels[status]}`);
  };

  const handleAssign = async () => {
    if (!showAssign || !assignForm.vendorId) return;
    setSaving(true);
    try {
      const req = requests.find(r => r.id === showAssign)!;
      const woId = await createWorkOrder({
        maintenanceRequestId: showAssign, vendorId: assignForm.vendorId,
        unitId: req.unitId, propertyId: req.propertyId,
        scheduledDate: assignForm.scheduledDate || undefined,
        accessInstructions: assignForm.accessInstructions || undefined,
      });
      await updateRequest(showAssign, { status: "assigned", assignedVendorId: assignForm.vendorId, workOrderId: woId, scheduledDate: assignForm.scheduledDate || undefined, accessInstructions: assignForm.accessInstructions || undefined });
      toast.success("Vendor assigned & work order created");
      setShowAssign(null);
      setAssignForm({ vendorId: "", scheduledDate: "", accessInstructions: "" });
    } catch { toast.error("Assignment failed"); }
    finally { setSaving(false); }
  };

  const handleApproveWO = async (woId: string) => {
    await approveOrder(woId, "manager", "Approved");
    toast.success("Work order approved!");
  };

  const handleRejectWO = async (woId: string) => {
    await rejectOrder(woId, "manager", "Please revise costs");
    toast.success("Sent back for revision");
  };

  const handleResolve = async () => {
    if (!showResolve) return;
    setSaving(true);
    await updateRequest(showResolve, { status: "closed" as MaintenanceStatus, resolvedAt: new Date().toISOString(), resolutionNotes: resolveNotes || undefined });
    toast.success("Request resolved & closed");
    setShowResolve(null); setResolveNotes(""); setShowDetail(null);
    setSaving(false);
  };

  const handleDrop = async (reqId: string, newStatus: string) => {
    const statusMap: Record<string, MaintenanceStatus> = { submitted: "submitted", acknowledged: "acknowledged", assigned: "assigned", in_progress: "in_progress", completed: "completed", closed: "closed" };
    const s = statusMap[newStatus];
    if (s) { await handleStatusChange(reqId, s); }
    setDragOverCol(null); setDragId(null);
  };

  const detailReq = requests.find(r => r.id === showDetail);
  const detailWO = detailReq?.workOrderId ? workOrders.find(wo => wo.id === detailReq.workOrderId) : undefined;
  const detailVendor = detailReq?.assignedVendorId ? vendors.find(v => v.id === detailReq.assignedVendorId) : undefined;
  const detailTimeline = detailReq ? buildTimeline(detailReq, detailWO, detailVendor) : [];

  const renderRequestCard = (req: typeof requests[0], compact = false) => {
    const unit = units.find(u => u.id === req.unitId);
    const prop = properties.find(p => p.id === req.propertyId);
    const reporterName = getReporterLabel(req, tenants);
    const reporterBadge = getReporterBadge(req);
    const vendor = req.assignedVendorId ? vendors.find(v => v.id === req.assignedVendorId) : null;
    const wo = req.workOrderId ? workOrders.find(w => w.id === req.workOrderId) : null;
    const pc = priorityConfig[req.priority];

    return (
      <Card key={req.id} className={`group border-border/50 bg-card/50 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer ${dragId === req.id ? 'opacity-50' : ''}`} onClick={() => setShowDetail(req.id)} draggable onDragStart={() => setDragId(req.id)} onDragEnd={() => setDragId(null)}>
        <CardContent className={compact ? "p-3 space-y-2" : "p-4 space-y-3"}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm font-heading truncate group-hover:text-primary transition-colors">{req.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{unit ? `Unit ${unit.unitNumber}` : "—"} · {prop?.name || "—"}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={e => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button>} />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShowDetail(req.id); }}><Eye className="h-4 w-4 mr-2" /> View</DropdownMenuItem>
                {!req.assignedVendorId && <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShowAssign(req.id); }}><HardHat className="h-4 w-4 mr-2" /> Assign Vendor</DropdownMenuItem>}
                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm("Delete?")) removeRequest(req.id); }}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{req.description}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge className={`border text-[10px] ${pc.color}`}>{pc.label}</Badge>
            <Badge variant="outline" className={`text-[10px] ${reporterBadge.color}`}>{reporterBadge.label}</Badge>
            <Badge variant="outline" className="text-[10px]">{categoryLabels[req.category]}</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1"><UserCircle className="h-3 w-3" /> {reporterName} · {formatTimeAgo(req.createdAt)}</p>
          {vendor && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1"><HardHat className="h-3 w-3" /> {vendor.name}{vendor.company ? ` · ${vendor.company}` : ""}</p>
          )}
          {wo && wo.status === "pending_approval" && (
            <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
              <Button size="sm" className="text-xs h-7 gradient-brand text-white border-0 flex-1" onClick={() => handleApproveWO(wo.id)}>Approve ${wo.totalCost}</Button>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleRejectWO(wo.id)}>Reject</Button>
            </div>
          )}
          {!req.assignedVendorId && !["completed", "closed"].includes(req.status) && (
            <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
              {req.status === "submitted" && <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleStatusChange(req.id, "acknowledged")}>Acknowledge</Button>}
              <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setShowAssign(req.id)}><HardHat className="h-3 w-3" /> Assign</Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">Maintenance</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            {openRequests.length} open requests
            <Badge variant="outline" className={`text-[10px] gap-1 ${isLive ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"}`}>
              {isLive ? <><Wifi className="h-2.5 w-2.5" /> Live</> : <><WifiOff className="h-2.5 w-2.5" /> Demo</>}
            </Badge>
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 gap-1.5"><Plus className="h-4 w-4" /> New Request</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(Object.entries(priorityConfig) as [MaintenancePriority, typeof priorityConfig["emergency"]][]).map(([key, config]) => {
          const count = openRequests.filter(r => r.priority === key).length;
          return (
            <Card key={key} className="border-border/50 bg-card/50">
              <CardContent className="p-3 text-center">
                <p className={`text-2xl font-bold font-heading ${config.color.split(" ")[0]}`}>{count}</p>
                <p className="text-[11px] text-muted-foreground">{config.label}</p>
              </CardContent>
            </Card>
          );
        })}
        <Card className="border-amber-500/20 bg-card/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold font-heading text-amber-400">{pendingApproval}</p>
            <p className="text-[11px] text-muted-foreground">Pending Approval</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search requests..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 bg-accent/30 rounded-lg p-1">
          <Button size="sm" variant={viewMode === "board" ? "default" : "ghost"} className={`h-7 gap-1 text-xs ${viewMode === 'board' ? 'gradient-brand text-white border-0' : ''}`} onClick={() => setViewMode("board")}><LayoutGrid className="h-3.5 w-3.5" /> Board</Button>
          <Button size="sm" variant={viewMode === "list" ? "default" : "ghost"} className={`h-7 gap-1 text-xs ${viewMode === 'list' ? 'gradient-brand text-white border-0' : ''}`} onClick={() => setViewMode("list")}><List className="h-3.5 w-3.5" /> List</Button>
        </div>
      </div>

      {/* Kanban Board View */}
      {viewMode === "board" && (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 400 }}>
          {KANBAN_COLUMNS.map(col => {
            const colReqs = filtered(requests.filter(r => {
              if (col.key === "completed") return r.status === "completed";
              if (col.key === "closed") return r.status === "closed" || !!r.resolvedAt;
              return r.status === col.key;
            }));
            return (
              <div key={col.key} className={`flex-shrink-0 w-72 rounded-xl border ${dragOverCol === col.key ? 'border-primary bg-primary/5' : `${col.color} bg-card/30`} transition-colors`}
                onDragOver={e => { e.preventDefault(); setDragOverCol(col.key); }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={e => { e.preventDefault(); if (dragId) handleDrop(dragId, col.key); }}>
                <div className="p-3 border-b border-border/30">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold font-heading uppercase tracking-wider">{col.label}</h3>
                    <Badge variant="outline" className="text-[10px] h-5 min-w-[20px] justify-center">{colReqs.length}</Badge>
                  </div>
                </div>
                <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
                  {colReqs.map(req => renderRequestCard(req, true))}
                  {colReqs.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No requests</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <Tabs defaultValue="open">
          <TabsList>
            <TabsTrigger value="open">Open ({openRequests.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedRequests.length})</TabsTrigger>
            <TabsTrigger value="all">All ({requests.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="open" className="mt-4"><div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered(openRequests).map(r => renderRequestCard(r))}</div></TabsContent>
          <TabsContent value="completed" className="mt-4"><div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered(completedRequests).map(r => renderRequestCard(r))}</div></TabsContent>
          <TabsContent value="all" className="mt-4"><div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered(requests).map(r => renderRequestCard(r))}</div></TabsContent>
        </Tabs>
      )}

      {/* New Request Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">New Maintenance Request</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Reported By</Label>
              <div className="flex gap-1 mt-1">
                {(["tenant", "manager", "external"] as ReporterType[]).map(t => (
                  <Button key={t} size="sm" variant={reporterType === t ? "default" : "outline"} className={`text-xs flex-1 ${reporterType === t ? 'gradient-brand text-white border-0' : ''}`} onClick={() => setReporterType(t)}>
                    {t === "tenant" ? "Tenant" : t === "manager" ? "Manager" : "External"}
                  </Button>
                ))}
              </div>
            </div>
            {reporterType === "external" && (
              <div className="space-y-3 bg-accent/30 rounded-lg p-3">
                <div><Label>Name *</Label><Input placeholder="Full name" value={externalReporter.name} onChange={e => setExternalReporter({ ...externalReporter, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Phone</Label><Input placeholder="(530) 555-0000" value={externalReporter.phone} onChange={e => setExternalReporter({ ...externalReporter, phone: e.target.value })} /></div>
                  <div><Label>Email</Label><Input placeholder="email@example.com" value={externalReporter.email} onChange={e => setExternalReporter({ ...externalReporter, email: e.target.value })} /></div>
                </div>
              </div>
            )}
            <div><Label>Title</Label><Input placeholder="e.g. Kitchen sink leak" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea placeholder="Describe the issue..." className="min-h-[80px]" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Category</Label><Select value={form.category} onValueChange={v => v != null && setForm({ ...form, category: v as MaintenanceCategory })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Priority</Label><Select value={form.priority} onValueChange={v => v != null && setForm({ ...form, priority: v as MaintenancePriority })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(priorityConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><Label>Property</Label><Select value={form.propertyId} onValueChange={v => v != null && setForm({ ...form, propertyId: v, unitId: "", tenantId: "" })}><SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger><SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            {form.propertyId && <div><Label>Unit</Label><Select value={form.unitId} onValueChange={v => v != null && setForm({ ...form, unitId: v })}><SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger><SelectContent><SelectItem value="general">General / Common Area</SelectItem>{units.filter(u => u.propertyId === form.propertyId).map(u => <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber}</SelectItem>)}</SelectContent></Select></div>}
            {reporterType === "tenant" && <div><Label>Tenant</Label><Select value={form.tenantId} onValueChange={v => v != null && setForm({ ...form, tenantId: v })}><SelectTrigger><SelectValue placeholder="Select tenant (optional)" /></SelectTrigger><SelectContent>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>)}</SelectContent></Select></div>}
            <PhotoUpload photos={photos} onChange={setPhotos} maxPhotos={6} label="Issue Photos" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!form.title || !form.propertyId || (reporterType === 'external' && !externalReporter.name) || saving} className="gradient-brand text-white border-0">{saving ? "Saving..." : "Create Request"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Vendor Dialog */}
      <Dialog open={!!showAssign} onOpenChange={() => setShowAssign(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading flex items-center gap-2"><HardHat className="h-5 w-5 text-primary" /> Assign Vendor</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Select Vendor</Label>
              <Select value={assignForm.vendorId} onValueChange={v => v != null && setAssignForm({ ...assignForm, vendorId: v })}>
                <SelectTrigger><SelectValue placeholder="Choose a vendor" /></SelectTrigger>
                <SelectContent>
                  {vendors.filter(v => v.status === "active").map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} — {v.specialty.join(", ")} ({v.rating}★)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {assignForm.vendorId && (() => {
              const v = vendors.find(x => x.id === assignForm.vendorId);
              if (!v) return null;
              return (
                <div className="bg-accent/30 rounded-lg p-3 space-y-1 text-sm">
                  <p className="font-medium">{v.name}{v.company ? ` · ${v.company}` : ""}</p>
                  <p className="text-xs text-muted-foreground">{v.phone} · {v.email}</p>
                  <p className="text-xs text-muted-foreground">{v.completedJobs} jobs · ${v.hourlyRate || "—"}/hr · {v.rating}★</p>
                </div>
              );
            })()}
            <div><Label>Scheduled Date</Label><Input type="date" value={assignForm.scheduledDate} onChange={e => setAssignForm({ ...assignForm, scheduledDate: e.target.value })} /></div>
            <div><Label>Access Instructions</Label><Textarea placeholder="Gate codes, parking, tenant availability..." value={assignForm.accessInstructions} onChange={e => setAssignForm({ ...assignForm, accessInstructions: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssign(null)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!assignForm.vendorId || saving} className="gradient-brand text-white border-0">{saving ? "Assigning..." : "Assign & Create Work Order"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Detail Sheet */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailReq && (() => {
            const unit = units.find(u => u.id === detailReq.unitId);
            const prop = properties.find(p => p.id === detailReq.propertyId);
            const reporterName = getReporterLabel(detailReq, tenants);
            const reporterBadge = getReporterBadge(detailReq);
            const pc = priorityConfig[detailReq.priority];
            const currentStep = getStatusStep(detailReq);
            return (
              <>
                <DialogHeader><DialogTitle className="font-heading">{detailReq.title}</DialogTitle></DialogHeader>
                <div className="space-y-5 py-4">
                  {/* Status Stepper */}
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {STATUS_STEPS.map((step, i) => (
                      <div key={step.key} className="flex items-center gap-1 flex-shrink-0">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i <= currentStep ? 'gradient-brand text-white' : 'bg-accent/50 text-muted-foreground'}`}>{i + 1}</div>
                        <span className={`text-[10px] ${i <= currentStep ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{step.label}</span>
                        {i < STATUS_STEPS.length - 1 && <div className={`w-4 h-0.5 ${i < currentStep ? 'bg-primary' : 'bg-border'}`} />}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge className={`border ${pc.color}`}>{pc.label}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${reporterBadge.color}`}>{reporterBadge.label}</Badge>
                    <Badge variant="outline">{categoryLabels[detailReq.category]}</Badge>
                    <Badge variant="outline">{statusLabels[detailReq.status]}</Badge>
                  </div>
                  <p className="text-sm">{detailReq.description}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-xs text-muted-foreground">Property</p><p>{prop?.name || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Unit</p><p>{unit ? `Unit ${unit.unitNumber}` : "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Reported By</p><p>{reporterName}</p></div>
                    <div><p className="text-xs text-muted-foreground">Created</p><p>{formatTimeAgo(detailReq.createdAt)}</p></div>
                  </div>

                  {detailReq.photos?.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Issue Photos</p>
                      <div className="flex gap-2 overflow-x-auto">{detailReq.photos.map((url, i) => <img key={i} src={url} alt="" className="h-20 w-20 rounded-lg object-cover border border-border/30" />)}</div>
                    </div>
                  )}

                  {/* Activity Timeline */}
                  {detailTimeline.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-3">Activity Timeline</p>
                      <div className="space-y-0">
                        {detailTimeline.map((evt, i) => (
                          <div key={evt.id} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={`h-2.5 w-2.5 rounded-full mt-1.5 ${evt.type === 'resolved' ? 'bg-emerald-400' : evt.type === 'completed' ? 'bg-blue-400' : 'bg-primary'}`} />
                              {i < detailTimeline.length - 1 && <div className="w-px flex-1 bg-border/50 my-1" />}
                            </div>
                            <div className="pb-4 flex-1">
                              <p className="text-xs font-medium">{evt.label}</p>
                              <p className="text-[11px] text-muted-foreground">{evt.description}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{evt.actor} · {formatTimeAgo(evt.timestamp)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Vendor & Work Order */}
                  {detailVendor && (
                    <div className="bg-accent/30 rounded-lg p-4 space-y-3">
                      <p className="text-xs text-muted-foreground font-medium">Assigned Vendor</p>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center"><HardHat className="h-4 w-4 text-primary" /></div>
                        <div>
                          <p className="text-sm font-medium">{detailVendor.name}</p>
                          <p className="text-xs text-muted-foreground">{detailVendor.company} · {detailVendor.phone}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {detailWO && (
                    <div className="border border-border/50 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium font-heading">Work Order {detailWO.id}</p>
                        <Badge variant="outline" className={`text-[10px] ${(woStatusLabels[detailWO.status] || woStatusLabels.assigned).color}`}>
                          {(woStatusLabels[detailWO.status] || woStatusLabels.assigned).label}
                        </Badge>
                      </div>
                      {detailWO.scheduledDate && <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> {detailWO.scheduledDate}</p>}
                      {detailWO.vendorNotes && <div className="bg-card rounded-md p-2"><p className="text-xs text-muted-foreground mb-0.5">Vendor Notes</p><p className="text-sm">{detailWO.vendorNotes}</p></div>}
                      {detailWO.totalCost != null && (
                        <div className="grid grid-cols-3 gap-2 text-center bg-card rounded-md p-2">
                          <div><p className="text-xs text-muted-foreground">Labor</p><p className="text-sm font-medium">${detailWO.laborCost || 0}</p></div>
                          <div><p className="text-xs text-muted-foreground">Materials</p><p className="text-sm font-medium">${detailWO.materialsCost || 0}</p></div>
                          <div><p className="text-xs text-muted-foreground">Total</p><p className="text-sm font-bold text-emerald-400">${detailWO.totalCost}</p></div>
                        </div>
                      )}
                      {detailWO.status === "pending_approval" && (
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 gradient-brand text-white border-0 text-xs" onClick={() => { handleApproveWO(detailWO.id); }}>Approve</Button>
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => { handleRejectWO(detailWO.id); }}>Reject</Button>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground">Contractor link: /contractor/{detailWO.id}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {!detailReq.assignedVendorId && !["completed", "closed"].includes(detailReq.status) && (
                      <Button className="flex-1 gap-2" variant="outline" onClick={() => { setShowDetail(null); setShowAssign(detailReq.id); }}>
                        <HardHat className="h-4 w-4" /> Assign Vendor
                      </Button>
                    )}
                    {(detailReq.status === "completed" || (detailWO?.status === "approved")) && detailReq.status !== "closed" && (
                      <Button className="flex-1 gap-2 gradient-brand text-white border-0" onClick={() => { setShowResolve(detailReq.id); }}>
                        <CheckCircle className="h-4 w-4" /> Resolve & Close
                      </Button>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Resolve & Close Dialog */}
      <Dialog open={!!showResolve} onOpenChange={() => setShowResolve(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading flex items-center gap-2"><CheckCircle className="h-5 w-5 text-emerald-400" /> Resolve & Close</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">Mark this request as fully resolved. This will close the request and notify all parties.</p>
            <div><Label>Resolution Notes</Label><Textarea placeholder="Summary of resolution, any follow-up needed..." value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolve(null)}>Cancel</Button>
            <Button onClick={handleResolve} disabled={saving} className="gradient-brand text-white border-0">{saving ? "Closing..." : "Resolve & Close"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

