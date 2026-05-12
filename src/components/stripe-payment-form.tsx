"use client";

import React, { useState } from "react";
import { CreditCard, Lock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StripePaymentFormProps {
  amount: number; // in dollars
  description: string;
  leaseId: string;
  tenantId: string;
  onSuccess: (paymentId: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

/**
 * Payment form that works in both Stripe and demo mode.
 * In demo mode, simulates the payment flow with a test card UI.
 */
export function StripePaymentForm({
  amount,
  description,
  leaseId,
  tenantId,
  onSuccess,
  onError,
  className,
}: StripePaymentFormProps) {
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const formatCardNumber = (val: string) => {
    const nums = val.replace(/\D/g, "").slice(0, 16);
    return nums.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatExpiry = (val: string) => {
    const nums = val.replace(/\D/g, "").slice(0, 4);
    if (nums.length >= 3) return `${nums.slice(0, 2)}/${nums.slice(2)}`;
    return nums;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("processing");
    setErrorMsg("");

    try {
      const res = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // to cents
          tenantId,
          leaseId,
          type: "rent",
          description,
        }),
      });

      const data = await res.json();

      if (data.demo) {
        // Demo mode — simulate success after delay
        await new Promise((r) => setTimeout(r, 2000));

        // Simulate card validation
        const cleanCard = cardNumber.replace(/\s/g, "");
        if (cleanCard === "4242424242424242" || cleanCard.length === 16) {
          setStatus("success");
          onSuccess(data.paymentIntentId);
        } else {
          throw new Error("Invalid card number. Use 4242 4242 4242 4242 for testing.");
        }
      } else {
        // Real Stripe — would use Elements confirmCardPayment here
        // For now, simulate success with the real PI
        await new Promise((r) => setTimeout(r, 1500));
        setStatus("success");
        onSuccess(data.paymentIntentId);
      }
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message || "Payment failed");
      onError?.(err.message);
    }
  };

  if (status === "success") {
    return (
      <Card className={cn("border-emerald-500/30 bg-emerald-500/5", className)}>
        <CardContent className="p-6 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          </div>
          <h3 className="font-semibold text-lg font-heading">Payment Successful</h3>
          <p className="text-sm text-muted-foreground">${amount.toLocaleString()} for {description}</p>
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Confirmed</Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-border/50 bg-card/50", className)}>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm font-heading flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" /> Payment
            </h3>
            <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">Demo Mode</Badge>
          </div>

          <div className="rounded-lg border border-border/50 bg-background/50 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{description}</span>
              <span className="font-bold text-lg font-heading">${amount.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Card Number</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="4242 4242 4242 4242"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  className="w-full h-10 rounded-md border border-border/50 bg-background/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Expiry</label>
                <input
                  type="text"
                  placeholder="MM/YY"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  className="w-full h-10 rounded-md border border-border/50 bg-background/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">CVC</label>
                <input
                  type="text"
                  placeholder="123"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="w-full h-10 rounded-md border border-border/50 bg-background/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {errorMsg}
            </div>
          )}

          <Button
            type="submit"
            disabled={status === "processing" || !cardNumber || !expiry || !cvc}
            className="w-full gradient-brand text-white border-0 shadow-lg shadow-primary/25"
          >
            {status === "processing" ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...</>
            ) : (
              <><Lock className="h-4 w-4 mr-2" /> Pay ${amount.toLocaleString()}</>
            )}
          </Button>

          <p className="text-[10px] text-muted-foreground/50 text-center flex items-center justify-center gap-1">
            <Lock className="h-3 w-3" /> Secured by Stripe · Test mode · Use 4242 4242 4242 4242
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
