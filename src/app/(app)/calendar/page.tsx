"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Eye, ClipboardCheck,
  LogIn, LogOut, Wrench, FileSignature, CircleDot,
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
import { useCalendar, useUnits, useProperties } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { CalendarEventType } from "@/lib/types";
import toast from "react-hot-toast";
import { useQuickAdd } from "@/lib/quick-add";

const EVENT_META: Record<CalendarEventType, {
  label: string; icon: React.ComponentType<{ className?: string }>; tone: string; dot: string;
}> = {
  showing:       { label: "Showing",       icon: Eye,            tone: "text-violet-400 bg-violet-500/15 border-violet-500/30", dot: "bg-violet-400" },
  inspection:    { label: "Inspection",    icon: ClipboardCheck, tone: "text-blue-400 bg-blue-500/15 border-blue-500/30",       dot: "bg-blue-400" },
  move_in:       { label: "Move-in",       icon: LogIn,          tone: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30", dot: "bg-emerald-400" },
  move_out:      { label: "Move-out",      icon: LogOut,         tone: "text-amber-400 bg-amber-500/15 border-amber-500/30",     dot: "bg-amber-400" },
  maintenance:   { label: "Maintenance",   icon: Wrench,         tone: "text-orange-400 bg-orange-500/15 border-orange-500/30",  dot: "bg-orange-400" },
  lease_renewal: { label: "Lease renewal", icon: FileSignature,  tone: "text-cyan-400 bg-cyan-500/15 border-cyan-500/30",        dot: "bg-cyan-400" },
  other:         { label: "Other",         icon: CircleDot,      tone: "text-muted-foreground bg-muted border-border",           dot: "bg-muted-foreground" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The 42 cells of a month grid, including the leading/trailing days that pad
 *  the first and last weeks. */
function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function CalendarPage() {
  const { events, addEvent, updateEvent, removeEvent } = useCalendar();
  const { units } = useUnits();
  const { properties } = useProperties();

  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(isoDay(today));
  const [showAdd, setShowAdd] = useState(false);
  // Opens this dialog when Quick Add in the top bar asked for it.
  useQuickAdd("event", () => setShowAdd(true));
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<CalendarEventType | "all">("all");

  const [form, setForm] = useState({
    type: "showing" as CalendarEventType,
    title: "",
    date: isoDay(today),
    time: "10:00",
    allDay: false,
    unitId: "",
    notes: "",
  });

  const visible = useMemo(
    () => (filter === "all" ? events : events.filter(e => e.type === filter)),
    [events, filter]
  );

  /** Day key → events, so the grid doesn't re-scan the list 42 times. */
  const byDay = useMemo(() => {
    const map = new Map<string, typeof visible>();
    for (const e of visible) {
      const key = e.start.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    for (const list of map.values()) list.sort((a, b) => a.start.localeCompare(b.start));
    return map;
  }, [visible]);

  const grid = useMemo(
    () => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );

  const selectedEvents = byDay.get(selected) ?? [];

  const unitLabel = (unitId?: string) => {
    const unit = units.find(u => u.id === unitId);
    if (!unit) return null;
    const property = properties.find(p => p.id === unit.propertyId);
    return `Unit ${unit.unitNumber}${property ? ` · ${property.name}` : ""}`;
  };

  const upcoming = useMemo(() => {
    const now = new Date().toISOString();
    return visible
      .filter(e => e.start >= now && e.status === "scheduled")
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 6);
  }, [visible]);

  const handleAdd = async () => {
    if (!form.title.trim()) {
      toast.error("Give the event a title");
      return;
    }
    setSaving(true);
    try {
      const start = form.allDay
        ? new Date(`${form.date}T00:00:00`).toISOString()
        : new Date(`${form.date}T${form.time}:00`).toISOString();

      await addEvent({
        type: form.type,
        title: form.title.trim(),
        start,
        allDay: form.allDay,
        unitId: form.unitId || undefined,
        propertyId: units.find(u => u.id === form.unitId)?.propertyId,
        notes: form.notes || undefined,
      });
      toast.success("Event scheduled");
      setShowAdd(false);
      setForm({ ...form, title: "", notes: "", unitId: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the event");
    } finally {
      setSaving(false);
    }
  };

  const monthName = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Showings, inspections, move-ins, move-outs and maintenance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={v => v && setFilter(v as CalendarEventType | "all")}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {Object.entries(EVENT_META).map(([key, meta]) => (
                <SelectItem key={key} value={key}>{meta.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => { setForm(f => ({ ...f, date: selected })); setShowAdd(true); }}
            className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 gap-1.5"
          >
            <Plus className="h-4 w-4" /> Schedule
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Month grid */}
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold font-heading">{monthName}</h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs"
                  onClick={() => { const t = new Date(); setCursor(new Date(t.getFullYear(), t.getMonth(), 1)); setSelected(isoDay(t)); }}>
                  Today
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-[11px] font-medium text-muted-foreground text-center py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {grid.map(day => {
                const key = isoDay(day);
                const dayEvents = byDay.get(key) ?? [];
                const inMonth = day.getMonth() === cursor.getMonth();
                const isToday = key === isoDay(today);
                const isSelected = key === selected;

                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    className={cn(
                      "min-h-[68px] rounded-lg border p-1.5 text-left transition-colors",
                      inMonth ? "border-border/50 bg-background/40" : "border-transparent bg-transparent opacity-40",
                      isSelected && "border-primary/60 bg-primary/10",
                      !isSelected && inMonth && "hover:border-border hover:bg-muted/40"
                    )}
                  >
                    <span className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                      isToday && "gradient-brand text-white font-semibold"
                    )}>
                      {day.getDate()}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 2).map(e => (
                        <div key={e.id} className="flex items-center gap-1">
                          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", EVENT_META[e.type].dot)} />
                          <span className="truncate text-[10px] text-muted-foreground">{e.title}</span>
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="text-[10px] text-muted-foreground/70">+{dayEvents.length - 2} more</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selected day + upcoming */}
        <div className="space-y-4">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm font-heading flex items-center gap-2 mb-3">
                <CalendarDays className="h-4 w-4 text-primary" />
                {new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: "long", month: "long", day: "numeric",
                })}
              </h3>

              {selectedEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nothing scheduled</p>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map(e => {
                    const meta = EVENT_META[e.type];
                    const Icon = meta.icon;
                    return (
                      <div key={e.id} className="rounded-lg border border-border/50 bg-background/40 p-2.5">
                        <div className="flex items-start gap-2">
                          <div className={cn("rounded-md p-1.5 shrink-0 border", meta.tone)}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={cn("text-sm font-medium leading-tight",
                              e.status === "cancelled" && "line-through text-muted-foreground")}>
                              {e.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {e.allDay
                                ? "All day"
                                : new Date(e.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                              {unitLabel(e.unitId) ? ` · ${unitLabel(e.unitId)}` : ""}
                            </p>
                            {e.notes && <p className="text-xs text-muted-foreground/80 mt-1">{e.notes}</p>}
                            <div className="flex gap-1.5 mt-2">
                              {e.status === "scheduled" && (
                                <>
                                  <Button variant="outline" size="sm" className="h-6 text-[11px] px-2"
                                    onClick={() => updateEvent(e.id, { status: "completed" })}>
                                    Done
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2"
                                    onClick={() => updateEvent(e.id, { status: "cancelled" })}>
                                    Cancel
                                  </Button>
                                </>
                              )}
                              {e.status !== "scheduled" && (
                                <Badge variant="outline" className="text-[10px]">{e.status}</Badge>
                              )}
                              <Button variant="ghost" size="sm"
                                className="h-6 text-[11px] px-2 text-red-400 hover:text-red-300"
                                onClick={() => removeEvent(e.id)}>
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm font-heading mb-3">Coming up</h3>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nothing scheduled ahead</p>
              ) : (
                <div className="space-y-2">
                  {upcoming.map(e => (
                    <button
                      key={e.id}
                      onClick={() => {
                        setSelected(e.start.slice(0, 10));
                        const d = new Date(e.start);
                        setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
                      }}
                      className="flex w-full items-center gap-2 rounded-md p-1.5 text-left hover:bg-muted/40 transition-colors"
                    >
                      <span className={cn("h-2 w-2 rounded-full shrink-0", EVENT_META[e.type].dot)} />
                      <span className="flex-1 truncate text-xs">{e.title}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {new Date(e.start).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Schedule dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Schedule an event</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => v && setForm({ ...form, type: v as CalendarEventType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_META).map(([key, meta]) => (
                      <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unit (optional)</Label>
                <Select value={form.unitId} onValueChange={v => v != null && setForm({ ...form, unitId: v })}>
                  <SelectTrigger><SelectValue placeholder="No unit" /></SelectTrigger>
                  <SelectContent>
                    {units.map(u => (
                      <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Title</Label>
              <Input placeholder="Showing — Unit 103"
                value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <Label>Time</Label>
                <Input type="time" value={form.time} disabled={form.allDay}
                  onChange={e => setForm({ ...form, time: e.target.value })} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.allDay}
                onChange={e => setForm({ ...form, allDay: e.target.checked })} />
              All day
            </label>

            <div>
              <Label>Notes</Label>
              <Textarea placeholder="Anything worth remembering..." rows={2}
                value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving}
              className="gradient-brand text-white border-0">
              {saving ? "Saving..." : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
