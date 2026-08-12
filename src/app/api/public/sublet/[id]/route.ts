import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/collections";
import {
  isAdvertisable, loadSubletContext, projectSublet, subletFeedDisabled,
} from "@/lib/public-sublets";
import type { Sublet } from "@/lib/types";

/**
 * GET /api/public/sublet/{id} — one approved sublet.
 *
 * The detail behind a card in the feed. It projects through the same function
 * as /api/public/sublets, so the tenant's identity, the unit number, the reason
 * they are away and any matched guest stay out of both.
 *
 * A sublet that is not advertisable — never approved, refused, finished,
 * withdrawn, or ended — answers 404 rather than explaining which. The status of
 * someone's housing application is not public, and "pending approval" would
 * confirm both that the listing exists and that the landlord has not agreed.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const db = await getAdminDb();
  const snap = await db.collection(Collections.SUBLETS).doc(id).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Sublet not found" }, { status: 404 });
  }

  const sublet = snap.data() as Sublet;
  const today = new Date().toISOString().slice(0, 10);
  if (!isAdvertisable(sublet, today)) {
    return NextResponse.json({ error: "Sublet not found" }, { status: 404 });
  }

  const { units, properties, orgs } = await loadSubletContext([sublet]);
  const org = orgs.get(sublet.orgId) ?? null;
  if (subletFeedDisabled(org)) {
    return NextResponse.json({ error: "Sublet not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      sublet: projectSublet(
        snap.id,
        sublet,
        units.get(sublet.unitId) ?? null,
        properties.get(sublet.propertyId) ?? null,
        org
      ),
    },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } }
  );
}
