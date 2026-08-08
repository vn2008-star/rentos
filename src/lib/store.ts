import { create } from "zustand";
import type { UserProfile } from "./types";
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

  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),

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
    set({ user: null, isAuthenticated: false });
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
