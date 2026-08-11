import { NextResponse, type NextRequest } from "next/server";
import { requireOwnerOrManager, jsonError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/firestore";
import { appUrl, getStripe } from "@/lib/stripe-server";
import { PLANS, isPlanId } from "@/lib/plans";
import type { Organization } from "@/lib/types";

/**
 * POST /api/billing/checkout — starts a RentOS subscription.
 *
 * This is the org paying us, which is a different flow from a tenant paying
 * their landlord: an ordinary charge on the platform account, no Connect
 * involved. Stripe Checkout hosts the card entry.
 *
 * The resulting subscription carries orgId and plan in its metadata, which is
 * how the webhook knows whose plan to change when Stripe later reports a
 * renewal, a failed card or a cancellation.
 */
export async function POST(req: NextRequest) {
  const guard = await requireOwnerOrManager(req);
  if (!guard.ok) return guard.response;
  const { caller } = guard;
  const orgId = caller.profile.orgId;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Expected a JSON body", 400);
  }

  const planId = String(body.plan ?? "");
  if (!isPlanId(planId)) return jsonError("Unknown plan", 400);

  const plan = PLANS[planId];
  if (plan.contactSales) {
    return jsonError(
      "Enterprise is arranged directly — get in touch and we will set it up",
      400
    );
  }

  const priceId = process.env[plan.stripePriceIdEnv];
  if (!priceId) {
    // Naming the missing variable turns a dead button into a five-second fix.
    return jsonError(
      `The ${plan.name} plan has no Stripe price configured (${plan.stripePriceIdEnv})`,
      503
    );
  }

  const stripe = await getStripe();
  if (!stripe) {
    return jsonError(
      "Billing is in demo mode — set STRIPE_SECRET_KEY to take subscriptions",
      503
    );
  }

  const db = await getAdminDb();
  const orgRef = db.collection(Collections.ORGANIZATIONS).doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) return jsonError("Organization not found", 404);
  const org = orgSnap.data() as Organization;

  try {
    // One customer per organization, reused across plan changes so the billing
    // history stays in one place.
    let customerId = org.billing?.stripeCustomerId;
    if (customerId) {
      const existing = await stripe.customers.retrieve(customerId).catch(() => null);
      if (!existing || (existing as { deleted?: boolean }).deleted) customerId = undefined;
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: caller.email,
        name: org.name,
        metadata: { orgId },
      });
      customerId = customer.id;
      await orgRef.set(
        { billing: { ...(org.billing ?? { status: "trialing" }), stripeCustomerId: customerId } },
        { merge: true }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: orgId,
      metadata: { orgId, plan: planId },
      subscription_data: { metadata: { orgId, plan: planId } },
      success_url: appUrl("/billing?checkout=done"),
      cancel_url: appUrl("/billing?checkout=cancelled"),
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("[billing/checkout]", err?.message);
    return jsonError(err?.message || "Could not start checkout", 502);
  }
}
