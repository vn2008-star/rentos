import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/collections";
import { notifyOrg as notify } from "@/lib/server-notify";
import { isPlanId } from "@/lib/plans";
import { getStripe } from "@/lib/stripe-server";
import type { BillingStatus } from "@/lib/types";
import { errorMessage } from "@/lib/errors";

/**
 * POST /api/payments/webhook
 * Stripe webhook handler for payment events.
 *
 * Stripe is the only writer of payment records — the client never creates a
 * transaction, so whatever this route persists is the system of record.
 *
 * Transactions are keyed by the Stripe PaymentIntent id rather than an
 * auto-generated id. Stripe retries webhooks on any non-2xx and can deliver the
 * same event more than once, so a deterministic id makes replays idempotent
 * instead of duplicating a tenant's rent payment.
 */

/**
 * The id of a Stripe field that may arrive either expanded or as a bare id.
 *
 * Webhook payloads are unexpanded, so these are strings in practice — but the
 * types allow the object form, and writing one straight into Firestore would
 * persist a whole nested Stripe object where an id belongs.
 */
function refId(
  value: string | { id: string } | null | undefined
): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? value : value.id;
}

/** Tenant's display name for notification copy, or a neutral fallback. */
async function tenantLabel(tenantId?: string): Promise<string> {
  if (!tenantId) return "A tenant";
  try {
    const db = await getAdminDb();
    const snap = await db.collection(Collections.TENANTS).doc(tenantId).get();
    if (!snap.exists) return "A tenant";
    const t = snap.data() ?? {};
    const name = [t.firstName, t.lastName].filter(Boolean).join(" ").trim();
    return name || "A tenant";
  } catch {
    return "A tenant";
  }
}

/**
 * Writes a subscription's state onto the organization.
 *
 * Only the fields Stripe actually reported are touched: a subscription update
 * that says nothing about the plan must not blank the plan the org is on.
 */
async function applySubscription(
  db: FirebaseFirestore.Firestore,
  orgId: string,
  input: {
    plan?: string;
    subscriptionId?: string | null;
    customerId?: string | null;
    status: BillingStatus;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
  }
): Promise<void> {
  const orgRef = db.collection(Collections.ORGANIZATIONS).doc(orgId);
  const snap = await orgRef.get();
  if (!snap.exists) {
    console.error(`[Webhook] No organization ${orgId} to bill`);
    return;
  }

  const existing = (snap.data()?.billing ?? {}) as Record<string, unknown>;

  await orgRef.set(
    {
      ...(isPlanId(input.plan) ? { plan: input.plan } : {}),
      billing: {
        ...existing,
        status: input.status,
        ...(input.subscriptionId ? { stripeSubscriptionId: input.subscriptionId } : {}),
        ...(input.customerId ? { stripeCustomerId: input.customerId } : {}),
        ...(input.currentPeriodEnd ? { currentPeriodEnd: input.currentPeriodEnd } : {}),
        ...(input.cancelAtPeriodEnd !== undefined
          ? { cancelAtPeriodEnd: input.cancelAtPeriodEnd }
          : {}),
      },
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

/** Resolve orgId from the intent metadata, falling back to the lease record. */
async function resolveOrgId(
  metadata: Record<string, string | undefined>
): Promise<string | null> {
  if (metadata.orgId) return metadata.orgId;

  // Older intents created before orgId was threaded through won't carry it.
  if (metadata.leaseId) {
    const db = await getAdminDb();
    const lease = await db
      .collection(Collections.LEASES)
      .doc(metadata.leaseId)
      .get();
    if (lease.exists) return (lease.data()?.orgId as string) ?? null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || stripeSecretKey.startsWith("sk_demo")) {
    return NextResponse.json({ received: true, demo: true });
  }

  // Fail closed. Without a signing secret we cannot tell a real Stripe event
  // from a forged POST, and acting on a forged payment_intent.succeeded would
  // mark rent as paid for free.
  if (!webhookSecret) {
    console.error("[Webhook] STRIPE_WEBHOOK_SECRET is not set — refusing to process events");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // getStripe() rather than require(): it is the same lazy load every other
  // route uses, and it keeps the top-level Stripe import out of the server
  // bundle — see stripe-server.ts for why that matters at deploy time. The
  // demo-key guard above means this cannot actually be null.
  const stripe = await getStripe();
  if (!stripe) {
    console.error("[Webhook] Stripe is not configured — refusing to process events");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event;
  try {
    if (!sig) throw new Error("Missing stripe-signature header");
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[Webhook] Signature verification failed:", errorMessage(err));
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const db = await getAdminDb();

    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const metadata = pi.metadata ?? {};
        const orgId = await resolveOrgId(metadata);

        if (!orgId) {
          // Persisting without orgId would create a record the app can never
          // query, since every read is scoped by orgId.
          console.error(`[Webhook] No orgId for ${pi.id} — cannot persist transaction`);
          return NextResponse.json({ received: true, persisted: false });
        }

        // Stripe hosts the receipt; latest_charge is an id that must be fetched.
        let receiptUrl: string | undefined;
        const chargeId = refId(pi.latest_charge);
        if (chargeId) {
          const charge = await stripe.charges.retrieve(chargeId);
          receiptUrl = charge.receipt_url ?? undefined;
        }

        await db.collection(Collections.TRANSACTIONS).doc(pi.id).set(
          {
            orgId,
            type: metadata.type || "rent",
            amount: pi.amount / 100,
            date: new Date(pi.created * 1000).toISOString(),
            tenantId: metadata.tenantId || null,
            leaseId: metadata.leaseId || null,
            description: pi.description || "Rent payment",
            status: "completed",
            stripePaymentIntentId: pi.id,
            ...(receiptUrl ? { receiptUrl } : {}),
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );

        const paidBy = await tenantLabel(metadata.tenantId);
        await notify({
          orgId,
          kind: "payment_received",
          audience: "manager",
          title: "Rent received",
          body: `${paidBy} paid $${(pi.amount / 100).toLocaleString()}.`,
          href: "/financials",
        });

        console.log(`[Webhook] Recorded payment ${pi.id} — $${pi.amount / 100} (org ${orgId})`);
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        const metadata = pi.metadata ?? {};
        const orgId = await resolveOrgId(metadata);

        if (!orgId) {
          console.error(`[Webhook] No orgId for failed intent ${pi.id}`);
          return NextResponse.json({ received: true, persisted: false });
        }

        const reason =
          pi.last_payment_error?.message || "Payment failed without a stated reason";

        // Recorded as a failed transaction so it shows in the tenant's history
        // and the manager's ledger rather than vanishing.
        await db.collection(Collections.TRANSACTIONS).doc(pi.id).set(
          {
            orgId,
            type: metadata.type || "rent",
            amount: pi.amount / 100,
            date: new Date(pi.created * 1000).toISOString(),
            tenantId: metadata.tenantId || null,
            leaseId: metadata.leaseId || null,
            description: pi.description || "Rent payment",
            status: "failed",
            failureReason: reason,
            stripePaymentIntentId: pi.id,
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );

        // Both sides are told: the manager needs to chase it, and the tenant
        // needs to know rent did not actually go through.
        const failedBy = await tenantLabel(metadata.tenantId);
        const amountLabel = `$${(pi.amount / 100).toLocaleString()}`;

        await notify({
          orgId,
          kind: "payment_failed",
          audience: "manager",
          title: "Rent payment failed",
          body: `${failedBy}'s ${amountLabel} rent payment was declined — ${reason}`,
          href: "/financials",
        });

        if (metadata.tenantId) {
          await notify({
            orgId,
            kind: "payment_failed",
            audience: "tenant",
            tenantId: metadata.tenantId,
            title: "Your rent payment failed",
            body: `Your ${amountLabel} payment did not go through — ${reason}. Please try again.`,
            href: "/portal/payments",
          });
        }

        console.log(`[Webhook] Recorded failed payment ${pi.id}: ${reason}`);
        break;
      }

      case "setup_intent.succeeded": {
        const si = event.data.object;
        const tenantId = si.metadata?.tenantId;

        if (!tenantId) {
          console.error(`[Webhook] setup_intent ${si.id} has no tenantId in metadata`);
          break;
        }

        // Store the card's display details, never the payment method itself —
        // Stripe holds that, we only keep enough to render "Visa ···· 4242".
        let card: { brand: string; last4: string; expMonth: number; expYear: number } | null = null;
        const paymentMethodId = refId(si.payment_method);
        if (paymentMethodId) {
          const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
          if (pm.card) {
            card = {
              brand: pm.card.brand,
              last4: pm.card.last4,
              expMonth: pm.card.exp_month,
              expYear: pm.card.exp_year,
            };
          }
        }

        await db.collection(Collections.TENANTS).doc(tenantId).set(
          {
            autopayEnabled: true,
            stripeCustomerId: si.customer || null,
            stripePaymentMethodId: si.payment_method || null,
            ...(card ? { defaultPaymentMethod: card } : {}),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        console.log(`[Webhook] Autopay enabled for tenant ${tenantId}`);
        break;
      }

      // ----- RentOS subscriptions (the org paying us) -----
      // Distinct from everything above, which is a tenant paying their landlord.

      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription") break;

        const orgId = session.metadata?.orgId || session.client_reference_id;
        if (!orgId) {
          console.error(`[Webhook] checkout ${session.id} has no orgId`);
          break;
        }

        await applySubscription(db, orgId, {
          plan: session.metadata?.plan,
          subscriptionId: refId(session.subscription),
          customerId: refId(session.customer),
          status: "active",
        });

        console.log(`[Webhook] ${orgId} subscribed (${session.metadata?.plan})`);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const orgId = sub.metadata?.orgId;
        if (!orgId) {
          console.error(`[Webhook] subscription ${sub.id} has no orgId in metadata`);
          break;
        }

        await applySubscription(db, orgId, {
          plan: sub.metadata?.plan,
          subscriptionId: sub.id,
          customerId: refId(sub.customer),
          // Stripe's vocabulary is wider than ours; anything we do not model
          // (paused, unpaid, incomplete_expired) is treated as not paying.
          status:
            event.type === "customer.subscription.deleted"
              ? "canceled"
              : sub.status === "active" || sub.status === "trialing"
                ? "active"
                : sub.status === "past_due"
                  ? "past_due"
                  : sub.status === "incomplete"
                    ? "incomplete"
                    : "canceled",
          // Read off the subscription item, not the subscription. Stripe moved
          // current_period_end down to the item in the 2025 API versions, so
          // `sub.current_period_end` had silently been undefined — the billing
          // period end was never recorded, and the Billing page had nothing to
          // show for "renews on". Single-item subscriptions here, so item 0 is
          // the whole story.
          currentPeriodEnd: sub.items.data[0]?.current_period_end
            ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
            : undefined,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        });

        console.log(`[Webhook] ${orgId} subscription is now ${sub.status}`);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    // Returning 500 makes Stripe retry, which is what we want for a transient
    // Firestore failure — the deterministic doc id keeps the retry safe.
    console.error("[Webhook] Error handling event:", errorMessage(err));
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
