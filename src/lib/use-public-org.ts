"use client";

import { useEffect, useState } from "react";

/**
 * Loads an organization's public profile for the unauthenticated intake pages.
 *
 * Goes through /api/public/org/{slug} rather than Firestore because the
 * portfolio is staff-only by rule — a visitor has no credentials and should not
 * be handed the whole collection even if they did.
 */

export interface PublicOrgData {
  org: { id: string; name: string; slug: string; logo?: string };
  properties: {
    id: string;
    name: string;
    address: { street: string; city: string; state: string; zip: string };
  }[];
  units: {
    id: string;
    propertyId: string;
    unitNumber: string;
    beds: number;
    baths: number;
    rent: number;
    status: string;
    availableDate?: string;
  }[];
}

export function usePublicOrg(slug: string | undefined) {
  const [data, setData] = useState<PublicOrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/public/org/${encodeURIComponent(slug)}`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error || "This page is not available.");
          setData(null);
        } else {
          setData(body as PublicOrgData);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Could not reach the server.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { data, loading, error };
}
