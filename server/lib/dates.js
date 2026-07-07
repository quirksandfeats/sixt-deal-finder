const DAY_MS = 24 * 60 * 60 * 1000;

export function parseISODate(s) {
  const d = new Date(`${s}T12:00:00Z`); // noon UTC avoids DST edge cases
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${s}`);
  return d;
}

export function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

export function addDays(d, n) {
  return new Date(d.getTime() + n * DAY_MS);
}

export function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/**
 * Expand a desired pickup/dropoff pair into all candidate date combinations.
 *
 * @param {string} pickup   Desired pickup date (YYYY-MM-DD)
 * @param {string} dropoff  Desired dropoff date (YYYY-MM-DD)
 * @param {number} flexDays Shift each end by up to ±flexDays
 * @param {number} minDays  Minimum rental length in days (>= 1)
 * @param {number} maxCombos Safety cap on combination count
 * @returns {{pickup: string, dropoff: string, days: number}[]}
 */
export function expandDateCombos(pickup, dropoff, flexDays = 0, minDays = 1, maxCombos = 200) {
  const p0 = parseISODate(pickup);
  const d0 = parseISODate(dropoff);
  if (daysBetween(p0, d0) < 1) throw new Error("Dropoff must be after pickup");
  flexDays = Math.max(0, Math.floor(flexDays));
  minDays = Math.max(1, Math.floor(minDays));

  const today = new Date(new Date().toISOString().slice(0, 10) + "T12:00:00Z");
  const combos = [];
  for (let i = -flexDays; i <= flexDays; i++) {
    for (let j = -flexDays; j <= flexDays; j++) {
      const p = addDays(p0, i);
      const d = addDays(d0, j);
      const days = daysBetween(p, d);
      if (days < minDays) continue;
      if (p.getTime() < today.getTime()) continue; // no past pickups
      combos.push({ pickup: toISODate(p), dropoff: toISODate(d), days });
      if (combos.length >= maxCombos) return combos;
    }
  }
  return combos;
}
