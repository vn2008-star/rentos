"use client";

import React, { useState } from "react";
import { Plus, Search, Phone, Mail, MapPin, MoreHorizontal, Edit2, Trash2, Eye, Wifi, WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { useTenants, useUnits, useProperties } from "@/lib/hooks";
import toast from "react-hot-toast";
import { useQuickAdd } from "@/lib/quick-add";

export default function TenantsPage() {
  const { tenants, loading, isLive, addTenant, removeTenant } = useTenants();
  const { units } = useUnits();
  const { properties } = useProperties();
  const [showAdd, setShowAdd] = useState(false);
  // Opens this dialog when Quick Add in the top bar asked for it.
  useQuickAdd("tenant", () => setShowAdd(true));
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", unitId: "", propertyId: "", notes: "" });

  const filtered = tenants.filter((t) => {
    const q = search.toLowerCase();
    return `${t.firstName} ${t.lastName}`.toLowerCase().includes(q) || t.email.toLowerCase().includes(q) || t.phone.includes(q);
  });

  const handleAdd = async () => {
    setSaving(true);
    try {
      await addTenant({
        firstName: form.firstName, lastName: form.lastName, email: form.email,
        phone: form.phone, unitId: form.unitId || undefined, propertyId: form.propertyId || undefined,
        notes: form.notes || undefined,
      });
      toast.success(`${form.firstName} ${form.lastName} added`);
      setShowAdd(false);
      setForm({ firstName: "", lastName: "", email: "", phone: "", unitId: "", propertyId: "", notes: "" });
    } catch { toast.error("Failed to add tenant"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Remove "${name}"?`)) { await removeTenant(id); toast.success("Tenant removed"); }
  };

  const avatarColors = ["bg-blue-500/20 text-blue-400", "bg-emerald-500/20 text-emerald-400", "bg-violet-500/20 text-violet-400", "bg-rose-500/20 text-rose-400", "bg-amber-500/20 text-amber-400", "bg-cyan-500/20 text-cyan-400"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">Tenants</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            {loading ? "Loading tenants…" : `${tenants.length} tenants across your properties`}
            <Badge variant="outline" className={`text-[10px] gap-1 ${isLive ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"}`}>
              {isLive ? <><Wifi className="h-2.5 w-2.5" /> Live</> : <><WifiOff className="h-2.5 w-2.5" /> Demo</>}
            </Badge>
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 gap-1.5"><Plus className="h-4 w-4" /> Add Tenant</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search tenants..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/50 bg-card/50"><CardContent className="p-3 text-center"><p className="text-2xl font-bold font-heading">{tenants.length}</p><p className="text-[11px] text-muted-foreground">Total</p></CardContent></Card>
        <Card className="border-border/50 bg-card/50"><CardContent className="p-3 text-center"><p className="text-2xl font-bold font-heading text-emerald-400">{tenants.filter(t => t.unitId).length}</p><p className="text-[11px] text-muted-foreground">Assigned</p></CardContent></Card>
        <Card className="border-border/50 bg-card/50"><CardContent className="p-3 text-center"><p className="text-2xl font-bold font-heading text-amber-400">{tenants.filter(t => !t.unitId).length}</p><p className="text-[11px] text-muted-foreground">Unassigned</p></CardContent></Card>
        <Card className="border-border/50 bg-card/50"><CardContent className="p-3 text-center"><p className="text-2xl font-bold font-heading text-blue-400">{new Set(tenants.map(t => t.propertyId).filter(Boolean)).size}</p><p className="text-[11px] text-muted-foreground">Properties</p></CardContent></Card>
      </div>

      {/* Tenant Cards */}
      {loading ? (
        <CardGridSkeleton count={8} height="h-48" className="gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:grid-cols-2" />
      ) : (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((tenant, idx) => {
          const unit = units.find(u => u.id === tenant.unitId);
          const prop = properties.find(p => p.id === tenant.propertyId);
          const initials = `${tenant.firstName[0]}${tenant.lastName[0]}`;
          return (
            <Card key={tenant.id} className="group border-border/50 bg-card/50 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 ring-2 ring-border/50 group-hover:ring-primary/30 transition-all">
                      <AvatarFallback className={`${avatarColors[idx % avatarColors.length]} text-sm font-semibold`}>{initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-sm font-heading group-hover:text-primary transition-colors">{tenant.firstName} {tenant.lastName}</h3>
                      {unit ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Unit {unit.unitNumber} · {prop?.name || "—"}</p>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30 h-5">Unassigned</Badge>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>} />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem><Eye className="h-4 w-4 mr-2" /> View Profile</DropdownMenuItem>
                      <DropdownMenuItem><Edit2 className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(tenant.id, `${tenant.firstName} ${tenant.lastName}`)}><Trash2 className="h-4 w-4 mr-2" /> Remove</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p className="flex items-center gap-2"><Mail className="h-3 w-3" />{tenant.email}</p>
                  <p className="flex items-center gap-2"><Phone className="h-3 w-3" />{tenant.phone}</p>
                </div>
                {tenant.notes && <p className="text-xs text-muted-foreground/60 italic border-t border-border/30 pt-2">{tenant.notes}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Add New Tenant</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>First Name</Label><Input placeholder="Sarah" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div>
              <div><Label>Last Name</Label><Input placeholder="Chen" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div>
              <div className="col-span-2"><Label>Email</Label><Input type="email" placeholder="tenant@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="col-span-2"><Label>Phone</Label><Input placeholder="(530) 555-0000" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="col-span-2"><Label>Assign to Property</Label><Select value={form.propertyId} onValueChange={v => v != null && setForm({ ...form, propertyId: v, unitId: "" })}><SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger><SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              {form.propertyId && (
                <div className="col-span-2"><Label>Assign to Unit</Label><Select value={form.unitId} onValueChange={v => v != null && setForm({ ...form, unitId: v })}><SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger><SelectContent>{units.filter(u => u.propertyId === form.propertyId && u.status === "available").map(u => <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber} — ${u.rent}/mo</SelectItem>)}</SelectContent></Select></div>
              )}
              <div className="col-span-2"><Label>Notes</Label><Textarea placeholder="Optional notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!form.firstName || !form.lastName || !form.email || saving} className="gradient-brand text-white border-0">{saving ? "Saving..." : "Add Tenant"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
