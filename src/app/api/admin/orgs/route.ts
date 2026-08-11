import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/collections";
import type { Organization } from "@/lib/types";

/**
 * GET /api/admin/orgs — every organization on the platform.
 *
 * For RentOS operators supporting customers: who is on which plan, whether
 * their subscription is healthy, whether they can take rent yet, and how big
 * they are. Deliberately a server route rather than a loosened security rule —
 * cross-organization reads should require the Admin SDK and an explicit role
 * check, not a clause in firestore.rules that could be widened by accident.
 *
 * Non-operators get a 404 rather than a 403: the existence of this endpoint is
 * not something a customer needs confirmed.
 *
 * Counts only. No tenant names, leases or financial records are returned.
 */

const MAX_ORGS = 500;

export async function GET(req: NextRequest) {
  const guard = await requireSuperAdmin(req);
  if (!guard.ok) return guard.response;

  const db = await getAdminDb();
  const snap = await db.collection(Collections.ORGANIZATIONS).limit(MAX_ORGS).get();

  const orgs = await Promise.all(
    snap.docs.map(async (doc) => {
      const org = doc.data() as Organization;

      // count() aggregations, so a large portfolio does not have to be read to
      // be counted.
      const [units, tenants, staff] = await Promise.all([
        db.collection(Collections.UNITS).where("orgId", "==", doc.id).count().get(),
        db.collection(Collections.TENANTS).where("orgId", "==", doc.id).count().get(),
        db.collection(Collections.USERS).where("orgId", "==", doc.id).count().get(),
      ]);

      return {
        id: doc.id,
        name: org.name,
        slug: org.slug ?? doc.id,
        plan: org.plan ?? "starter",
        billingStatus: org.billing?.status ?? "trialing",
        trialEndsAt: org.billing?.trialEndsAt ?? null,
        currentPeriodEnd: org.billing?.currentPeriodEnd ?? null,
        payoutsReady: Boolean(org.payouts?.chargesEnabled),
        createdAt: org.createdAt ?? null,
        counts: {
          units: units.data().count,
          tenants: tenants.data().count,
          people: staff.data().count,
        },
      };
    })
  );

  orgs.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return NextResponse.json({ orgs, truncated: snap.size === MAX_ORGS });
}
