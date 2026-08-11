/**
 * Seeds Firestore with the demo portfolio from src/lib/mock-data.ts.
 *
 * The app runs on mock data until NEXT_PUBLIC_FIREBASE_API_KEY is set, at which
 * point every page reads Firestore instead. Without this seed that switch turns
 * a working demo into a blank app, so run this BEFORE setting that variable.
 *
 *   npm run seed              # write only if the collections are empty
 *   npm run seed -- --force   # overwrite existing documents
 *
 * Credentials: set FIREBASE_SERVICE_ACCOUNT_KEY to the full JSON of a service
 * account key (Firebase Console > Project settings > Service accounts >
 * Generate new private key). Application Default Credentials also work if you
 * have them.
 *
 * Documents keep their mock ids, so re-running overwrites in place rather than
 * creating duplicates.
 */

import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { Collections } from "../src/lib/collections";
import type { Organization } from "../src/lib/types";
import {
  mockProperties, mockUnits, mockTenants, mockMaintenanceRequests,
  mockApplications, mockLeases, mockTransactions, mockListings,
  mockSublets, mockVendors, mockWorkOrders, mockNotifications,
  mockInspections, mockKeys, mockLockChanges, mockUnitNotes, mockCalendarEvents,
} from "../src/lib/mock-data";

const force = process.argv.includes("--force");

const ORG: Organization = {
  id: "org-1",
  name: "Davis Housing Services",
  slug: "davis-housing-services",
  plan: "growth",
  ownerId: "user-1",
  settings: {
    timezone: "America/Los_Angeles",
    currency: "USD",
    lateFeeEnabled: true,
    lateFeeAmount: 50,
    lateFeeDays: 5,
    publicIntake: true,
  },
  // Security rules read billing.status before allowing new properties, units or
  // leases. Seeded as active so the demo portfolio behaves like a paying
  // customer rather than a lapsed one.
  billing: { status: "active" },
  payouts: { chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false },
  createdAt: "2024-01-01T00:00:00Z",
};

/** Every collection to seed, in no particular order — there are no write-order deps. */
const DATASETS: { collection: string; rows: { id: string }[] }[] = [
  { collection: Collections.PROPERTIES, rows: mockProperties },
  { collection: Collections.UNITS, rows: mockUnits },
  { collection: Collections.TENANTS, rows: mockTenants },
  { collection: Collections.MAINTENANCE, rows: mockMaintenanceRequests },
  { collection: Collections.APPLICATIONS, rows: mockApplications },
  { collection: Collections.LEASES, rows: mockLeases },
  { collection: Collections.TRANSACTIONS, rows: mockTransactions },
  { collection: Collections.LISTINGS, rows: mockListings },
  { collection: Collections.SUBLETS, rows: mockSublets },
  { collection: Collections.VENDORS, rows: mockVendors },
  { collection: Collections.WORK_ORDERS, rows: mockWorkOrders },
  { collection: Collections.NOTIFICATIONS, rows: mockNotifications },
  { collection: Collections.INSPECTIONS, rows: mockInspections },
  { collection: Collections.KEYS, rows: mockKeys },
  { collection: Collections.LOCK_CHANGES, rows: mockLockChanges },
  { collection: Collections.UNIT_NOTES, rows: mockUnitNotes },
  { collection: Collections.CALENDAR_EVENTS, rows: mockCalendarEvents },
];

function connect(): Firestore {
  if (getApps().length === 0) {
    const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (rawKey) {
      initializeApp({ credential: cert(JSON.parse(rawKey)) });
    } else {
      // Falls back to Application Default Credentials; throws if absent.
      initializeApp();
    }
  }
  return getFirestore();
}

async function main(): Promise<void> {
  const db = connect();

  // Refuse to clobber a database that already has data unless asked to.
  if (!force) {
    for (const { collection, rows } of DATASETS) {
      if (rows.length === 0) continue;
      const existing = await db.collection(collection).limit(1).get();
      if (!existing.empty) {
        console.error(
          `Refusing to seed: "${collection}" already has documents.\n` +
            `Re-run with --force to overwrite.`
        );
        process.exit(1);
      }
    }
  }

  let written = 0;

  await db.collection(Collections.ORGANIZATIONS).doc(ORG.id).set(ORG, { merge: true });
  written += 1;

  // Batches cap at 500 writes; every dataset here is far below that, so one
  // batch per collection is enough and keeps failures scoped.
  for (const { collection, rows } of DATASETS) {
    if (rows.length === 0) continue;
    const batch = db.batch();
    for (const row of rows) {
      batch.set(db.collection(collection).doc(row.id), row, { merge: true });
    }
    await batch.commit();
    written += rows.length;
    console.log(`  ${collection.padEnd(20)} ${rows.length} documents`);
  }

  console.log(`\nSeeded ${written} documents into rentos-pm-app.`);
}

main().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
