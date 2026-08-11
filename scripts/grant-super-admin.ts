/**
 * Makes an account a RentOS operator, or takes it back.
 *
 * super_admin is the only role that means anything across organizations: it is
 * what /admin checks before listing every customer on the platform. Nothing in
 * the app can grant it — sign-up always creates an owner or manager, and
 * invitations deliberately exclude it (see INVITABLE_ROLES) — because a role
 * that can see every customer's portfolio should never be reachable through a
 * form. This script and the Admin SDK are the only way in.
 *
 *   npm run grant-super-admin -- someone@example.com
 *   npm run grant-super-admin -- someone@example.com --revoke
 *
 * The account keeps its orgId. super_admin also counts as staff and as an
 * owner/manager within its own organization, so an operator who also runs a
 * portfolio keeps working exactly as before and gains the console on top.
 *
 * Run this AFTER founding an organization through onboarding: creating one sets
 * the founder's role to owner, which would overwrite super_admin.
 *
 * Credentials: either FIREBASE_SERVICE_ACCOUNT_KEY (the whole key as JSON, as
 * the seed script takes it) or GOOGLE_APPLICATION_CREDENTIALS pointing at the
 * key file. The second is easier and safer: the key never has to be pasted
 * anywhere, and it can live outside the repository.
 */

import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { Collections } from "../src/lib/collections";

const args = process.argv.slice(2);
const revoke = args.includes("--revoke");
const email = args.find((a) => !a.startsWith("--"));

if (!email) {
  console.error(
    "Usage: npm run grant-super-admin -- <email> [--revoke]\n" +
      "  --revoke returns the account to owner."
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
    console.error(
      `No account found for ${email}.\n` +
        "Sign in to the app at least once first — the account is created on first sign-in."
    );
    process.exit(1);
  }

  const ref = db.collection(Collections.USERS).doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(
      `${email} has signed in but has no profile document yet.\n` +
        "Open the app once more so the profile is written, then re-run this."
    );
    process.exit(1);
  }

  const profile = snap.data() ?? {};
  const role = revoke ? "owner" : "super_admin";

  if (profile.role === role) {
    console.log(`${email} is already ${role}. Nothing to do.`);
    return;
  }

  await ref.set({ role, updatedAt: new Date().toISOString() }, { merge: true });

  console.log(`${email} (${user.uid}): ${profile.role ?? "unknown"} -> ${role}`);
  console.log(`  organization: ${profile.orgId ?? "(none)"}`);
  console.log("Sign out and back in for the change to take effect.");
  if (!revoke) console.log("The RentOS Admin console is now in the sidebar.");
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
