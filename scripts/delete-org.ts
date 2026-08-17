/**
 * Deletes an organization and everything scoped to it.
 *
 * The counterpart the toolbox was missing: link-user-to-org.ts and
 * leave-org.ts move accounts about, rename-org.ts relabels, and nothing could
 * actually remove an organization. That gap is deliberate in the security
 * rules — `organizations` is `allow delete: if false` and `users` has no delete
 * rule at all, so no browser can do this however privileged the signed-in
 * account is. It has to be the Admin SDK, which means a script.
 *
 * Written for the throwaway organizations a test or a walkthrough leaves
 * behind. It refuses a paying one, because "delete the customer" should never
 * be one mistyped argument away.
 *
 *   npm run delete-org -- <orgId|slug>              # dry run, lists what would go
 *   npm run delete-org -- <orgId|slug> --yes        # actually delete
 *   npm run delete-org -- <orgId|slug> --yes --accounts   # also delete the logins
 *
 * Credentials: either FIREBASE_SERVICE_ACCOUNT_KEY (the whole key as JSON) or
 * GOOGLE_APPLICATION_CREDENTIALS pointing at the key file. `gcloud auth
 * application-default login` also works.
 */

import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { Collections } from "../src/lib/collections";

const args = process.argv.slice(2);
const confirmed = args.includes("--yes");
const alsoAccounts = args.includes("--accounts");
const target = args.find((a) => !a.startsWith("--"));

if (!target) {
  console.error(
    "Usage: npm run delete-org -- <orgId|slug> [--yes] [--accounts]\n" +
      "  Without --yes this only reports what it would delete.\n" +
      "  --accounts also removes the Firebase Auth logins of the org's members."
  );
  process.exit(1);
}

/** Every collection carrying an orgId. Order is cosmetic; nothing depends on it. */
const ORG_SCOPED = [
  Collections.APPLICATIONS,
  Collections.INSPECTIONS,
  Collections.LEASES,
  Collections.TENANTS,
  Collections.UNITS,
  Collections.PROPERTIES,
  Collections.MAINTENANCE,
  Collections.WORK_ORDERS,
  Collections.VENDORS,
  Collections.TRANSACTIONS,
  Collections.LISTINGS,
  Collections.SUBLETS,
  Collections.NOTIFICATIONS,
  Collections.KEYS,
  Collections.LOCK_CHANGES,
  Collections.UNIT_NOTES,
  Collections.CALENDAR_EVENTS,
  Collections.INVITES,
  Collections.FEEDBACK,
];

function connect() {
  if (getApps().length === 0) {
    const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (rawKey) {
      initializeApp({ credential: cert(JSON.parse(rawKey)) });
    } else {
      initializeApp();
    }
  }
  return { auth: getAuth(), db: getFirestore() };
}

/** Accepts either the document id or the slug, because both are on screen. */
async function resolveOrg(db: Firestore, idOrSlug: string) {
  const byId = await db.collection(Collections.ORGANIZATIONS).doc(idOrSlug).get();
  if (byId.exists) return byId;

  const bySlug = await db
    .collection(Collections.ORGANIZATIONS)
    .where("slug", "==", idOrSlug)
    .limit(2)
    .get();

  if (bySlug.size > 1) {
    console.error(`"${idOrSlug}" matches more than one organization — pass the id instead.`);
    process.exit(1);
  }
  return bySlug.docs[0] ?? null;
}

/** Deletes in batches; a large org would blow the 500-write limit in one go. */
async function deleteQuery(db: Firestore, collection: string, orgId: string, dryRun: boolean) {
  let removed = 0;
  for (;;) {
    const snap = await db.collection(collection).where("orgId", "==", orgId).limit(400).get();
    if (snap.empty) break;
    removed += snap.size;
    if (dryRun) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return removed;
}

async function main(): Promise<void> {
  const { auth, db } = connect();

  const orgSnap = await resolveOrg(db, target!);
  if (!orgSnap) {
    console.error(`No organization found for "${target}".`);
    process.exit(1);
  }

  const orgId = orgSnap.id;
  const org = orgSnap.data() ?? {};
  const billingStatus = (org.billing as { status?: string } | undefined)?.status ?? "trialing";

  console.log(`Organization: ${org.name ?? "(unnamed)"}  [${orgId}]`);
  console.log(`Slug: ${org.slug ?? "—"}   Plan: ${org.plan ?? "—"}   Billing: ${billingStatus}`);

  // The guard that makes this safe to keep in the repo. An org that is paying
  // us is not a cleanup candidate, and no flag overrides that here — cancel the
  // subscription first, deliberately, then delete.
  if (billingStatus === "active" || billingStatus === "past_due") {
    console.error(
      `\nRefusing: this organization's subscription is ${billingStatus}.\n` +
        "Cancel it first if the deletion is genuinely intended."
    );
    process.exit(1);
  }

  const members = await db.collection(Collections.USERS).where("orgId", "==", orgId).get();
  console.log(`Members: ${members.size}`);
  members.docs.forEach((d) => {
    const m = d.data();
    console.log(`  · ${m.email ?? d.id} (${m.role ?? "?"})`);
  });

  console.log(`\n${confirmed ? "Deleting" : "Would delete"}:`);
  let total = 0;
  for (const collection of ORG_SCOPED) {
    const count = await deleteQuery(db, collection, orgId, !confirmed);
    if (count) {
      total += count;
      console.log(`  ${collection}: ${count}`);
    }
  }
  console.log(`  ${total} org-scoped document${total === 1 ? "" : "s"}`);

  if (!confirmed) {
    console.log(
      `\nDry run — nothing was deleted. Re-run with --yes to go ahead` +
        `${members.size ? ", and --accounts to remove the logins too" : ""}.`
    );
    return;
  }

  // Profiles before the org itself: a profile pointing at an organization that
  // is gone sends its owner into onboarding, which is a worse state to be
  // interrupted in than either end of the operation.
  for (const member of members.docs) {
    await member.ref.delete();
    if (alsoAccounts) {
      await auth.deleteUser(member.id).catch((err) => {
        console.warn(`  could not delete the login for ${member.id}: ${err.message}`);
      });
    }
  }
  console.log(`  ${members.size} member profile${members.size === 1 ? "" : "s"}${alsoAccounts ? " and login(s)" : ""}`);

  await orgSnap.ref.delete();
  console.log(`  the organization document`);

  console.log(`\nDeleted ${org.name ?? orgId}.`);
  if (!alsoAccounts && members.size) {
    console.log("The logins still exist and now belong to no organization — they will land on onboarding.");
  }
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
