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

    // The org must exist: several create rules check it, and the users rule
    // uses its absence to decide whether someone is founding a new org.
    await setDoc(doc(db, "organizations", ORG), { name: "Davis Housing Services" });

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
// Public maintenance reporting
// ============================================================

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

  test("an unauthenticated reporter can file a request", async () => {
    // /maintenance/report is a public page — a tenant without an account, or a
    // passer-by reporting a hazard, has to be able to file.
    await assertSucceeds(setDoc(doc(anon(), "maintenance", "public-1"), valid));
  });

  test("a request cannot be filed into an organisation that does not exist", async () => {
    await assertFails(
      setDoc(doc(anon(), "maintenance", "public-2"), { ...valid, orgId: "org-does-not-exist" })
    );
  });

  test("a request cannot be filed pre-completed", async () => {
    await assertFails(
      setDoc(doc(anon(), "maintenance", "public-3"), { ...valid, status: "completed" })
    );
  });

  test("an empty title is rejected", async () => {
    await assertFails(setDoc(doc(anon(), "maintenance", "public-4"), { ...valid, title: "" }));
  });

  test("an absurdly long title is rejected", async () => {
    await assertFails(
      setDoc(doc(anon(), "maintenance", "public-5"), { ...valid, title: "x".repeat(300) })
    );
  });

  test("an anonymous reporter cannot then read the org's requests", async () => {
    await assertFails(getDoc(doc(anon(), "maintenance", "public-1")));
  });
});
