import { NextResponse, type NextRequest } from "next/server";
import { requireCaller, jsonError, isStaffRole } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/collections";
import { applicationFeeFor, getStripe } from "@/lib/stripe-server";
import type { Lease, Organization } from "@/lib/types";

/**
 * POST /api/payments/create-intent — takes a rent payment.
 *
 * Two things changed here, and both were security bugs:
 *
 *   1. The route was unauthenticated and took orgId, tenantId and leaseId
 *      straight from the request body. Anyone could file a payment against any
 *      lease in any organization, and the webhook would faithfully record it.
 *      The caller is now identified from their Firebase ID token, and the lease
 *      is checked to belong to them.
 *
 *   2. Charges went to the RentOS platform account, so every landlord's rent
 *      landed in our Stripe balance. Payments are now destination charges
 *      against the organization's own connected account — the money never rests
 *      with us.
 */

/** Rent is not the sort of number that has an upper bound, but typos do. */
const MAX_PAYMENT_CENTS = 5_000_000; // $50,000

export async function POST(req: NextRequest) {
  const guard = await requireCaller(req);
  if (!guard.ok) return guard.response;
  const { caller } = guard;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Expected a JSON body", 400);
  }

  const amount = Math.round(Number(body.amount ?? 0));
  if (!Number.isFinite(amount) || amount < 100) {
    return jsonError("Enter an amount of at least $1", 400);
  }
  if (amount > MAX_PAYMENT_CENTS) {
    return jsonError("That amount is too large to process online", 400);
  }

  const leaseId = String(body.leaseId ?? "").trim();
  if (!leaseId) return jsonError("Missing lease", 400);

  const db = await getAdminDb();
  const leaseSnap = await db.collection(Collections.LEASES).doc(leaseId).get();
  if (!leaseSnap.exists) return jsonError("Lease not found", 404);
  const lease = leaseSnap.data() as Lease;

  // The organization comes from the lease, never from the request. This is the
  // check that stops a payment being attributed to somebody else's portfolio.
  const orgId = lease.orgId;
  if (orgId !== caller.profile.orgId) {
    return jsonError("That lease belongs to another organization", 403);
  }

  // A tenant may only pay their own lease. Staff may take a payment on behalf of
  // a tenant on any lease in their own org — front-desk card payments are real.
  let tenantId: string;
  if (caller.profile.role === "tenant") {
    tenantId = caller.profile.tenantId ?? "";
    if (!tenantId || !(lease.tenantIds ?? []).includes(tenantId)) {
      return jsonError("You are not named on that lease", 403);
    }
  } else if (isStaffRole(caller.profile.role)) {
    tenantId = String(body.tenantId ?? "").trim();
    if (tenantId && !(lease.tenantIds ?? []).includes(tenantId)) {
      return jsonError("That tenant is not on this lease", 400);
    }
    tenantId = tenantId || (lease.tenantIds ?? [])[0] || "";
  } else {
    return jsonError("This account cannot make payments", 403);
  }

  const type = ["rent", "deposit", "late_fee", "application_fee"].includes(
    String(body.type)
  )
    ? String(body.type)
    : "rent";

  const stripe = await getStripe();
  if (!stripe) {
    return NextResponse.json({
      clientSecret: `demo_secret_${Date.now()}`,
      paymentIntentId: `pi_demo_${Date.now()}`,
      demo: true,
    });
  }

  const orgSnap = await db.collection(Collections.ORGANIZATIONS).doc(orgId).get();
  const org = orgSnap.data() as Organization | undefined;
  const destination = org?.payouts?.stripeAccountId;

  // Refusing is the honest answer. Charging anyway would put this tenant's rent
  // in the platform's balance with no mechanism to get it to the landlord.
  if (!destination || !org?.payouts?.chargesEnabled) {
    return jsonError(
      "This property manager has not finished setting up payouts yet, so online payments are unavailable. Please contact them directly.",
      409
    );
  }

  try {
    const fee = applicationFeeFor(amount);
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: (org?.settings?.currency ?? "usd").toLowerCase(),
      description: String(body.description ?? `RentOS ${type} payment`).slice(0, 300),
      // The webhook reads these back; orgId in particular, without which the
      // resulting transaction cannot be scoped to an organization.
      metadata: { tenantId, leaseId, type, orgId },
      ...(caller.email ? { receipt_email: caller.email } : {}),
      // Destination charge: RentOS is the merchant of record for the card, the
      // landlord's connected account receives the funds.
      transfer_data: { destination },
      ...(fee > 0 ? { application_fee_amount: fee } : {}),
      automatic_payment_methods: { enabled: true },
    });

    return NextResponse.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
    });
  } catch (err: any) {
    console.error("[Payments API] Error:", err?.message);
    return jsonError(err?.message || "Payment could not be started", 502);
  }
}
