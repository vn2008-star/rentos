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

// The payment and autopay helpers that used to live here called their API
// routes with a bare fetch and passed tenantId/orgId in the body. Both routes
// now identify the caller from a Firebase ID token and derive those ids
// themselves, so the calls live in the components that own the flow and go
// through authedFetch — see components/stripe-payment-form.tsx and
// components/autopay-setup.tsx.

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
