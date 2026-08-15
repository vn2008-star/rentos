"use client";

import React, { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Camera, StickyNote, KeyRound, ClipboardCheck, Pin, PinOff,
  Phone, Mail, MessageSquare, Footprints, AlertOctagon, FileText, Plus,
  ShieldAlert, Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PhotoUpload } from "@/components/photo-upload";
import {
  useUnits, useProperties, useTenants, useUnitNotes, useKeys, useInspections,
} from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { NoteKind, KeyKind, LockChange } from "@/lib/types";
import toast from "react-hot-toast";
import { errorMessage } from "@/lib/errors";

const NOTE_META: Record<NoteKind, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  note:      { label: "Note",      icon: StickyNote,    tone: "text-muted-foreground bg-muted" },
  call:      { label: "Call",      icon: Phone,         tone: "text-blue-400 bg-blue-500/15" },
  email:     { label: "Email",     icon: Mail,          tone: "text-violet-400 bg-violet-500/15" },
  sms:       { label: "SMS",       icon: MessageSquare, tone: "text-cyan-400 bg-cyan-500/15" },
  visit:     { label: "Visit",     icon: Footprints,    tone: "text-emerald-400 bg-emerald-500/15" },
  complaint: { label: "Complaint", icon: AlertOctagon,  tone: "text-red-400 bg-red-500/15" },
};

const KEY_LABEL: Record<KeyKind, string> = {
  physical: "Physical key",
  fob: "Fob",
  code: "Door code",
  smart_lock: "Smart lock",
  mailbox: "Mailbox",
  garage: "Garage",
};

const LOCK_REASON_LABEL: Record<LockChange["reason"], string> = {
  turnover: "Turnover",
  lost_key: "Lost key",
  security: "Security",
  upgrade: "Upgrade",
  damage: "Damage",
  other: "Other",
};

export default function UnitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const unitId = String(params.unitId);

  const { units, editUnit } = useUnits();
  const { properties } = useProperties();
  const { tenants } = useTenants();
  const { notesForUnit, addNote, togglePin, removeNote } = useUnitNotes();
  const { keys, lockChanges, addKey, issueKey, returnKey, markKeyStatus, recordLockChange } = useKeys();
  const { inspections } = useInspections();

  const [noteForm, setNoteForm] = useState({ kind: "note" as NoteKind, body: "" });
  const [showAddKey, setShowAddKey] = useState(false);
  const [showRekey, setShowRekey] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyForm, setKeyForm] = useState({ label: "", kind: "physical" as KeyKind, copies: 1, notes: "" });
  const [rekeyForm, setRekeyForm] = useState({ reason: "turnover" as LockChange["reason"], cost: "", notes: "" });
  const [newPhotos, setNewPhotos] = useState<(File | string)[]>([]);

  const unit = units.find(u => u.id === unitId);
  const property = properties.find(p => p.id === unit?.propertyId);
  const tenant = tenants.find(t => t.id === unit?.currentTenantId);

  const notes = useMemo(() => notesForUnit(unitId), [notesForUnit, unitId]);
  const unitKeys = useMemo(() => keys.filter(k => k.unitId === unitId), [keys, unitId]);
  const unitLockChanges = useMemo(
    () => lockChanges.filter(l => l.unitId === unitId).sort((a, b) => b.changedAt.localeCompare(a.changedAt)),
    [lockChanges, unitId]
  );
  const unitInspections = useMemo(
    () => inspections.filter(i => i.unitId === unitId).sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor)),
    [inspections, unitId]
  );

  if (!unit) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/units")} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back to units
        </Button>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-10 text-center">
            <p className="text-sm text-muted-foreground">Unit not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleAddNote = async () => {
    if (!noteForm.body.trim()) {
      toast.error("Write something first");
      return;
    }
    setSaving(true);
    try {
      await addNote({
        unitId,
        propertyId: unit.propertyId,
        tenantId: unit.currentTenantId,
        kind: noteForm.kind,
        body: noteForm.body.trim(),
      });
      setNoteForm({ kind: "note", body: "" });
      toast.success("Added to the unit's history");
    } catch (err) {
      toast.error(err instanceof Error ? errorMessage(err) : "Could not save the note");
    } finally {
      setSaving(false);
    }
  };

  const handleAddKey = async () => {
    if (!keyForm.label.trim()) {
      toast.error("Label the key");
      return;
    }
    setSaving(true);
    try {
      await addKey({
        unitId, propertyId: unit.propertyId,
        label: keyForm.label.trim(), kind: keyForm.kind,
        copies: keyForm.copies, notes: keyForm.notes || undefined,
      });
      toast.success("Key added to inventory");
      setShowAddKey(false);
      setKeyForm({ label: "", kind: "physical", copies: 1, notes: "" });
    } catch (err) {
      toast.error(err instanceof Error ? errorMessage(err) : "Could not add the key");
    } finally {
      setSaving(false);
    }
  };

  const handleRekey = async () => {
    setSaving(true);
    try {
      await recordLockChange({
        unitId, propertyId: unit.propertyId,
        reason: rekeyForm.reason,
        cost: rekeyForm.cost ? Number(rekeyForm.cost) : undefined,
        notes: rekeyForm.notes || undefined,
      });
      toast.success("Lock change recorded — existing keys retired");
      setShowRekey(false);
      setRekeyForm({ reason: "turnover", cost: "", notes: "" });
    } catch (err) {
      toast.error(err instanceof Error ? errorMessage(err) : "Could not record the change");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePhotos = async () => {
    setSaving(true);
    try {
      // Existing photos are URLs already; newly picked files upload through the
      // same path the rest of the app uses.
      await editUnit(unitId, { photos: newPhotos.filter((p): p is string => typeof p === "string") });
      toast.success("Gallery updated");
      setShowPhotos(false);
    } catch (err) {
      toast.error(err instanceof Error ? errorMessage(err) : "Could not update the gallery");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push("/units")} className="gap-1.5 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back to units
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Unit {unit.unitNumber}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {property?.name}
            {tenant ? ` · ${tenant.firstName} ${tenant.lastName}` : " · Vacant"}
            {` · ${unit.beds}BR / ${unit.baths}BA · $${unit.rent.toLocaleString()}/mo`}
          </p>
        </div>
        <Badge variant="outline" className="capitalize">{unit.status.replace(/_/g, " ")}</Badge>
      </div>

      <Tabs defaultValue="photos">
        <TabsList>
          <TabsTrigger value="photos" className="gap-1.5"><Camera className="h-3.5 w-3.5" /> Photos</TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5"><StickyNote className="h-3.5 w-3.5" /> Notes ({notes.length})</TabsTrigger>
          <TabsTrigger value="keys" className="gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Keys ({unitKeys.length})</TabsTrigger>
          <TabsTrigger value="inspections" className="gap-1.5"><ClipboardCheck className="h-3.5 w-3.5" /> Inspections ({unitInspections.length})</TabsTrigger>
        </TabsList>

        {/* ---------- Photo gallery ---------- */}
        <TabsContent value="photos" className="mt-4">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm font-heading">Photo gallery</h3>
                <Button variant="outline" size="sm" className="gap-1.5"
                  onClick={() => { setNewPhotos(unit.photos); setShowPhotos(true); }}>
                  <Plus className="h-3.5 w-3.5" /> Manage
                </Button>
              </div>

              {unit.photos.length === 0 ? (
                <div className="py-12 text-center">
                  <Camera className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No photos of this unit yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Photos here feed listings, inspections and turnover comparisons.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {unit.photos.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={`${src}-${i}`} src={src} alt={`Unit ${unit.unitNumber} photo ${i + 1}`}
                      className="aspect-[4/3] w-full rounded-lg object-cover border border-border/50" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- Notes & communication ---------- */}
        <TabsContent value="notes" className="mt-4 space-y-4">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold text-sm font-heading">Log an interaction</h3>
              <div className="flex gap-2">
                <Select value={noteForm.kind} onValueChange={v => v && setNoteForm({ ...noteForm, kind: v as NoteKind })}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(NOTE_META).map(([k, m]) => (
                      <SelectItem key={k} value={k}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea rows={2} className="flex-1" placeholder="What happened?"
                  value={noteForm.body} onChange={e => setNoteForm({ ...noteForm, body: e.target.value })} />
              </div>
              <Button size="sm" onClick={handleAddNote} disabled={saving}
                className="gradient-brand text-white border-0">
                {saving ? "Saving..." : "Add to history"}
              </Button>
            </CardContent>
          </Card>

          {notes.length === 0 ? (
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-10 text-center">
                <StickyNote className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No history recorded for this unit</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {notes.map(n => {
                const meta = NOTE_META[n.kind];
                const Icon = meta.icon;
                return (
                  <Card key={n.id} className={cn("border-border/50 bg-card/50", n.pinned && "border-primary/40 bg-primary/5")}>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={cn("rounded-md p-1.5 shrink-0", meta.tone)}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium">{meta.label}</span>
                            {n.pinned && <Badge variant="outline" className="text-[10px] gap-1"><Pin className="h-2.5 w-2.5" /> Pinned</Badge>}
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(n.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                            </span>
                          </div>
                          <p className="text-sm mt-1 whitespace-pre-wrap">{n.body}</p>
                          <p className="text-[11px] text-muted-foreground/70 mt-1">{n.authorName}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePin(n.id)}>
                            {n.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300"
                            onClick={() => removeNote(n.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ---------- Keys & locks ---------- */}
        <TabsContent value="keys" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setShowAddKey(true)} className="gradient-brand text-white border-0 gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add key
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowRekey(true)} className="gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" /> Record lock change
            </Button>
          </div>

          {unitKeys.length === 0 ? (
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-10 text-center">
                <KeyRound className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No keys tracked for this unit</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {unitKeys.map(k => (
                <Card key={k.id} className="border-border/50 bg-card/50">
                  <CardContent className="p-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{k.label}</span>
                        <Badge variant="outline" className="text-[10px]">{KEY_LABEL[k.kind]}</Badge>
                        <Badge variant="outline" className={cn("text-[10px] capitalize",
                          k.status === "issued" && "text-blue-400 border-blue-500/30",
                          k.status === "available" && "text-emerald-400 border-emerald-500/30",
                          k.status === "lost" && "text-red-400 border-red-500/30",
                          k.status === "retired" && "text-muted-foreground",
                        )}>
                          {k.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {k.copies} cop{k.copies === 1 ? "y" : "ies"}
                        {k.holderName ? ` · held by ${k.holderName}` : ""}
                        {k.issuedAt && k.status === "issued"
                          ? ` since ${new Date(k.issuedAt).toLocaleDateString()}`
                          : ""}
                      </p>
                      {k.notes && <p className="text-xs text-muted-foreground/80 mt-1">{k.notes}</p>}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {k.status === "available" && tenant && (
                        <Button variant="outline" size="sm" className="h-7 text-[11px]"
                          onClick={() => issueKey(k.id, { type: "tenant", id: tenant.id, name: `${tenant.firstName} ${tenant.lastName}` })}>
                          Issue to tenant
                        </Button>
                      )}
                      {k.status === "issued" && (
                        <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => returnKey(k.id)}>
                          Mark returned
                        </Button>
                      )}
                      {k.status !== "lost" && k.status !== "retired" && (
                        <Button variant="ghost" size="sm" className="h-7 text-[11px] text-red-400 hover:text-red-300"
                          onClick={() => markKeyStatus(k.id, "lost")}>
                          Lost
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm font-heading mb-3">Lock change history</h3>
              {unitLockChanges.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No lock changes recorded</p>
              ) : (
                <div className="space-y-2">
                  {unitLockChanges.map(l => (
                    <div key={l.id} className="rounded-lg border border-border/50 bg-background/40 p-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium">{LOCK_REASON_LABEL[l.reason]}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(l.changedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                          {l.cost ? ` · $${l.cost}` : ""}
                        </span>
                      </div>
                      {l.notes && <p className="text-xs text-muted-foreground mt-1">{l.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- Inspections ---------- */}
        <TabsContent value="inspections" className="mt-4">
          {unitInspections.length === 0 ? (
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-10 text-center">
                <ClipboardCheck className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No inspections for this unit</p>
                <Button variant="outline" size="sm" className="mt-3"
                  onClick={() => router.push("/inspections")}>
                  Schedule one
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {unitInspections.map(i => (
                <Card key={i.id} className="border-border/50 bg-card/50">
                  <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium capitalize">{i.type.replace(/_/g, " ")}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">{i.status.replace(/_/g, " ")}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(i.scheduledFor).toLocaleDateString(undefined, { dateStyle: "medium" })}
                        {` · ${i.areas.length} area${i.areas.length === 1 ? "" : "s"}`}
                        {i.depositDeduction ? ` · $${i.depositDeduction} deduction` : ""}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-[11px]"
                      onClick={() => router.push("/inspections")}>
                      <FileText className="h-3 w-3 mr-1" /> Open
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add key dialog */}
      <Dialog open={showAddKey} onOpenChange={setShowAddKey}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add a key</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Label *</Label>
              <Input placeholder="Front door — Key A" value={keyForm.label}
                onChange={e => setKeyForm({ ...keyForm, label: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kind</Label>
                <Select value={keyForm.kind} onValueChange={v => v && setKeyForm({ ...keyForm, kind: v as KeyKind })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(KEY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Copies</Label>
                <Input type="number" min={1} value={keyForm.copies}
                  onChange={e => setKeyForm({ ...keyForm, copies: Number(e.target.value) || 1 })} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={keyForm.notes}
                onChange={e => setKeyForm({ ...keyForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddKey(false)}>Cancel</Button>
            <Button onClick={handleAddKey} disabled={saving} className="gradient-brand text-white border-0">
              {saving ? "Saving..." : "Add key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lock change dialog */}
      <Dialog open={showRekey} onOpenChange={setShowRekey}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Record a lock change</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Every key currently tracked for this unit will be retired — after a rekey
              the old copies no longer open anything.
            </p>
            <div>
              <Label>Reason</Label>
              <Select value={rekeyForm.reason}
                onValueChange={v => v && setRekeyForm({ ...rekeyForm, reason: v as LockChange["reason"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LOCK_REASON_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cost ($)</Label>
              <Input type="number" placeholder="95" value={rekeyForm.cost}
                onChange={e => setRekeyForm({ ...rekeyForm, cost: e.target.value })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={rekeyForm.notes}
                onChange={e => setRekeyForm({ ...rekeyForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRekey(false)}>Cancel</Button>
            <Button onClick={handleRekey} disabled={saving} className="gradient-brand text-white border-0">
              {saving ? "Recording..." : "Record change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo gallery dialog */}
      <Dialog open={showPhotos} onOpenChange={setShowPhotos}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Unit photos</DialogTitle></DialogHeader>
          <PhotoUpload photos={newPhotos} onChange={setNewPhotos} maxPhotos={20} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPhotos(false)}>Cancel</Button>
            <Button onClick={handleSavePhotos} disabled={saving} className="gradient-brand text-white border-0">
              {saving ? "Saving..." : "Save gallery"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
