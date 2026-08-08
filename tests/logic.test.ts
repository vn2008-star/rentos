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
import {
  generateListingTitle, calculateDaysOnMarket, getListingStats, calculateSTRRate,
} from "../src/lib/listing-generator";
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
