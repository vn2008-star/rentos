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
  tenant: { role: "tenant", orgId: ORG, email: "t@example.com" },
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

  test("org tenant can read", async () => {
    await assertSucceeds(getDoc(doc(as("tenant"), "sublets", "sublet-1")));
  });

  test("another org cannot read", async () => {
    await assertFails(getDoc(doc(as("outsider"), "sublets", "sublet-1")));
  });

  test("tenant cannot delete (owner/manager only)", async () => {
    await assertFails(deleteDoc(doc(as("tenant"), "sublets", "sublet-1")));
  });
});
