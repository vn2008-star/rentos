"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuthStore } from "./store";
import {
  createDocument, queryDocuments, updateDocument, deleteDocument,
  subscribeToCollection, uploadMultipleFiles, Collections,
} from "./firestore";
import { isFirebaseConfigured } from "./demo";
import {
  mockProperties, mockUnits, mockTenants,
  mockMaintenanceRequests, mockApplications,
  mockLeases, mockTransactions, mockListings, mockSublets,
  mockVendors, mockWorkOrders,
} from "./mock-data";
import type {
  Property, Unit, Tenant, MaintenanceRequest, RentalApplication,
  Lease, Transaction, Listing, Sublet, LeaseStatus, ApplicationStatus, ScreeningResult,
  PropertyType, UnitStatus, MaintenanceCategory, MaintenancePriority,
  Vendor, VendorStatus, WorkOrder, WorkOrderStatus,
} from "./types";

// ============================================
// Shared hook pattern: try Firestore, fallback to mock
// ============================================

function useFirestoreCollection<T>(
  collectionName: string,
  mockData: T[],
  enabled = true
) {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<T[]>(mockData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    // Without credentials the subscription can only fail, so don't wait on it.
    if (!user?.orgId || !enabled || !isFirebaseConfigured()) {
      setData(mockData);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToCollection<T>(
      collectionName,
      user.orgId,
      (docs) => {
        if (docs.length > 0) {
          setData(docs);
          setIsLive(true);
        } else {
          setData(mockData);
          setIsLive(false);
        }
        setLoading(false);
        setError(null);
      }
    );

    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [user?.orgId, collectionName, enabled]);

  return { data, setData, loading, error, isLive };
}

// ============================================
// Properties Hook
// ============================================

export function useProperties() {
  const user = useAuthStore((s) => s.user);
  const { data: properties, setData: setProperties, loading, isLive } =
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

  return { properties, loading, isLive, addProperty, editProperty, removeProperty };
}

// ============================================
// Units Hook
// ============================================

export function useUnits() {
  const user = useAuthStore((s) => s.user);
  const { data: units, setData: setUnits, loading, isLive } =
    useFirestoreCollection<Unit>(Collections.UNITS, mockUnits);

  const addUnit = useCallback(async (input: {
    propertyId: string; unitNumber: string; beds: number; baths: number;
    sqft: number; rent: number; deposit: number; status: UnitStatus;
    photos?: File[];
  }) => {
    const orgId = user?.orgId || "org-1";

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
    } catch {
      const id = `unit-${Date.now()}`;
      setUnits(prev => [...prev, { ...unit, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Unit]);
      return id;
    }
  }, [user?.orgId, isLive, setUnits]);

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

  return { units, loading, isLive, addUnit, editUnit, removeUnit };
}

// ============================================
// Tenants Hook
// ============================================

export function useTenants() {
  const user = useAuthStore((s) => s.user);
  const { data: tenants, setData: setTenants, loading, isLive } =
    useFirestoreCollection<Tenant>(Collections.TENANTS, mockTenants);

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
    } catch {
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
    useFirestoreCollection<MaintenanceRequest>(Collections.MAINTENANCE, mockMaintenanceRequests);

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
    } catch {
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
    } catch {
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
    useFirestoreCollection<Lease>(Collections.LEASES, mockLeases);

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
    } catch {
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
    useFirestoreCollection<Transaction>(Collections.TRANSACTIONS, mockTransactions);

  const addTransaction = useCallback(async (input: Omit<Transaction, "id" | "createdAt">) => {
    try {
      const id = await createDocument(Collections.TRANSACTIONS, input);
      if (!isLive) {
        setTransactions(prev => [{ ...input, id, createdAt: new Date().toISOString() } as Transaction, ...prev]);
      }
      return id;
    } catch {
      const id = `txn-${Date.now()}`;
      setTransactions(prev => [{ ...input, id, createdAt: new Date().toISOString() } as Transaction, ...prev]);
      return id;
    }
  }, [isLive, setTransactions]);

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
    } catch {
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
    useFirestoreCollection<Sublet>(Collections.SUBLETS, mockSublets);

  const addSublet = useCallback(async (input: {
    tenantId: string; unitId: string; propertyId: string; leaseId?: string;
    title: string; description: string; monthlyRent: number;
    startDate: string; endDate: string; reason?: string; photos?: string[];
  }) => {
    const orgId = user?.orgId || "org-1";
    const sublet: Omit<Sublet, "id" | "createdAt" | "updatedAt"> = {
      orgId,
      tenantId: input.tenantId,
      unitId: input.unitId,
      propertyId: input.propertyId,
      leaseId: input.leaseId,
      status: "active", // Free listing — no approval required
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
    } catch {
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

  return { sublets, loading, isLive, addSublet, updateSublet, removeSublet };
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
    } catch {
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
    } catch {
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
// Identity Hooks
// ============================================
// The portal pages used to hardcode `tenants[0]`, which showed every signed-in
// tenant the first tenant's lease, payments and maintenance history. These
// resolve the record that actually belongs to the signed-in user.

function sameEmail(a?: string, b?: string): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The Tenant record for the signed-in user, or null if they aren't a tenant. */
export function useCurrentTenant() {
  const user = useAuthStore((s) => s.user);
  const { tenants, loading } = useTenants();

  const tenant = useMemo(() => {
    if (!user) return null;
    // userId is the authoritative link; email is the fallback for tenants who
    // were created by a manager before they ever signed in.
    return (
      tenants.find((t) => t.userId && t.userId === user.id) ??
      tenants.find((t) => sameEmail(t.email, user.email)) ??
      null
    );
  }, [user, tenants]);

  return { tenant, loading };
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
