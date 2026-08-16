import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/collections";
import { jsonError, requireCaller } from "@/lib/api-auth";
import {
  checkTenantSignature,
  signingActivatesLease,
  unitOccupancyForLease,
} from "@/lib/lease-actions";
import type { Lease } from "@/lib/types";

/**
 * POST /api/leases/sign — a resident signs their own lease.
 *
 * Lease writes belong to staff (see firestore.rules), and rightly so: rent,
 * term and dates are not a tenant's to edit. But a signature is theirs alone,
 * so it has to be written by a route that can prove who is asking. The caller is
 * identified from their ID token, never from the body — a leaseId and tenantId
 * in JSON is the browser telling us whose lease it is signing.
 *
 * The transaction is what stops a half-signed tenancy: a lease marked active
 * over a unit still advertised as available is a vacancy the org lets twice.
 */

export async function POST(req: NextRequest) {
  const guard = await requireCaller(req);
  if (!guard.ok) return guard.response;
  const { profile } = guard.caller;

  // Only a linked resident account can sign as a tenant. Staff sign from
  // /leases, where the rules already allow the write.
  const tenantId = profile.tenantId ?? "";
  if (profile.role !== "tenant" || !tenantId) {
    return jsonError("Only the tenant named on a lease can sign it here", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Expected a JSON body", 400);
  }

  const leaseId = String(body.leaseId ?? "").trim();
  const signatureUrl = String(body.signatureUrl ?? "");
  if (!leaseId) return jsonError("leaseId is required", 400);

  const db = await getAdminDb();
  const leaseRef = db.collection(Collections.LEASES).doc(leaseId);

  let refusal: { status: number; error: string } | null = null;
  let outcome: { leaseId: string; status: Lease["status"]; activated: boolean } | null = null;

  await db.runTransaction(async (tx) => {
    const leaseSnap = await tx.get(leaseRef);
    const lease = leaseSnap.exists
      ? ({ ...leaseSnap.data(), id: leaseSnap.id } as Lease)
      : null;

    const check = checkTenantSignature({
      lease,
      tenantId,
      callerOrgId: profile.orgId,
      signatureUrl,
    });
    if (!check.ok) {
      refusal = { status: check.status, error: check.error };
      return;
    }

    const theLease = lease as Lease;
    const now = new Date().toISOString();
    const activates = signingActivatesLease(theLease, tenantId);

    // The unit is only knowable once the lease has been read, and Firestore
    // requires every read in a transaction to precede every write.
    const unitRef =
      activates && theLease.unitId
        ? db.collection(Collections.UNITS).doc(theLease.unitId)
        : null;
    const unitSnap = unitRef ? await tx.get(unitRef) : null;

    tx.update(leaseRef, {
      signatures: [
        ...theLease.signatures,
        { tenantId, signedAt: now, signatureUrl },
      ],
      ...(activates ? { status: "active" } : {}),
      updatedAt: now,
    });

    if (activates) {
      // Everything the org's occupancy figures and the add-tenant dialog read
      // to decide whether this unit is free.
      if (unitRef && unitSnap?.exists && unitSnap.data()?.orgId === profile.orgId) {
        tx.update(unitRef, unitOccupancyForLease(theLease, now));
      }
      for (const id of theLease.tenantIds) {
        tx.update(db.collection(Collections.TENANTS).doc(id), {
          leaseId: theLease.id,
          unitId: theLease.unitId,
          propertyId: theLease.propertyId,
          updatedAt: now,
        });
      }
    }

    outcome = {
      leaseId: theLease.id,
      status: activates ? "active" : theLease.status,
      activated: activates,
    };
  });

  if (refusal) {
    const { status, error } = refusal as { status: number; error: string };
    return jsonError(error, status);
  }
  if (!outcome) return jsonError("The signature could not be recorded", 500);

  return NextResponse.json(outcome);
}
