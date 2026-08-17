import type { Unit } from "./types";

/**
 * The Davis move-in inventory, as a form the app can actually complete.
 *
 * Two separate paper documents sit behind this. Article 18.11 of the Davis
 * Municipal Code requires owner and tenant to walk the unit together on the
 * City's Move In/Move Out Checklist "or a form approved by the City" within
 * five business days of the tenancy starting, and to hand each tenant a copy of
 * the signed result within ten days. Section 21 of the Davis Model Lease
 * separately requires a signed inventory statement within seven days, and § 22
 * points at the Davis Model Inventory and Inspection Form "or reasonable
 * facsimile". Both instruments accept an equivalent form; this is that
 * equivalent.
 *
 * It is better than the paper it replaces in the one way that matters. A
 * deposit dispute a year later turns on evidence, and a photograph attached to
 * a named area, timestamped, signed by both parties and held where neither can
 * quietly lose it beats a biro tick in a box that went missing in a move. For a
 * student renting sight-unseen from overseas, it is the difference between
 * "prove the carpet was already stained" and paying for it.
 *
 * The area list is generated from the unit rather than fixed, because "Bedroom
 * 2" on a studio's checklist teaches inspectors to skip lines.
 */

export interface InspectionAreaSpec {
  name: string;
  /** The group it belongs to on the form. */
  section: string;
  /** What to actually photograph — the part people get wrong. */
  guidance: string;
  /** Skipping it undermines the record, so the UI can chase it. */
  required?: boolean;
}

const CORE_SECTIONS = {
  general: "Throughout",
  kitchen: "Kitchen",
  bath: "Bathrooms",
  bedrooms: "Bedrooms",
  living: "Living areas",
  systems: "Safety and systems",
  outside: "Outside and access",
};

/** Clamped: a unit record with 40 bedrooms is a typo, not a mansion. */
const cap = (n: number | undefined, max: number) =>
  Math.max(0, Math.min(Math.floor(Number.isFinite(n) ? (n as number) : 0), max));

/**
 * The areas to walk for this unit.
 *
 * A studio still gets one "Bedroom / sleeping area" line — the tenant sleeps
 * somewhere, and that somewhere carries the same deposit risk.
 */
export function buildDavisMoveInAreas(
  unit: Pick<Unit, "beds" | "baths"> | null | undefined
): InspectionAreaSpec[] {
  const beds = cap(unit?.beds, 12);
  const baths = cap(unit?.baths, 12);

  const areas: InspectionAreaSpec[] = [
    {
      name: "Entry and hallway",
      section: CORE_SECTIONS.general,
      guidance: "Front door, locks, peephole, any scuffs on the door face. Photograph the door closed and the lock working.",
      required: true,
    },
    {
      name: "Floors and carpet",
      section: CORE_SECTIONS.general,
      guidance: "Every room's floor, wide shot then close-ups of stains, burns, tears or gaps. Carpet is the single most disputed deduction — over-photograph it.",
      required: true,
    },
    {
      name: "Walls, ceilings and paint",
      section: CORE_SECTIONS.general,
      guidance: "Existing holes, marks, patches and mismatched paint. Note nail holes now or they become yours.",
      required: true,
    },
    {
      name: "Windows, screens and blinds",
      section: CORE_SECTIONS.general,
      guidance: "Each window opens, locks and has an intact screen. Cracked panes and bent blinds cost real money at move-out.",
      required: true,
    },
    {
      name: "Kitchen — worktops, cupboards and sink",
      section: CORE_SECTIONS.kitchen,
      guidance: "Inside the cupboards too, plus under the sink for leaks or water staining.",
      required: true,
    },
    {
      name: "Kitchen — appliances",
      section: CORE_SECTIONS.kitchen,
      guidance: "Fridge, oven, hob, dishwasher, microwave. Photograph inside the oven and the fridge seals, and confirm each one runs.",
      required: true,
    },
  ];

  for (let i = 1; i <= Math.max(1, baths); i++) {
    areas.push({
      name: baths > 1 ? `Bathroom ${i}` : "Bathroom",
      section: CORE_SECTIONS.bath,
      guidance: "Toilet, basin, bath or shower, grouting, extractor fan, and any sign of damp or mould behind the door and around the seals.",
      required: true,
    });
  }

  for (let i = 1; i <= Math.max(1, beds); i++) {
    areas.push({
      name: beds > 1 ? `Bedroom ${i}` : "Bedroom / sleeping area",
      section: CORE_SECTIONS.bedrooms,
      guidance: "Wardrobe interior, door, window, and the floor in the corners where furniture will sit.",
      required: true,
    });
  }

  areas.push(
    {
      name: "Living room",
      section: CORE_SECTIONS.living,
      guidance: "Wide shot from each corner, plus anything already marked or worn.",
      required: true,
    },
    {
      name: "Furnishings provided",
      section: CORE_SECTIONS.living,
      guidance: "Every item the landlord supplies, with its condition. If the unit is unfurnished, record that — it is the answer to a later claim that furniture went missing.",
    },
    {
      name: "Smoke and carbon monoxide detectors",
      section: CORE_SECTIONS.systems,
      guidance: "Photograph each device and test it in front of the tenant. § 17 of the Model Lease says they are working on day one — this is the proof.",
      required: true,
    },
    {
      name: "Heating, cooling and water heater",
      section: CORE_SECTIONS.systems,
      guidance: "Run the heating and the cooling. Photograph the thermostat and the water heater, including any leak staining underneath.",
      required: true,
    },
    {
      name: "Plumbing — taps, drains and toilets",
      section: CORE_SECTIONS.systems,
      guidance: "Run every tap and flush every toilet. Slow drains recorded now are maintenance; found later they are damage.",
      required: true,
    },
    {
      name: "Electrics — outlets, switches and lights",
      section: CORE_SECTIONS.systems,
      guidance: "Every light works, every switch does something, no scorched or loose outlets.",
    },
    {
      name: "Laundry",
      section: CORE_SECTIONS.systems,
      guidance: "Washer and dryer if provided, hoses, and the floor beneath them. Record 'none provided' if there is none.",
    },
    {
      name: "Meters and utilities",
      section: CORE_SECTIONS.systems,
      guidance: "Photograph the meter readings on the day. § 9 of the Model Lease splits who pays what, and readings settle the first bill.",
    },
    {
      name: "Keys, fobs and remotes",
      section: CORE_SECTIONS.outside,
      guidance: "Photograph every key and fob handed over, and count them. The deposit is not released until all of them come back.",
      required: true,
    },
    {
      name: "Exterior, garden and bins",
      section: CORE_SECTIONS.outside,
      guidance: "Paths, fences, garden condition, bin store, and any existing damage to the outside of the building.",
    },
    {
      name: "Parking, garage or bike storage",
      section: CORE_SECTIONS.outside,
      guidance: "The space assigned to this unit, and the state of it. In Davis the bike storage matters more than the car space.",
    },
    {
      name: "Pest and cleanliness on arrival",
      section: CORE_SECTIONS.outside,
      guidance: "The general standard of cleaning at handover, and any sign of pests. This is what a 'returned in the same condition' argument is measured against.",
      required: true,
    }
  );

  return areas;
}

export const DAVIS_MOVE_IN_TEMPLATE = {
  id: "davis-move-in" as const,
  name: "Davis move-in inventory",
  description:
    "The joint walk-through Davis requires, as a photographic record. Stands in for the City's Move In/Move Out Checklist under Article 18.11 and for the inventory statement at § 21 of the Davis Model Lease.",
  sections: Object.values(CORE_SECTIONS),
};

export type InspectionTemplateId = typeof DAVIS_MOVE_IN_TEMPLATE.id;

/** Adds business days, skipping Saturdays and Sundays. */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

/**
 * The two dates Article 18.11 puts on a move-in.
 *
 * `inspectBy` is five business days from the tenancy starting; `copyBy` is ten
 * calendar days from the inspection, by which each tenant must hold a signed
 * copy. The second is the one that gets forgotten, because by then the keys are
 * handed over and it feels finished.
 */
export function davisMoveInDeadlines(input: {
  tenancyStart: string;
  inspectedAt?: string;
}): { inspectBy: string; copyBy: string | null } {
  const start = new Date(`${input.tenancyStart.slice(0, 10)}T00:00:00Z`);
  const inspectBy = Number.isNaN(start.getTime())
    ? ""
    : addBusinessDays(start, 5).toISOString().slice(0, 10);

  let copyBy: string | null = null;
  if (input.inspectedAt) {
    const done = new Date(input.inspectedAt);
    if (!Number.isNaN(done.getTime())) {
      done.setUTCDate(done.getUTCDate() + 10);
      copyBy = done.toISOString().slice(0, 10);
    }
  }

  return { inspectBy, copyBy };
}

/**
 * When each tenant must hold a signed copy: ten days after the inspection.
 *
 * Separate from davisMoveInDeadlines because this one is knowable from the
 * inspection alone — the tenancy start date is not needed, and asking for it
 * would mean the app could only show the deadline when a lease happened to be
 * linked.
 */
export function copyDueBy(inspectedAt: string | undefined): string | null {
  if (!inspectedAt) return null;
  const done = new Date(inspectedAt);
  if (Number.isNaN(done.getTime())) return null;
  done.setUTCDate(done.getUTCDate() + 10);
  return done.toISOString().slice(0, 10);
}

/** Which expected areas are still unrecorded, in form order. */
export function outstandingAreas(
  expected: string[] | undefined,
  recorded: { name: string }[]
): string[] {
  if (!expected?.length) return [];
  const done = new Set(recorded.map((a) => a.name));
  return expected.filter((name) => !done.has(name));
}
