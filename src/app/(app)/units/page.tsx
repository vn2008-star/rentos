"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Filter, Bed, Bath, Ruler, DollarSign, MoreHorizontal, Edit2, Trash2, Eye, Wifi, WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PhotoUpload } from "@/components/photo-upload";
import { useUnits, useProperties } from "@/lib/hooks";
import type { UnitStatus } from "@/lib/types";
import toast from "react-hot-toast";

const statusConfig: Record<UnitStatus, { label: string; color: string; bg: string }> = {
  available: { label: "Available", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30" },
  occupied: { label: "Occupied", color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30" },
  maintenance: { label: "Maintenance", color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30" },
  reserved: { label: "Reserved", color: "text-violet-400", bg: "bg-violet-500/15 border-violet-500/30" },
  sublet: { label: "Sublet", color: "text-cyan-400", bg: "bg-cyan-500/15 border-cyan-500/30" },
  offline: { label: "Offline", color: "text-gray-400", bg: "bg-gray-500/15 border-gray-500/30" },
};

export default function UnitsPage() {
  const router = useRouter();
  const { units, loading, isLive, addUnit, removeUnit } = useUnits();
  const { properties } = useProperties();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [photos, setPhotos] = useState<(File | string)[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ propertyId: "", unitNumber: "", beds: "1", baths: "1", sqft: "600", rent: "1400", deposit: "1400", status: "available" as UnitStatus });

  const filtered = units.filter((u) => {
    const q = search.toLowerCase();
    const prop = properties.find(p => p.id === u.propertyId);
    const matchSearch = u.unitNumber.toLowerCase().includes(q) || prop?.name.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || u.status === statusFilter;
    const matchProperty = propertyFilter === "all" || u.propertyId === propertyFilter;
    return matchSearch && matchStatus && matchProperty;
  });

  const statusCounts = Object.entries(statusConfig).map(([status, config]) => ({
    status, ...config, count: units.filter(u => u.status === status).length,
  }));

  const handleAdd = async () => {
    setSaving(true);
    try {
      await addUnit({
        propertyId: form.propertyId, unitNumber: form.unitNumber,
        beds: Number(form.beds), baths: Number(form.baths), sqft: Number(form.sqft),
        rent: Number(form.rent), deposit: Number(form.deposit), status: form.status,
        photos: photos.filter((p): p is File => p instanceof File),
      });
      toast.success(`Unit ${form.unitNumber} added`);
      setShowAdd(false);
      setForm({ propertyId: "", unitNumber: "", beds: "1", baths: "1", sqft: "600", rent: "1400", deposit: "1400", status: "available" });
      setPhotos([]);
    } catch (err: any) {
      // Plan limits and rule denials both arrive here, and each has something
      // specific to say — "Failed to add unit" told the user nothing.
      toast.error(err?.message || "Failed to add unit");
    }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, num: string) => {
    if (confirm(`Delete unit "${num}"?`)) { await removeUnit(id); toast.success("Unit deleted"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">Units</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            {units.length} total units across {properties.length} properties
            <Badge variant="outline" className={`text-[10px] gap-1 ${isLive ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"}`}>
              {isLive ? <><Wifi className="h-2.5 w-2.5" /> Live</> : <><WifiOff className="h-2.5 w-2.5" /> Demo</>}
            </Badge>
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 gap-1.5"><Plus className="h-4 w-4" /> Add Unit</Button>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statusCounts.map((s) => (
          <Card key={s.status} className={`border-border/50 bg-card/50 hover:border-primary/20 transition-colors cursor-pointer ${statusFilter === s.status ? "ring-2 ring-primary/40" : ""}`} onClick={() => setStatusFilter(statusFilter === s.status ? "all" : s.status)}>
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-bold font-heading ${s.color}`}>{s.count}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search units..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={propertyFilter} onValueChange={v => v != null && setPropertyFilter(v)}>
          <SelectTrigger className="w-[200px]"><Filter className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue placeholder="All Properties" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Units Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((unit) => {
          const prop = properties.find(p => p.id === unit.propertyId);
          const sc = statusConfig[unit.status];
          const hasPhotos = unit.photos && unit.photos.length > 0;
          return (
            <Card key={unit.id} className="group border-border/50 bg-card/50 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 overflow-hidden">
              <div className={`h-1.5 ${unit.status === "available" ? "bg-emerald-500" : unit.status === "occupied" ? "bg-blue-500" : unit.status === "maintenance" ? "bg-amber-500" : "bg-violet-500"}`} />
              {hasPhotos && (
                <div className="h-32 overflow-hidden"><img src={unit.photos[0]} alt={`Unit ${unit.unitNumber}`} className="h-full w-full object-cover" /></div>
              )}
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-base font-heading group-hover:text-primary transition-colors">Unit {unit.unitNumber}</h3>
                    <p className="text-xs text-muted-foreground">{prop?.name || "—"}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>} />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/units/${unit.id}`)}><Eye className="h-4 w-4 mr-2" /> View</DropdownMenuItem>
                      <DropdownMenuItem><Edit2 className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(unit.id, unit.unitNumber)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Badge className={`border ${sc.bg} text-[10px]`}>{sc.label}</Badge>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Bed className="h-3 w-3" />{unit.beds}bd</span>
                  <span className="flex items-center gap-1"><Bath className="h-3 w-3" />{unit.baths}ba</span>
                  <span className="flex items-center gap-1"><Ruler className="h-3 w-3" />{unit.sqft}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <span className="text-lg font-bold font-heading">${unit.rent.toLocaleString()}<span className="text-xs font-normal text-muted-foreground">/mo</span></span>
                  <Button variant="outline" size="sm" className="h-7 text-[11px]"
                    onClick={() => router.push(`/units/${unit.id}`)}>
                    Photos · Notes · Keys
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Unit Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Add New Unit</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Property</Label><Select value={form.propertyId} onValueChange={v => v != null && setForm({ ...form, propertyId: v })}><SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger><SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Unit Number</Label><Input placeholder="101" value={form.unitNumber} onChange={e => setForm({ ...form, unitNumber: e.target.value })} /></div>
              <div><Label>Status</Label><Select value={form.status} onValueChange={v => v != null && setForm({ ...form, status: v as UnitStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Bedrooms</Label><Input type="number" min="0" value={form.beds} onChange={e => setForm({ ...form, beds: e.target.value })} /></div>
              <div><Label>Bathrooms</Label><Input type="number" min="0" step="0.5" value={form.baths} onChange={e => setForm({ ...form, baths: e.target.value })} /></div>
              <div><Label>Sq Ft</Label><Input type="number" min="0" value={form.sqft} onChange={e => setForm({ ...form, sqft: e.target.value })} /></div>
              <div><Label>Rent $/mo</Label><Input type="number" min="0" value={form.rent} onChange={e => setForm({ ...form, rent: e.target.value })} /></div>
              <div className="col-span-2"><Label>Deposit</Label><Input type="number" min="0" value={form.deposit} onChange={e => setForm({ ...form, deposit: e.target.value })} /></div>
            </div>
            <PhotoUpload photos={photos} onChange={setPhotos} maxPhotos={8} label="Unit Photos" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!form.propertyId || !form.unitNumber || saving} className="gradient-brand text-white border-0">{saving ? "Saving..." : "Add Unit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
