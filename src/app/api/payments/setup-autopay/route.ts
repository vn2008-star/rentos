import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/payments/setup-autopay
 * Creates a Stripe SetupIntent for saving a payment method.
 */
export async function POST(req: NextRequest) {
  try {
    const { tenantId, email, orgId } = await req.json();

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey || stripeSecretKey.startsWith("sk_demo")) {
      return NextResponse.json({
        clientSecret: `demo_setup_secret_${Date.now()}`,
        customerId: `cus_demo_${tenantId}`,
        demo: true,
      });
    }

    const stripe = require("stripe")(stripeSecretKey);

    // Create or retrieve customer
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customer = customers.data[0];
    if (!customer) {
      customer = await stripe.customers.create({
        email,
        metadata: { tenantId, orgId },
      });
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ["card"],
      // The webhook uses tenantId to attach the saved card to the right tenant.
      metadata: { tenantId, orgId },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
    });
  } catch (err: any) {
    console.error("[Setup Autopay] Error:", err);
    return NextResponse.json(
      { error: err.message || "Setup failed" },
      { status: 500 }
    );
  }
}
