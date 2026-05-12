import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
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
// Auth State Observer
// ============================================

export function onAuthChange(callback: (profile: UserProfile | null) => void) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const profile = await getOrCreateUserProfile(user);
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
