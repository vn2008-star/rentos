/**
 * The two leases a Davis landlord actually signs.
 *
 * Before this, "Create Lease" offered a blank Terms & Conditions box, which is
 * the one field nobody should be composing from memory at eleven at night. The
 * choice in this town is really only two: the Davis Model Lease, which the
 * student market already recognises, or an ordinary California residential
 * lease. Picking one sets the defaults and, more usefully, names what the law
 * requires alongside it.
 *
 * What this file deliberately does NOT contain is lease text. The Davis Model
 * Lease is copyrighted by ASUCD and distributed by them at no charge — the
 * right thing is to send landlords to the authentic document and attach it,
 * not to paraphrase a legal instrument into something that only looks like it.
 * The summaries below are our own words about which lease to use and what to
 * do; the operative document is the one attached to the lease record.
 *
 * The requirement lists are statute and municipal code, cited so anyone can
 * check them. They are a checklist, not legal advice, and the UI says so.
 *
 * Sources:
 *   Davis Model Lease — https://resources.ucdavis.edu/model-lease (ASUCD, rev. 2022)
 *   Davis Municipal Code, Article 18.11 (Rental Resources Program)
 *   Cal. Civ. Code § 1950.5 (deposits, as amended by AB 12, in force 1 Jul 2024)
 *   Cal. Civ. Code § 1946.2 / § 1947.12 (Tenant Protection Act, AB 1482)
 */

export type LeaseTemplateId = "davis-model" | "ca-standard";

/** When a requirement has to be met, relative to the tenancy. */
export type RequirementTiming =
  | "before-signing"
  | "at-signing"
  | "within-5-days"
  | "within-7-days"
  | "at-renewal"
  | "at-move-out";

export interface LeaseRequirement {
  id: string;
  label: string;
  /** Why it exists and where it comes from — the citation belongs on screen. */
  detail: string;
  timing: RequirementTiming;
  /** Only when the building predates the 1978 lead paint ban. */
  pre1978Only?: boolean;
  /**
   * Set when the chosen lease already does this — e.g. the Davis Model Lease
   * carries the Megan's Law and AB 1482 notices in its own text. Telling a
   * landlord to go and add a notice that is already on the page they signed is
   * how a checklist loses their trust.
   */
  coveredBy?: string;
}

export interface LeaseTemplateOption {
  id: LeaseTemplateId;
  name: string;
  tagline: string;
  jurisdiction: string;
  bestFor: string;
  sourceUrl?: string;
  /** The document itself, when it is published at a stable address. */
  documentUrl?: string;
  /** Where the operative document comes from, and who owns it. */
  sourceNote: string;
  /** What the signed document already settles, so nobody re-types it here. */
  highlights?: string[];
  defaults: {
    lateFeePercent: number;
    gracePeriodDays: number;
    autoRenew: boolean;
    termMonths: number;
  };
  /** Goes into the lease's Terms field as a starting point, in our own words. */
  terms: string;
  /** On top of the California requirements every tenancy carries. */
  extraRequirements: LeaseRequirement[];
}

/**
 * What California requires of any residential tenancy, Davis or otherwise.
 *
 * Not exhaustive — it is the set a small landlord routinely misses, which is
 * the set worth putting in front of them.
 */
export const CALIFORNIA_REQUIREMENTS: LeaseRequirement[] = [
  {
    id: "lead-paint",
    label: "Lead-based paint disclosure and EPA pamphlet",
    detail: "Federal law, for any building built before 1978. The tenant signs the disclosure; you keep it for three years.",
    timing: "before-signing",
    pre1978Only: true,
  },
  {
    id: "megans-law",
    label: "Megan's Law database notice",
    detail: "The statutory paragraph pointing tenants at the sex-offender registry. Cal. Civ. Code § 2079.10a.",
    timing: "at-signing",
  },
  {
    id: "bed-bugs",
    label: "Bed bug information notice",
    detail: "What bed bugs look like and how to report them. Cal. Civ. Code § 1954.603.",
    timing: "before-signing",
  },
  {
    id: "mold",
    label: "Mold health-risk booklet or notice",
    detail: "Required where you know of mold exceeding safe limits, and good practice regardless.",
    timing: "before-signing",
  },
  {
    id: "flood",
    label: "Flood hazard disclosure",
    detail: "If the unit sits in a special flood hazard area or a dam inundation zone. Cal. Gov. Code § 8589.45.",
    timing: "at-signing",
  },
  {
    id: "utilities",
    label: "Shared utility disclosure",
    detail: "If the tenant's meter also serves common areas or another unit, say so and say who pays. Cal. Civ. Code § 1940.9.",
    timing: "at-signing",
  },
  {
    id: "smoking",
    label: "Smoking policy",
    detail: "Where smoking is allowed or prohibited must be stated in the lease. Cal. Civ. Code § 1947.5.",
    timing: "at-signing",
  },
  {
    id: "owner-identity",
    label: "Owner and manager details",
    detail: "The name and address of the owner, and of whoever is authorised to receive notices. Cal. Civ. Code § 1962.",
    timing: "at-signing",
  },
  {
    id: "ab1482",
    label: "Rent cap and just-cause notice (AB 1482)",
    detail: "Davis has no rent control of its own, so the statewide Tenant Protection Act governs. Every lease carries either its notice or, if the property is exempt, the exemption notice. Cal. Civ. Code §§ 1946.2, 1947.12.",
    timing: "at-signing",
  },
  {
    id: "deposit-cap",
    label: "Security deposit within the legal cap",
    detail: "One month's rent since AB 12 took effect on 1 July 2024, counting pet deposits and last month's rent. A narrow exception lets a natural person owning no more than two properties and four units take two months — never from a service member.",
    timing: "at-signing",
  },
  {
    id: "deposit-return",
    label: "Deposit returned within 21 days, itemised",
    detail: "With an itemised statement, and — since AB 2801 — photographs supporting any deduction. Cal. Civ. Code § 1950.5.",
    timing: "at-move-out",
  },
];

/**
 * Which state requirements the Davis Model Lease already discharges, by section.
 *
 * Read off the 3 March 2022 document itself — it carries the Megan's Law notice
 * at § 26 and the AB 1482 statement at § 23, and its § 8 and § 22 set out the
 * 21-day itemised deposit return.
 */
const DAVIS_MODEL_COVERAGE: Record<string, string> = {
  "megans-law": "Already in the Model Lease, § 26",
  ab1482: "Already in the Model Lease, § 23",
  "deposit-return": "Set out in the Model Lease, §§ 8 and 22",
  utilities: "Filled in at § 9 of the Model Lease",
  smoking: "Not covered — add it as an addendum under § 10",
};

/** Article 18.11 of the Davis Municipal Code, on top of the state list. */
const DAVIS_REQUIREMENTS: LeaseRequirement[] = [
  {
    id: "davis-registration",
    label: "Register the unit with the City of Davis",
    detail: "No unit may be let unless it is registered with the Rental Resources Program. Davis Municipal Code, Art. 18.11.",
    timing: "before-signing",
  },
  {
    id: "davis-local-contact",
    label: "Name a local contact if you live more than 50 miles away",
    detail: "Someone within 50 miles with full authority to act for the owner, and not a tenant. Contact details must be updated within 60 days of any change.",
    timing: "before-signing",
  },
  {
    id: "davis-rights-form",
    label: "Give the tenant the City's Tenants' Rights and Responsibilities form",
    detail: "Required before the tenancy starts and again at every renewal, on the City's form or one it has approved.",
    timing: "before-signing",
  },
  {
    id: "davis-rights-form-renewal",
    label: "Re-issue the rights form at renewal",
    detail: "The same obligation applies each time the lease is renewed, not only at the first signing.",
    timing: "at-renewal",
  },
  {
    id: "davis-move-in-checklist",
    label: "Joint move-in inspection within five business days",
    detail: "Owner and tenant walk the unit together on the City's Move In/Move Out Checklist. It is also what makes a deposit deduction defensible later.",
    timing: "within-5-days",
  },
  // The rest come from the Model Lease's own text, not from the City.
  {
    id: "dml-inventory",
    label: "Signed inventory statement within seven days",
    detail: "§ 21 of the Model Lease: both parties sign and hold a copy of the condition inventory within seven days of the tenant taking possession. Separate from the City's checklist, and the thing that decides deposit arguments a year later.",
    timing: "within-7-days",
  },
  {
    id: "dml-preinspection",
    label: "Offer the pre-move-out inspection in writing",
    detail: "§ 22: tell the tenant in writing that they may request an inspection and be present at it, give 48 hours' notice of it, and include the statutory abandoned-property paragraph. Cal. Civ. Code § 1950.5(f).",
    timing: "at-move-out",
  },
  {
    id: "dml-deposit-hold",
    label: "Deposit released only when every tenant has gone",
    detail: "§§ 7 and 22: no partial refunds to individual tenants while the tenancy continues, and nothing is released until all occupants have vacated and all keys are back.",
    timing: "at-move-out",
  },
];

export const LEASE_TEMPLATES: LeaseTemplateOption[] = [
  {
    id: "davis-model",
    name: "Davis Model Lease",
    tagline: "The standard the Davis student market already knows",
    jurisdiction: "Davis, CA",
    bestFor: "Student and shared housing near UC Davis",
    sourceUrl: "https://resources.ucdavis.edu/model-lease",
    documentUrl:
      "https://resources.ucdavis.edu/sites/g/files/dgvnsk15086/files/inline-files/Model%20Lease%20%28Last%20updated%203.2.22%29.pdf",
    sourceNote:
      "Owned by ASUCD, last updated 2 March 2022 — nine pages plus signature sheets for up to nine tenants. Free to use: download it, fill in the blanks, sign it, and attach it here. Landlords who adopt it can ask ASUCD Housing Advising to add their property to the published list of adoptees, which is worth something to a student comparing three places in an afternoon.",
    defaults: { lateFeePercent: 5, gracePeriodDays: 5, autoRenew: false, termMonths: 12 },
    highlights: [
      "Every tenant is jointly and severally liable — each is answerable for the whole rent, not a share (§ 11)",
      "Holding over creates no month-to-month tenancy; any renewal must be a separate writing (§§ 1 and 25)",
      "Subletting and assignment need written consent, which may not be unreasonably withheld (§ 32)",
      "The late charge and the day it bites are blanks you fill in — the lease sets no figure (§ 5)",
      "Bounced cheques: up to $25 for the first, $35 thereafter, per Civ. Code § 1719 (§ 5)",
      "Disputes may go to mediation, e.g. the Yolo Conflict Resolution Center (§ 28)",
    ],
    terms:
      "This tenancy is on the Davis Model Lease (ASUCD, last updated 2 March 2022), signed separately and attached to this record. " +
      "The figures held here — rent, deposit, term, late charge and grace period — are the ones written into §§ 1, 3, 5 and 6 of that document; where they differ, the signed document governs. " +
      "Tenants are jointly and severally liable under § 11, and the term ends without further notice under § 1: holding over creates no month-to-month tenancy, and any renewal is a separate writing. " +
      "City of Davis requirements apply alongside it: the unit is registered under Article 18.11, the tenant has the City's Tenants' Rights and Responsibilities form, a joint move-in inspection follows on the City's checklist within five business days, and the § 21 inventory statement is signed by both parties within seven days.",
    extraRequirements: DAVIS_REQUIREMENTS,
  },
  {
    id: "ca-standard",
    name: "California Standard Residential Lease",
    tagline: "An ordinary fixed-term California tenancy",
    jurisdiction: "California",
    bestFor: "Family, professional and non-student tenancies anywhere in the state",
    sourceNote:
      "Use your own lease form or your attorney's. RentOS records the commercial terms and tracks the disclosures the state requires; it does not draft the document for you.",
    defaults: { lateFeePercent: 5, gracePeriodDays: 5, autoRenew: false, termMonths: 12 },
    terms:
      "A fixed-term residential tenancy under California law, on the lease form signed separately and attached to this record. " +
      "The figures held here — rent, deposit, term, late fee and grace period — record what was agreed; where they differ from the signed document, the signed document governs. " +
      "The late fee stated is agreed to be a reasonable estimate of the costs a late payment causes, not a penalty. " +
      "The security deposit is held under Civil Code § 1950.5 and returned within 21 days of the tenancy ending, with an itemised statement of any deduction.",
    extraRequirements: [],
  },
];

export function getLeaseTemplate(id: string | undefined | null): LeaseTemplateOption | null {
  return LEASE_TEMPLATES.find((t) => t.id === id) ?? null;
}

/**
 * Everything to be done for a tenancy on this template, in the order it falls
 * due — state requirements first, then whatever the locality adds.
 */
export function requirementsFor(
  templateId: string | undefined | null,
  options: { builtBefore1978?: boolean } = {}
): LeaseRequirement[] {
  const template = getLeaseTemplate(templateId);

  // Annotated rather than removed: the landlord still has to know the duty
  // exists, they just do not have to go and do anything about it separately.
  const state = CALIFORNIA_REQUIREMENTS.map((req) =>
    templateId === "davis-model" && DAVIS_MODEL_COVERAGE[req.id]
      ? { ...req, coveredBy: DAVIS_MODEL_COVERAGE[req.id] }
      : req
  );

  const all = [...state, ...(template?.extraRequirements ?? [])];
  // A lead paint disclosure on a building from 2015 is noise, and noise is how
  // a checklist stops being read.
  return options.builtBefore1978 ? all : all.filter((r) => !r.pre1978Only);
}

/**
 * Whether a deposit is over what California allows, in the landlord's words.
 *
 * A warning rather than a block: the small-landlord exception turns on facts
 * RentOS does not hold — whether the owner is a natural person, and how many
 * units they own elsewhere — and refusing the write outright would be wrong
 * for the landlords the exception exists for.
 */
export function securityDepositWarning(
  rentAmount: number,
  securityDeposit: number
): string | null {
  if (!Number.isFinite(rentAmount) || rentAmount <= 0) return null;
  if (!Number.isFinite(securityDeposit) || securityDeposit <= 0) return null;

  const months = securityDeposit / rentAmount;
  if (months <= 1) return null;

  if (months <= 2) {
    return (
      `That deposit is ${months.toFixed(1)}× the monthly rent. Since AB 12 the cap is one month — ` +
      "two only if you are a natural person owning no more than two rental properties and four units " +
      "in total, and never for a service member."
    );
  }
  return (
    `That deposit is ${months.toFixed(1)}× the monthly rent, over the legal maximum in every case. ` +
    "California caps residential deposits at one month's rent, or two under the narrow small-landlord " +
    "exception. Pet deposits and last month's rent count toward it."
  );
}

/** The end date the template's term implies, given a start date. */
export function termEndDate(templateId: string | undefined | null, startDate: string): string {
  const months = getLeaseTemplate(templateId)?.defaults.termMonths ?? 12;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return "";
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  // A lease running 1 Sep to 1 Sep overlaps itself at both ends, and the
  // renewal then looks like a double booking on the unit.
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
