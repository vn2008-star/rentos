"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Wrench, CheckCircle2, Loader2, Building2, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePublicOrg } from "@/lib/use-public-org";
import { PublicOrgHeader, PublicOrgState } from "@/components/public-org-header";
import type { MaintenanceCategory, MaintenancePriority } from "@/lib/types";
import { errorMessage } from "@/lib/errors";

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

const EMPTY_FORM = {
  name: "", phone: "", email: "",
  propertyId: "", unitId: "",
  title: "", description: "",
  category: "other" as MaintenanceCategory,
  priority: "routine" as MaintenancePriority,
};

export default function PublicReportPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const { data, loading, error } = usePublicOrg(slug);

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [reference, setReference] = useState("");

  if (!data) return <PublicOrgState loading={loading} error={error} />;

  const units = data.units.filter((u) => u.propertyId === form.propertyId);

  const handleSubmit = async () => {
    setSaving(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/public/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org: slug, ...form }),
      });
      const body = await res.json();
      // A failed submission must say so. The previous version showed the success
      // screen either way, so a report that never saved looked like one that did.
      if (!res.ok) throw new Error(body.error || "Could not submit the request.");
      setReference(body.reference);
    } catch (err) {
      setSubmitError(errorMessage(err, "Could not submit the request."));
    } finally {
      setSaving(false);
    }
  };

  if (reference) {
    return (
      <div className="min-h-screen bg-background">
        <PublicOrgHeader orgName={data.org.name} slug={slug} tagline="Report a repair" />
        <main className="mx-auto max-w-md px-4 py-12">
          <Card className="border-emerald-500/20 bg-card/80">
            <CardContent className="space-y-4 p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold font-heading">Request submitted</h2>
              <p className="text-sm text-muted-foreground">
                {data.org.name} has received your report and will be in touch.
              </p>
              <div className="rounded-lg bg-accent/30 p-3">
                <p className="text-xs text-muted-foreground">Reference number</p>
                <p className="mt-1 font-mono text-sm font-semibold">{reference}</p>
              </div>
              <Button
                variant="outline"
                onClick={() => { setReference(""); setForm(EMPTY_FORM); }}
              >
                Submit another request
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicOrgHeader orgName={data.org.name} slug={slug} tagline="Report a repair" />

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold font-heading">Report a repair issue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            No account needed. This goes straight to the maintenance team at{" "}
            {data.org.name}.
          </p>
        </div>

        {submitError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {submitError}
          </div>
        )}

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-heading">
              <User className="h-4 w-4 text-primary" /> Your information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Your Name *</Label>
              <Input
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input
                  placeholder="(530) 555-0000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="you@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-heading">
              <Building2 className="h-4 w-4 text-primary" /> Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Property *</Label>
              <Select
                value={form.propertyId}
                onValueChange={(v) => v != null && setForm({ ...form, propertyId: v, unitId: "" })}
              >
                <SelectTrigger><SelectValue placeholder="Select a property" /></SelectTrigger>
                <SelectContent>
                  {data.properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {p.address.street}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.propertyId && (
              <div>
                <Label>Unit</Label>
                <Select
                  value={form.unitId}
                  onValueChange={(v) => v != null && setForm({ ...form, unitId: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select unit or common area" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General / Common area</SelectItem>
                    {units.map((u) => (
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
            <CardTitle className="flex items-center gap-2 text-sm font-heading">
              <Wrench className="h-4 w-4 text-primary" /> Issue details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                placeholder="e.g. Leaking pipe in bathroom"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={4}
                placeholder="Describe the issue — what you see, hear or smell, and when it started."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={v => v != null && setForm({ ...form, category: v as MaintenanceCategory })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Urgency</Label>
                <Select
                  value={form.priority}
                  onValueChange={v => v != null && setForm({ ...form, priority: v as MaintenancePriority })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Have photos? Mention it here — the team will ask for them when they
              get in touch. Residents with a portal account can attach photos{" "}
              <Link href="/portal/maintenance" className="text-primary hover:underline">
                from the portal
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        <Button
          onClick={handleSubmit}
          disabled={!form.name || !form.title || !form.propertyId || saving}
          className="h-12 w-full gap-2 gradient-brand text-base text-white border-0 shadow-lg shadow-primary/25"
        >
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</> : "Submit repair request"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          By submitting this form you agree to be contacted about this repair.
        </p>
      </main>
    </div>
  );
}
