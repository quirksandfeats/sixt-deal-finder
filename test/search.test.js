import { test } from "node:test";
import assert from "node:assert/strict";
import { expandDateCombos, daysBetween, parseISODate } from "../server/lib/dates.js";
import { distanceKm } from "../server/lib/geo.js";
import { PROTECTION_PACKAGES, protectionPerDay } from "../server/providers/catalog.js";
import { runSearch } from "../server/lib/search.js";
import { mockProvider } from "../server/providers/mockProvider.js";

// Use far-future dates so the "no past pickups" filter never interferes
const P = "2027-08-10";
const D = "2027-08-15"; // 5 days

test("expandDateCombos: exact dates, no flex", () => {
  const combos = expandDateCombos(P, D, 0, 1);
  assert.equal(combos.length, 1);
  assert.deepEqual(combos[0], { pickup: P, dropoff: D, days: 5 });
});

test("expandDateCombos: ±2 flex yields 25 combos when minDays allows", () => {
  const combos = expandDateCombos(P, D, 2, 1);
  assert.equal(combos.length, 25); // 5 × 5
});

test("expandDateCombos: minDays filters short combos", () => {
  const combos = expandDateCombos(P, D, 2, 5);
  // days range from 1..9; only combos with days >= 5 remain: count them
  for (const c of combos) assert.ok(c.days >= 5, `combo ${c.pickup}→${c.dropoff} is ${c.days} days`);
  assert.equal(combos.length, 15); // pairs (i,j) with base 5 + (j - i) >= 5 → j >= i
});

test("expandDateCombos: rejects dropoff before pickup", () => {
  assert.throws(() => expandDateCombos("2027-08-15", "2027-08-10", 0, 1));
});

test("daysBetween is exact across months", () => {
  assert.equal(daysBetween(parseISODate("2027-01-30"), parseISODate("2027-02-02")), 3);
});

test("distanceKm: Miami Airport to South Beach ≈ 15-16 km", () => {
  const d = distanceKm({ lat: 25.7959, lng: -80.287 }, { lat: 25.7825, lng: -80.1341 });
  assert.ok(d > 14 && d < 17, `got ${d}`);
});

test("protection pricing respects per-day floor", () => {
  const ldw = PROTECTION_PACKAGES.find((p) => p.id === "ldw");
  assert.equal(protectionPerDay(ldw, 30), 12); // 16% of 30 = 4.8 → floor 12
  assert.equal(protectionPerDay(ldw, 200), 32); // 16% of 200 = 32 > floor
});

test("runSearch: returns grouped, sorted offers within radius", async () => {
  const out = await runSearch(mockProvider, {
    location: { lat: 25.7743, lng: -80.1937 }, // Miami downtown
    radiusKm: 50,
    pickupDate: P,
    dropoffDate: D,
    flexDays: 1,
    minDays: 3,
    categories: ["convertible", "suv"],
    guaranteedOnly: false,
  });
  assert.ok(out.branches.length > 0, "should find Miami-area branches");
  assert.ok(out.branches.every((b) => b.distanceKm <= 50));
  assert.ok(out.results.length > 0, "should find offers");
  for (const group of out.results) {
    assert.ok(["convertible", "suv"].includes(group.category));
    const totals = group.offers.map((o) => o.baseTotal);
    assert.deepEqual(totals, [...totals].sort((a, b) => a - b), "offers sorted cheapest first");
    for (const o of group.offers) {
      assert.ok(o.days >= 3, "minDays respected");
      assert.ok(o.protectionOptions.allinclusive > o.protectionOptions.basic);
    }
  }
});

test("runSearch: guaranteedOnly filters correctly", async () => {
  const out = await runSearch(mockProvider, {
    location: { lat: 25.7743, lng: -80.1937 },
    radiusKm: 60,
    pickupDate: P,
    dropoffDate: D,
    flexDays: 0,
    minDays: 1,
    categories: [],
    guaranteedOnly: true,
  });
  for (const group of out.results) {
    for (const o of group.offers) assert.equal(o.guaranteed, true);
  }
});

test("runSearch: empty when radius excludes all branches", async () => {
  const out = await runSearch(mockProvider, {
    location: { lat: 0, lng: 0 }, // Gulf of Guinea — no Sixt branches
    radiusKm: 100,
    pickupDate: P,
    dropoffDate: D,
    flexDays: 0,
    minDays: 1,
    categories: [],
    guaranteedOnly: false,
  });
  assert.equal(out.branches.length, 0);
  assert.equal(out.results.length, 0);
});

test("runSearch: currency conversion changes totals consistently", async () => {
  const base = {
    location: { lat: 48.1374, lng: 11.5755 }, // Munich
    radiusKm: 60,
    pickupDate: P,
    dropoffDate: D,
    flexDays: 0,
    minDays: 1,
    categories: ["sedan"],
    guaranteedOnly: false,
  };
  const usd = await runSearch(mockProvider, { ...base, currency: "USD" });
  const eur = await runSearch(mockProvider, { ...base, currency: "EUR" });
  assert.equal(usd.currency, "USD");
  assert.equal(eur.currency, "EUR");
  const oUsd = usd.results[0].offers[0];
  const oEur = eur.results[0].offers.find((o) => o.id === oUsd.id) ?? eur.results[0].offers[0];
  const rate = oEur.perDayBase / oUsd.perDayBase;
  assert.ok(rate > 0.5 && rate < 1.5, `implied rate ${rate}`);
  // Totals scale with the same rate (within rounding tolerance)
  assert.ok(Math.abs(oEur.baseTotal - oUsd.baseTotal * rate) < 0.5);
  assert.equal(oEur.currency, "EUR");
});

test("runSearch: unsupported currency falls back to EUR", async () => {
  const out = await runSearch(mockProvider, {
    location: { lat: 48.1374, lng: 11.5755 },
    radiusKm: 60,
    pickupDate: P,
    dropoffDate: D,
    flexDays: 0,
    minDays: 1,
    categories: [],
    guaranteedOnly: false,
    currency: "JPY",
  });
  assert.equal(out.currency, "EUR");
});
