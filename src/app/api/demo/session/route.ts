import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/collections";
import { DEFAULT_DEMO_ORG_ID } from "@/lib/demo-session";
import { errorMessage } from "@/lib/errors";

/**
 * POST /api/demo/session — turns an anonymous visitor into a read-only guest.
 *
 * "View Demo" on the marketing site used to link to /login, which asked a
 * prospect who had never signed up for credentials they could not have. Now the
 * browser signs in anonymously and calls this, which grants that throwaway
 * identity read access to the demo organization: the real manager dashboard,
 * populated, with nothing they can break.
 *
 * Why the server has to do it: orgId and role decide what a profile may see,
 * and the rules forbid a client from writing either to its own profile. That
 * restriction is what stops a signup walking into somebody else's portfolio, so
 * the demo cannot be an exception to it.
 *
 * Read-only is enforced by the rules, not by this route:
 *
 *   - role 'guest' appears in none of the staff lists in firestore.rules, so it
 *     satisfies no create, update or delete rule anywhere.
 *   - It carries no tenantId or vendorId, so the tenant and contractor
 *     exemptions do not apply to it either.
 *   - Its orgId is the demo organization, so canViewOrg() lets it read that one
 *     organization and no other.
 *
 * (An earlier version minted a custom token for a single shared demo identity.
 * That needs iam.serviceAccounts.signBlob, which the Cloud Run runtime account
 * does not have, so it failed in production and worked locally — exactly the
 * kind of split this app has been bitten by before.)
 */

const DEMO_ORG_ID = process.env.DEMO_ORG_ID || DEFAULT_DEMO_ORG_ID;

export async function POST(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) {
    return NextResponse.json({ error: "Missing session token" }, { status: 401 });
  }

  const db = await getAdminDb();

  const org = await db.collection(Collections.ORGANIZATIONS).doc(DEMO_ORG_ID).get();
  if (!org.exists) {
    console.error(`[demo/session] DEMO_ORG_ID "${DEMO_ORG_ID}" does not exist`);
    return NextResponse.json(
      { error: "The demo is unavailable at the moment." },
      { status: 503 }
    );
  }

  try {
    const auth = await getAdminAuth();
    const decoded = await auth.verifyIdToken(token);

    // Anonymous sessions only. Without this, a signed-in manager who called
    // this route — by accident or by being pointed at it — would have their own
    // profile rewritten to a read-only guest in somebody else's organization.
    if (decoded.firebase?.sign_in_provider !== "anonymous") {
      return NextResponse.json(
        { error: "Sign out first to view the demo." },
        { status: 403 }
      );
    }

    await db.collection(Collections.USERS).doc(decoded.uid).set(
      {
        id: decoded.uid,
        email: "",
        displayName: "Demo Visitor",
        role: "guest",
        orgId: DEMO_ORG_ID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      orgId: DEMO_ORG_ID,
      orgName: (org.data()?.name as string) ?? "RentOS Demo",
    });
  } catch (err) {
    console.error("[demo/session]", errorMessage(err));
    return NextResponse.json(
      { error: "The demo could not be started." },
      { status: 500 }
    );
  }
}
