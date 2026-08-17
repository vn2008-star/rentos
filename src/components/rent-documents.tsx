"use client";

import React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { skippedDays } from "@/lib/rent-notices";
import type { PayOrQuitNotice, RentReceipt } from "@/lib/types";

/**
 * The two documents a tenant is actually handed.
 *
 * Rendered as pages rather than screens: black on white, no chrome, sized for
 * paper, because both of these end up printed, photographed or attached to
 * something. The print stylesheet in globals.css hides everything except
 * `.print-document`, so Ctrl-P produces the document alone.
 */

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD" });

const longDate = (isoDate: string) => {
  if (!isoDate) return "—";
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? isoDate
    : d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};

const monthName = (period: string) => {
  const d = new Date(`${period}-01T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? period
    : d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
};

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button variant="outline" size="sm" className="gap-1.5 no-print" onClick={() => window.print()}>
      <Printer className="h-4 w-4" /> {label}
    </Button>
  );
}

export function ReceiptDocument({ receipt }: { receipt: RentReceipt }) {
  return (
    <div className="print-document rounded-lg bg-white p-8 text-black">
      <div className="flex items-start justify-between border-b border-black/20 pb-4">
        <div>
          <h1 className="text-2xl font-bold">Rent receipt</h1>
          <p className="text-sm text-black/60">Receipt no. {receipt.number}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">{receipt.landlordName || receipt.issuedBy}</p>
          <p className="text-black/60">Issued {longDate(receipt.issuedAt.slice(0, 10))}</p>
        </div>
      </div>

      <table className="mt-6 w-full text-sm">
        <tbody>
          {[
            ["Received from", receipt.tenantName],
            ["For the premises", [receipt.unitLabel, receipt.propertyName].filter(Boolean).join(" · ")],
            ["Rent period", monthName(receipt.period)],
            ["Date paid", longDate(receipt.paidOn)],
            ["Method", receipt.method],
          ].map(([label, value]) => (
            <tr key={label as string} className="border-b border-black/10">
              <th className="py-2 text-left font-medium text-black/60">{label}</th>
              <td className="py-2 text-right">{value as string}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex items-baseline justify-between border-t-2 border-black pt-4">
        <span className="text-lg font-semibold">Amount received</span>
        <span className="text-3xl font-bold">{money(receipt.amount)}</span>
      </div>

      <p className="mt-2 text-sm text-black/70">
        {receipt.balanceAfter > 0
          ? `${money(receipt.balanceAfter)} remains outstanding for ${monthName(receipt.period)}.`
          : `Rent for ${monthName(receipt.period)} is paid in full.`}
      </p>

      {receipt.notes && <p className="mt-4 text-sm text-black/70">{receipt.notes}</p>}

      <p className="mt-8 border-t border-black/10 pt-3 text-xs text-black/50">
        Issued under California Civil Code § 1499, which entitles a tenant to a receipt for
        payment. Keep this — it is your proof that the rent above was paid.
      </p>
    </div>
  );
}

export function NoticeDocument({ notice }: { notice: PayOrQuitNotice }) {
  const skipped = skippedDays(notice.servedOn, notice.deadline);

  return (
    <div className="print-document rounded-lg bg-white p-8 text-black">
      <h1 className="text-center text-xl font-bold uppercase tracking-wide">
        Three-day notice to pay rent or quit
      </h1>
      <p className="mt-1 text-center text-sm text-black/60">
        California Code of Civil Procedure § 1161(2)
      </p>

      <div className="mt-6 text-sm">
        <p className="font-semibold">To: {notice.tenantNames.join(", ")}, and all other occupants</p>
        <p>Of the premises at: {notice.unitAddress}</p>
      </div>

      <p className="mt-5 text-sm leading-relaxed">
        <strong>YOU ARE HEREBY NOTIFIED</strong> that rent is now due and unpaid on the premises
        described above, in the total amount of <strong>{money(notice.amountDemanded)}</strong>,
        for the rental periods set out below.
      </p>

      <table className="mt-4 w-full border border-black/20 text-sm">
        <thead>
          <tr className="border-b border-black/20 bg-black/5">
            <th className="p-2 text-left font-medium">Rental period</th>
            <th className="p-2 text-left font-medium">Fell due</th>
            <th className="p-2 text-right font-medium">Rent unpaid</th>
          </tr>
        </thead>
        <tbody>
          {notice.periods.map((p) => (
            <tr key={p.period} className="border-b border-black/10">
              <td className="p-2">{monthName(p.period)}</td>
              <td className="p-2">{longDate(p.dueDate)}</td>
              <td className="p-2 text-right">{money(p.owed)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-black font-semibold">
            <td className="p-2" colSpan={2}>Total rent demanded</td>
            <td className="p-2 text-right">{money(notice.amountDemanded)}</td>
          </tr>
        </tbody>
      </table>

      <p className="mt-4 text-sm leading-relaxed">
        This notice demands <strong>rent only</strong>. No late charge, utility charge, deposit or
        other sum is included in the amount above.
      </p>

      <p className="mt-4 text-sm leading-relaxed">
        <strong>YOU ARE REQUIRED</strong> to pay the sum of {money(notice.amountDemanded)} in full
        within <strong>three (3) days</strong> after service of this notice, not counting the day
        of service, Saturdays, Sundays or judicial holidays — that is,{" "}
        <strong>on or before {longDate(notice.deadline)}</strong> — or to deliver up possession of
        the premises. If you do neither, the landlord will institute legal proceedings against you
        to declare the forfeiture of your lease and to recover possession, rent and damages.
      </p>

      <div className="mt-5 border border-black/20 p-3 text-sm">
        <p className="font-semibold">Payment may be made to:</p>
        <p>{notice.payee.name}</p>
        <p>{notice.payee.address}</p>
        <p>Telephone: {notice.payee.phone}</p>
        {notice.payee.method === "in_person" && notice.payee.hours && (
          <p className="mt-1">Available to receive payment: {notice.payee.hours}</p>
        )}
        {notice.payee.method === "bank" && (
          <p className="mt-1">
            Or by deposit to {notice.payee.bankName}, account {notice.payee.accountNumber}.
          </p>
        )}
        {notice.payee.method === "electronic" && (
          <p className="mt-1">
            Or by the electronic method previously agreed with you: {notice.payee.electronicDescription}
          </p>
        )}
      </div>

      {skipped.length > 0 && (
        <p className="mt-4 text-xs text-black/60">
          Days not counted toward the three:{" "}
          {skipped.map((d) => `${longDate(d.date)} (${d.reason.toLowerCase()})`).join("; ")}.
        </p>
      )}

      <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
        <div>
          <p className="border-t border-black pt-1">Landlord or authorised agent</p>
          <p className="mt-1 font-medium">{notice.issuedBy}</p>
        </div>
        <div>
          <p className="border-t border-black pt-1">Date of service</p>
          <p className="mt-1 font-medium">{longDate(notice.servedOn)}</p>
        </div>
      </div>

      <p className="mt-3 text-sm">
        Served by:{" "}
        {notice.serviceMethod === "personal"
          ? "personal delivery to the tenant"
          : notice.serviceMethod === "substituted"
            ? "leaving a copy with a person of suitable age at the premises or place of business, and mailing a copy"
            : "posting a copy conspicuously on the premises and mailing a copy"}
        .
      </p>
    </div>
  );
}
