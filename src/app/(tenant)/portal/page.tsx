"use client";

import React from "react";
import { CreditCard, Wrench, FileText, Bell, DollarSign, Clock, CheckCircle2, AlertCircle, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useLeases, useCurrentTenant, useMaintenance, useTransactions } from "@/lib/hooks";
import { useAuthStore } from "@/lib/store";
import { TenantNoticeBanner } from "@/components/tenant-notice-banner";

export default function TenantPortalPage() {
  const user = useAuthStore(s => s.user);
  const { leases } = useLeases();
  const { tenant: myTenant } = useCurrentTenant();
  const { requests } = useMaintenance();
  const { transactions } = useTransactions();

  const myLease = leases.find(l => l.tenantIds.includes(myTenant?.id || ""));
  const myRequests = requests.filter(r => r.tenantId === myTenant?.id).slice(0, 3);
  const myTransactions = transactions.filter(t => t.tenantId === myTenant?.id).slice(0, 5);

  const nextDueDate = new Date();
  nextDueDate.setDate(1);
  if (nextDueDate < new Date()) nextDueDate.setMonth(nextDueDate.getMonth() + 1);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">
          Welcome, {myTenant?.firstName || user?.displayName || "Tenant"} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your rental dashboard at a glance</p>
      </div>

      <TenantNoticeBanner />

      {/* Rent Due Card */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-violet-500/5">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Rent Due</p>
              <p className="text-4xl font-bold font-heading mt-1">
                ${myLease?.rentAmount.toLocaleString() || "1,800"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Due {nextDueDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
              </p>
            </div>
            <Link href="/portal/payments">
              <Button className="gradient-brand text-white border-0 shadow-lg shadow-primary/25">
                <CreditCard className="h-4 w-4 mr-2" /> Pay Now
              </Button>
            </Link>
          </div>
          {myLease && (
            <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Grace: {myLease.gracePeriodDays} days</span>
              <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Late fee: {myLease.lateFeePercent}%</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/15 p-2.5"><CheckCircle2 className="h-5 w-5 text-emerald-400" /></div>
            <div>
              <p className="text-lg font-bold font-heading">{myLease?.status === "active" ? "Active" : "—"}</p>
              <p className="text-[11px] text-muted-foreground">Lease Status</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/15 p-2.5"><Wrench className="h-5 w-5 text-amber-400" /></div>
            <div>
              <p className="text-lg font-bold font-heading">{myRequests.filter(r => r.status !== "completed" && r.status !== "closed").length}</p>
              <p className="text-[11px] text-muted-foreground">Open Requests</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/portal/payments">
          <Card className="border-border/50 bg-card/50 hover:border-primary/20 transition-colors cursor-pointer h-full">
            <CardContent className="p-4 text-center space-y-2">
              <DollarSign className="h-6 w-6 text-primary mx-auto" />
              <p className="text-xs font-medium">Pay Rent</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/portal/maintenance">
          <Card className="border-border/50 bg-card/50 hover:border-primary/20 transition-colors cursor-pointer h-full">
            <CardContent className="p-4 text-center space-y-2">
              <Wrench className="h-6 w-6 text-amber-400 mx-auto" />
              <p className="text-xs font-medium">Request Repair</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/portal/lease">
          <Card className="border-border/50 bg-card/50 hover:border-primary/20 transition-colors cursor-pointer h-full">
            <CardContent className="p-4 text-center space-y-2">
              <FileText className="h-6 w-6 text-blue-400 mx-auto" />
              <p className="text-xs font-medium">View Lease</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Maintenance */}
      {myRequests.length > 0 && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              Recent Maintenance Requests
              <Link href="/portal/maintenance" className="text-xs text-primary font-normal">View all →</Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                <div>
                  <p className="text-sm font-medium">{req.title}</p>
                  <p className="text-xs text-muted-foreground">{req.category} · {req.createdAt.split("T")[0]}</p>
                </div>
                <Badge variant="outline" className={
                  req.status === "completed" ? "text-emerald-400 border-emerald-500/30" :
                  req.status === "in_progress" ? "text-blue-400 border-blue-500/30" :
                  "text-amber-400 border-amber-500/30"
                }>
                  {req.status.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Payments */}
      {myTransactions.length > 0 && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              Recent Payments
              <Link href="/portal/payments" className="text-xs text-primary font-normal">View all →</Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myTransactions.map(txn => (
              <div key={txn.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                <div>
                  <p className="text-sm font-medium">{txn.description}</p>
                  <p className="text-xs text-muted-foreground">{txn.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-emerald-400">${txn.amount.toLocaleString()}</span>
                  <Badge variant="outline" className={
                    txn.status === "completed" ? "text-emerald-400 border-emerald-500/30 text-[10px]" :
                    "text-amber-400 border-amber-500/30 text-[10px]"
                  }>
                    {txn.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
