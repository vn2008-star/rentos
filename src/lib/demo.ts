import type { UserProfile } from "./types";

// ============================================
// Demo Mode
// ============================================
// When no Firebase project is configured (no NEXT_PUBLIC_FIREBASE_* env vars),
// real auth is impossible and every guarded route would bounce to /login.
// Demo mode swaps in a local session so the mock-data-driven UI is explorable.
// It is inert as soon as real credentials exist.

const DEMO_SESSION_KEY = "rentos.demo-session";

/** True when real Firebase credentials are present. */
export function isFirebaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
}

/** Demo mode is only available as a fallback — never when Firebase is live. */
export function isDemoAvailable(): boolean {
  return !isFirebaseConfigured();
}

export type DemoPersona = "manager" | "tenant" | "owner" | "contractor";

// orgId matches mock-data.ts so the seeded portfolio shows up.
const DEMO_USERS: Record<DemoPersona, UserProfile> = {
  manager: {
    id: "demo-manager",
    email: "manager@rentos.demo",
    displayName: "Demo Manager",
    role: "manager",
    orgId: "org-1",
    createdAt: "2024-01-01T00:00:00Z",
  },
  owner: {
    id: "demo-owner",
    email: "owner@rentos.demo",
    displayName: "Demo Owner",
    role: "owner",
    orgId: "org-1",
    createdAt: "2024-01-01T00:00:00Z",
  },
  tenant: {
    id: "demo-tenant",
    email: "sarah.chen@ucdavis.edu",
    displayName: "Sarah Chen",
    role: "tenant",
    orgId: "org-1",
    createdAt: "2024-08-15T00:00:00Z",
  },
  // Matches mockVendors[0], who is assigned work order wo-1.
  contractor: {
    id: "demo-contractor",
    email: "mike@davisplumbing.com",
    displayName: "Mike Rodriguez",
    role: "contractor",
    orgId: "org-1",
    vendorId: "vendor-1",
    createdAt: "2024-01-01T00:00:00Z",
  },
};

export function getDemoUser(persona: DemoPersona): UserProfile {
  return { ...DEMO_USERS[persona], lastLoginAt: new Date().toISOString() };
}

export function saveDemoSession(user: UserProfile): void {
  try {
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
  } catch {
    /* storage unavailable — session just won't survive reload */
  }
}

/** Returns the persisted demo user, or null if there is no demo session. */
export function loadDemoSession(): UserProfile | null {
  if (!isDemoAvailable()) return null;
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function clearDemoSession(): void {
  try {
    localStorage.removeItem(DEMO_SESSION_KEY);
  } catch {
    /* nothing to clear */
  }
}
