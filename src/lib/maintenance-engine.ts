import type { MaintenanceRequest, WorkOrder, Vendor, Tenant, MaintenanceStatus } from "./types";

// ============================================
// Maintenance Engine — Utility Functions
// ============================================

export interface TimelineEvent {
  id: string;
  timestamp: string;
  label: string;
  description: string;
  actor: string;
  type: "submitted" | "reviewed" | "assigned" | "accepted" | "started" | "completed" | "approved" | "resolved" | "info";
}

// Status steps for the visual stepper
export const STATUS_STEPS = [
  { key: "submitted", label: "Submitted", description: "Request received" },
  { key: "acknowledged", label: "Reviewed", description: "Manager reviewed" },
  { key: "assigned", label: "Assigned", description: "Repairman assigned" },
  { key: "in_progress", label: "In Progress", description: "Work underway" },
  { key: "completed", label: "Completed", description: "Work done — pending approval" },
  { key: "closed", label: "Resolved", description: "Resolved & closed" },
] as const;

const STATUS_STEP_MAP: Record<string, number> = {
  submitted: 0,
  acknowledged: 1,
  assigned: 2,
  in_progress: 3,
  completed: 4,
  pending_approval: 4, // same visual step as completed
  closed: 5,
};

/**
 * Returns the current step index (0-5) for the status stepper UI.
 */
export function getStatusStep(request: MaintenanceRequest): number {
  if (request.resolvedAt) return 5;
  return STATUS_STEP_MAP[request.status] ?? 0;
}

/**
 * Returns display name for whoever reported this request.
 */
export function getReporterLabel(request: MaintenanceRequest, tenants: Tenant[]): string {
  if (request.reporter?.name) return request.reporter.name;
  if (request.tenantId) {
    const tenant = tenants.find(t => t.id === request.tenantId);
    if (tenant) return `${tenant.firstName} ${tenant.lastName}`;
  }
  return "Unknown";
}

/**
 * Returns a reporter type badge label.
 */
export function getReporterBadge(request: MaintenanceRequest): { label: string; color: string } {
  const type = request.reporter?.type || (request.tenantId ? "tenant" : "external");
  switch (type) {
    case "tenant": return { label: "Tenant", color: "text-blue-400 border-blue-500/30 bg-blue-500/10" };
    case "manager": return { label: "Manager", color: "text-violet-400 border-violet-500/30 bg-violet-500/10" };
    case "external": return { label: "External", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" };
    default: return { label: "Unknown", color: "text-gray-400 border-gray-500/30 bg-gray-500/10" };
  }
}

/**
 * Builds a chronological timeline from request + work order data.
 */
export function buildTimeline(
  request: MaintenanceRequest,
  workOrder?: WorkOrder,
  vendor?: Vendor
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const reporterName = request.reporter?.name || "Reporter";

  // 1. Request submitted
  events.push({
    id: "submitted",
    timestamp: request.createdAt,
    label: "Request Submitted",
    description: `${reporterName} reported: "${request.title}"`,
    actor: reporterName,
    type: "submitted",
  });

  // 2. Acknowledged/reviewed
  if (["acknowledged", "assigned", "in_progress", "completed", "closed"].includes(request.status) || request.resolvedAt) {
    events.push({
      id: "reviewed",
      timestamp: request.updatedAt > request.createdAt ? request.updatedAt : request.createdAt,
      label: "Reviewed by Manager",
      description: "Property manager reviewed the request",
      actor: "Property Manager",
      type: "reviewed",
    });
  }

  // 3. Vendor assigned
  if (request.assignedVendorId && workOrder) {
    events.push({
      id: "assigned",
      timestamp: workOrder.createdAt,
      label: "Repairman Assigned",
      description: vendor ? `Assigned to ${vendor.name}${vendor.company ? ` (${vendor.company})` : ""}` : "Vendor assigned",
      actor: "Property Manager",
      type: "assigned",
    });
  }

  // 4. Work order accepted
  if (workOrder?.acceptedAt) {
    events.push({
      id: "accepted",
      timestamp: workOrder.acceptedAt,
      label: "Job Accepted",
      description: vendor ? `${vendor.name} accepted the work order` : "Vendor accepted the job",
      actor: vendor?.name || "Vendor",
      type: "accepted",
    });
  }

  // 5. Work started
  if (workOrder?.startedAt) {
    events.push({
      id: "started",
      timestamp: workOrder.startedAt,
      label: "Work Started",
      description: "Repairman started the repair work",
      actor: vendor?.name || "Vendor",
      type: "started",
    });
  }

  // 6. Work completed + costs submitted
  if (workOrder?.completedAt) {
    const costStr = workOrder.totalCost ? ` — Total: $${workOrder.totalCost.toLocaleString()}` : "";
    events.push({
      id: "completed",
      timestamp: workOrder.completedAt,
      label: "Work Completed",
      description: `Repair completed and submitted for approval${costStr}`,
      actor: vendor?.name || "Vendor",
      type: "completed",
    });
  }

  // 7. Manager approved
  if (workOrder?.approvedAt) {
    events.push({
      id: "approved",
      timestamp: workOrder.approvedAt,
      label: "Cost Approved",
      description: workOrder.managerApproval?.notes || "Manager approved the work and costs",
      actor: "Property Manager",
      type: "approved",
    });
  }

  // 8. Resolved & closed
  if (request.resolvedAt) {
    events.push({
      id: "resolved",
      timestamp: request.resolvedAt,
      label: "Resolved & Closed",
      description: request.resolutionNotes || "Request has been resolved and closed",
      actor: "Property Manager",
      type: "resolved",
    });
  }

  // Sort by timestamp
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return events;
}

/**
 * Human-readable time-ago string.
 */
export function formatTimeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  return new Date(dateString).toLocaleDateString();
}

/**
 * Kanban column definitions for the manager board.
 */
export const KANBAN_COLUMNS: { key: MaintenanceStatus | "pending_approval"; label: string; color: string }[] = [
  { key: "submitted", label: "New", color: "border-amber-500/40" },
  { key: "acknowledged", label: "Reviewed", color: "border-blue-500/40" },
  { key: "assigned", label: "Assigned", color: "border-violet-500/40" },
  { key: "in_progress", label: "In Progress", color: "border-cyan-500/40" },
  { key: "completed", label: "Approval", color: "border-amber-500/40" },
  { key: "closed", label: "Resolved", color: "border-emerald-500/40" },
];
