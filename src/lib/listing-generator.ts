// ============================================
// Listing Content Generator
// Auto-generates marketing-ready listing content
// ============================================

import type { Unit, Property, Listing, STRPricing } from "./types";

const DAVIS_HIGHLIGHTS = [
  "minutes from UC Davis campus",
  "walking distance to downtown",
  "close to Amtrak station",
  "in the heart of Aggie territory",
  "near the UC Davis Arboretum",
];

const LIFESTYLE_HOOKS: Record<string, string[]> = {
  apartment: ["Perfect for students and young professionals", "Urban living at its finest", "Your new home base in Davis"],
  single_family: ["Room to spread out", "Family-friendly living", "Space to call your own"],
  room: ["Affordable living in a great location", "Join a friendly household", "Budget-friendly campus living"],
  airbnb: ["Experience Davis like a local", "Your home away from home", "Short-term stays welcome"],
  condo: ["Modern condo living", "Low-maintenance luxury", "Community amenities included"],
  townhouse: ["Multi-level living space", "Townhouse charm in Davis", "Private entrance, community feel"],
};

/**
 * Generate a compelling listing title from unit + property data
 */
export function generateListingTitle(unit: Unit, property: Property): string {
  const bedLabel = unit.beds === 0 ? "Studio" : `${unit.beds}BR/${unit.baths}BA`;
  const highlights: string[] = [];

  if (property.amenities.some(a => a.toLowerCase().includes("pool"))) highlights.push("Pool");
  if (property.amenities.some(a => a.toLowerCase().includes("gym"))) highlights.push("Gym");
  if (property.amenities.some(a => a.toLowerCase().includes("parking"))) highlights.push("Parking");
  if (unit.amenities.some(a => a.toLowerCase().includes("balcony"))) highlights.push("Balcony");
  if (property.amenities.some(a => a.toLowerCase().includes("ev"))) highlights.push("EV Charging");

  const amenitySnippet = highlights.length > 0 ? ` w/ ${highlights.slice(0, 2).join(" & ")}` : "";
  const locationSnippet = property.address.city === "Davis" ? " — Walk to UC Davis!" : ` in ${property.address.city}`;

  return `${bedLabel}${amenitySnippet} at ${property.name}${locationSnippet}`;
}

/**
 * Generate a full marketing description
 */
export function generateListingDescription(unit: Unit, property: Property): string {
  const bedLabel = unit.beds === 0 ? "studio" : `${unit.beds}-bedroom, ${unit.baths}-bathroom`;
  const typeLabel = property.type.replace("_", " ");
  const hook = LIFESTYLE_HOOKS[property.type]?.[Math.floor(Math.random() * 3)] || "Welcome home";
  const locationHook = DAVIS_HIGHLIGHTS[Math.floor(Math.random() * DAVIS_HIGHLIGHTS.length)];

  const lines: string[] = [];

  // Opening
  lines.push(`${hook}! This ${bedLabel} ${typeLabel} is ${locationHook}.`);

  // Size & price
  lines.push(`At ${unit.sqft.toLocaleString()} sq ft and $${unit.rent.toLocaleString()}/month, this is one of the best values in ${property.address.city}.`);

  // Unit amenities
  if (unit.amenities.length > 0) {
    lines.push(`Unit features include ${formatAmenityList(unit.amenities)}.`);
  }

  // Property amenities
  if (property.amenities.length > 0) {
    lines.push(`${property.name} offers ${formatAmenityList(property.amenities)}.`);
  }

  // Availability
  if (unit.availableDate) {
    const dateStr = new Date(unit.availableDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    lines.push(`Available ${dateStr} — schedule a tour today!`);
  } else {
    lines.push("Available now — schedule a tour today!");
  }

  return lines.join("\n\n");
}

/**
 * Generate platform-specific social media captions
 */
export function generateSocialCaption(
  listing: Listing,
  unit: Unit,
  property: Property,
  platform: "instagram" | "facebook" | "craigslist"
): string {
  const bedLabel = unit.beds === 0 ? "Studio" : `${unit.beds}BR/${unit.baths}BA`;

  switch (platform) {
    case "instagram":
      return [
        `🏠 NOW AVAILABLE: ${bedLabel} at ${property.name}`,
        "",
        `💰 $${listing.rent.toLocaleString()}/mo`,
        `📐 ${unit.sqft} sq ft`,
        `📍 ${property.address.city}, ${property.address.state}`,
        "",
        listing.description.split("\n")[0],
        "",
        "📩 DM us or link in bio to apply!",
        "",
        "#DavisCA #UCDavis #ForRent #DavisHousing #ApartmentLiving #CollegeLiving #RentOS",
        `#${property.address.city.replace(/\s/g, "")}Rentals #${bedLabel.replace("/", "")}`,
      ].join("\n");

    case "facebook":
      return [
        `🏡 ${listing.title}`,
        "",
        `💲 $${listing.rent.toLocaleString()}/month`,
        `🛏️ ${bedLabel} | 📐 ${unit.sqft} sq ft`,
        `📍 ${property.address.street}, ${property.address.city}, ${property.address.state} ${property.address.zip}`,
        "",
        listing.description,
        "",
        `🗓️ Available: ${listing.availableDate}`,
        "",
        "Interested? Comment below or send us a message to schedule a tour!",
      ].join("\n");

    case "craigslist":
      return [
        listing.title,
        "",
        `Rent: $${listing.rent.toLocaleString()}/month`,
        `Size: ${unit.sqft} sq ft`,
        `Bedrooms: ${unit.beds === 0 ? "Studio" : unit.beds}`,
        `Bathrooms: ${unit.baths}`,
        `Location: ${property.address.street}, ${property.address.city}, ${property.address.state} ${property.address.zip}`,
        `Available: ${listing.availableDate}`,
        `Deposit: $${unit.deposit.toLocaleString()}`,
        "",
        listing.description,
        "",
        "Contact us to schedule a viewing.",
        "",
        "PLEASE DO NOT CONTACT with spam or solicitations.",
      ].join("\n");
  }
}

/**
 * Calculate days on market
 */
export function calculateDaysOnMarket(listing: Listing): number {
  const created = new Date(listing.createdAt);
  const end = listing.status === "filled" ? new Date(listing.updatedAt) : new Date();
  return Math.floor((end.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Aggregate listing statistics
 */
export function getListingStats(listings: Listing[]) {
  const active = listings.filter(l => l.status === "active");
  const filled = listings.filter(l => l.status === "filled");
  const totalLeads = listings.reduce((sum, l) => sum + l.leads.length, 0);
  const avgDaysOnMarket = filled.length > 0
    ? Math.round(filled.reduce((sum, l) => sum + calculateDaysOnMarket(l), 0) / filled.length)
    : 0;
  const conversionRate = totalLeads > 0
    ? Math.round((filled.length / totalLeads) * 100)
    : 0;

  return {
    activeCount: active.length,
    totalLeads,
    avgDaysOnMarket,
    conversionRate,
    filledCount: filled.length,
    pausedCount: listings.filter(l => l.status === "paused").length,
  };
}

/**
 * Calculate dynamic STR nightly rate for a given date
 */
export function calculateSTRRate(pricing: STRPricing, date: Date): number {
  let rate = pricing.baseNightlyRate;

  // Weekend premium (Friday = 5, Saturday = 6)
  const day = date.getDay();
  if (day === 5 || day === 6) {
    rate *= (1 + pricing.weekendPremiumPercent / 100);
  }

  // Seasonal multiplier
  const month = date.getMonth() + 1;
  const seasonal = pricing.seasonalRates.find(
    s => month >= s.startMonth && month <= s.endMonth
  );
  if (seasonal) {
    rate *= seasonal.rateMultiplier;
  }

  return Math.round(rate);
}

/**
 * Generate STR calendar days for a month
 */
export function generateSTRCalendar(
  year: number,
  month: number,
  pricing: STRPricing,
  bookings: { checkIn: string; checkOut: string; guestName: string; status: string }[] = []
): { date: string; status: "available" | "booked" | "blocked"; nightlyRate: number; guestName?: string }[] {
  const days: { date: string; status: "available" | "booked" | "blocked"; nightlyRate: number; guestName?: string }[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dateStr = date.toISOString().split("T")[0];
    const rate = calculateSTRRate(pricing, date);

    // Check if any booking covers this date
    const booking = bookings.find(b => dateStr >= b.checkIn && dateStr < b.checkOut && b.status !== "cancelled");

    days.push({
      date: dateStr,
      status: booking ? "booked" : "available",
      nightlyRate: rate,
      guestName: booking?.guestName,
    });
  }

  return days;
}

// ---- Helpers ----

function formatAmenityList(amenities: string[]): string {
  if (amenities.length === 0) return "";
  if (amenities.length === 1) return amenities[0].toLowerCase();
  if (amenities.length === 2) return `${amenities[0].toLowerCase()} and ${amenities[1].toLowerCase()}`;
  return `${amenities.slice(0, -1).map(a => a.toLowerCase()).join(", ")}, and ${amenities[amenities.length - 1].toLowerCase()}`;
}
