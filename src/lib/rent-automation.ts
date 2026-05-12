/**
 * Rent Automation Service
 * Late fee calculation, rent roll generation, payment reminders.
 * In production, these would run as scheduled Cloud Functions.
 */

import type { Lease, Unit, Tenant, Transaction, PaymentRecord } from "./types";
import { addDays, isAfter, isBefore, parseISO, format, startOfMonth, endOfMonth } from "date-fns";

// Default policy
const DEFAULT_LATE_FEE_PERCENT = 5;
const DEFAULT_GRACE_PERIOD_DAYS = 5;

/**
 * Determine if rent is overdue for a given lease and month.
 */
export function isRentOverdue(
  lease: Lease,
  payments: PaymentRecord[],
  referenceDate: Date = new Date()
): { overdue: boolean; daysPastDue: number; lateFeeAmount: number } {
  const dueDate = startOfMonth(referenceDate); // rent due on 1st
  const gracePeriod = lease.gracePeriodDays || DEFAULT_GRACE_PERIOD_DAYS;
  const graceCutoff = addDays(dueDate, gracePeriod);
  const monthKey = format(dueDate, "yyyy-MM");

  // Check if rent was paid this month
  const monthPayment = payments.find(
    (p) => p.leaseId === lease.id && p.type === "rent" && p.status === "paid" && p.paidDate && format(parseISO(p.paidDate), "yyyy-MM") === monthKey
  );

  if (monthPayment) {
    return { overdue: false, daysPastDue: 0, lateFeeAmount: 0 };
  }

  // Check if we're past grace period
  if (isAfter(referenceDate, graceCutoff)) {
    const daysPastDue = Math.floor((referenceDate.getTime() - graceCutoff.getTime()) / (1000 * 60 * 60 * 24));
    const lateFeePercent = lease.lateFeePercent || DEFAULT_LATE_FEE_PERCENT;
    const lateFeeAmount = Math.round(lease.rentAmount * (lateFeePercent / 100) * 100) / 100;
    return { overdue: true, daysPastDue, lateFeeAmount };
  }

  return { overdue: false, daysPastDue: 0, lateFeeAmount: 0 };
}

/**
 * Generate a rent roll for a given org and month.
 * Returns status for each active lease.
 */
export interface RentRollEntry {
  leaseId: string;
  tenantIds: string[];
  unitId: string;
  propertyId: string;
  rentAmount: number;
  status: "paid" | "pending" | "overdue" | "partial";
  paidAmount: number;
  dueDate: string;
  paidDate?: string;
  lateFee: number;
  totalDue: number;
}

export function generateRentRoll(
  leases: Lease[],
  payments: PaymentRecord[],
  month: Date = new Date()
): RentRollEntry[] {
  const monthStart = startOfMonth(month);
  const monthKey = format(monthStart, "yyyy-MM");

  return leases
    .filter((l) => l.status === "active" || l.status === "month_to_month")
    .map((lease) => {
      const monthPayments = payments.filter(
        (p) => p.leaseId === lease.id && p.type === "rent" && format(parseISO(p.dueDate), "yyyy-MM") === monthKey
      );
      const paidAmount = monthPayments
        .filter((p) => p.status === "paid")
        .reduce((s, p) => s + p.amount, 0);

      const { overdue, lateFeeAmount } = isRentOverdue(lease, payments, month);
      const totalDue = lease.rentAmount + lateFeeAmount;

      let status: RentRollEntry["status"] = "pending";
      if (paidAmount >= lease.rentAmount) status = "paid";
      else if (paidAmount > 0) status = "partial";
      else if (overdue) status = "overdue";

      return {
        leaseId: lease.id,
        tenantIds: lease.tenantIds,
        unitId: lease.unitId,
        propertyId: lease.propertyId,
        rentAmount: lease.rentAmount,
        status,
        paidAmount,
        dueDate: format(monthStart, "yyyy-MM-dd"),
        paidDate: monthPayments.find((p) => p.status === "paid")?.paidDate,
        lateFee: overdue ? lateFeeAmount : 0,
        totalDue,
      };
    });
}

/**
 * Check for leases expiring within N days and return them.
 */
export function getExpiringLeases(leases: Lease[], withinDays = 30): Lease[] {
  const cutoff = addDays(new Date(), withinDays);
  return leases.filter(
    (l) => (l.status === "active" || l.status === "month_to_month") && isBefore(parseISO(l.endDate), cutoff)
  );
}

/**
 * Calculate monthly summary stats from transactions.
 */
export function calculateMonthlyFinancials(
  transactions: Transaction[],
  month: Date = new Date()
) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const monthKey = format(monthStart, "yyyy-MM");

  const monthTxns = transactions.filter(
    (t) => t.status === "completed" && format(parseISO(t.date), "yyyy-MM") === monthKey
  );

  const revenue = monthTxns
    .filter((t) => ["rent", "deposit", "fee", "late_fee"].includes(t.type))
    .reduce((s, t) => s + t.amount, 0);

  const expenses = monthTxns
    .filter((t) => ["maintenance", "refund", "other"].includes(t.type))
    .reduce((s, t) => s + t.amount, 0);

  return {
    month: format(monthStart, "MMM yyyy"),
    revenue,
    expenses,
    net: revenue - expenses,
    transactionCount: monthTxns.length,
  };
}
