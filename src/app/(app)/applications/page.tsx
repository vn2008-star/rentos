"use client";

import React, { useState, useCallback } from "react";
import { FileText, Plus, Search, Eye, CheckCircle2, XCircle, Wifi, WifiOff, Shield, UserCheck, Clock, Loader2, BarChart3, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useApplications, useProperties, useUnits } from "@/lib/hooks";
import { runScreening, getScoreInfo, getCreditScoreColor } from "@/lib/screening";
import type { RentalApplication, ApplicationStatus, ScreeningResult } from "@/lib/types";
import toast from "react-hot-toast";

const statusConfig: Record<ApplicationStatus, { label: string; color: string; icon: typeof FileText }> = {
  submitted: { label: "Submitted", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", icon: Clock },
  reviewing: { label: "Reviewing", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: Eye },
  screening: { label: "Screening", color: "bg-violet-500/15 text-violet-400 border-violet-500/30", icon: Shield },
  approved: { label: "Approved", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  denied: { label: "Denied", color: "bg-red-500/15 text-red-400 border-red-500/30", icon: XCircle },
  withdrawn: { label: "Withdrawn", color: "bg-gray-500/15 text-gray-400 border-gray-500/30", icon: XCircle },
};

export default function ApplicationsPage() {
  const { applications, isLive, addApplication, updateApplication } = useApplications();
  const { units } = useUnits();
  const { properties } = useProperties();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedApp, setSelectedApp] = useState<RentalApplication | null>(null);
  const [screening, setScreening] = useState(false);
  const [screeningResult, setScreeningResult] = useState<ScreeningResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    currentAddress: "", employer: "", income: "",
    moveInDate: "", unitId: "", propertyId: "",
    refName: "", refEmail: "", refPhone: "", refRelationship: "",
  });

  const filteredApps = (status?: ApplicationStatus) => {
    return applications.filter(a => {
      const q = search.toLowerCase();
      const matchSearch = `${a.applicant.firstName} ${a.applicant.lastName}`.toLowerCase().includes(q) ||
        a.applicant.email.toLowerCase().includes(q);
      const matchStatus = !status || a.status === status;
      return matchSearch && matchStatus;
    });
  };

  const statusCounts = {
    submitted: applications.filter(a => a.status === "submitted").length,
    reviewing: applications.filter(a => a.status === "reviewing").length,
    screening: applications.filter(a => a.status === "screening").length,
    approved: applications.filter(a => a.status === "approved").length,
    denied: applications.filter(a => a.status === "denied").length,
  };

  const handleAddApplication = async () => {
    setSaving(true);
    try {
      await addApplication({
        unitId: form.unitId,
        propertyId: form.propertyId,
        applicant: {
          firstName: form.firstName, lastName: form.lastName,
          email: form.email, phone: form.phone,
          currentAddress: form.currentAddress, employer: form.employer,
          income: Number(form.income), moveInDate: form.moveInDate,
        },
        references: form.refName ? [{
          name: form.refName, email: form.refEmail, phone: form.refPhone,
          relationship: form.refRelationship, status: "pending",
        }] : [],
      });
      toast.success("Application submitted");
      setShowAdd(false);
      setForm({ firstName: "", lastName: "", email: "", phone: "", currentAddress: "", employer: "", income: "", moveInDate: "", unitId: "", propertyId: "", refName: "", refEmail: "", refPhone: "", refRelationship: "" });
    } catch { toast.error("Failed to submit"); }
    finally { setSaving(false); }
  };

  const handleRunScreening = async (app: RentalApplication) => {
    setScreening(true);
    const unit = units.find(u => u.id === app.unitId);
    const result = await runScreening(app, unit?.rent || 1500);
    setScreeningResult(result);
    await updateApplication(app.id, {
      status: "screening",
      creditCheck: { score: result.creditScore, status: "completed" },
      backgroundCheck: { status: "completed" },
      score: result.overallScore,
    });
    setSelectedApp({ ...app, status: "screening", score: result.overallScore,
      creditCheck: { score: result.creditScore, status: "completed" },
      backgroundCheck: { status: "completed" },
    });
    setScreening(false);
    toast.success("Screening complete");
  };

  const handleDecision = async (app: RentalApplication, decision: "approved" | "denied") => {
    await updateApplication(app.id, { status: decision, decision: decision === "approved" ? "Approved — meets criteria" : "Denied — below threshold" });
    setSelectedApp(null);
    toast.success(`Application ${decision}`);
  };

  const renderAppCard = (app: RentalApplication) => {
    const unit = units.find(u => u.id === app.unitId);
    const prop = properties.find(p => p.id === app.propertyId);
    const sc = statusConfig[app.status];
    const scoreInfo = app.score ? getScoreInfo(app.score) : null;

    return (
      <Card key={app.id} className="border-border/50 bg-card/50 hover:border-primary/20 transition-colors cursor-pointer" onClick={() => { setSelectedApp(app); setScreeningResult(null); }}>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="shrink-0 rounded-lg bg-accent/50 p-3">
            <sc.icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">{app.applicant.firstName} {app.applicant.lastName}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{app.applicant.email} · ${app.applicant.income.toLocaleString()}/yr</p>
            <p className="text-xs text-muted-foreground">Unit {unit?.unitNumber || "—"} — {prop?.name || "—"} · Move-in: {app.applicant.moveInDate}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {scoreInfo && (
              <Badge variant="outline" className={`text-[10px] ${scoreInfo.color} ${scoreInfo.bg}`}>
                Score: {app.score}
              </Badge>
            )}
            <Badge variant="outline" className={`text-xs ${sc.color}`}>{sc.label}</Badge>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">Applications</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            {applications.length} total applications
            <Badge variant="outline" className={`text-[10px] gap-1 ${isLive ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"}`}>
              {isLive ? <><Wifi className="h-2.5 w-2.5" /> Live</> : <><WifiOff className="h-2.5 w-2.5" /> Demo</>}
            </Badge>
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 gap-1.5">
          <Plus className="h-4 w-4" /> New Application
        </Button>
      </div>

      {/* Pipeline Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(["submitted", "reviewing", "screening", "approved", "denied"] as ApplicationStatus[]).map(status => {
          const sc = statusConfig[status];
          return (
            <Card key={status} className="border-border/50 bg-card/50">
              <CardContent className="p-3 text-center">
                <p className={`text-2xl font-bold font-heading ${sc.color.split(" ")[1]}`}>{statusCounts[status as keyof typeof statusCounts]}</p>
                <p className="text-[11px] text-muted-foreground">{sc.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search applicants..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({applications.length})</TabsTrigger>
          <TabsTrigger value="submitted">Submitted ({statusCounts.submitted})</TabsTrigger>
          <TabsTrigger value="screening">Screening ({statusCounts.screening})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({statusCounts.approved})</TabsTrigger>
          <TabsTrigger value="denied">Denied ({statusCounts.denied})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4 space-y-3">{filteredApps().map(renderAppCard)}</TabsContent>
        <TabsContent value="submitted" className="mt-4 space-y-3">{filteredApps("submitted").map(renderAppCard)}{filteredApps("reviewing").map(renderAppCard)}</TabsContent>
        <TabsContent value="screening" className="mt-4 space-y-3">{filteredApps("screening").map(renderAppCard)}</TabsContent>
        <TabsContent value="approved" className="mt-4 space-y-3">{filteredApps("approved").map(renderAppCard)}</TabsContent>
        <TabsContent value="denied" className="mt-4 space-y-3">{filteredApps("denied").map(renderAppCard)}</TabsContent>
      </Tabs>

      {/* Application Detail Sheet */}
      <Sheet open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedApp && (() => {
            const unit = units.find(u => u.id === selectedApp.unitId);
            const prop = properties.find(p => p.id === selectedApp.propertyId);
            const sc = statusConfig[selectedApp.status];
            return (
              <div className="space-y-6">
                <SheetHeader>
                  <SheetTitle className="font-heading text-lg">
                    {selectedApp.applicant.firstName} {selectedApp.applicant.lastName}
                  </SheetTitle>
                </SheetHeader>

                <Badge className={`border ${sc.color}`}>{sc.label}</Badge>

                {/* Applicant Info */}
                <Card className="border-border/50 bg-card/50">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Applicant Info</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div><p className="text-xs text-muted-foreground">Email</p><p>{selectedApp.applicant.email}</p></div>
                      <div><p className="text-xs text-muted-foreground">Phone</p><p>{selectedApp.applicant.phone}</p></div>
                      <div><p className="text-xs text-muted-foreground">Employer</p><p>{selectedApp.applicant.employer}</p></div>
                      <div><p className="text-xs text-muted-foreground">Income</p><p>${selectedApp.applicant.income.toLocaleString()}/yr</p></div>
                      <div><p className="text-xs text-muted-foreground">Current Address</p><p>{selectedApp.applicant.currentAddress}</p></div>
                      <div><p className="text-xs text-muted-foreground">Applying For</p><p>Unit {unit?.unitNumber} — {prop?.name}</p></div>
                    </div>
                  </CardContent>
                </Card>

                {/* Screening Results */}
                {(selectedApp.creditCheck || screeningResult) && (
                  <Card className="border-border/50 bg-card/50">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" /> Screening Results</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {/* Credit Score */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Credit Score</span>
                        <span className={`text-2xl font-bold font-heading ${getCreditScoreColor(selectedApp.creditCheck?.score || screeningResult?.creditScore || 0)}`}>
                          {selectedApp.creditCheck?.score || screeningResult?.creditScore || "—"}
                        </span>
                      </div>
                      {screeningResult && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Background</span>
                            <Badge variant="outline" className={screeningResult.backgroundClear ? "text-emerald-400 border-emerald-500/30" : "text-red-400 border-red-500/30"}>
                              {screeningResult.backgroundClear ? "Clear" : "Flags Found"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Income/Rent Ratio</span>
                            <span className={`font-semibold ${screeningResult.incomeToRentRatio >= 3 ? "text-emerald-400" : screeningResult.incomeToRentRatio >= 2 ? "text-amber-400" : "text-red-400"}`}>
                              {screeningResult.incomeToRentRatio}x
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Overall Score</span>
                            <span className={`text-lg font-bold ${getScoreInfo(screeningResult.overallScore).color}`}>
                              {screeningResult.overallScore}/100
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Recommendation</span>
                            <Badge variant="outline" className={
                              screeningResult.recommendation === "approve" ? "text-emerald-400 border-emerald-500/30" :
                              screeningResult.recommendation === "conditional" ? "text-amber-400 border-amber-500/30" :
                              "text-red-400 border-red-500/30"
                            }>
                              {screeningResult.recommendation === "approve" ? "✓ Approve" : screeningResult.recommendation === "conditional" ? "⚠ Conditional" : "✗ Deny"}
                            </Badge>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* References */}
                {selectedApp.references.length > 0 && (
                  <Card className="border-border/50 bg-card/50">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><UserCheck className="h-4 w-4" /> References</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {selectedApp.references.map((ref, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                          <div>
                            <p className="text-sm font-medium">{ref.name}</p>
                            <p className="text-xs text-muted-foreground">{ref.relationship} · {ref.email}</p>
                          </div>
                          <Badge variant="outline" className={
                            ref.status === "responded" ? "text-emerald-400 border-emerald-500/30" :
                            ref.status === "contacted" ? "text-blue-400 border-blue-500/30" :
                            "text-amber-400 border-amber-500/30"
                          }>
                            {ref.status}
                          </Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Actions */}
                <div className="space-y-2">
                  {selectedApp.status === "submitted" && (
                    <Button className="w-full" variant="outline" onClick={() => {
                      updateApplication(selectedApp.id, { status: "reviewing" });
                      setSelectedApp({ ...selectedApp, status: "reviewing" });
                      toast.success("Moved to review");
                    }}>
                      <Eye className="h-4 w-4 mr-2" /> Start Review
                    </Button>
                  )}
                  {(selectedApp.status === "submitted" || selectedApp.status === "reviewing") && (
                    <Button
                      className="w-full gradient-brand text-white border-0"
                      disabled={screening}
                      onClick={() => handleRunScreening(selectedApp)}
                    >
                      {screening ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Running Screening...</> :
                        <><Shield className="h-4 w-4 mr-2" /> Run Screening</>}
                    </Button>
                  )}
                  {(selectedApp.status === "screening" || selectedApp.status === "reviewing") && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleDecision(selectedApp, "approved")}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button variant="destructive" onClick={() => handleDecision(selectedApp, "denied")}>
                        <XCircle className="h-4 w-4 mr-1" /> Deny
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* New Application Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">New Rental Application</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>First Name</Label><Input placeholder="David" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div>
              <div><Label>Last Name</Label><Input placeholder="Kim" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div>
              <div className="col-span-2"><Label>Email</Label><Input type="email" placeholder="applicant@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input placeholder="(530) 555-0000" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Annual Income</Label><Input type="number" placeholder="72000" value={form.income} onChange={e => setForm({ ...form, income: e.target.value })} /></div>
              <div className="col-span-2"><Label>Current Address</Label><Input placeholder="123 Main St, City, State" value={form.currentAddress} onChange={e => setForm({ ...form, currentAddress: e.target.value })} /></div>
              <div><Label>Employer</Label><Input placeholder="Company name" value={form.employer} onChange={e => setForm({ ...form, employer: e.target.value })} /></div>
              <div><Label>Move-in Date</Label><Input type="date" value={form.moveInDate} onChange={e => setForm({ ...form, moveInDate: e.target.value })} /></div>
              <div className="col-span-2"><Label>Property</Label><Select value={form.propertyId} onValueChange={v => v != null && setForm({ ...form, propertyId: v, unitId: "" })}><SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger><SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              {form.propertyId && (
                <div className="col-span-2"><Label>Unit</Label><Select value={form.unitId} onValueChange={v => v != null && setForm({ ...form, unitId: v })}><SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger><SelectContent>{units.filter(u => u.propertyId === form.propertyId && u.status === "available").map(u => <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber} — ${u.rent}/mo</SelectItem>)}</SelectContent></Select></div>
              )}
            </div>
            <div className="border-t border-border/30 pt-4">
              <h4 className="text-sm font-medium mb-3">Reference (optional)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Name</Label><Input placeholder="Jane Smith" value={form.refName} onChange={e => setForm({ ...form, refName: e.target.value })} /></div>
                <div><Label>Relationship</Label><Input placeholder="Previous Landlord" value={form.refRelationship} onChange={e => setForm({ ...form, refRelationship: e.target.value })} /></div>
                <div><Label>Email</Label><Input type="email" placeholder="ref@email.com" value={form.refEmail} onChange={e => setForm({ ...form, refEmail: e.target.value })} /></div>
                <div><Label>Phone</Label><Input placeholder="(555) 555-0000" value={form.refPhone} onChange={e => setForm({ ...form, refPhone: e.target.value })} /></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAddApplication} disabled={!form.firstName || !form.lastName || !form.email || !form.unitId || saving} className="gradient-brand text-white border-0">
              {saving ? "Submitting..." : "Submit Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
