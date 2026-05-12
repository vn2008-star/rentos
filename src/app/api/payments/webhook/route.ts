import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/payments/webhook
 * Stripe webhook handler for payment events.
 */
export async function POST(req: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || stripeSecretKey.startsWith("sk_demo")) {
    return NextResponse.json({ received: true, demo: true });
  }

  try {
    const stripe = require("stripe")(stripeSecretKey);
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    let event;
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body);
    }

    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        console.log(`[Webhook] Payment succeeded: ${pi.id} — $${pi.amount / 100}`);
        // TODO: Update transaction status in Firestore
        // TODO: Send receipt to tenant
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        console.log(`[Webhook] Payment failed: ${pi.id}`);
        // TODO: Notify tenant + manager
        break;
      }
      case "setup_intent.succeeded": {
        const si = event.data.object;
        console.log(`[Webhook] Autopay setup: ${si.id}`);
        // TODO: Store payment method on tenant profile
        break;
      }
      default:
        console.log(`[Webhook] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[Webhook] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
