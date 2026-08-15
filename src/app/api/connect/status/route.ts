import { NextResponse, type NextRequest } from "next/server";
import { requireStaff, jsonError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/collections";
import { getStripe } from "@/lib/stripe-server";
import type { Organization, OrgPayouts } from "@/lib/types";
import { errorMessage } from "@/lib/errors";

/**
 * GET /api/connect/status — re-reads the org's payout account from Stripe.
 *
 * Stripe decides when an account may take money: identity checks, bank
 * verification and risk review all happen after onboarding is "finished", so the
 * flags on our copy go stale the moment the landlord walks away from the hosted
 * flow. This refreshes them, and is what the settings screen calls when someone
 * comes back from Stripe.
 */
export async function GET(req: NextRequest) {
  const guard = await requireStaff(req);
  if (!guard.ok) return guard.response;
  const orgId = guard.caller.profile.orgId;

  const db = await getAdminDb();
  const orgRef = db.collection(Collections.ORGANIZATIONS).doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) return jsonError("Organization not found", 404);

  const org = orgSnap.data() as Organization;
  const accountId = org.payouts?.stripeAccountId;

  if (!accountId) {
    return NextResponse.json({
      connected: false,
      payouts: org.payouts ?? {
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      },
    });
  }

  const stripe = await getStripe();
  if (!stripe) {
    return NextResponse.json({ connected: true, demo: true, payouts: org.payouts });
  }

  try {
    const account = await stripe.accounts.retrieve(accountId);
    const payouts: OrgPayouts = {
      stripeAccountId: accountId,
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
      requirementsDue: account.requirements?.currently_due ?? [],
      updatedAt: new Date().toISOString(),
    };

    await orgRef.set({ payouts, updatedAt: payouts.updatedAt }, { merge: true });

    return NextResponse.json({ connected: true, payouts });
  } catch (err) {
    console.error("[connect/status]", errorMessage(err));
    return jsonError("Could not read the payout account from Stripe", 502);
  }
}
