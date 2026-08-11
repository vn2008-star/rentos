import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin, jsonError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/collections";
import type { Feedback, FeedbackStatus } from "@/lib/types";

/**
 * Feedback triage for RentOS operators.
 *
 *   GET  — everything customers have sent, newest first, with counts by status
 *   POST — reply to one and move it along
 *
 * Cross-organization by nature, so it runs on the Admin SDK behind the operator
 * role check rather than through a widened security rule. Replies are written
 * here and nowhere else: the rules refuse every client write to status and
 * adminNotes, so a submitter cannot answer their own report in our voice.
 */

const STATUSES: FeedbackStatus[] = [
  "new", "reviewed", "planned", "done", "dismissed",
];

const MAX_ITEMS = 200;

export async function GET(req: NextRequest) {
  const guard = await requireSuperAdmin(req);
  if (!guard.ok) return guard.response;

  const db = await getAdminDb();
  const snap = await db.collection(Collections.FEEDBACK).limit(MAX_ITEMS).get();

  const items = snap.docs
    .map((d) => ({ ...d.data(), id: d.id }) as Feedback)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  // Names are looked up here rather than stored on each report, so an
  // organization that renames itself does not leave a trail of old names.
  const orgIds = [...new Set(items.map((f) => f.orgId).filter(Boolean))];
  const orgNames = new Map<string, string>();
  await Promise.all(
    orgIds.map(async (id) => {
      const org = await db.collection(Collections.ORGANIZATIONS).doc(id).get();
      if (org.exists) orgNames.set(id, (org.data()?.name as string) ?? id);
    })
  );

  const counts = STATUSES.reduce(
    (acc, s) => ({ ...acc, [s]: items.filter((f) => f.status === s).length }),
    { all: items.length } as Record<string, number>
  );

  return NextResponse.json({
    feedback: items.map((f) => ({ ...f, orgName: orgNames.get(f.orgId) ?? f.orgId })),
    counts,
    truncated: snap.size === MAX_ITEMS,
  });
}

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

  const id = String(body.id ?? "").trim();
  if (!id) return jsonError("Missing feedback id", 400);

  const status = String(body.status ?? "") as FeedbackStatus;
  if (!STATUSES.includes(status)) return jsonError("Unknown status", 400);

  const reply = String(body.adminNotes ?? "").trim();

  const db = await getAdminDb();
  const ref = db.collection(Collections.FEEDBACK).doc(id);
  if (!(await ref.get()).exists) return jsonError("Feedback not found", 404);

  await ref.update({
    status,
    // Only overwrite the reply when one was actually typed; changing a status
    // should not silently erase what was already said.
    ...(reply ? { adminNotes: reply.slice(0, 4000) } : {}),
    reviewedAt: new Date().toISOString(),
  });

  console.log(`[feedback] ${caller.email} set ${id} to ${status}${reply ? " with a reply" : ""}`);

  return NextResponse.json({ id, status });
}
