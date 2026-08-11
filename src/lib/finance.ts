import type { Transaction } from "./types";

/**
 * Turning recorded transactions into the revenue chart.
 *
 * The dashboard and the financials page both drew this chart from
 * mockDashboardStats.revenueHistory — the same six invented months for every
 * organization, including one that had just been created and had no money
 * either way. A landlord looking at their own dashboard was being shown
 * somebody else's numbers, with a hardcoded expenses figure subtracted from
 * their real rent to produce the "net".
 *
 * Only completed transactions count. Pending and failed ones are not income —
 * booking a declined card as revenue is how a rent roll starts lying — and
 * refunded ones are cancelled by the refund transaction that accompanies them.
 */

/** Money in. Matches the classification used on the financials page. */
export const REVENUE_TYPES: Transaction["type"][] = ["rent", "deposit", "fee", "late_fee"];

/** Money out. Anything else ("other") is left out of both rather than guessed at. */
export const EXPENSE_TYPES: Transaction["type"][] = ["maintenance", "refund"];

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export interface MonthlyRevenue {
  /** "2026-08" — sortable, and what transactions are bucketed by. */
  key: string;
  /** "Aug" — the axis label. */
  month: string;
  revenue: number;
  expenses: number;
}

/**
 * The last `months` calendar months, oldest first, ending with the current one.
 *
 * Months with no activity are included and come back as zeroes: a gap in the
 * chart is information, and dropping empty months would silently compress the
 * axis so two years of nothing looked like steady business.
 */
export function buildRevenueHistory(
  transactions: Transaction[],
  months = 6,
  now: Date = new Date()
): MonthlyRevenue[] {
  const buckets = new Map<string, MonthlyRevenue>();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, { key, month: MONTH_LABELS[d.getMonth()], revenue: 0, expenses: 0 });
  }

  for (const txn of transactions) {
    if (txn.status !== "completed") continue;

    // Bucketed on the ISO string's own YYYY-MM rather than by parsing it into a
    // Date: parsing shifts a payment made late on the 31st into the next month
    // for anyone west of UTC.
    const key = (txn.date ?? "").slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;

    const amount = Number(txn.amount) || 0;
    if (REVENUE_TYPES.includes(txn.type)) bucket.revenue += amount;
    else if (EXPENSE_TYPES.includes(txn.type)) bucket.expenses += amount;
  }

  return [...buckets.values()];
}

/** Totals across a history, for the "net" line under the chart. */
export function summariseRevenue(history: MonthlyRevenue[]): {
  revenue: number;
  expenses: number;
  net: number;
} {
  const revenue = history.reduce((sum, m) => sum + m.revenue, 0);
  const expenses = history.reduce((sum, m) => sum + m.expenses, 0);
  return { revenue, expenses, net: revenue - expenses };
}

/** True when there is nothing to draw — the caller should say so rather than render an empty chart. */
export function isEmptyHistory(history: MonthlyRevenue[]): boolean {
  return history.every((m) => m.revenue === 0 && m.expenses === 0);
}
