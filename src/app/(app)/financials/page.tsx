"use client";

import React, { useState, useMemo } from "react";
import { DollarSign, TrendingUp, ArrowDown, ArrowUp, Search, Plus, Wifi, WifiOff, CheckCircle2, Clock, AlertCircle, Users, Building } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTransactions, useLeases, useTenants, useProperties, useUnits } from "@/lib/hooks";
import { buildRevenueHistory, isEmptyHistory } from "@/lib/finance";
import type { Transaction } from "@/lib/types";
import toast from "react-hot-toast";

const typeColors: Record<string, string> = {
  rent: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  deposit: "text-blue-400 bg-blue-500/15 border-blue-500/30",
  fee: "text-amber-400 bg-amber-500/15 border-amber-500/30",
  late_fee: "text-red-400 bg-red-500/15 border-red-500/30",
  maintenance: "text-violet-400 bg-violet-500/15 border-violet-500/30",
  refund: "text-gray-400 bg-gray-500/15 border-gray-500/30",
  other: "text-gray-400 bg-gray-500/15 border-gray-500/30",
};

const statusColors: Record<string, string> = {
  completed: "text-emerald-400 border-emerald-500/30",
  pending: "text-amber-400 border-amber-500/30",
  failed: "text-red-400 border-red-500/30",
  refunded: "text-gray-400 border-gray-500/30",
};

export default function FinancialsPage() {
  const { transactions, isLive, addTransaction } = useTransactions();
  const { leases } = useLeases();
  const { tenants } = useTenants();
  const { properties } = useProperties();
  const { units } = useUnits();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    type: "rent" as Transaction["type"],
    amount: "", description: "", tenantId: "",
    propertyId: "", unitId: "", date: new Date().toISOString().split("T")[0],
  });

  // Computed stats
  const stats = useMemo(() => {
    const completedTxns = transactions.filter(t => t.status === "completed");
    const revenue = completedTxns.filter(t => ["rent", "deposit", "fee", "late_fee"].includes(t.type)).reduce((s, t) => s + t.amount, 0);
    const expenses = completedTxns.filter(t => ["maintenance", "refund"].includes(t.type)).reduce((s, t) => s + t.amount, 0);
    const pending = transactions.filter(t => t.status === "pending").reduce((s, t) => s + t.amount, 0);
    const activeLeaseRent = leases.filter(l => l.status === "active" || l.status === "month_to_month").reduce((s, l) => s + l.rentAmount, 0);

    return { revenue, expenses, net: revenue - expenses, pending, activeLeaseRent };
  }, [transactions, leases]);

  // Rent roll - current month payment status per active lease
  const rentRoll = useMemo(() => {
    return leases
      .filter(l => l.status === "active" || l.status === "month_to_month" || l.status === "expiring_soon")
      .map(lease => {
        const tenant = tenants.find(t => lease.tenantIds.includes(t.id));
        const unit = units.find(u => u.id === lease.unitId);
        const prop = properties.find(p => p.id === lease.propertyId);
        const rentTxns = transactions.filter(
          t => t.leaseId === lease.id && t.type === "rent"
        );
        const paid = rentTxns.some(t => t.status === "completed");
        const pending = rentTxns.some(t => t.status === "pending");

        return {
          lease,
          tenant,
          unit,
          prop,
          status: paid ? "paid" as const : pending ? "pending" as const : "unpaid" as const,
          paidAmount: paid ? lease.rentAmount : 0,
        };
      });
  }, [leases, tenants, units, properties, transactions]);

  const filteredTxns = transactions.filter(t => {
    const q = search.toLowerCase();
    return t.description.toLowerCase().includes(q) || t.type.includes(q) || !q;
  });

  const handleAddTransaction = async () => {
    const orgId = "org-1";
    await addTransaction({
      orgId,
      type: form.type,
      amount: Number(form.amount),
      description: form.description,
      date: form.date,
      status: "completed",
      tenantId: form.tenantId || undefined,
      propertyId: form.propertyId || undefined,
      unitId: form.unitId || undefined,
    } as any);
    toast.success("Transaction recorded");
    setShowAdd(false);
    setForm({ type: "rent", amount: "", description: "", tenantId: "", propertyId: "", unitId: "", date: new Date().toISOString().split("T")[0] });
  };

  // Built from this organization's own completed transactions. It used to read
  // mockDashboardStats.revenueHistory — the same six invented months shown to
  // every organization, on the page whose entire job is to report their money.
  const revenueHistory = useMemo(() => buildRevenueHistory(transactions), [transactions]);
  const historyEmpty = isEmptyHistory(revenueHistory);
  // Was a hardcoded 91,000, which made every bar the wrong length for any org
  // that was not the sample one.
  const historyMax = Math.max(1, ...revenueHistory.map(d => d.revenue));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">Financials</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            Revenue, expenses & rent roll
            <Badge variant="outline" className={`text-[10px] gap-1 ${isLive ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"}`}>
              {isLive ? <><Wifi className="h-2.5 w-2.5" /> Live</> : <><WifiOff className="h-2.5 w-2.5" /> Demo</>}
            </Badge>
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 gap-1.5">
          <Plus className="h-4 w-4" /> Record Transaction
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Revenue</p>
            <p className="text-3xl font-bold font-heading mt-1 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />${(stats.revenue / 1000).toFixed(1)}k
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Expenses</p>
            <p className="text-3xl font-bold font-heading mt-1 flex items-center gap-2">
              <ArrowDown className="h-5 w-5 text-red-400" />${(stats.expenses / 1000).toFixed(1)}k
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Net Income</p>
            <p className={`text-3xl font-bold font-heading mt-1 flex items-center gap-2 ${stats.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              <ArrowUp className="h-5 w-5" />${(Math.abs(stats.net) / 1000).toFixed(1)}k
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-3xl font-bold font-heading mt-1 flex items-center gap-2 text-amber-400">
              <Clock className="h-5 w-5" />${(stats.pending / 1000).toFixed(1)}k
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="rentroll">Rent Roll</TabsTrigger>
          <TabsTrigger value="overview">Monthly Overview</TabsTrigger>
        </TabsList>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="mt-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search transactions..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="space-y-2">
            {filteredTxns.map(txn => (
              <Card key={txn.id} className="border-border/50 bg-card/50">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="shrink-0 rounded-lg bg-accent/50 p-2.5">
                    <DollarSign className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{txn.description}</p>
                    <p className="text-xs text-muted-foreground">{txn.date}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${typeColors[txn.type]}`}>{txn.type.replace("_", " ")}</Badge>
                  <span className={`text-sm font-bold font-heading ${["maintenance", "refund"].includes(txn.type) ? "text-red-400" : "text-emerald-400"}`}>
                    {["maintenance", "refund"].includes(txn.type) ? "-" : "+"}${txn.amount.toLocaleString()}
                  </span>
                  <Badge variant="outline" className={`text-[10px] ${statusColors[txn.status]}`}>{txn.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Rent Roll Tab */}
        <TabsContent value="rentroll" className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Card className="border-emerald-500/20 bg-card/50">
              <CardContent className="p-4 text-center">
                <p className="text-xl font-bold text-emerald-400">{rentRoll.filter(r => r.status === "paid").length}</p>
                <p className="text-[11px] text-muted-foreground">Paid</p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/20 bg-card/50">
              <CardContent className="p-4 text-center">
                <p className="text-xl font-bold text-amber-400">{rentRoll.filter(r => r.status === "pending").length}</p>
                <p className="text-[11px] text-muted-foreground">Pending</p>
              </CardContent>
            </Card>
            <Card className="border-red-500/20 bg-card/50">
              <CardContent className="p-4 text-center">
                <p className="text-xl font-bold text-red-400">{rentRoll.filter(r => r.status === "unpaid").length}</p>
                <p className="text-[11px] text-muted-foreground">Unpaid</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            {rentRoll.map(entry => (
              <Card key={entry.lease.id} className="border-border/50 bg-card/50">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="shrink-0 rounded-lg bg-accent/50 p-2.5">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{entry.tenant ? `${entry.tenant.firstName} ${entry.tenant.lastName}` : "—"}</p>
                    <p className="text-xs text-muted-foreground">Unit {entry.unit?.unitNumber} — {entry.prop?.name}</p>
                  </div>
                  <span className="text-sm font-semibold">${entry.lease.rentAmount.toLocaleString()}</span>
                  <Badge variant="outline" className={
                    entry.status === "paid" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
                    entry.status === "pending" ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                    "text-red-400 border-red-500/30 bg-red-500/10"
                  }>
                    {entry.status === "paid" ? <><CheckCircle2 className="h-3 w-3 mr-1" />Paid</> :
                     entry.status === "pending" ? <><Clock className="h-3 w-3 mr-1" />Pending</> :
                     <><AlertCircle className="h-3 w-3 mr-1" />Unpaid</>}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Monthly Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <Card className="border-border/50 bg-card/50">
            <CardHeader><CardTitle className="text-base">Monthly Breakdown</CardTitle></CardHeader>
            <CardContent>
              {historyEmpty && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No completed transactions in the last six months.
                </p>
              )}
              <div className={historyEmpty ? "hidden" : "space-y-3"}>
                {revenueHistory.map(d => (
                  <div key={d.key} className="flex items-center gap-4 py-2 border-b border-border/30 last:border-0">
                    <span className="w-10 font-medium text-sm">{d.month}</span>
                    <div className="flex-1"><div className="h-3 rounded-full gradient-brand" style={{ width: `${(d.revenue / historyMax) * 100}%` }} /></div>
                    <span className="text-sm font-semibold w-20 text-right">${(d.revenue / 1000).toFixed(1)}k</span>
                    <span className="text-sm text-muted-foreground w-20 text-right">-${(d.expenses / 1000).toFixed(1)}k</span>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">${((d.revenue - d.expenses) / 1000).toFixed(1)}k net</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Record Transaction Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">Record Transaction</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Type</Label><Select value={form.type} onValueChange={(v: any) => v != null && setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="rent">Rent</SelectItem><SelectItem value="deposit">Deposit</SelectItem><SelectItem value="fee">Fee</SelectItem><SelectItem value="late_fee">Late Fee</SelectItem><SelectItem value="maintenance">Maintenance Expense</SelectItem><SelectItem value="refund">Refund</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
              <div><Label>Amount ($)</Label><Input type="number" placeholder="1800" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              <div className="col-span-2"><Label>Description</Label><Input placeholder="December rent — Unit 101" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="col-span-2"><Label>Property (optional)</Label><Select value={form.propertyId} onValueChange={v => v != null && setForm({ ...form, propertyId: v })}><SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger><SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAddTransaction} disabled={!form.amount || !form.description} className="gradient-brand text-white border-0">Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
