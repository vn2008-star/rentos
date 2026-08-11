import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/firestore";
import type { Listing, Organization, Property, Unit } from "@/lib/types";

/**
 * GET /api/public/listing/{id} — everything a vacancy page needs to render.
 *
 * Listings are world-readable, but the unit and property they describe are not:
 * the rules keep the portfolio staff-only, so a browser cannot fetch the beds,
 * baths or street address the advert is about. This route joins the three
 * server-side and returns only the advertised facts.
 *
 * Leads and syndication history stay behind — they are the landlord's sales
 * pipeline, not part of the advert.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const db = await getAdminDb();
  const snap = await db.collection(Collections.LISTINGS).doc(id).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const listing = snap.data() as Listing;
  if (listing.status !== "active") {
    return NextResponse.json({ error: "This listing is no longer available" }, { status: 404 });
  }

  const [unitSnap, propSnap, orgSnap] = await Promise.all([
    db.collection(Collections.UNITS).doc(listing.unitId).get(),
    db.collection(Collections.PROPERTIES).doc(listing.propertyId).get(),
    db.collection(Collections.ORGANIZATIONS).doc(listing.orgId).get(),
  ]);

  const unit = unitSnap.exists ? (unitSnap.data() as Unit) : null;
  const property = propSnap.exists ? (propSnap.data() as Property) : null;
  const org = orgSnap.exists ? (orgSnap.data() as Organization) : null;

  return NextResponse.json({
    listing: {
      id: snap.id,
      orgId: listing.orgId,
      unitId: listing.unitId,
      propertyId: listing.propertyId,
      title: listing.title,
      description: listing.description,
      photos: listing.photos ?? [],
      rent: listing.rent,
      availableDate: listing.availableDate,
    },
    unit: unit
      ? {
          id: listing.unitId,
          unitNumber: unit.unitNumber,
          beds: unit.beds,
          baths: unit.baths,
          sqft: unit.sqft,
          deposit: unit.deposit,
          amenities: unit.amenities ?? [],
          photos: unit.photos ?? [],
        }
      : null,
    property: property
      ? {
          id: listing.propertyId,
          name: property.name,
          type: property.type,
          address: property.address,
          amenities: property.amenities ?? [],
          description: property.description ?? "",
          totalUnits: property.totalUnits ?? 0,
          yearBuilt: property.yearBuilt ?? null,
        }
      : null,
    org: org
      ? { id: listing.orgId, name: org.name, slug: org.slug ?? listing.orgId }
      : null,
  });
}
