import type { PlanId } from "./types";

/**
 * The subscription catalogue — the single source of truth for what RentOS
 * costs and what each tier allows.
 *
 * The marketing page, the billing screen and the unit-limit check all read from
 * here. Previously the prices lived only in the landing page's markup and the
 * limits lived nowhere at all, which meant "Up to 200 units" was decoration.
 *
 * `stripePriceIdEnv` names the environment variable holding that tier's Stripe
 * Price id. Keeping ids in env rather than in code lets test and live mode use
 * the same build, and means this file is safe to read in the browser.
 */
export interface PlanDefinition {
  id: PlanId;
  name: string;
  /** Monthly price in dollars. null = "contact us", handled off-platform. */
  price: number | null;
  /** Maximum units the org may have. null = unlimited. */
  unitLimit: number | null;
  blurb: string;
  features: string[];
  stripePriceIdEnv: string;
  popular?: boolean;
  /** Enterprise is sold by hand, so it has no self-serve checkout. */
  contactSales?: boolean;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    price: 49,
    unitLimit: 25,
    blurb: "Up to 25 units",
    features: [
      "Portfolio dashboard",
      "Tenant management",
      "Basic maintenance",
      "Email support",
    ],
    stripePriceIdEnv: "STRIPE_PRICE_STARTER",
  },
  growth: {
    id: "growth",
    name: "Growth",
    price: 99,
    unitLimit: 75,
    blurb: "Up to 75 units",
    features: [
      "Everything in Starter",
      "Rent collection & autopay",
      "Inspections & key tracking",
      "Team accounts",
    ],
    stripePriceIdEnv: "STRIPE_PRICE_GROWTH",
  },
  professional: {
    id: "professional",
    name: "Professional",
    price: 199,
    unitLimit: 200,
    blurb: "Up to 200 units",
    features: [
      "Everything in Growth",
      "Contractor portal",
      "Analytics & reporting",
      "Vacancy marketing",
      "Priority support",
    ],
    stripePriceIdEnv: "STRIPE_PRICE_PROFESSIONAL",
    popular: true,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    price: null,
    unitLimit: null,
    blurb: "Unlimited units",
    features: [
      "Everything in Professional",
      "SSO & custom roles",
      "Custom integrations",
      "Dedicated success manager",
      "SLA guarantee",
    ],
    stripePriceIdEnv: "STRIPE_PRICE_ENTERPRISE",
    contactSales: true,
  },
};

/** Display order — cheapest first. Object key order is not a contract. */
export const PLAN_ORDER: PlanId[] = ["starter", "growth", "professional", "enterprise"];

export const DEFAULT_PLAN: PlanId = "starter";

/**
 * How long a new organization may use RentOS before a card is required.
 *
 * The marketing page promises three months, so this is three months. It was 14
 * days while the hero said "Start Free — 3 Months", which meant the app would
 * have cut people off ten weeks before the page said it would.
 */
export const TRIAL_DAYS = 90;

/** The trial in the words the marketing page uses, derived so the two agree. */
export const TRIAL_LABEL =
  TRIAL_DAYS % 30 === 0 ? `${TRIAL_DAYS / 30}-Month` : `${TRIAL_DAYS}-Day`;

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && value in PLANS;
}

export function planFor(planId: string | undefined): PlanDefinition {
  return isPlanId(planId) ? PLANS[planId] : PLANS[DEFAULT_PLAN];
}

export function unitLimitFor(planId: string | undefined): number | null {
  return planFor(planId).unitLimit;
}

/**
 * Whether another unit may be added.
 *
 * Enforced in the UI when adding a unit and shown on the billing screen. It is
 * deliberately NOT enforced in security rules: rules cannot count documents, so
 * the honest place for a count-based limit is the application. What rules DO
 * enforce is subscription status — see canWriteWithBilling().
 */
export function canAddUnit(planId: string | undefined, currentUnits: number): boolean {
  const limit = unitLimitFor(planId);
  return limit === null || currentUnits < limit;
}

export function formatPlanPrice(plan: PlanDefinition): string {
  return plan.price === null ? "Custom" : `$${plan.price}`;
}
