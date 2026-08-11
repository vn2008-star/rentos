"use client";

import { useEffect, useRef } from "react";
import { create } from "zustand";

/**
 * The Quick Add button in the top bar.
 *
 * It has to open a form that lives on another page — "add a tenant" is the
 * dialog on /tenants — so the click and the dialog are in different components.
 * A one-shot intent in a store carries the request across the navigation.
 *
 * The obvious alternative, a ?new=1 query parameter, misbehaves when you are
 * already on the target page: the URL changes, the component never remounts,
 * and nothing opens. Reading it with useSearchParams would also force every
 * one of these pages out of static rendering.
 *
 * The intent is consumed on arrival, so a refresh does not reopen the dialog.
 */

export type QuickAddTarget =
  | "property"
  | "unit"
  | "tenant"
  | "lease"
  | "maintenance"
  | "event"
  | "vendor";

interface QuickAddState {
  pending: QuickAddTarget | null;
  request: (target: QuickAddTarget) => void;
  /** Claims the intent if it is for `target`. Returns whether it was claimed. */
  consume: (target: QuickAddTarget) => boolean;
}

export const useQuickAddStore = create<QuickAddState>((set, get) => ({
  pending: null,
  request: (target) => set({ pending: target }),
  consume: (target) => {
    if (get().pending !== target) return false;
    set({ pending: null });
    return true;
  },
}));

/**
 * Opens this page's add dialog when Quick Add asked for it.
 *
 * Pass the same `open` you would call from an "Add" button — usually
 * `() => setShowAdd(true)`.
 */
export function useQuickAdd(target: QuickAddTarget, open: () => void): void {
  const pending = useQuickAddStore((s) => s.pending);

  // Callers pass an inline closure, which changes identity on every render.
  // Held in a ref so the effect below depends only on the intent itself.
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (pending !== target) return;
    if (useQuickAddStore.getState().consume(target)) openRef.current();
  }, [pending, target]);
}
