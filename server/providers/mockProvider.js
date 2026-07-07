/**
 * Mock Sixt provider — simulates the RENT API with realistic behavior:
 * real Sixt branch locations, ACRISS-coded fleet, seasonal & weekend pricing,
 * duration discounts, and per-branch availability. Fully deterministic so
 * the same search always returns the same prices.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { round2 } from "./catalog.js";
import { parseISODate } from "../lib/dates.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRANCHES = JSON.parse(readFileSync(join(__dirname, "data", "branches.json"), "utf8"));
const FLEET = JSON.parse(readFileSync(join(__dirname, "data", "fleet.json"), "utf8"));

/** Small deterministic hash → [0, 1) */
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function seasonalMultiplier(date, country) {
  const m = date.getUTCMonth(); // 0-11
  // Summer peak in Europe; winter peak in FL/AZ/NV sunshine markets
  const summerPeak = [5, 6, 7].includes(m) ? 1.18 : m === 8 ? 1.08 : 1.0;
  const winterPeak = [11, 0, 1, 2].includes(m) ? 1.15 : 1.0;
  return country === "US" ? Math.max(summerPeak, winterPeak) : summerPeak;
}

function weekendMultiplier(date) {
  const d = date.getUTCDay();
  return d === 5 || d === 6 ? 1.09 : 1.0; // Fri/Sat pickups cost more
}

function durationDiscount(days) {
  if (days >= 28) return 0.72;
  if (days >= 14) return 0.8;
  if (days >= 7) return 0.88;
  if (days >= 3) return 0.95;
  return 1.0;
}

export const mockProvider = {
  name: "mock",

  ready() {
    return { ok: true };
  },

  async getBranches() {
    return BRANCHES;
  },

  /**
   * Return available offers for one branch and one date combo.
   * @returns {Promise<{vehicleId,model,category,acriss,guaranteed,perDayBase}[]>}
   */
  async getOffers({ branch, pickup, days }) {
    const pickupDate = parseISODate(pickup);
    const offers = [];
    for (const v of FLEET) {
      // Deterministic availability: ~75% at airports, ~55% downtown
      const avail = hash01(`${branch.id}|${v.id}|${pickup}`);
      const threshold = branch.airport ? 0.75 : 0.55;
      if (avail > threshold) continue;

      // Premium/exotic cars live mostly at airports and flagship stores
      if (["luxury", "sports"].includes(v.category) && !branch.airport && hash01(`${branch.id}|${v.id}`) > 0.4) continue;

      const jitter = 0.92 + hash01(`price|${branch.id}|${v.id}|${pickup}`) * 0.16; // ±8%
      const perDayBase = round2(
        v.baseRate *
          branch.priceFactor *
          seasonalMultiplier(pickupDate, branch.country) *
          weekendMultiplier(pickupDate) *
          durationDiscount(days) *
          jitter
      );

      offers.push({
        vehicleId: v.id,
        model: v.model,
        category: v.category,
        acriss: v.acriss,
        guaranteed: v.guaranteed,
        perDayBase,
      });
    }
    return offers;
  },
};
