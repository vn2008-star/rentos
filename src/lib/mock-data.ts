import type {
  Property, Unit, Tenant, MaintenanceRequest, DashboardStats, RentalApplication,
  Lease, Transaction, PaymentRecord, Listing, Sublet, Vendor, WorkOrder,
  Notification, Inspection, KeyRecord, LockChange, UnitNote, CalendarEvent,
} from "./types";

// ============================================
// Mock Data for Development & Demo
// ============================================

export const mockProperties: Property[] = [
  {
    id: "prop-1",
    orgId: "org-1",
    name: "University Commons",
    type: "apartment",
    address: { street: "200 Russell Blvd", city: "Davis", state: "CA", zip: "95616", lat: 38.5449, lng: -121.7405 },
    photos: [],
    amenities: ["Pool", "Gym", "Laundry", "Parking", "Bike Storage"],
    description: "Modern student-friendly apartments near UC Davis campus",
    yearBuilt: 2018,
    totalUnits: 24,
    occupiedUnits: 21,
    createdAt: "2024-01-15T00:00:00Z",
    updatedAt: "2024-12-01T00:00:00Z",
  },
  {
    id: "prop-2",
    orgId: "org-1",
    name: "Aggie Square Homes",
    type: "single_family",
    address: { street: "450 Oak Ave", city: "Davis", state: "CA", zip: "95616", lat: 38.5382, lng: -121.7617 },
    photos: [],
    amenities: ["Backyard", "Garage", "Central AC", "Washer/Dryer"],
    description: "Single family homes in quiet Davis neighborhood",
    totalUnits: 6,
    occupiedUnits: 5,
    createdAt: "2023-06-01T00:00:00Z",
    updatedAt: "2024-11-15T00:00:00Z",
  },
  {
    id: "prop-3",
    orgId: "org-1",
    name: "Downtown Davis Studios",
    type: "apartment",
    address: { street: "112 E St", city: "Davis", state: "CA", zip: "95616", lat: 38.5435, lng: -121.7408 },
    photos: [],
    amenities: ["Downtown Location", "Rooftop Deck", "EV Charging", "Smart Locks"],
    description: "Premium studio apartments in the heart of downtown Davis",
    yearBuilt: 2022,
    totalUnits: 16,
    occupiedUnits: 14,
    createdAt: "2024-03-01T00:00:00Z",
    updatedAt: "2024-12-10T00:00:00Z",
  },
  {
    id: "prop-4",
    orgId: "org-1",
    name: "Campus Edge Rooms",
    type: "room",
    address: { street: "880 Sycamore Ln", city: "Davis", state: "CA", zip: "95616", lat: 38.5500, lng: -121.7520 },
    photos: [],
    amenities: ["Furnished", "Utilities Included", "WiFi", "Shared Kitchen"],
    description: "Furnished rooms for rent near campus — perfect for students & interns",
    totalUnits: 12,
    occupiedUnits: 9,
    createdAt: "2024-07-01T00:00:00Z",
    updatedAt: "2024-12-05T00:00:00Z",
  },
];

export const mockUnits: Unit[] = [
  { id: "unit-1", orgId: "org-1", propertyId: "prop-1", unitNumber: "101", status: "occupied", beds: 2, baths: 1, sqft: 850, rent: 1800, deposit: 1800, photos: [], amenities: ["Balcony", "Dishwasher"], currentTenantId: "tenant-1", createdAt: "2024-01-15T00:00:00Z", updatedAt: "2024-12-01T00:00:00Z" },
  { id: "unit-2", orgId: "org-1", propertyId: "prop-1", unitNumber: "102", status: "occupied", beds: 1, baths: 1, sqft: 600, rent: 1400, deposit: 1400, photos: [], amenities: ["Dishwasher"], currentTenantId: "tenant-2", createdAt: "2024-01-15T00:00:00Z", updatedAt: "2024-12-01T00:00:00Z" },
  { id: "unit-3", orgId: "org-1", propertyId: "prop-1", unitNumber: "103", status: "available", beds: 2, baths: 2, sqft: 950, rent: 2100, deposit: 2100, photos: [], amenities: ["Balcony", "Walk-in Closet"], availableDate: "2025-01-15", createdAt: "2024-01-15T00:00:00Z", updatedAt: "2024-12-01T00:00:00Z" },
  { id: "unit-4", orgId: "org-1", propertyId: "prop-1", unitNumber: "201", status: "maintenance", beds: 3, baths: 2, sqft: 1200, rent: 2600, deposit: 2600, photos: [], amenities: ["Balcony", "Dishwasher", "In-unit W/D"], createdAt: "2024-01-15T00:00:00Z", updatedAt: "2024-12-01T00:00:00Z" },
  { id: "unit-5", orgId: "org-1", propertyId: "prop-1", unitNumber: "202", status: "occupied", beds: 1, baths: 1, sqft: 550, rent: 1350, deposit: 1350, photos: [], amenities: [], currentTenantId: "tenant-3", createdAt: "2024-01-15T00:00:00Z", updatedAt: "2024-12-01T00:00:00Z" },
  { id: "unit-6", orgId: "org-1", propertyId: "prop-1", unitNumber: "203", status: "sublet", beds: 2, baths: 1, sqft: 820, rent: 1750, deposit: 1750, photos: [], amenities: ["Dishwasher"], createdAt: "2024-01-15T00:00:00Z", updatedAt: "2024-12-01T00:00:00Z" },
  { id: "unit-7", orgId: "org-1", propertyId: "prop-2", unitNumber: "A", status: "occupied", beds: 3, baths: 2, sqft: 1500, rent: 2800, deposit: 2800, photos: [], amenities: ["Backyard", "Garage"], currentTenantId: "tenant-4", createdAt: "2023-06-01T00:00:00Z", updatedAt: "2024-11-15T00:00:00Z" },
  { id: "unit-8", orgId: "org-1", propertyId: "prop-2", unitNumber: "B", status: "available", beds: 4, baths: 2, sqft: 1800, rent: 3200, deposit: 3200, photos: [], amenities: ["Backyard", "Garage", "Pool"], availableDate: "2025-02-01", createdAt: "2023-06-01T00:00:00Z", updatedAt: "2024-11-15T00:00:00Z" },
  { id: "unit-9", orgId: "org-1", propertyId: "prop-3", unitNumber: "S1", status: "occupied", beds: 0, baths: 1, sqft: 400, rent: 1200, deposit: 1200, photos: [], amenities: ["Smart Lock", "EV Charging"], currentTenantId: "tenant-5", createdAt: "2024-03-01T00:00:00Z", updatedAt: "2024-12-10T00:00:00Z" },
  { id: "unit-10", orgId: "org-1", propertyId: "prop-3", unitNumber: "S2", status: "reserved", beds: 0, baths: 1, sqft: 420, rent: 1250, deposit: 1250, photos: [], amenities: ["Smart Lock"], createdAt: "2024-03-01T00:00:00Z", updatedAt: "2024-12-10T00:00:00Z" },
];

export const mockTenants: Tenant[] = [
  { id: "tenant-1", orgId: "org-1", firstName: "Sarah", lastName: "Chen", email: "sarah.chen@ucdavis.edu", phone: "(530) 555-0101", unitId: "unit-1", propertyId: "prop-1", moveInDate: "2024-09-01", createdAt: "2024-08-15T00:00:00Z", updatedAt: "2024-12-01T00:00:00Z" },
  { id: "tenant-2", orgId: "org-1", firstName: "James", lastName: "Rodriguez", email: "j.rodriguez@gmail.com", phone: "(530) 555-0102", unitId: "unit-2", propertyId: "prop-1", moveInDate: "2024-06-01", createdAt: "2024-05-20T00:00:00Z", updatedAt: "2024-12-01T00:00:00Z" },
  { id: "tenant-3", orgId: "org-1", firstName: "Aisha", lastName: "Patel", email: "aisha.patel@ucdavis.edu", phone: "(530) 555-0103", unitId: "unit-5", propertyId: "prop-1", moveInDate: "2024-09-01", createdAt: "2024-08-20T00:00:00Z", updatedAt: "2024-12-01T00:00:00Z" },
  { id: "tenant-4", orgId: "org-1", firstName: "Michael", lastName: "Thompson", email: "m.thompson@gmail.com", phone: "(530) 555-0104", unitId: "unit-7", propertyId: "prop-2", moveInDate: "2023-07-01", createdAt: "2023-06-15T00:00:00Z", updatedAt: "2024-11-15T00:00:00Z" },
  { id: "tenant-5", orgId: "org-1", firstName: "Yuki", lastName: "Tanaka", email: "yuki.tanaka@ucdavis.edu", phone: "(530) 555-0105", unitId: "unit-9", propertyId: "prop-3", moveInDate: "2024-09-15", createdAt: "2024-09-01T00:00:00Z", updatedAt: "2024-12-10T00:00:00Z" },
  { id: "tenant-6", orgId: "org-1", firstName: "Emily", lastName: "Davis", email: "emily.d@gmail.com", phone: "(530) 555-0106", createdAt: "2024-10-01T00:00:00Z", updatedAt: "2024-12-01T00:00:00Z", notes: "Looking for 2BR starting Feb 2025" },
];

export const mockMaintenanceRequests: MaintenanceRequest[] = [
  { id: "maint-1", orgId: "org-1", unitId: "unit-1", propertyId: "prop-1", tenantId: "tenant-1", reporter: { type: "tenant", name: "Sarah Chen", email: "sarah.chen@ucdavis.edu", phone: "(530) 555-0101" }, category: "plumbing", priority: "urgent", status: "assigned", title: "Kitchen sink leak", description: "Water is leaking under the kitchen sink cabinet. The floor is getting wet.", photos: [], assignedVendorId: "vendor-1", completionPhotos: [], createdAt: "2024-12-08T10:30:00Z", updatedAt: "2024-12-09T08:00:00Z" },
  { id: "maint-2", orgId: "org-1", unitId: "unit-5", propertyId: "prop-1", tenantId: "tenant-3", reporter: { type: "tenant", name: "Aisha Patel", email: "aisha.patel@ucdavis.edu" }, category: "hvac", priority: "routine", status: "submitted", title: "Heater not working efficiently", description: "The heater takes a very long time to warm up the apartment. Thermostat seems accurate though.", photos: [], completionPhotos: [], createdAt: "2024-12-10T14:15:00Z", updatedAt: "2024-12-10T14:15:00Z" },
  { id: "maint-3", orgId: "org-1", unitId: "unit-4", propertyId: "prop-1", tenantId: "tenant-1", reporter: { type: "tenant", name: "Sarah Chen" }, category: "appliance", priority: "routine", status: "in_progress", title: "Dishwasher not draining", description: "Dishwasher fills with water but doesn't drain at the end of the cycle.", photos: [], assignedVendorId: "vendor-2", scheduledDate: "2024-12-12", completionPhotos: [], cost: 150, createdAt: "2024-12-05T09:00:00Z", updatedAt: "2024-12-11T16:00:00Z" },
  { id: "maint-4", orgId: "org-1", unitId: "unit-7", propertyId: "prop-2", tenantId: "tenant-4", reporter: { type: "tenant", name: "Michael Thompson", phone: "(530) 555-0104" }, category: "electrical", priority: "emergency", status: "completed", title: "Outlet sparking in bedroom", description: "The outlet near the bed is sparking when plugging things in. Very dangerous.", photos: [], assignedVendorId: "vendor-3", completionPhotos: [], cost: 275, createdAt: "2024-12-01T22:00:00Z", updatedAt: "2024-12-02T14:00:00Z", completedAt: "2024-12-02T14:00:00Z", resolvedAt: "2024-12-03T10:00:00Z", resolutionNotes: "Outlet replaced and inspected. All clear." },
  { id: "maint-5", orgId: "org-1", unitId: "unit-3", propertyId: "prop-1", reporter: { type: "external", name: "David Nguyen", phone: "(530) 555-0999", email: "d.nguyen@gmail.com" }, category: "structural", priority: "routine", status: "submitted", title: "Cracked exterior step at building entrance", description: "I was visiting a friend and noticed the front step has a large crack. Could be a trip hazard.", photos: [], completionPhotos: [], createdAt: "2024-12-15T09:30:00Z", updatedAt: "2024-12-15T09:30:00Z" },
  { id: "maint-6", orgId: "org-1", unitId: "unit-9", propertyId: "prop-3", reporter: { type: "manager", name: "Property Manager" }, category: "cleaning", priority: "scheduled", status: "submitted", title: "Common area deep clean needed", description: "Quarterly deep clean of hallways and common areas. Schedule with cleaning vendor.", photos: [], completionPhotos: [], createdAt: "2024-12-14T11:00:00Z", updatedAt: "2024-12-14T11:00:00Z" },
];

export const mockApplications: RentalApplication[] = [
  { id: "app-1", orgId: "org-1", unitId: "unit-3", propertyId: "prop-1", status: "reviewing", applicant: { firstName: "David", lastName: "Kim", email: "d.kim@gmail.com", phone: "(530) 555-0201", currentAddress: "123 Main St, Sacramento, CA", employer: "Tech Corp", income: 72000, moveInDate: "2025-01-15" }, references: [{ name: "Jane Smith", phone: "(916) 555-0101", email: "jane@email.com", relationship: "Previous Landlord", status: "pending" }], applicationFee: 45, createdAt: "2024-12-09T10:00:00Z", updatedAt: "2024-12-10T08:00:00Z" },
  { id: "app-2", orgId: "org-1", unitId: "unit-8", propertyId: "prop-2", status: "submitted", applicant: { firstName: "Lisa", lastName: "Wang", email: "lisa.w@ucdavis.edu", phone: "(530) 555-0202", currentAddress: "789 Campus Way, Davis, CA", employer: "UC Davis", income: 55000, moveInDate: "2025-02-01" }, references: [{ name: "Prof. Johnson", phone: "(530) 555-0301", email: "johnson@ucdavis.edu", relationship: "Employer", status: "pending" }], applicationFee: 45, createdAt: "2024-12-11T09:00:00Z", updatedAt: "2024-12-11T09:00:00Z" },
];

export const mockLeases: Lease[] = [
  { id: "lease-1", orgId: "org-1", unitId: "unit-1", propertyId: "prop-1", tenantIds: ["tenant-1"], status: "active", startDate: "2024-09-01", endDate: "2025-08-31", rentAmount: 1800, securityDeposit: 1800, lateFeePercent: 5, gracePeriodDays: 5, autoRenew: false, terms: "Standard 12-month residential lease. No pets without approval.", documents: [], signatures: [{ tenantId: "tenant-1", signedAt: "2024-08-25T10:00:00Z", signatureUrl: "" }], renewalOffered: false, createdAt: "2024-08-20T00:00:00Z", updatedAt: "2024-08-25T10:00:00Z" },
  { id: "lease-2", orgId: "org-1", unitId: "unit-2", propertyId: "prop-1", tenantIds: ["tenant-2"], status: "expiring_soon", startDate: "2024-06-01", endDate: "2025-05-31", rentAmount: 1400, securityDeposit: 1400, lateFeePercent: 5, gracePeriodDays: 5, autoRenew: false, terms: "Standard lease with included parking.", documents: [], signatures: [{ tenantId: "tenant-2", signedAt: "2024-05-20T14:00:00Z", signatureUrl: "" }], renewalOffered: true, renewalDecision: "pending", createdAt: "2024-05-15T00:00:00Z", updatedAt: "2024-12-01T00:00:00Z" },
  { id: "lease-3", orgId: "org-1", unitId: "unit-8", propertyId: "prop-2", tenantIds: ["tenant-3"], status: "active", startDate: "2023-07-01", endDate: "2025-06-30", rentAmount: 2800, securityDeposit: 2800, lateFeePercent: 5, gracePeriodDays: 5, autoRenew: true, terms: "24-month single family lease. Tenant responsible for lawn care.", documents: [], signatures: [{ tenantId: "tenant-3", signedAt: "2023-06-25T09:00:00Z", signatureUrl: "" }], renewalOffered: false, createdAt: "2023-06-20T00:00:00Z", updatedAt: "2023-06-25T09:00:00Z" },
  { id: "lease-4", orgId: "org-1", unitId: "unit-10", propertyId: "prop-3", tenantIds: ["tenant-4"], status: "active", startDate: "2024-09-15", endDate: "2025-09-14", rentAmount: 1200, securityDeposit: 1200, lateFeePercent: 5, gracePeriodDays: 5, autoRenew: false, terms: "Standard studio lease. Utilities included.", documents: [], signatures: [{ tenantId: "tenant-4", signedAt: "2024-09-10T11:00:00Z", signatureUrl: "" }], renewalOffered: false, createdAt: "2024-09-08T00:00:00Z", updatedAt: "2024-09-10T11:00:00Z" },
];

export const mockTransactions: Transaction[] = [
  { id: "txn-1", orgId: "org-1", type: "rent", amount: 1800, date: "2024-12-01", unitId: "unit-1", propertyId: "prop-1", tenantId: "tenant-1", leaseId: "lease-1", description: "December rent — Unit 101", status: "completed", createdAt: "2024-12-01T00:00:00Z" },
  { id: "txn-2", orgId: "org-1", type: "rent", amount: 1400, date: "2024-12-01", unitId: "unit-2", propertyId: "prop-1", tenantId: "tenant-2", leaseId: "lease-2", description: "December rent — Unit 102", status: "completed", createdAt: "2024-12-01T00:00:00Z" },
  { id: "txn-3", orgId: "org-1", type: "rent", amount: 2800, date: "2024-12-01", unitId: "unit-8", propertyId: "prop-2", tenantId: "tenant-3", leaseId: "lease-3", description: "December rent — Aggie Square Home A", status: "completed", createdAt: "2024-12-01T00:00:00Z" },
  { id: "txn-4", orgId: "org-1", type: "rent", amount: 1200, date: "2024-12-01", unitId: "unit-10", propertyId: "prop-3", tenantId: "tenant-4", leaseId: "lease-4", description: "December rent — Studio S1", status: "pending", createdAt: "2024-12-01T00:00:00Z" },
  { id: "txn-5", orgId: "org-1", type: "maintenance", amount: 350, date: "2024-11-28", unitId: "unit-1", propertyId: "prop-1", vendorId: "vendor-1", description: "Kitchen faucet repair — Unit 101", status: "completed", createdAt: "2024-11-28T00:00:00Z" },
  { id: "txn-6", orgId: "org-1", type: "late_fee", amount: 70, date: "2024-11-08", unitId: "unit-2", propertyId: "prop-1", tenantId: "tenant-2", leaseId: "lease-2", description: "November late fee — Unit 102", status: "completed", createdAt: "2024-11-08T00:00:00Z" },
];

export const mockPaymentRecords: PaymentRecord[] = [
  { id: "pay-1", orgId: "org-1", tenantId: "tenant-1", leaseId: "lease-1", unitId: "unit-1", propertyId: "prop-1", type: "rent", amount: 1800, dueDate: "2024-12-01", paidDate: "2024-12-01", status: "paid", createdAt: "2024-12-01T00:00:00Z" },
  { id: "pay-2", orgId: "org-1", tenantId: "tenant-2", leaseId: "lease-2", unitId: "unit-2", propertyId: "prop-1", type: "rent", amount: 1400, dueDate: "2024-12-01", paidDate: "2024-12-03", status: "paid", createdAt: "2024-12-01T00:00:00Z" },
  { id: "pay-3", orgId: "org-1", tenantId: "tenant-3", leaseId: "lease-3", unitId: "unit-8", propertyId: "prop-2", type: "rent", amount: 2800, dueDate: "2024-12-01", paidDate: "2024-12-01", status: "paid", createdAt: "2024-12-01T00:00:00Z" },
  { id: "pay-4", orgId: "org-1", tenantId: "tenant-4", leaseId: "lease-4", unitId: "unit-10", propertyId: "prop-3", type: "rent", amount: 1200, dueDate: "2024-12-01", status: "pending", createdAt: "2024-12-01T00:00:00Z" },
];

export const mockDashboardStats: DashboardStats = {
  totalProperties: 4,
  totalUnits: 58,
  occupiedUnits: 49,
  occupancyRate: 84.5,
  monthlyRevenue: 89250,
  pendingMaintenance: 3,
  activeApplications: 2,
  expiringLeases: 5,
  vacantUnits: 9,
  revenueHistory: [
    { month: "Jul", revenue: 82000, expenses: 18500 },
    { month: "Aug", revenue: 84500, expenses: 15200 },
    { month: "Sep", revenue: 91000, expenses: 22100 },
    { month: "Oct", revenue: 89000, expenses: 16800 },
    { month: "Nov", revenue: 88500, expenses: 19400 },
    { month: "Dec", revenue: 89250, expenses: 17300 },
  ],
};

export const mockListings: Listing[] = [
  {
    id: "listing-1", orgId: "org-1", unitId: "unit-3", propertyId: "prop-1",
    title: "Bright 2BR/2BA near UC Davis — Walk to Campus!",
    description: "Spacious 2-bedroom, 2-bathroom apartment just minutes from UC Davis campus. Features include a private balcony, walk-in closet, and in-building laundry. University Commons offers a pool, gym, and bike storage. Available January 15th — perfect for the spring semester!",
    photos: [], rent: 2100, availableDate: "2025-01-15",
    syndicatedTo: ["zillow", "apartments.com"],
    socialPosts: [
      { platform: "instagram", postId: "ig-123", url: "https://instagram.com/p/123", postedAt: "2024-12-12T10:00:00Z" },
      { platform: "facebook", postId: "fb-456", url: "https://facebook.com/post/456", postedAt: "2024-12-12T10:30:00Z" },
    ],
    leads: [
      { name: "Alex Turner", email: "alex.t@gmail.com", phone: "(916) 555-0301", source: "instagram", createdAt: "2024-12-13T09:00:00Z" },
      { name: "Morgan Lee", email: "morgan.lee@ucdavis.edu", source: "apartments.com", createdAt: "2024-12-14T14:00:00Z" },
      { name: "Jordan Park", email: "j.park@yahoo.com", phone: "(530) 555-0402", source: "direct", createdAt: "2024-12-15T11:30:00Z" },
    ],
    status: "active", createdAt: "2024-12-10T00:00:00Z", updatedAt: "2024-12-15T11:30:00Z",
  },
  {
    id: "listing-2", orgId: "org-1", unitId: "unit-8", propertyId: "prop-2",
    title: "Spacious 4BR House with Pool — Aggie Square",
    description: "Beautiful 4-bedroom, 2-bathroom single family home in a quiet Davis neighborhood. Features include a private backyard with pool, 2-car garage, and central AC. Pet-friendly! Available February 1st.",
    photos: [], rent: 3200, availableDate: "2025-02-01",
    syndicatedTo: ["craigslist"],
    socialPosts: [],
    leads: [
      { name: "Taylor Swift", email: "t.swift@gmail.com", source: "craigslist", createdAt: "2024-12-16T08:00:00Z" },
    ],
    status: "active", createdAt: "2024-12-14T00:00:00Z", updatedAt: "2024-12-16T08:00:00Z",
  },
  {
    id: "listing-3", orgId: "org-1", unitId: "unit-9", propertyId: "prop-3",
    title: "Modern Studio Downtown Davis — Smart Lock Entry",
    description: "Sleek studio apartment in the heart of downtown Davis. Smart lock entry, EV charging, and rooftop deck access included. Walking distance to restaurants, shops, and the Amtrak station.",
    photos: [], rent: 1200, availableDate: "2024-11-01",
    syndicatedTo: ["zillow", "apartments.com", "craigslist"],
    socialPosts: [
      { platform: "instagram", postId: "ig-789", url: "https://instagram.com/p/789", postedAt: "2024-10-20T15:00:00Z" },
    ],
    leads: [],
    status: "filled", createdAt: "2024-10-15T00:00:00Z", updatedAt: "2024-11-01T00:00:00Z",
  },
];

export const mockSublets: Sublet[] = [
  {
    id: "sublet-1", orgId: "org-1", tenantId: "tenant-1", unitId: "unit-1", propertyId: "prop-1", leaseId: "lease-1",
    status: "active",
    title: "2BR near campus — Summer sublet (Jun–Aug)",
    description: "I'm studying abroad this summer! Fully furnished 2BR/1BA in University Commons. Pool, gym, bike storage. Perfect for summer interns or visiting researchers.",
    photos: [], monthlyRent: 1500, startDate: "2025-06-15", endDate: "2025-08-31",
    reason: "Study abroad — Barcelona",
    guestInfo: { name: "Kai Nakamura", email: "kai.n@berkeley.edu", university: "UC Berkeley", notes: "Summer research intern at UC Davis" },
    applicationIds: [], createdAt: "2025-04-01T00:00:00Z", updatedAt: "2025-05-15T00:00:00Z",
  },
  {
    id: "sublet-2", orgId: "org-1", tenantId: "tenant-3", unitId: "unit-5", propertyId: "prop-1",
    status: "draft",
    title: "1BR apt — Available July only",
    description: "Cozy 1BR apartment in University Commons. Walking distance to campus. Shared laundry, parking available.",
    photos: [], monthlyRent: 1100, startDate: "2025-07-01", endDate: "2025-07-31",
    reason: "Visiting family",
    applicationIds: [], createdAt: "2025-04-10T00:00:00Z", updatedAt: "2025-04-10T00:00:00Z",
  },
  {
    id: "sublet-3", orgId: "org-1", tenantId: "tenant-5", unitId: "unit-9", propertyId: "prop-3",
    status: "completed",
    title: "Downtown studio — Summer 2024 sublet",
    description: "Smart-lock studio in Downtown Davis Studios. Rooftop deck and EV charging included.",
    photos: [], monthlyRent: 1000, startDate: "2024-06-15", endDate: "2024-08-31",
    reason: "Internship in SF",
    guestInfo: { name: "Emma Wilson", email: "emma.w@stanford.edu", university: "Stanford", notes: "Completed. Great tenant!" },
    applicationIds: [], createdAt: "2024-05-01T00:00:00Z", updatedAt: "2024-09-01T00:00:00Z",
  },
];

export const mockVendors: Vendor[] = [
  {
    id: "vendor-1", orgId: "org-1", name: "Mike Rodriguez", company: "Davis Plumbing Pros",
    specialty: ["plumbing"], phone: "(530) 555-0101", email: "mike@davisplumbing.com",
    rating: 4.8, completedJobs: 47, avgCost: 285, hourlyRate: 85, status: "active",
    insuranceExpiry: "2026-12-31", licenseNumber: "PL-29481", serviceArea: "Davis / Woodland / Sacramento",
    availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], createdAt: "2024-01-15T00:00:00Z",
  },
  {
    id: "vendor-2", orgId: "org-1", name: "Sarah Kim", company: "Kim Electric",
    specialty: ["electrical"], phone: "(530) 555-0202", email: "sarah@kimelectric.com",
    rating: 4.6, completedJobs: 32, avgCost: 340, hourlyRate: 95, status: "active",
    insuranceExpiry: "2026-06-30", licenseNumber: "EL-88123", serviceArea: "Yolo County",
    availableDays: ["Mon", "Wed", "Fri", "Sat"], createdAt: "2024-02-10T00:00:00Z",
  },
  {
    id: "vendor-3", orgId: "org-1", name: "James Chen", company: "Central Valley HVAC",
    specialty: ["hvac", "electrical"], phone: "(530) 555-0303", email: "james@cvhvac.com",
    rating: 4.9, completedJobs: 61, avgCost: 420, hourlyRate: 110, status: "active",
    insuranceExpiry: "2027-03-15", licenseNumber: "HVAC-40192", serviceArea: "Davis / Sacramento metro",
    availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], createdAt: "2023-11-01T00:00:00Z",
  },
  {
    id: "vendor-4", orgId: "org-1", name: "Tom Patterson", company: "Tom's Handyman Services",
    specialty: ["appliance", "structural", "cleaning", "other"], phone: "(530) 555-0404", email: "tom@tomshandyman.com",
    rating: 4.3, completedJobs: 89, avgCost: 195, hourlyRate: 65, status: "active",
    insuranceExpiry: "2026-09-30", licenseNumber: "GC-55678", serviceArea: "Davis",
    availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], createdAt: "2023-08-20T00:00:00Z",
  },
];

export const mockWorkOrders: WorkOrder[] = [
  {
    id: "wo-1", orgId: "org-1", maintenanceRequestId: "maint-1", vendorId: "vendor-1",
    unitId: "unit-2", propertyId: "prop-1", status: "in_progress",
    scheduledDate: "2025-01-20", acceptedAt: "2025-01-18T10:00:00Z", startedAt: "2025-01-20T09:00:00Z",
    completionPhotos: [], receiptPhotos: [], vendorNotes: "Found corroded pipe under sink, replacing section",
    accessInstructions: "Ring unit 2B buzzer. Tenant works from home.",
    createdAt: "2025-01-17T00:00:00Z", updatedAt: "2025-01-20T09:00:00Z",
  },
  {
    id: "wo-2", orgId: "org-1", maintenanceRequestId: "maint-2", vendorId: "vendor-2",
    unitId: "unit-5", propertyId: "prop-2", status: "pending_approval",
    scheduledDate: "2025-01-15", acceptedAt: "2025-01-14T08:00:00Z", startedAt: "2025-01-15T10:00:00Z",
    completedAt: "2025-01-15T14:30:00Z",
    laborHours: 4.5, laborCost: 427.50, materialsCost: 85, totalCost: 512.50,
    completionPhotos: [], receiptPhotos: [], vendorNotes: "Replaced GFCI outlet and tested all circuits. Found minor wiring issue in adjacent outlet — fixed.",
    accessInstructions: "Gate code 4521. Unit is on 2nd floor.",
    createdAt: "2025-01-13T00:00:00Z", updatedAt: "2025-01-15T14:30:00Z",
  },
  {
    id: "wo-3", orgId: "org-1", maintenanceRequestId: "maint-3", vendorId: "vendor-3",
    unitId: "unit-1", propertyId: "prop-1", status: "approved",
    scheduledDate: "2025-01-10", acceptedAt: "2025-01-09T09:00:00Z", startedAt: "2025-01-10T08:00:00Z",
    completedAt: "2025-01-10T12:00:00Z", approvedAt: "2025-01-11T10:00:00Z",
    laborHours: 4, laborCost: 440, materialsCost: 120, totalCost: 560,
    completionPhotos: [], receiptPhotos: [], vendorNotes: "Replaced compressor capacitor and recharged refrigerant. System running at spec.",
    managerApproval: { approved: true, approvedBy: "user-1", approvedAt: "2025-01-11T10:00:00Z", notes: "Good work. Invoice matches estimate." },
    createdAt: "2025-01-08T00:00:00Z", updatedAt: "2025-01-11T10:00:00Z",
  },
];

export const mockNotifications: Notification[] = [
  {
    id: "notif-1", orgId: "org-1", kind: "payment_failed", audience: "manager",
    title: "Rent payment failed",
    body: "James Rodriguez's $1,400 rent payment was declined — card was declined.",
    href: "/financials", read: false, createdAt: "2025-01-12T09:14:00Z",
  },
  {
    id: "notif-2", orgId: "org-1", kind: "maintenance_urgent", audience: "manager",
    title: "Urgent maintenance request",
    body: "No hot water reported at Unit 102 — marked urgent.",
    href: "/maintenance", read: false, createdAt: "2025-01-11T16:02:00Z",
  },
  {
    id: "notif-3", orgId: "org-1", kind: "payment_received", audience: "manager",
    title: "Rent received",
    body: "Sarah Chen paid $1,800 for Unit 101.",
    href: "/financials", read: true, createdAt: "2025-01-01T08:30:00Z",
  },
];

export const mockInspections: Inspection[] = [
  {
    id: "insp-1", orgId: "org-1", unitId: "unit-3", propertyId: "prop-1",
    type: "turnover", status: "scheduled", scheduledFor: "2025-01-20T10:00:00Z",
    inspectorName: "Davis Housing Services",
    areas: [], createdAt: "2025-01-10T00:00:00Z", updatedAt: "2025-01-10T00:00:00Z",
  },
  {
    id: "insp-2", orgId: "org-1", unitId: "unit-1", propertyId: "prop-1",
    leaseId: "lease-1", tenantId: "tenant-1",
    type: "move_in", status: "completed",
    scheduledFor: "2024-09-01T09:00:00Z", completedAt: "2024-09-01T10:30:00Z",
    inspectorName: "Davis Housing Services",
    areas: [
      { name: "Kitchen", condition: "excellent", notes: "New appliances, no marks.", photos: [] },
      { name: "Bathroom", condition: "good", notes: "Minor grout wear around tub.", photos: [] },
      { name: "Bedroom 1", condition: "excellent", photos: [] },
      { name: "Living Room", condition: "good", notes: "Small scuff by the door frame.", photos: [] },
    ],
    summary: "Unit in very good condition at move-in. Scuff noted and photographed.",
    createdAt: "2024-08-28T00:00:00Z", updatedAt: "2024-09-01T10:30:00Z",
  },
  {
    id: "insp-3", orgId: "org-1", unitId: "unit-6", propertyId: "prop-1",
    type: "move_out", status: "in_progress", scheduledFor: "2025-01-14T14:00:00Z",
    inspectorName: "Davis Housing Services",
    areas: [
      { name: "Kitchen", condition: "fair", notes: "Burn mark on countertop.", photos: [], estimatedCost: 180 },
      { name: "Carpet", condition: "poor", notes: "Staining in living area — needs professional clean.", photos: [], estimatedCost: 250 },
    ],
    depositDeduction: 430,
    createdAt: "2025-01-05T00:00:00Z", updatedAt: "2025-01-14T14:45:00Z",
  },
];

export const mockKeys: KeyRecord[] = [
  { id: "key-1", orgId: "org-1", unitId: "unit-1", propertyId: "prop-1", label: "Front door — Key A", kind: "physical", copies: 2, status: "issued", holderType: "tenant", holderId: "tenant-1", holderName: "Sarah Chen", issuedAt: "2024-09-01T00:00:00Z", createdAt: "2024-08-15T00:00:00Z", updatedAt: "2024-09-01T00:00:00Z" },
  { id: "key-2", orgId: "org-1", unitId: "unit-1", propertyId: "prop-1", label: "Mailbox 101", kind: "mailbox", copies: 1, status: "issued", holderType: "tenant", holderId: "tenant-1", holderName: "Sarah Chen", issuedAt: "2024-09-01T00:00:00Z", createdAt: "2024-08-15T00:00:00Z", updatedAt: "2024-09-01T00:00:00Z" },
  { id: "key-3", orgId: "org-1", unitId: "unit-3", propertyId: "prop-1", label: "Front door — Key A", kind: "physical", copies: 3, status: "available", createdAt: "2024-08-15T00:00:00Z", updatedAt: "2024-12-01T00:00:00Z" },
  { id: "key-4", orgId: "org-1", unitId: "unit-9", propertyId: "prop-3", label: "Smart lock code", kind: "smart_lock", copies: 1, status: "issued", holderType: "tenant", holderId: "tenant-5", holderName: "Yuki Tanaka", issuedAt: "2024-09-15T00:00:00Z", notes: "Code rotates at each turnover.", createdAt: "2024-09-01T00:00:00Z", updatedAt: "2024-09-15T00:00:00Z" },
  { id: "key-5", orgId: "org-1", unitId: "unit-2", propertyId: "prop-1", label: "Front door — spare", kind: "physical", copies: 1, status: "lost", notes: "Reported lost by tenant Nov 2024 — lock changed.", createdAt: "2024-06-01T00:00:00Z", updatedAt: "2024-11-12T00:00:00Z" },
];

export const mockLockChanges: LockChange[] = [
  { id: "lock-1", orgId: "org-1", unitId: "unit-2", propertyId: "prop-1", changedAt: "2024-11-12T00:00:00Z", reason: "lost_key", vendorId: "vendor-1", cost: 145, notes: "Rekeyed after tenant reported a lost key. Two new copies cut.", createdAt: "2024-11-12T00:00:00Z" },
  { id: "lock-2", orgId: "org-1", unitId: "unit-3", propertyId: "prop-1", changedAt: "2024-12-01T00:00:00Z", reason: "turnover", cost: 95, notes: "Standard rekey between tenancies.", createdAt: "2024-12-01T00:00:00Z" },
];

export const mockUnitNotes: UnitNote[] = [
  { id: "note-1", orgId: "org-1", unitId: "unit-1", propertyId: "prop-1", tenantId: "tenant-1", kind: "call", body: "Sarah called about the kitchen sink leak. Advised a plumber would be assigned within 24h.", authorId: "user-1", authorName: "Davis Housing Services", pinned: false, createdAt: "2024-12-08T11:00:00Z" },
  { id: "note-2", orgId: "org-1", unitId: "unit-1", propertyId: "prop-1", kind: "note", body: "Dishwasher is out of warranty as of Jan 2025 — budget for replacement at next turnover.", authorId: "user-1", authorName: "Davis Housing Services", pinned: true, createdAt: "2024-12-15T09:30:00Z" },
  { id: "note-3", orgId: "org-1", unitId: "unit-2", propertyId: "prop-1", tenantId: "tenant-2", kind: "complaint", body: "Noise complaint from Unit 103 about late-night music. Spoke with James, resolved amicably.", authorId: "user-1", authorName: "Davis Housing Services", pinned: false, createdAt: "2024-11-20T20:15:00Z" },
  { id: "note-4", orgId: "org-1", unitId: "unit-3", propertyId: "prop-1", kind: "visit", body: "Walked the unit with a prospective tenant. Positive feedback, concerned about parking.", authorId: "user-1", authorName: "Davis Housing Services", pinned: false, createdAt: "2025-01-06T15:00:00Z" },
];

export const mockCalendarEvents: CalendarEvent[] = [
  { id: "cal-1", orgId: "org-1", type: "showing", title: "Showing — Unit 103", start: "2025-01-16T15:00:00Z", end: "2025-01-16T15:30:00Z", allDay: false, status: "scheduled", unitId: "unit-3", propertyId: "prop-1", notes: "Prospect: Emily Davis", createdAt: "2025-01-10T00:00:00Z", updatedAt: "2025-01-10T00:00:00Z" },
  { id: "cal-2", orgId: "org-1", type: "inspection", title: "Turnover inspection — Unit 103", start: "2025-01-20T10:00:00Z", end: "2025-01-20T11:00:00Z", allDay: false, status: "scheduled", unitId: "unit-3", propertyId: "prop-1", relatedId: "insp-1", createdAt: "2025-01-10T00:00:00Z", updatedAt: "2025-01-10T00:00:00Z" },
  { id: "cal-3", orgId: "org-1", type: "move_out", title: "Move-out — Unit 203", start: "2025-01-14T09:00:00Z", allDay: true, status: "scheduled", unitId: "unit-6", propertyId: "prop-1", createdAt: "2025-01-02T00:00:00Z", updatedAt: "2025-01-02T00:00:00Z" },
  { id: "cal-4", orgId: "org-1", type: "maintenance", title: "Plumber — kitchen sink, Unit 101", start: "2025-01-15T13:00:00Z", end: "2025-01-15T15:00:00Z", allDay: false, status: "scheduled", unitId: "unit-1", propertyId: "prop-1", vendorId: "vendor-1", relatedId: "maint-1", createdAt: "2025-01-09T00:00:00Z", updatedAt: "2025-01-09T00:00:00Z" },
  { id: "cal-5", orgId: "org-1", type: "move_in", title: "Move-in — Unit 102 (new tenant)", start: "2025-02-01T09:00:00Z", allDay: true, status: "scheduled", unitId: "unit-2", propertyId: "prop-1", createdAt: "2025-01-08T00:00:00Z", updatedAt: "2025-01-08T00:00:00Z" },
];
