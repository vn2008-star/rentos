"use client";

import React, { useState, useCallback } from "react";
import { BedDouble, Clock, AlertTriangle, CheckCircle2, Plus, Search, Wifi, WifiOff, FileSignature, Calendar, DollarSign, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLeases, useProperties, useUnits, useTenants } from "@/lib/hooks";
import { ESignature } from "@/components/e-signature";
import type { Lease, LeaseStatus } from "@/lib/types";
import { format, differenceInDays, parseISO } from "date-fns";
import toast from "react-hot-toast";
import { useQuickAdd } from "@/lib/quick-add";

const statusConfig: Record<LeaseStatus, { color: string; label: string }> = {
  draft: { color: "bg-gray-500/15 text-gray-400 border-gray-500/30", label: "Draft" },
  active: { color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Active" },
  expiring_soon: { color: "bg-amber-500/15 text-amber-400 border-amber-500/30", label: "Expiring Soon" },
  expired: { color: "bg-red-500/15 text-red-400 border-red-500/30", label: "Expired" },
  month_to_month: { color: "bg-blue-500/15 text-blue-400 border-blue-500/30", label: "Month-to-Month" },
  terminated: { color: "bg-red-500/15 text-red-400 border-red-500/30", label: "Terminated" },
};

export default function LeasesPage() {
  const { leases, isLive, addLease, updateLease, activateLease } = useLeases();
  const { properties } = useProperties();
  const { units } = useUnits();
  const { tenants } = useTenants();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  // Opens this dialog when Quick Add in the top bar asked for it.
  useQuickAdd("lease", () => setShowAdd(true));
  const [selectedLease, setSelectedLease] = useState<Lease | null>(null);
  const [showSign, setShowSign] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    propertyId: "", unitId: "", tenantId: "",
    startDate: "", endDate: "", rentAmount: "",
    securityDeposit: "", terms: "", autoRenew: false,
    lateFeePercent: "5", gracePeriodDays: "5",
  });

  const activeLeases = leases.filter(l => l.status === "active").length;
  const expiringLeases = leases.filter(l => l.status === "expiring_soon").length;
  const draftLeases = leases.filter(l => l.status === "draft").length;
  const totalMonthlyRent = leases
    .filter(l => l.status === "active" || l.status === "month_to_month")
    .reduce((s, l) => s + l.rentAmount, 0);

  const filteredLeases = leases.filter(l => {
    const q = search.toLowerCase();
    const tenant = tenants.find(t => l.tenantIds.includes(t.id));
    const prop = properties.find(p => p.id === l.propertyId);
    const unit = units.find(u => u.id === l.unitId);
    return (
      tenant && `${tenant.firstName} ${tenant.lastName}`.toLowerCase().includes(q) ||
      prop?.name.toLowerCase().includes(q) ||
      unit?.unitNumber.toLowerCase().includes(q) ||
      !q
    );
  });

  const handleAddLease = async () => {
    setSaving(true);
    try {
      await addLease({
        unitId: form.unitId,
        propertyId: form.propertyId,
        tenantIds: [form.tenantId],
        startDate: form.startDate,
        endDate: form.endDate,
        rentAmount: Number(form.rentAmount),
        securityDeposit: Number(form.securityDeposit),
        terms: form.terms,
        autoRenew: form.autoRenew,
        lateFeePercent: Number(form.lateFeePercent),
        gracePeriodDays: Number(form.gracePeriodDays),
      });
      toast.success("Lease created as draft");
      setShowAdd(false);
      setForm({ propertyId: "", unitId: "", tenantId: "", startDate: "", endDate: "", rentAmount: "", securityDeposit: "", terms: "", autoRenew: false, lateFeePercent: "5", gracePeriodDays: "5" });
    } catch { toast.error("Failed to create lease"); }
    finally { setSaving(false); }
  };

  const handleSign = async (signatureData: string) => {
    if (!selectedLease) return;
    const tenantId = selectedLease.tenantIds[0];
    const newSigs = [...selectedLease.signatures, { tenantId, signedAt: new Date().toISOString(), signatureUrl: signatureData }];
    await updateLease(selectedLease.id, { signatures: newSigs, status: "active" });
    setSelectedLease({ ...selectedLease, signatures: newSigs, status: "active" });
    setShowSign(false);
    toast.success("Lease signed and activated!");
  };

  const handleRenewalOffer = async (lease: Lease) => {
    await updateLease(lease.id, { renewalOffered: true, renewalDecision: "pending" });
    setSelectedLease({ ...lease, renewalOffered: true, renewalDecision: "pending" });
    toast.success("Renewal offer sent");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">Leases</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            {leases.length} total leases
            <Badge variant="outline" className={`text-[10px] gap-1 ${isLive ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"}`}>
              {isLive ? <><Wifi className="h-2.5 w-2.5" /> Live</> : <><WifiOff className="h-2.5 w-2.5" /> Demo</>}
            </Badge>
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 gap-1.5">
          <Plus className="h-4 w-4" /> Create Lease
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-emerald-500/20 bg-card/50">
          <CardContent className="p-5 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            <div><p className="text-2xl font-bold font-heading">{activeLeases}</p><p className="text-xs text-muted-foreground">Active</p></div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-card/50">
          <CardContent className="p-5 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
            <div><p className="text-2xl font-bold font-heading">{expiringLeases}</p><p className="text-xs text-muted-foreground">Expiring Soon</p></div>
          </CardContent>
        </Card>
        <Card className="border-gray-500/20 bg-card/50">
          <CardContent className="p-5 flex items-center gap-3">
            <FileSignature className="h-8 w-8 text-gray-400" />
            <div><p className="text-2xl font-bold font-heading">{draftLeases}</p><p className="text-xs text-muted-foreground">Drafts</p></div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-card/50">
          <CardContent className="p-5 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-blue-400" />
            <div><p className="text-2xl font-bold font-heading">${totalMonthlyRent.toLocaleString()}</p><p className="text-xs text-muted-foreground">Monthly Rent</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search leases..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Lease List */}
      <div className="space-y-3">
        {filteredLeases.map(lease => {
          const tenant = tenants.find(t => lease.tenantIds.includes(t.id));
          const prop = properties.find(p => p.id === lease.propertyId);
          const unit = units.find(u => u.id === lease.unitId);
          const sc = statusConfig[lease.status];
          const daysLeft = differenceInDays(parseISO(lease.endDate), new Date());

          return (
            <Card key={lease.id} className="border-border/50 bg-card/50 hover:border-primary/20 transition-colors cursor-pointer" onClick={() => setSelectedLease(lease)}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="rounded-lg bg-accent/50 p-3"><BedDouble className="h-5 w-5 text-primary" /></div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm">{tenant ? `${tenant.firstName} ${tenant.lastName}` : "—"}</h3>
                  <p className="text-xs text-muted-foreground">Unit {unit?.unitNumber || "—"} — {prop?.name || "—"} · {lease.startDate} to {lease.endDate}</p>
                  {daysLeft <= 60 && daysLeft > 0 && lease.status !== "expired" && (
                    <p className="text-xs text-amber-400 mt-0.5 flex items-center gap-1"><Clock className="h-3 w-3" />{daysLeft} days remaining</p>
                  )}
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">${lease.rentAmount}/mo</Badge>
                <Badge variant="outline" className={`text-xs ${sc.color}`}>{sc.label}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Lease Detail Sheet */}
      <Sheet open={!!selectedLease} onOpenChange={() => { setSelectedLease(null); setShowSign(false); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedLease && (() => {
            const tenant = tenants.find(t => selectedLease.tenantIds.includes(t.id));
            const prop = properties.find(p => p.id === selectedLease.propertyId);
            const unit = units.find(u => u.id === selectedLease.unitId);
            const sc = statusConfig[selectedLease.status];

            return (
              <div className="space-y-6">
                <SheetHeader>
                  <SheetTitle className="font-heading text-lg">Lease Details</SheetTitle>
                </SheetHeader>
                <Badge className={`border ${sc.color}`}>{sc.label}</Badge>

                <Card className="border-border/50 bg-card/50">
                  <CardContent className="p-4 space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-xs text-muted-foreground">Tenant</p><p className="font-medium">{tenant ? `${tenant.firstName} ${tenant.lastName}` : "—"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Unit</p><p className="font-medium">Unit {unit?.unitNumber} — {prop?.name}</p></div>
                      <div><p className="text-xs text-muted-foreground">Start Date</p><p className="font-medium">{selectedLease.startDate}</p></div>
                      <div><p className="text-xs text-muted-foreground">End Date</p><p className="font-medium">{selectedLease.endDate}</p></div>
                      <div><p className="text-xs text-muted-foreground">Monthly Rent</p><p className="font-medium text-emerald-400">${selectedLease.rentAmount}</p></div>
                      <div><p className="text-xs text-muted-foreground">Security Deposit</p><p className="font-medium">${selectedLease.securityDeposit}</p></div>
                      <div><p className="text-xs text-muted-foreground">Late Fee</p><p className="font-medium">{selectedLease.lateFeePercent}% after {selectedLease.gracePeriodDays} days</p></div>
                      <div><p className="text-xs text-muted-foreground">Auto-Renew</p><p className="font-medium">{selectedLease.autoRenew ? "Yes" : "No"}</p></div>
                    </div>
                    {selectedLease.terms && (
                      <div className="border-t border-border/30 pt-3">
                        <p className="text-xs text-muted-foreground mb-1">Terms</p>
                        <p className="text-sm">{selectedLease.terms}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Signatures */}
                <Card className="border-border/50 bg-card/50">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileSignature className="h-4 w-4" /> Signatures</CardTitle></CardHeader>
                  <CardContent>
                    {selectedLease.signatures.length > 0 ? (
                      selectedLease.signatures.map((sig, i) => {
                        const signer = tenants.find(t => t.id === sig.tenantId);
                        return (
                          <div key={i} className="flex items-center justify-between py-2">
                            <div>
                              <p className="text-sm font-medium">{signer ? `${signer.firstName} ${signer.lastName}` : sig.tenantId}</p>
                              <p className="text-xs text-muted-foreground">Signed {format(parseISO(sig.signedAt), "MMM d, yyyy h:mm a")}</p>
                            </div>
                            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">No signatures yet</p>
                    )}
                  </CardContent>
                </Card>

                {/* E-Sign */}
                {showSign && (
                  <ESignature
                    signerName={tenant ? `${tenant.firstName} ${tenant.lastName}` : "Tenant"}
                    onSign={handleSign}
                    onCancel={() => setShowSign(false)}
                  />
                )}

                {/* Actions */}
                <div className="space-y-2">
                  {selectedLease.status === "draft" && !showSign && (
                    <Button className="w-full gradient-brand text-white border-0" onClick={() => setShowSign(true)}>
                      <FileSignature className="h-4 w-4 mr-2" /> Sign & Activate Lease
                    </Button>
                  )}
                  {(selectedLease.status === "active" || selectedLease.status === "expiring_soon") && !selectedLease.renewalOffered && (
                    <Button className="w-full" variant="outline" onClick={() => handleRenewalOffer(selectedLease)}>
                      <RefreshCw className="h-4 w-4 mr-2" /> Offer Renewal
                    </Button>
                  )}
                  {selectedLease.renewalOffered && selectedLease.renewalDecision === "pending" && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-400 flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Renewal offer pending tenant response
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Create Lease Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Create New Lease</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Property</Label><Select value={form.propertyId} onValueChange={v => v != null && setForm({ ...form, propertyId: v, unitId: "" })}><SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger><SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              {form.propertyId && (
                <div className="col-span-2"><Label>Unit</Label><Select value={form.unitId} onValueChange={v => v != null && setForm({ ...form, unitId: v })}><SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger><SelectContent>{units.filter(u => u.propertyId === form.propertyId).map(u => <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber} — ${u.rent}/mo</SelectItem>)}</SelectContent></Select></div>
              )}
              <div className="col-span-2"><Label>Tenant</Label><Select value={form.tenantId} onValueChange={v => v != null && setForm({ ...form, tenantId: v })}><SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger><SelectContent>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
              <div><Label>End Date</Label><Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
              <div><Label>Monthly Rent ($)</Label><Input type="number" placeholder="1800" value={form.rentAmount} onChange={e => setForm({ ...form, rentAmount: e.target.value })} /></div>
              <div><Label>Security Deposit ($)</Label><Input type="number" placeholder="1800" value={form.securityDeposit} onChange={e => setForm({ ...form, securityDeposit: e.target.value })} /></div>
              <div><Label>Late Fee (%)</Label><Input type="number" placeholder="5" value={form.lateFeePercent} onChange={e => setForm({ ...form, lateFeePercent: e.target.value })} /></div>
              <div><Label>Grace Period (days)</Label><Input type="number" placeholder="5" value={form.gracePeriodDays} onChange={e => setForm({ ...form, gracePeriodDays: e.target.value })} /></div>
              <div className="col-span-2"><Label>Terms & Conditions</Label><Textarea placeholder="Standard lease terms..." value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} rows={3} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAddLease} disabled={!form.unitId || !form.tenantId || !form.startDate || !form.endDate || !form.rentAmount || saving} className="gradient-brand text-white border-0">
              {saving ? "Creating..." : "Create Lease"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
