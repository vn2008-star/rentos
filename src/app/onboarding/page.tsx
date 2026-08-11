"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Globe, Loader2, ArrowRight, Check } from "lucide-react";
import { RentosMark } from "@/components/rentos-mark";
import { AuthGuard } from "@/components/auth-guard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from "@/lib/store";
import { createOrganization, useOrganization } from "@/lib/use-org";
import { PLANS, DEFAULT_PLAN, TRIAL_DAYS } from "@/lib/plans";
import toast from "react-hot-toast";

const TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Phoenix",
  "America/Chicago",
  "America/New_York",
  "America/Anchorage",
  "Pacific/Honolulu",
];

/** Mirrors slugify() in the create route, so the preview matches what is saved. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

function OnboardingForm() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { exists, loading: orgLoading } = useOrganization();

  const [name, setName] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Guess the timezone from the browser, but only as a starting point.
  useEffect(() => {
    try {
      const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (guess && TIMEZONES.includes(guess)) setTimezone(guess);
    } catch {
      /* keep the default */
    }
  }, []);

  // Somebody who already has an organization has no business here.
  useEffect(() => {
    if (!orgLoading && exists) router.replace("/dashboard");
  }, [orgLoading, exists, router]);

  const effectiveSlug = useMemo(
    () => (slugTouched ? slugify(slug) : slugify(name)),
    [slugTouched, slug, name]
  );

  const slugValid = effectiveSlug.length >= 3 && effectiveSlug.length <= 40;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2 || !slugValid) return;

    setSaving(true);
    setError("");
    try {
      const org = await createOrganization({
        name: name.trim(),
        slug: effectiveSlug,
        timezone,
      });

      // The server just moved this account into the new org as its owner.
      // Reflecting it locally avoids a round trip through sign-out and back in
      // before any org-scoped query returns anything.
      if (user) setUser({ ...user, orgId: org.id, role: "owner" });

      toast.success(`${org.name} is ready.`);
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Could not create the organization.");
    } finally {
      setSaving(false);
    }
  };

  const plan = PLANS[DEFAULT_PLAN];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-[520px] space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-brand shadow-lg shadow-primary/25">
            <RentosMark className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-heading tracking-tight">
              Set up your organization
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              This is the workspace your properties, tenants and team live in.
            </p>
          </div>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-2xl shadow-primary/5">
          <CardContent className="p-6 space-y-5">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Organization Name</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Davis Housing Services"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Public Web Address</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="davis-housing-services"
                    value={slugTouched ? slug : effectiveSlug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value);
                    }}
                    disabled={saving}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Tenants report repairs and apply at{" "}
                  <span className="font-mono text-foreground/80">
                    /o/{effectiveSlug || "your-address"}
                  </span>
                </p>
                {!slugValid && effectiveSlug.length > 0 && (
                  <p className="text-xs text-destructive">
                    Use 3–40 lowercase letters, numbers or dashes.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={timezone} onValueChange={(v) => v != null && setTimezone(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Rent due dates, late fees and reminders are calculated in this timezone.
                </p>
              </div>

              <div className="rounded-lg border border-border/50 bg-accent/30 p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Check className="h-4 w-4 text-emerald-400" />
                  {TRIAL_DAYS}-day free trial — no card required
                </div>
                <p className="text-xs text-muted-foreground">
                  You start on {plan.name} ({plan.blurb}). Change or cancel any time
                  from Billing.
                </p>
              </div>

              <Button
                type="submit"
                className="h-10 w-full gap-2 gradient-brand text-white border-0 shadow-lg shadow-primary/25"
                disabled={saving || name.trim().length < 2 || !slugValid}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Creating...
                  </>
                ) : (
                  <>
                    Create Organization <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Signed in as {user?.email}
        </p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <AuthGuard>
      <OnboardingForm />
    </AuthGuard>
  );
}
