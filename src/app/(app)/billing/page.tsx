"use client";

import React, { useEffect, useState } from "react";
import {
  CreditCard, Check, Loader2, ExternalLink, AlertTriangle, Landmark, ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrganization, trialDaysLeft, subscriptionActive } from "@/lib/use-org";
import { useUnits } from "@/lib/hooks";
import { useAuthStore } from "@/lib/store";
import { authedJson } from "@/lib/api-client";
import { PLANS, PLAN_ORDER, formatPlanPrice, planFor } from "@/lib/plans";
import { isOwnerOrManagerRole } from "@/lib/roles";
import type { OrgPayouts, PlanId } from "@/lib/types";
import toast from "react-hot-toast";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  trialing: { label: "Free trial", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  active: { label: "Active", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  past_due: { label: "Payment failed", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  canceled: { label: "Cancelled", className: "bg-red-500/15 text-red-400 border-red-500/30" },
  incomplete: { label: "Incomplete", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

export default function BillingPage() {
  const user = useAuthStore((s) => s.user);
  const { org, loading } = useOrganization();
  const { units } = useUnits();

  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);
  const [payouts, setPayouts] = useState<OrgPayouts | null>(null);

  const canManage = isOwnerOrManagerRole(user?.role);
  const plan = planFor(org?.plan);
  const status = org?.billing?.status ?? "trialing";
  const daysLeft = trialDaysLeft(org);
  const active = subscriptionActive(org);

  // Coming back from Stripe Connect, our copy of the flags is stale until we ask.
  useEffect(() => {
    if (!org) return;
    const fromStripe = new URLSearchParams(window.location.search).has("connect");
    if (!fromStripe && !org.payouts?.stripeAccountId) return;

    authedJson<{ payouts: OrgPayouts }>("/api/connect/status")
      .then((r) => setPayouts(r.payouts))
      .catch(() => {/* the stored copy is shown instead */});
  }, [org]);

  const effectivePayouts = payouts ?? org?.payouts ?? null;

  const startCheckout = async (planId: PlanId) => {
    setBusyPlan(planId);
    try {
      const { url } = await authedJson<{ url: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: planId }),
      });
      window.location.href = url;
    } catch (err: any) {
      toast.error(err?.message || "Could not start checkout.");
      setBusyPlan(null);
    }
  };

  const openPortal = async () => {
    setPortalBusy(true);
    try {
      const { url } = await authedJson<{ url: string }>("/api/billing/portal", {
        method: "POST",
        body: JSON.stringify({}),
      });
      window.location.href = url;
    } catch (err: any) {
      toast.error(err?.message || "Could not open the billing portal.");
      setPortalBusy(false);
    }
  };

  const startConnect = async () => {
    setConnectBusy(true);
    try {
      const { url } = await authedJson<{ url: string }>("/api/connect/onboard", {
        method: "POST",
        body: JSON.stringify({}),
      });
      window.location.href = url;
    } catch (err: any) {
      toast.error(err?.message || "Could not start payout setup.");
      setConnectBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading billing…
      </div>
    );
  }

  const unitCount = units.length;
  const limit = plan.unitLimit;
  const overLimit = limit !== null && unitCount > limit;
  const usagePct = limit === null ? 0 : Math.min(100, Math.round((unitCount / limit) * 100));
  const statusStyle = STATUS_LABEL[status] ?? STATUS_LABEL.trialing;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">Billing</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Your RentOS subscription and where your rent gets paid out
        </p>
      </div>

      {!active && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="text-sm">
            <p className="font-medium text-destructive">
              {status === "canceled" ? "Your subscription has ended" : "Your trial has run out"}
            </p>
            <p className="text-muted-foreground">
              Existing records stay safe and readable. Adding new properties,
              units and leases is paused until a plan is active.
            </p>
          </div>
        </div>
      )}

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" /> Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-accent/40 p-3">
            <div>
              <p className="text-sm font-medium">
                {plan.name} — {formatPlanPrice(plan)}
                {plan.price !== null && (
                  <span className="text-muted-foreground">/mo</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {status === "trialing" && daysLeft !== null
                  ? daysLeft > 0
                    ? `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left in your free trial`
                    : "Your free trial has ended"
                  : org?.billing?.currentPeriodEnd
                    ? `${org.billing.cancelAtPeriodEnd ? "Ends" : "Renews"} ${new Date(org.billing.currentPeriodEnd).toLocaleDateString()}`
                    : "No renewal date on file"}
              </p>
            </div>
            <Badge variant="outline" className={statusStyle.className}>
              {statusStyle.label}
            </Badge>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Units managed</span>
              <span className={overLimit ? "font-medium text-destructive" : "font-medium"}>
                {unitCount} / {limit === null ? "unlimited" : limit}
              </span>
            </div>
            {limit !== null && (
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${overLimit ? "bg-destructive" : "gradient-brand"}`}
                  style={{ width: `${overLimit ? 100 : usagePct}%` }}
                />
              </div>
            )}
            {overLimit && (
              <p className="text-xs text-destructive">
                You are over the {plan.name} limit. Existing units keep working;
                move up a plan to add more.
              </p>
            )}
          </div>

          {canManage && org?.billing?.stripeCustomerId && (
            <Button variant="outline" className="gap-2" disabled={portalBusy} onClick={openPortal}>
              {portalBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Manage subscription
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4" /> Rent payouts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Rent your tenants pay online goes straight to your own bank account
            through Stripe. RentOS never holds it.
          </p>

          {effectivePayouts?.chargesEnabled ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              Payouts are active — online rent payments are switched on.
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {effectivePayouts?.stripeAccountId
                    ? "Stripe still needs some details before you can take payments."
                    : "Tenants cannot pay rent online until this is set up."}
                </span>
              </div>
              {(effectivePayouts?.requirementsDue?.length ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Outstanding: {effectivePayouts!.requirementsDue!.slice(0, 4).join(", ")}
                </p>
              )}
              {canManage && (
                <Button className="gap-2 gradient-brand text-white border-0" disabled={connectBusy} onClick={startConnect}>
                  {connectBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
                  {effectivePayouts?.stripeAccountId ? "Continue payout setup" : "Set up payouts"}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold font-heading">Plans</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((id) => {
            const p = PLANS[id];
            const current = org?.plan === id;
            return (
              <Card
                key={id}
                className={`flex flex-col border-border/50 bg-card/50 ${current ? "border-primary/50 ring-1 ring-primary/20" : ""}`}
              >
                <CardContent className="flex flex-1 flex-col gap-3 p-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold font-heading">{p.name}</h3>
                      {current && <Badge variant="secondary" className="text-[10px]">Current</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{p.blurb}</p>
                  </div>
                  <p className="text-2xl font-bold font-heading">
                    {formatPlanPrice(p)}
                    {p.price !== null && (
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    )}
                  </p>
                  <ul className="flex-1 space-y-1.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {canManage && !current && (
                    <Button
                      variant={p.popular ? "default" : "outline"}
                      className={`w-full gap-2 ${p.popular ? "gradient-brand text-white border-0" : ""}`}
                      disabled={busyPlan !== null}
                      onClick={() => startCheckout(id)}
                    >
                      {busyPlan === id && <Loader2 className="h-4 w-4 animate-spin" />}
                      {p.contactSales ? "Contact sales" : "Choose"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
