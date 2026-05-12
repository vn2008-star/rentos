"use client";

import React, { useState } from "react";
import {
  ArrowLeftRight, Plus, Calendar, Clock, Globe, Users,
  CheckCircle2, Edit2, Trash2, GraduationCap, Mail, Home,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import toast from "react-hot-toast";

// Mock tenant sublet data (in production: filtered by auth user)
const mySublets = [
  {
    id: "sublet-1", status: "active" as const,
    title: "2BR near campus — Summer sublet (Jun–Aug)",
    description: "Fully furnished 2BR/1BA in University Commons. Pool, gym, bike storage.",
    monthlyRent: 1500, startDate: "2025-06-15", endDate: "2025-08-31",
    reason: "Study abroad — Barcelona",
    guestInfo: { name: "Kai Nakamura", email: "kai.n@berkeley.edu", university: "UC Berkeley" },
    inquiries: 3,
  },
];

const statusColors: Record<string, string> = {
  draft: "text-slate-400 bg-slate-500/15 border-slate-500/30",
  active: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  completed: "text-blue-400 bg-blue-500/15 border-blue-500/30",
  cancelled: "text-red-400 bg-red-500/15 border-red-500/30",
};

export default function TenantSubletPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", monthlyRent: "", startDate: "", endDate: "", reason: "",
  });

  const handleCreate = async () => {
    if (!form.title || !form.startDate || !form.endDate) {
      toast.error("Please fill in required fields");
      return;
    }
    setSaving(true);
    await new Promise(r => setTimeout(r, 1000));
    setSaving(false);
    setShowCreate(false);
    toast.success("Sublet listing created and live! 🏠");
    setForm({ title: "", description: "", monthlyRent: "", startDate: "", endDate: "", reason: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">My Sublets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sublet your unit while you&apos;re away</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 gap-1.5">
          <Plus className="h-4 w-4" /> List My Unit
        </Button>
      </div>

      {/* Info banner */}
      <Card className="border-cyan-500/20 bg-cyan-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Globe className="h-5 w-5 text-cyan-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Free Sublet Listing</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You can freely list your unit on the Davis sublet marketplace. Your listing goes live immediately — no approval needed.
              Perfect for summer study abroad, internships, or family visits.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* My sublets */}
      {mySublets.length > 0 ? (
        <div className="space-y-4">
          {mySublets.map(sublet => (
            <Card key={sublet.id} className="border-border/50 bg-card/50">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold font-heading">{sublet.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{sublet.description}</p>
                  </div>
                  <Badge className={`border ${statusColors[sublet.status]}`}>{sublet.status}</Badge>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <span className="text-cyan-400 font-medium">${sublet.monthlyRent}/mo</span>
                  <span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> {sublet.startDate} — {sublet.endDate}</span>
                  <span className="text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> {sublet.inquiries} inquiries</span>
                </div>

                {sublet.guestInfo && (
                  <div className="rounded-lg bg-accent/30 p-3 flex items-center gap-3">
                    <GraduationCap className="h-5 w-5 text-violet-400" />
                    <div>
                      <p className="text-sm font-medium">{sublet.guestInfo.name}</p>
                      <p className="text-xs text-muted-foreground">{sublet.guestInfo.university} · {sublet.guestInfo.email}</p>
                    </div>
                    <Badge className="ml-auto bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">Matched</Badge>
                  </div>
                )}

                {sublet.reason && (
                  <p className="text-xs text-muted-foreground italic">Reason: {sublet.reason}</p>
                )}

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5"><Edit2 className="h-3.5 w-3.5" /> Edit</Button>
                  {sublet.status === "active" && (
                    <Button size="sm" variant="outline" className="gap-1.5 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Cancel</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-border/50 p-12 text-center">
          <Home className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
          <h3 className="text-lg font-semibold font-heading">No sublets yet</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            Going away for the summer? List your unit on the Davis sublet marketplace and find a vetted guest.
          </p>
          <Button onClick={() => setShowCreate(true)} className="mt-4 gap-1.5"><Plus className="h-4 w-4" /> List My Unit</Button>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Sublet My Unit</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Your listing will go live immediately on the Davis marketplace.</p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. 2BR near campus — Summer sublet" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Describe your unit and what's included..." /></div>
            <div><Label>Monthly Rent ($)</Label><Input type="number" value={form.monthlyRent} onChange={e => setForm({ ...form, monthlyRent: e.target.value })} placeholder="e.g. 1500" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
              <div><Label>End Date</Label><Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
            </div>
            <div><Label>Reason (optional)</Label><Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Study abroad, internship, visiting family..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="gradient-brand text-white border-0">{saving ? "Creating..." : "Publish Sublet"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
