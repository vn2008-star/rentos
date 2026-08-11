import { NextResponse, type NextRequest } from "next/server";
import { requireOwnerOrManager, jsonError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/firestore";
import type { OrgInvite } from "@/lib/types";

/**
 * POST /api/invites/revoke — cancels a pending invitation.
 *
 * Server-side because an invite is a credential: the rules let org staff read
 * invites (the team screen lists them) but never write them, so nobody can
 * quietly reinstate one they were not entitled to issue.
 */
export async function POST(req: NextRequest) {
  const guard = await requireOwnerOrManager(req);
  if (!guard.ok) return guard.response;
  const { caller } = guard;

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

  if (!snap.exists) return jsonError("Invitation not found", 404);

  const invite = snap.data() as OrgInvite;
  if (invite.orgId !== caller.profile.orgId) {
    // Not "forbidden" — an invite in another org is none of this caller's
    // business, including whether it exists.
    return jsonError("Invitation not found", 404);
  }
  if (invite.status !== "pending") {
    return jsonError("Only a pending invitation can be revoked", 409);
  }

  await ref.update({ status: "revoked" });
  console.log(`[invites] ${caller.email} revoked the invite for ${invite.email}`);

  return NextResponse.json({ revoked: true });
}
