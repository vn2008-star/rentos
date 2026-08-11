import type { UserRole } from "./types";

/**
 * Role predicates shared by the browser and the server.
 *
 * These mirror isStaff() and isOwnerOrManager() in firestore.rules. The rules
 * are the enforcement; this is what the UI uses to avoid offering an action that
 * would only be denied. Keep the three lists in step — a UI that hides what the
 * rules allow is merely confusing, but one that offers what the rules deny sends
 * users into dead ends.
 */

export const STAFF_ROLES: UserRole[] = [
  "super_admin",
  "owner",
  "manager",
  "leasing_agent",
  "maintenance",
];

/** Roles that may spend money, change the plan, or add people. */
export const ADMIN_ROLES: UserRole[] = ["super_admin", "owner", "manager"];

/** Roles an org may invite. Tenants and contractors are linked to a record instead. */
export const INVITABLE_ROLES: UserRole[] = [
  "owner",
  "manager",
  "leasing_agent",
  "maintenance",
];

export function isStaffRole(role: UserRole | undefined | null): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

export function isOwnerOrManagerRole(role: UserRole | undefined | null): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "RentOS admin",
  owner: "Owner",
  manager: "Property manager",
  leasing_agent: "Leasing agent",
  maintenance: "Maintenance",
  contractor: "Contractor",
  tenant: "Tenant",
  guest: "Guest",
};
