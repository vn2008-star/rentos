import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/payments/create-intent
 * Creates a Stripe PaymentIntent for rent payment.
 */
export async function POST(req: NextRequest) {
  try {
    const { amount, tenantId, leaseId, type, description, orgId, email } =
      await req.json();

    if (!amount || amount < 100) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    // Demo mode — return mock data if no Stripe key
    if (!stripeSecretKey || stripeSecretKey.startsWith("sk_demo")) {
      return NextResponse.json({
        clientSecret: `demo_secret_${Date.now()}`,
        paymentIntentId: `pi_demo_${Date.now()}`,
        demo: true,
      });
    }

    // Real Stripe integration
    const stripe = require("stripe")(stripeSecretKey);

    const paymentIntent = await stripe.paymentIntents.create({
      amount, // in cents
      currency: "usd",
      // The webhook reads these back — orgId in particular, without which the
      // resulting transaction cannot be scoped to an organization.
      metadata: {
        tenantId,
        leaseId,
        type,
        orgId,
      },
      description: description || `RentOS ${type} payment`,
      // Stripe emails its own hosted receipt on success.
      ...(email ? { receipt_email: email } : {}),
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err: any) {
    console.error("[Payments API] Error:", err);
    return NextResponse.json(
      { error: err.message || "Payment failed" },
      { status: 500 }
    );
  }
}
