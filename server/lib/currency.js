/**
 * Currency support. Mock fleet rates are defined in USD; totals are converted
 * to the requested currency using live ECB reference rates from the free
 * frankfurter.app API, with a static fallback if offline.
 */

export const SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP", "CHF"];

// Fallback rates (per 1 USD) — used when the live fetch fails
const FALLBACK_RATES = { USD: 1, EUR: 0.92, GBP: 0.79, CHF: 0.88 };

let cache = { rates: FALLBACK_RATES, fetchedAt: 0, live: false };
const TTL_MS = 12 * 60 * 60 * 1000; // refresh twice a day

export async function getRates() {
  if (Date.now() - cache.fetchedAt < TTL_MS) return cache;
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,CHF", {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cache = { rates: { USD: 1, ...data.rates }, fetchedAt: Date.now(), live: true };
  } catch {
    cache = { rates: FALLBACK_RATES, fetchedAt: Date.now(), live: false };
  }
  return cache;
}

/** Returns a converter fn USD → target currency, plus metadata. */
export async function getConverter(currency = "EUR") {
  const cur = SUPPORTED_CURRENCIES.includes(currency) ? currency : "EUR";
  const { rates, live } = await getRates();
  const rate = rates[cur] ?? 1;
  return {
    currency: cur,
    rate,
    live,
    convert: (usd) => Math.round(usd * rate * 100) / 100,
  };
}
