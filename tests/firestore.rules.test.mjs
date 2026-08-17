// Firestore security rules tests.
//
// Run: npm run test:rules
// Uses a demo-* project id so the emulator needs no Firebase credentials.

import { readFileSync } from "node:fs";
import { test, before, after, describe } from "node:test";
import assert from "node:assert";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

let testEnv;

const ORG = "org-1";
const OTHER_ORG = "org-2";
// An organisation whose subscription has ended — used to prove the billing gate
// blocks new records without touching the existing ones.
const LAPSED_ORG = "org-lapsed";

// users/{uid} documents the rules read via getUserProfile()
const PROFILES = {
  manager: { role: "manager", orgId: ORG, email: "m@example.com" },
  // Tenants carry a tenantId linking the login to a Tenant record. Rules cannot
  // run queries, so this is the only way to scope a tenant to their own lease,
  // payments and requests rather than the whole organisation's.
  tenant: { role: "tenant", orgId: ORG, tenantId: "tenant-1", email: "t@example.com" },
  // Same org, different person — the case that used to leak.
  tenant2: { role: "tenant", orgId: ORG, tenantId: "tenant-2", email: "t2@example.com" },
  // A tenant account nobody has linked yet.
  unlinked: { role: "tenant", orgId: ORG, email: "u@example.com" },
  outsider: { role: "manager", orgId: OTHER_ORG, email: "o@example.com" },
  // Contractor linked to vendor-1
  vendor1: { role: "contractor", orgId: ORG, vendorId: "vendor-1", email: "v1@example.com" },
  // Contractor with a vendorId that matches no assigned work order
  vendor2: { role: "contractor", orgId: ORG, vendorId: "vendor-2", email: "v2@example.com" },
  // Manager of an organisation that has stopped paying for RentOS.
  lapsed: { role: "manager", orgId: LAPSED_ORG, email: "lapsed@example.com" },
  // RentOS operators. Their own org is ORG; the customer they help is OTHER_ORG.
  operator: { role: "super_admin", orgId: ORG, email: "ops@rentos.app" },
  operator2: { role: "super_admin", orgId: ORG, email: "ops2@rentos.app" },
  // The shared read-only identity behind "View Demo" on the marketing site.
  guest: { role: "guest", orgId: ORG, email: "demo@rentos.app" },
};

const WORK_ORDER = {
  orgId: ORG,
  vendorId: "vendor-1",
  status: "assigned",
  unitId: "unit-1",
  propertyId: "prop-1",
  maintenanceRequestId: "maint-1",
};

const SUBLET = { orgId: ORG, tenantId: "tenant-1", status: "active", title: "Summer sublet" };

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-rentos",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });

  // Seed profiles and documents with rules bypassed.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, profile] of Object.entries(PROFILES)) {
      await setDoc(doc(db, "users", uid), profile);
    }
    await setDoc(doc(db, "work_orders", "wo-1"), WORK_ORDER);
    await setDoc(doc(db, "sublets", "sublet-1"), SUBLET);
    // A listing waiting on the landlord's consent, and one already refused.
    await setDoc(doc(db, "sublets", "sublet-pending"), {
      orgId: ORG, tenantId: "tenant-1", status: "pending_approval",
      title: "Summer sublet — Jun to Aug", submittedAt: "2026-04-01T00:00:00Z",
    });
    await setDoc(doc(db, "sublets", "sublet-rejected"), {
      orgId: ORG, tenantId: "tenant-1", status: "rejected",
      title: "Sublet past lease end", rejectionReason: "Runs past your lease.",
    });
    // Separate documents for the tests that write, so a successful withdrawal
    // cannot change the answer a later test is asserting about.
    await setDoc(doc(db, "sublets", "sublet-withdraw-pending"), {
      orgId: ORG, tenantId: "tenant-1", status: "pending_approval", title: "To withdraw",
    });
    await setDoc(doc(db, "sublets", "sublet-withdraw-active"), {
      orgId: ORG, tenantId: "tenant-1", status: "active", title: "Live, to withdraw",
    });
    await setDoc(doc(db, "sublets", "sublet-to-approve"), {
      orgId: ORG, tenantId: "tenant-1", status: "pending_approval", title: "For the manager",
    });

    // The org must exist: several create rules check it, and the users rule
    // uses its absence to decide whether someone is founding a new org.
    // billing.status is what the provisioning gate reads.
    await setDoc(doc(db, "organizations", ORG), {
      name: "Davis Housing Services",
      slug: "davis-housing-services",
      plan: "professional",
      ownerId: "manager",
      billing: { status: "active" },
      payouts: { chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true },
      settings: { timezone: "America/Los_Angeles", currency: "USD" },
    });

    await setDoc(doc(db, "organizations", LAPSED_ORG), {
      name: "Lapsed Lettings",
      slug: "lapsed-lettings",
      plan: "starter",
      ownerId: "lapsed",
      billing: { status: "canceled" },
    });

    await setDoc(doc(db, "invites", "invite-1"), {
      orgId: ORG,
      email: "newhire@example.com",
      role: "manager",
      status: "pending",
      expiresAt: "2099-01-01T00:00:00Z",
    });

    // Support grants. Real Timestamps, because the rules compare expiresAt
    // against request.time — an ISO string there makes every check silently false.
    const inAnHour = new Date(Date.now() + 3600_000);
    const anHourAgo = new Date(Date.now() - 3600_000);

    // Read-only access to a customer org (LAPSED_ORG stands in for one).
    await setDoc(doc(db, "support_sessions", "operator"), {
      adminUid: "operator", adminEmail: "ops@rentos.app",
      orgId: LAPSED_ORG, orgName: "Lapsed Lettings",
      reason: "Ticket 412", writeEnabled: false,
      startedAt: new Date().toISOString(), expiresAt: inAnHour,
    });

    // An expired grant, to prove expiry is enforced rather than merely displayed.
    await setDoc(doc(db, "support_sessions", "operator2"), {
      adminUid: "operator2", adminEmail: "ops2@rentos.app",
      orgId: LAPSED_ORG, orgName: "Lapsed Lettings",
      reason: "Ticket 9", writeEnabled: true,
      startedAt: anHourAgo.toISOString(), expiresAt: anHourAgo,
    });

    // Something for the lapsed org to still be able to read and edit.
    await setDoc(doc(db, "units", "lapsed-unit"), { orgId: LAPSED_ORG, unitNumber: "1" });

    await setDoc(doc(db, "tenants", "tenant-1"), { orgId: ORG, firstName: "Sarah", lastName: "Chen" });
    await setDoc(doc(db, "tenants", "tenant-2"), { orgId: ORG, firstName: "James", lastName: "Rodriguez" });
    await setDoc(doc(db, "properties", "prop-1"), { orgId: ORG, name: "University Commons" });
    await setDoc(doc(db, "units", "unit-1"), { orgId: ORG, unitNumber: "101" });
    await setDoc(doc(db, "leases", "lease-1"), { orgId: ORG, tenantIds: ["tenant-1"], unitId: "unit-1" });
    await setDoc(doc(db, "transactions", "txn-1"), { orgId: ORG, tenantId: "tenant-1", amount: 1800, status: "completed" });
    await setDoc(doc(db, "inspections", "insp-1"), { orgId: ORG, tenantId: "tenant-1", unitId: "unit-1", type: "move_out" });
    await setDoc(doc(db, "keys", "key-1"), { orgId: ORG, unitId: "unit-1", label: "Front door" });
    await setDoc(doc(db, "lock_changes", "lock-1"), { orgId: ORG, unitId: "unit-1", reason: "turnover" });
    await setDoc(doc(db, "unit_notes", "note-1"), { orgId: ORG, unitId: "unit-1", body: "Noise complaint" });
    await setDoc(doc(db, "calendar_events", "cal-1"), { orgId: ORG, type: "showing", title: "Showing" });
    // A receipt and a served notice belonging to tenant-1.
    await setDoc(doc(db, "receipts", "receipt-1"), {
      orgId: ORG, number: "R-20260901-ABC123", paymentId: "txn-1",
      tenantId: "tenant-1", leaseId: "lease-1", unitId: "unit-1", propertyId: "prop-1",
      amount: 2000, period: "2026-09", paidOn: "2026-09-01", method: "Card",
      balanceAfter: 0, tenantName: "Sarah Chen", unitLabel: "Unit 101",
      propertyName: "Russell Commons", landlordName: "Demo Org",
      issuedBy: "Manager", issuedAt: "2026-09-01T10:00:00.000Z",
    });
    await setDoc(doc(db, "notices", "notice-1"), {
      orgId: ORG, leaseId: "lease-1", unitId: "unit-1", propertyId: "prop-1",
      tenantIds: ["tenant-1"], tenantNames: ["Sarah Chen"],
      unitAddress: "1 Russell Blvd, Unit 101, Davis, CA",
      amountDemanded: 2000,
      periods: [{ period: "2026-09", dueDate: "2026-09-01", owed: 2000 }],
      excludedCharges: [], payee: { name: "Demo Org", phone: "555", address: "x", method: "in_person", hours: "9-5" },
      servedOn: "2026-09-14", serviceMethod: "personal", deadline: "2026-09-17",
      status: "served", issuedBy: "Manager", issuedAt: "2026-09-14T10:00:00.000Z",
    });
    // The advert is public, but the document wrapped around it is not: `leads`
    // is the landlord's enquiry pipeline, with contact details attached.
    await setDoc(doc(db, "listings", "listing-1"), {
      orgId: ORG,
      unitId: "unit-1",
      propertyId: "prop-1",
      title: "2BR near campus",
      rent: 1800,
      status: "active",
      syndicatedTo: ["zillow"],
      leads: [{
        name: "Mei Tanaka", email: "mei@example.com", phone: "555-0101",
        source: "web", createdAt: "2026-08-01T00:00:00Z",
      }],
    });
    await setDoc(doc(db, "notifications", "notif-mgr"), { orgId: ORG, audience: "manager", read: false, title: "Rent received" });
    await setDoc(doc(db, "notifications", "notif-t1"), { orgId: ORG, audience: "tenant", tenantId: "tenant-1", read: false, title: "Payment failed" });
  });
});

after(async () => {
  await testEnv?.cleanup();
});

const as = (uid) => testEnv.authenticatedContext(uid).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

describe("work_orders", () => {
  test("anonymous cannot read a work order", async () => {
    await assertFails(getDoc(doc(anon(), "work_orders", "wo-1")));
  });

  test("org manager can read", async () => {
    await assertSucceeds(getDoc(doc(as("manager"), "work_orders", "wo-1")));
  });

  test("manager from another org cannot read", async () => {
    await assertFails(getDoc(doc(as("outsider"), "work_orders", "wo-1")));
  });

  test("assigned vendor can read their own work order", async () => {
    await assertSucceeds(getDoc(doc(as("vendor1"), "work_orders", "wo-1")));
  });

  test("unassigned vendor cannot read it", async () => {
    await assertFails(getDoc(doc(as("vendor2"), "work_orders", "wo-1")));
  });

  test("assigned vendor can update status", async () => {
    await assertSucceeds(
      updateDoc(doc(as("vendor1"), "work_orders", "wo-1"), { status: "accepted" })
    );
  });

  test("assigned vendor cannot reassign the work order to themselves", async () => {
    await assertFails(
      updateDoc(doc(as("vendor2"), "work_orders", "wo-1"), { vendorId: "vendor-2" })
    );
  });

  test("assigned vendor cannot move the work order to another org", async () => {
    await assertFails(
      updateDoc(doc(as("vendor1"), "work_orders", "wo-1"), { orgId: OTHER_ORG })
    );
  });

  test("vendor cannot delete a work order", async () => {
    await assertFails(deleteDoc(doc(as("vendor1"), "work_orders", "wo-1")));
  });
});

describe("sublets", () => {
  test("anonymous cannot read a sublet", async () => {
    await assertFails(getDoc(doc(anon(), "sublets", "sublet-1")));
  });

  test("the tenant it belongs to can read", async () => {
    await assertSucceeds(getDoc(doc(as("tenant"), "sublets", "sublet-1")));
  });

  test("a different tenant in the same org cannot read", async () => {
    await assertFails(getDoc(doc(as("tenant2"), "sublets", "sublet-1")));
  });

  test("another org cannot read", async () => {
    await assertFails(getDoc(doc(as("outsider"), "sublets", "sublet-1")));
  });

  test("tenant cannot delete (owner/manager only)", async () => {
    await assertFails(deleteDoc(doc(as("tenant"), "sublets", "sublet-1")));
  });
});

// ============================================================
// The sublet approval gate
//
// A lease that forbids subletting without the landlord's consent makes the
// review step the whole point: a tenant who could publish their own listing
// would be granting themselves that consent.
// ============================================================

describe("sublet approval", () => {
  const draft = (status) => ({
    orgId: ORG, tenantId: "tenant-1", status,
    title: "Summer sublet", monthlyRent: 1500,
  });

  test("a tenant can submit their own listing for review", async () => {
    await assertSucceeds(
      setDoc(doc(as("tenant"), "sublets", "new-pending"), draft("pending_approval"))
    );
  });

  test("a tenant can save their own listing as a draft", async () => {
    await assertSucceeds(
      setDoc(doc(as("tenant"), "sublets", "new-draft"), draft("draft"))
    );
  });

  test("a tenant cannot publish their own listing outright", async () => {
    await assertFails(
      setDoc(doc(as("tenant"), "sublets", "new-active"), draft("active"))
    );
  });

  test("a tenant cannot file a listing against another tenant's unit", async () => {
    await assertFails(
      setDoc(doc(as("tenant2"), "sublets", "new-other"), draft("pending_approval"))
    );
  });

  test("a manager's own listing goes live immediately — they are the consent", async () => {
    await assertSucceeds(
      setDoc(doc(as("manager"), "sublets", "new-mgr"), draft("active"))
    );
  });

  test("a tenant cannot approve their own pending listing", async () => {
    await assertFails(
      updateDoc(doc(as("tenant"), "sublets", "sublet-pending"), { status: "active" })
    );
  });

  test("a tenant cannot revive a listing the org rejected", async () => {
    await assertFails(
      updateDoc(doc(as("tenant"), "sublets", "sublet-rejected"), { status: "pending_approval" })
    );
  });

  test("a tenant cannot forge the review trail", async () => {
    await assertFails(
      updateDoc(doc(as("tenant"), "sublets", "sublet-pending"), {
        reviewedBy: "manager", reviewedAt: "2026-04-02T00:00:00Z",
      })
    );
  });

  test("a tenant cannot rewrite the reason they were turned down", async () => {
    await assertFails(
      updateDoc(doc(as("tenant"), "sublets", "sublet-rejected"), { rejectionReason: "" })
    );
  });

  test("a tenant cannot hand their listing to another tenant", async () => {
    await assertFails(
      updateDoc(doc(as("tenant"), "sublets", "sublet-pending"), { tenantId: "tenant-2" })
    );
  });

  test("a different tenant cannot touch someone else's listing", async () => {
    await assertFails(
      updateDoc(doc(as("tenant2"), "sublets", "sublet-pending"), { status: "cancelled" })
    );
  });

  test("a tenant can edit a listing that is still waiting", async () => {
    await assertSucceeds(
      updateDoc(doc(as("tenant"), "sublets", "sublet-pending"), { monthlyRent: 1400 })
    );
  });

  test("a tenant can withdraw a listing that is waiting", async () => {
    await assertSucceeds(
      updateDoc(doc(as("tenant"), "sublets", "sublet-withdraw-pending"), { status: "cancelled" })
    );
  });

  test("a tenant can withdraw a listing that is already live", async () => {
    await assertSucceeds(
      updateDoc(doc(as("tenant"), "sublets", "sublet-withdraw-active"), { status: "cancelled" })
    );
  });

  test("a manager can approve, and record who decided", async () => {
    await assertSucceeds(
      updateDoc(doc(as("manager"), "sublets", "sublet-to-approve"), {
        status: "active", reviewedBy: "manager", reviewedAt: "2026-04-02T00:00:00Z",
      })
    );
  });

  test("another org cannot approve", async () => {
    await assertFails(
      updateDoc(doc(as("outsider"), "sublets", "sublet-pending"), { status: "active" })
    );
  });
});

// ============================================================
// User profiles — the root of every other rule
// ============================================================
// Every authorization decision reads orgId and role from users/{uid}. If a
// caller can write those fields, the rest of the rules are decorative.

describe("users", () => {
  test("a user can read their own profile", async () => {
    await assertSucceeds(getDoc(doc(as("tenant"), "users", "tenant")));
  });

  test("a user cannot read someone else's profile", async () => {
    await assertFails(getDoc(doc(as("tenant"), "users", "manager")));
  });

  test("staff can read profiles in their own org", async () => {
    // The team screen lists who has access; an org that cannot see its own
    // members cannot notice a stale one.
    await assertSucceeds(getDoc(doc(as("manager"), "users", "tenant")));
  });

  test("staff cannot read profiles in another org", async () => {
    await assertFails(getDoc(doc(as("outsider"), "users", "tenant")));
  });

  test("a user cannot promote themselves to manager", async () => {
    await assertFails(updateDoc(doc(as("tenant"), "users", "tenant"), { role: "manager" }));
  });

  test("a user cannot move themselves into another organisation", async () => {
    await assertFails(updateDoc(doc(as("tenant"), "users", "tenant"), { orgId: OTHER_ORG }));
  });

  test("a user cannot claim another tenant's record", async () => {
    await assertFails(updateDoc(doc(as("tenant"), "users", "tenant"), { tenantId: "tenant-2" }));
  });

  test("a user cannot grant themselves a vendor link", async () => {
    await assertFails(updateDoc(doc(as("tenant"), "users", "tenant"), { vendorId: "vendor-1" }));
  });

  test("a user can still edit harmless fields on their own profile", async () => {
    await assertSucceeds(updateDoc(doc(as("tenant"), "users", "tenant"), { phone: "(530) 555-0199" }));
  });

  test("a new signup cannot create a profile inside an existing organisation", async () => {
    // The escalation path: sign up, write yourself into org-1 as a manager,
    // then read the entire portfolio.
    await assertFails(
      setDoc(doc(as("intruder"), "users", "intruder"), {
        role: "manager", orgId: ORG, email: "intruder@example.com",
      })
    );
  });

  test("a new signup can found their own organisation", async () => {
    await assertSucceeds(
      setDoc(doc(as("founder"), "users", "founder"), {
        role: "manager", orgId: "org-brand-new", email: "founder@example.com",
      })
    );
  });
});

// ============================================================
// Tenant isolation
// ============================================================

describe("tenants", () => {
  test("staff can read any tenant in the org", async () => {
    await assertSucceeds(getDoc(doc(as("manager"), "tenants", "tenant-2")));
  });

  test("a tenant can read their own record", async () => {
    await assertSucceeds(getDoc(doc(as("tenant"), "tenants", "tenant-1")));
  });

  test("a tenant cannot read another tenant's record", async () => {
    await assertFails(getDoc(doc(as("tenant"), "tenants", "tenant-2")));
  });

  test("an unlinked tenant account can read nobody", async () => {
    await assertFails(getDoc(doc(as("unlinked"), "tenants", "tenant-1")));
  });

  test("a tenant cannot move themselves to another org", async () => {
    await assertFails(updateDoc(doc(as("tenant"), "tenants", "tenant-1"), { orgId: OTHER_ORG }));
  });
});

describe("leases", () => {
  test("a tenant named on the lease can read it", async () => {
    await assertSucceeds(getDoc(doc(as("tenant"), "leases", "lease-1")));
  });

  test("a tenant not named on the lease cannot read it", async () => {
    await assertFails(getDoc(doc(as("tenant2"), "leases", "lease-1")));
  });

  test("a tenant cannot rewrite their own lease", async () => {
    await assertFails(updateDoc(doc(as("tenant"), "leases", "lease-1"), { rentAmount: 1 }));
  });
});

// ============================================================
// Money
// ============================================================

describe("transactions", () => {
  test("a tenant can read their own payment history", async () => {
    await assertSucceeds(getDoc(doc(as("tenant"), "transactions", "txn-1")));
  });

  test("a tenant cannot read another tenant's payments", async () => {
    await assertFails(getDoc(doc(as("tenant2"), "transactions", "txn-1")));
  });

  test("a tenant cannot forge a completed payment", async () => {
    // Stripe's webhook writes these through the Admin SDK, which bypasses
    // rules. No client path may create one.
    await assertFails(
      setDoc(doc(as("tenant"), "transactions", "forged"), {
        orgId: ORG, tenantId: "tenant-1", amount: 1800, status: "completed", type: "rent",
      })
    );
  });

  test("not even a manager can write one by hand", async () => {
    await assertFails(
      setDoc(doc(as("manager"), "transactions", "forged-2"), {
        orgId: ORG, amount: 1800, status: "completed", type: "rent",
      })
    );
  });

  test("nobody can alter a recorded payment", async () => {
    await assertFails(updateDoc(doc(as("manager"), "transactions", "txn-1"), { amount: 1 }));
  });
});

// ============================================================
// Staff-only operational data
// ============================================================

describe("staff-only collections", () => {
  const cases = [
    ["properties", "prop-1"],
    ["units", "unit-1"],
    ["keys", "key-1"],
    ["lock_changes", "lock-1"],
    ["unit_notes", "note-1"],
    ["calendar_events", "cal-1"],
  ];

  for (const [collection, id] of cases) {
    test("staff can read " + collection, async () => {
      await assertSucceeds(getDoc(doc(as("manager"), collection, id)));
    });

    test("a tenant cannot read " + collection, async () => {
      await assertFails(getDoc(doc(as("tenant"), collection, id)));
    });

    test("another org cannot read " + collection, async () => {
      await assertFails(getDoc(doc(as("outsider"), collection, id)));
    });
  }

  test("a rekey history cannot be deleted, even by a manager", async () => {
    await assertFails(deleteDoc(doc(as("manager"), "lock_changes", "lock-1")));
  });
});

// ============================================================
// Listings — a public advert wrapped around a private pipeline
// ============================================================

describe("listings", () => {
  test("staff can read their own org's listing", async () => {
    await assertSucceeds(getDoc(doc(as("manager"), "listings", "listing-1")));
  });

  // The advert is public; the document is not. Browsers get the advertised
  // facts from /api/public/listing/{id}, which reads through the Admin SDK and
  // leaves `leads` and the syndication history behind. Reading the raw document
  // would return every enquirer's name, email address and phone number.
  test("an anonymous visitor cannot read the raw listing document", async () => {
    await assertFails(getDoc(doc(anon(), "listings", "listing-1")));
  });

  test("another org cannot read the listing", async () => {
    await assertFails(getDoc(doc(as("outsider"), "listings", "listing-1")));
  });

  test("a tenant cannot harvest the lead pipeline", async () => {
    await assertFails(getDoc(doc(as("tenant"), "listings", "listing-1")));
  });

  test("the demo guest can still read listings", async () => {
    await assertSucceeds(getDoc(doc(as("guest"), "listings", "listing-1")));
  });

  test("an anonymous visitor cannot append themselves as a lead", async () => {
    await assertFails(updateDoc(doc(anon(), "listings", "listing-1"), { leads: [] }));
  });

  test("another org cannot edit the listing", async () => {
    await assertFails(updateDoc(doc(as("outsider"), "listings", "listing-1"), { rent: 1 }));
  });

  test("staff can edit their own listing", async () => {
    await assertSucceeds(updateDoc(doc(as("manager"), "listings", "listing-1"), { rent: 1850 }));
  });
});

// ============================================================
// Inspections — a tenant's evidence for a deposit deduction
// ============================================================

describe("inspections", () => {
  test("the tenant it concerns can read it", async () => {
    await assertSucceeds(getDoc(doc(as("tenant"), "inspections", "insp-1")));
  });

  test("another tenant cannot", async () => {
    await assertFails(getDoc(doc(as("tenant2"), "inspections", "insp-1")));
  });

  test("a tenant cannot rewrite the findings against themselves", async () => {
    await assertFails(
      updateDoc(doc(as("tenant"), "inspections", "insp-1"), { depositDeduction: 0 })
    );
  });

  test("staff can record findings", async () => {
    await assertSucceeds(
      updateDoc(doc(as("manager"), "inspections", "insp-1"), { depositDeduction: 430 })
    );
  });
});

// ============================================================
// Notifications — written by the webhook, read by people
// ============================================================

describe("notifications", () => {
  test("staff read their org's notifications", async () => {
    await assertSucceeds(getDoc(doc(as("manager"), "notifications", "notif-mgr")));
  });

  test("a tenant reads one addressed to them", async () => {
    await assertSucceeds(getDoc(doc(as("tenant"), "notifications", "notif-t1")));
  });

  test("a tenant cannot read another tenant's notification", async () => {
    await assertFails(getDoc(doc(as("tenant2"), "notifications", "notif-t1")));
  });

  test("nobody can fabricate a notification", async () => {
    await assertFails(
      setDoc(doc(as("tenant"), "notifications", "fake"), {
        orgId: ORG, audience: "tenant", tenantId: "tenant-1", read: false, title: "Rent received",
      })
    );
  });

  test("marking one read is allowed", async () => {
    await assertSucceeds(updateDoc(doc(as("tenant"), "notifications", "notif-t1"), { read: true }));
  });

  test("rewriting the message while marking it read is not", async () => {
    await assertFails(
      updateDoc(doc(as("tenant"), "notifications", "notif-t1"), { read: true, title: "Rewritten" })
    );
  });
});

// ============================================================
// Maintenance reporting
// ============================================================
// Reports from the public now arrive through /api/public/maintenance, which
// resolves the organisation itself and checks the property and unit belong to
// it. Direct writes from a browser are closed.

describe("maintenance", () => {
  const valid = {
    orgId: ORG,
    status: "submitted",
    title: "No hot water",
    description: "The water heater has stopped working.",
    unitId: "unit-1",
    propertyId: "prop-1",
    category: "plumbing",
    priority: "urgent",
  };

  test("an unauthenticated reporter cannot write straight to Firestore", async () => {
    await assertFails(setDoc(doc(anon(), "maintenance", "public-1"), valid));
  });

  test("a tenant can file a request for themselves", async () => {
    await assertSucceeds(
      setDoc(doc(as("tenant"), "maintenance", "tenant-filed"), { ...valid, tenantId: "tenant-1" })
    );
  });

  test("a tenant cannot file one in someone else's name", async () => {
    await assertFails(
      setDoc(doc(as("tenant"), "maintenance", "impersonated"), { ...valid, tenantId: "tenant-2" })
    );
  });

  test("staff can file a request taken over the phone", async () => {
    await assertSucceeds(setDoc(doc(as("manager"), "maintenance", "staff-filed"), valid));
  });

  test("staff cannot file into another organisation", async () => {
    await assertFails(
      setDoc(doc(as("outsider"), "maintenance", "cross-org"), valid)
    );
  });

  test("a request cannot be filed pre-completed", async () => {
    await assertFails(
      setDoc(doc(as("manager"), "maintenance", "public-3"), { ...valid, status: "completed" })
    );
  });

  test("an empty title is rejected", async () => {
    await assertFails(setDoc(doc(as("manager"), "maintenance", "public-4"), { ...valid, title: "" }));
  });

  test("an absurdly long title is rejected", async () => {
    await assertFails(
      setDoc(doc(as("manager"), "maintenance", "public-5"), { ...valid, title: "x".repeat(300) })
    );
  });

  test("an anonymous visitor cannot read the org's requests", async () => {
    await assertFails(getDoc(doc(anon(), "maintenance", "staff-filed")));
  });
});

// ============================================================
// Applications
// ============================================================

describe("applications", () => {
  const application = {
    orgId: ORG,
    unitId: "unit-1",
    propertyId: "prop-1",
    status: "submitted",
    applicant: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
  };

  test("the public cannot write an application directly", async () => {
    // They go through /api/public/apply, which validates the unit belongs to
    // the organisation being applied to.
    await assertFails(setDoc(doc(anon(), "applications", "anon-app"), application));
  });

  test("staff can file one taken over the phone", async () => {
    await assertSucceeds(setDoc(doc(as("manager"), "applications", "staff-app"), application));
  });

  test("a tenant cannot file an application into the org", async () => {
    await assertFails(setDoc(doc(as("tenant"), "applications", "tenant-app"), application));
  });
});

// ============================================================
// The organisation record — plan, billing and payout details
// ============================================================

describe("organizations", () => {
  test("staff can read their own organisation", async () => {
    await assertSucceeds(getDoc(doc(as("manager"), "organizations", ORG)));
  });

  test("another org cannot read it", async () => {
    await assertFails(getDoc(doc(as("outsider"), "organizations", ORG)));
  });

  test("nobody can found an organisation from the browser", async () => {
    // /api/org/create does this with the Admin SDK after verifying the caller.
    // Left open, a signup could create an org naming anyone as owner, already
    // marked as paying.
    await assertFails(
      setDoc(doc(as("founder"), "organizations", "org-diy"), {
        name: "Do It Yourself", ownerId: "founder", plan: "enterprise",
        billing: { status: "active" },
      })
    );
  });

  test("a manager can rename the organisation", async () => {
    await assertSucceeds(
      updateDoc(doc(as("manager"), "organizations", ORG), { name: "Davis Housing Services LLC" })
    );
  });

  test("a manager cannot give themselves a free subscription", async () => {
    await assertFails(
      updateDoc(doc(as("manager"), "organizations", ORG), {
        billing: { status: "active", stripeSubscriptionId: "sub_forged" },
      })
    );
  });

  test("a manager cannot upgrade their own plan", async () => {
    await assertFails(
      updateDoc(doc(as("manager"), "organizations", ORG), { plan: "enterprise" })
    );
  });

  test("a manager cannot redirect rent to another Stripe account", async () => {
    // The payouts block names the account tenants' rent is paid into.
    await assertFails(
      updateDoc(doc(as("manager"), "organizations", ORG), {
        payouts: { stripeAccountId: "acct_attacker", chargesEnabled: true },
      })
    );
  });

  test("a manager cannot change the public slug", async () => {
    await assertFails(
      updateDoc(doc(as("manager"), "organizations", ORG), { slug: "somebody-elses-name" })
    );
  });

  test("a tenant cannot edit the organisation at all", async () => {
    await assertFails(
      updateDoc(doc(as("tenant"), "organizations", ORG), { name: "Tenant Co" })
    );
  });
});

// ============================================================
// Invitations — a credential, not a document
// ============================================================

describe("invites", () => {
  test("org staff can list their own invitations", async () => {
    await assertSucceeds(getDoc(doc(as("manager"), "invites", "invite-1")));
  });

  test("another org cannot read them", async () => {
    await assertFails(getDoc(doc(as("outsider"), "invites", "invite-1")));
  });

  test("a tenant cannot read them", async () => {
    await assertFails(getDoc(doc(as("tenant"), "invites", "invite-1")));
  });

  test("nobody can mint an invitation from the browser", async () => {
    await assertFails(
      setDoc(doc(as("manager"), "invites", "self-issued"), {
        orgId: ORG, email: "friend@example.com", role: "owner", status: "pending",
      })
    );
  });

  test("nobody can accept one by editing it", async () => {
    await assertFails(
      updateDoc(doc(as("tenant"), "invites", "invite-1"), { status: "accepted" })
    );
  });
});

// ============================================================
// The subscription gate
// ============================================================
// An organisation that has stopped paying keeps everything it has, and keeps
// working with it. What it cannot do is take on more.

describe("billing gate", () => {
  test("a paying org can add a unit", async () => {
    await assertSucceeds(
      setDoc(doc(as("manager"), "units", "new-unit"), { orgId: ORG, unitNumber: "202" })
    );
  });

  test("a cancelled org cannot add a unit", async () => {
    await assertFails(
      setDoc(doc(as("lapsed"), "units", "lapsed-new"), { orgId: LAPSED_ORG, unitNumber: "2" })
    );
  });

  test("a cancelled org cannot add a property", async () => {
    await assertFails(
      setDoc(doc(as("lapsed"), "properties", "lapsed-prop"), { orgId: LAPSED_ORG, name: "New Block" })
    );
  });

  test("a cancelled org can still read its own records", async () => {
    await assertSucceeds(getDoc(doc(as("lapsed"), "units", "lapsed-unit")));
  });

  test("a cancelled org can still edit its own records", async () => {
    await assertSucceeds(
      updateDoc(doc(as("lapsed"), "units", "lapsed-unit"), { status: "maintenance" })
    );
  });
});

// ============================================================
// The read-only demo visitor
// ============================================================
// Anyone on the internet can become this identity by clicking "View Demo".
// Everything it may do has to be safe in the hands of a stranger.

describe("demo guest", () => {
  test("can read the demo organisation's portfolio", async () => {
    await assertSucceeds(getDoc(doc(as("guest"), "properties", "prop-1")));
    await assertSucceeds(getDoc(doc(as("guest"), "units", "unit-1")));
    await assertSucceeds(getDoc(doc(as("guest"), "leases", "lease-1")));
    await assertSucceeds(getDoc(doc(as("guest"), "transactions", "txn-1")));
  });

  test("can read the organisation record", async () => {
    await assertSucceeds(getDoc(doc(as("guest"), "organizations", ORG)));
  });

  test("cannot read another organisation", async () => {
    // The tour is confined to the org its profile names.
    await assertFails(getDoc(doc(as("guest"), "units", "lapsed-unit")));
  });

  test("cannot read invitations", async () => {
    // The document id is the token that admits its holder to the organisation:
    // a visitor able to list them could join for real.
    await assertFails(getDoc(doc(as("guest"), "invites", "invite-1")));
  });

  test("cannot read staff profiles", async () => {
    await assertFails(getDoc(doc(as("guest"), "users", "manager")));
  });

  test("cannot create anything", async () => {
    await assertFails(
      setDoc(doc(as("guest"), "properties", "guest-prop"), { orgId: ORG, name: "Mine now" })
    );
    await assertFails(
      setDoc(doc(as("guest"), "units", "guest-unit"), { orgId: ORG, unitNumber: "999" })
    );
    await assertFails(
      setDoc(doc(as("guest"), "maintenance", "guest-maint"), {
        orgId: ORG, status: "submitted", title: "x", description: "",
        unitId: "unit-1", propertyId: "prop-1",
      })
    );
  });

  test("cannot edit or delete existing records", async () => {
    await assertFails(updateDoc(doc(as("guest"), "units", "unit-1"), { rent: 1 }));
    await assertFails(updateDoc(doc(as("guest"), "tenants", "tenant-1"), { phone: "x" }));
    await assertFails(deleteDoc(doc(as("guest"), "properties", "prop-1")));
  });

  test("cannot touch the organisation's settings or billing", async () => {
    await assertFails(updateDoc(doc(as("guest"), "organizations", ORG), { name: "Demo Co" }));
  });

  test("cannot rename the shared demo identity", async () => {
    // One visitor editing it would edit it for every other visitor.
    await assertFails(
      updateDoc(doc(as("guest"), "users", "guest"), { displayName: "Anything" })
    );
  });

  test("cannot mark notifications as read", async () => {
    await assertFails(
      updateDoc(doc(as("guest"), "notifications", "notif-mgr"), { read: true })
    );
  });
});

// ============================================================
// Support access
// ============================================================
// A RentOS operator helping a customer. The grant is one organization at a
// time, expiring, and read-only unless editing was explicitly asked for —
// because the alternative, standing access to every customer, means one stolen
// operator session exposes the whole platform.

describe("support sessions", () => {
  test("an operator with no session cannot read a customer's data", async () => {
    // super_admin on its own grants nothing. The console reads counts through
    // the Admin SDK, not through these rules.
    await assertFails(getDoc(doc(as("outsider"), "units", "lapsed-unit")));
  });

  test("an operator with a live session can read that customer", async () => {
    await assertSucceeds(getDoc(doc(as("operator"), "units", "lapsed-unit")));
  });

  test("a read-only session cannot write", async () => {
    await assertFails(
      updateDoc(doc(as("operator"), "units", "lapsed-unit"), { rent: 1 })
    );
  });

  test("a session does not reach organisations it was not opened for", async () => {
    // The grant names LAPSED_ORG; ORG is somebody else's.
    await assertFails(getDoc(doc(as("operator"), "tenants", "tenant-1")));
  });

  test("an expired session grants nothing, even with editing enabled", async () => {
    await assertFails(getDoc(doc(as("operator2"), "units", "lapsed-unit")));
    await assertFails(
      updateDoc(doc(as("operator2"), "units", "lapsed-unit"), { rent: 1 })
    );
  });

  test("an operator cannot grant themselves a session", async () => {
    // Issuing goes through /api/admin/support-session, which checks the role.
    // A client that could write these could take any customer's data.
    await assertFails(
      setDoc(doc(as("operator"), "support_sessions", "operator"), {
        adminUid: "operator", orgId: ORG, writeEnabled: true,
        expiresAt: new Date(Date.now() + 3600_000),
      })
    );
  });

  test("an operator cannot extend or widen their own session", async () => {
    await assertFails(
      updateDoc(doc(as("operator"), "support_sessions", "operator"), {
        writeEnabled: true,
      })
    );
  });

  test("an operator can read their own session but not another's", async () => {
    await assertSucceeds(getDoc(doc(as("operator"), "support_sessions", "operator")));
    await assertFails(getDoc(doc(as("operator"), "support_sessions", "operator2")));
  });

  test("the access log is not readable or writable by any client", async () => {
    await assertFails(getDoc(doc(as("operator"), "support_audit", "anything")));
    await assertFails(
      setDoc(doc(as("operator"), "support_audit", "forged"), { event: "opened" })
    );
  });

  test("an ordinary manager gets nothing from a session document", async () => {
    // Only super_admin profiles are considered; a manager who somehow had a
    // session document would still be refused.
    await assertFails(getDoc(doc(as("manager"), "units", "lapsed-unit")));
  });
});

// ============================================================
// Support access — looking through one person's eyes
// ============================================================
// Impersonation has to reproduce what a tenant CANNOT see as well as what they
// can, or it cannot answer "my portal says I have no lease".

describe("support role impersonation", () => {
  before(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      // operator looks through tenant-1's eyes, inside ORG.
      await setDoc(doc(db, "support_sessions", "operator"), {
        adminUid: "operator", adminEmail: "ops@rentos.app",
        orgId: ORG, orgName: "Davis Housing Services",
        reason: "Ticket 500 — portal shows no lease",
        writeEnabled: false,
        viewAsRole: "tenant", viewAsSubjectId: "tenant-1",
        viewAsSubjectName: "Sarah Chen",
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600_000),
      });
    });
  });

  test("sees what that tenant sees", async () => {
    await assertSucceeds(getDoc(doc(as("operator"), "leases", "lease-1")));
    await assertSucceeds(getDoc(doc(as("operator"), "transactions", "txn-1")));
    await assertSucceeds(getDoc(doc(as("operator"), "tenants", "tenant-1")));
  });

  test("does not see what that tenant cannot", async () => {
    // The whole point: a staff-level view would show these and hide the bug.
    await assertFails(getDoc(doc(as("operator"), "tenants", "tenant-2")));
    await assertFails(getDoc(doc(as("operator"), "unit_notes", "note-1")));
    await assertFails(getDoc(doc(as("operator"), "keys", "key-1")));
    await assertFails(getDoc(doc(as("operator"), "properties", "prop-1")));
  });

  test("cannot write, even though the org is theirs to support", async () => {
    // A record written here would carry the tenant's name for something they
    // did not do, so writeEnabled is refused server-side and ignored here.
    await assertFails(
      updateDoc(doc(as("operator"), "tenants", "tenant-1"), { phone: "(000) 000-0000" })
    );
    await assertFails(
      setDoc(doc(as("operator"), "maintenance", "as-tenant"), {
        orgId: ORG, status: "submitted", title: "Filed by an operator",
        description: "", unitId: "unit-1", propertyId: "prop-1", tenantId: "tenant-1",
      })
    );
  });

  test("an impersonated session is still confined to its own organisation", async () => {
    await assertFails(getDoc(doc(as("operator"), "units", "lapsed-unit")));
  });

  test("impersonation does not leak to other operators", async () => {
    // operator2's session is expired; it must not inherit operator's subject.
    await assertFails(getDoc(doc(as("operator2"), "leases", "lease-1")));
  });
});

// ============================================================
// Product feedback
// ============================================================

describe("feedback", () => {
  const entry = (over = {}) => ({
    orgId: ORG,
    userId: "manager",
    userName: "Manager",
    userEmail: "m@example.com",
    userRole: "manager",
    page: "/dashboard",
    type: "bug",
    message: "The revenue chart shows someone else's numbers.",
    status: "new",
    createdAt: new Date().toISOString(),
    ...over,
  });

  test("a signed-in member can send feedback", async () => {
    await assertSucceeds(setDoc(doc(as("manager"), "feedback", "fb-1"), entry()));
  });

  test("a tenant can send it too", async () => {
    // A tenant's "I cannot see my lease" is worth more than a relayed version.
    await assertSucceeds(
      setDoc(doc(as("tenant"), "feedback", "fb-tenant"), entry({
        userId: "tenant", userRole: "tenant", page: "/portal/lease",
      }))
    );
  });

  test("it cannot be filed in somebody else's name", async () => {
    await assertFails(
      setDoc(doc(as("tenant"), "feedback", "fb-forged"), entry({ userId: "manager" }))
    );
  });

  test("it cannot be filed into another organisation", async () => {
    await assertFails(
      setDoc(doc(as("manager"), "feedback", "fb-cross"), entry({ orgId: OTHER_ORG }))
    );
  });

  test("it cannot arrive pre-answered", async () => {
    // Otherwise a customer could publish a reply in our voice.
    await assertFails(
      setDoc(doc(as("manager"), "feedback", "fb-answered"), entry({
        adminNotes: "We have fixed this, honest.",
      }))
    );
  });

  test("it cannot arrive already resolved", async () => {
    await assertFails(
      setDoc(doc(as("manager"), "feedback", "fb-done"), entry({ status: "done" }))
    );
  });

  test("an empty or enormous message is rejected", async () => {
    await assertFails(setDoc(doc(as("manager"), "feedback", "fb-empty"), entry({ message: "" })));
    await assertFails(
      setDoc(doc(as("manager"), "feedback", "fb-huge"), entry({ message: "x".repeat(5000) }))
    );
  });

  test("a demo visitor cannot send any", async () => {
    // The demo is open to the internet; a writable collection there is a spam queue.
    await assertFails(
      setDoc(doc(as("guest"), "feedback", "fb-guest"), entry({ userId: "guest", userRole: "guest" }))
    );
  });

  test("the sender can read their own", async () => {
    await assertSucceeds(getDoc(doc(as("manager"), "feedback", "fb-1")));
  });

  test("a tenant cannot read another person's feedback", async () => {
    await assertFails(getDoc(doc(as("tenant2"), "feedback", "fb-tenant")));
  });

  test("another organisation cannot read it", async () => {
    await assertFails(getDoc(doc(as("outsider"), "feedback", "fb-1")));
  });

  test("nobody can answer their own feedback", async () => {
    // Replies go through /api/admin/feedback under the operator role.
    await assertFails(
      updateDoc(doc(as("manager"), "feedback", "fb-1"), {
        status: "done", adminNotes: "Fixed by me.",
      })
    );
  });

  test("nobody can delete feedback", async () => {
    await assertFails(deleteDoc(doc(as("manager"), "feedback", "fb-1")));
  });
});

// ============================================================
// Rent receipts and pay-or-quit notices
// ============================================================
// Both are documents the tenant has been handed. They read their own, they
// change nothing, and neither survives editing after issue.

describe("rent receipts", () => {
  test("staff read and issue them", async () => {
    await assertSucceeds(getDoc(doc(as("manager"), "receipts", "receipt-1")));
    await assertSucceeds(
      setDoc(doc(as("manager"), "receipts", "receipt-new"), {
        orgId: ORG, number: "R-1", paymentId: "txn-2", tenantId: "tenant-1",
        leaseId: "lease-1", unitId: "unit-1", propertyId: "prop-1",
        amount: 500, period: "2026-10", paidOn: "2026-10-01", method: "Cash",
        balanceAfter: 1500, tenantName: "Sarah Chen", unitLabel: "Unit 101",
        propertyName: "Russell Commons", landlordName: "Demo Org",
        issuedBy: "Manager", issuedAt: "2026-10-01T10:00:00.000Z",
      })
    );
  });

  test("the tenant reads their own", async () => {
    await assertSucceeds(getDoc(doc(as("tenant"), "receipts", "receipt-1")));
  });

  test("another tenant in the same org cannot", async () => {
    await assertFails(getDoc(doc(as("tenant2"), "receipts", "receipt-1")));
  });

  test("a tenant account with no tenantId reads nothing", async () => {
    // The empty-string trap: '' must not match a document's missing field.
    await assertFails(getDoc(doc(as("unlinked"), "receipts", "receipt-1")));
  });

  test("another organisation cannot see it", async () => {
    await assertFails(getDoc(doc(as("outsider"), "receipts", "receipt-1")));
  });

  test("nobody edits a receipt after it is issued", async () => {
    // A receipt whose figures can change is not evidence of anything.
    await assertFails(updateDoc(doc(as("manager"), "receipts", "receipt-1"), { amount: 1 }));
    await assertFails(updateDoc(doc(as("tenant"), "receipts", "receipt-1"), { amount: 999 }));
  });

  test("a tenant cannot write themselves one", async () => {
    await assertFails(
      setDoc(doc(as("tenant"), "receipts", "forged"), {
        orgId: ORG, tenantId: "tenant-1", amount: 2000, number: "R-fake",
      })
    );
  });
});

describe("pay-or-quit notices", () => {
  test("staff issue and read them", async () => {
    await assertSucceeds(getDoc(doc(as("manager"), "notices", "notice-1")));
  });

  test("the tenant named on it can read it", async () => {
    // They were handed the paper too; a resident who cannot see what is
    // demanded cannot pay it.
    await assertSucceeds(getDoc(doc(as("tenant"), "notices", "notice-1")));
  });

  test("a tenant not named on it cannot", async () => {
    await assertFails(getDoc(doc(as("tenant2"), "notices", "notice-1")));
  });

  test("another organisation cannot", async () => {
    await assertFails(getDoc(doc(as("outsider"), "notices", "notice-1")));
  });

  test("the demand cannot be edited after service", async () => {
    // The tenant paid against a figure; it must not move afterwards.
    await assertFails(updateDoc(doc(as("manager"), "notices", "notice-1"), { amountDemanded: 5000 }));
    await assertFails(updateDoc(doc(as("manager"), "notices", "notice-1"), { deadline: "2026-10-01" }));
    await assertFails(updateDoc(doc(as("manager"), "notices", "notice-1"), { servedOn: "2026-09-01" }));
    await assertFails(
      updateDoc(doc(as("manager"), "notices", "notice-1"), {
        periods: [{ period: "2026-09", dueDate: "2026-09-01", owed: 9999 }],
      })
    );
  });

  test("but staff may close it out", async () => {
    await assertSucceeds(
      updateDoc(doc(as("manager"), "notices", "notice-1"), {
        status: "paid", resolvedAt: "2026-09-16T00:00:00.000Z",
      })
    );
  });

  test("the tenant cannot close it out, or write one", async () => {
    await assertFails(updateDoc(doc(as("tenant"), "notices", "notice-1"), { status: "withdrawn" }));
    await assertFails(
      setDoc(doc(as("tenant"), "notices", "self-serve"), {
        orgId: ORG, tenantIds: ["tenant-1"], amountDemanded: 0, status: "served",
      })
    );
  });
});
