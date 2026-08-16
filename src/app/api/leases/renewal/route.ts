import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/collections";
import { jsonError, requireCaller } from "@/lib/api-auth";
import { checkRenewalResponse } from "@/lib/lease-actions";
import type { Lease } from "@/lib/types";

/**
 * POST /api/leases/renewal — a resident answers a renewal offer.
 *
 * Same reasoning as /api/leases/sign: the answer is the tenant's to give, but
 * the document is staff-writable only, so the write happens here against a
 * verified identity. The route touches renewalDecision and nothing else — a
 * tenant answering a renewal must not be a path to editing rent or dates.
 */

export async function POST(req: NextRequest) {
  const guard = await requireCaller(req);
  if (!guard.ok) return guard.response;
  const { profile } = guard.caller;

  const tenantId = profile.tenantId ?? "";
  if (profile.role !== "tenant" || !tenantId) {
    return jsonError("Only the tenant named on a lease can answer a renewal", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Expected a JSON body", 400);
  }

  const leaseId = String(body.leaseId ?? "").trim();
  const decision = body.decision;
  if (!leaseId) return jsonError("leaseId is required", 400);

  const db = await getAdminDb();
  const leaseRef = db.collection(Collections.LEASES).doc(leaseId);

  let refusal: { status: number; error: string } | null = null;
  let outcome: { leaseId: string; renewalDecision: "accepted" | "declined" } | null = null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(leaseRef);
    const lease = snap.exists ? ({ ...snap.data(), id: snap.id } as Lease) : null;

    const check = checkRenewalResponse({
      lease,
      tenantId,
      callerOrgId: profile.orgId,
      decision,
    });
    if (!check.ok) {
      refusal = { status: check.status, error: check.error };
      return;
    }

    const answer = decision as "accepted" | "declined";
    tx.update(leaseRef, {
      renewalDecision: answer,
      renewalRespondedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    outcome = { leaseId, renewalDecision: answer };
  });

  if (refusal) {
    const { status, error } = refusal as { status: number; error: string };
    return jsonError(error, status);
  }
  if (!outcome) return jsonError("The answer could not be recorded", 500);

  return NextResponse.json(outcome);
}
