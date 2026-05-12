/**
 * Mock Screening Service
 * Simulates credit checks, background checks, and application scoring.
 * Replace with TransUnion SmartMove / Certn API in production.
 */

import type { RentalApplication, ScreeningResult } from "./types";

// Generate a realistic credit score distribution (skewed toward 650-750)
function generateCreditScore(): number {
  const base = 580;
  const range = 240; // 580-820
  // Bell curve approximation
  const r1 = Math.random();
  const r2 = Math.random();
  const gaussian = Math.sqrt(-2 * Math.log(r1)) * Math.cos(2 * Math.PI * r2);
  const normalized = (gaussian + 3) / 6; // normalize to ~0-1
  return Math.max(base, Math.min(base + range, Math.round(base + range * normalized)));
}

function getCreditGrade(score: number): ScreeningResult["creditGrade"] {
  if (score >= 750) return "excellent";
  if (score >= 700) return "good";
  if (score >= 650) return "fair";
  return "poor";
}

function generateBackgroundFlags(): string[] {
  const possibleFlags = [
    "Minor traffic violation (2021)",
    "Noise complaint (resolved)",
    "Previous landlord dispute (settled)",
  ];
  // 85% chance of clean record
  if (Math.random() < 0.85) return [];
  const count = Math.random() < 0.7 ? 1 : 2;
  const shuffled = [...possibleFlags].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Run a simulated screening on a rental application.
 * Returns after a mock "processing" delay.
 */
export async function runScreening(
  application: RentalApplication,
  monthlyRent: number
): Promise<ScreeningResult> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000));

  const creditScore = generateCreditScore();
  const creditGrade = getCreditGrade(creditScore);
  const backgroundFlags = generateBackgroundFlags();
  const backgroundClear = backgroundFlags.length === 0;
  const evictionHistory = Math.random() < 0.05; // 5% chance
  const incomeToRentRatio = monthlyRent > 0 ? application.applicant.income / 12 / monthlyRent : 0;

  // Weighted scoring algorithm:
  // 40% credit, 25% income, 20% background, 15% references
  const creditPoints = Math.min(40, Math.round((creditScore - 500) / 320 * 40));
  const incomePoints = Math.min(25, incomeToRentRatio >= 3 ? 25 : incomeToRentRatio >= 2.5 ? 20 : incomeToRentRatio >= 2 ? 12 : 5);
  const backgroundPoints = backgroundClear && !evictionHistory ? 20 : evictionHistory ? 0 : 10;
  const refCount = application.references?.filter(r => r.status === "responded").length || 0;
  const referencePoints = Math.min(15, refCount * 5);
  const overallScore = creditPoints + incomePoints + backgroundPoints + referencePoints;

  let recommendation: ScreeningResult["recommendation"] = "approve";
  if (overallScore < 40 || evictionHistory || creditScore < 600) {
    recommendation = "deny";
  } else if (overallScore < 65 || creditScore < 650) {
    recommendation = "conditional";
  }

  return {
    creditScore,
    creditGrade,
    backgroundClear,
    backgroundFlags,
    evictionHistory,
    incomeToRentRatio: Math.round(incomeToRentRatio * 10) / 10,
    overallScore,
    recommendation,
    reportDate: new Date().toISOString(),
  };
}

/**
 * Score label & color helper for UI
 */
export function getScoreInfo(score: number) {
  if (score >= 80) return { label: "Strong", color: "text-emerald-400", bg: "bg-emerald-500/15" };
  if (score >= 65) return { label: "Acceptable", color: "text-blue-400", bg: "bg-blue-500/15" };
  if (score >= 40) return { label: "Conditional", color: "text-amber-400", bg: "bg-amber-500/15" };
  return { label: "High Risk", color: "text-red-400", bg: "bg-red-500/15" };
}

export function getCreditScoreColor(score: number) {
  if (score >= 750) return "text-emerald-400";
  if (score >= 700) return "text-blue-400";
  if (score >= 650) return "text-amber-400";
  return "text-red-400";
}
