import type { Firestore } from "firebase-admin/firestore";

/**
 * Server-side Firestore access for API routes.
 *
 * The client SDK in ./firebase.ts runs as the signed-in user and is subject to
 * security rules. Webhooks have no signed-in user -- Stripe calls us directly --
 * so they need the Admin SDK, which bypasses rules.
 *
 * firebase-admin is imported dynamically, not at module scope. Firebase's
 * deploy step loads the server bundle to discover its exports and gives up
 * after 10s; pulling in the admin SDK (gRPC and the auth stack) at import time
 * blows that budget and fails the deploy with "Cannot determine backend
 * specification". Loading it inside the call also keeps it off the cold-start
 * path for every route that never touches Firestore server-side.
 *
 * On Cloud Run (where the SSR function runs) credentials come from Application
 * Default Credentials automatically, so no key file is needed in production.
 * FIREBASE_SERVICE_ACCOUNT_KEY is only a local-development escape hatch.
 */

let cachedDb: Firestore | null = null;

export async function getAdminDb(): Promise<Firestore> {
  if (cachedDb) return cachedDb;

  const { getApps, initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

  const existing = getApps();
  const app =
    existing.length > 0
      ? existing[0]
      : process.env.FIREBASE_SERVICE_ACCOUNT_KEY
        ? initializeApp({
            credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
          })
        : // Application Default Credentials -- the production path.
          initializeApp();

  cachedDb = getFirestore(app);
  return cachedDb;
}
