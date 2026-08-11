import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin, jsonError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/collections";
import type { Organization } from "@/lib/types";

/**
 * Support access to one customer's organization.
 *
 *   POST   — open a session ("View as")
 *   DELETE — end it
 *
 * The alternative was letting super_admin read and write every organization
 * unconditionally. That would mean one stolen operator session exposes every
 * customer on the platform, with nothing recording that it happened. Here,
 * access is one organization at a time, for a stated reason, read-only unless
 * editing was asked for, and expiring on its own.
 *
 * The document this writes IS the grant — firestore.rules reads it directly —
 * so DELETE genuinely revokes access rather than hiding a button. Every open
 * and close also appends to support_audit, which no client can read or write.
 *
 * What this deliberately does not do is hide the access from the customer. An
 * operator's writes land under their own uid, and the session is a record with
 * their name on it.
 */

const DEFAULT_MINUTES = 30;
const MAX_MINUTES = 120;

export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin(req);
  if (!guard.ok) return guard.response;
  const { caller } = guard;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Expected a JSON body", 400);
  }

  const orgId = String(body.orgId ?? "").trim();
  if (!orgId) return jsonError("Missing organization", 400);

  // A reason is required, not optional. An audit trail of "someone opened this
  // customer's records at 3am" with no why is barely better than none.
  const reason = String(body.reason ?? "").trim();
  if (reason.length < 4) {
    return jsonError("Give a reason — it goes in the access log", 400);
  }

  if (orgId === caller.profile.orgId) {
    return jsonError("That is your own organization", 400);
  }

  const minutes = Math.min(
    MAX_MINUTES,
    Math.max(5, Number(body.minutes) || DEFAULT_MINUTES)
  );

  const db = await getAdminDb();
  const orgSnap = await db.collection(Collections.ORGANIZATIONS).doc(orgId).get();
  if (!orgSnap.exists) return jsonError("Organization not found", 404);

  const org = orgSnap.data() as Organization;

  // Optionally look through one person's eyes rather than the customer's staff.
  const viewAsRole =
    body.viewAsRole === "tenant" || body.viewAsRole === "contractor"
      ? body.viewAsRole
      : null;
  const subjectId = String(body.viewAsSubjectId ?? "").trim();
  let subjectName = "";

  if (viewAsRole) {
    if (!subjectId) {
      return jsonError(`Choose which ${viewAsRole} to view as`, 400);
    }
    const collection =
      viewAsRole === "tenant" ? Collections.TENANTS : Collections.VENDORS;
    const subject = await db.collection(collection).doc(subjectId).get();

    // The subject has to belong to the organization the session is for, or a
    // session opened against one customer would look through a person in another.
    if (!subject.exists || subject.data()?.orgId !== orgId) {
      return jsonError(`That ${viewAsRole} is not in this organization`, 400);
    }

    const d = subject.data() ?? {};
    subjectName =
      viewAsRole === "tenant"
        ? `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || d.email || subjectId
        : d.name || d.company || subjectId;
  }

  // Impersonation is always read-only. A record written while looking through
  // somebody's eyes would carry their name for something they did not do; an
  // operator fixing something does it in the staff view, under their own uid.
  const writeEnabled = viewAsRole ? false : body.writeEnabled === true;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + minutes * 60 * 1000);

  const session = {
    adminUid: caller.uid,
    adminEmail: caller.email,
    orgId,
    orgName: org.name ?? orgId,
    reason: reason.slice(0, 300),
    writeEnabled,
    viewAsRole,
    viewAsSubjectId: viewAsRole ? subjectId : null,
    viewAsSubjectName: viewAsRole ? subjectName : null,
    startedAt: now.toISOString(),
    // A real Timestamp, because the rules compare it against request.time.
    // An ISO string here would make every expiry check silently false.
    expiresAt,
  };

  // One session per operator: opening a second replaces the first, so access
  // cannot quietly accumulate across organizations.
  await db.collection(Collections.SUPPORT_SESSIONS).doc(caller.uid).set(session);

  await db.collection(Collections.SUPPORT_AUDIT).add({
    event: "opened",
    ...session,
    expiresAt: expiresAt.toISOString(),
    at: now.toISOString(),
  });

  console.log(
    `[support] ${caller.email} opened ${writeEnabled ? "read-write" : "read-only"} access to ${orgId}` +
      (viewAsRole ? ` as ${viewAsRole} ${subjectId}` : "") +
      ` for ${minutes}m — ${reason}`
  );

  return NextResponse.json({
    session: { ...session, expiresAt: expiresAt.toISOString() },
  });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireSuperAdmin(req);
  if (!guard.ok) return guard.response;
  const { caller } = guard;

  const db = await getAdminDb();
  const ref = db.collection(Collections.SUPPORT_SESSIONS).doc(caller.uid);
  const snap = await ref.get();

  if (snap.exists) {
    const session = snap.data() ?? {};
    await ref.delete();
    await db.collection(Collections.SUPPORT_AUDIT).add({
      event: "closed",
      adminUid: caller.uid,
      adminEmail: caller.email,
      orgId: session.orgId ?? null,
      orgName: session.orgName ?? null,
      reason: session.reason ?? null,
      writeEnabled: session.writeEnabled ?? false,
      at: new Date().toISOString(),
    });
    console.log(`[support] ${caller.email} closed access to ${session.orgId}`);
  }

  return NextResponse.json({ ended: true });
}
