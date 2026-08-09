import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/firestore";

/**
 * POST /api/auth/claim-tenancy
 *
 * Links a freshly registered account to the Tenant record that already carries
 * the same email address, so a tenant a manager added by hand can simply sign
 * up and find their lease waiting.
 *
 * Why this is a server route and not client code: orgId, role and tenantId are
 * the inputs to every security rule, so the rules forbid a client from writing
 * them to its own profile. Otherwise anyone could sign up and assign themselves
 * to any organisation. Only the Admin SDK may make this link.
 *
 * Why the email must be verified: matching on an unverified address would mean
 * anyone who knows a tenant's email could register with it and read that
 * tenant's lease, payment history and inspection reports. Google sign-in
 * verifies the address by construction; email/password does not until the user
 * clicks the link we send them.
 *
 * Auth: send the caller's Firebase ID token as `Authorization: Bearer <token>`.
 */

type ClaimResult =
  | { linked: true; tenantId: string; orgId: string }
  | { linked: false; reason: "no_match" | "already_claimed" | "email_unverified" };

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  try {
    const { getAuth } = await import("firebase-admin/auth");
    const { getApps, initializeApp, cert } = await import("firebase-admin/app");

    if (getApps().length === 0) {
      const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (rawKey) initializeApp({ credential: cert(JSON.parse(rawKey)) });
      else initializeApp();
    }

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;
    const email = (decoded.email ?? "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Account has no email address" }, { status: 400 });
    }

    // The gate. Without it this endpoint hands a stranger someone else's tenancy.
    if (!decoded.email_verified) {
      const result: ClaimResult = { linked: false, reason: "email_unverified" };
      return NextResponse.json(result);
    }

    const db = await getAdminDb();

    // Tenant emails were typed by a human, so casing varies. Query the address
    // as given and lower-cased rather than scanning the collection.
    const seen = new Set<string>();
    const candidates: { id: string; data: FirebaseFirestore.DocumentData }[] = [];

    for (const variant of new Set([email, decoded.email ?? ""])) {
      if (!variant) continue;
      const snap = await db
        .collection(Collections.TENANTS)
        .where("email", "==", variant)
        .limit(5)
        .get();
      for (const d of snap.docs) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        candidates.push({ id: d.id, data: d.data() });
      }
    }

    if (candidates.length === 0) {
      const result: ClaimResult = { linked: false, reason: "no_match" };
      return NextResponse.json(result);
    }

    // More than one tenant record sharing an address is a data problem, not a
    // decision this endpoint should guess at.
    if (candidates.length > 1) {
      console.warn(`[claim-tenancy] ${email} matches ${candidates.length} tenant records — refusing to guess`);
      const result: ClaimResult = { linked: false, reason: "no_match" };
      return NextResponse.json(result);
    }

    const tenant = candidates[0];

    // A record already linked to somebody else must not be handed over.
    const existingUserId = tenant.data.userId as string | undefined;
    if (existingUserId && existingUserId !== uid) {
      console.warn(`[claim-tenancy] tenant ${tenant.id} is already claimed by ${existingUserId}`);
      const result: ClaimResult = { linked: false, reason: "already_claimed" };
      return NextResponse.json(result);
    }

    const orgId = tenant.data.orgId as string;

    await db.collection(Collections.USERS).doc(uid).set(
      {
        id: uid,
        email: decoded.email,
        displayName: decoded.name ?? tenant.data.firstName ?? "Tenant",
        role: "tenant",
        orgId,
        tenantId: tenant.id,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Recorded on both sides so staff screens can see who has portal access.
    await db.collection(Collections.TENANTS).doc(tenant.id).set(
      { userId: uid, updatedAt: new Date().toISOString() },
      { merge: true }
    );

    console.log(`[claim-tenancy] linked ${email} to tenant ${tenant.id} in ${orgId}`);
    const result: ClaimResult = { linked: true, tenantId: tenant.id, orgId };
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[claim-tenancy] Error:", err.message);
    return NextResponse.json({ error: "Could not verify the account" }, { status: 401 });
  }
}
