/**
 * Search orchestrator: expands flexible dates, filters branches by radius,
 * queries the provider, and ranks the best-priced offers per category.
 */
import { expandDateCombos } from "./dates.js";
import { distanceKm } from "./geo.js";
import { CATEGORIES, PROTECTION_PACKAGES, EXTRAS, protectionPerDay, round2 } from "../providers/catalog.js";
import { getConverter } from "./currency.js";
import { config } from "../config.js";

/**
 * @param {object} provider  Provider implementing getBranches() / getOffers()
 * @param {object} q
 * @param {{lat:number,lng:number}} q.location
 * @param {number} q.radiusKm
 * @param {string} q.pickupDate   YYYY-MM-DD
 * @param {string} q.dropoffDate  YYYY-MM-DD
 * @param {number} q.flexDays
 * @param {number} q.minDays
 * @param {string[]} q.categories       empty/undefined = all
 * @param {boolean} q.guaranteedOnly
 * @param {string} q.currency      EUR (default), USD, GBP, or CHF
 */
export async function runSearch(provider, q) {
  const fx = await getConverter(q.currency || "EUR");
  const radiusKm = Math.min(Math.max(1, Number(q.radiusKm) || 50), config.limits.maxRadiusKm);
  const flexDays = Math.min(Math.max(0, Number(q.flexDays) || 0), config.limits.maxFlexDays);
  const minDays = Math.max(1, Number(q.minDays) || 1);
  const wantedCategories = (q.categories?.length ? q.categories : CATEGORIES.map((c) => c.id));

  const combos = expandDateCombos(
    q.pickupDate,
    q.dropoffDate,
    flexDays,
    minDays,
    config.limits.maxDateCombos
  );
  if (combos.length === 0) {
    return { branches: [], results: [], combosTried: 0, message: "No date combination satisfies the minimum rental length within your flex window." };
  }

  // Branches within radius, nearest first
  const allBranches = await provider.getBranches();
  const branches = allBranches
    .map((b) => ({ ...b, distanceKm: round2(distanceKm(q.location, b)) }))
    .filter((b) => b.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 15); // keep request volume sane

  // Query every branch × date combo
  const offers = [];
  await Promise.all(
    branches.map(async (branch) => {
      for (const combo of combos) {
        let branchOffers;
        try {
          branchOffers = await provider.getOffers({ branch, ...combo });
        } catch (err) {
          console.error(`Offer fetch failed for ${branch.id} ${combo.pickup}: ${err.message}`);
          continue;
        }
        for (const o of branchOffers) {
          if (!wantedCategories.includes(o.category)) continue;
          if (q.guaranteedOnly && !o.guaranteed) continue;
          offers.push(buildOffer(o, branch, combo, fx));
        }
      }
    })
  );

  // Deduplicate: keep the cheapest (branch, vehicle) pair across date combos,
  // then rank the cheapest offers within each category.
  const bestByKey = new Map();
  for (const o of offers) {
    const key = `${o.branchId}|${o.vehicleId}`;
    if (!bestByKey.has(key) || o.baseTotal < bestByKey.get(key).baseTotal) bestByKey.set(key, o);
  }

  const results = [];
  for (const cat of CATEGORIES) {
    if (!wantedCategories.includes(cat.id)) continue;
    const catOffers = [...bestByKey.values()]
      .filter((o) => o.category === cat.id)
      .sort((a, b) => a.baseTotal - b.baseTotal)
      .slice(0, config.limits.offersPerCategory);
    if (catOffers.length) results.push({ category: cat.id, categoryName: cat.name, offers: catOffers });
  }

  return {
    branches: branches.map(({ id, name, city, lat, lng, distanceKm, airport }) => ({ id, name, city, lat, lng, distanceKm, airport })),
    results,
    combosTried: combos.length,
    currency: fx.currency,
    fxLive: fx.live,
  };
}

function buildOffer(o, branch, combo, fx) {
  // Provider rates are in USD; convert everything to the requested currency
  const perDayBase = fx.convert(o.perDayBase);
  const baseTotal = round2(perDayBase * combo.days);

  // Pre-compute every protection package total so the UI can re-price instantly
  const protectionOptions = {};
  for (const pkg of PROTECTION_PACKAGES) {
    protectionOptions[pkg.id] = round2(fx.convert(protectionPerDay(pkg, o.perDayBase)) * combo.days);
  }
  const extrasOptions = {};
  for (const ex of EXTRAS) {
    extrasOptions[ex.id] = round2(fx.convert(ex.perDay) * combo.days);
  }

  return {
    id: `${branch.id}-${o.vehicleId}-${combo.pickup}`,
    vehicleId: o.vehicleId,
    model: o.model,
    category: o.category,
    acriss: o.acriss,
    guaranteed: o.guaranteed,
    branchId: branch.id,
    branchName: branch.name,
    branchCity: branch.city,
    airport: branch.airport,
    distanceKm: branch.distanceKm,
    pickupDate: combo.pickup,
    dropoffDate: combo.dropoff,
    days: combo.days,
    currency: fx.currency,
    perDayBase,
    baseTotal,
    protectionOptions,
    extrasOptions,
  };
}
