"use client";

import React, { useState } from "react";
import { Building2, Plus, MapPin, Search, Filter, MoreHorizontal, Edit2, Trash2, Eye, Wifi, WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { PhotoUpload } from "@/components/photo-upload";
import { useProperties, useUnits } from "@/lib/hooks";
import type { PropertyType } from "@/lib/types";
import toast from "react-hot-toast";
import { useQuickAdd } from "@/lib/quick-add";

const typeIcons: Record<PropertyType, string> = { apartment: "🏢", single_family: "🏠", condo: "🏬", room: "🛏️", airbnb: "✈️", townhouse: "🏘️" };
const typeColors: Record<PropertyType, string> = { apartment: "bg-blue-500/15 text-blue-400 border-blue-500/30", single_family: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", condo: "bg-violet-500/15 text-violet-400 border-violet-500/30", room: "bg-amber-500/15 text-amber-400 border-amber-500/30", airbnb: "bg-rose-500/15 text-rose-400 border-rose-500/30", townhouse: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" };

export default function PropertiesPage() {
  const { properties, loading, isLive, addProperty, removeProperty } = useProperties();
  const { units } = useUnits();
  const [showAdd, setShowAdd] = useState(false);
  // Opens this dialog when Quick Add in the top bar asked for it.
  useQuickAdd("property", () => setShowAdd(true));
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [photos, setPhotos] = useState<(File | string)[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", type: "apartment" as PropertyType, street: "", city: "Davis", state: "CA", zip: "", description: "", amenities: "" });

  const filtered = properties.filter((p) => {
    const q = search.toLowerCase();
    return (p.name.toLowerCase().includes(q) || p.address.city.toLowerCase().includes(q)) && (typeFilter === "all" || p.type === typeFilter);
  });

  const handleAdd = async () => {
    setSaving(true);
    try {
      await addProperty({
        name: form.name, type: form.type, street: form.street, city: form.city,
        state: form.state, zip: form.zip, description: form.description,
        amenities: form.amenities.split(",").map(a => a.trim()).filter(Boolean),
        photos: photos.filter((p): p is File => p instanceof File),
      });
      toast.success("Property added successfully");
      setShowAdd(false);
      setForm({ name: "", type: "apartment", street: "", city: "Davis", state: "CA", zip: "", description: "", amenities: "" });
      setPhotos([]);
    } catch {
      toast.error("Failed to add property");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete "${name}"? This cannot be undone.`)) {
      await removeProperty(id);
      toast.success("Property deleted");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">Properties</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            {loading ? "Loading your portfolio…" : `Manage your ${properties.length} properties`}
            <Badge variant="outline" className={`text-[10px] gap-1 ${isLive ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"}`}>
              {isLive ? <><Wifi className="h-2.5 w-2.5" /> Live</> : <><WifiOff className="h-2.5 w-2.5" /> Demo</>}
            </Badge>
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 gap-1.5"><Plus className="h-4 w-4" /> Add Property</Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search properties..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={v => v != null && setTypeFilter(v)}>
          <SelectTrigger className="w-[180px]"><Filter className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="apartment">🏢 Apartment</SelectItem>
            <SelectItem value="single_family">🏠 Single Family</SelectItem>
            <SelectItem value="room">🛏️ Room</SelectItem>
            <SelectItem value="airbnb">✈️ Airbnb</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? <CardGridSkeleton count={6} height="h-[300px]" /> : (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((property) => {
          const pUnits = units.filter(u => u.propertyId === property.id);
          const occRate = property.totalUnits > 0 ? Math.round((property.occupiedUnits / property.totalUnits) * 100) : 0;
          const totalRent = pUnits.reduce((s, u) => s + u.rent, 0);
          const hasPhotos = property.photos && property.photos.length > 0;
          return (
            <Card key={property.id} className="group relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
              <div className="relative h-40 overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20">
                {hasPhotos ? (
                  <img src={property.photos[0]} alt={property.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center"><span className="text-5xl">{typeIcons[property.type]}</span></div>
                )}
                <div className="absolute top-3 left-3"><Badge className={`border ${typeColors[property.type]}`}>{property.type.replace("_", " ")}</Badge></div>
                <div className="absolute top-3 right-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="secondary" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur-sm"><MoreHorizontal className="h-4 w-4" /></Button>} />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem><Eye className="h-4 w-4 mr-2" /> View</DropdownMenuItem>
                      <DropdownMenuItem><Edit2 className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(property.id, property.name)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-base font-heading truncate group-hover:text-primary transition-colors">{property.name}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3.5 w-3.5" />{property.address.street}, {property.address.city}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center rounded-lg bg-accent/40 py-2"><p className="text-lg font-bold font-heading">{property.totalUnits}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Units</p></div>
                  <div className="text-center rounded-lg bg-accent/40 py-2"><p className="text-lg font-bold font-heading text-emerald-400">{occRate}%</p><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Occupied</p></div>
                  <div className="text-center rounded-lg bg-accent/40 py-2"><p className="text-lg font-bold font-heading">${(totalRent / 1000).toFixed(1)}k</p><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Revenue</p></div>
                </div>
                {property.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {property.amenities.slice(0, 3).map(a => <Badge key={a} variant="outline" className="text-[10px] py-0 h-5">{a}</Badge>)}
                    {property.amenities.length > 3 && <Badge variant="outline" className="text-[10px] py-0 h-5">+{property.amenities.length - 3}</Badge>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        <Card onClick={() => setShowAdd(true)} className="flex items-center justify-center min-h-[300px] border-dashed border-2 border-border/50 bg-card/30 hover:border-primary/40 hover:bg-card/50 transition-all cursor-pointer group">
          <div className="text-center space-y-3">
            <div className="mx-auto rounded-xl bg-accent/50 p-4 group-hover:bg-primary/10 transition-colors"><Plus className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" /></div>
            <p className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">Add Property</p>
          </div>
        </Card>
      </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Add New Property</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Property Name</Label><Input placeholder="e.g. University Commons" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Type</Label><Select value={form.type} onValueChange={v => v != null && setForm({ ...form, type: v as PropertyType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="apartment">Apartment</SelectItem><SelectItem value="single_family">Single Family</SelectItem><SelectItem value="room">Room</SelectItem><SelectItem value="airbnb">Airbnb</SelectItem><SelectItem value="townhouse">Townhouse</SelectItem></SelectContent></Select></div>
              <div><Label>ZIP</Label><Input placeholder="95616" value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} /></div>
              <div className="col-span-2"><Label>Street Address</Label><Input placeholder="123 Main St" value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} /></div>
              <div><Label>City</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>State</Label><Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
              <div className="col-span-2"><Label>Description</Label><Textarea placeholder="Brief description..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="col-span-2"><Label>Amenities (comma-separated)</Label><Input placeholder="Pool, Gym, Parking" value={form.amenities} onChange={e => setForm({ ...form, amenities: e.target.value })} /></div>
            </div>
            <PhotoUpload photos={photos} onChange={setPhotos} maxPhotos={6} label="Property Photos" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!form.name || !form.street || saving} className="gradient-brand text-white border-0">
              {saving ? "Saving..." : "Add Property"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
