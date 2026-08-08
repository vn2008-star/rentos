"use client";

import React from "react";
import Link from "next/link";
import {
  BellRing, FileSignature, ClipboardCheck, Wrench, KeyRound, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useReminders } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { ReminderKind, ReminderSeverity } from "@/lib/types";

const KIND_ICON: Record<ReminderKind, React.ComponentType<{ className?: string }>> = {
  lease_renewal: FileSignature,
  lease_expiring: FileSignature,
  inspection_due: ClipboardCheck,
  inspection_overdue: ClipboardCheck,
  maintenance_stale: Wrench,
  key_outstanding: KeyRound,
  rent_overdue: AlertTriangle,
};

const SEVERITY_TONE: Record<ReminderSeverity, string> = {
  critical: "text-red-400 bg-red-500/15 border-red-500/30",
  warning: "text-amber-400 bg-amber-500/15 border-amber-500/30",
  info: "text-blue-400 bg-blue-500/15 border-blue-500/30",
};

/** "in 12 days" / "3 days ago" / "today" */
function dueLabel(days: number): string {
  if (days === 0) return "today";
  if (days > 0) return `in ${days} day${days === 1 ? "" : "s"}`;
  return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
}

/**
 * Pending tasks, derived from leases, inspections, maintenance and keys.
 *
 * Nothing here is stored — see src/lib/reminders.ts. A reminder therefore
 * cannot outlive the thing it refers to.
 */
export function PendingTasks({ limit = 6 }: { limit?: number }) {
  const { reminders } = useReminders();
  const shown = reminders.slice(0, limit);
  const critical = reminders.filter(r => r.severity === "critical").length;

  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm font-heading flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" /> Pending tasks
          </h3>
          {critical > 0 && (
            <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">
              {critical} urgent
            </Badge>
          )}
        </div>

        {shown.length === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-7 w-7 mx-auto text-emerald-400/60 mb-2" />
            <p className="text-sm text-muted-foreground">Nothing needs attention</p>
          </div>
        ) : (
          <div className="space-y-2">
            {shown.map(r => {
              const Icon = KIND_ICON[r.kind] ?? BellRing;
              return (
                <Link key={r.id} href={r.href}
                  className="flex items-start gap-3 rounded-lg border border-border/50 bg-background/40 p-2.5 hover:border-border transition-colors">
                  <div className={cn("rounded-md p-1.5 shrink-0 border", SEVERITY_TONE[r.severity])}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium leading-tight">{r.title}</p>
                      <span className={cn("text-[11px]",
                        r.daysUntilDue < 0 ? "text-red-400" : "text-muted-foreground")}>
                        {dueLabel(r.daysUntilDue)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.detail}</p>
                  </div>
                </Link>
              );
            })}
            {reminders.length > shown.length && (
              <p className="text-[11px] text-muted-foreground/70 text-center pt-1">
                +{reminders.length - shown.length} more
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
