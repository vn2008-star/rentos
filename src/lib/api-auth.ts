import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "./firebase-admin";
import { Collections } from "./firestore";
import { isOwnerOrManagerRole, isStaffRole } from "./roles";
import type { UserProfile } from "./types";

/**
 * Identifying the caller of an API route.
 *
 * Every route that acts on an organization's data has to answer "who is asking,
 * and what are they allowed to touch?" — and it must answer it from a verified
 * Firebase ID token, never from the request body. A route that reads orgId or
 * tenantId out of JSON the browser sent is trusting the browser to tell the
 * truth about which organization's money it is moving.
 */

export interface Caller {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  /** Null when the account has signed in but has no profile document yet. */
  profile: (UserProfile & { orgId: string }) | null;
}

export { isOwnerOrManagerRole, isStaffRole };

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Verifies the bearer token and loads the caller's profile.
 *
 * Returns null when there is no usable token — the caller decides whether that
 * is a 401 or an anonymous-but-allowed path.
 */
export async function authenticate(req: NextRequest): Promise<Caller | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return null;

  let decoded;
  try {
    const auth = await getAdminAuth();
    decoded = await auth.verifyIdToken(token);
  } catch (err: any) {
    console.warn("[api-auth] Token verification failed:", err?.message);
    return null;
  }

  const db = await getAdminDb();
  const snap = await db.collection(Collections.USERS).doc(decoded.uid).get();
  const data = snap.exists ? (snap.data() as Record<string, unknown>) : null;

  return {
    uid: decoded.uid,
    email: (decoded.email ?? "").trim().toLowerCase(),
    emailVerified: Boolean(decoded.email_verified),
    displayName: (decoded.name as string) ?? (data?.displayName as string) ?? "User",
    profile: data
      ? ({
          ...data,
          id: decoded.uid,
          orgId: (data.orgId as string) ?? "",
        } as UserProfile & { orgId: string })
      : null,
  };
}

/** A caller known to have a profile, so orgId and role are safe to read. */
export interface ProfiledCaller extends Caller {
  profile: UserProfile & { orgId: string };
}

export type Guard =
  | { ok: true; caller: ProfiledCaller }
  | { ok: false; response: NextResponse };

/** Caller must be signed in and carry a profile. */
export async function requireCaller(req: NextRequest): Promise<Guard> {
  const caller = await authenticate(req);
  if (!caller) return { ok: false, response: jsonError("Not signed in", 401) };
  if (!caller.profile) {
    return { ok: false, response: jsonError("Account has no profile yet", 403) };
  }
  return { ok: true, caller: { ...caller, profile: caller.profile } };
}

/** Caller must be staff of an organization. */
export async function requireStaff(req: NextRequest): Promise<Guard> {
  const guard = await requireCaller(req);
  if (!guard.ok) return guard;
  if (!isStaffRole(guard.caller.profile.role)) {
    return { ok: false, response: jsonError("Staff access required", 403) };
  }
  return guard;
}

/** Caller must be an owner or manager — the roles that may spend money or add people. */
export async function requireOwnerOrManager(req: NextRequest): Promise<Guard> {
  const guard = await requireCaller(req);
  if (!guard.ok) return guard;
  if (!isOwnerOrManagerRole(guard.caller.profile.role)) {
    return { ok: false, response: jsonError("Owner or manager access required", 403) };
  }
  return guard;
}

/** Caller must be a RentOS operator, not a customer. */
export async function requireSuperAdmin(req: NextRequest): Promise<Guard> {
  const guard = await requireCaller(req);
  if (!guard.ok) return guard;
  if (guard.caller.profile.role !== "super_admin") {
    return { ok: false, response: jsonError("Not found", 404) };
  }
  return guard;
}
