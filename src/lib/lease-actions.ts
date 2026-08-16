import type { Lease } from "./types";

/**
 * What a tenant is allowed to do to their own lease.
 *
 * A lease is the one record a resident both reads and changes, and the security
 * rules give lease writes to staff only — for good reason: rent, dates and term
 * are not a tenant's to edit. So signing and answering a renewal have to happen
 * on the server, under the Admin SDK, with these checks standing in for the
 * rules that would otherwise have refused.
 *
 * Before this existed, /portal/lease wrote straight to Firestore. The write was
 * denied, the error was swallowed as "offline", local state updated anyway, and
 * the resident was told "Lease signed successfully!" over a lease that had not
 * moved. A signature nobody recorded is worse than a button that does nothing.
 *
 * The pure parts live here so they can be tested without Firestore; the writes
 * are transactions in /api/leases/sign and /api/leases/renewal.
 */

export type LeaseActionResult =
  | { ok: false; status: number; error: string }
  | { ok: true };

/**
 * A canvas signature is a PNG data URL. Capped because the whole lease document
 * shares Firestore's 1 MB limit — a lease with several signatures on it must
 * still be writable, and one oversized field would lock the record permanently.
 */
const MAX_SIGNATURE_CHARS = 250_000;

/** Statuses where adding a signature still means something. */
const SIGNABLE: Lease["status"][] = ["draft", "active", "month_to_month"];

function leaseVisibleTo(
  lease: Lease | null,
  tenantId: string,
  callerOrgId: string
): LeaseActionResult {
  // Another organization's lease is not merely forbidden, it should not be
  // discoverable — 404 rather than 403.
  if (!lease || lease.orgId !== callerOrgId) {
    return { ok: false, status: 404, error: "Lease not found" };
  }
  if (!tenantId || !lease.tenantIds.includes(tenantId)) {
    return { ok: false, status: 404, error: "Lease not found" };
  }
  return { ok: true };
}

export function checkTenantSignature(input: {
  lease: Lease | null;
  tenantId: string;
  callerOrgId: string;
  signatureUrl: string;
}): LeaseActionResult {
  const { lease, tenantId, callerOrgId, signatureUrl } = input;

  const visible = leaseVisibleTo(lease, tenantId, callerOrgId);
  if (!visible.ok) return visible;
  const theLease = lease as Lease;

  if (!SIGNABLE.includes(theLease.status)) {
    return {
      ok: false,
      status: 409,
      error: `A ${theLease.status.replace("_", " ")} lease cannot be signed`,
    };
  }
  // Signing twice would stack duplicate signatures on the same tenancy and make
  // the audit trail unreadable.
  if (theLease.signatures.some((s) => s.tenantId === tenantId)) {
    return { ok: false, status: 409, error: "You have already signed this lease" };
  }

  if (typeof signatureUrl !== "string" || !signatureUrl.startsWith("data:image/")) {
    return { ok: false, status: 400, error: "A signature image is required" };
  }
  if (signatureUrl.length > MAX_SIGNATURE_CHARS) {
    return { ok: false, status: 413, error: "That signature image is too large" };
  }

  return { ok: true };
}

export function checkRenewalResponse(input: {
  lease: Lease | null;
  tenantId: string;
  callerOrgId: string;
  decision: unknown;
}): LeaseActionResult {
  const { lease, tenantId, callerOrgId, decision } = input;

  const visible = leaseVisibleTo(lease, tenantId, callerOrgId);
  if (!visible.ok) return visible;
  const theLease = lease as Lease;

  if (decision !== "accepted" && decision !== "declined") {
    return { ok: false, status: 400, error: "Answer must be accepted or declined" };
  }
  // Answering an offer nobody made would show the manager a decision on a
  // renewal they were still deciding whether to offer.
  if (!theLease.renewalOffered) {
    return { ok: false, status: 409, error: "No renewal has been offered on this lease" };
  }
  if (theLease.renewalDecision && theLease.renewalDecision !== "pending") {
    return {
      ok: false,
      status: 409,
      error: `This renewal was already ${theLease.renewalDecision}`,
    };
  }

  return { ok: true };
}

/**
 * Signing the last outstanding signature is what makes a draft live.
 *
 * Co-tenants sign one at a time, and a lease that flipped to active on the first
 * signature would bill a tenancy the other resident had not agreed to.
 */
export function signingActivatesLease(lease: Lease, signingTenantId: string): boolean {
  if (lease.status !== "draft") return false;
  const signed = new Set(lease.signatures.map((s) => s.tenantId));
  signed.add(signingTenantId);
  return lease.tenantIds.every((id) => signed.has(id));
}

/**
 * What a lease going live means for the unit it names.
 *
 * Occupancy is not decoration: the dashboard's occupancy rate, the analytics
 * revenue figures and the rent roll all count `status == "occupied"`, and the
 * add-tenant dialog only offers units that are not. A live lease over a unit
 * still marked available is a vacancy the org will try to let twice.
 */
export function unitOccupancyForLease(
  lease: Pick<Lease, "id" | "tenantIds">,
  now: string
): { status: "occupied"; currentTenantId: string; currentLeaseId: string; updatedAt: string } {
  return {
    status: "occupied",
    currentTenantId: lease.tenantIds[0] ?? "",
    currentLeaseId: lease.id,
    updatedAt: now,
  };
}
