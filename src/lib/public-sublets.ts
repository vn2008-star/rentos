import { getAdminDb } from "./firebase-admin";
import { Collections } from "./collections";
import type { Organization, Property, Sublet, Unit } from "./types";

/**
 * The public shape of a sublet, and the one place that decides what "public"
 * means for one.
 *
 * A sublet advert is a harder privacy problem than a vacancy advert. A vacant
 * unit is nobody's home; a sublet is somebody's home, and the advert says when
 * they will not be in it. So the projection here is deliberately narrower than
 * the one in /api/public/listing/{id}:
 *
 *   - No tenant. Not the id, not the name. The subletter is a person whose
 *     absence is the subject of the advert.
 *   - No unit number. The building and its amenities are advertising; which
 *     door stands empty from June is not.
 *   - No `reason`. "Study abroad — Barcelona, Jun–Aug" reads as "this home is
 *     empty and I am on another continent".
 *   - No `guestInfo`. Once a sublet is matched, that field holds a third
 *     party's name, email and university, and they never agreed to be
 *     published.
 *   - No review trail, lease id, or application ids — internal by nature.
 *
 * Both the feed and the detail route project through this function rather than
 * building their own payloads, because the failure mode of two hand-written
 * projections is that one of them quietly keeps a field the other drops.
 */

export interface PublicSublet {
  id: string;
  orgId: string;
  title: string;
  description: string;
  photos: string[];
  monthlyRent: number;
  startDate: string;
  endDate: string;
  /** Whole months, rounded — enough to answer "does this cover my quarter?" */
  months: number;
  unit: {
    beds: number;
    baths: number;
    sqft: number;
    amenities: string[];
    photos: string[];
  } | null;
  property: {
    name: string;
    type: string;
    /** Street included: the building is what is being advertised. */
    address: { street: string; city: string; state: string; zip: string };
    amenities: string[];
  } | null;
  /** Who manages it, so a seeker knows the sublet has a landlord behind it. */
  managedBy: { name: string; slug: string } | null;
}

/**
 * True when the org has withdrawn its sublets from the public feed.
 *
 * Absent means participating, matching how `publicIntake` reads — an org that
 * never set the flag is not opting out of anything.
 */
export function subletFeedDisabled(org: Organization | null): boolean {
  return org?.settings?.subletMarketplace === false;
}

/**
 * Whether a sublet is advertisable at all.
 *
 * `active` is the only status a stranger may see: draft and pending_approval
 * have not been cleared by the landlord, rejected was refused, and completed
 * and cancelled are over. An `active` sublet whose end date has passed is stale
 * rather than available, and showing it wastes the seeker's time.
 */
export function isAdvertisable(sublet: Sublet, today: string): boolean {
  return sublet.status === "active" && sublet.endDate >= today;
}

/** Two date ranges overlap when each starts before the other ends. */
export function overlaps(
  sublet: Pick<Sublet, "startDate" | "endDate">,
  from: string | null,
  to: string | null
): boolean {
  if (to && sublet.startDate > to) return false;
  if (from && sublet.endDate < from) return false;
  return true;
}

export function projectSublet(
  id: string,
  sublet: Sublet,
  unit: Unit | null,
  property: Property | null,
  org: Organization | null
): PublicSublet {
  const start = new Date(sublet.startDate).getTime();
  const end = new Date(sublet.endDate).getTime();
  const months = Number.isFinite(start) && Number.isFinite(end)
    ? Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 30)))
    : 1;

  return {
    id,
    orgId: sublet.orgId,
    title: sublet.title,
    description: sublet.description ?? "",
    photos: sublet.photos ?? [],
    monthlyRent: sublet.monthlyRent,
    startDate: sublet.startDate,
    endDate: sublet.endDate,
    months,
    unit: unit
      ? {
          beds: unit.beds,
          baths: unit.baths,
          sqft: unit.sqft,
          amenities: unit.amenities ?? [],
          photos: unit.photos ?? [],
        }
      : null,
    property: property
      ? {
          name: property.name,
          type: property.type,
          address: property.address,
          amenities: property.amenities ?? [],
        }
      : null,
    managedBy: org ? { name: org.name, slug: org.slug ?? sublet.orgId } : null,
  };
}

/**
 * Loads the units, properties and organizations a batch of sublets refers to.
 *
 * One getAll per collection rather than three reads per sublet: a feed of two
 * hundred sublets in one building should not be six hundred document reads.
 */
export async function loadSubletContext(sublets: Sublet[]): Promise<{
  units: Map<string, Unit>;
  properties: Map<string, Property>;
  orgs: Map<string, Organization>;
}> {
  const db = await getAdminDb();

  const unitIds = [...new Set(sublets.map(s => s.unitId).filter(Boolean))];
  const propertyIds = [...new Set(sublets.map(s => s.propertyId).filter(Boolean))];
  const orgIds = [...new Set(sublets.map(s => s.orgId).filter(Boolean))];

  const read = async <T>(collection: string, ids: string[]): Promise<Map<string, T>> => {
    if (ids.length === 0) return new Map();
    const snaps = await db.getAll(
      ...ids.map(id => db.collection(collection).doc(id))
    );
    const out = new Map<string, T>();
    for (const snap of snaps) {
      if (snap.exists) out.set(snap.id, snap.data() as T);
    }
    return out;
  };

  const [units, properties, orgs] = await Promise.all([
    read<Unit>(Collections.UNITS, unitIds),
    read<Property>(Collections.PROPERTIES, propertyIds),
    read<Organization>(Collections.ORGANIZATIONS, orgIds),
  ]);

  return { units, properties, orgs };
}
