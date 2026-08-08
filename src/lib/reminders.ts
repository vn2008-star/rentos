import type {
  Lease, Inspection, MaintenanceRequest, KeyRecord, Unit, Tenant, Reminder,
  ReminderSeverity,
} from "./types";

// ============================================
// Reminder Engine
// ============================================
// Reminders are derived on every read rather than written to Firestore.
//
// A stored reminder needs a scheduled job to create it, another to expire it,
// and it silently goes wrong the moment the underlying record changes — a
// renewal reminder outliving the lease it referred to, an inspection reminder
// for an inspection already done. Deriving them means they are always exactly
// consistent with the data, and there is no cron to operate.

/** Whole days from today to an ISO date. Negative means overdue. */
function daysUntil(iso: string): number {
  const due = new Date(iso);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function severityFor(days: number, warnAt: number): ReminderSeverity {
  if (days < 0) return "critical";
  if (days <= warnAt) return "warning";
  return "info";
}

export interface ReminderInput {
  leases: Lease[];
  inspections: Inspection[];
  maintenance: MaintenanceRequest[];
  keys: KeyRecord[];
  units: Unit[];
  tenants: Tenant[];
}

/** How far ahead each kind of reminder starts appearing. */
const LEASE_RENEWAL_WINDOW_DAYS = 90;
const INSPECTION_WINDOW_DAYS = 14;
/** A request nobody has touched for this long needs chasing. */
const MAINTENANCE_STALE_DAYS = 7;

export function buildReminders(input: ReminderInput): Reminder[] {
  const { leases, inspections, maintenance, keys, units, tenants } = input;
  const reminders: Reminder[] = [];

  const unitLabel = (unitId?: string) => {
    const unit = units.find((u) => u.id === unitId);
    return unit ? `Unit ${unit.unitNumber}` : "Unit";
  };
  const tenantLabel = (tenantId?: string) => {
    const t = tenants.find((x) => x.id === tenantId);
    return t ? `${t.firstName} ${t.lastName}` : "Tenant";
  };

  // ----- Lease renewals and expiries -----
  for (const lease of leases) {
    if (lease.status === "terminated" || lease.status === "expired") continue;
    const days = daysUntil(lease.endDate);
    if (days > LEASE_RENEWAL_WINDOW_DAYS) continue;

    const decided = lease.renewalDecision === "accepted" || lease.renewalDecision === "declined";
    if (decided && days >= 0) continue;

    reminders.push({
      id: `lease-${lease.id}`,
      kind: days < 0 ? "lease_expiring" : "lease_renewal",
      severity: severityFor(days, 30),
      title: days < 0 ? "Lease expired" : "Lease renewal due",
      detail:
        days < 0
          ? `${unitLabel(lease.unitId)} — expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago with no renewal decision.`
          : `${unitLabel(lease.unitId)} — ends in ${days} day${days === 1 ? "" : "s"}. Offer a renewal or plan the turnover.`,
      dueDate: lease.endDate,
      daysUntilDue: days,
      href: "/leases",
      unitId: lease.unitId,
      tenantId: lease.tenantIds[0],
    });
  }

  // ----- Scheduled inspections -----
  for (const inspection of inspections) {
    if (inspection.status === "completed") continue;
    const days = daysUntil(inspection.scheduledFor);
    if (days > INSPECTION_WINDOW_DAYS) continue;

    reminders.push({
      id: `inspection-${inspection.id}`,
      kind: days < 0 ? "inspection_overdue" : "inspection_due",
      severity: severityFor(days, 3),
      title: days < 0 ? "Inspection overdue" : "Inspection scheduled",
      detail: `${inspection.type.replace(/_/g, " ")} inspection for ${unitLabel(inspection.unitId)}${
        days < 0 ? ` — ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue` : ""
      }.`,
      dueDate: inspection.scheduledFor,
      daysUntilDue: days,
      href: "/inspections",
      unitId: inspection.unitId,
      tenantId: inspection.tenantId,
    });
  }

  // ----- Maintenance nobody has picked up -----
  for (const req of maintenance) {
    if (req.status === "completed" || req.status === "closed") continue;
    const age = -daysUntil(req.createdAt);
    const threshold = req.priority === "emergency" ? 1 : req.priority === "urgent" ? 3 : MAINTENANCE_STALE_DAYS;
    if (age < threshold) continue;

    reminders.push({
      id: `maint-${req.id}`,
      kind: "maintenance_stale",
      severity: req.priority === "emergency" || req.priority === "urgent" ? "critical" : "warning",
      title: "Maintenance needs attention",
      detail: `"${req.title}" at ${unitLabel(req.unitId)} — open ${age} day${age === 1 ? "" : "s"}, still ${req.status.replace(/_/g, " ")}.`,
      dueDate: req.createdAt,
      daysUntilDue: -age,
      href: "/maintenance",
      unitId: req.unitId,
      tenantId: req.tenantId,
    });
  }

  // ----- Keys still out after a tenancy ended -----
  for (const key of keys) {
    if (key.status !== "issued" || key.holderType !== "tenant") continue;
    const lease = leases.find(
      (l) => l.unitId === key.unitId && l.tenantIds.includes(key.holderId ?? "")
    );
    if (!lease) continue;
    const days = daysUntil(lease.endDate);
    if (days >= 0) continue;

    reminders.push({
      id: `key-${key.id}`,
      kind: "key_outstanding",
      severity: "warning",
      title: "Key not returned",
      detail: `${key.label} for ${unitLabel(key.unitId)} is still with ${tenantLabel(key.holderId)}, whose lease ended ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago.`,
      dueDate: lease.endDate,
      daysUntilDue: days,
      href: `/units/${key.unitId}`,
      unitId: key.unitId,
      tenantId: key.holderId,
    });
  }

  // Most urgent first: overdue before upcoming, then by severity.
  const rank: Record<ReminderSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return reminders.sort(
    (a, b) => rank[a.severity] - rank[b.severity] || a.daysUntilDue - b.daysUntilDue
  );
}
