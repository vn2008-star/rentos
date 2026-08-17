import type { Lease, Organization, Property, Tenant, Transaction, Unit } from "./types";

/**
 * Rent receipts, and the three-day notice to pay rent or quit.
 *
 * These are the two pieces of paper a landlord hands a tenant about money, and
 * they sit at opposite ends of the same relationship: one says "you paid", the
 * other says "you did not, and here is what happens next". Both are governed,
 * and the notice is governed strictly — a defective one is not a weaker notice,
 * it is a void one, and the unlawful detainer built on it gets dismissed.
 *
 * The rules encoded here, with citations, because anyone maintaining this needs
 * to be able to check them:
 *
 *   · Only RENT may be demanded. A notice that also asks for late fees,
 *     utilities, parking or damages is void — CCP § 1161(2) and a long line of
 *     cases on overstated demands. This is the single most common defect, and
 *     the reason the amount here deliberately disagrees with the rent roll.
 *   · Only rent falling due in the past twelve months — CCP § 1161(2).
 *   · Three days, not counting the day of service, and not counting Saturdays,
 *     Sundays or judicial holidays — CCP § 1161 as amended by AB 2343 (2019).
 *   · The notice must name the person to whom rent is due with their telephone
 *     number and address, and either the usual days and hours they can be paid
 *     in person, or the bank and account where payment may be made, or an
 *     electronic method the tenant already agreed to — CCP § 1161(2).
 *   · A tenant who pays is entitled to a receipt on demand — Civ. Code § 1499.
 *
 * None of this is legal advice and the UI says so. What the code can do is
 * refuse to produce a document that is obviously defective, and show its
 * working.
 */

// ============================================
// Judicial holidays
// ============================================

/** Weekday of the nth occurrence in a month, e.g. 3rd Monday of January. */
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7));
}

/** Weekday of the last occurrence in a month, e.g. last Monday of May. */
function lastWeekday(year: number, month: number, weekday: number): Date {
  const last = new Date(Date.UTC(year, month + 1, 0));
  const back = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, month + 1, 0 - back));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Courts observe a holiday falling on a Saturday on the Friday before, and one
 * falling on a Sunday on the Monday after. The observed day is the one that
 * stops the clock, so that is the day recorded.
 */
function observed(d: Date): Date {
  const day = d.getUTCDay();
  if (day === 6) return new Date(d.getTime() - 86400000);
  if (day === 0) return new Date(d.getTime() + 86400000);
  return d;
}

/**
 * California judicial holidays for a year — CCP § 135, which adopts the state
 * holidays in Gov. Code § 6700 with exceptions.
 *
 * Computed rather than listed, so this does not quietly expire: a hardcoded
 * table would start producing wrong deadlines the first January nobody updated
 * it, and a wrong deadline on this document is a void notice.
 *
 * Deliberately excluded, per § 135: Lunar New Year, Diwali, Genocide
 * Remembrance Day, Admission Day and Columbus Day are state holidays but not
 * judicial ones.
 */
export function judicialHolidays(year: number): Set<string> {
  const fixed = [
    new Date(Date.UTC(year, 0, 1)),   // New Year's Day
    new Date(Date.UTC(year, 1, 12)),  // Lincoln Day
    new Date(Date.UTC(year, 2, 31)),  // César Chávez Day
    new Date(Date.UTC(year, 5, 19)),  // Juneteenth
    new Date(Date.UTC(year, 6, 4)),   // Independence Day
    new Date(Date.UTC(year, 10, 11)), // Veterans Day
    new Date(Date.UTC(year, 11, 25)), // Christmas Day
  ].map(observed);

  const thanksgiving = nthWeekday(year, 10, 4, 4);
  const floating = [
    nthWeekday(year, 0, 1, 3),        // MLK Jr Day — 3rd Monday in January
    nthWeekday(year, 1, 1, 3),        // Presidents' Day — 3rd Monday in February
    lastWeekday(year, 4, 1),          // Memorial Day — last Monday in May
    nthWeekday(year, 8, 1, 1),        // Labor Day — 1st Monday in September
    nthWeekday(year, 8, 5, 4),        // Native American Day — 4th Friday in September
    thanksgiving,
    new Date(thanksgiving.getTime() + 86400000), // the Friday after
  ];

  return new Set([...fixed, ...floating].map(iso));
}

/** Saturdays, Sundays and judicial holidays do not count toward the three days. */
export function isCountableDay(date: Date, holidays?: Set<string>): boolean {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  const set = holidays ?? judicialHolidays(date.getUTCFullYear());
  return !set.has(iso(date));
}

/**
 * The date by which the tenant must pay or leave.
 *
 * The count starts the day AFTER service and skips weekends and judicial
 * holidays, so a notice served on a Friday before a long weekend can easily run
 * a week. Getting this wrong by a day is how a landlord loses at the hearing.
 */
export function payOrQuitDeadline(servedOn: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(servedOn)) return "";
  const cursor = new Date(`${servedOn}T00:00:00Z`);
  if (Number.isNaN(cursor.getTime())) return "";

  const cache = new Map<number, Set<string>>();
  const holidaysFor = (year: number) => {
    if (!cache.has(year)) cache.set(year, judicialHolidays(year));
    return cache.get(year)!;
  };

  let counted = 0;
  // A guard rather than a while(true): a bug in the holiday table must not spin.
  for (let i = 0; i < 60 && counted < 3; i++) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isCountableDay(cursor, holidaysFor(cursor.getUTCFullYear()))) counted++;
  }
  return counted === 3 ? iso(cursor) : "";
}

/** Every non-countable day between service and the deadline, for the UI. */
export function skippedDays(servedOn: string, deadline: string): { date: string; reason: string }[] {
  if (!servedOn || !deadline) return [];
  const out: { date: string; reason: string }[] = [];
  const cursor = new Date(`${servedOn}T00:00:00Z`);
  const end = new Date(`${deadline}T00:00:00Z`);
  const cache = new Map<number, Set<string>>();

  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor > end) break;
    const year = cursor.getUTCFullYear();
    if (!cache.has(year)) cache.set(year, judicialHolidays(year));
    const day = cursor.getUTCDay();
    if (day === 0 || day === 6) {
      out.push({ date: iso(cursor), reason: day === 0 ? "Sunday" : "Saturday" });
    } else if (cache.get(year)!.has(iso(cursor))) {
      out.push({ date: iso(cursor), reason: "Judicial holiday" });
    }
  }
  return out;
}

// ============================================
// What may be demanded
// ============================================

export interface RentPeriodOwed {
  /** The month the rent fell due, as yyyy-MM. */
  period: string;
  dueDate: string;
  charged: number;
  paid: number;
  owed: number;
}

export interface RentDemand {
  periods: RentPeriodOwed[];
  total: number;
  /** Charges deliberately left out, and why — shown so nobody re-adds them. */
  excluded: { label: string; amount: number; reason: string }[];
  /** Rent older than twelve months, which cannot be demanded in this notice. */
  barredTotal: number;
}

const monthKey = (isoDate: string) => isoDate.slice(0, 7);
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The rent-only balance a three-day notice may demand.
 *
 * Built from the lease and the payments actually received, because that is what
 * this app stores: rent is charged by the lease each month, and Transactions
 * record money coming in. There is no ledger of unpaid invoices to read.
 *
 * Payments are applied oldest month first, which is both the convention and the
 * reading most favourable to the tenant — it clears the arrears that would
 * otherwise fall outside the twelve-month window first.
 *
 * The rent roll's figure is deliberately a different number: it adds the late
 * fee. Demanding a late fee in this notice voids it, so the fee is reported
 * here as excluded rather than quietly folded in.
 */
export function buildRentDemand(input: {
  lease: Pick<Lease, "id" | "rentAmount" | "startDate" | "lateFeePercent" | "gracePeriodDays">;
  transactions: Pick<Transaction, "leaseId" | "type" | "amount" | "status" | "date">[];
  asOf: string;
}): RentDemand {
  const { lease, transactions, asOf } = input;

  const asOfDate = new Date(`${asOf.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(asOfDate.getTime())) {
    return { periods: [], total: 0, excluded: [], barredTotal: 0 };
  }

  const start = new Date(`${(lease.startDate || asOf).slice(0, 7)}-01T00:00:00Z`);
  const cutoff = new Date(asOfDate);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);

  // Every month of rent that has fallen due, from the start of the tenancy.
  const charges: { period: string; dueDate: string; charged: number; paid: number }[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < 600 && cursor <= asOfDate; i++) {
    const dueDate = iso(cursor);
    charges.push({ period: monthKey(dueDate), dueDate, charged: lease.rentAmount, paid: 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  // Rent received, oldest first, applied to the oldest month still outstanding.
  const received = transactions
    .filter((t) => t.leaseId === lease.id && t.type === "rent" && t.status === "completed")
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  let pot = received.reduce((sum, t) => sum + t.amount, 0);
  for (const charge of charges) {
    if (pot <= 0) break;
    const applied = Math.min(pot, charge.charged);
    charge.paid = applied;
    pot -= applied;
  }

  const outstanding = charges
    .map((c) => ({ ...c, owed: round2(Math.max(0, c.charged - c.paid)) }))
    .filter((c) => c.owed > 0);

  // CCP § 1161(2): this notice reaches back twelve months and no further.
  // Older arrears are still owed — they are simply not this notice's business,
  // and including them overstates the demand, which is fatal to it.
  const demandable = outstanding.filter((c) => new Date(`${c.dueDate}T00:00:00Z`) >= cutoff);
  const barred = outstanding.filter((c) => new Date(`${c.dueDate}T00:00:00Z`) < cutoff);

  const total = round2(demandable.reduce((s, c) => s + c.owed, 0));

  // The one charge a landlord is most likely to add by hand, named explicitly
  // so the omission reads as deliberate rather than as an error in the total.
  const excluded: RentDemand["excluded"] = [];
  if (total > 0) {
    const percent = lease.lateFeePercent || 0;
    if (percent > 0) {
      excluded.push({
        label: "Late fee",
        amount: round2(lease.rentAmount * (percent / 100)),
        reason: "Only rent may be demanded in a three-day notice — CCP § 1161(2)",
      });
    }
  }

  return {
    periods: demandable.map(({ period, dueDate, charged, paid, owed }) => ({
      period, dueDate, charged, paid, owed,
    })),
    total,
    excluded,
    barredTotal: round2(barred.reduce((s, c) => s + c.owed, 0)),
  };
}

// ============================================
// Notice validity
// ============================================

export interface NoticePayeeDetails {
  name: string;
  phone: string;
  address: string;
  /** Required when rent is payable in person. */
  hours?: string;
  method: "in_person" | "bank" | "electronic";
  /** Required for the bank method. */
  bankName?: string;
  accountNumber?: string;
  /** Required for the electronic method — one the tenant already agreed to. */
  electronicDescription?: string;
}

export interface NoticeProblem {
  field: string;
  message: string;
  /** A blocker voids the notice; a warning is worth a second look. */
  severity: "blocker" | "warning";
}

/**
 * Everything that would make this notice void or arguable, before it is served.
 *
 * Refusing to generate a defective notice is the whole value here: the landlord
 * finds out now, not in a courtroom three weeks later when the case is
 * dismissed and the clock restarts.
 */
export function checkNotice(input: {
  demand: RentDemand;
  payee: Partial<NoticePayeeDetails>;
  tenantNames: string[];
  unitAddress: string;
  servedOn: string;
}): NoticeProblem[] {
  const { demand, payee, tenantNames, unitAddress, servedOn } = input;
  const problems: NoticeProblem[] = [];

  if (demand.total <= 0) {
    problems.push({
      field: "amount",
      severity: "blocker",
      message: "No rent is currently outstanding on this lease — there is nothing to demand.",
    });
  }
  if (!tenantNames.filter(Boolean).length) {
    problems.push({ field: "tenants", severity: "blocker", message: "The notice must name the tenants." });
  }
  if (!unitAddress.trim()) {
    problems.push({ field: "address", severity: "blocker", message: "The notice must state the address of the premises, including any unit number." });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(servedOn)) {
    problems.push({ field: "servedOn", severity: "blocker", message: "A service date is needed to compute the deadline." });
  }

  if (!payee.name?.trim()) {
    problems.push({ field: "payee.name", severity: "blocker", message: "Name the person or company to whom the rent is due — CCP § 1161(2)." });
  }
  if (!payee.phone?.trim()) {
    problems.push({ field: "payee.phone", severity: "blocker", message: "A telephone number for the person to be paid is required — CCP § 1161(2)." });
  }
  if (!payee.address?.trim()) {
    problems.push({ field: "payee.address", severity: "blocker", message: "An address for payment is required — CCP § 1161(2)." });
  }

  if (payee.method === "in_person" && !payee.hours?.trim()) {
    problems.push({
      field: "payee.hours",
      severity: "blocker",
      message: "State the usual days and hours the tenant can pay in person — CCP § 1161(2).",
    });
  }
  if (payee.method === "bank" && !(payee.bankName?.trim() && payee.accountNumber?.trim())) {
    problems.push({
      field: "payee.bank",
      severity: "blocker",
      message: "Naming a bank means giving its name and the account number — CCP § 1161(2).",
    });
  }
  if (payee.method === "electronic" && !payee.electronicDescription?.trim()) {
    problems.push({
      field: "payee.electronic",
      severity: "blocker",
      message: "Describe the electronic payment method, which must be one the tenant already agreed to.",
    });
  }

  if (demand.excluded.length) {
    problems.push({
      field: "excluded",
      severity: "warning",
      message:
        `${demand.excluded.length} non-rent charge${demand.excluded.length === 1 ? "" : "s"} ` +
        "were left out of the demand on purpose. Adding them back would void the notice.",
    });
  }
  if (demand.barredTotal > 0) {
    problems.push({
      field: "barred",
      severity: "warning",
      message:
        `$${demand.barredTotal.toLocaleString()} of rent is more than twelve months old and cannot be ` +
        "demanded here. It is still owed — it just needs a different action.",
    });
  }

  return problems;
}

// ============================================
// Receipts
// ============================================

/**
 * A receipt number a tenant can quote and a landlord can find again.
 *
 * Derived from the payment rather than a counter, so the same payment always
 * produces the same number however many times it is reprinted — two receipts
 * with different numbers for one payment is precisely the confusion a receipt
 * exists to prevent.
 */
export function receiptNumber(payment: Pick<Transaction, "id" | "date">): string {
  const when = (payment.date || "").slice(0, 10).replace(/-/g, "");
  const tail = payment.id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return `R-${when || "00000000"}-${tail || "000000"}`;
}

export interface ReceiptView {
  number: string;
  issuedFor: string;
  paidOn: string;
  amount: number;
  method: string;
  period: string;
  tenantName: string;
  unitLabel: string;
  propertyName: string;
  landlordName: string;
  /** What remains on the lease for that period after this payment. */
  balanceAfter: number;
}

export function buildReceipt(input: {
  payment: Transaction;
  transactions: Pick<Transaction, "leaseId" | "type" | "amount" | "status" | "date">[];
  lease: Pick<Lease, "id" | "rentAmount"> | null;
  tenant: Pick<Tenant, "firstName" | "lastName"> | null;
  unit: Pick<Unit, "unitNumber"> | null;
  property: Pick<Property, "name" | "address"> | null;
  org: Pick<Organization, "name"> | null;
}): ReceiptView {
  const { payment, transactions, lease, tenant, unit, property, org } = input;
  const period = monthKey(payment.date || "");

  const paidForPeriod = transactions
    .filter(
      (t) =>
        t.leaseId === payment.leaseId &&
        t.type === "rent" &&
        t.status === "completed" &&
        monthKey(t.date || "") === period
    )
    .reduce((s, t) => s + t.amount, 0);

  return {
    number: receiptNumber(payment),
    issuedFor: payment.type.replace(/_/g, " "),
    paidOn: (payment.date || "").slice(0, 10),
    amount: payment.amount,
    method: payment.stripePaymentIntentId ? "Card, through RentOS" : "Recorded by the landlord",
    period,
    tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}` : "Tenant",
    unitLabel: unit ? `Unit ${unit.unitNumber}` : "Unit",
    propertyName: property
      ? `${property.name}${property.address ? `, ${property.address.street}, ${property.address.city}` : ""}`
      : "",
    landlordName: org?.name ?? "",
    balanceAfter:
      payment.type === "rent" && lease
        ? round2(Math.max(0, lease.rentAmount - paidForPeriod))
        : 0,
  };
}
