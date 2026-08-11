"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2, Bell, CreditCard, Globe, Loader2, Copy, ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrganization, subscriptionActive } from "@/lib/use-org";
import { useUnits } from "@/lib/hooks";
import { useAuthStore } from "@/lib/store";
import { isOwnerOrManagerRole } from "@/lib/roles";
import { formatPlanPrice } from "@/lib/plans";
import toast from "react-hot-toast";

const TIMEZONES = [
  "America/Los_Angeles", "America/Denver", "America/Phoenix",
  "America/Chicago", "America/New_York", "America/Anchorage", "Pacific/Honolulu",
];

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const { org, plan, loading, saveSettings } = useOrganization();
  const { units } = useUnits();

  const canManage = isOwnerOrManagerRole(user?.role);

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [currency, setCurrency] = useState("USD");
  const [lateFeeAmount, setLateFeeAmount] = useState("50");
  const [lateFeeDays, setLateFeeDays] = useState("5");
  const [lateFeeEnabled, setLateFeeEnabled] = useState(true);
  const [publicIntake, setPublicIntake] = useState(true);
  const [saving, setSaving] = useState(false);

  // Seed the form once the organization arrives, and whenever it changes
  // underneath us (another manager editing, or the billing webhook writing).
  useEffect(() => {
    if (!org) return;
    setName(org.name);
    setTimezone(org.settings?.timezone ?? "America/Los_Angeles");
    setCurrency(org.settings?.currency ?? "USD");
    setLateFeeAmount(String(org.settings?.lateFeeAmount ?? 50));
    setLateFeeDays(String(org.settings?.lateFeeDays ?? 5));
    setLateFeeEnabled(org.settings?.lateFeeEnabled !== false);
    setPublicIntake(org.settings?.publicIntake !== false);
  }, [org]);

  const handleSave = async () => {
    if (!org) return;
    setSaving(true);
    try {
      await saveSettings({
        name: name.trim() || org.name,
        settings: {
          ...org.settings,
          timezone,
          currency,
          lateFeeEnabled,
          lateFeeAmount: Number(lateFeeAmount) || 0,
          lateFeeDays: Number(lateFeeDays) || 0,
          publicIntake,
        },
      });
      toast.success("Settings saved.");
    } catch (err: any) {
      toast.error(err?.message || "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  const publicUrl =
    typeof window !== "undefined" && org ? `${window.location.origin}/o/${org.slug}` : "";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage your organization and account
        </p>
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" /> Organization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Organization name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canManage}
              />
            </div>
            <div>
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={(v) => v != null && setTimezone(v)} disabled={!canManage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Currency</Label>
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
                disabled={!canManage}
              />
            </div>
            <div>
              <Label>Late fee</Label>
              <Input
                inputMode="numeric"
                value={lateFeeAmount}
                onChange={(e) => setLateFeeAmount(e.target.value)}
                disabled={!canManage || !lateFeeEnabled}
              />
            </div>
            <div>
              <Label>Grace period (days)</Label>
              <Input
                inputMode="numeric"
                value={lateFeeDays}
                onChange={(e) => setLateFeeDays(e.target.value)}
                disabled={!canManage || !lateFeeEnabled}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={lateFeeEnabled}
              onChange={(e) => setLateFeeEnabled(e.target.checked)}
              disabled={!canManage}
              className="h-4 w-4 accent-primary"
            />
            Charge a late fee after the grace period
          </label>

          {canManage && (
            <Button className="gap-2 gradient-brand text-white border-0" disabled={saving} onClick={handleSave}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" /> Public pages
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Anyone with this address can report a repair or apply for a vacancy
            without an account. Put it on notices, signs and your website.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={publicUrl} className="font-mono text-xs" />
            <Button
              variant="outline"
              size="icon"
              onClick={async () => {
                await navigator.clipboard.writeText(publicUrl);
                toast.success("Link copied.");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" render={<Link href={`/o/${org?.slug}`} target="_blank" />}>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={publicIntake}
              onChange={(e) => setPublicIntake(e.target.checked)}
              disabled={!canManage}
              className="h-4 w-4 accent-primary"
            />
            Accept public repair reports and applications
          </label>
          <p className="text-xs text-muted-foreground">
            Switching this off returns a polite refusal on those pages. Existing
            requests are unaffected.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" /> Billing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-accent/40 p-3">
            <span className="text-sm font-medium">Current plan</span>
            <span className="text-sm font-bold text-primary">
              {plan.name} — {formatPlanPrice(plan)}
              {plan.price !== null && "/mo"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-accent/40 p-3">
            <span className="text-sm font-medium">Units managed</span>
            <span className="text-sm">
              {units.length} / {plan.unitLimit === null ? "unlimited" : plan.unitLimit}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-accent/40 p-3">
            <span className="text-sm font-medium">Rent payouts</span>
            {org?.payouts?.chargesEnabled ? (
              <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-400">Active</Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/30 text-amber-400">Not set up</Badge>
            )}
          </div>
          {!subscriptionActive(org) && (
            <p className="text-xs text-destructive">
              Your subscription is not active — adding new properties, units and
              leases is paused.
            </p>
          )}
          <Button variant="outline" render={<Link href="/billing" />}>
            Manage plan & payouts
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" /> Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            In-app notifications are on for payments, urgent repairs and new
            applications. Email and SMS delivery are not wired up yet.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
