import { NextResponse, type NextRequest } from "next/server";
import { requireOwnerOrManager, jsonError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/firestore";
import { INVITABLE_ROLES } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

/**
 * Changing and ending someone's membership of an organization.
 *
 *   PATCH  — change a member's role
 *   DELETE — remove them from the organization
 *
 * Both write orgId/role on somebody else's profile, which the security rules
 * forbid outright from a client. Removal moves the account to a dead org id
 * rather than deleting the profile: the person keeps their login, and any
 * record that references them (a unit note's authorId, a lease signature) still
 * resolves instead of pointing at nothing.
 */

/** Where removed members land. Matches nothing, and no organization owns it. */
function tombstoneOrgId(uid: string): string {
  return `former-${uid.slice(0, 8)}`;
}

async function loadTarget(req: NextRequest) {
  const guard = await requireOwnerOrManager(req);
  if (!guard.ok) return { error: guard.response } as const;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return { error: jsonError("Expected a JSON body", 400) } as const;
  }

  const userId = String(body.userId ?? "").trim();
  if (!userId) return { error: jsonError("Missing user", 400) } as const;

  const db = await getAdminDb();
  const ref = db.collection(Collections.USERS).doc(userId);
  const snap = await ref.get();

  if (!snap.exists || snap.data()?.orgId !== guard.caller.profile.orgId) {
    return { error: jsonError("That person is not in your organization", 404) } as const;
  }

  return { caller: guard.caller, db, ref, target: snap.data() ?? {}, body } as const;
}

export async function PATCH(req: NextRequest) {
  const loaded = await loadTarget(req);
  if ("error" in loaded) return loaded.error;
  const { caller, ref, target, body, db } = loaded;

  const role = String(body.role ?? "") as UserRole;
  if (!INVITABLE_ROLES.includes(role)) {
    return jsonError(`Cannot change someone to ${role || "that role"}`, 400);
  }

  // The owner on the organization record is the account Stripe bills and the
  // one that cannot be demoted out from under itself.
  const orgSnap = await db
    .collection(Collections.ORGANIZATIONS)
    .doc(caller.profile.orgId)
    .get();
  if (orgSnap.data()?.ownerId === ref.id && role !== "owner") {
    return jsonError(
      "Transfer ownership before changing this person's role",
      409
    );
  }

  await ref.update({ role, updatedAt: new Date().toISOString() });
  console.log(
    `[members] ${caller.email} changed ${target.email} to ${role} in ${caller.profile.orgId}`
  );

  return NextResponse.json({ userId: ref.id, role });
}

export async function DELETE(req: NextRequest) {
  const loaded = await loadTarget(req);
  if ("error" in loaded) return loaded.error;
  const { caller, ref, target, db } = loaded;

  if (ref.id === caller.uid) {
    return jsonError("You cannot remove yourself", 400);
  }

  const orgSnap = await db
    .collection(Collections.ORGANIZATIONS)
    .doc(caller.profile.orgId)
    .get();
  if (orgSnap.data()?.ownerId === ref.id) {
    return jsonError("The organization owner cannot be removed", 409);
  }

  await ref.update({
    orgId: tombstoneOrgId(ref.id),
    role: "guest",
    updatedAt: new Date().toISOString(),
  });

  console.log(
    `[members] ${caller.email} removed ${target.email} from ${caller.profile.orgId}`
  );

  return NextResponse.json({ removed: true });
}
