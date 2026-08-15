"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle, Clock, Play, Camera, DollarSign, MapPin, Phone,
  Mail, FileText, AlertTriangle, Loader2, Upload, Wrench,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWorkOrders, useMaintenance, useUnits, useProperties, useTenants, useVendors, useCurrentVendor } from "@/lib/hooks";
import { useAuthStore } from "@/lib/store";
import { PhotoUpload } from "@/components/photo-upload";
import toast from "react-hot-toast";

const statusFlow: Record<string, { label: string; color: string }> = {
  assigned: { label: "Assigned", color: "text-blue-400 bg-blue-500/15 border-blue-500/30" },
  accepted: { label: "Accepted", color: "text-violet-400 bg-violet-500/15 border-violet-500/30" },
  in_progress: { label: "In Progress", color: "text-amber-400 bg-amber-500/15 border-amber-500/30" },
  completed: { label: "Completed", color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" },
  pending_approval: { label: "Pending Approval", color: "text-amber-400 bg-amber-500/15 border-amber-500/30" },
  approved: { label: "Approved", color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" },
  invoiced: { label: "Invoiced", color: "text-primary bg-primary/15 border-primary/30" },
  cancelled: { label: "Cancelled", color: "text-red-400 bg-red-500/15 border-red-500/30" },
};

export default function ContractorOrderPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  const { workOrders, acceptOrder, startOrder, completeOrder } = useWorkOrders();
  const { requests } = useMaintenance();
  const { units } = useUnits();
  const { properties } = useProperties();
  const { tenants } = useTenants();
  const { vendors } = useVendors();
  const { vendor: currentVendor, loading: vendorLoading } = useCurrentVendor();
  const user = useAuthStore(s => s.user);

  const [saving, setSaving] = useState(false);
  const [costForm, setCostForm] = useState({ laborHours: "", materialsCost: "", materialsDesc: "", notes: "" });
  const [completionPhotos, setCompletionPhotos] = useState<(File | string)[]>([]);
  const [receiptPhotos, setReceiptPhotos] = useState<(File | string)[]>([]);

  const wo = workOrders.find(w => w.id === orderId);
  if (!wo) {
    return (
      <div className="text-center py-20">
        <Wrench className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-lg font-semibold">Work order not found</h2>
        <p className="text-sm text-muted-foreground mt-1">Check the URL or contact your property manager.</p>
      </div>
    );
  }

  // A work order exposes the tenant's name, phone, email, the unit address and
  // the access instructions — so only the assigned vendor may open it. Managers
  // and owners keep access so they can work a job on a contractor's behalf.
  const isManager = user?.role === "manager" || user?.role === "owner" || user?.role === "super_admin";
  const isAssignedVendor = !!currentVendor && currentVendor.id === wo.vendorId;

  // Resolve identity BEFORE rendering: waiting until the vendor record loads
  // would otherwise flash the tenant's contact details and access instructions
  // to whoever opened the URL.
  if (!isManager && vendorLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verifying assignment...
      </div>
    );
  }

  if (!isManager && !isAssignedVendor) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-lg font-semibold">This job isn&apos;t assigned to you</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Signed in as {user?.email || "unknown"}. Contact your property manager if you
          believe this is a mistake.
        </p>
      </div>
    );
  }

  const req = requests.find(r => r.id === wo.maintenanceRequestId);
  const unit = units.find(u => u.id === wo.unitId);
  const prop = properties.find(p => p.id === wo.propertyId);
  const tenant = req ? tenants.find(t => t.id === req.tenantId) : null;
  const vendor = vendors.find(v => v.id === wo.vendorId);
  const sc = statusFlow[wo.status] || statusFlow.assigned;

  const handleAccept = async () => {
    setSaving(true);
    await acceptOrder(wo.id);
    toast.success("Job accepted!");
    setSaving(false);
  };

  const handleStart = async () => {
    setSaving(true);
    await startOrder(wo.id);
    toast.success("Job started!");
    setSaving(false);
  };

  const handleComplete = async () => {
    const hours = parseFloat(costForm.laborHours);
    const materials = parseFloat(costForm.materialsCost) || 0;
    if (!hours || hours <= 0) { toast.error("Enter labor hours"); return; }
    setSaving(true);
    const rate = vendor?.hourlyRate || 75;
    await completeOrder(wo.id, {
      laborHours: hours,
      laborCost: hours * rate,
      materialsCost: materials,
      materialsDescription: costForm.materialsDesc || undefined,
      vendorNotes: costForm.notes || undefined,
    });
    toast.success("Job completed — submitted for manager approval");
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-heading">Work Order {wo.id}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{req?.title || "Maintenance Request"}</p>
        </div>
        <Badge className={`border ${sc.color}`}>{sc.label}</Badge>
      </div>

      {/* Job Details */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">Job Details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Property</p>
              <p className="font-medium">{prop?.name || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Unit</p>
              <p className="font-medium">{unit ? `Unit ${unit.unitNumber}` : "—"}</p>
            </div>
          </div>
          {prop?.address && (
            <p className="text-sm flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {prop.address.street}, {prop.address.city} {prop.address.state} {prop.address.zip}
            </p>
          )}
          {wo.scheduledDate && (
            <p className="text-sm flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground" /> Scheduled: {wo.scheduledDate}</p>
          )}
          {wo.accessInstructions && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-400 mb-1">🔑 Access Instructions</p>
              <p className="text-sm">{wo.accessInstructions}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Issue Description */}
      {req && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">Issue Description</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{req.description}</p>
            <div className="flex gap-1.5">
              <Badge variant="outline" className="text-[10px]">{req.category}</Badge>
              <Badge variant="outline" className="text-[10px]">{req.priority}</Badge>
            </div>
            {req.photos?.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {req.photos.map((url, i) => (
                  <img key={i} src={url} alt={`Issue ${i + 1}`} className="h-20 w-20 rounded-lg object-cover border border-border/30" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tenant Contact */}
      {tenant && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">Tenant Contact</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{tenant.firstName} {tenant.lastName}</p>
            <p className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {tenant.phone}</p>
            <p className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {tenant.email}</p>
          </CardContent>
        </Card>
      )}

      {/* Status Actions */}
      {wo.status === "assigned" && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5 text-center space-y-3">
            <CheckCircle className="h-8 w-8 text-primary mx-auto" />
            <p className="text-sm font-medium">Ready to accept this job?</p>
            <Button onClick={handleAccept} disabled={saving} className="gradient-brand text-white border-0 w-full">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Accepting...</> : "Accept Job"}
            </Button>
          </CardContent>
        </Card>
      )}

      {wo.status === "accepted" && (
        <Card className="border-violet-500/20 bg-violet-500/5">
          <CardContent className="p-5 text-center space-y-3">
            <Play className="h-8 w-8 text-violet-400 mx-auto" />
            <p className="text-sm font-medium">Ready to start work?</p>
            <Button onClick={handleStart} disabled={saving} className="bg-violet-500 hover:bg-violet-600 text-white border-0 w-full">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Starting...</> : "Start Work"}
            </Button>
          </CardContent>
        </Card>
      )}

      {wo.status === "in_progress" && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader><CardTitle className="text-sm font-heading">Complete Job & Submit Costs</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Labor Hours *</Label>
                <Input type="number" step="0.5" placeholder="4.5" value={costForm.laborHours} onChange={e => setCostForm({ ...costForm, laborHours: e.target.value })} />
                {vendor?.hourlyRate && <p className="text-[10px] text-muted-foreground mt-1">@ ${vendor.hourlyRate}/hr</p>}
              </div>
              <div>
                <Label>Materials Cost ($)</Label>
                <Input type="number" step="0.01" placeholder="85.00" value={costForm.materialsCost} onChange={e => setCostForm({ ...costForm, materialsCost: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Materials Description</Label>
              <Input placeholder="2x copper fittings, sealant..." value={costForm.materialsDesc} onChange={e => setCostForm({ ...costForm, materialsDesc: e.target.value })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea placeholder="Work performed, findings, recommendations..." value={costForm.notes} onChange={e => setCostForm({ ...costForm, notes: e.target.value })} rows={3} />
            </div>
            <PhotoUpload label="Completion Photos" maxPhotos={6} photos={completionPhotos} onChange={setCompletionPhotos} />
            <PhotoUpload label="Receipt / Invoice Photos" maxPhotos={3} photos={receiptPhotos} onChange={setReceiptPhotos} />
            {costForm.laborHours && vendor?.hourlyRate && (
              <div className="bg-accent/30 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Labor</span><span>${(parseFloat(costForm.laborHours) * vendor.hourlyRate).toFixed(2)}</span></div>
                {costForm.materialsCost && <div className="flex justify-between"><span>Materials</span><span>${parseFloat(costForm.materialsCost).toFixed(2)}</span></div>}
                <div className="flex justify-between font-bold border-t border-border/30 pt-1 mt-1">
                  <span>Total</span>
                  <span>${((parseFloat(costForm.laborHours) * vendor.hourlyRate) + (parseFloat(costForm.materialsCost) || 0)).toFixed(2)}</span>
                </div>
              </div>
            )}
            <Button onClick={handleComplete} disabled={saving || !costForm.laborHours} className="gradient-brand text-white border-0 w-full">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</> : "Complete & Submit for Approval"}
            </Button>
          </CardContent>
        </Card>
      )}

      {wo.status === "pending_approval" && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-5 text-center space-y-2">
            <Clock className="h-8 w-8 text-amber-400 mx-auto" />
            <p className="text-sm font-medium">Submitted — Awaiting Manager Approval</p>
            <p className="text-xs text-muted-foreground">Total: ${wo.totalCost?.toLocaleString()}</p>
          </CardContent>
        </Card>
      )}

      {wo.status === "approved" && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-5 text-center space-y-2">
            <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto" />
            <p className="text-sm font-medium">Approved! Total: ${wo.totalCost?.toLocaleString()}</p>
            {wo.managerApproval?.notes && <p className="text-xs text-muted-foreground">&ldquo;{wo.managerApproval.notes}&rdquo;</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
