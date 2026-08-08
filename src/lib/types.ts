// ============================================
// RentOS — Core Type Definitions
// ============================================

export type UserRole = "super_admin" | "owner" | "manager" | "leasing_agent" | "maintenance" | "contractor" | "tenant" | "guest";

export type PropertyType = "apartment" | "single_family" | "condo" | "room" | "airbnb" | "townhouse";

export type UnitStatus = "available" | "occupied" | "maintenance" | "reserved" | "sublet" | "offline";

export type LeaseStatus = "draft" | "active" | "expiring_soon" | "expired" | "month_to_month" | "terminated";

export type ApplicationStatus = "submitted" | "reviewing" | "screening" | "approved" | "denied" | "withdrawn";

export type MaintenanceStatus = "submitted" | "acknowledged" | "assigned" | "in_progress" | "completed" | "closed";

export type MaintenancePriority = "emergency" | "urgent" | "routine" | "scheduled";

export type MaintenanceCategory = "plumbing" | "electrical" | "hvac" | "appliance" | "structural" | "pest" | "cleaning" | "landscaping" | "other";
export type ReporterType = "tenant" | "manager" | "external";

// ----- Users & Auth -----
export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  orgId: string;
  phone?: string;
  /** Set on contractor accounts — links the login to a Vendor record. */
  vendorId?: string;
  createdAt: string;
  lastLoginAt?: string;
}

// ----- Organization (Multi-tenant) -----
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  plan: "starter" | "growth" | "professional" | "enterprise";
  ownerId: string;
  settings: {
    timezone: string;
    currency: string;
    lateFeeEnabled: boolean;
    lateFeeAmount: number;
    lateFeeDays: number;
  };
  createdAt: string;
}

// ----- Properties -----
export interface Property {
  id: string;
  orgId: string;
  name: string;
  type: PropertyType;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    lat?: number;
    lng?: number;
  };
  photos: string[];
  amenities: string[];
  description?: string;
  yearBuilt?: number;
  managerId?: string;
  totalUnits: number;
  occupiedUnits: number;
  createdAt: string;
  updatedAt: string;
}

// ----- Units -----
export interface Unit {
  id: string;
  orgId: string;
  propertyId: string;
  unitNumber: string;
  status: UnitStatus;
  beds: number;
  baths: number;
  sqft: number;
  rent: number;
  deposit: number;
  photos: string[];
  amenities: string[];
  floorPlan?: string;
  description?: string;
  currentTenantId?: string;
  currentLeaseId?: string;
  availableDate?: string;
  createdAt: string;
  updatedAt: string;
}

// ----- Tenants -----
export interface Tenant {
  id: string;
  orgId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  photoURL?: string;
  unitId?: string;
  propertyId?: string;
  leaseId?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  moveInDate?: string;
  moveOutDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ----- Leases -----
export interface Lease {
  id: string;
  orgId: string;
  unitId: string;
  propertyId: string;
  tenantIds: string[];
  status: LeaseStatus;
  startDate: string;
  endDate: string;
  rentAmount: number;
  securityDeposit: number;
  lateFeePercent: number; // e.g. 5 = 5%
  gracePeriodDays: number; // days after due date before late fee
  autoRenew: boolean;
  terms?: string;
  documents: string[];
  signatures: { tenantId: string; signedAt: string; signatureUrl: string }[];
  renewalOffered?: boolean;
  renewalDecision?: "accepted" | "declined" | "pending";
  createdAt: string;
  updatedAt: string;
}

export interface LeaseTemplate {
  id: string;
  orgId: string;
  name: string;
  description: string;
  terms: string;
  lateFeePercent: number;
  gracePeriodDays: number;
  autoRenew: boolean;
  createdAt: string;
}

// ----- Payment Records -----
export interface PaymentRecord {
  id: string;
  orgId: string;
  tenantId: string;
  leaseId: string;
  unitId: string;
  propertyId: string;
  type: "rent" | "deposit" | "late_fee" | "application_fee" | "maintenance" | "refund" | "other";
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: "pending" | "paid" | "overdue" | "failed" | "refunded";
  stripePaymentIntentId?: string;
  stripeCustomerId?: string;
  receiptUrl?: string;
  notes?: string;
  createdAt: string;
}

// ----- Screening Results -----
export interface ScreeningResult {
  creditScore: number;
  creditGrade: "excellent" | "good" | "fair" | "poor";
  backgroundClear: boolean;
  backgroundFlags: string[];
  evictionHistory: boolean;
  incomeToRentRatio: number;
  overallScore: number; // 0-100
  recommendation: "approve" | "conditional" | "deny";
  reportDate: string;
}

// ----- Rental Applications -----
export interface RentalApplication {
  id: string;
  orgId: string;
  unitId: string;
  propertyId: string;
  status: ApplicationStatus;
  applicant: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    currentAddress: string;
    employer: string;
    income: number;
    moveInDate: string;
  };
  creditCheck?: {
    score: number;
    status: "pending" | "completed" | "failed";
    reportUrl?: string;
  };
  backgroundCheck?: {
    status: "pending" | "completed" | "failed";
    reportUrl?: string;
  };
  references: {
    name: string;
    phone: string;
    email: string;
    relationship: string;
    status: "pending" | "contacted" | "responded";
    notes?: string;
  }[];
  score?: number;
  decision?: string;
  notes?: string;
  applicationFee?: number;
  createdAt: string;
  updatedAt: string;
}

// ----- Maintenance Requests -----

export interface Reporter {
  type: ReporterType;
  name: string;
  phone?: string;
  email?: string;
}

export interface MaintenanceRequest {
  id: string;
  orgId: string;
  unitId: string;
  propertyId: string;
  tenantId?: string; // optional — external/manager reports may not have one
  reporter?: Reporter;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  title: string;
  description: string;
  photos: string[];
  assignedVendorId?: string;
  workOrderId?: string;
  scheduledDate?: string;
  estimatedCost?: number;
  approvedCost?: number;
  accessInstructions?: string;
  completionPhotos: string[];
  cost?: number;
  invoiceUrl?: string;
  tenantNotes?: string;
  vendorNotes?: string;
  managerNotes?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

// ----- Vendors -----
export type VendorStatus = "active" | "inactive" | "suspended";

export interface Vendor {
  id: string;
  orgId: string;
  name: string;
  company?: string;
  specialty: MaintenanceCategory[];
  phone: string;
  email: string;
  rating: number;
  completedJobs: number;
  avgCost: number;
  hourlyRate?: number;
  status: VendorStatus;
  insuranceExpiry?: string;
  licenseNumber?: string;
  serviceArea?: string;
  availableDays?: string[];
  photoURL?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ----- Work Orders -----
export type WorkOrderStatus = "assigned" | "accepted" | "in_progress" | "completed" | "pending_approval" | "approved" | "invoiced" | "cancelled";

export interface WorkOrder {
  id: string;
  orgId: string;
  maintenanceRequestId: string;
  vendorId: string;
  unitId: string;
  propertyId: string;
  status: WorkOrderStatus;
  scheduledDate?: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  approvedAt?: string;
  laborHours?: number;
  laborCost?: number;
  materialsCost?: number;
  materialsDescription?: string;
  totalCost?: number;
  completionPhotos: string[];
  receiptPhotos: string[];
  vendorNotes?: string;
  managerNotes?: string;
  accessInstructions?: string;
  managerApproval?: { approved: boolean; approvedBy: string; approvedAt: string; notes?: string };
  createdAt: string;
  updatedAt: string;
}

// ----- Transactions -----
export interface Transaction {
  id: string;
  orgId: string;
  type: "rent" | "deposit" | "fee" | "late_fee" | "maintenance" | "refund" | "other";
  amount: number;
  date: string;
  unitId?: string;
  propertyId?: string;
  tenantId?: string;
  leaseId?: string;
  vendorId?: string;
  description: string;
  status: "pending" | "completed" | "failed" | "refunded";
  stripePaymentIntentId?: string;
  receiptUrl?: string;
  createdAt: string;
}

// ----- Listings -----
export interface Listing {
  id: string;
  orgId: string;
  unitId: string;
  propertyId: string;
  title: string;
  description: string;
  photos: string[];
  rent: number;
  availableDate: string;
  syndicatedTo: string[];
  socialPosts: { platform: string; postId: string; url: string; postedAt: string }[];
  leads: { name: string; email: string; phone?: string; source: string; createdAt: string }[];
  status: "active" | "paused" | "filled";
  createdAt: string;
  updatedAt: string;
}

// ----- Sublets -----
export type SubletStatus = "draft" | "active" | "completed" | "cancelled";

export interface Sublet {
  id: string;
  orgId: string;
  tenantId: string;
  unitId: string;
  propertyId: string;
  leaseId?: string;
  status: SubletStatus;
  title: string;
  description: string;
  photos: string[];
  monthlyRent: number;
  startDate: string;
  endDate: string;
  reason?: string;
  guestInfo?: {
    name: string;
    email: string;
    phone?: string;
    university?: string;
    notes?: string;
  };
  applicationIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ----- STR / Short-Term Rental Pricing -----
export interface STRPricing {
  baseNightlyRate: number;
  weekendPremiumPercent: number; // e.g. 20 = 20% more on Fri/Sat
  seasonalRates: { name: string; startMonth: number; endMonth: number; rateMultiplier: number }[];
  minimumStay: number;
  cleaningFee: number;
  maxGuests: number;
}

export interface STRBooking {
  id: string;
  unitId: string;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  nightlyRate: number;
  totalAmount: number;
  status: "confirmed" | "pending" | "cancelled" | "completed";
  platform: string; // "direct" | "airbnb" | "vrbo"
  notes?: string;
}

export interface STRCalendarDay {
  date: string;
  status: "available" | "booked" | "blocked";
  nightlyRate: number;
  booking?: STRBooking;
}

// ----- Dashboard Stats -----
export interface DashboardStats {
  totalProperties: number;
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  monthlyRevenue: number;
  pendingMaintenance: number;
  activeApplications: number;
  expiringLeases: number;
  vacantUnits: number;
  revenueHistory: { month: string; revenue: number; expenses: number }[];
}
