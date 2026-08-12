import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/collections";
import {
  isAdvertisable, loadSubletContext, overlaps, projectSublet,
  subletFeedDisabled, type PublicSublet,
} from "@/lib/public-sublets";
import type { Sublet } from "@/lib/types";

/**
 * GET /api/public/sublets — every approved sublet, for consumer housing sites.
 *
 * Sublets are staff-and-own-tenant only by rule, which is right: the collection
 * holds who is going away, when their home is empty, and who has enquired. But
 * a sublet nobody can find helps nobody, and the students who need a room for a
 * quarter are not RentOS users and never will be. This route is the seam — the
 * Admin SDK reads the collection, and only the advertisable facts come back.
 *
 * Deliberately a feed and not a page. RentOS stays a property-management
 * product; a consumer marketplace reads from here and presents it.
 *
 * Query parameters, all optional:
 *   from, to    ISO dates — only sublets overlapping that window
 *   maxRent     number — monthly rent ceiling
 *   minBeds     number
 *   city        case-insensitive exact match on the property's city
 *   org         restrict to one organization id
 *   limit       1–200, default 100
 */

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;
/** Guards the in-memory filtering below against an unbounded read. */
const MAX_SCAN = 1000;

export interface PublicSubletFeed {
  sublets: PublicSublet[];
  /** How many matched before the limit was applied. */
  total: number;
}

function isoDate(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function positiveNumber(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const from = isoDate(params.get("from"));
  const to = isoDate(params.get("to"));
  const maxRent = positiveNumber(params.get("maxRent"));
  const minBeds = positiveNumber(params.get("minBeds"));
  const city = params.get("city")?.trim().toLowerCase() || null;
  const org = params.get("org")?.trim() || null;

  const requested = positiveNumber(params.get("limit"));
  const limit = requested ? Math.min(Math.max(1, Math.floor(requested)), MAX_LIMIT) : DEFAULT_LIMIT;

  const db = await getAdminDb();

  // Only `status` is filtered in the query. Everything else — dates, rent,
  // beds, city — needs a field on a joined document or a range, and a composite
  // index per combination is a lot of index for a collection this size.
  let query = db
    .collection(Collections.SUBLETS)
    .where("status", "==", "active");
  if (org) query = query.where("orgId", "==", org);

  const snap = await query.limit(MAX_SCAN).get();

  const today = new Date().toISOString().slice(0, 10);
  const candidates: { id: string; sublet: Sublet }[] = [];
  for (const doc of snap.docs) {
    const sublet = doc.data() as Sublet;
    if (!isAdvertisable(sublet, today)) continue;
    if (!overlaps(sublet, from, to)) continue;
    if (maxRent !== null && sublet.monthlyRent > maxRent) continue;
    candidates.push({ id: doc.id, sublet });
  }

  const { units, properties, orgs } = await loadSubletContext(
    candidates.map(c => c.sublet)
  );

  const matched: PublicSublet[] = [];
  for (const { id, sublet } of candidates) {
    // An org that withdrew from the feed keeps its sublets to itself.
    const orgRecord = orgs.get(sublet.orgId) ?? null;
    if (subletFeedDisabled(orgRecord)) continue;

    const unit = units.get(sublet.unitId) ?? null;
    const property = properties.get(sublet.propertyId) ?? null;

    if (minBeds !== null && (unit?.beds ?? 0) < minBeds) continue;
    if (city && property?.address?.city?.trim().toLowerCase() !== city) continue;

    matched.push(projectSublet(id, sublet, unit, property, orgRecord));
  }

  // Soonest to start first: a seeker is looking for a date, not a price.
  matched.sort((a, b) => a.startDate.localeCompare(b.startDate));

  const body: PublicSubletFeed = {
    sublets: matched.slice(0, limit),
    total: matched.length,
  };

  return NextResponse.json(body, {
    // Adverts change on the order of hours, and the consumer site will call
    // this on every search. Let the edge absorb that.
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
  });
}
