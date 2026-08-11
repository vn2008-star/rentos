"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { isFirebaseConfigured } from "./demo";
import { mockOrganization } from "./mock-data";
import { useAuthStore } from "./store";
import { Collections } from "./firestore";
import { authedJson } from "./api-client";
import { planFor } from "./plans";
import type { Organization } from "./types";

/**
 * The signed-in user's organization document.
 *
 * Distinct from `user.orgId`, which is only an id: a profile can name an
 * organization that does not exist yet. That is exactly the state a fresh
 * signup is in, and telling the two apart is what the onboarding gate needs —
 * hence `exists`, which is only meaningful once `loading` is false.
 */
export function useOrganization() {
  const user = useAuthStore((s) => s.user);
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Demo mode has no Firestore. Answering "no organization" here would send
    // the demo user into an onboarding flow that cannot possibly complete.
    if (!isFirebaseConfigured()) {
      setOrg(mockOrganization);
      setLoading(false);
      return;
    }

    if (!user?.orgId) {
      setOrg(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(db, Collections.ORGANIZATIONS, user.orgId),
      (snap) => {
        setOrg(snap.exists() ? ({ ...snap.data(), id: snap.id } as Organization) : null);
        setLoading(false);
        setError(null);
      },
      (err) => {
        // A denied read is not "no organization" — treat it as unknown so the
        // gate does not push an existing customer back through onboarding.
        console.error("[useOrganization] read failed:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user?.orgId]);

  const plan = useMemo(() => planFor(org?.plan), [org?.plan]);

  const saveSettings = useCallback(
    async (patch: Partial<Organization>) => {
      if (!org) throw new Error("No organization loaded");
      if (!isFirebaseConfigured()) {
        setOrg({ ...org, ...patch });
        return;
      }
      await updateDoc(doc(db, Collections.ORGANIZATIONS, org.id), {
        ...patch,
        updatedAt: new Date().toISOString(),
      });
    },
    [org]
  );

  return {
    org,
    plan,
    loading,
    error,
    /** Only meaningful once loading is false and no error occurred. */
    exists: Boolean(org),
    saveSettings,
  };
}

/** Days remaining in the trial; negative once it has run out, null if not trialing. */
export function trialDaysLeft(org: Organization | null): number | null {
  const ends = org?.billing?.trialEndsAt;
  if (!org || org.billing?.status !== "trialing" || !ends) return null;
  const ms = new Date(ends).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/**
 * Whether the org still has a working subscription.
 *
 * past_due deliberately counts as usable: locking a landlord out of their own
 * tenant records over a failed card would be punishing the wrong people. Stripe
 * retries for weeks before it gives up, and only then does status become
 * canceled.
 */
export function subscriptionActive(org: Organization | null): boolean {
  const status = org?.billing?.status ?? "trialing";
  if (status === "canceled" || status === "incomplete") return false;
  if (status === "trialing") {
    const left = trialDaysLeft(org);
    return left === null || left > 0;
  }
  return true;
}

export async function createOrganization(input: {
  name: string;
  slug?: string;
  timezone?: string;
  currency?: string;
}): Promise<Organization> {
  const { org } = await authedJson<{ org: Organization }>("/api/org/create", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return org;
}
