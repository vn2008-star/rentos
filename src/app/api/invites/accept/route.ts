import { NextResponse, type NextRequest } from "next/server";
import { authenticate, jsonError } from "@/lib/api-auth";
import { getAdminDb, getFieldValue } from "@/lib/firebase-admin";
import { Collections } from "@/lib/firestore";
import type { OrgInvite } from "@/lib/types";

/**
 * POST /api/invites/accept — joins the signed-in account to an organization.
 *
 * Three things have to hold, and each one is load-bearing:
 *
 *   1. The token (the invite's document id) must name a live, unexpired invite.
 *   2. The accepting account's email must match the address the invite was
 *      issued to. Without this, a forwarded link is a free staff account —
 *      invite links end up in inboxes, chat threads and screenshots.
 *   3. That email must be verified. An unverified address proves nothing: anyone
 *      could register with the invited address and claim the invite.
 */

export async function POST(req: NextRequest) {
  const caller = await authenticate(req);
  if (!caller) return jsonError("Not signed in", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Expected a JSON body", 400);
  }

  const inviteId = String(body.inviteId ?? "").trim();
  if (!inviteId) return jsonError("Missing invite", 400);

  const db = await getAdminDb();
  const ref = db.collection(Collections.INVITES).doc(inviteId);
  const snap = await ref.get();

  if (!snap.exists) return jsonError("This invitation no longer exists", 404);
  const invite = snap.data() as OrgInvite;

  if (invite.status === "accepted") {
    return jsonError("This invitation has already been used", 409);
  }
  if (invite.status !== "pending") {
    return jsonError("This invitation is no longer valid", 409);
  }
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    await ref.update({ status: "expired" });
    return jsonError("This invitation has expired — ask for a new one", 409);
  }

  if (!caller.emailVerified) {
    return jsonError(
      "Verify your email address first, then sign in again to accept",
      403
    );
  }
  if (caller.email !== invite.email.trim().toLowerCase()) {
    return jsonError(
      `This invitation was sent to ${invite.email}. Sign in with that address to accept it.`,
      403
    );
  }

  // Somebody who founded their own organization cannot join another: their
  // properties, tenants and leases would stay behind under the old orgId with
  // nobody able to reach them.
  if (caller.profile?.orgId) {
    const currentOrg = await db
      .collection(Collections.ORGANIZATIONS)
      .doc(caller.profile.orgId)
      .get();
    if (currentOrg.exists && currentOrg.data()?.ownerId === caller.uid) {
      return jsonError(
        "You already own an organization. Use a different account to accept this invitation.",
        409
      );
    }
  }

  const FieldValue = await getFieldValue();
  const now = new Date().toISOString();

  await db.collection(Collections.USERS).doc(caller.uid).set(
    {
      id: caller.uid,
      email: caller.email,
      displayName: caller.displayName,
      role: invite.role,
      orgId: invite.orgId,
      // Stale links from a previous membership must not survive the move —
      // a leftover tenantId would scope a new manager to one tenancy.
      tenantId: invite.tenantId ?? FieldValue.delete(),
      vendorId: invite.vendorId ?? FieldValue.delete(),
      updatedAt: now,
    },
    { merge: true }
  );

  // Recorded on the record too, which is how staff screens tell who has portal
  // access.
  if (invite.tenantId) {
    await db
      .collection(Collections.TENANTS)
      .doc(invite.tenantId)
      .set({ userId: caller.uid, updatedAt: now }, { merge: true });
  }

  await ref.update({
    status: "accepted",
    acceptedAt: now,
    acceptedBy: caller.uid,
  });

  console.log(`[invites] ${caller.email} joined ${invite.orgId} as ${invite.role}`);

  return NextResponse.json({
    orgId: invite.orgId,
    orgName: invite.orgName,
    role: invite.role,
    tenantId: invite.tenantId ?? null,
    vendorId: invite.vendorId ?? null,
  });
}
