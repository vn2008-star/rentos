import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/collections";
import { belongsToOrg, intakeDisabled, resolvePublicOrg, text } from "@/lib/public-intake";
import { notifyOrg } from "@/lib/server-notify";
import type { Unit } from "@/lib/types";

/**
 * POST /api/public/apply — a rental application from a prospective tenant.
 *
 * Applications arrive from people who by definition have no account, so this is
 * unauthenticated. Everything else is checked here rather than trusted: the
 * organization is resolved from its slug, and the unit must belong to it.
 *
 * The public listing page used to "submit" applications with a 1.5s timer and a
 * success toast, saving nothing anywhere. This is what actually files them.
 */

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
      { error: "This organization is not accepting applications" },
      { status: 403 }
    );
  }

  const firstName = text(body.firstName, { max: 80, required: true });
  const lastName = text(body.lastName, { max: 80, required: true });
  const email = (text(body.email, { max: 200, required: true }) ?? "").toLowerCase();

  if (!firstName || !lastName || !email) {
    return NextResponse.json(
      { error: "Name and email address are required" },
      { status: 400 }
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const unitId = String(body.unitId ?? "").trim();
  if (!unitId || !(await belongsToOrg(Collections.UNITS, unitId, found.id))) {
    return NextResponse.json({ error: "Choose a unit to apply for" }, { status: 400 });
  }

  const db = await getAdminDb();
  const unitSnap = await db.collection(Collections.UNITS).doc(unitId).get();
  const unit = unitSnap.data() as Unit;

  // Income arrives as free text from a form; a NaN here would poison the
  // screening arithmetic downstream.
  const incomeRaw = Number(String(body.income ?? "").replace(/[^0-9.]/g, ""));
  const income = Number.isFinite(incomeRaw) && incomeRaw > 0 ? incomeRaw : 0;

  const now = new Date().toISOString();
  const ref = await db.collection(Collections.APPLICATIONS).add({
    orgId: found.id,
    unitId,
    propertyId: unit.propertyId,
    status: "submitted",
    applicant: {
      firstName,
      lastName,
      email,
      phone: text(body.phone, { max: 40 }) ?? "",
      currentAddress: text(body.currentAddress, { max: 300 }) ?? "",
      employer: text(body.employer, { max: 200 }) ?? "",
      income,
      moveInDate: text(body.moveInDate, { max: 40 }) ?? "",
    },
    references: [],
    notes: text(body.message, { max: 2000 }) ?? "",
    createdAt: now,
    updatedAt: now,
  });

  await notifyOrg({
    orgId: found.id,
    kind: "application_received",
    audience: "manager",
    title: "New rental application",
    body: `${firstName} ${lastName} applied for unit ${unit.unitNumber}.`,
    href: "/applications",
  });

  console.log(`[public/apply] ${found.id} received an application for ${unitId}`);

  return NextResponse.json({ id: ref.id }, { status: 201 });
}
