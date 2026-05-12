"use client";

import React, { useState } from "react";
import { CreditCard, DollarSign, Clock, CheckCircle2, ToggleLeft, ToggleRight, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLeases, useTenants, useTransactions } from "@/lib/hooks";
import { StripePaymentForm } from "@/components/stripe-payment-form";
import toast from "react-hot-toast";

export default function TenantPaymentsPage() {
  const { leases } = useLeases();
  const { tenants } = useTenants();
  const { transactions } = useTransactions();
  const [showPayment, setShowPayment] = useState(false);
  const [autopay, setAutopay] = useState(false);

  const myTenant = tenants[0];
  const myLease = leases.find(l => l.tenantIds.includes(myTenant?.id || ""));
  const myTransactions = transactions
    .filter(t => t.tenantId === myTenant?.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const handlePaymentSuccess = (paymentId: string) => {
    toast.success("Payment processed successfully!");
    setShowPayment(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Payments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage rent payments and view history</p>
      </div>

      {/* Current Balance */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-violet-500/5">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Month Rent</p>
              <p className="text-4xl font-bold font-heading mt-1">${myLease?.rentAmount.toLocaleString() || "—"}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Due 1st of month</span>
                <span className="flex items-center gap-1">Late fee: {myLease?.lateFeePercent || 5}% after {myLease?.gracePeriodDays || 5} days</span>
              </div>
            </div>
            {!showPayment && (
              <Button onClick={() => setShowPayment(true)} className="gradient-brand text-white border-0 shadow-lg shadow-primary/25">
                <CreditCard className="h-4 w-4 mr-2" /> Pay Rent
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stripe Payment Form */}
      {showPayment && myLease && (
        <StripePaymentForm
          amount={myLease.rentAmount}
          description={`Rent — Unit ${myLease.unitId}`}
          leaseId={myLease.id}
          tenantId={myTenant?.id || ""}
          onSuccess={handlePaymentSuccess}
          onError={(err) => toast.error(err)}
        />
      )}

      {/* Autopay Toggle */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/15 p-2.5">
              <CreditCard className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium">Auto-Pay</p>
              <p className="text-xs text-muted-foreground">Automatically pay rent on the 1st</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="h-10"
            onClick={() => {
              setAutopay(!autopay);
              toast.success(autopay ? "Auto-pay disabled" : "Auto-pay enabled");
            }}
          >
            {autopay ? <ToggleRight className="h-8 w-8 text-primary" /> : <ToggleLeft className="h-8 w-8 text-muted-foreground" />}
          </Button>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" /> Payment History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {myTransactions.length > 0 ? myTransactions.map(txn => (
            <div key={txn.id} className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`rounded-full p-2 ${txn.status === "completed" ? "bg-emerald-500/15" : "bg-amber-500/15"}`}>
                  {txn.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Clock className="h-4 w-4 text-amber-400" />}
                </div>
                <div>
                  <p className="text-sm font-medium">{txn.description}</p>
                  <p className="text-xs text-muted-foreground">{txn.date} · {txn.type.replace("_", " ")}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">${txn.amount.toLocaleString()}</p>
                <Badge variant="outline" className={`text-[10px] ${
                  txn.status === "completed" ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"
                }`}>
                  {txn.status}
                </Badge>
              </div>
            </div>
          )) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No payment history yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
