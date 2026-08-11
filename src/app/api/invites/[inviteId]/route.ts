import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/firestore";
import type { OrgInvite } from "@/lib/types";

/**
 * GET /api/invites/{token} — what an invitation says, for the accept screen.
 *
 * Deliberately unauthenticated: the person following the link has not joined the
 * organization yet, so the security rules (which let only org staff read
 * invites) cannot help them, and they need to know which account to sign in
 * with before they can sign in at all.
 *
 * Only the token holder can ask, and everything returned was already in the
 * message they received. Nothing here grants access — accepting is a separate,
 * authenticated call that re-checks all of it.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ inviteId: string }> }
) {
  const { inviteId } = await ctx.params;

  const db = await getAdminDb();
  const snap = await db.collection(Collections.INVITES).doc(inviteId).get();

  if (!snap.exists) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  const invite = snap.data() as OrgInvite;
  const expired = new Date(invite.expiresAt).getTime() < Date.now();

  return NextResponse.json({
    orgName: invite.orgName,
    email: invite.email,
    role: invite.role,
    invitedByName: invite.invitedByName,
    status: expired && invite.status === "pending" ? "expired" : invite.status,
    expiresAt: invite.expiresAt,
  });
}
