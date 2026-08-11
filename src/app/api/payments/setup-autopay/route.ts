import { NextResponse, type NextRequest } from "next/server";
import { requireCaller, jsonError, isStaffRole, type ProfiledCaller } from "@/lib/api-auth";
import { getAdminDb, getFieldValue } from "@/lib/firebase-admin";
import { Collections } from "@/lib/collections";
import { getStripe } from "@/lib/stripe-server";
import type { Tenant } from "@/lib/types";

/**
 * POST /api/payments/setup-autopay — saves a card for future rent.
 *
 * Previously this took tenantId, orgId and email from the request body while
 * unauthenticated: anyone could attach a Stripe customer to any tenant record,
 * and the webhook would then mark that tenant as having autopay set up. The
 * caller is now identified from their ID token and may only act on their own
 * tenancy — or, for staff, on a tenant within their own organization.
 *
 * The customer stays on the RentOS platform account rather than the landlord's
 * connected account, because rent is charged as a destination charge from the
 * platform. Keeping the saved card here is what lets a tenant who moves between
 * two units of the same landlord keep their payment method.
 */
/**
 * Resolves which tenancy the caller may act on.
 *
 * A tenant gets their own and nothing else; staff may act on any tenant inside
 * their own organization. Returning the record itself keeps callers from
 * re-reading it and from trusting anything the request body claimed about it.
 */
async function resolveTenant(
  caller: ProfiledCaller,
  body: Record<string, unknown>
): Promise<{ id: string; tenant: Tenant } | { error: ReturnType<typeof jsonError> }> {
  let tenantId: string;
  if (caller.profile.role === "tenant") {
    tenantId = caller.profile.tenantId ?? "";
    if (!tenantId) return { error: jsonError("This account is not linked to a tenancy", 403) };
  } else if (isStaffRole(caller.profile.role)) {
    tenantId = String(body.tenantId ?? "").trim();
    if (!tenantId) return { error: jsonError("Missing tenant", 400) };
  } else {
    return { error: jsonError("This account cannot manage autopay", 403) };
  }

  const db = await getAdminDb();
  const snap = await db.collection(Collections.TENANTS).doc(tenantId).get();
  if (!snap.exists) return { error: jsonError("Tenant not found", 404) };

  const tenant = snap.data() as Tenant;
  if (tenant.orgId !== caller.profile.orgId) {
    return { error: jsonError("That tenant belongs to another organization", 403) };
  }

  return { id: tenantId, tenant };
}

export async function POST(req: NextRequest) {
  const guard = await requireCaller(req);
  if (!guard.ok) return guard.response;
  const { caller } = guard;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const resolved = await resolveTenant(caller, body);
  if ("error" in resolved) return resolved.error;
  const { id: tenantId, tenant } = resolved;

  const db = await getAdminDb();

  // The tenant record's own address, not one supplied by the caller — the
  // receipt and the Stripe customer should follow the tenancy.
  const email = tenant.email || caller.email;

  const stripe = await getStripe();
  if (!stripe) {
    return NextResponse.json({
      clientSecret: `demo_setup_secret_${Date.now()}`,
      customerId: `cus_demo_${tenantId}`,
      demo: true,
    });
  }

  try {
    // Reuse the customer already recorded on the tenancy where possible;
    // matching only on email would collide for tenants of different landlords
    // who share an address, and create a duplicate customer on every visit.
    let customerId = tenant.stripeCustomerId;
    if (customerId) {
      const existing = await stripe.customers.retrieve(customerId).catch(() => null);
      if (!existing || (existing as { deleted?: boolean }).deleted) customerId = undefined;
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || undefined,
        metadata: { tenantId, orgId: tenant.orgId },
      });
      customerId = customer.id;
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      // The webhook uses tenantId to attach the saved card to the right tenant.
      metadata: { tenantId, orgId: tenant.orgId },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId,
    });
  } catch (err: any) {
    console.error("[Setup Autopay] Error:", err?.message);
    return jsonError(err?.message || "Could not start autopay setup", 502);
  }
}

/**
 * DELETE — turns autopay off and detaches the stored card.
 *
 * The card is detached at Stripe rather than merely forgotten here. Leaving a
 * usable payment method attached to a customer after the person asked us to
 * stop taking their rent automatically would be keeping a key we were told to
 * give back.
 */
export async function DELETE(req: NextRequest) {
  const guard = await requireCaller(req);
  if (!guard.ok) return guard.response;
  const { caller } = guard;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const resolved = await resolveTenant(caller, body);
  if ("error" in resolved) return resolved.error;
  const { id: tenantId, tenant } = resolved;

  const stripe = await getStripe();
  if (stripe && tenant.stripePaymentMethodId) {
    try {
      await stripe.paymentMethods.detach(tenant.stripePaymentMethodId);
    } catch (err: any) {
      // Already detached, or never existed. Clearing our own record still stands.
      console.warn("[Setup Autopay] detach failed:", err?.message);
    }
  }

  const db = await getAdminDb();
  const FieldValue = await getFieldValue();
  await db.collection(Collections.TENANTS).doc(tenantId).set(
    {
      autopayEnabled: false,
      stripePaymentMethodId: FieldValue.delete(),
      defaultPaymentMethod: FieldValue.delete(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return NextResponse.json({ autopayEnabled: false });
}
