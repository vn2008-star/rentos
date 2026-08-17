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
  /**
   * Set on tenant accounts — links the login to a Tenant record.
   *
   * Security rules cannot run queries, so this is how a rule decides whether a
   * lease or transaction belongs to the caller. Without it, scoping a tenant to
   * their own records is impossible and the only workable rule is "any member
   * of the org can read everything".
   */
  tenantId?: string;
  createdAt: string;
  lastLoginAt?: string;
}

// ----- Organization (Multi-tenant) -----
export type PlanId = "starter" | "growth" | "professional" | "enterprise";

/**
 * Where the org stands with us — whether they are paying for RentOS.
 *
 * Mirrors Stripe's subscription statuses, plus "trialing" for an org that has
 * signed up but never entered a card. Security rules read this, so the strings
 * must stay in sync with firestore.rules.
 */
export type BillingStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

export interface OrgBilling {
  status: BillingStatus;
  /** The org's customer record for its RentOS subscription — not for rent. */
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  /** ISO. Set while status is "trialing"; the billing page nags past it. */
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

/**
 * The org's Stripe Connect account — where their rent actually lands.
 *
 * Without this every tenant's rent settles into the platform's own balance,
 * which is somebody else's money sitting in our account. chargesEnabled is the
 * gate: Stripe only sets it once identity and bank details clear.
 */
export interface OrgPayouts {
  stripeAccountId?: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  /** Stripe's own words on what it still needs, for the settings screen. */
  requirementsDue?: string[];
  updatedAt?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  plan: PlanId;
  ownerId: string;
  settings: {
    timezone: string;
    currency: string;
    lateFeeEnabled: boolean;
    lateFeeAmount: number;
    lateFeeDays: number;
    /** Turns the public /o/{slug} repair and application pages on or off. */
    publicIntake?: boolean;
    /**
     * Whether approved sublets are published to the public sublet feed, where
     * consumer housing sites can pick them up.
     *
     * Syndicating a customer's inventory to another product is their decision,
     * not ours. Absent means yes — every org that has sublets today expects to
     * fill them — and setting it false withdraws them.
     */
    subletMarketplace?: boolean;
  };
  billing?: OrgBilling;
  payouts?: OrgPayouts;
  createdAt: string;
  updatedAt?: string;
}

// ----- Product Feedback -----
export type FeedbackType = "bug" | "feature" | "enhancement" | "feedback";

export type FeedbackStatus =
  | "new"
  | "reviewed"
  | "planned"
  | "done"
  | "dismissed";

/**
 * Something a customer wanted to tell us, from wherever they were standing.
 *
 * The page is captured automatically because the answer to "where were you?"
 * is the first thing needed to act on a bug report and the last thing anyone
 * remembers to include. Same for the role: "the payments page is broken" means
 * different things from a manager and from a tenant.
 *
 * Replies are written by operators, never by the client, so a submitter cannot
 * fabricate an answer from us — and the person who sent it can see the status
 * change, which is what makes it worth their time to write the next one.
 */
export interface Feedback {
  id: string;
  orgId: string;
  orgName?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: UserRole;
  /** The in-app route they were on, e.g. "/portal/payments". */
  page: string;
  type: FeedbackType;
  message: string;
  /** Optional 1–5. Absent when they just wanted to report something. */
  rating?: number | null;
  status: FeedbackStatus;
  adminNotes?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

// ----- Support Access -----
/**
 * A RentOS operator's temporary access to one customer's organization.
 *
 * Support work sometimes needs to see what the customer sees, and occasionally
 * to fix something for them. Granting super_admin standing access to every
 * organization would mean one stolen session exposes every customer on the
 * platform, so access is instead: one organization at a time, for a stated
 * reason, expiring on its own, and read-only unless editing was asked for.
 *
 * The document IS the grant — security rules read it directly — so ending a
 * session or letting it expire genuinely revokes access rather than just
 * hiding a button.
 */
export interface SupportSession {
  /** Document id is the operator's uid: one active session per operator. */
  adminUid: string;
  adminEmail: string;
  orgId: string;
  orgName: string;
  /** Why this was opened. Required — it is what makes the audit trail useful. */
  reason: string;
  /** False means look, do not touch. */
  writeEnabled: boolean;
  /**
   * Whose eyes to look through.
   *
   * Unset means the operator sees what the customer's staff see. Set, and the
   * app and the security rules both narrow to exactly one tenant or contractor
   * — which is the only way to answer "my portal says I have no lease" without
   * guessing, because it reproduces what they cannot see as well as what they
   * can.
   *
   * Always read-only: writing as a customer's tenant would put records in that
   * person's name that they did not make.
   */
  viewAsRole?: "tenant" | "contractor" | null;
  /** The Tenant or Vendor record being looked through. */
  viewAsSubjectId?: string;
  viewAsSubjectName?: string;
  startedAt: string;
  /** Firestore Timestamp on the wire so the rules can compare it to request.time. */
  expiresAt: string;
}

// ----- Team Invites -----
export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

/**
 * An invitation to join an organization.
 *
 * The document id doubles as the invite token — it goes in the emailed link and
 * is generated server-side, so it is unguessable. Possession of the link alone
 * is NOT enough to accept: the accepting account's verified email must match
 * the address the invite was issued to. Otherwise a forwarded link would hand
 * a stranger staff access to the portfolio.
 */
export interface OrgInvite {
  id: string;
  orgId: string;
  orgName: string;
  email: string;
  role: UserRole;
  status: InviteStatus;
  invitedBy: string;
  invitedByName: string;
  /** Set when inviting an existing Tenant or Vendor record to their portal. */
  tenantId?: string;
  vendorId?: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  acceptedBy?: string;
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
  // ----- Autopay (written by the Stripe webhook, never by the client) -----
  autopayEnabled?: boolean;
  stripeCustomerId?: string;
  stripePaymentMethodId?: string;
  /** Display-only card details. The card itself stays with Stripe. */
  defaultPaymentMethod?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
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
  /** ISO. When the tenant answered the offer — written by /api/leases/renewal. */
  renewalRespondedAt?: string;
  /**
   * Which lease this tenancy is on — see lease-templates.ts.
   *
   * Recorded because it decides what the landlord still owes the tenant: the
   * Davis Model Lease carries the City's registration and move-in inspection
   * duties that a plain California lease does not.
   */
  templateId?: "davis-model" | "ca-standard";
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
  /**
   * Set when this arrived as an enquiry about a sublet rather than a vacancy.
   *
   * A sublet enquirer has answered far less than a rental applicant — no
   * employer, no income, no references — so screening a record with this set
   * would be scoring blanks. It marks where the interest came from and links
   * back to the room.
   */
  subletId?: string;
  /**
   * Set when the application was turned into a tenancy.
   *
   * Approving an applicant and moving them in are different acts — an approval
   * can sit for a week while they decide. These record that the second one
   * happened, and their presence is what stops a second move-in creating a
   * duplicate tenant on the same unit.
   */
  tenantId?: string;
  leaseId?: string;
  movedInAt?: string;
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
  /** Set by the Stripe webhook when a payment_intent fails. */
  failureReason?: string;
  createdAt: string;
}

// ----- Notifications -----
export type NotificationKind =
  | "payment_failed"
  | "payment_received"
  | "maintenance_urgent"
  | "maintenance_reported"
  | "lease_expiring"
  | "application_received";

/**
 * In-app notification. Written server-side by the Stripe webhook and
 * client-side by the app; read through useNotifications().
 */
export interface Notification {
  id: string;
  orgId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Who should see it. "manager" covers manager + owner roles. */
  audience: "manager" | "tenant";
  /** Set when audience is "tenant" — scopes it to one person. */
  tenantId?: string;
  /** In-app route to open when clicked. */
  href?: string;
  read: boolean;
  createdAt: string;
}

// ----- Inspections -----
export type InspectionType = "move_in" | "move_out" | "periodic" | "turnover";
export type InspectionStatus = "scheduled" | "in_progress" | "completed";
export type ItemCondition = "excellent" | "good" | "fair" | "poor" | "damaged";

/** One area of a unit as found during an inspection. */
export interface InspectionArea {
  /** Kitchen, Bathroom, Bedroom 1, Exterior … */
  name: string;
  condition: ItemCondition;
  notes?: string;
  photos: string[];
  /** Set on move-out when damage is chargeable to the deposit. */
  estimatedCost?: number;
}

export interface Inspection {
  id: string;
  orgId: string;
  unitId: string;
  propertyId: string;
  leaseId?: string;
  tenantId?: string;
  type: InspectionType;
  status: InspectionStatus;
  scheduledFor: string;
  completedAt?: string;
  inspectorName: string;
  areas: InspectionArea[];
  /**
   * The form this inspection is working through, when it was started from a
   * template. Held on the record so the checklist survives a reload and so a
   * half-finished walk-through still knows what it has not looked at yet.
   */
  templateId?: "davis-move-in";
  expectedAreas?: string[];
  summary?: string;
  /** Move-out only: what is being withheld and why. */
  depositDeduction?: number;
  /** Tenant acknowledgement, mirroring how leases are signed. */
  tenantSignature?: { signedAt: string; signatureUrl: string };
  createdAt: string;
  updatedAt: string;
}

// ----- Keys & Locks -----
export type KeyKind = "physical" | "fob" | "code" | "smart_lock" | "mailbox" | "garage";
export type KeyStatus = "available" | "issued" | "lost" | "retired";

export interface KeyRecord {
  id: string;
  orgId: string;
  unitId: string;
  propertyId: string;
  label: string;
  kind: KeyKind;
  copies: number;
  status: KeyStatus;
  /** Who currently holds it — a tenant, a vendor, or a named person. */
  holderType?: "tenant" | "vendor" | "staff" | "other";
  holderId?: string;
  holderName?: string;
  issuedAt?: string;
  returnedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** A rekey or lock replacement. Kept separate from keys so the unit keeps a
 *  permanent audit trail even after the keys themselves are retired. */
export interface LockChange {
  id: string;
  orgId: string;
  unitId: string;
  propertyId: string;
  changedAt: string;
  reason: "turnover" | "lost_key" | "security" | "upgrade" | "damage" | "other";
  performedBy?: string;
  vendorId?: string;
  cost?: number;
  notes?: string;
  createdAt: string;
}

// ----- Unit Notes & Communication -----
export type NoteKind = "note" | "call" | "email" | "sms" | "visit" | "complaint";

export interface UnitNote {
  id: string;
  orgId: string;
  unitId: string;
  propertyId?: string;
  tenantId?: string;
  kind: NoteKind;
  body: string;
  authorId: string;
  authorName: string;
  /** Pinned notes surface at the top of the unit's history. */
  pinned: boolean;
  createdAt: string;
}

// ----- Calendar -----
export type CalendarEventType =
  | "showing"
  | "inspection"
  | "move_in"
  | "move_out"
  | "maintenance"
  | "lease_renewal"
  | "other";

export type CalendarEventStatus = "scheduled" | "completed" | "cancelled";

export interface CalendarEvent {
  id: string;
  orgId: string;
  type: CalendarEventType;
  title: string;
  /** ISO datetime. allDay events ignore the time component. */
  start: string;
  end?: string;
  allDay: boolean;
  status: CalendarEventStatus;
  unitId?: string;
  propertyId?: string;
  tenantId?: string;
  vendorId?: string;
  /** Inspection, work order or application this event was created for. */
  relatedId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ----- Reminders -----
export type ReminderKind =
  | "lease_renewal"
  | "lease_expiring"
  | "inspection_due"
  | "inspection_overdue"
  | "maintenance_stale"
  | "key_outstanding"
  | "rent_overdue";

export type ReminderSeverity = "info" | "warning" | "critical";

/**
 * Derived, not stored. Computed from leases, inspections, maintenance and keys
 * on every read, so a reminder can never go stale or contradict the records it
 * describes — and no scheduled job is needed to create them.
 */
export interface Reminder {
  id: string;
  kind: ReminderKind;
  severity: ReminderSeverity;
  title: string;
  detail: string;
  /** ISO date the thing is due; past dates are overdue. */
  dueDate: string;
  daysUntilDue: number;
  href: string;
  unitId?: string;
  tenantId?: string;
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
/**
 * A sublet's life, from a tenant writing it to a guest moving in.
 *
 *   draft → pending_approval → active → completed
 *                    ↓
 *                rejected
 *
 * The review step exists because most leases forbid subletting without the
 * landlord's consent. A listing that goes live unreviewed can get the tenant
 * evicted for the thing the app encouraged them to do, so the org sees it
 * first. A manager creating a sublet on a tenant's behalf *is* the consent,
 * and skips straight to active.
 */
export type SubletStatus =
  | "draft"
  | "pending_approval"
  | "active"
  | "rejected"
  | "completed"
  | "cancelled";

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
  /** When the tenant sent it for review. */
  submittedAt?: string;
  /** When a manager approved or rejected it, and who did. */
  reviewedAt?: string;
  reviewedBy?: string;
  /**
   * Why the org turned it down. Shown to the tenant — a rejection they cannot
   * see the reason for is one they will just submit again unchanged.
   */
  rejectionReason?: string;
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
