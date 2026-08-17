"use client";

import React, { useMemo, useState } from "react";
import {
  ClipboardCheck, Plus, Camera, CheckCircle2, Clock, AlertTriangle, DollarSign,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PhotoUpload } from "@/components/photo-upload";
import { useInspections, useUnits, useProperties, useTenants, useLeases, useCalendar } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import {
  DAVIS_MOVE_IN_TEMPLATE, buildDavisMoveInAreas, copyDueBy, davisMoveInDeadlines,
  outstandingAreas,
} from "@/lib/inspection-templates";
import type { InspectionType, ItemCondition, InspectionArea } from "@/lib/types";
import toast from "react-hot-toast";
import { errorMessage } from "@/lib/errors";

const TYPE_LABEL: Record<InspectionType, string> = {
  move_in: "Move-in",
  move_out: "Move-out",
  periodic: "Periodic",
  turnover: "Turnover",
};

const CONDITION_TONE: Record<ItemCondition, string> = {
  excellent: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  good: "text-teal-400 bg-teal-500/15 border-teal-500/30",
  fair: "text-amber-400 bg-amber-500/15 border-amber-500/30",
  poor: "text-orange-400 bg-orange-500/15 border-orange-500/30",
  damaged: "text-red-400 bg-red-500/15 border-red-500/30",
};

/** Areas offered by default. The inspector can add anything else by name. */
const DEFAULT_AREAS = [
  "Kitchen", "Bathroom", "Bedroom 1", "Bedroom 2", "Living Room",
  "Flooring / Carpet", "Walls & Paint", "Windows & Doors",
  "Appliances", "Exterior", "Smoke Detectors",
];

const dateOnly = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });

export default function InspectionsPage() {
  const { inspections, scheduleInspection, saveArea, completeInspection, removeInspection } = useInspections();
  const { units } = useUnits();
  const { properties } = useProperties();
  const { tenants } = useTenants();
  const { leases } = useLeases();
  const { addEvent } = useCalendar();

  /**
   * When Article 18.11 wants this walk-through done: five business days from
   * the tenancy starting, which is a date only the lease knows. Returned as
   * null for anything not on the Davis form or not tied to a lease, rather than
   * inventing a deadline from the date somebody happened to schedule it.
   */
  const walkByFor = React.useCallback((inspection: { templateId?: string; leaseId?: string; type: string }) => {
    if (inspection.templateId !== "davis-move-in" || !inspection.leaseId) return null;
    const lease = leases.find(l => l.id === inspection.leaseId);
    if (!lease?.startDate) return null;
    return davisMoveInDeadlines({ tenancyStart: lease.startDate }).inspectBy || null;
  }, [leases]);

  const [showSchedule, setShowSchedule] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "completed">("open");

  const [form, setForm] = useState({
    unitId: "", type: "move_in" as InspectionType, scheduledFor: "",
    inspectorName: "Davis Housing Services", tenantId: "",
    useDavisTemplate: true,
  });

  // The form is generated from the unit being inspected, so a studio is not
  // handed a checklist with "Bedroom 2" on it.
  const templateAreas = useMemo(
    () => buildDavisMoveInAreas(units.find(u => u.id === form.unitId)),
    [units, form.unitId]
  );
  const templateApplies = form.type === "move_in" && form.useDavisTemplate;

  const [areaForm, setAreaForm] = useState<{
    name: string; condition: ItemCondition; notes: string; estimatedCost: string; photos: File[];
  }>({ name: "", condition: "good", notes: "", estimatedCost: "", photos: [] });

  const open = inspections.find(i => i.id === openId) ?? null;

  /** What is left to walk, in form order rather than alphabetical. */
  const openOutstanding = useMemo(
    () => outstandingAreas(open?.expectedAreas, open?.areas ?? []),
    [open?.expectedAreas, open?.areas]
  );

  // Guidance for whichever area is selected, from the form the unit was
  // scheduled against rather than from the unit as it looks today.
  const areaGuidance = useMemo(() => {
    if (!open?.templateId || !areaForm.name) return null;
    const unit = units.find(u => u.id === open.unitId);
    return buildDavisMoveInAreas(unit).find(a => a.name === areaForm.name)?.guidance ?? null;
  }, [open?.templateId, open?.unitId, areaForm.name, units]);

  const visible = useMemo(() => {
    const list = filter === "all"
      ? inspections
      : filter === "completed"
        ? inspections.filter(i => i.status === "completed")
        : inspections.filter(i => i.status !== "completed");
    return [...list].sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));
  }, [inspections, filter]);

  const unitLabel = (unitId: string) => {
    const unit = units.find(u => u.id === unitId);
    if (!unit) return "Unit";
    const property = properties.find(p => p.id === unit.propertyId);
    return `Unit ${unit.unitNumber}${property ? ` · ${property.name}` : ""}`;
  };

  const handleSchedule = async () => {
    if (!form.unitId || !form.scheduledFor) {
      toast.error("Pick a unit and a date");
      return;
    }
    setSaving(true);
    try {
      const unit = units.find(u => u.id === form.unitId);
      const when = new Date(form.scheduledFor).toISOString();

      const id = await scheduleInspection({
        unitId: form.unitId,
        propertyId: unit?.propertyId ?? "",
        type: form.type,
        scheduledFor: when,
        inspectorName: form.inspectorName,
        tenantId: form.tenantId || undefined,
        ...(templateApplies
          ? {
              templateId: DAVIS_MOVE_IN_TEMPLATE.id,
              expectedAreas: templateAreas.map(a => a.name),
            }
          : {}),
      });

      // An inspection that isn't on the calendar gets forgotten, so the two are
      // created together rather than relying on the user to do both.
      await addEvent({
        type: "inspection",
        title: `${TYPE_LABEL[form.type]} inspection — ${unit ? `Unit ${unit.unitNumber}` : "unit"}`,
        start: when,
        unitId: form.unitId,
        propertyId: unit?.propertyId,
        relatedId: id,
      });

      toast.success("Inspection scheduled and added to the calendar");
      setShowSchedule(false);
      setForm({ ...form, unitId: "", scheduledFor: "", tenantId: "" });
    } catch (err) {
      toast.error(err instanceof Error ? errorMessage(err) : "Could not schedule");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveArea = async () => {
    if (!open || !areaForm.name.trim()) {
      toast.error("Name the area");
      return;
    }
    setSaving(true);
    try {
      const area: InspectionArea = {
        name: areaForm.name.trim(),
        condition: areaForm.condition,
        notes: areaForm.notes || undefined,
        photos: [],
        ...(areaForm.estimatedCost ? { estimatedCost: Number(areaForm.estimatedCost) } : {}),
      };
      const uploaded = await saveArea(open.id, area, areaForm.photos);
      toast.success(
        uploaded
          ? `${area.name} recorded with ${uploaded} photo${uploaded === 1 ? "" : "s"}`
          : `${area.name} recorded`
      );
      setAreaForm({ name: "", condition: "good", notes: "", estimatedCost: "", photos: [] });
    } catch (err) {
      toast.error(err instanceof Error ? errorMessage(err) : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => ({
    scheduled: inspections.filter(i => i.status === "scheduled").length,
    inProgress: inspections.filter(i => i.status === "in_progress").length,
    completed: inspections.filter(i => i.status === "completed").length,
  }), [inspections]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Inspections</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Move-in, move-out and periodic condition reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={v => v && setFilter(v as typeof filter)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowSchedule(true)}
            className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 gap-1.5">
            <Plus className="h-4 w-4" /> Schedule
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Scheduled", value: stats.scheduled, icon: Clock, tone: "text-blue-400 bg-blue-500/15" },
          { label: "In progress", value: stats.inProgress, icon: ClipboardCheck, tone: "text-amber-400 bg-amber-500/15" },
          { label: "Completed", value: stats.completed, icon: CheckCircle2, tone: "text-emerald-400 bg-emerald-500/15" },
        ].map(s => (
          <Card key={s.label} className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("rounded-lg p-2.5", s.tone)}><s.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold font-heading">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-10 text-center">
            <ClipboardCheck className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No inspections here yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map(i => {
            const overdue = i.status !== "completed" && new Date(i.scheduledFor) < new Date();
            const walkBy = walkByFor(i);
            // Past the statutory date with the walk-through still undone is a
            // different problem from a missed appointment, and says so.
            const lateOnStatute =
              !!walkBy && i.status !== "completed" && walkBy < new Date().toISOString().slice(0, 10);
            return (
              <Card key={i.id} className="border-border/50 bg-card/50 hover:border-border transition-colors">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold font-heading">{unitLabel(i.unitId)}</h3>
                        <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[i.type]}</Badge>
                        {i.status === "completed" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">Completed</Badge>
                        ) : overdue ? (
                          <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px] gap-1">
                            <AlertTriangle className="h-3 w-3" /> Overdue
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px]">
                            {i.status === "in_progress" ? "In progress" : "Scheduled"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(i.scheduledFor).toLocaleString(undefined, {
                          dateStyle: "medium", timeStyle: "short",
                        })} · {i.inspectorName} · {i.areas.length}
                        {i.expectedAreas?.length ? ` of ${i.expectedAreas.length}` : ""} area
                        {i.areas.length === 1 && !i.expectedAreas?.length ? "" : "s"} recorded
                      </p>
                      {walkBy && i.status !== "completed" && (
                        <p className={cn(
                          "text-xs mt-1",
                          lateOnStatute ? "text-red-400 font-medium" : "text-amber-400"
                        )}>
                          {lateOnStatute
                            ? `Davis Art. 18.11: the joint walk-through was due ${dateOnly(walkBy)}`
                            : `Davis Art. 18.11: walk it with the tenant by ${dateOnly(walkBy)}`}
                        </p>
                      )}
                      {/* The obligation that outlives the walk-through, and the
                          one people forget once the keys are handed over. */}
                      {i.templateId && i.status === "completed" && copyDueBy(i.completedAt) && (
                        <p className="text-xs text-amber-400 mt-1">
                          Give each tenant a signed copy by {dateOnly(copyDueBy(i.completedAt)!)}
                        </p>
                      )}
                      {i.depositDeduction ? (
                        <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          ${i.depositDeduction.toLocaleString()} proposed deposit deduction
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setOpenId(i.id)}>
                        {i.status === "completed" ? "View report" : "Record findings"}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300"
                        onClick={() => removeInspection(i.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Schedule dialog */}
      <Dialog open={showSchedule} onOpenChange={setShowSchedule}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Schedule an inspection</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unit *</Label>
                <Select value={form.unitId} onValueChange={v => v != null && setForm({ ...form, unitId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>
                    {units.map(u => <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => v && setForm({ ...form, type: v as InspectionType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Date &amp; time *</Label>
              <Input type="datetime-local" value={form.scheduledFor}
                onChange={e => setForm({ ...form, scheduledFor: e.target.value })} />
            </div>
            <div>
              <Label>Inspector</Label>
              <Input value={form.inspectorName}
                onChange={e => setForm({ ...form, inspectorName: e.target.value })} />
            </div>
            <div>
              <Label>Tenant (optional)</Label>
              <Select value={form.tenantId} onValueChange={v => v != null && setForm({ ...form, tenantId: v })}>
                <SelectTrigger><SelectValue placeholder="No tenant" /></SelectTrigger>
                <SelectContent>
                  {tenants.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Linking a tenant lets them see the report — the evidence behind any deposit deduction.
              </p>
            </div>

            {/* Davis requires the walk-through; this is the form for it. */}
            {form.type === "move_in" && (
              <button
                type="button"
                onClick={() => setForm({ ...form, useDavisTemplate: !form.useDavisTemplate })}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  form.useDavisTemplate
                    ? "border-primary bg-primary/5"
                    : "border-border/50 bg-card/50 hover:border-primary/30"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{DAVIS_MOVE_IN_TEMPLATE.name}</p>
                  {form.useDavisTemplate && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {DAVIS_MOVE_IN_TEMPLATE.description}
                </p>
                {form.useDavisTemplate && form.unitId && (
                  <p className="mt-1.5 text-[11px] text-primary">
                    {templateAreas.length} areas for this unit, from its {units.find(u => u.id === form.unitId)?.beds ?? 0} bed
                    {" / "}{units.find(u => u.id === form.unitId)?.baths ?? 0} bath layout
                  </p>
                )}
              </button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSchedule(false)}>Cancel</Button>
            <Button onClick={handleSchedule} disabled={saving} className="gradient-brand text-white border-0">
              {saving ? "Scheduling..." : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Findings dialog */}
      <Dialog open={!!openId} onOpenChange={o => !o && setOpenId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {open ? `${TYPE_LABEL[open.type]} — ${unitLabel(open.unitId)}` : "Inspection"}
            </DialogTitle>
          </DialogHeader>

          {open && (
            <div className="space-y-4">
              {/* The form's own progress. Without it, "record findings" is a
                  blank box and the walk-through stops wherever attention did. */}
              {open.expectedAreas?.length ? (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{DAVIS_MOVE_IN_TEMPLATE.name}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {open.areas.length} of {open.expectedAreas.length} recorded
                    </Badge>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/50">
                    <div
                      className="h-full rounded-full gradient-brand transition-all duration-500"
                      style={{ width: `${Math.round((open.areas.length / open.expectedAreas.length) * 100)}%` }}
                    />
                  </div>
                  {openOutstanding.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {openOutstanding.map(name => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setAreaForm({ ...areaForm, name })}
                          className={cn(
                            "rounded-md border px-2 py-1 text-[11px] transition-colors",
                            areaForm.name === name
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          )}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-emerald-400">
                      Every area on the form has been recorded.
                    </p>
                  )}
                  {open.status !== "completed" && walkByFor(open) && (
                    <p className="text-[11px] text-amber-300 border-t border-border/30 pt-2">
                      Davis Art. 18.11: walk this with the tenant by {dateOnly(walkByFor(open)!)} —
                      five business days from the start of the tenancy.
                    </p>
                  )}
                  {copyDueBy(open.completedAt) && (
                    <p className="text-[11px] text-amber-300 border-t border-border/30 pt-2">
                      Davis Art. 18.11: each tenant needs a signed copy by{" "}
                      {dateOnly(copyDueBy(open.completedAt)!)}.
                    </p>
                  )}
                </div>
              ) : null}

              {open.areas.length > 0 && (
                <div className="space-y-2">
                  {open.areas.map(a => (
                    <div key={a.name} className="rounded-lg border border-border/50 bg-background/40 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{a.name}</p>
                          {a.notes && <p className="text-xs text-muted-foreground mt-0.5">{a.notes}</p>}
                          {a.photos.length > 0 && (
                            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                              <Camera className="h-3 w-3" /> {a.photos.length} photo{a.photos.length === 1 ? "" : "s"}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {a.estimatedCost ? (
                            <span className="text-xs text-amber-400">${a.estimatedCost}</span>
                          ) : null}
                          <Badge variant="outline" className={cn("text-[10px] capitalize", CONDITION_TONE[a.condition])}>
                            {a.condition}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {open.status !== "completed" && (
                <div className="rounded-lg border border-border/50 bg-background/40 p-3 space-y-3">
                  <p className="text-sm font-medium">Record an area</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Area</Label>
                      <Select value={areaForm.name} onValueChange={v => v != null && setAreaForm({ ...areaForm, name: v })}>
                        <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                        <SelectContent>
                          {(open.expectedAreas?.length ? open.expectedAreas : DEFAULT_AREAS)
                            .map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Condition</Label>
                      <Select value={areaForm.condition}
                        onValueChange={v => v && setAreaForm({ ...areaForm, condition: v as ItemCondition })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(["excellent", "good", "fair", "poor", "damaged"] as ItemCondition[]).map(c => (
                            <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* What to photograph is the part people get wrong, so it is
                      said here rather than in a manual nobody opens. */}
                  {areaGuidance && (
                    <p className="flex items-start gap-1.5 rounded-md bg-background/60 p-2 text-[11px] text-muted-foreground">
                      <Camera className="h-3.5 w-3.5 shrink-0 mt-px text-primary" />
                      <span>{areaGuidance}</span>
                    </p>
                  )}
                  <div>
                    <Label>Notes</Label>
                    <Textarea rows={2} placeholder="What did you find?"
                      value={areaForm.notes} onChange={e => setAreaForm({ ...areaForm, notes: e.target.value })} />
                  </div>
                  {open.type === "move_out" && (
                    <div>
                      <Label>Estimated repair cost ($)</Label>
                      <Input type="number" placeholder="0"
                        value={areaForm.estimatedCost}
                        onChange={e => setAreaForm({ ...areaForm, estimatedCost: e.target.value })} />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Adds to the proposed deposit deduction, so the total always matches the itemised findings.
                      </p>
                    </div>
                  )}
                  <div>
                    {/* PhotoUpload draws its own label, so this one only said
                        "Photos" above "Upload Photos". */}
                    <PhotoUpload
                      photos={areaForm.photos}
                      onChange={f => setAreaForm({ ...areaForm, photos: f as File[] })}
                      maxPhotos={6}
                      label="Photos"
                    />
                  </div>
                  <Button onClick={handleSaveArea} disabled={saving} size="sm"
                    className="gradient-brand text-white border-0">
                    {saving ? "Saving..." : "Save area"}
                  </Button>
                </div>
              )}

              {open.summary && (
                <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
                  <p className="text-sm">{open.summary}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {open?.status !== "completed" && (
              <Button
                onClick={async () => {
                  if (!open) return;
                  await completeInspection(open.id);
                  toast.success("Inspection completed");
                  setOpenId(null);
                }}
                className="gradient-brand text-white border-0"
              >
                Complete inspection
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpenId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
