import { NextResponse, type NextRequest } from "next/server";
import { requireOwnerOrManager, jsonError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/firestore";
import { appUrl, getStripe } from "@/lib/stripe-server";
import type { Organization } from "@/lib/types";

/**
 * POST /api/billing/portal — opens Stripe's own billing portal.
 *
 * Changing a card, downloading invoices and cancelling all live there rather
 * than being rebuilt here. Cancellation in particular should be as easy as
 * signing up, and Stripe's portal is one click.
 */
export async function POST(req: NextRequest) {
  const guard = await requireOwnerOrManager(req);
  if (!guard.ok) return guard.response;
  const orgId = guard.caller.profile.orgId;

  const stripe = await getStripe();
  if (!stripe) return jsonError("Billing is in demo mode", 503);

  const db = await getAdminDb();
  const orgSnap = await db.collection(Collections.ORGANIZATIONS).doc(orgId).get();
  if (!orgSnap.exists) return jsonError("Organization not found", 404);

  const org = orgSnap.data() as Organization;
  const customerId = org.billing?.stripeCustomerId;
  if (!customerId) {
    return jsonError("This organization has no subscription yet", 409);
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: appUrl("/billing"),
    });
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("[billing/portal]", err?.message);
    return jsonError(err?.message || "Could not open the billing portal", 502);
  }
}
