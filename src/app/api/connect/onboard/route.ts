import { NextResponse, type NextRequest } from "next/server";
import { requireOwnerOrManager, jsonError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/collections";
import { appUrl, getStripe } from "@/lib/stripe-server";
import type { Organization } from "@/lib/types";

/**
 * POST /api/connect/onboard — starts (or resumes) Stripe Connect onboarding.
 *
 * Until an organization has a connected account, every rent payment settles
 * into the RentOS platform balance. That is the landlord's money sitting in our
 * account: we would be holding funds we have no right to and no licence to
 * transmit. A destination charge against their own connected account sends the
 * money to their bank and leaves us out of the flow entirely.
 *
 * Stripe hosts the identity and bank-details collection, so nothing sensitive
 * passes through RentOS. This route only creates the account shell and hands
 * back a one-time link to Stripe's flow.
 */
export async function POST(req: NextRequest) {
  const guard = await requireOwnerOrManager(req);
  if (!guard.ok) return guard.response;
  const { caller } = guard;
  const orgId = caller.profile.orgId;

  const stripe = await getStripe();
  if (!stripe) {
    return jsonError(
      "Payments are in demo mode — set STRIPE_SECRET_KEY to connect a real account",
      503
    );
  }

  const db = await getAdminDb();
  const orgRef = db.collection(Collections.ORGANIZATIONS).doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) return jsonError("Organization not found", 404);

  const org = orgSnap.data() as Organization;
  let accountId = org.payouts?.stripeAccountId;

  try {
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: caller.email,
        business_profile: {
          name: org.name,
          product_description: "Residential property management — rent collection",
        },
        metadata: { orgId, createdBy: caller.uid },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;

      await orgRef.set(
        {
          payouts: {
            stripeAccountId: accountId,
            chargesEnabled: false,
            payoutsEnabled: false,
            detailsSubmitted: false,
            updatedAt: new Date().toISOString(),
          },
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    // Account links are single-use and short-lived, so one is minted per visit
    // rather than stored.
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: appUrl("/settings?connect=refresh"),
      return_url: appUrl("/settings?connect=done"),
      type: "account_onboarding",
    });

    return NextResponse.json({ url: link.url, accountId });
  } catch (err: any) {
    console.error("[connect/onboard]", err?.message);
    return jsonError(err?.message || "Could not start Stripe onboarding", 502);
  }
}
