/**
 * Shared catalog: vehicle categories and protection packages.
 * Mirrors Sixt's real-world offering so the UI stays identical
 * when you switch from the mock provider to the real RENT API.
 */

export const CATEGORIES = [
  { id: "economy", name: "Economy" },
  { id: "compact", name: "Compact" },
  { id: "sedan", name: "Sedan" },
  { id: "suv", name: "SUV" },
  { id: "convertible", name: "Convertible" },
  { id: "sports", name: "Sports Car" },
  { id: "luxury", name: "Luxury" },
  { id: "electric", name: "Electric" },
  { id: "van", name: "Van / Minibus" },
  { id: "pickup", name: "Pickup Truck" },
];

/**
 * Protection packages (modeled on Sixt's Basic / Smart / All-Inclusive tiers).
 * pct = share of the vehicle's daily base rate; minPerDay = floor in USD.
 */
export const PROTECTION_PACKAGES = [
  {
    id: "basic",
    name: "Basic",
    description: "Third-party liability only. Standard deductible applies to any damage.",
    pct: 0,
    minPerDay: 0,
  },
  {
    id: "ldw",
    name: "Loss Damage Waiver",
    description: "Covers damage to and theft of the rental vehicle (deductible reduced).",
    pct: 0.16,
    minPerDay: 12,
  },
  {
    id: "smart",
    name: "Smart Protection",
    description: "LDW + tire & windshield coverage + roadside assistance.",
    pct: 0.24,
    minPerDay: 19,
  },
  {
    id: "allinclusive",
    name: "All-Inclusive Protection",
    description: "Zero deductible, personal accident insurance, roadside assistance, tire & glass.",
    pct: 0.34,
    minPerDay: 28,
  },
];

/** Optional add-ons priced per day. */
export const EXTRAS = [
  { id: "additionalDriver", name: "Additional driver", perDay: 9 },
  { id: "personalAccident", name: "Personal accident insurance", perDay: 7 },
  { id: "roadside", name: "Roadside protection", perDay: 6, includedIn: ["smart", "allinclusive"] },
];

/** Compute protection cost per day for a given package and daily base rate. */
export function protectionPerDay(pkg, dailyBaseRate) {
  return Math.max(pkg.minPerDay, round2(dailyBaseRate * pkg.pct));
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}
