"use client";

import React, { useState } from "react";
import {
  Plus, Calendar, Clock, Users, ShieldCheck, XCircle,
  Trash2, GraduationCap, Home, Loader2, Mail,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSublets, useCurrentTenant } from "@/lib/hooks";
import type { SubletStatus } from "@/lib/types";
import toast from "react-hot-toast";

/**
 * The tenant's own sublet listings.
 *
 * This page used to render a hardcoded array and "publish" through a 1.5-second
 * timer, so nothing a tenant wrote here ever reached Firestore. It now reads and
 * writes the real collection, scoped to their own tenantId by the rules.
 *
 * A listing does not go live on submission. Most leases forbid subletting
 * without the landlord's consent, so it waits for the org to review it — the
 * alternative is encouraging a tenant into the thing that gets them evicted.
 */

const statusConfig: Record<SubletStatus, { label: string; color: string; hint: string }> = {
  draft: {
    label: "Draft", color: "text-slate-400 bg-slate-500/15 border-slate-500/30",
    hint: "Not sent yet.",
  },
  pending_approval: {
    label: "Awaiting approval", color: "text-amber-400 bg-amber-500/15 border-amber-500/30",
    hint: "Your property manager is reviewing this. You'll see it go live here once approved.",
  },
  active: {
    label: "Live", color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
    hint: "Approved and visible to people looking for a sublet.",
  },
  rejected: {
    label: "Not approved", color: "text-red-400 bg-red-500/15 border-red-500/30",
    hint: "Your property manager did not approve this listing.",
  },
  completed: {
    label: "Completed", color: "text-blue-400 bg-blue-500/15 border-blue-500/30",
    hint: "This sublet has finished.",
  },
  cancelled: {
    label: "Withdrawn", color: "text-slate-400 bg-slate-500/15 border-slate-500/30",
    hint: "You withdrew this listing.",
  },
};

export default function TenantSubletPage() {
  const { sublets, loading, addSublet, updateSublet } = useSublets();
  const { tenant } = useCurrentTenant();
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", monthlyRent: "", startDate: "", endDate: "", reason: "",
  });

  // Without a unit on their record there is nothing to sublet, and addSublet
  // would file a listing against an empty unitId.
  const canList = Boolean(tenant?.unitId);

  const handleCreate = async () => {
    if (!form.title || !form.startDate || !form.endDate) {
      toast.error("Title and dates are required");
      return;
    }
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      toast.error("The end date has to come after the start date");
      return;
    }
    if (!tenant?.id || !tenant.unitId) {
      toast.error("We can't find your unit — contact your property manager");
      return;
    }

    setSaving(true);
    try {
      await addSublet({
        tenantId: tenant.id,
        unitId: tenant.unitId,
        propertyId: tenant.propertyId || "",
        leaseId: tenant.leaseId,
        title: form.title,
        description: form.description,
        monthlyRent: parseInt(form.monthlyRent) || 0,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason,
      });
      toast.success("Sent to your property manager for approval");
      setShowCreate(false);
      setForm({ title: "", description: "", monthlyRent: "", startDate: "", endDate: "", reason: "" });
    } catch {
      toast.error("Couldn't save your listing — please try again");
    } finally {
      setSaving(false);
    }
  };

  const handleWithdraw = async (id: string) => {
    if (!confirm("Withdraw this listing?")) return;
    try {
      await updateSublet(id, { status: "cancelled" });
      toast.success("Listing withdrawn");
    } catch {
      toast.error("Couldn't withdraw the listing");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">My Sublets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sublet your unit while you&apos;re away</p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          disabled={!canList}
          className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 gap-1.5"
        >
          <Plus className="h-4 w-4" /> List My Unit
        </Button>
      </div>

      {/* What actually happens when they submit. */}
      <Card className="border-cyan-500/20 bg-cyan-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-cyan-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Your listing is reviewed first</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Most leases require your landlord&apos;s permission before you sublet. When you submit a
              listing it goes to your property manager, and it only becomes visible to guests once
              they approve it — so you never end up breaking your own lease. Good for summer study
              abroad, internships, or a term away.
            </p>
          </div>
        </CardContent>
      </Card>

      {!canList && !loading && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4 text-sm text-muted-foreground">
            We can&apos;t see a unit on your tenant record yet, so there&apos;s nothing to list.
            Ask your property manager to link your unit and this page will open up.
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card className="border-dashed border-border/50 p-12 text-center">
          <Loader2 className="h-8 w-8 mx-auto text-muted-foreground/40 animate-spin" />
        </Card>
      ) : sublets.length > 0 ? (
        <div className="space-y-4">
          {sublets.map(sublet => {
            const sc = statusConfig[sublet.status] || statusConfig.draft;
            const live = sublet.status === "active";
            const withdrawable = sublet.status === "pending_approval" || live;

            return (
              <Card key={sublet.id} className="border-border/50 bg-card/50">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold font-heading">{sublet.title}</h3>
                      {sublet.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{sublet.description}</p>
                      )}
                    </div>
                    <Badge className={`border shrink-0 ${sc.color}`}>{sc.label}</Badge>
                  </div>

                  <div className="flex items-center gap-4 text-xs flex-wrap">
                    <span className="text-cyan-400 font-medium">${sublet.monthlyRent.toLocaleString()}/mo</span>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {sublet.startDate} — {sublet.endDate}
                    </span>
                    {live && (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" /> {sublet.applicationIds.length} enquir{sublet.applicationIds.length === 1 ? "y" : "ies"}
                      </span>
                    )}
                  </div>

                  {/* Status in words. A bare badge does not tell someone whether
                      they are waiting on anything or on nobody. */}
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Clock className="h-3 w-3 mt-0.5 shrink-0" /> {sc.hint}
                  </p>

                  {sublet.status === "rejected" && sublet.rejectionReason && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium">Reason given</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{sublet.rejectionReason}</p>
                      </div>
                    </div>
                  )}

                  {sublet.guestInfo && (
                    <div className="rounded-lg bg-accent/30 p-3 flex items-center gap-3">
                      <GraduationCap className="h-5 w-5 text-violet-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{sublet.guestInfo.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          {sublet.guestInfo.university && <span>{sublet.guestInfo.university} ·</span>}
                          <Mail className="h-3 w-3" /> {sublet.guestInfo.email}
                        </p>
                      </div>
                      <Badge className="ml-auto bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs shrink-0">
                        Matched
                      </Badge>
                    </div>
                  )}

                  {sublet.reason && (
                    <p className="text-xs text-muted-foreground italic">Reason: {sublet.reason}</p>
                  )}

                  {withdrawable && (
                    <div className="flex gap-2">
                      <Button
                        size="sm" variant="outline"
                        className="gap-1.5 text-destructive"
                        onClick={() => handleWithdraw(sublet.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Withdraw
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed border-border/50 p-12 text-center">
          <Home className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
          <h3 className="text-lg font-semibold font-heading">No sublets yet</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            Going away for the summer? List your unit and we&apos;ll send it to your property
            manager for approval.
          </p>
          <Button onClick={() => setShowCreate(true)} disabled={!canList} className="mt-4 gap-1.5">
            <Plus className="h-4 w-4" /> List My Unit
          </Button>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Sublet My Unit</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              This goes to your property manager for approval before anyone can see it.
            </p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. 2BR near campus — Summer sublet" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Describe your unit and what's included..." />
            </div>
            <div>
              <Label>Monthly Rent ($)</Label>
              <Input type="number" value={form.monthlyRent} onChange={e => setForm({ ...form, monthlyRent: e.target.value })} placeholder="e.g. 1500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Study abroad, internship, visiting family..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="gradient-brand text-white border-0">
              {saving ? "Sending..." : "Send for Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
