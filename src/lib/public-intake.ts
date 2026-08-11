import { getAdminDb } from "./firebase-admin";
import { Collections } from "./collections";
import type { Organization } from "./types";

/**
 * Shared plumbing for the unauthenticated intake routes.
 *
 * Everything a stranger can submit — a repair report, a rental application —
 * has to name an organization, and the only safe way to accept that name is to
 * resolve it here and then validate that every other id in the payload belongs
 * to the same organization. Otherwise "orgId" in a request body is just a field
 * anyone can set to anyone else's.
 */

export interface ResolvedOrg {
  id: string;
  org: Organization;
}

/**
 * Finds an organization by document id or by slug.
 *
 * Both are accepted because the seeded organization's id (`org-1`) and slug
 * (`davis-housing-services`) differ, while organizations founded through
 * onboarding use the slug as their id.
 */
export async function resolvePublicOrg(
  idOrSlug: string
): Promise<ResolvedOrg | null> {
  const key = (idOrSlug ?? "").trim();
  if (!key) return null;

  const db = await getAdminDb();

  const byId = await db.collection(Collections.ORGANIZATIONS).doc(key).get();
  if (byId.exists) return { id: byId.id, org: byId.data() as Organization };

  const bySlug = await db
    .collection(Collections.ORGANIZATIONS)
    .where("slug", "==", key)
    .limit(1)
    .get();
  if (!bySlug.empty) {
    return { id: bySlug.docs[0].id, org: bySlug.docs[0].data() as Organization };
  }

  return null;
}

/** True when the org has switched its public repair/application pages off. */
export function intakeDisabled(org: Organization): boolean {
  return org.settings?.publicIntake === false;
}

/**
 * Confirms a document exists and belongs to the given organization.
 *
 * This is the check that stops a submitted form from attaching itself to
 * another landlord's building.
 */
export async function belongsToOrg(
  collection: string,
  docId: string,
  orgId: string
): Promise<boolean> {
  const db = await getAdminDb();
  const snap = await db.collection(collection).doc(docId).get();
  return snap.exists && snap.data()?.orgId === orgId;
}

/** Trims and caps a free-text field, returning null when it is required and empty. */
export function text(
  value: unknown,
  { max, required = false }: { max: number; required?: boolean }
): string | null {
  const str = String(value ?? "").trim();
  if (!str) return required ? null : "";
  return str.slice(0, max);
}
