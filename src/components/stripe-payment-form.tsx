"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { CreditCard, Lock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { authedFetch } from "@/lib/api-client";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

/**
 * Taking a rent payment.
 *
 * The previous version collected the card number into its own inputs and, once
 * a PaymentIntent existed, waited 1.5 seconds and declared success — no charge
 * was ever confirmed, and a tenant would be told their rent was paid when it
 * was not. Card details now go straight to Stripe through their Elements
 * iframe, which is also the only arrangement that keeps this app out of PCI
 * scope, and the intent is confirmed for real.
 *
 * Demo mode (no publishable key) keeps a stand-in form so the flow is
 * explorable, clearly labelled as demo.
 */

interface StripePaymentFormProps {
  amount: number; // in dollars
  description: string;
  leaseId: string;
  /** Staff taking a payment on someone's behalf; tenants are resolved server-side. */
  tenantId?: string;
  onSuccess: (paymentId: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

/** Creates the PaymentIntent. The server derives org, tenant and destination. */
async function createIntent(input: {
  amount: number;
  description: string;
  leaseId: string;
  tenantId?: string;
}): Promise<{ clientSecret: string; paymentIntentId: string; demo?: boolean }> {
  const res = await authedFetch("/api/payments/create-intent", {
    method: "POST",
    body: JSON.stringify({
      amount: Math.round(input.amount * 100), // to cents
      leaseId: input.leaseId,
      tenantId: input.tenantId,
      type: "rent",
      description: input.description,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Payment could not be started");
  return data;
}

function SuccessCard({
  amount,
  description,
  className,
}: {
  amount: number;
  description: string;
  className?: string;
}) {
  return (
    <Card className={cn("border-emerald-500/30 bg-emerald-500/5", className)}>
      <CardContent className="space-y-3 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold font-heading">Payment successful</h3>
        <p className="text-sm text-muted-foreground">
          ${amount.toLocaleString()} for {description}
        </p>
        <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
          Confirmed
        </Badge>
      </CardContent>
    </Card>
  );
}

/** The real card form — rendered inside <Elements>, which supplies the context. */
function CheckoutForm({
  amount,
  description,
  onSuccess,
  onError,
}: {
  amount: number;
  description: string;
  onSuccess: (paymentId: string) => void;
  onError?: (error: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setErrorMsg("");

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      // Cards that need 3-D Secure still redirect; everything else stays put.
      redirect: "if_required",
    });

    if (error) {
      const message = error.message || "The payment could not be completed.";
      setErrorMsg(message);
      onError?.(message);
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      onSuccess(paymentIntent.id);
      return;
    }

    // processing / requires_action after a redirect — the webhook is the system
    // of record, so say what is actually true rather than claiming success.
    const message =
      paymentIntent?.status === "processing"
        ? "Your payment is processing. It will appear in your history shortly."
        : "This payment needs another step to complete. Please try again.";
    setErrorMsg(message);
    onError?.(message);
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold font-heading">
          <CreditCard className="h-4 w-4 text-primary" /> Payment
        </h3>
      </div>

      <div className="rounded-lg border border-border/50 bg-background/50 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{description}</span>
          <span className="text-lg font-bold font-heading">
            ${amount.toLocaleString()}
          </span>
        </div>
      </div>

      <PaymentElement />

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {errorMsg}
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full gradient-brand text-white border-0 shadow-lg shadow-primary/25"
      >
        {submitting ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
        ) : (
          <><Lock className="mr-2 h-4 w-4" /> Pay ${amount.toLocaleString()}</>
        )}
      </Button>

      <p className="flex items-center justify-center gap-1 text-center text-[10px] text-muted-foreground/50">
        <Lock className="h-3 w-3" /> Card details go directly to Stripe
      </p>
    </form>
  );
}

/** Stand-in for demo mode, where there is no Stripe to talk to. */
function DemoForm({
  amount,
  description,
  onSuccess,
}: {
  amount: number;
  description: string;
  onSuccess: (paymentId: string) => void;
}) {
  const [cardNumber, setCardNumber] = useState("");
  const [processing, setProcessing] = useState(false);

  const formatCardNumber = (val: string) =>
    val.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setProcessing(true);
        await new Promise((r) => setTimeout(r, 1200));
        onSuccess(`pi_demo_${Date.now()}`);
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold font-heading">
          <CreditCard className="h-4 w-4 text-primary" /> Payment
        </h3>
        <Badge variant="outline" className="border-amber-500/30 text-[10px] text-amber-400">
          Demo mode
        </Badge>
      </div>

      <div className="rounded-lg border border-border/50 bg-background/50 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{description}</span>
          <span className="text-lg font-bold font-heading">${amount.toLocaleString()}</span>
        </div>
      </div>

      <input
        type="text"
        placeholder="4242 4242 4242 4242"
        value={cardNumber}
        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
        className="h-10 w-full rounded-md border border-border/50 bg-background/50 px-3 text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
      />

      <Button
        type="submit"
        disabled={processing || cardNumber.replace(/\s/g, "").length < 16}
        className="w-full gradient-brand text-white border-0"
      >
        {processing ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
        ) : (
          <>Pay ${amount.toLocaleString()} (demo)</>
        )}
      </Button>

      <p className="text-center text-[10px] text-muted-foreground/50">
        No money moves in demo mode. Nothing is sent to Stripe.
      </p>
    </form>
  );
}

export function StripePaymentForm({
  amount,
  description,
  leaseId,
  tenantId,
  onSuccess,
  onError,
  className,
}: StripePaymentFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [demo, setDemo] = useState(!isStripeConfigured());
  const [loadError, setLoadError] = useState("");
  const [paid, setPaid] = useState(false);

  const handleSuccess = useCallback(
    (id: string) => {
      setPaid(true);
      onSuccess(id);
    },
    [onSuccess]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const intent = await createIntent({ amount, description, leaseId, tenantId });
        if (cancelled) return;
        if (intent.demo) setDemo(true);
        else setClientSecret(intent.clientSecret);
      } catch (err: any) {
        if (cancelled) return;
        const message = err?.message || "Payment could not be started";
        setLoadError(message);
        onError?.(message);
      }
    })();

    return () => { cancelled = true; };
    // onError is intentionally excluded — callers pass inline closures, and
    // re-running this effect would create a second PaymentIntent per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, description, leaseId, tenantId]);

  if (paid) {
    return <SuccessCard amount={amount} description={description} className={className} />;
  }

  if (loadError) {
    return (
      <Card className={cn("border-destructive/30 bg-destructive/5", className)}>
        <CardContent className="flex items-start gap-2 p-6 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {loadError}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-border/50 bg-card/50", className)}>
      <CardContent className="p-6">
        {demo ? (
          <DemoForm amount={amount} description={description} onSuccess={handleSuccess} />
        ) : clientSecret ? (
          <Elements stripe={getStripe()} options={{ clientSecret }}>
            <CheckoutForm
              amount={amount}
              description={description}
              onSuccess={handleSuccess}
              onError={onError}
            />
          </Elements>
        ) : (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing secure payment…
          </div>
        )}
      </CardContent>
    </Card>
  );
}
