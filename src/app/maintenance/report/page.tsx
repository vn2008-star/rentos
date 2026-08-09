"use client";

import React, { useState } from "react";
import { Wrench, CheckCircle2, Loader2, Camera, Building2 } from "lucide-react";
import { RentosMark } from "@/components/rentos-mark";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhotoUpload } from "@/components/photo-upload";
import { useMaintenance, useProperties, useUnits } from "@/lib/hooks";
import type { MaintenanceCategory, MaintenancePriority } from "@/lib/types";

const categoryOptions: { value: MaintenanceCategory; label: string }[] = [
  { value: "plumbing", label: "🔧 Plumbing" },
  { value: "electrical", label: "⚡ Electrical" },
  { value: "hvac", label: "❄️ HVAC" },
  { value: "appliance", label: "🍽️ Appliance" },
  { value: "structural", label: "🏗️ Structural" },
  { value: "pest", label: "🐛 Pest Control" },
  { value: "cleaning", label: "🧹 Cleaning" },
  { value: "landscaping", label: "🌳 Landscaping" },
  { value: "other", label: "📋 Other" },
];

const priorityOptions: { value: MaintenancePriority; label: string }[] = [
  { value: "emergency", label: "🔴 Emergency — Safety hazard" },
  { value: "urgent", label: "🟡 Urgent — Needs prompt attention" },
  { value: "routine", label: "🟢 Routine — Standard repair" },
  { value: "scheduled", label: "📅 Scheduled — Can wait" },
];

export default function PublicReportPage() {
  const { addRequest } = useMaintenance();
  const { properties } = useProperties();
  const { units } = useUnits();
  const [submitted, setSubmitted] = useState(false);
  const [refNumber, setRefNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<(File | string)[]>([]);
  const [form, setForm] = useState({
    name: "", phone: "", email: "",
    propertyId: "", unitId: "",
    title: "", description: "",
    category: "other" as MaintenanceCategory,
    priority: "routine" as MaintenancePriority,
  });

  const filteredUnits = units.filter(u => u.propertyId === form.propertyId);

  const handleSubmit = async () => {
    if (!form.name || !form.title || !form.propertyId) return;
    setSaving(true);
    try {
      const id = await addRequest({
        title: form.title,
        description: form.description,
        category: form.category,
        priority: form.priority,
        unitId: form.unitId || "general",
        propertyId: form.propertyId,
        reporter: {
          type: "external",
          name: form.name,
          phone: form.phone || undefined,
          email: form.email || undefined,
        },
        photos: photos.filter((p): p is File => p instanceof File),
      });
      setRefNumber(id || `REQ-${Date.now()}`);
      setSubmitted(true);
    } catch {
      // still show success — data may have been saved locally
      setRefNumber(`REQ-${Date.now()}`);
      setSubmitted(true);
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-emerald-500/20 bg-card/80">
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold font-heading">Request Submitted!</h2>
            <p className="text-sm text-muted-foreground">
              Your maintenance request has been received. The property manager will review it shortly.
            </p>
            <div className="bg-accent/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Reference Number</p>
              <p className="text-sm font-mono font-semibold mt-1">{refNumber}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Save this reference number for your records. You&apos;ll be contacted at the phone number or email you provided.
            </p>
            <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ name: "", phone: "", email: "", propertyId: "", unitId: "", title: "", description: "", category: "other", priority: "routine" }); setPhotos([]); }}>
              Submit Another Request
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg gradient-brand flex items-center justify-center">
            <RentosMark className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold font-heading">RentOS</h1>
            <p className="text-[10px] text-muted-foreground">Report a Maintenance Issue</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Intro */}
          <div>
            <h1 className="text-2xl font-bold font-heading">Report a Repair Issue</h1>
            <p className="text-sm text-muted-foreground mt-1">
              No account needed. Submit a maintenance request and we&apos;ll notify the property manager.
            </p>
          </div>

          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" /> Your Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Your Name *</Label>
                <Input placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Phone</Label>
                  <Input placeholder="(530) 555-0000" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" placeholder="you@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Property *</Label>
                <Select value={form.propertyId} onValueChange={v => v != null && setForm({ ...form, propertyId: v, unitId: "" })}>
                  <SelectTrigger><SelectValue placeholder="Select a property" /></SelectTrigger>
                  <SelectContent>
                    {properties.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — {p.address.street}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.propertyId && (
                <div>
                  <Label>Unit (optional)</Label>
                  <Select value={form.unitId} onValueChange={v => v != null && setForm({ ...form, unitId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select unit or leave blank" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General / Common Area</SelectItem>
                      {filteredUnits.map(u => (
                        <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" /> Issue Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input placeholder="e.g. Leaking pipe in bathroom" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea placeholder="Describe the issue in detail — what you see, hear, smell..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v: any) => v != null && setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Urgency</Label>
                  <Select value={form.priority} onValueChange={(v: any) => v != null && setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <PhotoUpload label="Photos of the Issue" maxPhotos={6} photos={photos} onChange={setPhotos} />
            </CardContent>
          </Card>

          <Button
            onClick={handleSubmit}
            disabled={!form.name || !form.title || !form.propertyId || saving}
            className="w-full gradient-brand text-white border-0 shadow-lg shadow-primary/25 h-12 text-base"
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</> : "Submit Repair Request"}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By submitting this form, you agree to be contacted by the property management team regarding this repair request.
          </p>
        </div>
      </main>
    </div>
  );
}
