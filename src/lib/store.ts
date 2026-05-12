import { create } from "zustand";
import type { UserProfile } from "./types";
import { onAuthChange, logout as firebaseLogout } from "./auth";

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  initialized: boolean;
  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  initialize: () => () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  initialized: false,

  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),

  setLoading: (isLoading) => set({ isLoading }),

  logout: async () => {
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
