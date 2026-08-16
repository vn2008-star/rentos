"use client";

import {
  useState, useEffect, useCallback, useMemo,
  type Dispatch, type SetStateAction,
} from "react";
import { where, type WhereFilterOp } from "firebase/firestore";
import { useAuthStore } from "./store";
import {
  createDocument, queryDocuments, updateDocument, updateDocumentFields,
  deleteDocument, uploadMultipleFiles, getDocument,
  Collections,
} from "./firestore";
import { subscribeShared, peekCollection } from "./firestore-subscriptions";
import { isFirebaseConfigured } from "./demo";
import {
  mockProperties, mockUnits, mockTenants,
  mockMaintenanceRequests, mockApplications,
  mockLeases, mockTransactions, mockListings, mockSublets,
  mockVendors, mockWorkOrders, mockNotifications,
  mockInspections, mockKeys, mockLockChanges, mockUnitNotes, mockCalendarEvents,
} from "./mock-data";
import { buildReminders } from "./reminders";
import { useOrganization } from "./use-org";
import { canAddUnit } from "./plans";
import {
  resolveCollection, applyCollectionWrite, type CollectionState,
} from "./collection-state";
import { errorMessage } from "@/lib/errors";
import type {
  Property, Unit, Tenant, MaintenanceRequest, RentalApplication,
  Lease, Transaction, Listing, Sublet, LeaseStatus, ApplicationStatus, ScreeningResult,
  PropertyType, UnitStatus, MaintenanceCategory, MaintenancePriority,
  Vendor, VendorStatus, WorkOrder, WorkOrderStatus, Notification,
  Inspection, InspectionType, InspectionArea, KeyRecord, KeyKind, KeyStatus,
  LockChange, UnitNote, NoteKind, CalendarEvent, CalendarEventType, Reminder,
} from "./types";

// ============================================
// Shared hook pattern: try Firestore, fallback to mock
// ============================================

/**
 * Rethrows a failed write once Firebase is live.
 *
 * In demo mode there is no backend, so falling back to local state is the whole
 * point. Once credentials exist a rejected write is a real failure — rules,
 * network, quota — and swallowing it makes the UI report success and hand back
 * a fabricated id while nothing was saved.
 */
function rethrowIfLive(err: unknown): void {
  if (isFirebaseConfigured()) throw err;
}

/**
 * Narrows a collection query to the signed-in tenant's own documents.
 *
 * Staff get no filter — they may read the whole org. Tenants must be filtered
 * at the query level, not after the fact: security rules reject any query that
 * could match a document the caller cannot read, so an unfiltered
 * `where orgId == …` fails outright for a tenant rather than returning a
 * subset.
 *
 * A tenant whose profile has no tenantId yet gets a filter that matches
 * nothing, which is the safe direction to fail.
 */
function useTenantFilter(field: string, op: WhereFilterOp = "=="): Filter[] {
  const user = useAuthStore((s) => s.user);
  return useMemo(() => {
    if (user?.role !== "tenant") return [];
    return [{ field, op, value: user.tenantId || "__unlinked__" }];
  }, [user?.role, user?.tenantId, field, op]);
}

/**
 * A serialisable query filter.
 *
 * Passed as plain data rather than Firestore QueryConstraint objects so the
 * effect below can depend on its value instead of an identity that changes
 * every render.
 */
export type Filter = { field: string; op: WhereFilterOp; value: unknown };

function useFirestoreCollection<T>(
  collectionName: string,
  mockData: T[],
  enabled = true,
  filters: Filter[] = []
) {
  const user = useAuthStore((s) => s.user);
  const orgId = user?.orgId;

  // Security rules reject a query that could return documents the caller may
  // not read, so tenant-facing screens must narrow the query rather than filter
  // afterwards. Serialised so it can be a stable effect dependency.
  const filterKey = JSON.stringify(filters);

  // Without credentials the subscription can only fail, so don't wait on one.
  const live = isFirebaseConfigured();
  const canSubscribe = Boolean(orgId) && enabled && live;

  // Identifies the query being asked about right now. When it changes, whatever
  // documents are in hand answer the *previous* question — which is what makes
  // the reset below a render-time comparison rather than something an effect has
  // to perform on its way out.
  const queryKey = canSubscribe ? `${orgId}|${collectionName}|${filterKey}` : null;

  // What to show when no snapshot answers the current query. Mock data is the
  // demo affordance and nothing more: when Firebase is live but this collection
  // is switched off for the current role, the honest answer is "nothing", not a
  // fabricated portfolio. Memoised so `setData` below keeps a stable identity.
  const fallbackDocs = useMemo<T[]>(() => (live ? [] : mockData), [live, mockData]);

  const [state, setState] = useState<CollectionState<T>>(() => ({
    key: null,
    docs: live ? [] : mockData,
    status: "waiting",
    error: null,
  }));

  useEffect(() => {
    if (!canSubscribe || !orgId || !queryKey) return;

    const constraints = (JSON.parse(filterKey) as Filter[]).map((f) =>
      where(f.field, f.op, f.value)
    );

    // Through the shared registry rather than straight to onSnapshot: the hooks
    // compose, so the same query is routinely asked for by several components on
    // one screen, and every screen used to re-read its collections from scratch
    // on every navigation. See src/lib/firestore-subscriptions.ts.
    const unsubscribe = subscribeShared<T>(
      queryKey,
      { collectionName, orgId, constraints },
      {
        // Once Firebase is configured, Firestore is the truth — including when
        // it returns nothing. Substituting mock data for an empty result would
        // make a genuinely empty org, or a query that silently stopped matching,
        // look like a populated portfolio.
        onData: (docs) => setState({ key: queryKey, docs, status: "live", error: null }),
        // A failed read is not an empty org. Surface it rather than showing
        // fabricated numbers a manager might act on.
        onError: (err) =>
          setState({ key: queryKey, docs: [], status: "error", error: errorMessage(err) }),
      }
    );

    // A subscription that never answers must not leave the screen loading
    // forever. Fires from a timer rather than the effect body, so it costs a
    // render only in the case it exists to handle.
    const timeout = setTimeout(() => {
      setState((prev) =>
        prev.key === queryKey && prev.status !== "waiting"
          ? prev
          : { key: queryKey, docs: prev.key === queryKey ? prev.docs : [], status: "timeout", error: null }
      );
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [canSubscribe, orgId, queryKey, collectionName, filterKey]);

  // Documents a listener elsewhere has already fetched for this exact query.
  // Read during render so arriving on a screen that asks something already being
  // watched shows the data immediately instead of a skeleton and a second copy
  // of the same read.
  const cachedDocs = queryKey && state.key !== queryKey ? peekCollection<T>(queryKey) : null;

  // `setData` stays part of this hook's contract — every list hook below hands
  // it to callers for optimistic add/edit/remove — so writes go to real state
  // rather than being derived away. A write also claims the current query, so an
  // optimistically added row is not discarded as an answer to a stale one.
  const setData = useCallback<Dispatch<SetStateAction<T[]>>>(
    (update) => {
      setState((prev) =>
        applyCollectionWrite(prev, queryKey, cachedDocs ?? fallbackDocs, update)
      );
    },
    [queryKey, fallbackDocs, cachedDocs]
  );

  const { data, loading, isLive, error } = resolveCollection({
    canSubscribe,
    queryKey,
    fallbackDocs,
    cachedDocs,
    state,
  });

  return { data, setData, loading, error, isLive };
}

// ============================================
// Properties Hook
// ============================================

export function useProperties() {
  const user = useAuthStore((s) => s.user);
  const { data: properties, setData: setProperties, loading, isLive, error } =
    useFirestoreCollection<Property>(Collections.PROPERTIES, mockProperties);

  const addProperty = useCallback(async (input: {
    name: string; type: PropertyType; street: string; city: string;
    state: string; zip: string; description?: string; amenities: string[];
    photos?: File[];
  }) => {
    const orgId = user?.orgId || "org-1";

    let photoUrls: string[] = [];
    if (input.photos?.length) {
      try {
        photoUrls = await uploadMultipleFiles(`${orgId}/properties`, input.photos);
      } catch { /* Storage unavailable */ }
    }

    const property: Omit<Property, "id" | "createdAt" | "updatedAt"> = {
      orgId,
      name: input.name,
      type: input.type,
      address: { street: input.street, city: input.city, state: input.state, zip: input.zip },
      photos: photoUrls,
      amenities: input.amenities,
      description: input.description,
      totalUnits: 0,
      occupiedUnits: 0,
    };

    try {
      const id = await createDocument(Collections.PROPERTIES, property);
      if (!isLive) {
        setProperties(prev => [...prev, { ...property, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Property]);
      }
      return id;
    } catch (err) {
      rethrowIfLive(err);
      const id = `prop-${Date.now()}`;
      setProperties(prev => [...prev, { ...property, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Property]);
      return id;
    }
  }, [user?.orgId, isLive, setProperties]);

  const editProperty = useCallback(async (id: string, updates: Partial<Property>) => {
    try {
      await updateDocument(Collections.PROPERTIES, id, updates);
    } catch { /* offline */ }
    if (!isLive) {
      setProperties(prev => prev.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p));
    }
  }, [isLive, setProperties]);

  const removeProperty = useCallback(async (id: string) => {
    try {
      await deleteDocument(Collections.PROPERTIES, id);
    } catch { /* offline */ }
    setProperties(prev => prev.filter(p => p.id !== id));
  }, [setProperties]);

  return { properties, loading, isLive, error, addProperty, editProperty, removeProperty };
}

// ============================================
// Units Hook
// ============================================

export function useUnits() {
  const user = useAuthStore((s) => s.user);
  const { org, plan } = useOrganization();
  const { data: units, setData: setUnits, loading, isLive } =
    useFirestoreCollection<Unit>(Collections.UNITS, mockUnits);

  const unitLimit = plan.unitLimit;
  const atLimit = unitLimit !== null && units.length >= unitLimit;

  const addUnit = useCallback(async (input: {
    propertyId: string; unitNumber: string; beds: number; baths: number;
    sqft: number; rent: number; deposit: number; status: UnitStatus;
    photos?: File[];
  }) => {
    const orgId = user?.orgId || "org-1";

    // The plan's unit limit. Security rules cannot count documents, so this is
    // where a count-based limit has to live; the rules enforce the subscription
    // being alive at all, which is the part that must not be bypassable.
    if (!canAddUnit(org?.plan, units.length)) {
      throw new Error(
        `Your ${plan.name} plan covers ${unitLimit} units. Upgrade from Billing to add more.`
      );
    }

    let photoUrls: string[] = [];
    if (input.photos?.length) {
      try {
        photoUrls = await uploadMultipleFiles(`${orgId}/units`, input.photos);
      } catch { /* Storage unavailable */ }
    }

    const unit: Omit<Unit, "id" | "createdAt" | "updatedAt"> = {
      orgId,
      propertyId: input.propertyId,
      unitNumber: input.unitNumber,
      status: input.status,
      beds: input.beds,
      baths: input.baths,
      sqft: input.sqft,
      rent: input.rent,
      deposit: input.deposit,
      photos: photoUrls,
      amenities: [],
    };

    try {
      const id = await createDocument(Collections.UNITS, unit);
      if (!isLive) {
        setUnits(prev => [...prev, { ...unit, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Unit]);
      }
      return id;
    } catch (err) {
      rethrowIfLive(err);
      const id = `unit-${Date.now()}`;
      setUnits(prev => [...prev, { ...unit, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Unit]);
      return id;
    }
  }, [user?.orgId, isLive, setUnits, org?.plan, plan.name, unitLimit, units.length]);

  const editUnit = useCallback(async (id: string, updates: Partial<Unit>) => {
    try { await updateDocument(Collections.UNITS, id, updates); } catch { /* offline */ }
    if (!isLive) {
      setUnits(prev => prev.map(u => u.id === id ? { ...u, ...updates, updatedAt: new Date().toISOString() } : u));
    }
  }, [isLive, setUnits]);

  const removeUnit = useCallback(async (id: string) => {
    try { await deleteDocument(Collections.UNITS, id); } catch { /* offline */ }
    setUnits(prev => prev.filter(u => u.id !== id));
  }, [setUnits]);

  return { units, loading, isLive, addUnit, editUnit, removeUnit, unitLimit, atLimit };
}

// ============================================
// Tenants Hook
// ============================================

export function useTenants() {
  const user = useAuthStore((s) => s.user);
  const { data: tenants, setData: setTenants, loading, isLive } =
    useFirestoreCollection<Tenant>(
      Collections.TENANTS, mockTenants,
      // Tenants cannot enumerate the roster — the rules scope them to their own
      // record by document id, which a collection query cannot express. They
      // reach their own record through useCurrentTenant() instead.
      user?.role !== "tenant"
    );

  const addTenant = useCallback(async (input: {
    firstName: string; lastName: string; email: string; phone: string;
    unitId?: string; propertyId?: string; notes?: string;
  }) => {
    const orgId = user?.orgId || "org-1";
    const tenant: Omit<Tenant, "id" | "createdAt" | "updatedAt"> = { orgId, ...input };

    try {
      const id = await createDocument(Collections.TENANTS, tenant);
      if (!isLive) {
        setTenants(prev => [...prev, { ...tenant, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Tenant]);
      }
      return id;
    } catch (err) {
      rethrowIfLive(err);
      const id = `tenant-${Date.now()}`;
      setTenants(prev => [...prev, { ...tenant, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Tenant]);
      return id;
    }
  }, [user?.orgId, isLive, setTenants]);

  const editTenant = useCallback(async (id: string, updates: Partial<Tenant>) => {
    try { await updateDocument(Collections.TENANTS, id, updates); } catch { /* offline */ }
    if (!isLive) {
      setTenants(prev => prev.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t));
    }
  }, [isLive, setTenants]);

  const removeTenant = useCallback(async (id: string) => {
    try { await deleteDocument(Collections.TENANTS, id); } catch { /* offline */ }
    setTenants(prev => prev.filter(t => t.id !== id));
  }, [setTenants]);

  return { tenants, loading, isLive, addTenant, editTenant, removeTenant };
}

// ============================================
// Maintenance Hook
// ============================================

export function useMaintenance() {
  const user = useAuthStore((s) => s.user);
  const { data: requests, setData: setRequests, loading, isLive } =
    useFirestoreCollection<MaintenanceRequest>(
      Collections.MAINTENANCE, mockMaintenanceRequests, true,
      useTenantFilter("tenantId")
    );

  const addRequest = useCallback(async (input: {
    title: string; description: string; category: MaintenanceCategory;
    priority: MaintenancePriority; unitId: string; propertyId: string;
    tenantId?: string; photos?: File[];
    reporter?: MaintenanceRequest["reporter"];
  }) => {
    const orgId = user?.orgId || "org-1";

    let photoUrls: string[] = [];
    if (input.photos?.length) {
      try {
        photoUrls = await uploadMultipleFiles(`${orgId}/maintenance`, input.photos);
      } catch { /* Storage unavailable */ }
    }

    const req: Omit<MaintenanceRequest, "id" | "createdAt" | "updatedAt"> = {
      orgId,
      unitId: input.unitId,
      propertyId: input.propertyId,
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      ...(input.reporter ? { reporter: input.reporter } : {}),
      category: input.category,
      priority: input.priority,
      status: "submitted",
      title: input.title,
      description: input.description,
      photos: photoUrls,
      completionPhotos: [],
    };

    try {
      const id = await createDocument(Collections.MAINTENANCE, req);
      if (!isLive) {
        setRequests(prev => [{ ...req, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as MaintenanceRequest, ...prev]);
      }
      return id;
    } catch (err) {
      rethrowIfLive(err);
      const id = `maint-${Date.now()}`;
      setRequests(prev => [{ ...req, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as MaintenanceRequest, ...prev]);
      return id;
    }
  }, [user?.orgId, isLive, setRequests]);

  const updateRequest = useCallback(async (id: string, updates: Partial<MaintenanceRequest>) => {
    try { await updateDocument(Collections.MAINTENANCE, id, updates); } catch { /* offline */ }
    if (!isLive) {
      setRequests(prev => prev.map(r => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r));
    }
  }, [isLive, setRequests]);

  const removeRequest = useCallback(async (id: string) => {
    try { await deleteDocument(Collections.MAINTENANCE, id); } catch { /* offline */ }
    setRequests(prev => prev.filter(r => r.id !== id));
  }, [setRequests]);

  return { requests, loading, isLive, addRequest, updateRequest, removeRequest };
}

// ============================================
// Applications Hook (Extended with CRUD + Screening)
// ============================================

export function useApplications() {
  const user = useAuthStore((s) => s.user);
  const { data: applications, setData: setApplications, loading, isLive } =
    useFirestoreCollection<RentalApplication>(Collections.APPLICATIONS, mockApplications);

  const addApplication = useCallback(async (input: {
    unitId: string; propertyId: string;
    applicant: RentalApplication["applicant"];
    references?: RentalApplication["references"];
    applicationFee?: number;
  }) => {
    const orgId = user?.orgId || "org-1";
    const app: Omit<RentalApplication, "id" | "createdAt" | "updatedAt"> = {
      orgId,
      unitId: input.unitId,
      propertyId: input.propertyId,
      status: "submitted",
      applicant: input.applicant,
      references: input.references || [],
      applicationFee: input.applicationFee || 45,
    };

    try {
      const id = await createDocument(Collections.APPLICATIONS, app);
      if (!isLive) {
        setApplications(prev => [{ ...app, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as RentalApplication, ...prev]);
      }
      return id;
    } catch (err) {
      rethrowIfLive(err);
      const id = `app-${Date.now()}`;
      setApplications(prev => [{ ...app, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as RentalApplication, ...prev]);
      return id;
    }
  }, [user?.orgId, isLive, setApplications]);

  const updateApplication = useCallback(async (id: string, updates: Partial<RentalApplication>) => {
    try { await updateDocument(Collections.APPLICATIONS, id, updates); } catch { /* offline */ }
    setApplications(prev => prev.map(a => a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a));
  }, [setApplications]);

  const removeApplication = useCallback(async (id: string) => {
    try { await deleteDocument(Collections.APPLICATIONS, id); } catch { /* offline */ }
    setApplications(prev => prev.filter(a => a.id !== id));
  }, [setApplications]);

  return { applications, loading, isLive, addApplication, updateApplication, removeApplication };
}

// ============================================
// Leases Hook
// ============================================

export function useLeases() {
  const user = useAuthStore((s) => s.user);
  const { data: leases, setData: setLeases, loading, isLive } =
    useFirestoreCollection<Lease>(
      Collections.LEASES, mockLeases, true,
      // A tenant sees only leases naming them; the rules check the same thing.
      useTenantFilter("tenantIds", "array-contains")
    );

  const addLease = useCallback(async (input: {
    unitId: string; propertyId: string; tenantIds: string[];
    startDate: string; endDate: string; rentAmount: number;
    securityDeposit: number; terms?: string; autoRenew?: boolean;
    lateFeePercent?: number; gracePeriodDays?: number;
  }) => {
    const orgId = user?.orgId || "org-1";
    const lease: Omit<Lease, "id" | "createdAt" | "updatedAt"> = {
      orgId,
      unitId: input.unitId,
      propertyId: input.propertyId,
      tenantIds: input.tenantIds,
      status: "draft",
      startDate: input.startDate,
      endDate: input.endDate,
      rentAmount: input.rentAmount,
      securityDeposit: input.securityDeposit,
      lateFeePercent: input.lateFeePercent ?? 5,
      gracePeriodDays: input.gracePeriodDays ?? 5,
      autoRenew: input.autoRenew ?? false,
      terms: input.terms,
      documents: [],
      signatures: [],
      renewalOffered: false,
    };

    try {
      const id = await createDocument(Collections.LEASES, lease);
      if (!isLive) {
        setLeases(prev => [{ ...lease, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Lease, ...prev]);
      }
      return id;
    } catch (err) {
      rethrowIfLive(err);
      const id = `lease-${Date.now()}`;
      setLeases(prev => [{ ...lease, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Lease, ...prev]);
      return id;
    }
  }, [user?.orgId, isLive, setLeases]);

  const updateLease = useCallback(async (id: string, updates: Partial<Lease>) => {
    try { await updateDocument(Collections.LEASES, id, updates); } catch { /* offline */ }
    setLeases(prev => prev.map(l => l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l));
  }, [setLeases]);

  const removeLease = useCallback(async (id: string) => {
    try { await deleteDocument(Collections.LEASES, id); } catch { /* offline */ }
    setLeases(prev => prev.filter(l => l.id !== id));
  }, [setLeases]);

  const activateLease = useCallback(async (id: string) => {
    await updateLease(id, { status: "active" });
  }, [updateLease]);

  return { leases, loading, isLive, addLease, updateLease, removeLease, activateLease };
}

// ============================================
// Transactions Hook
// ============================================

export function useTransactions() {
  const user = useAuthStore((s) => s.user);
  const { data: transactions, setData: setTransactions, loading, isLive } =
    useFirestoreCollection<Transaction>(
      Collections.TRANSACTIONS, mockTransactions, true,
      useTenantFilter("tenantId")
    );

  // orgId is stamped here, like every other hook in this file. It used to be the
  // caller's job, and the one caller hardcoded "org-1" — so every manually
  // recorded transaction was written to the demo org: invisible to the manager
  // who entered it, since reads are scoped to their own orgId, and dropped into
  // somebody else's books.
  const addTransaction = useCallback(async (
    input: Omit<Transaction, "id" | "createdAt" | "orgId">
  ) => {
    const txn = { ...input, orgId: user?.orgId || "org-1" };
    try {
      const id = await createDocument(Collections.TRANSACTIONS, txn);
      if (!isLive) {
        setTransactions(prev => [{ ...txn, id, createdAt: new Date().toISOString() } as Transaction, ...prev]);
      }
      return id;
    } catch (err) {
      rethrowIfLive(err);
      const id = `txn-${Date.now()}`;
      setTransactions(prev => [{ ...txn, id, createdAt: new Date().toISOString() } as Transaction, ...prev]);
      return id;
    }
  }, [user?.orgId, isLive, setTransactions]);

  const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>) => {
    try { await updateDocument(Collections.TRANSACTIONS, id, updates); } catch { /* offline */ }
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, [setTransactions]);

  return { transactions, loading, isLive, addTransaction, updateTransaction };
}

// ============================================
// Listings Hook
// ============================================

export function useListings() {
  const user = useAuthStore((s) => s.user);
  const { data: listings, setData: setListings, loading, isLive } =
    useFirestoreCollection<Listing>(Collections.LISTINGS, mockListings);

  const addListing = useCallback(async (input: {
    unitId: string; propertyId: string; title: string; description: string;
    rent: number; availableDate: string; photos?: string[];
  }) => {
    const orgId = user?.orgId || "org-1";
    const listing: Omit<Listing, "id" | "createdAt" | "updatedAt"> = {
      orgId,
      unitId: input.unitId,
      propertyId: input.propertyId,
      title: input.title,
      description: input.description,
      photos: input.photos || [],
      rent: input.rent,
      availableDate: input.availableDate,
      syndicatedTo: [],
      socialPosts: [],
      leads: [],
      status: "active",
    };

    try {
      const id = await createDocument(Collections.LISTINGS, listing);
      if (!isLive) {
        setListings(prev => [{ ...listing, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Listing, ...prev]);
      }
      return id;
    } catch (err) {
      rethrowIfLive(err);
      const id = `listing-${Date.now()}`;
      setListings(prev => [{ ...listing, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Listing, ...prev]);
      return id;
    }
  }, [user?.orgId, isLive, setListings]);

  const updateListing = useCallback(async (id: string, updates: Partial<Listing>) => {
    try { await updateDocument(Collections.LISTINGS, id, updates); } catch { /* offline */ }
    setListings(prev => prev.map(l => l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l));
  }, [setListings]);

  const removeListing = useCallback(async (id: string) => {
    try { await deleteDocument(Collections.LISTINGS, id); } catch { /* offline */ }
    setListings(prev => prev.filter(l => l.id !== id));
  }, [setListings]);

  const addLead = useCallback(async (listingId: string, lead: Listing["leads"][0]) => {
    const listing = listings.find(l => l.id === listingId);
    if (listing) {
      await updateListing(listingId, { leads: [...listing.leads, lead] });
    }
  }, [listings, updateListing]);

  return { listings, loading, isLive, addListing, updateListing, removeListing, addLead };
}

// ============================================
// Sublets Hook
// ============================================

export function useSublets() {
  const user = useAuthStore((s) => s.user);
  const { data: sublets, setData: setSublets, loading, isLive } =
    useFirestoreCollection<Sublet>(
      Collections.SUBLETS, mockSublets, true,
      useTenantFilter("tenantId")
    );

  const addSublet = useCallback(async (input: {
    tenantId: string; unitId: string; propertyId: string; leaseId?: string;
    title: string; description: string; monthlyRent: number;
    startDate: string; endDate: string; reason?: string; photos?: string[];
  }) => {
    const orgId = user?.orgId || "org-1";
    // A tenant listing their own room needs the landlord's consent first —
    // most leases require it, and a listing that goes live unreviewed can get
    // them evicted. A manager creating one is that consent, so it goes live.
    const needsReview = user?.role === "tenant";
    const sublet: Omit<Sublet, "id" | "createdAt" | "updatedAt"> = {
      orgId,
      tenantId: input.tenantId,
      unitId: input.unitId,
      propertyId: input.propertyId,
      leaseId: input.leaseId,
      status: needsReview ? "pending_approval" : "active",
      ...(needsReview ? { submittedAt: new Date().toISOString() } : {}),
      title: input.title,
      description: input.description,
      photos: input.photos || [],
      monthlyRent: input.monthlyRent,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason,
      applicationIds: [],
    };

    try {
      const id = await createDocument(Collections.SUBLETS, sublet);
      if (!isLive) {
        setSublets(prev => [{ ...sublet, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Sublet, ...prev]);
      }
      return id;
    } catch (err) {
      rethrowIfLive(err);
      const id = `sublet-${Date.now()}`;
      setSublets(prev => [{ ...sublet, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Sublet, ...prev]);
      return id;
    }
  }, [user?.orgId, isLive, setSublets]);

  const updateSublet = useCallback(async (id: string, updates: Partial<Sublet>) => {
    try { await updateDocument(Collections.SUBLETS, id, updates); } catch { /* offline */ }
    setSublets(prev => prev.map(s => s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s));
  }, [setSublets]);

  const removeSublet = useCallback(async (id: string) => {
    try { await deleteDocument(Collections.SUBLETS, id); } catch { /* offline */ }
    setSublets(prev => prev.filter(s => s.id !== id));
  }, [setSublets]);

  const approveSublet = useCallback(async (id: string) => {
    await updateSublet(id, {
      status: "active",
      reviewedAt: new Date().toISOString(),
      reviewedBy: user?.id || "",
      // Cleared rather than left behind: an approved listing showing why it was
      // once turned down reads as a rejection that somehow went live.
      rejectionReason: "",
    });
  }, [updateSublet, user?.id]);

  const rejectSublet = useCallback(async (id: string, rejectionReason: string) => {
    await updateSublet(id, {
      status: "rejected",
      reviewedAt: new Date().toISOString(),
      reviewedBy: user?.id || "",
      rejectionReason,
    });
  }, [updateSublet, user?.id]);

  return {
    sublets, loading, isLive,
    addSublet, updateSublet, removeSublet, approveSublet, rejectSublet,
  };
}

// ============================================
// Vendors Hook
// ============================================

export function useVendors() {
  const user = useAuthStore((s) => s.user);
  const { data: vendors, setData: setVendors, loading, isLive } =
    useFirestoreCollection<Vendor>(Collections.VENDORS, mockVendors);

  const addVendor = useCallback(async (input: {
    name: string; company?: string; specialty: MaintenanceCategory[];
    phone: string; email: string; hourlyRate?: number;
    insuranceExpiry?: string; licenseNumber?: string; serviceArea?: string;
    availableDays?: string[]; notes?: string;
  }) => {
    const orgId = user?.orgId || "org-1";
    const vendor: Omit<Vendor, "id" | "createdAt"> = {
      orgId, name: input.name, company: input.company,
      specialty: input.specialty, phone: input.phone, email: input.email,
      rating: 0, completedJobs: 0, avgCost: 0,
      hourlyRate: input.hourlyRate, status: "active",
      insuranceExpiry: input.insuranceExpiry, licenseNumber: input.licenseNumber,
      serviceArea: input.serviceArea, availableDays: input.availableDays,
      notes: input.notes,
    };

    try {
      const id = await createDocument(Collections.VENDORS, vendor);
      if (!isLive) {
        setVendors(prev => [...prev, { ...vendor, id, createdAt: new Date().toISOString() } as Vendor]);
      }
      return id;
    } catch (err) {
      rethrowIfLive(err);
      const id = `vendor-${Date.now()}`;
      setVendors(prev => [...prev, { ...vendor, id, createdAt: new Date().toISOString() } as Vendor]);
      return id;
    }
  }, [user?.orgId, isLive, setVendors]);

  const editVendor = useCallback(async (id: string, updates: Partial<Vendor>) => {
    try { await updateDocument(Collections.VENDORS, id, updates); } catch { /* offline */ }
    if (!isLive) {
      setVendors(prev => prev.map(v => v.id === id ? { ...v, ...updates, updatedAt: new Date().toISOString() } : v));
    }
  }, [isLive, setVendors]);

  const removeVendor = useCallback(async (id: string) => {
    try { await deleteDocument(Collections.VENDORS, id); } catch { /* offline */ }
    setVendors(prev => prev.filter(v => v.id !== id));
  }, [setVendors]);

  return { vendors, loading, isLive, addVendor, editVendor, removeVendor };
}

// ============================================
// Work Orders Hook
// ============================================

export function useWorkOrders() {
  const user = useAuthStore((s) => s.user);
  const { data: workOrders, setData: setWorkOrders, loading, isLive } =
    useFirestoreCollection<WorkOrder>(Collections.WORK_ORDERS, mockWorkOrders);

  const createWorkOrder = useCallback(async (input: {
    maintenanceRequestId: string; vendorId: string; unitId: string;
    propertyId: string; scheduledDate?: string; accessInstructions?: string;
  }) => {
    const orgId = user?.orgId || "org-1";
    const wo: Omit<WorkOrder, "id" | "createdAt" | "updatedAt"> = {
      orgId, maintenanceRequestId: input.maintenanceRequestId,
      vendorId: input.vendorId, unitId: input.unitId, propertyId: input.propertyId,
      status: "assigned", scheduledDate: input.scheduledDate,
      accessInstructions: input.accessInstructions, completionPhotos: [], receiptPhotos: [],
    };

    try {
      const id = await createDocument(Collections.WORK_ORDERS, wo);
      if (!isLive) {
        setWorkOrders(prev => [{ ...wo, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as WorkOrder, ...prev]);
      }
      return id;
    } catch (err) {
      rethrowIfLive(err);
      const id = `wo-${Date.now()}`;
      setWorkOrders(prev => [{ ...wo, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as WorkOrder, ...prev]);
      return id;
    }
  }, [user?.orgId, isLive, setWorkOrders]);

  const updateWorkOrder = useCallback(async (id: string, updates: Partial<WorkOrder>) => {
    const finalUpdates = { ...updates, updatedAt: new Date().toISOString() };
    try { await updateDocument(Collections.WORK_ORDERS, id, finalUpdates); } catch { /* offline */ }
    setWorkOrders(prev => prev.map(wo => wo.id === id ? { ...wo, ...finalUpdates } : wo));
  }, [setWorkOrders]);

  const acceptOrder = useCallback(async (id: string) => {
    await updateWorkOrder(id, { status: "accepted", acceptedAt: new Date().toISOString() });
  }, [updateWorkOrder]);

  const startOrder = useCallback(async (id: string) => {
    await updateWorkOrder(id, { status: "in_progress", startedAt: new Date().toISOString() });
  }, [updateWorkOrder]);

  const completeOrder = useCallback(async (id: string, data: {
    laborHours: number; laborCost: number; materialsCost: number;
    materialsDescription?: string; vendorNotes?: string; completionPhotos?: string[];
  }) => {
    await updateWorkOrder(id, {
      status: "pending_approval",
      completedAt: new Date().toISOString(),
      laborHours: data.laborHours,
      laborCost: data.laborCost,
      materialsCost: data.materialsCost,
      materialsDescription: data.materialsDescription,
      totalCost: data.laborCost + data.materialsCost,
      vendorNotes: data.vendorNotes,
      completionPhotos: data.completionPhotos || [],
    });
  }, [updateWorkOrder]);

  const approveOrder = useCallback(async (id: string, approvedBy: string, notes?: string) => {
    await updateWorkOrder(id, {
      status: "approved",
      approvedAt: new Date().toISOString(),
      managerApproval: { approved: true, approvedBy, approvedAt: new Date().toISOString(), notes },
    });
  }, [updateWorkOrder]);

  const rejectOrder = useCallback(async (id: string, approvedBy: string, notes?: string) => {
    await updateWorkOrder(id, {
      status: "in_progress", // send back to in-progress for re-work
      managerApproval: { approved: false, approvedBy, approvedAt: new Date().toISOString(), notes },
    });
  }, [updateWorkOrder]);

  const removeWorkOrder = useCallback(async (id: string) => {
    try { await deleteDocument(Collections.WORK_ORDERS, id); } catch { /* offline */ }
    setWorkOrders(prev => prev.filter(wo => wo.id !== id));
  }, [setWorkOrders]);

  return {
    workOrders, loading, isLive,
    createWorkOrder, updateWorkOrder, removeWorkOrder,
    acceptOrder, startOrder, completeOrder, approveOrder, rejectOrder,
  };
}

// ============================================
// Inspections Hook
// ============================================

export function useInspections() {
  const user = useAuthStore((s) => s.user);
  const { data: inspections, setData: setInspections, loading, isLive } =
    useFirestoreCollection<Inspection>(
      Collections.INSPECTIONS, mockInspections, true,
      // A tenant sees the inspections of their own tenancy — move-in and
      // move-out condition reports are the evidence behind deposit decisions.
      useTenantFilter("tenantId")
    );

  const scheduleInspection = useCallback(async (input: {
    unitId: string; propertyId: string; type: InspectionType; scheduledFor: string;
    inspectorName: string; leaseId?: string; tenantId?: string;
  }) => {
    const orgId = user?.orgId || "org-1";
    const inspection: Omit<Inspection, "id" | "createdAt" | "updatedAt"> = {
      orgId,
      unitId: input.unitId,
      propertyId: input.propertyId,
      ...(input.leaseId ? { leaseId: input.leaseId } : {}),
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      type: input.type,
      status: "scheduled",
      scheduledFor: input.scheduledFor,
      inspectorName: input.inspectorName,
      areas: [],
    };
    try {
      const id = await createDocument(Collections.INSPECTIONS, inspection);
      if (!isLive) {
        setInspections(prev => [{ ...inspection, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Inspection, ...prev]);
      }
      return id;
    } catch (err) {
      rethrowIfLive(err);
      const id = `insp-${Date.now()}`;
      setInspections(prev => [{ ...inspection, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Inspection, ...prev]);
      return id;
    }
  }, [user?.orgId, isLive, setInspections]);

  const updateInspection = useCallback(async (id: string, updates: Partial<Inspection>) => {
    try { await updateDocument(Collections.INSPECTIONS, id, updates); } catch { /* offline */ }
    if (!isLive) {
      setInspections(prev => prev.map(i => i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i));
    }
  }, [isLive, setInspections]);

  /** Records one area's condition, replacing any existing entry for that area. */
  const saveArea = useCallback(async (id: string, area: InspectionArea) => {
    const inspection = inspections.find(i => i.id === id);
    if (!inspection) return;
    const areas = [
      ...inspection.areas.filter(a => a.name !== area.name),
      area,
    ].sort((a, b) => a.name.localeCompare(b.name));

    // Move-out damage rolls up into the deposit deduction automatically, so the
    // number a tenant is charged always matches the itemised evidence.
    const depositDeduction = inspection.type === "move_out"
      ? areas.reduce((sum, a) => sum + (a.estimatedCost ?? 0), 0)
      : inspection.depositDeduction;

    await updateInspection(id, {
      areas,
      ...(depositDeduction !== undefined ? { depositDeduction } : {}),
      status: inspection.status === "scheduled" ? "in_progress" : inspection.status,
    });
  }, [inspections, updateInspection]);

  const completeInspection = useCallback(async (id: string, summary?: string) => {
    await updateInspection(id, {
      status: "completed",
      completedAt: new Date().toISOString(),
      ...(summary ? { summary } : {}),
    });
  }, [updateInspection]);

  const removeInspection = useCallback(async (id: string) => {
    try { await deleteDocument(Collections.INSPECTIONS, id); } catch { /* offline */ }
    setInspections(prev => prev.filter(i => i.id !== id));
  }, [setInspections]);

  return {
    inspections, loading, isLive,
    scheduleInspection, updateInspection, saveArea, completeInspection, removeInspection,
  };
}

// ============================================
// Keys & Locks Hook
// ============================================

export function useKeys() {
  const user = useAuthStore((s) => s.user);
  const { data: keys, setData: setKeys, loading, isLive } =
    useFirestoreCollection<KeyRecord>(Collections.KEYS, mockKeys, user?.role !== "tenant");
  const { data: lockChanges, setData: setLockChanges } =
    useFirestoreCollection<LockChange>(Collections.LOCK_CHANGES, mockLockChanges, user?.role !== "tenant");

  const addKey = useCallback(async (input: {
    unitId: string; propertyId: string; label: string; kind: KeyKind;
    copies: number; notes?: string;
  }) => {
    const orgId = user?.orgId || "org-1";
    const key: Omit<KeyRecord, "id" | "createdAt" | "updatedAt"> = {
      orgId, unitId: input.unitId, propertyId: input.propertyId,
      label: input.label, kind: input.kind, copies: input.copies,
      status: "available",
      ...(input.notes ? { notes: input.notes } : {}),
    };
    try {
      const id = await createDocument(Collections.KEYS, key);
      if (!isLive) {
        setKeys(prev => [...prev, { ...key, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as KeyRecord]);
      }
      return id;
    } catch (err) {
      rethrowIfLive(err);
      const id = `key-${Date.now()}`;
      setKeys(prev => [...prev, { ...key, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as KeyRecord]);
      return id;
    }
  }, [user?.orgId, isLive, setKeys]);

  const updateKey = useCallback(async (id: string, updates: Partial<KeyRecord>) => {
    try { await updateDocument(Collections.KEYS, id, updates); } catch { /* offline */ }
    if (!isLive) {
      setKeys(prev => prev.map(k => k.id === id ? { ...k, ...updates, updatedAt: new Date().toISOString() } : k));
    }
  }, [isLive, setKeys]);

  const issueKey = useCallback(async (
    id: string,
    holder: { type: "tenant" | "vendor" | "staff" | "other"; id?: string; name: string }
  ) => {
    await updateKey(id, {
      status: "issued",
      holderType: holder.type,
      ...(holder.id ? { holderId: holder.id } : {}),
      holderName: holder.name,
      issuedAt: new Date().toISOString(),
      returnedAt: undefined,
    });
  }, [updateKey]);

  const returnKey = useCallback(async (id: string) => {
    await updateKey(id, {
      status: "available",
      holderType: undefined,
      holderId: undefined,
      holderName: undefined,
      returnedAt: new Date().toISOString(),
    });
  }, [updateKey]);

  const markKeyStatus = useCallback(async (id: string, status: KeyStatus) => {
    await updateKey(id, { status });
  }, [updateKey]);

  /** Records a rekey. Any key still issued for that unit is retired, because
   *  after a lock change the old copies no longer open anything. */
  const recordLockChange = useCallback(async (input: {
    unitId: string; propertyId: string; reason: LockChange["reason"];
    cost?: number; vendorId?: string; notes?: string; performedBy?: string;
  }) => {
    const orgId = user?.orgId || "org-1";
    const change: Omit<LockChange, "id" | "createdAt"> = {
      orgId, unitId: input.unitId, propertyId: input.propertyId,
      changedAt: new Date().toISOString(),
      reason: input.reason,
      ...(input.cost !== undefined ? { cost: input.cost } : {}),
      ...(input.vendorId ? { vendorId: input.vendorId } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.performedBy ? { performedBy: input.performedBy } : {}),
    };

    let id: string;
    try {
      id = await createDocument(Collections.LOCK_CHANGES, change);
      if (!isLive) {
        setLockChanges(prev => [{ ...change, id, createdAt: new Date().toISOString() } as LockChange, ...prev]);
      }
    } catch (err) {
      rethrowIfLive(err);
      id = `lock-${Date.now()}`;
      setLockChanges(prev => [{ ...change, id, createdAt: new Date().toISOString() } as LockChange, ...prev]);
    }

    await Promise.all(
      keys
        .filter(k => k.unitId === input.unitId && k.status !== "retired")
        .map(k => updateKey(k.id, { status: "retired" }))
    );

    return id;
  }, [user?.orgId, isLive, keys, setLockChanges, updateKey]);

  const removeKey = useCallback(async (id: string) => {
    try { await deleteDocument(Collections.KEYS, id); } catch { /* offline */ }
    setKeys(prev => prev.filter(k => k.id !== id));
  }, [setKeys]);

  return {
    keys, lockChanges, loading, isLive,
    addKey, updateKey, issueKey, returnKey, markKeyStatus, recordLockChange, removeKey,
  };
}

// ============================================
// Unit Notes Hook
// ============================================

export function useUnitNotes() {
  const user = useAuthStore((s) => s.user);
  const { data: notes, setData: setNotes, loading, isLive } =
    useFirestoreCollection<UnitNote>(
      Collections.UNIT_NOTES, mockUnitNotes,
      // Internal record-keeping — never exposed to tenants.
      user?.role !== "tenant"
    );

  const addNote = useCallback(async (input: {
    unitId: string; body: string; kind: NoteKind;
    propertyId?: string; tenantId?: string; pinned?: boolean;
  }) => {
    const orgId = user?.orgId || "org-1";
    const note: Omit<UnitNote, "id" | "createdAt"> = {
      orgId,
      unitId: input.unitId,
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      kind: input.kind,
      body: input.body,
      authorId: user?.id || "unknown",
      authorName: user?.displayName || "Unknown",
      pinned: input.pinned ?? false,
    };
    try {
      const id = await createDocument(Collections.UNIT_NOTES, note);
      if (!isLive) {
        setNotes(prev => [{ ...note, id, createdAt: new Date().toISOString() } as UnitNote, ...prev]);
      }
      return id;
    } catch (err) {
      rethrowIfLive(err);
      const id = `note-${Date.now()}`;
      setNotes(prev => [{ ...note, id, createdAt: new Date().toISOString() } as UnitNote, ...prev]);
      return id;
    }
  }, [user?.orgId, user?.id, user?.displayName, isLive, setNotes]);

  const togglePin = useCallback(async (id: string) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    try { await updateDocument(Collections.UNIT_NOTES, id, { pinned: !note.pinned }); } catch { /* offline */ }
    setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
  }, [notes, setNotes]);

  const removeNote = useCallback(async (id: string) => {
    try { await deleteDocument(Collections.UNIT_NOTES, id); } catch { /* offline */ }
    setNotes(prev => prev.filter(n => n.id !== id));
  }, [setNotes]);

  /** A unit's history, pinned first then newest first. */
  const notesForUnit = useCallback((unitId: string) =>
    notes
      .filter(n => n.unitId === unitId)
      .sort((a, b) =>
        Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt)
      ),
  [notes]);

  return { notes, loading, isLive, addNote, togglePin, removeNote, notesForUnit };
}

// ============================================
// Calendar Hook
// ============================================

export function useCalendar() {
  const user = useAuthStore((s) => s.user);
  const { data: events, setData: setEvents, loading, isLive } =
    useFirestoreCollection<CalendarEvent>(
      Collections.CALENDAR_EVENTS, mockCalendarEvents, user?.role !== "tenant"
    );

  const addEvent = useCallback(async (input: {
    type: CalendarEventType; title: string; start: string; end?: string;
    allDay?: boolean; unitId?: string; propertyId?: string; tenantId?: string;
    vendorId?: string; relatedId?: string; notes?: string;
  }) => {
    const orgId = user?.orgId || "org-1";
    const event: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt"> = {
      orgId,
      type: input.type,
      title: input.title,
      start: input.start,
      ...(input.end ? { end: input.end } : {}),
      allDay: input.allDay ?? false,
      status: "scheduled",
      ...(input.unitId ? { unitId: input.unitId } : {}),
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      ...(input.vendorId ? { vendorId: input.vendorId } : {}),
      ...(input.relatedId ? { relatedId: input.relatedId } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
    };
    try {
      const id = await createDocument(Collections.CALENDAR_EVENTS, event);
      if (!isLive) {
        setEvents(prev => [...prev, { ...event, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as CalendarEvent]);
      }
      return id;
    } catch (err) {
      rethrowIfLive(err);
      const id = `cal-${Date.now()}`;
      setEvents(prev => [...prev, { ...event, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as CalendarEvent]);
      return id;
    }
  }, [user?.orgId, isLive, setEvents]);

  const updateEvent = useCallback(async (id: string, updates: Partial<CalendarEvent>) => {
    try { await updateDocument(Collections.CALENDAR_EVENTS, id, updates); } catch { /* offline */ }
    if (!isLive) {
      setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e));
    }
  }, [isLive, setEvents]);

  const removeEvent = useCallback(async (id: string) => {
    try { await deleteDocument(Collections.CALENDAR_EVENTS, id); } catch { /* offline */ }
    setEvents(prev => prev.filter(e => e.id !== id));
  }, [setEvents]);

  /** Events falling on a given calendar day, earliest first. */
  const eventsOnDay = useCallback((day: Date) => {
    const key = day.toISOString().slice(0, 10);
    return events
      .filter(e => e.start.slice(0, 10) === key)
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [events]);

  return { events, loading, isLive, addEvent, updateEvent, removeEvent, eventsOnDay };
}

// ============================================
// Reminders Hook
// ============================================

/**
 * Derived reminders across leases, inspections, maintenance and keys.
 *
 * Nothing is stored: see src/lib/reminders.ts for why.
 */
export function useReminders(): { reminders: Reminder[]; loading: boolean } {
  const { leases, loading: l1 } = useLeases();
  const { inspections, loading: l2 } = useInspections();
  const { requests, loading: l3 } = useMaintenance();
  const { keys, loading: l4 } = useKeys();
  const { units } = useUnits();
  const { tenants } = useTenants();

  const reminders = useMemo(
    () => buildReminders({ leases, inspections, maintenance: requests, keys, units, tenants }),
    [leases, inspections, requests, keys, units, tenants]
  );

  return { reminders, loading: l1 || l2 || l3 || l4 };
}

// ============================================
// Identity Hooks
// ============================================
// The portal pages used to hardcode `tenants[0]`, which showed every signed-in
// tenant the first tenant's lease, payments and maintenance history. These
// resolve the record that actually belongs to the signed-in user.

function sameEmail(a?: string, b?: string): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * The Tenant record for the signed-in user, or null if they aren't a tenant.
 *
 * Two paths, because a tenant and a manager reach this record differently.
 * Staff already hold the whole roster and can match within it. A tenant cannot
 * list the roster at all under the security rules, so their own record is
 * fetched directly by the tenantId carried on their user profile.
 */
export function useCurrentTenant() {
  const user = useAuthStore((s) => s.user);
  const { tenants, loading: rosterLoading } = useTenants();

  const isTenant = user?.role === "tenant";
  const tenantId = user?.tenantId;
  const shouldFetch = isTenant && Boolean(tenantId) && isFirebaseConfigured();

  // Stamped with the tenantId it was fetched for. Whether the record in hand is
  // about the current user is then a render-time comparison, so the effect never
  // has to reset state on its way out.
  const [fetched, setFetched] = useState<{ tenantId: string; record: Tenant | null } | null>(null);

  useEffect(() => {
    if (!shouldFetch || !tenantId) return;
    let cancelled = false;
    getDocument<Tenant>(Collections.TENANTS, tenantId)
      .then((doc) => { if (!cancelled) setFetched({ tenantId, record: doc }); })
      .catch(() => { if (!cancelled) setFetched({ tenantId, record: null }); });
    return () => { cancelled = true; };
  }, [shouldFetch, tenantId]);

  const settled = shouldFetch && Boolean(fetched) && fetched?.tenantId === tenantId;
  const ownRecord = settled ? (fetched?.record ?? null) : null;
  const ownLoading = shouldFetch && !settled;

  const tenant = useMemo(() => {
    if (!user) return null;
    if (isTenant && isFirebaseConfigured()) return ownRecord;
    // Demo mode and staff: match within the roster. userId is the authoritative
    // link; email is the fallback for tenants created by a manager before they
    // ever signed in.
    return (
      tenants.find((t) => t.userId && t.userId === user.id) ??
      tenants.find((t) => sameEmail(t.email, user.email)) ??
      null
    );
  }, [user, isTenant, ownRecord, tenants]);

  return { tenant, loading: isTenant ? ownLoading : rosterLoading };
}

// ============================================
// Notifications Hook
// ============================================

/**
 * In-app notifications for the signed-in user.
 *
 * Managers and owners see the org's "manager" notifications; tenants see only
 * the ones addressed to them. Most are written server-side by the Stripe
 * webhook, so this hook only ever reads and marks them read.
 */
export function useNotifications() {
  const user = useAuthStore((s) => s.user);
  const { tenant } = useCurrentTenant();
  const { data: all, setData: setAll, loading, isLive } =
    useFirestoreCollection<Notification>(
      Collections.NOTIFICATIONS, mockNotifications, true,
      useTenantFilter("tenantId")
    );

  const notifications = useMemo(() => {
    const isTenant = user?.role === "tenant";
    return all
      .filter((n) =>
        isTenant
          ? n.audience === "tenant" && (!n.tenantId || n.tenantId === tenant?.id)
          : n.audience === "manager"
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [all, user?.role, tenant?.id]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // updateDocumentFields, not updateDocument: the rule for notifications allows
  // a client to change `read` and nothing else, so the updatedAt stamp the
  // latter adds made every one of these writes fail — silently, because the
  // optimistic local update hid it until the page was reloaded.
  const markAsRead = useCallback(async (id: string) => {
    setAll((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await updateDocumentFields(Collections.NOTIFICATIONS, id, { read: true });
    } catch (err) {
      console.error("Could not mark the notification as read", err);
    }
  }, [setAll]);

  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read);
    setAll((prev) => prev.map((n) => ({ ...n, read: true })));
    await Promise.all(
      unread.map((n) =>
        updateDocumentFields(Collections.NOTIFICATIONS, n.id, { read: true }).catch(
          (err) => console.error("Could not mark the notification as read", err)
        )
      )
    );
  }, [notifications, setAll]);

  return { notifications, unreadCount, loading, isLive, markAsRead, markAllAsRead };
}

/** The Vendor record for the signed-in contractor, or null if they aren't one. */
export function useCurrentVendor() {
  const user = useAuthStore((s) => s.user);
  const { vendors, loading } = useVendors();

  const vendor = useMemo(() => {
    if (!user) return null;
    return (
      vendors.find((v) => user.vendorId && v.id === user.vendorId) ??
      vendors.find((v) => sameEmail(v.email, user.email)) ??
      null
    );
  }, [user, vendors]);

  return { vendor, loading };
}
