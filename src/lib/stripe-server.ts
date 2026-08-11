import type Stripe from "stripe";

/**
 * Server-side Stripe access.
 *
 * Two distinct money flows run through this one account, and confusing them is
 * how a platform ends up holding its customers' rent:
 *
 *   1. Rent — a tenant pays their landlord. RentOS is not the merchant here.
 *      These are destination charges against the org's Connect account, so the
 *      money settles into the landlord's bank, not ours. See connect.ts.
 *   2. Subscriptions — an org pays RentOS for the software. Ordinary charges on
 *      the platform account. See app/api/billing.
 *
 * Stripe is imported dynamically for the same reason firebase-admin is: the
 * deploy step loads the server bundle to discover its exports and gives up
 * after 10s, and top-level SDK imports blow that budget.
 */

let cached: Stripe | null = null;

/** True when a real (non-demo) secret key is present. */
export function isStripeLive(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return Boolean(key && !key.startsWith("sk_demo"));
}

/** Returns null in demo mode, so callers can answer with mock data instead. */
export async function getStripe(): Promise<Stripe | null> {
  if (!isStripeLive()) return null;
  if (cached) return cached;

  const { default: StripeCtor } = await import("stripe");
  cached = new StripeCtor(process.env.STRIPE_SECRET_KEY as string);
  return cached;
}

/**
 * What RentOS takes from each rent payment, in basis points.
 *
 * 0 by default: the subscription is the business model, and skimming rent on
 * top of it without saying so would be indefensible. Set RENT_APPLICATION_FEE_BPS
 * only alongside a plan that actually discloses it.
 */
export function applicationFeeBps(): number {
  const raw = Number(process.env.RENT_APPLICATION_FEE_BPS ?? "0");
  if (!Number.isFinite(raw) || raw < 0) return 0;
  // A platform fee above 10% of rent is far likelier to be a typo than intent.
  return Math.min(raw, 1000);
}

/** Application fee in cents for a rent charge of `amountCents`. */
export function applicationFeeFor(amountCents: number): number {
  const bps = applicationFeeBps();
  if (bps === 0) return 0;
  return Math.floor((amountCents * bps) / 10_000);
}

/** The absolute URL to return to after a Stripe-hosted flow. */
export function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://rentos-pm-app.web.app";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
