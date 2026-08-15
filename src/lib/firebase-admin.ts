import type { Auth } from "firebase-admin/auth";
import type { FieldValue, Firestore } from "firebase-admin/firestore";
import { nodeImport } from "./node-import";

/**
 * Server-side Firebase access for API routes.
 *
 * The client SDK in ./firebase.ts runs as the signed-in user and is subject to
 * security rules. Webhooks have no signed-in user -- Stripe calls us directly --
 * so they need the Admin SDK, which bypasses rules. The API routes use it for a
 * second reason: orgId, role and tenantId decide what a profile may see, and the
 * rules forbid a client from writing any of them, so only the Admin SDK can
 * create an organization or admit somebody to one.
 *
 * firebase-admin is imported at call time, not at module scope. Firebase's
 * deploy step loads the server bundle to discover its exports and gives up
 * after 10s; pulling in the admin SDK (gRPC and the auth stack) at import time
 * blows that budget and fails the deploy with "Cannot determine backend
 * specification". Loading it inside the call also keeps it off the cold-start
 * path for every route that never touches Firestore server-side.
 *
 * It goes through nodeImport rather than a plain dynamic import -- see
 * ./node-import.ts for why a bundler-visible import breaks in production.
 *
 * On Cloud Run (where the SSR function runs) credentials come from Application
 * Default Credentials automatically, so no key file is needed in production.
 * FIREBASE_SERVICE_ACCOUNT_KEY is only a local-development escape hatch.
 */

let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;

/** The one place the admin app is initialised, so routes cannot race each other. */
async function getAdminApp() {
  const { getApps, initializeApp, cert } =
    await nodeImport<typeof import("firebase-admin/app")>("firebase-admin/app");

  const existing = getApps();
  if (existing.length > 0) return existing[0];

  return process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? initializeApp({
        credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
      })
    : // Application Default Credentials -- the production path.
      initializeApp();
}

export async function getAdminDb(): Promise<Firestore> {
  if (cachedDb) return cachedDb;

  const app = await getAdminApp();
  const { getFirestore } =
    await nodeImport<typeof import("firebase-admin/firestore")>("firebase-admin/firestore");

  cachedDb = getFirestore(app);
  return cachedDb;
}

export async function getAdminAuth(): Promise<Auth> {
  if (cachedAuth) return cachedAuth;

  const app = await getAdminApp();
  const { getAuth } = await nodeImport<typeof import("firebase-admin/auth")>("firebase-admin/auth");

  cachedAuth = getAuth(app);
  return cachedAuth;
}

/** FieldValue, for deleting fields and other sentinels. */
export async function getFieldValue(): Promise<typeof FieldValue> {
  const { FieldValue: fv } =
    await nodeImport<typeof import("firebase-admin/firestore")>("firebase-admin/firestore");
  return fv;
}
