import { create } from "zustand";
import type { SupportSession, UserProfile, UserRole } from "./types";
import {
  clearDemoSession, getDemoUser, isDemoAvailable,
  loadDemoSession, saveDemoSession, type DemoPersona,
} from "./demo";

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  initialized: boolean;
  isDemo: boolean;
  /**
   * The customer organization a RentOS operator is currently helping, if any.
   *
   * While one is open, `user.orgId` reports that organization rather than the
   * operator's own — which is what makes every screen, hook and query in the
   * app show the customer's data without any of them needing to know that
   * support access exists. `homeOrgId` remembers where to put them back.
   *
   * This is presentation only. What an operator may actually read or write is
   * decided by firestore.rules against the support_sessions document, so a
   * tampered-with store buys nothing.
   */
  supportSession: SupportSession | null;
  homeOrgId: string | null;
  /** The operator's real role, kept so impersonation can be undone exactly. */
  homeRole: UserRole | null;
  setSupportSession: (session: SupportSession | null) => void;
  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  loginAsDemo: (persona: DemoPersona) => UserProfile;
  logout: () => Promise<void>;
  initialize: () => () => void;
}

/**
 * Points a profile at whatever the support session says to look at.
 *
 * With no session, the operator's own profile passes through untouched. With
 * one, the org is swapped — and if a person is being looked through, so are the
 * role and the tenantId/vendorId, which is what makes the app render the tenant
 * or contractor portal rather than the staff dashboard.
 *
 * Presentation only. What may actually be read is decided by firestore.rules
 * against the session document, so faking this in devtools shows an empty
 * portal, not somebody's lease.
 */
function applySupportSession(
  user: UserProfile | null,
  session: SupportSession | null
): UserProfile | null {
  if (!user || !session) return user;

  const scoped: UserProfile = { ...user, orgId: session.orgId };
  if (session.viewAsRole === "tenant") {
    return {
      ...scoped,
      role: "tenant",
      tenantId: session.viewAsSubjectId,
      vendorId: undefined,
    };
  }
  if (session.viewAsRole === "contractor") {
    return {
      ...scoped,
      role: "contractor",
      vendorId: session.viewAsSubjectId,
      tenantId: undefined,
    };
  }
  return scoped;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  initialized: false,
  isDemo: false,
  supportSession: null,
  homeOrgId: null,
  homeRole: null,

  setUser: (user) =>
    set((state) => ({
      // A profile arriving from Firebase carries the operator's own identity. If
      // a support session is open, keep pointing the app at the customer —
      // otherwise a token refresh would silently drop them back into their own
      // organization mid-investigation.
      user: applySupportSession(user, state.supportSession),
      homeOrgId: user ? user.orgId : null,
      homeRole: user ? user.role : null,
      isAuthenticated: !!user,
      isLoading: false,
    })),

  setSupportSession: (session) =>
    set((state) => {
      const home = state.homeOrgId ?? state.user?.orgId ?? null;
      // Rebuild from the operator's real identity rather than layering one
      // override on top of another: switching from viewing as a tenant back to
      // the staff view has to actually drop the tenantId, not keep it.
      const base = state.user
        ? { ...state.user, orgId: home ?? state.user.orgId, role: state.homeRole ?? state.user.role }
        : null;
      return {
        supportSession: session,
        user: applySupportSession(base, session),
      };
    }),

  setLoading: (isLoading) => set({ isLoading }),

  loginAsDemo: (persona) => {
    const user = getDemoUser(persona);
    saveDemoSession(user);
    set({ user, isAuthenticated: true, isLoading: false, isDemo: true });
    return user;
  },

  logout: async () => {
    // Shared Firestore listeners outlive the component that opened them by
    // design, so signing out has to say so explicitly — otherwise the next
    // person to sign in on this device is briefly shown the previous account's
    // documents out of the cache. Dynamically imported for the same reason the
    // auth listener is: neither belongs in the bundle of a page that has not
    // signed anybody in yet.
    import("./firestore-subscriptions")
      .then(({ clearCollectionCache }) => clearCollectionCache())
      .catch(() => { /* nothing cached to clear */ });

    if (get().isDemo) {
      clearDemoSession();
      set({ user: null, isAuthenticated: false, isDemo: false });
      return;
    }
    try {
      const { logout: firebaseLogout } = await import("./auth");
      await firebaseLogout();
    } catch (err) {
      console.error("Logout error:", err);
    }
    // Local state only. The grant itself lives in Firestore and expires on its
    // own; signing out does not silently leave one open in the UI either.
    set({
      user: null,
      isAuthenticated: false,
      supportSession: null,
      homeOrgId: null,
      homeRole: null,
    });
  },

  initialize: () => {
    if (get().initialized) return () => {};
    set({ initialized: true, isLoading: true });

    // A persisted demo session stands in for Firebase auth, which cannot
    // succeed without credentials. Skip the listener so it can't null us out.
    if (isDemoAvailable()) {
      const demoUser = loadDemoSession();
      if (demoUser) {
        set({ user: demoUser, isAuthenticated: true, isLoading: false, isDemo: true });
        return () => {};
      }
    }

    // Imported here rather than at the top of the file so the Firebase SDK is
    // not in the critical path of every page that merely reads `user` from this
    // store. Statically, ./auth pulls in firebase/auth and — through
    // ./firebase — firestore and storage as well: about half a megabyte of
    // JavaScript that the marketing page, the login form and the public
    // listing pages had to download and parse before they could show anything.
    // Now it is fetched alongside the first render instead of ahead of it.
    //
    // Through setUser, not a bare set: the listener fires on every token
    // refresh, and writing the raw profile would quietly drop an operator out of
    // a support session an hour into it.
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    import("./auth").then(({ onAuthChange }) => {
      if (cancelled) return;
      unsubscribe = onAuthChange((profile) => {
        get().setUser(profile);
      });
    }).catch((err) => {
      // Nothing can sign in, but the app must not sit on a spinner forever
      // because a chunk failed to load.
      console.error("Could not start the auth listener", err);
      set({ isLoading: false });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  },
}));
