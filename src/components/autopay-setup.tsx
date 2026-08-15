"use client";

import React, { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { CreditCard, Loader2, ShieldCheck, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { authedFetch } from "@/lib/api-client";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import type { Tenant } from "@/lib/types";
import toast from "react-hot-toast";
import { errorMessage } from "@/lib/errors";

/**
 * Autopay: saving a card so rent is collected without anyone having to
 * remember.
 *
 * The toggle this replaces flipped a local boolean and showed "Auto-pay
 * enabled" — nothing was stored, no card was taken, and rent was never going to
 * be collected. Enabling it now requires actually saving a payment method with
 * Stripe; the flag on the tenant record is written by the webhook once Stripe
 * confirms, so what the screen says matches what will happen on the 1st.
 */

function SetupForm({ onDone }: { onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSaving(true);
    setError("");

    const { error: err, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });

    if (err) {
      setError(errorMessage(err, "The card could not be saved."));
      setSaving(false);
      return;
    }

    if (setupIntent?.status === "succeeded") {
      toast.success("Autopay is on. Rent will be collected automatically.");
      onDone();
      return;
    }

    setError("The card needs another step to be saved. Please try again.");
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={!stripe || saving}
          className="gap-2 gradient-brand text-white border-0"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save card & enable autopay
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground/60">
        Your card is stored by Stripe, not by RentOS. You can turn autopay off at
        any time.
      </p>
    </form>
  );
}

export function AutopaySetup({ tenant }: { tenant: Tenant | null | undefined }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoOn, setDemoOn] = useState(false);
  const demo = !isStripeConfigured();

  const enabled = demo ? demoOn : Boolean(tenant?.autopayEnabled);
  const card = tenant?.defaultPaymentMethod;

  const start = async () => {
    if (demo) {
      setDemoOn(true);
      toast.success("Autopay enabled (demo — no card was taken).");
      return;
    }
    setBusy(true);
    try {
      const res = await authedFetch("/api/payments/setup-autopay", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start autopay setup.");
      if (data.demo) {
        setDemoOn(true);
        toast.success("Autopay enabled (demo).");
      } else {
        setClientSecret(data.clientSecret);
      }
    } catch (err) {
      toast.error(errorMessage(err, "Could not start autopay setup."));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (demo) {
      setDemoOn(false);
      toast.success("Autopay disabled (demo).");
      return;
    }
    setBusy(true);
    try {
      const res = await authedFetch("/api/payments/setup-autopay", {
        method: "DELETE",
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not turn autopay off.");
      toast.success("Autopay turned off.");
    } catch (err) {
      toast.error(errorMessage(err, "Could not turn autopay off."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/15 p-2.5">
              <CreditCard className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                Auto-pay
                {enabled && (
                  <Badge className="border-emerald-500/30 bg-emerald-500/15 text-[10px] text-emerald-400">
                    On
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {enabled && card
                  ? `${card.brand.toUpperCase()} ···· ${card.last4} — rent is collected on the 1st`
                  : enabled
                    ? "Rent is collected automatically on the 1st"
                    : "Pay rent automatically on the 1st of each month"}
              </p>
            </div>
          </div>

          {enabled ? (
            <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={stop}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Turn off
            </Button>
          ) : clientSecret ? null : (
            <Button
              size="sm"
              className="gap-1.5 gradient-brand text-white border-0"
              disabled={busy}
              onClick={start}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              Set up
            </Button>
          )}
        </div>

        {clientSecret && !enabled && (
          <div className="border-t border-border/40 pt-4">
            <Elements stripe={getStripe()} options={{ clientSecret }}>
              <SetupForm onDone={() => setClientSecret(null)} />
            </Elements>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
