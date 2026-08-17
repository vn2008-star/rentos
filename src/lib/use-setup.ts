"use client";

import { useMemo } from "react";
import { useProperties, useUnits, useTenants, useLeases } from "./hooks";
import { useOrganization } from "./use-org";
import { buildSetupSteps, setupProgress, type SetupStep } from "./getting-started";

/**
 * How far the signed-in organization has got with setting itself up.
 *
 * Derived from the records it already holds — see getting-started.ts for why
 * that beats a stored checklist. Everything here is a subscription the app has
 * open anyway on most screens, so this costs nothing extra to ask.
 */
export function useSetupProgress(): {
  steps: SetupStep[];
  done: number;
  total: number;
  percent: number;
  complete: boolean;
  next: SetupStep | null;
  loading: boolean;
} {
  const { properties, loading: propsLoading } = useProperties();
  const { units, loading: unitsLoading } = useUnits();
  const { tenants, loading: tenantsLoading } = useTenants();
  const { leases, loading: leasesLoading } = useLeases();
  const { org, loading: orgLoading } = useOrganization();

  const steps = useMemo(
    () => buildSetupSteps({ properties, units, tenants, leases, org }),
    [properties, units, tenants, leases, org]
  );

  return {
    steps,
    ...setupProgress(steps),
    // Reporting "0 of 6 done" while the reads are still in flight would tell a
    // fully set-up org it has done nothing.
    loading: propsLoading || unitsLoading || tenantsLoading || leasesLoading || orgLoading,
  };
}
