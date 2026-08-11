/**
 * Firestore collection names.
 *
 * Deliberately a module with no imports of its own. It used to live in
 * firestore.ts, which pulls in the Firebase *client* SDK — and since every API
 * route needs these names, every API route was loading the browser auth stack
 * on the server to get them.
 *
 * That is wasted cold-start time on each route, and it is measured against a
 * hard limit: Firebase's deploy step loads the server bundle to discover its
 * exports and gives up after ten seconds, failing the whole deploy with
 * "Cannot determine backend specification". This file exists to keep server
 * code away from client code.
 */
export const Collections = {
  USERS: "users",
  ORGANIZATIONS: "organizations",
  INVITES: "invites",
  /** Live support-access grants, one per operator. The rules read these. */
  SUPPORT_SESSIONS: "support_sessions",
  /** Immutable record of who looked at whose data, when, and why. */
  SUPPORT_AUDIT: "support_audit",
  /** Bug reports and requests sent from inside the app. */
  FEEDBACK: "feedback",
  PROPERTIES: "properties",
  UNITS: "units",
  TENANTS: "tenants",
  LEASES: "leases",
  APPLICATIONS: "applications",
  MAINTENANCE: "maintenance",
  VENDORS: "vendors",
  TRANSACTIONS: "transactions",
  LISTINGS: "listings",
  SUBLETS: "sublets",
  WORK_ORDERS: "work_orders",
  NOTIFICATIONS: "notifications",
  INSPECTIONS: "inspections",
  KEYS: "keys",
  LOCK_CHANGES: "lock_changes",
  UNIT_NOTES: "unit_notes",
  CALENDAR_EVENTS: "calendar_events",
} as const;
