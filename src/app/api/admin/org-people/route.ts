import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin, jsonError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/collections";

/**
 * GET /api/admin/org-people?orgId=… — who an operator could look through.
 *
 * Choosing a tenant to impersonate needs a list of that organization's tenants,
 * which an operator without a live session cannot read — by design. So this is
 * served with the Admin SDK behind the operator role check, and returns names
 * and ids only: enough to pick from a dropdown, and nothing more. Contact
 * details, leases and balances stay behind the session that has to be opened
 * for a stated reason.
 *
 * Non-operators get a 404 rather than a 403; the endpoint's existence is not
 * something a customer needs confirmed.
 */

const MAX_PEOPLE = 300;

export async function GET(req: NextRequest) {
  const guard = await requireSuperAdmin(req);
  if (!guard.ok) return guard.response;

  const orgId = req.nextUrl.searchParams.get("orgId")?.trim();
  if (!orgId) return jsonError("Missing organization", 400);

  const db = await getAdminDb();
  const [tenantSnap, vendorSnap] = await Promise.all([
    db.collection(Collections.TENANTS).where("orgId", "==", orgId).limit(MAX_PEOPLE).get(),
    db.collection(Collections.VENDORS).where("orgId", "==", orgId).limit(MAX_PEOPLE).get(),
  ]);

  const tenants = tenantSnap.docs
    .map((d) => {
      const t = d.data();
      return {
        id: d.id,
        name: `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || t.email || d.id,
        /** Whether they have ever signed in — a portal complaint often ends here. */
        hasLogin: Boolean(t.userId),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const vendors = vendorSnap.docs
    .map((d) => {
      const v = d.data();
      return {
        id: d.id,
        name: v.name || v.company || d.id,
        hasLogin: false,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ tenants, vendors });
}
