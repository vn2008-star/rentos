import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/collections";
import { intakeDisabled, resolvePublicOrg } from "@/lib/public-intake";
import type { Property, Unit } from "@/lib/types";

/**
 * GET /api/public/org/{slug} — the public face of one organization.
 *
 * The public intake pages (report a repair, apply for a unit) need to know
 * which properties exist before anyone has signed in. The security rules
 * deliberately keep the portfolio staff-only — a stranger has no business
 * enumerating someone's buildings and tenants — so this route reads it with the
 * Admin SDK and hands back only the fields a form needs: what the buildings are
 * called and where they are. No tenant, lease, financial or contact data.
 *
 * An organization can switch this off entirely with settings.publicIntake.
 */

const MAX_PROPERTIES = 200;
const MAX_UNITS = 500;

export interface PublicOrg {
  org: { id: string; name: string; slug: string; logo?: string };
  properties: {
    id: string;
    name: string;
    address: { street: string; city: string; state: string; zip: string };
  }[];
  units: {
    id: string;
    propertyId: string;
    unitNumber: string;
    beds: number;
    baths: number;
    rent: number;
    status: string;
    availableDate?: string;
  }[];
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;

  const found = await resolvePublicOrg(slug);
  if (!found) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  if (intakeDisabled(found.org)) {
    return NextResponse.json(
      { error: "This organization is not accepting public requests" },
      { status: 403 }
    );
  }

  const db = await getAdminDb();
  const [propSnap, unitSnap] = await Promise.all([
    db
      .collection(Collections.PROPERTIES)
      .where("orgId", "==", found.id)
      .limit(MAX_PROPERTIES)
      .get(),
    db
      .collection(Collections.UNITS)
      .where("orgId", "==", found.id)
      .limit(MAX_UNITS)
      .get(),
  ]);

  const payload: PublicOrg = {
    org: {
      id: found.id,
      name: found.org.name,
      slug: found.org.slug ?? found.id,
      ...(found.org.logo ? { logo: found.org.logo } : {}),
    },
    properties: propSnap.docs.map((d) => {
      const p = d.data() as Property;
      return {
        id: d.id,
        name: p.name,
        address: {
          street: p.address?.street ?? "",
          city: p.address?.city ?? "",
          state: p.address?.state ?? "",
          zip: p.address?.zip ?? "",
        },
      };
    }),
    units: unitSnap.docs.map((d) => {
      const u = d.data() as Unit;
      return {
        id: d.id,
        propertyId: u.propertyId,
        unitNumber: u.unitNumber,
        beds: u.beds ?? 0,
        baths: u.baths ?? 0,
        rent: u.rent ?? 0,
        status: u.status ?? "occupied",
        ...(u.availableDate ? { availableDate: u.availableDate } : {}),
      };
    }),
  };

  return NextResponse.json(payload);
}
