import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { UserProfile, UserRole } from "./types";

const googleProvider = new GoogleAuthProvider();

// ============================================
// Auth Operations
// ============================================

export async function loginWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getOrCreateUserProfile(cred.user);
  return profile;
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
  role: UserRole = "manager"
) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });

  // Automatic linking to an existing tenancy only happens once the address is
  // verified — otherwise anyone who knew a tenant's email could register with
  // it and read that tenant's lease and payments. Google sign-in arrives
  // verified; email/password needs this.
  sendEmailVerification(cred.user).catch((err) => {
    console.warn("Could not send the verification email", err);
  });

  const profile = await createUserProfile(cred.user, displayName, role);
  return profile;
}

export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  const profile = await getOrCreateUserProfile(cred.user);
  return profile;
}

/**
 * Asks the server to grant this anonymous session read access to the demo
 * organization. Idempotent — it rewrites the same profile every time — so it is
 * safe for both callers below to attempt it.
 */
async function grantDemoAccess(user: User): Promise<boolean> {
  try {
    const res = await fetch("/api/demo/session", {
      method: "POST",
      headers: { Authorization: `Bearer ${await user.getIdToken()}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.warn("[demo] access not granted:", data.error);
    }
    return res.ok;
  } catch (err) {
    console.warn("[demo] could not reach the server", err);
    return false;
  }
}

/**
 * Signs in as a read-only demo visitor.
 *
 * An anonymous session first, then the server grants it guest access to the
 * demo organization — no password ships in the browser bundle, and no shared
 * account exists for anyone to find. The identity is throwaway: Firebase
 * expires unused anonymous accounts on its own.
 */
export async function loginAsDemoVisitor(): Promise<UserProfile> {
  const cred = await signInAnonymously(auth);
  const profile = await getOrCreateUserProfile(cred.user);

  if (!profile.orgId) {
    // Leaving a half-made anonymous session signed in would strand the visitor
    // in an app that can read nothing.
    await signOut(auth).catch(() => {});
    throw new Error("The demo could not be started. Please try again.");
  }

  return profile;
}

export async function logout() {
  await signOut(auth);
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

// ============================================
// Profile Management
// ============================================

async function createUserProfile(
  user: User,
  displayName: string,
  role: UserRole
): Promise<UserProfile> {
  const profile: UserProfile = {
    id: user.uid,
    email: user.email || "",
    displayName,
    photoURL: user.photoURL || undefined,
    role,
    orgId: `org-${user.uid.slice(0, 8)}`,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, "users", user.uid), {
      ...profile,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Firestore write failed (offline mode), using local profile", err);
  }

  return profile;
}

async function getOrCreateUserProfile(user: User): Promise<UserProfile> {
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();
      // Update last login
      setDoc(doc(db, "users", user.uid), { lastLoginAt: serverTimestamp() }, { merge: true }).catch(() => {});
      return {
        id: user.uid,
        email: data.email || user.email || "",
        displayName: data.displayName || user.displayName || "User",
        photoURL: data.photoURL || user.photoURL || undefined,
        role: data.role || "manager",
        orgId: data.orgId || `org-${user.uid.slice(0, 8)}`,
        phone: data.phone,
        // Both link the login to a domain record and drive security rules —
        // dropping them here left contractors and tenants unable to reach their
        // own work orders and leases.
        vendorId: data.vendorId,
        tenantId: data.tenantId,
        createdAt: data.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn("Firestore read failed, creating local profile", err);
  }

  // An anonymous session is a demo visitor, and its profile is the server's to
  // write: the rules refuse a client that tries to set its own orgId or role,
  // which is what stops a signup walking into someone else's portfolio.
  //
  // Asking for it here rather than only at the click means both paths into this
  // function — the explicit one, and the auth-state listener that fires the
  // moment sign-in completes — end at the same profile. When only the click did
  // it, whichever finished last won, and a listener that lost the race left the
  // visitor with an empty orgId: signed in, on the dashboard, every query
  // scoped to no organization at all.
  if (user.isAnonymous) {
    const granted = await grantDemoAccess(user);
    if (granted) {
      const snap = await getDoc(doc(db, "users", user.uid)).catch(() => null);
      if (snap?.exists()) {
        const data = snap.data();
        return {
          id: user.uid,
          email: "",
          displayName: data.displayName || "Demo Visitor",
          role: data.role || "guest",
          orgId: data.orgId || "",
          createdAt: new Date().toISOString(),
        };
      }
    }
    // Still read-only, just with nothing to read. The UI says so rather than
    // pretending the demo organization is empty.
    return {
      id: user.uid,
      email: "",
      displayName: "Demo Visitor",
      role: "guest",
      orgId: "",
      createdAt: new Date().toISOString(),
    };
  }

  // Profile doesn't exist, create it
  return createUserProfile(user, user.displayName || "User", "manager");
}

// ============================================
// Tenancy Claim
// ============================================

/**
 * Asks the server whether this account matches a Tenant record by email, and
 * links them if so.
 *
 * The write itself has to happen server-side: orgId, role and tenantId drive
 * every security rule, so the rules forbid a client from setting them on its
 * own profile. See src/app/api/auth/claim-tenancy/route.ts.
 *
 * Returns true when a link was made, so the caller can re-read the profile.
 */
async function claimTenancy(user: User): Promise<boolean> {
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/auth/claim-tenancy", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.linked === true;
  } catch {
    // Never block sign-in on this — an unlinked account still works, it just
    // shows an empty portal until the link is made.
    return false;
  }
}

// ============================================
// Auth State Observer
// ============================================

export function onAuthChange(callback: (profile: UserProfile | null) => void) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        let profile = await getOrCreateUserProfile(user);

        // A tenant a manager entered by hand can just sign up: if their address
        // matches a Tenant record, the server links the two. Only attempted
        // when the profile is not already linked, so this costs one request
        // once rather than on every sign-in. The demo visitor is skipped —
        // it is not a person, and it has no tenancy to claim.
        if (!profile.tenantId && !profile.vendorId && profile.role !== "guest") {
          const linked = await claimTenancy(user);
          if (linked) profile = await getOrCreateUserProfile(user);
        }

        callback(profile);
      } catch {
        // Fallback profile from Firebase Auth only. An anonymous session gets
        // the read-only role rather than "manager": the fallback runs when
        // Firestore could not be reached, and guessing upwards there would give
        // a demo visitor a manager's UI over a portfolio they cannot write to.
        callback({
          id: user.uid,
          email: user.email || "",
          displayName: user.isAnonymous ? "Demo Visitor" : user.displayName || "User",
          photoURL: user.photoURL || undefined,
          role: user.isAnonymous ? "guest" : "manager",
          orgId: user.isAnonymous ? "" : `org-${user.uid.slice(0, 8)}`,
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      callback(null);
    }
  });
}
