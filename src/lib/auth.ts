import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
        // once rather than on every sign-in.
        if (!profile.tenantId && !profile.vendorId) {
          const linked = await claimTenancy(user);
          if (linked) profile = await getOrCreateUserProfile(user);
        }

        callback(profile);
      } catch {
        // Fallback profile from Firebase Auth only
        callback({
          id: user.uid,
          email: user.email || "",
          displayName: user.displayName || "User",
          photoURL: user.photoURL || undefined,
          role: "manager",
          orgId: `org-${user.uid.slice(0, 8)}`,
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      callback(null);
    }
  });
}
