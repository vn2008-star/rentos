"use client";

import React, { useState } from "react";
import { FileText, Calendar, DollarSign, CheckCircle2, Clock, FileSignature, RefreshCw, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLeases, useCurrentTenant, useProperties, useUnits } from "@/lib/hooks";
import { ESignature } from "@/components/e-signature";
import { format, parseISO, differenceInDays } from "date-fns";
import { errorMessage } from "@/lib/errors";
import toast from "react-hot-toast";

export default function TenantLeasePage() {
  const { leases, signLease, respondToRenewal } = useLeases();
  const { tenant: myTenant } = useCurrentTenant();
  const { properties } = useProperties();
  const { units } = useUnits();
  const [showSign, setShowSign] = useState(false);
  const [signing, setSigning] = useState(false);

  const myLease = leases.find(l => l.tenantIds.includes(myTenant?.id || ""));
  const myProp = properties.find(p => p.id === myLease?.propertyId);
  const myUnit = units.find(u => u.id === myLease?.unitId);
  const daysRemaining = myLease ? differenceInDays(parseISO(myLease.endDate), new Date()) : 0;
  const iHaveSigned = !!myLease?.signatures.some(s => s.tenantId === myTenant?.id);

  // Both of these go through the server, which is the only place allowed to
  // write a lease. Failures are reported: a signature the landlord never
  // received is not something to congratulate somebody on.
  const handleSign = async (signatureData: string) => {
    if (!myLease || !myTenant) return;
    setSigning(true);
    try {
      const { activated } = await signLease(myLease.id, signatureData);
      setShowSign(false);
      toast.success(
        activated
          ? "Lease signed — your tenancy is now active."
          : "Lease signed. Waiting on the other signatures."
      );
    } catch (err) {
      toast.error(errorMessage(err, "Your signature could not be saved."));
    } finally {
      setSigning(false);
    }
  };

  const handleRenewalDecision = async (decision: "accepted" | "declined") => {
    if (!myLease) return;
    setSigning(true);
    try {
      await respondToRenewal(myLease.id, decision);
      toast.success(decision === "accepted" ? "Renewal accepted!" : "Renewal declined");
    } catch (err) {
      toast.error(errorMessage(err, "Your answer could not be saved."));
    } finally {
      setSigning(false);
    }
  };

  if (!myLease) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight font-heading">My Lease</h1>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No active lease found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">My Lease</h1>
        <p className="text-sm text-muted-foreground mt-0.5">View your lease details and documents</p>
      </div>

      {/* Lease Status Card */}
      <Card className={`${
        myLease.status === "active" ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-emerald-500/0" :
        myLease.status === "expiring_soon" ? "border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-500/0" :
        "border-border/50 bg-card/50"
      }`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <Badge variant="outline" className={
                myLease.status === "active" ? "text-emerald-400 border-emerald-500/30" :
                myLease.status === "expiring_soon" ? "text-amber-400 border-amber-500/30" :
                "text-gray-400 border-gray-500/30"
              }>
                {myLease.status.replace("_", " ")}
              </Badge>
              <h2 className="text-lg font-bold font-heading mt-2">
                Unit {myUnit?.unitNumber} — {myProp?.name}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{myProp?.address.street}, {myProp?.address.city}, {myProp?.address.state} {myProp?.address.zip}</p>
            </div>
            {daysRemaining > 0 && daysRemaining <= 90 && (
              <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">
                <Clock className="h-3 w-3 mr-1" />{daysRemaining} days left
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lease Terms */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader><CardTitle className="text-sm">Lease Terms</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Lease Period</p>
                <p className="font-medium">{format(parseISO(myLease.startDate), "MMM d, yyyy")} — {format(parseISO(myLease.endDate), "MMM d, yyyy")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Monthly Rent</p>
                <p className="font-medium text-emerald-400">${myLease.rentAmount.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Security Deposit</p>
                <p className="font-medium">${myLease.securityDeposit.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Late Fee</p>
                <p className="font-medium">{myLease.lateFeePercent}% after {myLease.gracePeriodDays} days</p>
              </div>
            </div>
          </div>
          {myLease.terms && (
            <div className="mt-4 pt-4 border-t border-border/30">
              <p className="text-xs text-muted-foreground mb-1">Additional Terms</p>
              <p className="text-sm">{myLease.terms}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signatures */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileSignature className="h-4 w-4" /> Signatures</CardTitle></CardHeader>
        <CardContent>
          {/* A co-tenant's name is not readable from here — the rules scope a
              resident to their own record — so the other signatures are
              acknowledged without being attributed to whoever is looking. */}
          {myLease.signatures.map((sig, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">
                  {sig.tenantId === myTenant?.id
                    ? `${myTenant?.firstName} ${myTenant?.lastName} (you)`
                    : "Co-tenant"}
                </p>
                <p className="text-xs text-muted-foreground">Signed {format(parseISO(sig.signedAt), "MMM d, yyyy h:mm a")}</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
          ))}
          {!iHaveSigned && (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">Your signature is required to activate this lease.</p>
              {!showSign && (
                <Button onClick={() => setShowSign(true)} disabled={signing} className="gradient-brand text-white border-0">
                  <FileSignature className="h-4 w-4 mr-2" /> Sign Lease
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* E-Sign */}
      {showSign && (
        <ESignature
          signerName={`${myTenant?.firstName || ""} ${myTenant?.lastName || ""}`}
          onSign={handleSign}
          onCancel={() => setShowSign(false)}
        />
      )}

      {/* Renewal Offer */}
      {myLease.renewalOffered && myLease.renewalDecision === "pending" && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-violet-500/5">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-6 w-6 text-primary" />
              <div>
                <h3 className="font-semibold font-heading">Lease Renewal Offer</h3>
                <p className="text-sm text-muted-foreground">Your landlord has offered to renew your lease</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => handleRenewalDecision("accepted")} disabled={signing} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle2 className="h-4 w-4 mr-1" /> Accept Renewal
              </Button>
              <Button variant="outline" disabled={signing} onClick={() => handleRenewalDecision("declined")}>
                Decline
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
