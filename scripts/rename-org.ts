/**
 * Renames an organization and moves its public web address.
 *
 * The slug is the organization's identity on every public page — /o/{slug} is
 * what goes on repair notices and listings — so it is deliberately not editable
 * from the app: firestore.rules pins it, because changing it silently breaks
 * every link already printed or emailed. Moving one is a considered act, which
 * is what this script is for.
 *
 * The document id is left alone. It is internal, never shown, and every record
 * in the organization carries it as orgId; rewriting it would mean rewriting
 * the whole portfolio to gain nothing.
 *
 *   npm run rename-org -- org-1 "RentOS Demo" demo
 *
 * Credentials: either FIREBASE_SERVICE_ACCOUNT_KEY (the whole key as JSON, as
 * the seed script takes it) or GOOGLE_APPLICATION_CREDENTIALS pointing at the
 * key file. The second is easier and safer: the key never has to be pasted
 * anywhere, and it can live outside the repository.
 */

import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { Collections } from "../src/lib/collections";

const [orgId, name, slug] = process.argv.slice(2);

if (!orgId || !name || !slug) {
  console.error(
    'Usage: npm run rename-org -- <orgId> "<new name>" <new-slug>\n' +
      '  e.g. npm run rename-org -- org-1 "RentOS Demo" demo'
  );
  process.exit(1);
}

// Mirrors the validation in src/app/api/org/create/route.ts, so a slug set here
// is one the sign-up flow would also have accepted.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;

if (!SLUG_RE.test(slug)) {
  console.error(
    `"${slug}" is not a valid web address.\n` +
      "  Use 3-40 characters: lowercase letters, numbers and dashes."
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
  return getFirestore();
}

async function main(): Promise<void> {
  const db = connect();

  const ref = db.collection(Collections.ORGANIZATIONS).doc(orgId);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`Organization "${orgId}" does not exist.`);
    process.exit(1);
  }

  const current = snap.data() ?? {};

  // Two organizations sharing a slug would make /o/{slug} ambiguous: the public
  // resolver takes the first match, so one of them would quietly become
  // unreachable.
  const clash = await db
    .collection(Collections.ORGANIZATIONS)
    .where("slug", "==", slug)
    .limit(2)
    .get();
  const takenByAnother = clash.docs.find((d) => d.id !== orgId);
  if (takenByAnother) {
    console.error(
      `The address "${slug}" already belongs to "${takenByAnother.data().name}" (${takenByAnother.id}).`
    );
    process.exit(1);
  }

  await ref.set(
    { name, slug, updatedAt: new Date().toISOString() },
    { merge: true }
  );

  console.log(
    `Renamed ${orgId}: "${current.name ?? "(unnamed)"}" -> "${name}"\n` +
      `  public address: /o/${current.slug ?? orgId} -> /o/${slug}`
  );
  console.log("Any link to the old address will stop working.");
}

main().catch((err) => {
  console.error("Rename failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
