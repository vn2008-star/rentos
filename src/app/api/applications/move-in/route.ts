import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/collections";
import { jsonError, requireStaff } from "@/lib/api-auth";
import { checkMoveIn, type MoveInRequest } from "@/lib/move-in";
import { moveInInspectionFor } from "@/lib/inspection-templates";
import type { Lease, Organization, RentalApplication, Tenant, Unit } from "@/lib/types";

/**
 * POST /api/applications/move-in — turn an approved application into a tenancy.
 *
 * Approving an applicant used to be the end of the road: the status changed and
 * nothing else did. Actually filling the unit meant hand-creating a tenant,
 * hand-creating a lease, marking the unit occupied and cross-linking the three,
 * retyping the applicant's details on the way. For an org letting 32 units
 * before the quarter starts that is 160 manual steps, and each one is a chance
 * to leave a tenant with no unitId — which is precisely the state that leaves
 * them unable to list a sublet later.
 *
 * It runs in a transaction because a half-finished move-in is worse than none:
 * a unit marked occupied by a tenant that was never created is a vacancy the
 * org cannot see and cannot let.
 *
 * The Admin SDK bypasses security rules, so this route re-applies what they
 * would have enforced — the caller must be staff of the organization that owns
 * the application, and the organization's subscription must still be alive,
 * which is the gate canProvision() puts on writing a lease from the browser.
 */

export async function POST(req: NextRequest) {
  const guard = await requireStaff(req);
  if (!guard.ok) return guard.response;
  const callerOrgId = guard.caller.profile.orgId;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Expected a JSON body", 400);
  }

  const request: MoveInRequest = {
    applicationId: String(body.applicationId ?? "").trim(),
    startDate: String(body.startDate ?? "").trim(),
    endDate: String(body.endDate ?? "").trim(),
    rentAmount: Number(body.rentAmount),
    securityDeposit: Number(body.securityDeposit),
  };
  if (!request.applicationId) return jsonError("applicationId is required", 400);

  const db = await getAdminDb();
  const appRef = db.collection(Collections.APPLICATIONS).doc(request.applicationId);

  let refusal: { status: number; error: string } | null = null;
  let created: { tenantId: string; leaseId: string; unitId: string } | null = null;

  await db.runTransaction(async (tx) => {
    const appSnap = await tx.get(appRef);
    const application = appSnap.exists
      ? ({ ...appSnap.data(), id: appSnap.id } as RentalApplication)
      : null;

    // The unit and org are only knowable once the application has been read, so
    // the reads are staged rather than issued together. Firestore requires all
    // reads in a transaction to precede all writes, which they do.
    const unitRef = application?.unitId
      ? db.collection(Collections.UNITS).doc(application.unitId)
      : null;
    const orgRef = db.collection(Collections.ORGANIZATIONS).doc(callerOrgId);

    const [unitSnap, orgSnap] = await Promise.all([
      unitRef ? tx.get(unitRef) : Promise.resolve(null),
      tx.get(orgRef),
    ]);

    const unit = unitSnap?.exists ? ({ ...unitSnap.data(), id: unitSnap.id } as Unit) : null;
    const org = orgSnap.exists ? ({ ...orgSnap.data(), id: orgSnap.id } as Organization) : null;

    const check = checkMoveIn({ request, application, unit, org, callerOrgId });
    if (!check.ok) {
      refusal = { status: check.status, error: check.error };
      return;
    }

    // checkMoveIn has established all three exist and belong to the caller.
    const app = application as RentalApplication;
    const theUnit = unit as Unit;
    const now = new Date().toISOString();

    const tenantRef = db.collection(Collections.TENANTS).doc();
    const leaseRef = db.collection(Collections.LEASES).doc();

    const tenant: Omit<Tenant, "id"> = {
      orgId: callerOrgId,
      firstName: app.applicant.firstName,
      lastName: app.applicant.lastName,
      email: app.applicant.email,
      phone: app.applicant.phone,
      unitId: theUnit.id,
      propertyId: app.propertyId || theUnit.propertyId,
      leaseId: leaseRef.id,
      moveInDate: request.startDate,
      createdAt: now,
      updatedAt: now,
    };

    const lease: Omit<Lease, "id"> = {
      orgId: callerOrgId,
      unitId: theUnit.id,
      propertyId: app.propertyId || theUnit.propertyId,
      tenantIds: [tenantRef.id],
      // Active rather than draft: the manager pressing this has decided, and a
      // draft lease would leave the unit occupied by an inactive tenancy, which
      // the rent roll does not bill.
      status: "active",
      startDate: request.startDate,
      endDate: request.endDate,
      rentAmount: request.rentAmount,
      securityDeposit: request.securityDeposit,
      lateFeePercent: 5,
      gracePeriodDays: 5,
      autoRenew: false,
      documents: [],
      signatures: [],
      renewalOffered: false,
      createdAt: now,
      updatedAt: now,
    };

    tx.set(tenantRef, tenant);
    tx.set(leaseRef, lease);

    // The Davis walk-through, booked with the tenancy it belongs to. No
    // existence check is needed here the way there is when an existing draft is
    // signed: this lease is being created in this transaction, so nothing can
    // already point at it.
    tx.set(db.collection(Collections.INSPECTIONS).doc(), {
      ...moveInInspectionFor({
        lease: { ...lease, id: leaseRef.id },
        unit: theUnit,
        inspectorName: guard.caller.profile.displayName || "Property manager",
        now,
      }),
      createdAt: now,
      updatedAt: now,
    });
    tx.update(unitRef!, {
      status: "occupied",
      currentTenantId: tenantRef.id,
      updatedAt: now,
    });
    tx.update(appRef, {
      tenantId: tenantRef.id,
      leaseId: leaseRef.id,
      movedInAt: now,
      updatedAt: now,
    });

    created = { tenantId: tenantRef.id, leaseId: leaseRef.id, unitId: theUnit.id };
  });

  if (refusal) {
    const { status, error } = refusal as { status: number; error: string };
    return jsonError(error, status);
  }
  if (!created) return jsonError("Move-in could not be completed", 500);

  const tenancy = created as { tenantId: string; leaseId: string; unitId: string };

  // Outside the transaction: an advert for a unit that now has a tenant in it
  // is only misleading, so it must not be able to fail the move-in itself.
  try {
    const stale = await db
      .collection(Collections.LISTINGS)
      .where("orgId", "==", callerOrgId)
      .where("unitId", "==", tenancy.unitId)
      .where("status", "==", "active")
      .get();
    await Promise.all(
      stale.docs.map((d) =>
        d.ref.update({ status: "filled", updatedAt: new Date().toISOString() })
      )
    );
  } catch (err) {
    console.warn("[move-in] could not retire listings for the filled unit:", err);
  }

  return NextResponse.json(tenancy, { status: 201 });
}
