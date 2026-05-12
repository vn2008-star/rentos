/**
 * Mock Reference Check Service
 * Simulates sending reference request emails and recording responses.
 * Replace with SendGrid integration in production.
 */

import type { RentalApplication } from "./types";

export interface ReferenceResponse {
  wouldRentAgain: boolean;
  onTimePayment: "always" | "usually" | "sometimes" | "rarely";
  propertyCondition: "excellent" | "good" | "fair" | "poor";
  complaints: boolean;
  notes: string;
}

const mockResponses: ReferenceResponse[] = [
  { wouldRentAgain: true, onTimePayment: "always", propertyCondition: "excellent", complaints: false, notes: "Excellent tenant, always paid on time. Kept the unit in great condition." },
  { wouldRentAgain: true, onTimePayment: "usually", propertyCondition: "good", complaints: false, notes: "Good tenant overall. Had one late payment but communicated in advance." },
  { wouldRentAgain: true, onTimePayment: "always", propertyCondition: "good", complaints: false, notes: "No issues at all. Quiet, respectful, and responsible." },
  { wouldRentAgain: false, onTimePayment: "sometimes", propertyCondition: "fair", complaints: true, notes: "Multiple noise complaints from neighbors. Paid rent late twice." },
  { wouldRentAgain: true, onTimePayment: "usually", propertyCondition: "excellent", complaints: false, notes: "Great communicator. Made minor improvements to the unit." },
];

/**
 * Simulate sending a reference check email.
 * In production, this would call SendGrid API.
 */
export async function sendReferenceRequest(
  applicationId: string,
  reference: RentalApplication["references"][0]
): Promise<{ sent: boolean; message: string }> {
  // Simulate email send delay
  await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));

  return {
    sent: true,
    message: `Reference request sent to ${reference.email} (${reference.name})`,
  };
}

/**
 * Simulate receiving a reference response.
 * Returns a mock response after a delay.
 */
export async function simulateReferenceResponse(): Promise<ReferenceResponse> {
  await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400));
  return mockResponses[Math.floor(Math.random() * mockResponses.length)];
}

/**
 * Score a reference response (0-15 points, matching screening.ts weight).
 */
export function scoreReference(response: ReferenceResponse): number {
  let score = 0;
  if (response.wouldRentAgain) score += 5;
  if (response.onTimePayment === "always") score += 4;
  else if (response.onTimePayment === "usually") score += 3;
  else if (response.onTimePayment === "sometimes") score += 1;
  if (response.propertyCondition === "excellent") score += 4;
  else if (response.propertyCondition === "good") score += 3;
  else if (response.propertyCondition === "fair") score += 1;
  if (!response.complaints) score += 2;
  return Math.min(15, score);
}
