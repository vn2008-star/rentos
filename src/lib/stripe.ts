/**
 * Stripe Client Utilities
 * Client-side Stripe initialization and helpers.
 */

import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key || key.startsWith("pk_demo")) {
      console.warn("[Stripe] No publishable key configured — payments in demo mode");
      stripePromise = Promise.resolve(null);
    } else {
      stripePromise = loadStripe(key);
    }
  }
  return stripePromise;
}

/**
 * Create a payment intent via our API route.
 */
export async function createPaymentIntent(params: {
  amount: number; // in cents
  tenantId: string;
  leaseId: string;
  type: "rent" | "deposit" | "late_fee" | "application_fee";
  description?: string;
}): Promise<{ clientSecret: string; paymentIntentId: string } | null> {
  try {
    const res = await fetch("/api/payments/create-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error("Failed to create payment intent");
    return await res.json();
  } catch (err) {
    console.error("[Stripe] Create payment intent failed:", err);
    return null;
  }
}

/**
 * Create a setup intent for saving a payment method (autopay).
 */
export async function setupAutopay(params: {
  tenantId: string;
  email: string;
  orgId: string;
}): Promise<{ clientSecret: string } | null> {
  try {
    const res = await fetch("/api/payments/setup-autopay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error("Failed to setup autopay");
    return await res.json();
  } catch (err) {
    console.error("[Stripe] Setup autopay failed:", err);
    return null;
  }
}

/**
 * Format cents to currency string.
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * Check if Stripe is configured (has real keys).
 */
export function isStripeConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  return Boolean(key && !key.startsWith("pk_demo"));
}
