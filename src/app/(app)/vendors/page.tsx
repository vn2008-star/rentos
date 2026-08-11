"use client";

import React, { useState } from "react";
import {
  HardHat, Plus, Search, Star, Phone, Mail, MapPin, Shield, Clock,
  Wrench, MoreHorizontal, Edit2, Trash2, Eye, Wifi, WifiOff,
  DollarSign, CheckCircle, Calendar, X, Award,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useVendors, useWorkOrders } from "@/lib/hooks";
import type { MaintenanceCategory } from "@/lib/types";
import toast from "react-hot-toast";
import { useQuickAdd } from "@/lib/quick-add";

const categoryLabels: Record<MaintenanceCategory, string> = {
  plumbing: "🔧 Plumbing", electrical: "⚡ Electrical", hvac: "❄️ HVAC", appliance: "🍽️ Appliance",
  structural: "🏗️ Structural", pest: "🐛 Pest", cleaning: "🧹 Cleaning", landscaping: "🌳 Landscaping", other: "📋 Other",
};

const allSpecialties = Object.keys(categoryLabels) as MaintenanceCategory[];

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function VendorsPage() {
  const { vendors, loading, isLive, addVendor, editVendor, removeVendor } = useVendors();
  const { workOrders } = useWorkOrders();
  const [showAdd, setShowAdd] = useState(false);
  // Opens this dialog when Quick Add in the top bar asked for it.
  useQuickAdd("vendor", () => setShowAdd(true));
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState<string>("all");
  const [saving, setSaving] = useState(false);

  const defaultForm = {
    name: "", company: "", phone: "", email: "",
    hourlyRate: "", insuranceExpiry: "", licenseNumber: "",
    serviceArea: "", notes: "",
    specialties: [] as MaintenanceCategory[],
    availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri"] as string[],
  };
  const [form, setForm] = useState(defaultForm);

  const activeVendors = vendors.filter(v => v.status === "active");
  const totalJobs = vendors.reduce((sum, v) => sum + v.completedJobs, 0);
  const avgRating = vendors.length ? (vendors.reduce((sum, v) => sum + v.rating, 0) / vendors.length) : 0;
  const totalSpend = workOrders.filter(wo => wo.status === "approved" || wo.status === "invoiced").reduce((sum, wo) => sum + (wo.totalCost || 0), 0);

  const filtered = vendors.filter(v => {
    const q = search.toLowerCase();
    const matchSearch = v.name.toLowerCase().includes(q) || (v.company || "").toLowerCase().includes(q);
    const matchSpecialty = filterSpecialty === "all" || v.specialty.includes(filterSpecialty as MaintenanceCategory);
    return matchSearch && matchSpecialty;
  });

  const toggleSpecialty = (spec: MaintenanceCategory) => {
    setForm(prev => ({
      ...prev,
      specialties: prev.specialties.includes(spec) ? prev.specialties.filter(s => s !== spec) : [...prev.specialties, spec],
    }));
  };

  const toggleDay = (day: string) => {
    setForm(prev => ({
      ...prev,
      availableDays: prev.availableDays.includes(day) ? prev.availableDays.filter(d => d !== day) : [...prev.availableDays, day],
    }));
  };

  const handleAdd = async () => {
    if (!form.name || !form.phone || form.specialties.length === 0) {
      toast.error("Name, phone, and at least one specialty are required");
      return;
    }
    setSaving(true);
    try {
      await addVendor({
        name: form.name, company: form.company || undefined, specialty: form.specialties,
        phone: form.phone, email: form.email, hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
        insuranceExpiry: form.insuranceExpiry || undefined, licenseNumber: form.licenseNumber || undefined,
        serviceArea: form.serviceArea || undefined, availableDays: form.availableDays, notes: form.notes || undefined,
      });
      toast.success("Vendor added successfully");
      setShowAdd(false);
      setForm(defaultForm);
    } catch { toast.error("Failed to add vendor"); }
    finally { setSaving(false); }
  };

  const detailVendor = vendors.find(v => v.id === showDetail);
  const detailOrders = workOrders.filter(wo => wo.vendorId === showDetail);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">Vendor Directory</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            {activeVendors.length} active vendors
            <Badge variant="outline" className={`text-[10px] gap-1 ${isLive ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"}`}>
              {isLive ? <><Wifi className="h-2.5 w-2.5" /> Live</> : <><WifiOff className="h-2.5 w-2.5" /> Demo</>}
            </Badge>
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 gap-1.5"><Plus className="h-4 w-4" /> Add Vendor</Button>
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold font-heading text-primary">{activeVendors.length}</p>
            <p className="text-[11px] text-muted-foreground">Active Vendors</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold font-heading text-amber-400">{avgRating.toFixed(1)}</p>
            <p className="text-[11px] text-muted-foreground">Avg Rating</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold font-heading text-blue-400">{totalJobs}</p>
            <p className="text-[11px] text-muted-foreground">Jobs Completed</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold font-heading text-emerald-400">${totalSpend.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground">Total Spend</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search vendors..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterSpecialty} onValueChange={v => v != null && setFilterSpecialty(v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Specialties" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Specialties</SelectItem>
            {allSpecialties.map(s => <SelectItem key={s} value={s}>{categoryLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Vendor Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map(vendor => {
          const vendorOrders = workOrders.filter(wo => wo.vendorId === vendor.id);
          const activeOrders = vendorOrders.filter(wo => !["approved", "invoiced", "cancelled"].includes(wo.status));

          return (
            <Card key={vendor.id} className="group border-border/50 bg-card/50 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                      <HardHat className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm font-heading group-hover:text-primary transition-colors">{vendor.name}</h3>
                      {vendor.company && <p className="text-xs text-muted-foreground">{vendor.company}</p>}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>} />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setShowDetail(vendor.id)}><Eye className="h-4 w-4 mr-2" /> View Profile</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm("Remove this vendor?")) removeVendor(vendor.id); }}>
                        <Trash2 className="h-4 w-4 mr-2" /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <RatingStars rating={vendor.rating} />

                <div className="flex flex-wrap gap-1.5">
                  {vendor.specialty.map(s => <Badge key={s} variant="outline" className="text-[10px]">{categoryLabels[s]}</Badge>)}
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {vendor.phone}</p>
                  <p className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {vendor.email}</p>
                  {vendor.serviceArea && <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {vendor.serviceArea}</p>}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/30">
                  <div className="text-center">
                    <p className="text-sm font-bold text-foreground">{vendor.completedJobs}</p>
                    <p className="text-[10px] text-muted-foreground">Jobs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-foreground">${vendor.avgCost}</p>
                    <p className="text-[10px] text-muted-foreground">Avg Cost</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-foreground">{activeOrders.length}</p>
                    <p className="text-[10px] text-muted-foreground">Active</p>
                  </div>
                </div>

                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setShowDetail(vendor.id)}>
                  View Profile
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Vendor Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Add Vendor</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Name *</Label><Input placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Company</Label><Input placeholder="Company name" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Phone *</Label><Input placeholder="(530) 555-0000" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input placeholder="email@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div>
              <Label>Specialties *</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {allSpecialties.map(spec => (
                  <Badge
                    key={spec}
                    variant={form.specialties.includes(spec) ? "default" : "outline"}
                    className={`cursor-pointer text-xs transition-all ${form.specialties.includes(spec) ? "bg-primary text-primary-foreground" : "hover:border-primary/50"}`}
                    onClick={() => toggleSpecialty(spec)}
                  >{categoryLabels[spec]}</Badge>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Hourly Rate ($)</Label><Input type="number" placeholder="85" value={form.hourlyRate} onChange={e => setForm({ ...form, hourlyRate: e.target.value })} /></div>
              <div><Label>License #</Label><Input placeholder="PL-12345" value={form.licenseNumber} onChange={e => setForm({ ...form, licenseNumber: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Insurance Expiry</Label><Input type="date" value={form.insuranceExpiry} onChange={e => setForm({ ...form, insuranceExpiry: e.target.value })} /></div>
              <div><Label>Service Area</Label><Input placeholder="Davis / Sacramento" value={form.serviceArea} onChange={e => setForm({ ...form, serviceArea: e.target.value })} /></div>
            </div>
            <div>
              <Label>Available Days</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                  <Badge
                    key={day}
                    variant={form.availableDays.includes(day) ? "default" : "outline"}
                    className={`cursor-pointer text-xs ${form.availableDays.includes(day) ? "bg-primary text-primary-foreground" : "hover:border-primary/50"}`}
                    onClick={() => toggleDay(day)}
                  >{day}</Badge>
                ))}
              </div>
            </div>
            <div><Label>Notes</Label><Textarea placeholder="Additional notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving} className="gradient-brand text-white border-0">{saving ? "Saving..." : "Add Vendor"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor Detail Sheet */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailVendor && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                    <HardHat className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    {detailVendor.name}
                    {detailVendor.company && <p className="text-xs text-muted-foreground font-normal">{detailVendor.company}</p>}
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 py-4">
                {/* Rating & Status */}
                <div className="flex items-center gap-4">
                  <RatingStars rating={detailVendor.rating} />
                  <Badge className={detailVendor.status === "active" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-red-500/15 text-red-400 border-red-500/30"}>
                    {detailVendor.status}
                  </Badge>
                </div>

                {/* Contact & Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {detailVendor.phone}</p>
                    <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {detailVendor.email}</p>
                    {detailVendor.serviceArea && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {detailVendor.serviceArea}</p>}
                  </div>
                  <div className="space-y-2 text-sm">
                    {detailVendor.hourlyRate && <p className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" /> ${detailVendor.hourlyRate}/hr</p>}
                    {detailVendor.licenseNumber && <p className="flex items-center gap-2"><Award className="h-4 w-4 text-muted-foreground" /> {detailVendor.licenseNumber}</p>}
                    {detailVendor.insuranceExpiry && <p className="flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground" /> Ins. exp: {detailVendor.insuranceExpiry}</p>}
                  </div>
                </div>

                {/* Specialties */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Specialties</p>
                  <div className="flex flex-wrap gap-1.5">
                    {detailVendor.specialty.map(s => <Badge key={s} variant="outline" className="text-xs">{categoryLabels[s]}</Badge>)}
                  </div>
                </div>

                {/* Availability */}
                {detailVendor.availableDays && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Availability</p>
                    <div className="flex flex-wrap gap-1.5">
                      {detailVendor.availableDays.map(d => <Badge key={d} className="bg-primary/10 text-primary border-primary/20 text-xs">{d}</Badge>)}
                    </div>
                  </div>
                )}

                {/* Performance Stats */}
                <div className="grid grid-cols-4 gap-3 p-3 rounded-lg bg-accent/30 border border-border/30">
                  <div className="text-center">
                    <p className="text-lg font-bold font-heading">{detailVendor.completedJobs}</p>
                    <p className="text-[10px] text-muted-foreground">Jobs Done</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold font-heading">${detailVendor.avgCost}</p>
                    <p className="text-[10px] text-muted-foreground">Avg Cost</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold font-heading text-amber-400">{detailVendor.rating.toFixed(1)}</p>
                    <p className="text-[10px] text-muted-foreground">Rating</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold font-heading text-emerald-400">
                      ${detailOrders.reduce((s, wo) => s + (wo.totalCost || 0), 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Total Billed</p>
                  </div>
                </div>

                {/* Work Order History */}
                <div>
                  <p className="text-sm font-medium mb-3">Work Order History</p>
                  {detailOrders.length > 0 ? (
                    <div className="space-y-2">
                      {detailOrders.map(wo => (
                        <div key={wo.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/30">
                          <div>
                            <p className="text-sm font-medium">{wo.id}</p>
                            <p className="text-xs text-muted-foreground">{wo.scheduledDate || "—"}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {wo.totalCost && <span className="text-sm font-medium text-emerald-400">${wo.totalCost}</span>}
                            <Badge variant="outline" className="text-[10px]">{wo.status.replace(/_/g, " ")}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">No work orders yet</p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
