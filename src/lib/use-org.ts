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
import { errorMessage } from "@/lib/errors";

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

  // Demo mode has no Firestore. Answering "no organization" would send the demo
  // user into an onboarding flow that cannot possibly complete, so demo mode
  // gets the mock org and never subscribes to anything.
  const demo = !isFirebaseConfigured();
  const orgId = user?.orgId;
  const [demoOrg, setDemoOrg] = useState<Organization>(mockOrganization);

  // Stamped with the orgId it came from. Whether the snapshot in hand belongs to
  // the org currently being asked about is then a render-time comparison rather
  // than something an effect has to reset — which is what let every branch below
  // stop calling setState synchronously.
  const [remote, setRemote] = useState<{
    orgId: string | null;
    org: Organization | null;
    error: string | null;
  }>({ orgId: null, org: null, error: null });

  useEffect(() => {
    // Nothing to subscribe to: demo mode has no backend, and a profile with no
    // orgId names no document. Both are settled during render below.
    if (demo || !orgId) return;

    const unsubscribe = onSnapshot(
      doc(db, Collections.ORGANIZATIONS, orgId),
      (snap) => {
        setRemote({
          orgId,
          org: snap.exists() ? ({ ...snap.data(), id: snap.id } as Organization) : null,
          error: null,
        });
      },
      (err) => {
        // A denied read is not "no organization" — treat it as unknown so the
        // gate does not push an existing customer back through onboarding.
        console.error("[useOrganization] read failed:", err);
        setRemote({ orgId, org: null, error: errorMessage(err) });
      }
    );

    return unsubscribe;
  }, [orgId, demo]);

  // A snapshot for a different orgId is not an answer about this one — it is the
  // previous org's document, and showing it would be worse than waiting.
  const settled = remote.orgId === orgId;
  const org = demo ? demoOrg : settled ? remote.org : null;
  const loading = demo || !orgId ? false : !settled;
  const error = demo || !settled ? null : remote.error;

  const plan = useMemo(() => planFor(org?.plan), [org?.plan]);

  const saveSettings = useCallback(
    async (patch: Partial<Organization>) => {
      if (!org) throw new Error("No organization loaded");
      if (demo) {
        setDemoOrg({ ...org, ...patch });
        return;
      }
      await updateDoc(doc(db, Collections.ORGANIZATIONS, org.id), {
        ...patch,
        updatedAt: new Date().toISOString(),
      });
    },
    [org, demo]
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
