"use client";

import React, { useState } from "react";
import { CreditCard, DollarSign, Clock, CheckCircle2, History, ReceiptText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ReceiptDocument, PrintButton } from "@/components/rent-documents";
import { TenantNoticeBanner } from "@/components/tenant-notice-banner";
import type { RentReceipt } from "@/lib/types";
import { useLeases, useCurrentTenant, useTransactions, useRentDocuments } from "@/lib/hooks";
import { StripePaymentForm } from "@/components/stripe-payment-form";
import { AutopaySetup } from "@/components/autopay-setup";
import toast from "react-hot-toast";

export default function TenantPaymentsPage() {
  const { leases } = useLeases();
  const { tenant: currentTenant } = useCurrentTenant();
  const { transactions } = useTransactions();
  const { receipts } = useRentDocuments();
  const [showPayment, setShowPayment] = useState(false);
  const [viewReceipt, setViewReceipt] = useState<RentReceipt | null>(null);

  const myTenant = currentTenant;
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

      {/* Repeated here because this is the page they land on to pay. */}
      <TenantNoticeBanner />

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
          onSuccess={handlePaymentSuccess}
          onError={(err) => toast.error(err)}
        />
      )}

      {/* Autopay Toggle */}
      <AutopaySetup tenant={myTenant} />

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

      {/* Receipts — the tenant's own copy, not the landlord's word for it. */}
      {receipts.length > 0 && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><ReceiptText className="h-4 w-4" /> Receipts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {receipts.map(receipt => (
              <div key={receipt.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                <div>
                  <p className="text-sm font-medium">{receipt.number}</p>
                  <p className="text-xs text-muted-foreground">
                    {receipt.period} · paid {receipt.paidOn} · {receipt.method}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">${receipt.amount.toLocaleString()}</span>
                  <Button variant="outline" size="sm" onClick={() => setViewReceipt(receipt)}>View</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!viewReceipt} onOpenChange={(o) => !o && setViewReceipt(null)}>
        <DialogContent className="sm:max-w-xl max-h-[88vh] overflow-y-auto">
          <DialogHeader className="no-print">
            <DialogTitle>Receipt {viewReceipt?.number}</DialogTitle>
          </DialogHeader>
          {viewReceipt && (
            <div className="space-y-3">
              <div className="flex justify-end no-print"><PrintButton label="Print or save as PDF" /></div>
              <ReceiptDocument receipt={viewReceipt} />
            </div>
          )}
          <DialogFooter className="no-print">
            <Button variant="outline" onClick={() => setViewReceipt(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
