import { create } from "zustand";
import type { SupportSession, UserProfile } from "./types";
import { onAuthChange, logout as firebaseLogout } from "./auth";
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
  setSupportSession: (session: SupportSession | null) => void;
  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  loginAsDemo: (persona: DemoPersona) => UserProfile;
  logout: () => Promise<void>;
  initialize: () => () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  initialized: false,
  isDemo: false,
  supportSession: null,
  homeOrgId: null,

  setUser: (user) =>
    set((state) => ({
      // A profile arriving from Firebase carries the operator's own orgId. If a
      // support session is open, keep pointing the app at the customer instead —
      // otherwise a token refresh would silently drop them back into their own
      // organization mid-investigation.
      user:
        user && state.supportSession
          ? { ...user, orgId: state.supportSession.orgId }
          : user,
      homeOrgId: user ? user.orgId : null,
      isAuthenticated: !!user,
      isLoading: false,
    })),

  setSupportSession: (session) =>
    set((state) => {
      const home = state.homeOrgId ?? state.user?.orgId ?? null;
      return {
        supportSession: session,
        user: state.user
          ? {
              ...state.user,
              orgId: session ? session.orgId : home ?? state.user.orgId,
            }
          : state.user,
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
    if (get().isDemo) {
      clearDemoSession();
      set({ user: null, isAuthenticated: false, isDemo: false });
      return;
    }
    try {
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

    const unsubscribe = onAuthChange((profile) => {
      set({
        user: profile,
        isAuthenticated: !!profile,
        isLoading: false,
      });
    });

    return unsubscribe;
  },
}));
