import { NextResponse, type NextRequest } from "next/server";
import { requireCaller, jsonError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/collections";
import { DEFAULT_PLAN, TRIAL_DAYS } from "@/lib/plans";
import type { Organization } from "@/lib/types";

/**
 * POST /api/org/create — founds an organization for the signed-in account.
 *
 * Why this cannot be client code: orgId and role are the inputs to every
 * security rule, so the rules forbid a client from writing them to its own
 * profile. A browser that could set its own orgId could set it to somebody
 * else's. Only the Admin SDK may make the org and the membership in one go.
 *
 * Signing up gives an account a placeholder org id (see createUserProfile in
 * src/lib/auth.ts) but no organization document. Until that document exists the
 * public intake pages refuse writes — the rules require the named org to be
 * real — so this route is what turns an account into a working tenant of the
 * SaaS.
 *
 * Auth: `Authorization: Bearer <Firebase ID token>`.
 */

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;

/** Reserved because they are (or will be) routes on the same domain. */
const RESERVED_SLUGS = new Set([
  "api", "admin", "app", "dashboard", "login", "register", "onboarding",
  "settings", "billing", "team", "invite", "portal", "contractor", "listing",
  "maintenance", "o", "www", "support", "help", "status", "rentos",
]);

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export async function POST(req: NextRequest) {
  const guard = await requireCaller(req);
  if (!guard.ok) return guard.response;
  const { caller } = guard;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Expected a JSON body", 400);
  }

  const name = String(body.name ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return jsonError("Organization name must be between 2 and 80 characters", 400);
  }

  const requested = slugify(String(body.slug ?? "") || name);
  if (!SLUG_RE.test(requested)) {
    return jsonError(
      "Web address must be 3–40 characters, lowercase letters, numbers and dashes",
      400
    );
  }
  if (RESERVED_SLUGS.has(requested)) {
    return jsonError(`"${requested}" is reserved — please choose another`, 400);
  }

  const db = await getAdminDb();

  // An account that already belongs to a real organization must not found a
  // second one: their properties, tenants and leases all carry the old orgId
  // and would be orphaned the moment the profile moved.
  const currentOrg = await db
    .collection(Collections.ORGANIZATIONS)
    .doc(caller.profile.orgId)
    .get();
  if (currentOrg.exists) {
    return NextResponse.json(
      {
        error: "This account already belongs to an organization",
        orgId: caller.profile.orgId,
      },
      { status: 409 }
    );
  }

  const now = new Date();
  const trialEnds = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  // The document id IS the slug, so `create()` — which fails if the id is taken
  // — is what actually guarantees uniqueness. The query below only catches the
  // legacy case of an org whose id and slug differ (the seeded org-1), so a new
  // signup cannot shadow it on the public /o/{slug} pages.
  const candidates = [requested, ...[2, 3, 4, 5].map((n) => `${requested}-${n}`)];

  for (const candidate of candidates) {
    const clash = await db
      .collection(Collections.ORGANIZATIONS)
      .where("slug", "==", candidate)
      .limit(1)
      .get();
    if (!clash.empty) continue;

    const org: Organization = {
      id: candidate,
      name,
      slug: candidate,
      plan: DEFAULT_PLAN,
      ownerId: caller.uid,
      settings: {
        timezone: String(body.timezone ?? "America/Los_Angeles"),
        currency: String(body.currency ?? "USD"),
        lateFeeEnabled: body.lateFeeEnabled !== false,
        lateFeeAmount: Number(body.lateFeeAmount ?? 50),
        lateFeeDays: Number(body.lateFeeDays ?? 5),
        publicIntake: true,
      },
      billing: {
        status: "trialing",
        trialEndsAt: trialEnds.toISOString(),
      },
      payouts: {
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    try {
      await db.collection(Collections.ORGANIZATIONS).doc(candidate).create(org);
    } catch (err: any) {
      // 6 = ALREADY_EXISTS. Someone took the id between the query and the write.
      if (err?.code === 6) continue;
      console.error("[org/create] Failed to create organization:", err?.message);
      return jsonError("Could not create the organization", 500);
    }

    // The founder owns what they just created. Written after the org so a
    // failure here leaves an unclaimed org rather than a member of nothing.
    await db.collection(Collections.USERS).doc(caller.uid).set(
      {
        id: caller.uid,
        email: caller.email,
        displayName: caller.displayName,
        role: "owner",
        orgId: candidate,
        updatedAt: now.toISOString(),
      },
      { merge: true }
    );

    console.log(`[org/create] ${caller.email} founded ${candidate}`);
    return NextResponse.json({ org }, { status: 201 });
  }

  return jsonError(
    "That web address is taken — please choose a different one",
    409
  );
}
