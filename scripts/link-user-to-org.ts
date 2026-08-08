/**
 * Points an existing account at an existing organization.
 *
 * New accounts get a private org of their own (see createUserProfile in
 * src/lib/auth.ts, which assigns `org-${uid.slice(0,8)}`). That is correct for
 * real multi-tenancy, but it means the first human to sign in cannot see the
 * seeded portfolio, which lives under org-1 -- every query filters on orgId, so
 * the app looks empty rather than broken.
 *
 * This rewrites the user's profile document to join them to a given org.
 *
 *   npm run link-org -- someone@example.com
 *   npm run link-org -- someone@example.com org-1 owner
 *
 * Credentials: FIREBASE_SERVICE_ACCOUNT_KEY, same as the seed script.
 */

import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { Collections } from "../src/lib/firestore";
import type { UserRole } from "../src/lib/types";

const [email, orgId = "org-1", role = "manager", tenantId] = process.argv.slice(2);

if (!email) {
  console.error(
    "Usage: npm run link-org -- <email> [orgId] [role] [tenantId]\n" +
      "  tenantId is required for role=tenant — the security rules scope a\n" +
      "  tenant to their own lease and payments through it."
  );
  process.exit(1);
}

if (role === "tenant" && !tenantId) {
  console.error(
    "role=tenant requires a tenantId.\n" +
      "Without it the account can see nothing: rules match the caller's\n" +
      "profile tenantId against each record, and an unlinked tenant matches none."
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

  const user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) {
    console.error(
      `No account found for ${email}.\n` +
        `Sign in to the app at least once first — the account is created on first sign-in.`
    );
    process.exit(1);
  }

  const org = await db.collection(Collections.ORGANIZATIONS).doc(orgId).get();
  if (!org.exists) {
    console.error(`Organization "${orgId}" does not exist. Run "npm run seed" first.`);
    process.exit(1);
  }

  if (tenantId) {
    const tenantDoc = await db.collection(Collections.TENANTS).doc(tenantId).get();
    if (!tenantDoc.exists) {
      console.error(`Tenant record "${tenantId}" does not exist in ${orgId}.`);
      process.exit(1);
    }
    if (tenantDoc.data()?.orgId !== orgId) {
      console.error(`Tenant "${tenantId}" belongs to a different organization.`);
      process.exit(1);
    }
  }

  await db.collection(Collections.USERS).doc(user.uid).set(
    {
      id: user.uid,
      email: user.email ?? email,
      displayName: user.displayName ?? email.split("@")[0],
      role: role as UserRole,
      orgId,
      ...(tenantId ? { tenantId } : {}),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  // Keeps the link discoverable from the tenant record too, which is how staff
  // screens tell whether a tenant has portal access.
  if (tenantId) {
    await db.collection(Collections.TENANTS).doc(tenantId).set(
      { userId: user.uid, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  }

  console.log(
    `Linked ${email} (${user.uid}) to ${orgId} as ${role}` +
      (tenantId ? ` → tenant ${tenantId}.` : ".")
  );
  console.log("Sign out and back in for the change to take effect.");
}

main().catch((err) => {
  console.error("Link failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
