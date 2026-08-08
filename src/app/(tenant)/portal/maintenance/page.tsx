"use client";

import React, { useState } from "react";
import { Wrench, Plus, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhotoUpload } from "@/components/photo-upload";
import { useMaintenance, useCurrentTenant, useUnits, useProperties } from "@/lib/hooks";
import type { MaintenanceCategory, MaintenancePriority } from "@/lib/types";
import toast from "react-hot-toast";

const statusConfig: Record<string, { color: string; icon: typeof Clock }> = {
  submitted: { color: "text-amber-400 border-amber-500/30 bg-amber-500/10", icon: Clock },
  acknowledged: { color: "text-blue-400 border-blue-500/30 bg-blue-500/10", icon: AlertCircle },
  assigned: { color: "text-violet-400 border-violet-500/30 bg-violet-500/10", icon: Wrench },
  in_progress: { color: "text-blue-400 border-blue-500/30 bg-blue-500/10", icon: Wrench },
  completed: { color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", icon: CheckCircle2 },
  closed: { color: "text-gray-400 border-gray-500/30 bg-gray-500/10", icon: CheckCircle2 },
};

export default function TenantMaintenancePage() {
  const { requests, addRequest } = useMaintenance();
  const { tenant: currentTenant } = useCurrentTenant();
  const { units } = useUnits();
  const { properties } = useProperties();
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<(File | string)[]>([]);
  const [form, setForm] = useState({
    title: "", description: "",
    category: "other" as MaintenanceCategory,
    priority: "routine" as MaintenancePriority,
  });

  const myTenant = currentTenant;
  const myUnit = units.find(u => u.currentTenantId === myTenant?.id) || units[0];
  const myRequests = requests.filter(r => r.tenantId === myTenant?.id);

  const handleSubmit = async () => {
    if (!form.title) return;
    setSaving(true);
    try {
      await addRequest({
        title: form.title,
        description: form.description,
        category: form.category,
        priority: form.priority,
        unitId: myUnit?.id || "",
        propertyId: myUnit?.propertyId || "",
        tenantId: myTenant?.id || "",
        photos: photos.filter((p): p is File => p instanceof File),
      });
      toast.success("Maintenance request submitted!");
      setShowAdd(false);
      setForm({ title: "", description: "", category: "other", priority: "routine" });
      setPhotos([]);
    } catch { toast.error("Failed to submit request"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Maintenance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Submit and track repair requests</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 gap-1.5">
          <Plus className="h-4 w-4" /> New Request
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-amber-500/20 bg-card/50">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-amber-400">{myRequests.filter(r => !["completed","closed"].includes(r.status)).length}</p>
            <p className="text-[10px] text-muted-foreground">Open</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-card/50">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-blue-400">{myRequests.filter(r => r.status === "in_progress").length}</p>
            <p className="text-[10px] text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20 bg-card/50">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-emerald-400">{myRequests.filter(r => r.status === "completed" || r.status === "closed").length}</p>
            <p className="text-[10px] text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
      </div>

      {/* Request List */}
      <div className="space-y-3">
        {myRequests.length > 0 ? myRequests.map(req => {
          const sc = statusConfig[req.status] || statusConfig.submitted;
          const StatusIcon = sc.icon;
          return (
            <Card key={req.id} className="border-border/50 bg-card/50">
              <CardContent className="p-4 flex items-start gap-4">
                <div className={`rounded-lg p-2.5 ${sc.color.split(" ").slice(2).join(" ")}`}>
                  <StatusIcon className={`h-4 w-4 ${sc.color.split(" ")[0]}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{req.title}</h3>
                    <Badge variant="outline" className={`text-[10px] ${sc.color}`}>{req.status.replace("_", " ")}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{req.description}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{req.category} · {req.priority} · {req.createdAt.split("T")[0]}</p>
                  {req.vendorNotes && (
                    <div className="mt-2 bg-accent/30 rounded-md px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">Vendor notes:</p>
                      <p className="text-xs">{req.vendorNotes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        }) : (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-8 text-center">
              <Wrench className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No maintenance requests yet</p>
              <Button onClick={() => setShowAdd(true)} variant="outline" className="mt-3">Submit a Request</Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* New Request Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-heading">Submit Maintenance Request</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Title</Label><Input placeholder="e.g. Leaking kitchen faucet" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea placeholder="Describe the issue in detail..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v: any) => v != null && setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plumbing">Plumbing</SelectItem>
                    <SelectItem value="electrical">Electrical</SelectItem>
                    <SelectItem value="hvac">HVAC</SelectItem>
                    <SelectItem value="appliance">Appliance</SelectItem>
                    <SelectItem value="structural">Structural</SelectItem>
                    <SelectItem value="pest">Pest Control</SelectItem>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v: any) => v != null && setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emergency">🔴 Emergency</SelectItem>
                    <SelectItem value="urgent">🟡 Urgent</SelectItem>
                    <SelectItem value="routine">🟢 Routine</SelectItem>
                    <SelectItem value="scheduled">📅 Scheduled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <PhotoUpload
              label="Photos (optional)"
              maxPhotos={5}
              photos={photos}
              onChange={setPhotos}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.title || saving} className="gradient-brand text-white border-0">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</> : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
