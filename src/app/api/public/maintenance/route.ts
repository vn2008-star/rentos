import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/firestore";
import { belongsToOrg, intakeDisabled, resolvePublicOrg, text } from "@/lib/public-intake";
import { notifyOrg } from "@/lib/server-notify";
import type { MaintenanceCategory, MaintenancePriority } from "@/lib/types";

/**
 * POST /api/public/maintenance — a repair report from someone with no account.
 *
 * A tenant whose landlord never set them up, or a passer-by who can see water
 * coming out of a wall, has to be able to tell somebody. That is worth an
 * unauthenticated endpoint, but not an unvalidated one: this route resolves the
 * organization itself and refuses any property or unit that does not belong to
 * it, so a submission cannot be attached to a portfolio it has nothing to do
 * with.
 *
 * Replaces the previous arrangement, where the browser wrote the document
 * directly and the security rules could check little more than "the org exists".
 */

const CATEGORIES: MaintenanceCategory[] = [
  "plumbing", "electrical", "hvac", "appliance", "structural",
  "pest", "cleaning", "landscaping", "other",
];

const PRIORITIES: MaintenancePriority[] = ["emergency", "urgent", "routine", "scheduled"];

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const found = await resolvePublicOrg(String(body.org ?? body.orgId ?? ""));
  if (!found) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  if (intakeDisabled(found.org)) {
    return NextResponse.json(
      { error: "This organization is not accepting public repair requests" },
      { status: 403 }
    );
  }

  const title = text(body.title, { max: 200, required: true });
  if (!title) return NextResponse.json({ error: "A title is required" }, { status: 400 });

  const reporterName = text(body.name, { max: 120, required: true });
  if (!reporterName) {
    return NextResponse.json({ error: "Your name is required" }, { status: 400 });
  }

  const propertyId = String(body.propertyId ?? "").trim();
  if (!propertyId) {
    return NextResponse.json({ error: "Choose a property" }, { status: 400 });
  }
  if (!(await belongsToOrg(Collections.PROPERTIES, propertyId, found.id))) {
    return NextResponse.json({ error: "Unknown property" }, { status: 400 });
  }

  // "general" is the common-area escape hatch offered by the form, not a unit.
  const unitId = String(body.unitId ?? "").trim() || "general";
  if (unitId !== "general" && !(await belongsToOrg(Collections.UNITS, unitId, found.id))) {
    return NextResponse.json({ error: "Unknown unit" }, { status: 400 });
  }

  const category = CATEGORIES.includes(body.category as MaintenanceCategory)
    ? (body.category as MaintenanceCategory)
    : "other";
  const priority = PRIORITIES.includes(body.priority as MaintenancePriority)
    ? (body.priority as MaintenancePriority)
    : "routine";

  const now = new Date().toISOString();
  const db = await getAdminDb();

  const ref = await db.collection(Collections.MAINTENANCE).add({
    orgId: found.id,
    propertyId,
    unitId,
    category,
    priority,
    status: "submitted",
    title,
    description: text(body.description, { max: 5000 }) ?? "",
    photos: [],
    completionPhotos: [],
    reporter: {
      type: "external",
      name: reporterName,
      phone: text(body.phone, { max: 40 }) || null,
      email: (text(body.email, { max: 200 }) || "").toLowerCase() || null,
    },
    createdAt: now,
    updatedAt: now,
  });

  const urgent = priority === "emergency" || priority === "urgent";
  await notifyOrg({
    orgId: found.id,
    kind: urgent ? "maintenance_urgent" : "maintenance_reported",
    audience: "manager",
    title: urgent ? `${priority === "emergency" ? "Emergency" : "Urgent"} repair reported` : "Repair reported",
    body: `${reporterName} reported: ${title}`,
    href: "/maintenance",
  });

  console.log(`[public/maintenance] ${found.id} received "${title}" (${priority})`);

  return NextResponse.json({ id: ref.id, reference: ref.id }, { status: 201 });
}
