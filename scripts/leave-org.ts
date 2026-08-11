/**
 * Detaches an account from its organization so it can found a new one.
 *
 * The counterpart to link-user-to-org.ts. Two situations need it: somebody
 * linked to the wrong organization, and — the case this was written for — an
 * account parked in a demo org that now wants a real one of its own.
 *
 * Founding an organization refuses while the caller already belongs to one
 * (see api/org/create), because their properties, tenants and leases all carry
 * the old orgId and would be orphaned the moment the profile moved. So leaving
 * has to be explicit.
 *
 * The account is moved to an org id that does not exist rather than being
 * deleted: the login, and anything referencing it, stays intact, and the
 * onboarding gate — which triggers on "your profile names an organization that
 * is not there" — takes over on the next sign-in.
 *
 *   npm run leave-org -- someone@example.com
 *   npm run leave-org -- someone@example.com --force   # even if they own it
 *
 * Credentials: either FIREBASE_SERVICE_ACCOUNT_KEY (the whole key as JSON) or
 * GOOGLE_APPLICATION_CREDENTIALS pointing at the key file.
 */

import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { Collections } from "../src/lib/firestore";

const args = process.argv.slice(2);
const force = args.includes("--force");
const email = args.find((a) => !a.startsWith("--"));

if (!email) {
  console.error(
    "Usage: npm run leave-org -- <email> [--force]\n" +
      "  --force detaches even the organization's owner, leaving it unowned."
  );
  process.exit(1);
}

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

async function main(): Promise<void> {
  const { auth, db } = connect();

  const user = await auth.getUserByEmail(email!).catch(() => null);
  if (!user) {
    console.error(`No account found for ${email}.`);
    process.exit(1);
  }

  const ref = db.collection(Collections.USERS).doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`${email} has no profile document — nothing to detach.`);
    process.exit(1);
  }

  const profile = snap.data() ?? {};
  const currentOrgId = (profile.orgId as string) ?? "";

  const orgSnap = currentOrgId
    ? await db.collection(Collections.ORGANIZATIONS).doc(currentOrgId).get()
    : null;

  if (!orgSnap?.exists) {
    console.log(
      `${email} is not in a real organization (orgId: ${currentOrgId || "none"}).\n` +
        "They will land on onboarding at the next sign-in already."
    );
    return;
  }

  const org = orgSnap.data() ?? {};

  // Detaching an owner leaves the organization with an ownerId nobody holds:
  // nobody can be billed for it and nobody is undemotable in it.
  if (org.ownerId === user.uid && !force) {
    console.error(
      `${email} owns "${org.name}" (${currentOrgId}).\n` +
        "Transfer ownership first, or pass --force to detach anyway."
    );
    process.exit(1);
  }

  // An id that cannot collide with a real organization, so the onboarding gate
  // fires and api/org/create's "do you already belong somewhere" check passes.
  const parkedOrgId = `pending-${user.uid.slice(0, 8)}`;

  await ref.set(
    {
      orgId: parkedOrgId,
      role: "manager",
      // A leftover link would scope the account to one tenancy or vendor inside
      // an organization it is no longer part of.
      tenantId: FieldValue.delete(),
      vendorId: FieldValue.delete(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  console.log(
    `${email} left "${org.name}" (${currentOrgId}).\n` +
      `  parked at: ${parkedOrgId}`
  );
  console.log("Sign out and back in — onboarding will ask them to set up an organization.");
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
