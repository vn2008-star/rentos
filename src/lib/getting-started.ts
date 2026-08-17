import type { Lease, Organization, Property, Tenant, Unit } from "./types";

/**
 * The order a landlord actually has to do things in.
 *
 * A new organization opens on a dashboard of zeroes, and nothing on it says
 * which zero to fix first. The steps below are the dependency chain — units
 * need a property, a lease needs a unit and a tenant, rent needs somewhere to
 * land — so following them top to bottom never dead-ends on "add a property
 * first".
 *
 * Each step is judged from the org's own records rather than a checklist the
 * user ticks off. A stored checklist drifts: it says "done" for a property
 * deleted last week, and it starts empty for an org that imported everything
 * before this page existed. Reading the data means the guide is right the first
 * time it is opened, however the org got to where it is.
 */

export interface SetupStep {
  id: string;
  title: string;
  /** Why it matters to them — not a description of the button. */
  why: string;
  href: string;
  cta: string;
  done: boolean;
  /** What they have already. Shown once the step is done. */
  detail?: string;
  /**
   * Worth doing, but an org can collect rent without it. Optional steps never
   * hold back the progress count — a guide that cannot reach 100% is a guide
   * people learn to ignore.
   */
  optional?: boolean;
}

export interface SetupInput {
  properties: Pick<Property, "id">[];
  units: Pick<Unit, "id" | "status">[];
  tenants: Pick<Tenant, "id" | "unitId" | "userId">[];
  leases: Pick<Lease, "id" | "status">[];
  org: Pick<Organization, "payouts" | "settings"> | null;
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

export function buildSetupSteps(input: SetupInput): SetupStep[] {
  const { properties, units, tenants, leases, org } = input;

  const housed = tenants.filter((t) => t.unitId);
  const onPortal = tenants.filter((t) => t.userId);
  const liveLeases = leases.filter(
    (l) => l.status === "active" || l.status === "month_to_month"
  );

  return [
    {
      id: "property",
      title: "Add your first property",
      why: "Everything else hangs off a property — units, tenants, leases and every figure on the dashboard.",
      href: "/properties",
      cta: "Add a property",
      done: properties.length > 0,
      detail: plural(properties.length, "property", "properties"),
    },
    {
      id: "units",
      title: "Add its units",
      why: "A unit is what you let and what you charge for. A single-family house is one unit; a fourplex is four.",
      href: "/units",
      cta: "Add units",
      done: units.length > 0,
      detail: plural(units.length, "unit"),
    },
    {
      id: "tenant",
      title: "Move a tenant into a unit",
      why: "Assigning a tenant marks the unit occupied, which is what the occupancy rate and rent roll count.",
      href: "/tenants",
      cta: "Add a tenant",
      done: housed.length > 0,
      detail: `${plural(housed.length, "tenant")} housed`,
    },
    {
      id: "lease",
      title: "Create and sign the lease",
      why: "The lease sets the rent, the term and the late fee — the terms every reminder and charge is calculated from.",
      href: "/leases",
      cta: "Create a lease",
      done: liveLeases.length > 0,
      detail: `${plural(liveLeases.length, "lease")} live`,
    },
    {
      id: "portal",
      title: "Invite your tenants to the portal",
      why: "It is where they pay rent, report repairs and read their lease — the work you stop doing by hand.",
      href: "/tenants",
      cta: "Send an invitation",
      done: onPortal.length > 0,
      detail: `${plural(onPortal.length, "tenant")} with access`,
    },
    {
      id: "payouts",
      title: "Set up rent payouts",
      why: "Until your bank details clear with Stripe, tenants cannot pay rent through RentOS at all.",
      href: "/billing",
      cta: "Set up payouts",
      done: Boolean(org?.payouts?.chargesEnabled),
      detail: "Accepting payments",
    },
    {
      id: "intake",
      title: "Turn on your public pages",
      why: "Gives you a link prospective tenants can apply through and current ones can report repairs on, without an account.",
      href: "/settings",
      cta: "Open settings",
      done: org?.settings?.publicIntake === true,
      detail: "Public pages live",
      optional: true,
    },
  ];
}

/** How far along the required steps are. Optional ones are not counted. */
export function setupProgress(steps: SetupStep[]): {
  done: number;
  total: number;
  percent: number;
  complete: boolean;
  /** The step to do next, or null when the required ones are finished. */
  next: SetupStep | null;
} {
  const required = steps.filter((s) => !s.optional);
  const done = required.filter((s) => s.done).length;
  const total = required.length;
  return {
    done,
    total,
    percent: total === 0 ? 100 : Math.round((done / total) * 100),
    complete: done === total,
    next: steps.find((s) => !s.done && !s.optional) ?? null,
  };
}
