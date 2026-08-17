/**
 * Unit tests for the app's pure logic.
 *
 * Run: npm test
 *
 * Scope is deliberately the code that decides things — money, dates, statuses,
 * scores. UI components and Firestore access are not covered here; the rules
 * have their own suite in firestore.rules.test.mjs.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  isRentOverdue, generateRentRoll, getExpiringLeases, calculateMonthlyFinancials,
} from "../src/lib/rent-automation";
import { buildReminders } from "../src/lib/reminders";
import {
  getStatusStep, getReporterLabel, getReporterBadge, formatTimeAgo,
} from "../src/lib/maintenance-engine";
import { getScoreInfo, getCreditScoreColor } from "../src/lib/screening";
import { scoreReference } from "../src/lib/references";
import { buildRevenueHistory, summariseRevenue, isEmptyHistory } from "../src/lib/finance";
import {
  generateListingTitle, calculateDaysOnMarket, getListingStats, calculateSTRRate,
} from "../src/lib/listing-generator";
import {
  projectSublet, isAdvertisable, overlaps, subletFeedDisabled,
} from "../src/lib/public-sublets";
import { defaultLeaseTerm, checkMoveIn } from "../src/lib/move-in";
import {
  checkTenantSignature, checkRenewalResponse, signingActivatesLease,
  unitOccupancyForLease,
} from "../src/lib/lease-actions";
import { buildSetupSteps, setupProgress } from "../src/lib/getting-started";
import {
  resolveCollection, applyCollectionWrite, type CollectionState,
} from "../src/lib/collection-state";
import type {
  Lease, PaymentRecord, Transaction, MaintenanceRequest, Tenant, Unit, Property,
  Listing, Inspection, KeyRecord, STRPricing,
} from "../src/lib/types";

// ---------------------------------------------------------------- fixtures

const ISO = (d: string) => new Date(d).toISOString();

function lease(over: Partial<Lease> = {}): Lease {
  return {
    id: "lease-1", orgId: "org-1", unitId: "unit-1", propertyId: "prop-1",
    tenantIds: ["tenant-1"], status: "active",
    startDate: "2024-09-01", endDate: "2025-08-31",
    rentAmount: 2000, securityDeposit: 2000,
    lateFeePercent: 5, gracePeriodDays: 5, autoRenew: false,
    documents: [], signatures: [],
    createdAt: ISO("2024-08-01"), updatedAt: ISO("2024-08-01"),
    ...over,
  };
}

function payment(over: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: "pay-1", orgId: "org-1", tenantId: "tenant-1", leaseId: "lease-1",
    unitId: "unit-1", propertyId: "prop-1", type: "rent", amount: 2000,
    dueDate: "2025-03-01", status: "paid", paidDate: "2025-03-01",
    createdAt: ISO("2025-03-01"),
    ...over,
  } as PaymentRecord;
}

function txn(over: Partial<Transaction> = {}): Transaction {
  return {
    id: "txn-1", orgId: "org-1", type: "rent", amount: 2000,
    date: "2025-03-05", description: "March rent", status: "completed",
    createdAt: ISO("2025-03-05"),
    ...over,
  };
}

function unit(over: Partial<Unit> = {}): Unit {
  return {
    id: "unit-1", orgId: "org-1", propertyId: "prop-1", unitNumber: "101",
    status: "available", beds: 2, baths: 1, sqft: 850, rent: 1800, deposit: 1800,
    photos: [], amenities: [], createdAt: ISO("2024-01-01"), updatedAt: ISO("2024-01-01"),
    ...over,
  };
}

function property(over: Partial<Property> = {}): Property {
  return {
    id: "prop-1", orgId: "org-1", name: "University Commons", type: "apartment",
    address: { street: "200 Russell Blvd", city: "Davis", state: "CA", zip: "95616" },
    photos: [], amenities: [], totalUnits: 24, occupiedUnits: 21,
    createdAt: ISO("2024-01-01"), updatedAt: ISO("2024-01-01"),
    ...over,
  } as Property;
}

function tenant(over: Partial<Tenant> = {}): Tenant {
  return {
    id: "tenant-1", orgId: "org-1", firstName: "Sarah", lastName: "Chen",
    email: "sarah@example.com", phone: "(530) 555-0101",
    createdAt: ISO("2024-08-01"), updatedAt: ISO("2024-08-01"),
    ...over,
  };
}

function maintenance(over: Partial<MaintenanceRequest> = {}): MaintenanceRequest {
  return {
    id: "maint-1", orgId: "org-1", unitId: "unit-1", propertyId: "prop-1",
    category: "plumbing", priority: "routine", status: "submitted",
    title: "Leaky tap", description: "Drips overnight", photos: [],
    completionPhotos: [],
    createdAt: ISO("2025-03-01"), updatedAt: ISO("2025-03-01"),
    ...over,
  } as MaintenanceRequest;
}

// ================================================================ rent

describe("isRentOverdue", () => {
  test("rent paid this month is never overdue, even late in the month", () => {
    const result = isRentOverdue(
      lease(),
      [payment({ paidDate: "2025-03-02", status: "paid" })],
      new Date("2025-03-28T12:00:00Z")
    );
    assert.equal(result.overdue, false);
    assert.equal(result.lateFeeAmount, 0);
  });

  test("unpaid but still inside the grace period is not overdue", () => {
    const result = isRentOverdue(lease(), [], new Date("2025-03-04T12:00:00Z"));
    assert.equal(result.overdue, false);
    assert.equal(result.daysPastDue, 0);
  });

  test("unpaid past the grace period is overdue and charges the lease's percentage", () => {
    const result = isRentOverdue(lease(), [], new Date("2025-03-12T12:00:00Z"));
    assert.equal(result.overdue, true);
    // 5% of 2000
    assert.equal(result.lateFeeAmount, 100);
    assert.ok(result.daysPastDue > 0, "should report days past due");
  });

  test("a longer grace period delays the late fee", () => {
    const generous = lease({ gracePeriodDays: 20 });
    const result = isRentOverdue(generous, [], new Date("2025-03-12T12:00:00Z"));
    assert.equal(result.overdue, false, "still inside a 20 day grace period");
  });

  test("falls back to default policy when the lease omits it", () => {
    const bare = lease({ lateFeePercent: 0, gracePeriodDays: 0 });
    const result = isRentOverdue(bare, [], new Date("2025-03-20T12:00:00Z"));
    assert.equal(result.overdue, true);
    // 0 is falsy, so the 5% default applies
    assert.equal(result.lateFeeAmount, 100);
  });

  test("a payment for a different lease does not clear this one", () => {
    const result = isRentOverdue(
      lease(),
      [payment({ leaseId: "lease-OTHER", paidDate: "2025-03-02" })],
      new Date("2025-03-20T12:00:00Z")
    );
    assert.equal(result.overdue, true);
  });

  test("a pending payment does not clear the debt", () => {
    const result = isRentOverdue(
      lease(),
      [payment({ status: "pending", paidDate: undefined })],
      new Date("2025-03-20T12:00:00Z")
    );
    assert.equal(result.overdue, true);
  });
});

describe("generateRentRoll", () => {
  const march = new Date("2025-03-20T12:00:00Z");

  test("only active and month-to-month leases appear", () => {
    const roll = generateRentRoll(
      [
        lease({ id: "a", status: "active" }),
        lease({ id: "b", status: "month_to_month" }),
        lease({ id: "c", status: "terminated" }),
        lease({ id: "d", status: "draft" }),
      ],
      [],
      march
    );
    assert.deepEqual(roll.map(r => r.leaseId).sort(), ["a", "b"]);
  });

  test("a full payment reads as paid", () => {
    const [entry] = generateRentRoll(
      [lease()],
      [payment({ amount: 2000, dueDate: "2025-03-01", status: "paid", paidDate: "2025-03-01" })],
      march
    );
    assert.equal(entry.status, "paid");
    assert.equal(entry.paidAmount, 2000);
    assert.equal(entry.lateFee, 0);
  });

  test("a part payment reads as partial", () => {
    const [entry] = generateRentRoll(
      [lease()],
      [payment({ amount: 500, dueDate: "2025-03-01", status: "paid", paidDate: "2025-03-01" })],
      march
    );
    assert.equal(entry.status, "partial");
    assert.equal(entry.paidAmount, 500);
  });

  test("nothing paid past grace reads as overdue and carries the late fee", () => {
    const [entry] = generateRentRoll([lease()], [], march);
    assert.equal(entry.status, "overdue");
    assert.equal(entry.lateFee, 100);
    assert.equal(entry.totalDue, 2100);
  });

  test("totalDue reflects what is still owed after a part payment", () => {
    const [entry] = generateRentRoll(
      [lease()],
      [payment({ amount: 500, dueDate: "2025-03-01", status: "paid", paidDate: "2025-03-01" })],
      march
    );
    // 2000 rent - 500 paid = 1500 outstanding. Billing the full 2000 again
    // would double-charge a tenant who has already part-paid.
    assert.equal(entry.totalDue, 1500);
  });
});

describe("getExpiringLeases", () => {
  test("finds leases ending inside the window", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 10);
    const found = getExpiringLeases([lease({ endDate: soon.toISOString().slice(0, 10) })], 30);
    assert.equal(found.length, 1);
  });

  test("ignores leases ending beyond the window", () => {
    const later = new Date();
    later.setDate(later.getDate() + 120);
    const found = getExpiringLeases([lease({ endDate: later.toISOString().slice(0, 10) })], 30);
    assert.equal(found.length, 0);
  });

  test("ignores leases that already ended long ago", () => {
    // "Expiring" means about to expire. A lease that ended two years ago is a
    // data-hygiene problem, not something to put on a renewals list.
    const found = getExpiringLeases([lease({ endDate: "2023-01-01" })], 30);
    assert.equal(found.length, 0);
  });

  test("ignores terminated leases", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 5);
    const found = getExpiringLeases(
      [lease({ status: "terminated", endDate: soon.toISOString().slice(0, 10) })], 30
    );
    assert.equal(found.length, 0);
  });
});

describe("calculateMonthlyFinancials", () => {
  const march = new Date("2025-03-15T12:00:00Z");

  test("sums income and expenses for the month and nets them", () => {
    const result = calculateMonthlyFinancials(
      [
        txn({ id: "1", type: "rent", amount: 2000, date: "2025-03-01" }),
        txn({ id: "2", type: "late_fee", amount: 100, date: "2025-03-08" }),
        txn({ id: "3", type: "maintenance", amount: 350, date: "2025-03-10" }),
      ],
      march
    );
    assert.equal(result.revenue, 2100);
    assert.equal(result.expenses, 350);
    assert.equal(result.net, 1750);
    assert.equal(result.transactionCount, 3);
  });

  test("excludes other months", () => {
    const result = calculateMonthlyFinancials(
      [txn({ type: "rent", amount: 2000, date: "2025-02-01" })],
      march
    );
    assert.equal(result.revenue, 0);
    assert.equal(result.transactionCount, 0);
  });

  test("excludes failed and pending transactions", () => {
    const result = calculateMonthlyFinancials(
      [
        txn({ id: "1", status: "failed", amount: 2000, date: "2025-03-01" }),
        txn({ id: "2", status: "pending", amount: 2000, date: "2025-03-02" }),
      ],
      march
    );
    assert.equal(result.revenue, 0);
  });
});

// ================================================================ reminders

describe("buildReminders", () => {
  const base = { leases: [], inspections: [], maintenance: [], keys: [], units: [], tenants: [] };
  const inDays = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  test("raises a renewal as a lease approaches its end", () => {
    const out = buildReminders({ ...base, leases: [lease({ endDate: inDays(20) })], units: [unit()] });
    assert.equal(out.length, 1);
    assert.equal(out[0].kind, "lease_renewal");
    assert.equal(out[0].severity, "warning");
  });

  test("stays quiet for a lease far in the future", () => {
    const out = buildReminders({ ...base, leases: [lease({ endDate: inDays(200) })] });
    assert.equal(out.length, 0);
  });

  test("an expired lease with no decision is critical", () => {
    const out = buildReminders({ ...base, leases: [lease({ endDate: inDays(-5) })], units: [unit()] });
    assert.equal(out[0].kind, "lease_expiring");
    assert.equal(out[0].severity, "critical");
  });

  test("a renewal already decided stops nagging", () => {
    const out = buildReminders({
      ...base,
      leases: [lease({ endDate: inDays(20), renewalDecision: "accepted" })],
    });
    assert.equal(out.length, 0);
  });

  test("an overdue inspection is critical, a completed one is silent", () => {
    const overdue: Inspection = {
      id: "i1", orgId: "org-1", unitId: "unit-1", propertyId: "prop-1",
      type: "move_out", status: "scheduled", scheduledFor: inDays(-2),
      inspectorName: "DHS", areas: [], createdAt: ISO("2025-01-01"), updatedAt: ISO("2025-01-01"),
    };
    const done: Inspection = { ...overdue, id: "i2", status: "completed" };

    const out = buildReminders({ ...base, inspections: [overdue, done], units: [unit()] });
    assert.equal(out.length, 1);
    assert.equal(out[0].kind, "inspection_overdue");
    assert.equal(out[0].severity, "critical");
  });

  test("an urgent maintenance request escalates faster than a routine one", () => {
    const old = new Date();
    old.setDate(old.getDate() - 4);
    const iso = old.toISOString();

    const urgentOnly = buildReminders({
      ...base,
      maintenance: [maintenance({ priority: "urgent", createdAt: iso })],
      units: [unit()],
    });
    const routineOnly = buildReminders({
      ...base,
      maintenance: [maintenance({ priority: "routine", createdAt: iso })],
      units: [unit()],
    });

    assert.equal(urgentOnly.length, 1, "urgent should surface after 3 days");
    assert.equal(routineOnly.length, 0, "routine waits a week");
  });

  test("a completed request never surfaces", () => {
    const old = new Date();
    old.setDate(old.getDate() - 60);
    const out = buildReminders({
      ...base,
      maintenance: [maintenance({ status: "completed", createdAt: old.toISOString() })],
    });
    assert.equal(out.length, 0);
  });

  test("a key still held after the tenancy ended is flagged", () => {
    const key: KeyRecord = {
      id: "k1", orgId: "org-1", unitId: "unit-1", propertyId: "prop-1",
      label: "Front door", kind: "physical", copies: 1, status: "issued",
      holderType: "tenant", holderId: "tenant-1",
      createdAt: ISO("2024-09-01"), updatedAt: ISO("2024-09-01"),
    };
    const out = buildReminders({
      ...base,
      keys: [key],
      leases: [lease({ endDate: inDays(-10) })],
      units: [unit()],
      tenants: [tenant()],
    });
    const keyReminder = out.find(r => r.kind === "key_outstanding");
    assert.ok(keyReminder, "expected a key reminder");
    assert.match(keyReminder!.detail, /Sarah Chen/);
  });

  test("critical reminders sort above warnings", () => {
    const out = buildReminders({
      ...base,
      leases: [lease({ id: "l1", endDate: inDays(-3) }), lease({ id: "l2", endDate: inDays(20) })],
      units: [unit()],
    });
    assert.equal(out[0].severity, "critical");
    assert.equal(out[1].severity, "warning");
  });
});

// ================================================================ maintenance

describe("maintenance engine", () => {
  test("status maps to a progress step", () => {
    assert.equal(getStatusStep(maintenance({ status: "submitted" })), 0);
    assert.ok(getStatusStep(maintenance({ status: "completed" })) > 0);
  });

  test("reporter resolves to the tenant's name when linked", () => {
    const req = maintenance({ tenantId: "tenant-1" });
    assert.match(getReporterLabel(req, [tenant()]), /Sarah/);
  });

  test("reporter badge always returns a label and colour", () => {
    const badge = getReporterBadge(maintenance());
    assert.ok(badge.label.length > 0);
    assert.ok(badge.color.length > 0);
  });

  test("formatTimeAgo describes recent and older moments differently", () => {
    const now = new Date();
    const anHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const longAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString();
    assert.notEqual(formatTimeAgo(anHourAgo), formatTimeAgo(longAgo));
    assert.ok(formatTimeAgo(anHourAgo).length > 0);
  });
});

// ================================================================ screening

describe("screening thresholds", () => {
  test("score bands are contiguous and ordered", () => {
    assert.equal(getScoreInfo(95).label, "Strong");
    assert.equal(getScoreInfo(80).label, "Strong");
    assert.equal(getScoreInfo(79).label, "Acceptable");
    assert.equal(getScoreInfo(65).label, "Acceptable");
    assert.equal(getScoreInfo(64).label, "Conditional");
    assert.equal(getScoreInfo(40).label, "Conditional");
    assert.equal(getScoreInfo(39).label, "High Risk");
    assert.equal(getScoreInfo(0).label, "High Risk");
  });

  test("credit colour bands follow the standard cutoffs", () => {
    assert.notEqual(getCreditScoreColor(760), getCreditScoreColor(710));
    assert.notEqual(getCreditScoreColor(710), getCreditScoreColor(600));
  });
});

describe("scoreReference", () => {
  test("a glowing reference scores at the cap", () => {
    const score = scoreReference({
      wouldRentAgain: true, onTimePayment: "always",
      propertyCondition: "excellent", complaints: false,
    } as never);
    assert.equal(score, 15);
  });

  test("a poor reference scores zero", () => {
    const score = scoreReference({
      wouldRentAgain: false, onTimePayment: "rarely",
      propertyCondition: "poor", complaints: true,
    } as never);
    assert.equal(score, 0);
  });

  test("never exceeds the 15 point weight it is documented to carry", () => {
    const score = scoreReference({
      wouldRentAgain: true, onTimePayment: "always",
      propertyCondition: "excellent", complaints: false,
    } as never);
    assert.ok(score <= 15);
  });
});

// ================================================================ listings

describe("listing generator", () => {
  test("title mentions the bedroom count and the property", () => {
    const title = generateListingTitle(unit({ beds: 2 }), property());
    assert.ok(title.length > 0);
    assert.match(title, /2|Two/i);
  });

  test("a studio is not described as a 0 bedroom", () => {
    const title = generateListingTitle(unit({ beds: 0 }), property());
    assert.doesNotMatch(title, /\b0\s*(BR|bed)/i);
  });

  test("days on market counts from when the listing was created", () => {
    const created = new Date();
    created.setDate(created.getDate() - 7);
    const days = calculateDaysOnMarket({
      createdAt: created.toISOString(), updatedAt: created.toISOString(), status: "active",
    } as Listing);
    assert.ok(days >= 6 && days <= 8, `expected about 7, got ${days}`);
  });

  test("a filled listing stops counting at the day it was filled", () => {
    const created = ISO("2025-01-01");
    const filled = ISO("2025-01-11");
    const days = calculateDaysOnMarket({
      createdAt: created, updatedAt: filled, status: "filled",
    } as Listing);
    assert.equal(days, 10);
  });

  test("stats summarise a mixed set of listings", () => {
    const listings = [
      { id: "1", status: "active", leads: [{}, {}], createdAt: ISO("2025-01-01"), updatedAt: ISO("2025-01-01") },
      { id: "2", status: "filled", leads: [{}, {}, {}], createdAt: ISO("2025-01-01"), updatedAt: ISO("2025-01-11") },
      { id: "3", status: "paused", leads: [], createdAt: ISO("2025-01-01"), updatedAt: ISO("2025-01-01") },
    ] as unknown as Listing[];

    const stats = getListingStats(listings);
    assert.equal(stats.activeCount, 1);
    assert.equal(stats.filledCount, 1);
    assert.equal(stats.pausedCount, 1);
    assert.equal(stats.totalLeads, 5);
    assert.equal(stats.avgDaysOnMarket, 10);
  });

  test("stats do not divide by zero on an empty set", () => {
    const stats = getListingStats([]);
    assert.equal(stats.avgDaysOnMarket, 0);
    assert.equal(stats.conversionRate, 0);
    assert.equal(stats.totalLeads, 0);
  });
});

describe("calculateSTRRate", () => {
  const pricing: STRPricing = {
    baseNightlyRate: 100,
    weekendPremiumPercent: 20,
    seasonalRates: [],
    minimumStay: 2,
    cleaningFee: 75,
    maxGuests: 4,
  } as STRPricing;

  test("a midweek night is the base rate", () => {
    // Wednesday
    assert.equal(calculateSTRRate(pricing, new Date(2025, 2, 5)), 100);
  });

  test("Friday and Saturday carry the weekend premium", () => {
    assert.equal(calculateSTRRate(pricing, new Date(2025, 2, 7)), 120); // Friday
    assert.equal(calculateSTRRate(pricing, new Date(2025, 2, 8)), 120); // Saturday
  });

  test("a seasonal multiplier inside the year applies", () => {
    const summer: STRPricing = {
      ...pricing,
      seasonalRates: [{ name: "Summer", startMonth: 6, endMonth: 8, rateMultiplier: 1.5 }],
    } as STRPricing;
    // Wednesday in July
    assert.equal(calculateSTRRate(summer, new Date(2025, 6, 2)), 150);
  });

  test("a season that wraps the new year still applies", () => {
    // Nov -> Feb is an ordinary way to express a winter season. Comparing
    // month >= start && month <= end can never be true when start > end, so
    // wrapping seasons are silently ignored and the rate is undercharged.
    const winter: STRPricing = {
      ...pricing,
      seasonalRates: [{ name: "Winter", startMonth: 11, endMonth: 2, rateMultiplier: 1.4 }],
    } as STRPricing;
    // Wednesday in January
    assert.equal(calculateSTRRate(winter, new Date(2025, 0, 8)), 140);
    // Wednesday in December
    assert.equal(calculateSTRRate(winter, new Date(2025, 11, 3)), 140);
    // Wednesday in April is outside the season
    assert.equal(calculateSTRRate(winter, new Date(2025, 3, 2)), 100);
  });
});

describe("buildRevenueHistory", () => {
  const NOW = new Date(2026, 7, 11); // 11 Aug 2026

  const txn = (over: Partial<Transaction>): Transaction => ({
    id: "t", orgId: "org-1", type: "rent", amount: 1000,
    date: "2026-08-01T00:00:00.000Z", description: "Rent",
    status: "completed", createdAt: "2026-08-01T00:00:00.000Z",
    ...over,
  }) as Transaction;

  test("returns six months, oldest first, ending with the current one", () => {
    const history = buildRevenueHistory([], 6, NOW);
    assert.equal(history.length, 6);
    assert.deepEqual(history.map(m => m.month), ["Mar", "Apr", "May", "Jun", "Jul", "Aug"]);
    assert.equal(history.at(-1)?.key, "2026-08");
  });

  test("months with no activity stay in the series as zeroes", () => {
    // Dropping them would compress the axis so a quiet year looked like a busy
    // one.
    const history = buildRevenueHistory([txn({})], 6, NOW);
    assert.equal(history.filter(m => m.revenue === 0).length, 5);
  });

  test("rent, deposits and fees count as revenue; maintenance and refunds as expenses", () => {
    const history = buildRevenueHistory([
      txn({ type: "rent", amount: 1800 }),
      txn({ type: "deposit", amount: 900 }),
      txn({ type: "late_fee", amount: 50 }),
      txn({ type: "maintenance", amount: 400 }),
      txn({ type: "refund", amount: 100 }),
    ], 6, NOW);

    const august = history.at(-1)!;
    assert.equal(august.revenue, 2750);
    assert.equal(august.expenses, 500);
  });

  test("only completed transactions count", () => {
    // Booking a declined card as revenue is how a rent roll starts lying.
    const history = buildRevenueHistory([
      txn({ status: "pending", amount: 5000 }),
      txn({ status: "failed", amount: 5000 }),
      txn({ status: "refunded", amount: 5000 }),
      txn({ status: "completed", amount: 1200 }),
    ], 6, NOW);
    assert.equal(history.at(-1)?.revenue, 1200);
  });

  test("payments outside the window are ignored", () => {
    const history = buildRevenueHistory([
      txn({ date: "2025-12-04T00:00:00.000Z", amount: 9999 }),
    ], 6, NOW);
    assert.ok(history.every(m => m.revenue === 0));
  });

  test("a payment late on the last day of a month stays in that month", () => {
    // Parsing the date instead of reading its YYYY-MM would shift this into
    // August for anyone west of UTC, moving revenue between reporting periods.
    const history = buildRevenueHistory([
      txn({ date: "2026-07-31T23:30:00.000Z", amount: 1500 }),
    ], 6, NOW);
    assert.equal(history.find(m => m.key === "2026-07")?.revenue, 1500);
    assert.equal(history.find(m => m.key === "2026-08")?.revenue, 0);
  });

  test("a history spanning a year boundary labels its months correctly", () => {
    const history = buildRevenueHistory([], 6, new Date(2026, 1, 15));
    assert.deepEqual(history.map(m => m.month), ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"]);
    assert.equal(history[0].key, "2025-09");
  });

  test("summarise nets revenue against expenses", () => {
    const history = buildRevenueHistory([
      txn({ type: "rent", amount: 3000 }),
      txn({ type: "maintenance", amount: 800 }),
    ], 6, NOW);
    assert.deepEqual(summariseRevenue(history), { revenue: 3000, expenses: 800, net: 2200 });
  });

  test("an org with nothing recorded is reported as empty, not as zero revenue", () => {
    assert.equal(isEmptyHistory(buildRevenueHistory([], 6, NOW)), true);
    assert.equal(isEmptyHistory(buildRevenueHistory([txn({})], 6, NOW)), false);
  });
});

// ============================================================
// The public sublet projection
//
// A sublet advert is somebody's home, and it says when they will not be in it.
// These tests exist to fail if a field that names the subletter, points at
// their door, or explains their absence ever reaches the public feed.
// ============================================================

describe("public sublet projection", () => {
  const SUBLET = {
    id: "sublet-1",
    orgId: "org-1",
    tenantId: "tenant-SECRET",
    unitId: "unit-1",
    propertyId: "prop-1",
    leaseId: "lease-SECRET",
    status: "active",
    title: "2BR near campus — summer sublet",
    description: "Furnished, bike storage.",
    photos: ["a.jpg"],
    monthlyRent: 1500,
    startDate: "2026-06-15",
    endDate: "2026-08-31",
    reason: "Study abroad in Barcelona all summer",
    submittedAt: "2026-04-01T00:00:00Z",
    reviewedAt: "2026-04-02T00:00:00Z",
    reviewedBy: "manager-SECRET",
    rejectionReason: "",
    guestInfo: {
      name: "Kai Nakamura",
      email: "kai.SECRET@example.com",
      phone: "555-0101",
      university: "UC Berkeley",
      notes: "Summer research intern",
    },
    applicationIds: ["app-SECRET"],
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-04-02T00:00:00Z",
  } as unknown as Parameters<typeof projectSublet>[1];

  const UNIT = {
    id: "unit-1", orgId: "org-1", propertyId: "prop-1",
    unitNumber: "APT-207-SECRET",
    beds: 2, baths: 1, sqft: 850, rent: 1800, deposit: 1800,
    status: "occupied", amenities: ["Balcony"], photos: ["u.jpg"],
    currentTenantId: "tenant-SECRET",
  } as unknown as Parameters<typeof projectSublet>[2];

  const PROPERTY = {
    id: "prop-1", orgId: "org-1", name: "University Commons", type: "apartment",
    address: { street: "1 Russell Blvd", city: "Davis", state: "CA", zip: "95616" },
    amenities: ["Pool"], totalUnits: 32,
  } as unknown as Parameters<typeof projectSublet>[3];

  const ORG = {
    id: "org-1", name: "Davis Housing Services", slug: "davis-housing-services",
  } as unknown as Parameters<typeof projectSublet>[4];

  const projected = projectSublet("sublet-1", SUBLET, UNIT, PROPERTY, ORG);
  const serialised = JSON.stringify(projected);

  test("nothing marked private survives the projection", () => {
    // One assertion over the serialised payload rather than key-by-key: a field
    // added to Sublet later gets caught here even though no test names it.
    assert.equal(
      serialised.includes("SECRET"), false,
      `private data reached the public payload: ${serialised}`
    );
  });

  test("the subletter is not identified", () => {
    assert.equal("tenantId" in projected, false);
    assert.equal("guestInfo" in projected, false);
  });

  test("the reason for the absence is withheld", () => {
    // "Study abroad in Barcelona all summer" is an advert for an empty home.
    assert.equal(serialised.includes("Barcelona"), false);
    assert.equal("reason" in projected, false);
  });

  test("the building is advertised but not which door", () => {
    assert.equal(projected.property?.name, "University Commons");
    assert.equal(projected.property?.address.street, "1 Russell Blvd");
    assert.equal(serialised.includes("APT-207"), false);
  });

  test("the review trail stays internal", () => {
    assert.equal("reviewedBy" in projected, false);
    assert.equal("rejectionReason" in projected, false);
    assert.equal("applicationIds" in projected, false);
  });

  test("what a seeker actually needs is present", () => {
    assert.equal(projected.title, "2BR near campus — summer sublet");
    assert.equal(projected.monthlyRent, 1500);
    assert.equal(projected.startDate, "2026-06-15");
    assert.equal(projected.endDate, "2026-08-31");
    assert.equal(projected.unit?.beds, 2);
    assert.equal(projected.managedBy?.name, "Davis Housing Services");
  });

  test("duration is rounded to whole months", () => {
    assert.equal(projected.months, 3);
  });

  test("a missing unit or property degrades to null, not a crash", () => {
    const bare = projectSublet("s", SUBLET, null, null, null);
    assert.equal(bare.unit, null);
    assert.equal(bare.property, null);
    assert.equal(bare.managedBy, null);
    assert.equal(bare.title, SUBLET.title);
  });
});

describe("sublet advertisability", () => {
  const at = (status: string, endDate = "2026-08-31") =>
    ({ status, endDate } as unknown as Parameters<typeof isAdvertisable>[0]);

  test("only an approved sublet is advertisable", () => {
    assert.equal(isAdvertisable(at("active"), "2026-06-01"), true);
    for (const s of ["draft", "pending_approval", "rejected", "completed", "cancelled"]) {
      assert.equal(isAdvertisable(at(s), "2026-06-01"), false, `${s} must not advertise`);
    }
  });

  test("an approved sublet that has already ended is not advertisable", () => {
    assert.equal(isAdvertisable(at("active", "2026-05-31"), "2026-06-01"), false);
  });

  test("a sublet ending today still counts", () => {
    assert.equal(isAdvertisable(at("active", "2026-06-01"), "2026-06-01"), true);
  });

  test("date windows overlap when each starts before the other ends", () => {
    const summer = { startDate: "2026-06-15", endDate: "2026-08-31" };
    assert.equal(overlaps(summer, "2026-07-01", "2026-07-31"), true);  // inside
    assert.equal(overlaps(summer, "2026-01-01", "2026-12-31"), true);  // around
    assert.equal(overlaps(summer, "2026-08-31", "2026-09-30"), true);  // touching
    assert.equal(overlaps(summer, "2026-09-01", "2026-09-30"), false); // after
    assert.equal(overlaps(summer, "2026-01-01", "2026-06-14"), false); // before
    assert.equal(overlaps(summer, null, null), true);                  // unfiltered
  });

  test("an org is in the feed unless it explicitly withdrew", () => {
    const org = (subletMarketplace?: boolean) =>
      ({ settings: { subletMarketplace } } as unknown as Parameters<typeof subletFeedDisabled>[0]);
    assert.equal(subletFeedDisabled(org(undefined)), false);
    assert.equal(subletFeedDisabled(org(true)), false);
    assert.equal(subletFeedDisabled(org(false)), true);
    assert.equal(subletFeedDisabled(null), false);
  });
});

// ============================================================
// Move-in — turning an approved application into a tenancy
// ============================================================

describe("defaultLeaseTerm", () => {
  test("a twelve-month term ends the day before its anniversary", () => {
    // 1 Sep to 1 Sep would overlap itself at both ends, and the renewal then
    // looks like two tenancies on one unit.
    assert.deepEqual(defaultLeaseTerm("2026-09-01"), {
      startDate: "2026-09-01", endDate: "2027-08-31",
    });
  });

  test("a leap day start does not fall out of the calendar", () => {
    assert.equal(defaultLeaseTerm("2028-02-29").endDate, "2029-02-28");
  });

  test("a missing or malformed date falls back to today rather than NaN", () => {
    const term = defaultLeaseTerm("not-a-date");
    assert.match(term.startDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(term.endDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(term.endDate > term.startDate);
  });
});

describe("checkMoveIn", () => {
  const ORG_ID = "org-1";

  const application = (over: Record<string, unknown> = {}) => ({
    id: "app-1", orgId: ORG_ID, unitId: "unit-1", propertyId: "prop-1",
    status: "approved",
    applicant: {
      firstName: "Mei", lastName: "Tanaka", email: "mei@example.com",
      phone: "555-0101", currentAddress: "", employer: "", income: 40000,
      moveInDate: "2026-09-01",
    },
    references: [], createdAt: "", updatedAt: "",
    ...over,
  }) as unknown as Parameters<typeof checkMoveIn>[0]["application"];

  const vacantUnit = (over: Record<string, unknown> = {}) =>
    unit({ id: "unit-1", orgId: ORG_ID, status: "available", ...over });

  const payingOrg = (status?: string) =>
    ({ id: ORG_ID, billing: status ? { status } : undefined }) as unknown as
      Parameters<typeof checkMoveIn>[0]["org"];

  const request = (over: Partial<Parameters<typeof checkMoveIn>[0]["request"]> = {}) => ({
    applicationId: "app-1",
    startDate: "2026-09-01", endDate: "2027-08-31",
    rentAmount: 1800, securityDeposit: 1800,
    ...over,
  });

  const check = (over: Record<string, unknown> = {}) => checkMoveIn({
    request: request(),
    application: application(),
    unit: vacantUnit(),
    org: payingOrg("active"),
    callerOrgId: ORG_ID,
    ...over,
  });

  test("an approved application on a vacant unit passes", () => {
    assert.deepEqual(check(), { ok: true });
  });

  test("another org's application is not found, not forbidden", () => {
    // 403 would confirm it exists. Nothing about another org's applicants
    // should be discoverable by guessing ids.
    const result = check({ application: application({ orgId: "org-2" }) });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 404);
  });

  test("a unit belonging to another org is not found either", () => {
    const result = check({ unit: vacantUnit({ orgId: "org-2" }) });
    assert.equal(result.ok === false && result.status, 404);
  });

  test("an application that was never approved cannot move anyone in", () => {
    for (const status of ["submitted", "reviewing", "screening", "denied", "withdrawn"]) {
      const result = check({ application: application({ status }) });
      assert.equal(result.ok, false, `${status} must not move in`);
      assert.equal(result.ok === false && result.status, 409);
    }
  });

  test("an application already converted cannot be converted again", () => {
    const result = check({ application: application({ leaseId: "lease-9" }) });
    assert.equal(result.ok === false && result.status, 409);
    const byTenant = check({ application: application({ tenantId: "tenant-9" }) });
    assert.equal(byTenant.ok === false && byTenant.status, 409);
  });

  test("an occupied unit cannot take a second tenancy", () => {
    const result = check({ unit: vacantUnit({ status: "occupied" }) });
    assert.equal(result.ok === false && result.status, 409);
  });

  test("a lapsed subscription blocks the write the rules would have blocked", () => {
    // The Admin SDK bypasses canProvision(), so this is the only thing standing
    // between a cancelled org and an unlimited supply of new leases.
    for (const status of ["canceled", "incomplete"]) {
      const result = check({ org: payingOrg(status) });
      assert.equal(result.ok === false && result.status, 402, `${status} must be refused`);
    }
  });

  test("trialing, active and past_due orgs may still move people in", () => {
    for (const status of ["trialing", "active", "past_due"]) {
      assert.deepEqual(check({ org: payingOrg(status) }), { ok: true }, status);
    }
    // An org with no billing record at all reads as trialing, matching the rules.
    assert.deepEqual(check({ org: payingOrg() }), { ok: true });
  });

  test("a lease must end after it starts", () => {
    const same = check({ request: request({ endDate: "2026-09-01" }) });
    assert.equal(same.ok === false && same.status, 400);
    const backwards = check({ request: request({ endDate: "2026-08-01" }) });
    assert.equal(backwards.ok === false && backwards.status, 400);
  });

  test("dates have to be dates", () => {
    const result = check({ request: request({ startDate: "1 September" }) });
    assert.equal(result.ok === false && result.status, 400);
  });

  test("rent and deposit have to be real amounts", () => {
    for (const bad of [-1, Number.NaN, 2_000_000]) {
      assert.equal(
        check({ request: request({ rentAmount: bad }) }).ok, false,
        `rent ${bad} must be refused`
      );
      assert.equal(
        check({ request: request({ securityDeposit: bad }) }).ok, false,
        `deposit ${bad} must be refused`
      );
    }
    // Zero deposit is a real policy, not an error.
    assert.deepEqual(check({ request: request({ securityDeposit: 0 }) }), { ok: true });
  });

  test("a missing application or unit refuses rather than throwing", () => {
    assert.equal(check({ application: null }).ok, false);
    assert.equal(check({ unit: null }).ok, false);
  });
});

// ---------------------------------------------------------------- collection state

describe("resolveCollection", () => {
  type Doc = { id: string };
  const MOCK: Doc[] = [{ id: "mock-1" }];
  const REAL: Doc[] = [{ id: "real-1" }];
  const EMPTY: Doc[] = [];
  const KEY = "org-1|properties|[]";

  const waiting = (over: Partial<CollectionState<Doc>> = {}): CollectionState<Doc> => ({
    key: null, docs: EMPTY, status: "waiting", error: null, ...over,
  });

  test("demo mode shows the mock portfolio and never waits", () => {
    // No query is possible, so the initial state answers it: key null === null.
    const r = resolveCollection({
      canSubscribe: false, queryKey: null, fallbackDocs: MOCK,
      state: waiting({ docs: MOCK }),
    });
    assert.deepEqual(r.data, MOCK);
    assert.equal(r.loading, false);
    // Mock data is not live data, and the badge has to say so.
    assert.equal(r.isLive, false);
  });

  test("a live org waiting on its first snapshot shows nothing, not mock data", () => {
    // The bug this whole shape exists to prevent: a fabricated portfolio on the
    // first frame, wiped a moment later.
    const r = resolveCollection({
      canSubscribe: true, queryKey: KEY, fallbackDocs: EMPTY, state: waiting(),
    });
    assert.deepEqual(r.data, EMPTY);
    assert.equal(r.loading, true);
    assert.equal(r.isLive, false);
  });

  test("a snapshot for the current query is the answer", () => {
    const r = resolveCollection({
      canSubscribe: true, queryKey: KEY, fallbackDocs: EMPTY,
      state: { key: KEY, docs: REAL, status: "live", error: null },
    });
    assert.deepEqual(r.data, REAL);
    assert.equal(r.loading, false);
    assert.equal(r.isLive, true);
  });

  test("an empty result from a live org is an answer, not a reason to invent one", () => {
    const r = resolveCollection({
      canSubscribe: true, queryKey: KEY, fallbackDocs: EMPTY,
      state: { key: KEY, docs: [], status: "live", error: null },
    });
    assert.deepEqual(r.data, []);
    assert.equal(r.loading, false);
    assert.equal(r.isLive, true);
  });

  test("documents from a previous query are not shown against a new one", () => {
    // Switching org, collection or filter: what is in hand answers the old
    // question. Showing it would be showing another org's portfolio.
    const r = resolveCollection({
      canSubscribe: true, queryKey: "org-2|properties|[]", fallbackDocs: EMPTY,
      state: { key: KEY, docs: REAL, status: "live", error: null },
    });
    assert.deepEqual(r.data, EMPTY);
    assert.equal(r.loading, true);
    assert.equal(r.isLive, false);
  });

  test("a failed read surfaces, and is never mistaken for an empty org", () => {
    const r = resolveCollection({
      canSubscribe: true, queryKey: KEY, fallbackDocs: EMPTY,
      state: { key: KEY, docs: [], status: "error", error: "permission denied" },
    });
    assert.equal(r.error, "permission denied");
    assert.equal(r.loading, false);
    assert.equal(r.isLive, false);
  });

  test("an error about a different query says nothing about this one", () => {
    const r = resolveCollection({
      canSubscribe: true, queryKey: "org-2|properties|[]", fallbackDocs: EMPTY,
      state: { key: KEY, docs: [], status: "error", error: "permission denied" },
    });
    assert.equal(r.error, null);
  });

  test("a subscription that never answers stops loading rather than hanging", () => {
    const r = resolveCollection({
      canSubscribe: true, queryKey: KEY, fallbackDocs: EMPTY,
      state: { key: KEY, docs: [], status: "timeout", error: null },
    });
    assert.equal(r.loading, false);
    assert.equal(r.isLive, false);
  });

  test("a collection switched off for this role answers 'nothing' without waiting", () => {
    // enabled=false — e.g. the tenant roster, which a tenant may not enumerate.
    // Whatever was loaded before must not linger.
    const r = resolveCollection({
      canSubscribe: false, queryKey: null, fallbackDocs: EMPTY,
      state: { key: KEY, docs: REAL, status: "live", error: null },
    });
    assert.deepEqual(r.data, EMPTY);
    assert.equal(r.loading, false);
  });

  test("documents another listener already has are an answer, not a loading state", () => {
    // The second hook to ask for a collection on the same screen, and every
    // return visit to a page inside the listener's grace period. Waiting here is
    // what put a skeleton on a screen whose data was already in the building.
    const r = resolveCollection({
      canSubscribe: true, queryKey: KEY, fallbackDocs: EMPTY,
      cachedDocs: REAL, state: waiting(),
    });
    assert.deepEqual(r.data, REAL);
    assert.equal(r.loading, false);
    // They came off a real snapshot of this query.
    assert.equal(r.isLive, true);
    assert.equal(r.error, null);
  });

  test("this hook's own snapshot beats the shared cache", () => {
    // Only consulted when state does not answer the query — otherwise an
    // optimistic write, which lives in state alone, would be rendered away by a
    // cache entry that predates it.
    const OWN: Doc[] = [{ id: "own-1" }];
    const r = resolveCollection({
      canSubscribe: true, queryKey: KEY, fallbackDocs: EMPTY,
      cachedDocs: REAL,
      state: { key: KEY, docs: OWN, status: "live", error: null },
    });
    assert.deepEqual(r.data, OWN);
  });

  test("an empty cache entry is not mistaken for documents", () => {
    // peekCollection returns null before the first snapshot, and null must fall
    // through to the normal waiting path rather than resolve as "no records".
    const r = resolveCollection({
      canSubscribe: true, queryKey: KEY, fallbackDocs: EMPTY,
      cachedDocs: null, state: waiting(),
    });
    assert.equal(r.loading, true);
    assert.equal(r.isLive, false);
  });
});

describe("applyCollectionWrite", () => {
  type Doc = { id: string };
  const KEY = "org-1|properties|[]";
  const REAL: Doc[] = [{ id: "real-1" }];

  test("an optimistic write survives instead of being discarded as stale", () => {
    const next = applyCollectionWrite(
      { key: KEY, docs: REAL, status: "live", error: null },
      KEY, [],
      (docs) => [...docs, { id: "new" }]
    );
    assert.deepEqual(next.docs.map((d) => d.id), ["real-1", "new"]);
    // Claims the current query, so resolveCollection will show it.
    assert.equal(next.key, KEY);
  });

  test("a write lands on what the caller is looking at, not on stale documents", () => {
    // State still holds the previous query's documents, so the caller is looking
    // at the fallback. Removing from the stale set would resurrect it.
    const next = applyCollectionWrite(
      { key: "org-old|properties|[]", docs: REAL, status: "live", error: null },
      KEY, [],
      (docs) => [...docs, { id: "new" }]
    );
    assert.deepEqual(next.docs.map((d) => d.id), ["new"]);
  });

  test("a plain value replaces outright", () => {
    const next = applyCollectionWrite(
      { key: KEY, docs: REAL, status: "live", error: null },
      KEY, [], [{ id: "replaced" }]
    );
    assert.deepEqual(next.docs.map((d) => d.id), ["replaced"]);
  });
});

// ============================================
// Lease actions a tenant may take on their own lease
// ============================================

describe("checkTenantSignature", () => {
  const ORG_ID = "org-1";

  const lease = (over: Record<string, unknown> = {}) => ({
    id: "lease-1", orgId: ORG_ID, unitId: "unit-1", propertyId: "prop-1",
    tenantIds: ["tenant-1"], status: "draft",
    startDate: "2026-09-01", endDate: "2027-08-31",
    rentAmount: 1800, securityDeposit: 1800, lateFeePercent: 5,
    gracePeriodDays: 5, autoRenew: false, documents: [], signatures: [],
    createdAt: "", updatedAt: "",
    ...over,
  }) as unknown as Lease;

  const SIGNATURE = "data:image/png;base64,iVBORw0KGgo=";

  const check = (over: Record<string, unknown> = {}) => checkTenantSignature({
    lease: lease(), tenantId: "tenant-1", callerOrgId: ORG_ID, signatureUrl: SIGNATURE,
    ...over,
  });

  test("the named tenant may sign their own draft lease", () => {
    assert.deepEqual(check(), { ok: true });
  });

  test("a lease in another org is not found, not forbidden", () => {
    assert.equal(check({ lease: lease({ orgId: "org-2" }) }).ok, false);
    assert.equal(
      (check({ lease: lease({ orgId: "org-2" }) }) as { status: number }).status,
      404
    );
  });

  test("someone not named on the lease cannot sign it, and cannot tell it exists", () => {
    const result = check({ tenantId: "tenant-9" }) as { status: number };
    assert.equal(result.status, 404);
  });

  test("signing twice is refused rather than stacking duplicates", () => {
    const signed = lease({
      signatures: [{ tenantId: "tenant-1", signedAt: "2026-08-01T00:00:00Z", signatureUrl: SIGNATURE }],
    });
    assert.equal((check({ lease: signed }) as { status: number }).status, 409);
  });

  test("a terminated lease cannot be signed", () => {
    assert.equal((check({ lease: lease({ status: "terminated" }) }) as { status: number }).status, 409);
  });

  test("anything that is not an image is not a signature", () => {
    assert.equal((check({ signatureUrl: "https://example.com/sig.png" }) as { status: number }).status, 400);
    assert.equal((check({ signatureUrl: "" }) as { status: number }).status, 400);
  });

  test("an oversized signature is refused — the whole lease shares one 1 MB limit", () => {
    const huge = "data:image/png;base64," + "A".repeat(300_000);
    assert.equal((check({ signatureUrl: huge }) as { status: number }).status, 413);
  });
});

describe("signingActivatesLease", () => {
  const base = {
    id: "lease-1", orgId: "org-1", unitId: "unit-1", propertyId: "prop-1",
    startDate: "", endDate: "", rentAmount: 0, securityDeposit: 0,
    lateFeePercent: 0, gracePeriodDays: 0, autoRenew: false,
    documents: [], createdAt: "", updatedAt: "",
  };

  test("the only tenant signing makes the lease live", () => {
    const lease = { ...base, status: "draft", tenantIds: ["t1"], signatures: [] } as unknown as Lease;
    assert.equal(signingActivatesLease(lease, "t1"), true);
  });

  test("one of two co-tenants signing does not — the other has not agreed yet", () => {
    const lease = { ...base, status: "draft", tenantIds: ["t1", "t2"], signatures: [] } as unknown as Lease;
    assert.equal(signingActivatesLease(lease, "t1"), false);
  });

  test("the last co-tenant signing does", () => {
    const lease = {
      ...base, status: "draft", tenantIds: ["t1", "t2"],
      signatures: [{ tenantId: "t1", signedAt: "", signatureUrl: "" }],
    } as unknown as Lease;
    assert.equal(signingActivatesLease(lease, "t2"), true);
  });

  test("an already-active lease is not re-activated by a late signature", () => {
    const lease = { ...base, status: "active", tenantIds: ["t1"], signatures: [] } as unknown as Lease;
    assert.equal(signingActivatesLease(lease, "t1"), false);
  });
});

describe("checkRenewalResponse", () => {
  const ORG_ID = "org-1";

  const lease = (over: Record<string, unknown> = {}) => ({
    id: "lease-1", orgId: ORG_ID, unitId: "unit-1", propertyId: "prop-1",
    tenantIds: ["tenant-1"], status: "active",
    startDate: "", endDate: "", rentAmount: 0, securityDeposit: 0,
    lateFeePercent: 0, gracePeriodDays: 0, autoRenew: false,
    documents: [], signatures: [],
    renewalOffered: true, renewalDecision: "pending",
    createdAt: "", updatedAt: "",
    ...over,
  }) as unknown as Lease;

  const check = (over: Record<string, unknown> = {}) => checkRenewalResponse({
    lease: lease(), tenantId: "tenant-1", callerOrgId: ORG_ID, decision: "accepted",
    ...over,
  });

  test("the tenant may answer an open offer", () => {
    assert.deepEqual(check(), { ok: true });
    assert.deepEqual(check({ decision: "declined" }), { ok: true });
  });

  test("only accepted or declined are answers", () => {
    assert.equal((check({ decision: "maybe" }) as { status: number }).status, 400);
  });

  test("an offer nobody made cannot be answered", () => {
    const result = check({ lease: lease({ renewalOffered: false }) }) as { status: number };
    assert.equal(result.status, 409);
  });

  test("an answer already given is not overwritten", () => {
    const result = check({ lease: lease({ renewalDecision: "declined" }) }) as { status: number };
    assert.equal(result.status, 409);
  });
});

describe("unitOccupancyForLease", () => {
  test("a live lease names its unit's occupant and lease", () => {
    const now = "2026-09-01T00:00:00Z";
    assert.deepEqual(
      unitOccupancyForLease({ id: "lease-1", tenantIds: ["t1", "t2"] }, now),
      { status: "occupied", currentTenantId: "t1", currentLeaseId: "lease-1", updatedAt: now }
    );
  });
});

// ============================================
// Getting-started guide
// ============================================

describe("buildSetupSteps", () => {
  const empty = {
    properties: [], units: [], tenants: [], leases: [], org: null,
  } as Parameters<typeof buildSetupSteps>[0];

  const stepById = (input: Parameters<typeof buildSetupSteps>[0], id: string) =>
    buildSetupSteps(input).find((s) => s.id === id)!;

  test("a brand new org has nothing done", () => {
    assert.equal(buildSetupSteps(empty).every((s) => !s.done), true);
    assert.equal(setupProgress(buildSetupSteps(empty)).done, 0);
  });

  test("the first thing offered is the property — everything else needs one", () => {
    assert.equal(setupProgress(buildSetupSteps(empty)).next?.id, "property");
  });

  test("a tenant with no unit does not count as housed", () => {
    const input = {
      ...empty,
      tenants: [{ id: "t1", unitId: undefined, userId: undefined }],
    };
    assert.equal(stepById(input, "tenant").done, false);
  });

  test("a tenant in a unit does", () => {
    const input = {
      ...empty,
      tenants: [{ id: "t1", unitId: "u1", userId: undefined }],
    };
    assert.equal(stepById(input, "tenant").done, true);
    assert.equal(stepById(input, "tenant").detail, "1 tenant housed");
  });

  test("a draft lease is not a live one", () => {
    assert.equal(stepById({ ...empty, leases: [{ id: "l1", status: "draft" }] }, "lease").done, false);
    assert.equal(stepById({ ...empty, leases: [{ id: "l1", status: "active" }] }, "lease").done, true);
    assert.equal(stepById({ ...empty, leases: [{ id: "l1", status: "month_to_month" }] }, "lease").done, true);
  });

  test("payouts count only once Stripe will actually take a charge", () => {
    const submitted = {
      ...empty,
      org: { payouts: { chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: true } },
    } as Parameters<typeof buildSetupSteps>[0];
    assert.equal(stepById(submitted, "payouts").done, false);

    const live = {
      ...empty,
      org: { payouts: { chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true } },
    } as Parameters<typeof buildSetupSteps>[0];
    assert.equal(stepById(live, "payouts").done, true);
  });

  test("counts read as English, not as \"1 propertys\"", () => {
    const one = { ...empty, properties: [{ id: "p1" }] };
    assert.equal(stepById(one, "property").detail, "1 property");
    const two = { ...empty, properties: [{ id: "p1" }, { id: "p2" }] };
    assert.equal(stepById(two, "property").detail, "2 properties");
  });
});

describe("setupProgress", () => {
  const step = (id: string, done: boolean, optional = false) =>
    ({ id, title: id, why: "", href: "", cta: "", done, optional });

  test("optional steps are left out of the count, so 100% is reachable", () => {
    const progress = setupProgress([
      step("a", true), step("b", true), step("c", false, true),
    ]);
    assert.deepEqual(
      { done: progress.done, total: progress.total, percent: progress.percent, complete: progress.complete },
      { done: 2, total: 2, percent: 100, complete: true }
    );
  });

  test("next skips over an undone optional step to the required one", () => {
    const progress = setupProgress([
      step("a", true), step("b", false, true), step("c", false),
    ]);
    assert.equal(progress.next?.id, "c");
  });

  test("a finished org has nothing next", () => {
    assert.equal(setupProgress([step("a", true)]).next, null);
  });
});
