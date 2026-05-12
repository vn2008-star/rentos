"use client";

import React, { useState } from "react";
import {
  ArrowLeftRight, Calendar, Globe, Users, Plus, Search,
  Eye, Clock, CheckCircle2, Edit2, Trash2, MoreHorizontal,
  Sun, GraduationCap, Briefcase, MapPin, Mail, Phone,
  Wifi, WifiOff, ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSublets, useUnits, useProperties, useTenants } from "@/lib/hooks";
import type { Sublet } from "@/lib/types";
import toast from "react-hot-toast";

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "text-slate-400 bg-slate-500/15 border-slate-500/30" },
  active: { label: "Active", color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" },
  completed: { label: "Completed", color: "text-blue-400 bg-blue-500/15 border-blue-500/30" },
  cancelled: { label: "Cancelled", color: "text-red-400 bg-red-500/15 border-red-500/30" },
};

export default function SubletsPage() {
  const { sublets, loading, isLive, addSublet, updateSublet, removeSublet } = useSublets();
  const { units } = useUnits();
  const { properties } = useProperties();
  const { tenants } = useTenants();
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<Sublet | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tenantId: "", unitId: "", title: "", description: "",
    monthlyRent: "", startDate: "", endDate: "", reason: "",
  });

  const activeSublets = sublets.filter(s => s.status === "active");
  const draftSublets = sublets.filter(s => s.status === "draft");
  const completedSublets = sublets.filter(s => s.status === "completed");

  // Determine current season
  const now = new Date();
  const month = now.getMonth();
  const season = month >= 5 && month <= 7 ? "Summer" : month >= 2 && month <= 4 ? "Spring" : month >= 8 && month <= 10 ? "Fall" : "Winter";
  const year = now.getFullYear();

  const filtered = sublets.filter(s => {
    const q = search.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
  });

  const occupiedUnits = units.filter(u => u.status === "occupied");

  const handleCreate = async () => {
    const unit = units.find(u => u.id === form.unitId);
    if (!form.tenantId || !form.unitId || !form.title) return;
    setSaving(true);
    try {
      await addSublet({
        tenantId: form.tenantId,
        unitId: form.unitId,
        propertyId: unit?.propertyId || "",
        title: form.title,
        description: form.description,
        monthlyRent: parseInt(form.monthlyRent) || 0,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason,
      });
      toast.success("Sublet listing created! 🏠");
      setShowCreate(false);
      setForm({ tenantId: "", unitId: "", title: "", description: "", monthlyRent: "", startDate: "", endDate: "", reason: "" });
    } catch { toast.error("Failed to create sublet"); }
    finally { setSaving(false); }
  };

  const handleActivate = async (sublet: Sublet) => {
    await updateSublet(sublet.id, { status: "active" });
    toast.success("Sublet is now live!");
  };

  const handleComplete = async (sublet: Sublet) => {
    await updateSublet(sublet.id, { status: "completed" });
    toast.success("Sublet marked as completed! ✅");
    setShowDetail(null);
  };

  const renderSubletCard = (sublet: Sublet) => {
    const unit = units.find(u => u.id === sublet.unitId);
    const prop = properties.find(p => p.id === sublet.propertyId);
    const tenant = tenants.find(t => t.id === sublet.tenantId);
    const sc = statusConfig[sublet.status] || statusConfig.draft;
    const start = new Date(sublet.startDate);
    const end = new Date(sublet.endDate);
    const months = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)));

    return (
      <Card key={sublet.id} className="group border-border/50 bg-card/50 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer" onClick={() => setShowDetail(sublet)}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm font-heading truncate group-hover:text-primary transition-colors">{sublet.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{prop?.name} · Unit {unit?.unitNumber} · {tenant?.firstName} {tenant?.lastName}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={e => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button>} />
              <DropdownMenuContent align="end">
                {sublet.status === "draft" && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleActivate(sublet); }}>
                    <Globe className="h-4 w-4 mr-2" /> Publish
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleComplete(sublet); }}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Mark Completed
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm("Delete this sublet?")) removeSublet(sublet.id); }}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-3 text-xs flex-wrap">
            <Badge className={`border ${sc.color}`}>{sc.label}</Badge>
            <span className="text-cyan-400 font-medium">${sublet.monthlyRent.toLocaleString()}/mo</span>
            <span className="text-muted-foreground">{months}mo · {start.toLocaleDateString("en-US", { month: "short" })}–{end.toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
          </div>

          {sublet.guestInfo && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-accent/30 rounded-md px-2 py-1.5">
              <GraduationCap className="h-3.5 w-3.5 text-violet-400" />
              Guest: <span className="text-foreground font-medium">{sublet.guestInfo.name}</span>
              {sublet.guestInfo.university && <span>({sublet.guestInfo.university})</span>}
            </div>
          )}

          {sublet.reason && (
            <p className="text-[11px] text-muted-foreground italic">"{sublet.reason}"</p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">Sublets & Short-Term</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            {sublets.length} sublet{sublets.length !== 1 ? "s" : ""} · Davis CA summer marketplace
            <Badge variant="outline" className={`text-[10px] gap-1 ${isLive ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"}`}>
              {isLive ? <><Wifi className="h-2.5 w-2.5" /> Live</> : <><WifiOff className="h-2.5 w-2.5" /> Demo</>}
            </Badge>
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 gap-1.5"><Plus className="h-4 w-4" /> New Sublet</Button>
      </div>

      {/* Season cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/50 bg-card/50 border-cyan-500/20">
          <CardContent className="p-5 text-center space-y-2">
            <Sun className="h-8 w-8 mx-auto text-cyan-400" />
            <p className="text-2xl font-bold font-heading">{season} {year}</p>
            <p className="text-xs text-muted-foreground">Current Season</p>
            <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30">{activeSublets.length} active</Badge>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50 border-violet-500/20">
          <CardContent className="p-5 text-center space-y-2">
            <Globe className="h-8 w-8 mx-auto text-violet-400" />
            <p className="text-2xl font-bold font-heading">Marketplace</p>
            <p className="text-xs text-muted-foreground">Davis CA sublet listings</p>
            <Badge className="bg-violet-500/15 text-violet-400 border-violet-500/30">{sublets.length} total</Badge>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50 border-amber-500/20">
          <CardContent className="p-5 text-center space-y-2">
            <Users className="h-8 w-8 mx-auto text-amber-400" />
            <p className="text-2xl font-bold font-heading">Guests</p>
            <p className="text-xs text-muted-foreground">International & local</p>
            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">{sublets.filter(s => s.guestInfo).length} matched</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search sublets..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({sublets.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({activeSublets.length})</TabsTrigger>
          <TabsTrigger value="draft">Draft ({draftSublets.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedSublets.length})</TabsTrigger>
        </TabsList>
        {["all", "active", "draft", "completed"].map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.filter(s => tab === "all" || s.status === tab).map(renderSubletCard)}
            </div>
            {filtered.filter(s => tab === "all" || s.status === tab).length === 0 && (
              <Card className="border-dashed border-border/50 p-8 text-center">
                <ArrowLeftRight className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No sublets in this category.</p>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Create Sublet Listing</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Tenant</Label>
              <Select value={form.tenantId} onValueChange={v => {
                if (v != null) {
                  setForm({ ...form, tenantId: v });
                  // Auto-fill unit
                  const t = tenants.find(tt => tt.id === v);
                  if (t?.unitId) setForm(prev => ({ ...prev, tenantId: v, unitId: t.unitId || "" }));
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Select tenant..." /></SelectTrigger>
                <SelectContent>
                  {tenants.filter(t => t.unitId).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName} — Unit {units.find(u => u.id === t.unitId)?.unitNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. 2BR near campus — Summer sublet" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Describe your sublet..." /></div>
            <div><Label>Monthly Rent ($)</Label><Input type="number" value={form.monthlyRent} onChange={e => setForm({ ...form, monthlyRent: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
              <div><Label>End Date</Label><Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
            </div>
            <div><Label>Reason (optional)</Label><Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Study abroad, internship..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!form.tenantId || !form.title || saving} className="gradient-brand text-white border-0">{saving ? "Creating..." : "Create Sublet"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <Sheet open={!!showDetail} onOpenChange={(open) => !open && setShowDetail(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {showDetail && (() => {
            const sublet = showDetail;
            const unit = units.find(u => u.id === sublet.unitId);
            const prop = properties.find(p => p.id === sublet.propertyId);
            const tenant = tenants.find(t => t.id === sublet.tenantId);
            const sc = statusConfig[sublet.status] || statusConfig.draft;

            return (
              <>
                <SheetHeader>
                  <SheetTitle className="font-heading text-lg">{sublet.title}</SheetTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`border ${sc.color}`}>{sc.label}</Badge>
                    <Badge variant="outline" className="text-cyan-400 border-cyan-500/30 text-xs">${sublet.monthlyRent}/mo</Badge>
                  </div>
                </SheetHeader>

                <div className="space-y-6 mt-6">
                  {/* Tenant info */}
                  <div className="rounded-lg bg-accent/30 p-4 space-y-1">
                    <p className="text-sm font-medium">Listed by: {tenant?.firstName} {tenant?.lastName}</p>
                    <p className="text-xs text-muted-foreground">{prop?.name} — Unit {unit?.unitNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(sublet.startDate).toLocaleDateString()} — {new Date(sublet.endDate).toLocaleDateString()}
                    </p>
                    {sublet.reason && <p className="text-xs text-muted-foreground italic mt-2">Reason: {sublet.reason}</p>}
                  </div>

                  {/* Description */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Description</h4>
                    <p className="text-xs text-muted-foreground whitespace-pre-line">{sublet.description}</p>
                  </div>

                  {/* Guest info */}
                  {sublet.guestInfo && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Guest</h4>
                      <Card className="border-border/50 bg-accent/30">
                        <CardContent className="p-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-4 w-4 text-violet-400" />
                            <span className="text-sm font-medium">{sublet.guestInfo.name}</span>
                          </div>
                          {sublet.guestInfo.university && <p className="text-xs text-muted-foreground">{sublet.guestInfo.university}</p>}
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" />{sublet.guestInfo.email}</p>
                          {sublet.guestInfo.phone && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" />{sublet.guestInfo.phone}</p>}
                          {sublet.guestInfo.notes && <p className="text-xs text-muted-foreground mt-2 italic">{sublet.guestInfo.notes}</p>}
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap">
                    {sublet.status === "draft" && (
                      <Button size="sm" onClick={() => handleActivate(sublet)} className="gradient-brand text-white border-0 gap-1.5">
                        <Globe className="h-3.5 w-3.5" /> Publish
                      </Button>
                    )}
                    {sublet.status === "active" && (
                      <Button size="sm" onClick={() => handleComplete(sublet)} className="gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark Completed
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="gap-1.5 text-destructive" onClick={() => { if (confirm("Delete?")) { removeSublet(sublet.id); setShowDetail(null); } }}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
