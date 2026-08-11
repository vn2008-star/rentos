"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Loader2, FileText, User, Home } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePublicOrg } from "@/lib/use-public-org";
import { PublicOrgHeader, PublicOrgState } from "@/components/public-org-header";

const EMPTY_FORM = {
  unitId: "",
  firstName: "", lastName: "", email: "", phone: "",
  currentAddress: "", employer: "", income: "", moveInDate: "", message: "",
};

export default function PublicApplyPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const { data, loading, error } = usePublicOrg(slug);

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Arriving from a specific vacancy preselects it.
  useEffect(() => {
    const unit = new URLSearchParams(window.location.search).get("unit");
    if (unit) setForm((f) => ({ ...f, unitId: unit }));
  }, []);

  if (!data) return <PublicOrgState loading={loading} error={error} />;

  const propertyById = new Map(data.properties.map((p) => [p.id, p]));
  const available = data.units.filter(
    (u) => u.status === "available" || u.id === form.unitId
  );

  const handleSubmit = async () => {
    setSaving(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/public/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org: slug, ...form }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not submit the application.");
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err?.message || "Could not submit the application.");
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <PublicOrgHeader orgName={data.org.name} slug={slug} tagline="Rental application" />
        <main className="mx-auto max-w-md px-4 py-12">
          <Card className="border-emerald-500/20 bg-card/80">
            <CardContent className="space-y-4 p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold font-heading">Application received</h2>
              <p className="text-sm text-muted-foreground">
                {data.org.name} has your application and will contact you at{" "}
                {form.email}.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const canSubmit =
    form.unitId && form.firstName && form.lastName && form.email.includes("@") && !saving;

  return (
    <div className="min-h-screen bg-background">
      <PublicOrgHeader orgName={data.org.name} slug={slug} tagline="Rental application" />

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold font-heading">Apply for a home</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {available.length > 0
              ? `${data.org.name} has ${available.length} ${available.length === 1 ? "home" : "homes"} available.`
              : `${data.org.name} has no homes listed as available right now.`}
          </p>
        </div>

        {submitError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {submitError}
          </div>
        )}

        {available.length === 0 ? (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-6 text-sm text-muted-foreground">
              There is nothing to apply for at the moment. Check back, or report
              your interest by contacting the office directly.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-heading">
                  <Home className="h-4 w-4 text-primary" /> Which home?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={form.unitId}
                  onValueChange={(v) => v != null && setForm({ ...form, unitId: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select a home" /></SelectTrigger>
                  <SelectContent>
                    {available.map((u) => {
                      const p = propertyById.get(u.propertyId);
                      return (
                        <SelectItem key={u.id} value={u.id}>
                          {p?.name ?? "Home"} — Unit {u.unitNumber} · {u.beds} bed ·
                          ${u.rent.toLocaleString()}/mo
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-heading">
                  <User className="h-4 w-4 text-primary" /> About you
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>First name *</Label>
                    <Input
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Last name *</Label>
                    <Input
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Current address</Label>
                  <Input
                    value={form.currentAddress}
                    onChange={(e) => setForm({ ...form, currentAddress: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-heading">
                  <FileText className="h-4 w-4 text-primary" /> Employment & timing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Employer</Label>
                    <Input
                      value={form.employer}
                      onChange={(e) => setForm({ ...form, employer: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Annual income</Label>
                    <Input
                      inputMode="numeric"
                      placeholder="65000"
                      value={form.income}
                      onChange={(e) => setForm({ ...form, income: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Desired move-in date</Label>
                  <Input
                    type="date"
                    value={form.moveInDate}
                    onChange={(e) => setForm({ ...form, moveInDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Anything else?</Label>
                  <Textarea
                    rows={3}
                    placeholder="Pets, roommates, questions…"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="h-12 w-full gap-2 gradient-brand text-base text-white border-0 shadow-lg shadow-primary/25"
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</> : "Submit application"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Submitting shares these details with {data.org.name} so they can
              assess your application and contact you.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
