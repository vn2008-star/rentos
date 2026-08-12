import type { Organization, RentalApplication, Unit } from "./types";

/**
 * Turning an approved application into a tenancy.
 *
 * The decision and the move-in are separate acts, and only the first one
 * existed: approving an application set its status and stopped there, leaving
 * the manager to hand-create a tenant, hand-create a lease, mark the unit
 * occupied and cross-link all three. Five steps of retyping per unit, and a run
 * that stops halfway leaves a tenant with no unit or a unit occupied by nobody.
 *
 * The pure parts live here so they can be tested without Firestore. The write
 * itself is a transaction in /api/applications/move-in.
 */

/** Rent that has to be a real amount of money. */
const MAX_RENT = 1_000_000;

export interface MoveInRequest {
  applicationId: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  securityDeposit: number;
}

export type MoveInRefusal =
  | { ok: false; status: number; error: string }
  | { ok: true };

const isoDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());

/**
 * A lease term for someone moving in on a given date.
 *
 * Twelve months minus a day: a lease running 1 Sep to 1 Sep overlaps itself at
 * both ends, and the renewal then looks like a double booking on the unit.
 */
export function defaultLeaseTerm(moveInDate: string): { startDate: string; endDate: string } {
  const start = isoDate(moveInDate) ? moveInDate : new Date().toISOString().slice(0, 10);
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  d.setUTCDate(d.getUTCDate() - 1);
  return { startDate: start, endDate: d.toISOString().slice(0, 10) };
}

/** The billing states the rules' subscriptionAlive() treats as still paying. */
export function subscriptionAlive(org: Organization | null): boolean {
  const status = org?.billing?.status ?? "trialing";
  return status === "trialing" || status === "active" || status === "past_due";
}

/**
 * Everything that must be true before a move-in may be written.
 *
 * Kept as one function returning the refusal rather than a pile of booleans, so
 * the route reports *why* it refused instead of a blanket 400 — a manager told
 * only "invalid request" cannot tell a lapsed subscription from a typo in a
 * date.
 */
export function checkMoveIn(input: {
  request: MoveInRequest;
  application: RentalApplication | null;
  unit: Unit | null;
  org: Organization | null;
  callerOrgId: string;
}): MoveInRefusal {
  const { request, application, unit, org, callerOrgId } = input;

  if (!application) return { ok: false, status: 404, error: "Application not found" };
  // Another org's application is not merely forbidden, it should not be
  // discoverable — 404 rather than 403.
  if (application.orgId !== callerOrgId) {
    return { ok: false, status: 404, error: "Application not found" };
  }
  if (application.status !== "approved") {
    return { ok: false, status: 409, error: "Approve the application before moving anyone in" };
  }
  if (application.leaseId || application.tenantId) {
    return { ok: false, status: 409, error: "This application already has a tenancy" };
  }

  if (!unit) return { ok: false, status: 404, error: "The unit on this application no longer exists" };
  if (unit.orgId !== callerOrgId) {
    return { ok: false, status: 404, error: "The unit on this application no longer exists" };
  }
  if (unit.status === "occupied") {
    return { ok: false, status: 409, error: "That unit is already occupied" };
  }

  // The Admin SDK bypasses the rules, so the gate canProvision() would have
  // applied to a lease written from the browser has to be applied here too.
  // Without this the route is a way to keep provisioning on a dead subscription.
  if (!subscriptionAlive(org)) {
    return { ok: false, status: 402, error: "This organization's subscription is not active" };
  }

  if (!isoDate(request.startDate) || !isoDate(request.endDate)) {
    return { ok: false, status: 400, error: "Start and end dates must be YYYY-MM-DD" };
  }
  if (request.endDate <= request.startDate) {
    return { ok: false, status: 400, error: "The lease must end after it starts" };
  }

  for (const [label, value] of [
    ["Rent", request.rentAmount],
    ["The security deposit", request.securityDeposit],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > MAX_RENT) {
      return { ok: false, status: 400, error: `${label} must be a number between 0 and ${MAX_RENT}` };
    }
  }

  return { ok: true };
}
