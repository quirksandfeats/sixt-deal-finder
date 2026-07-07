/**
 * Real Sixt RENT API provider — skeleton, ready for your partner credentials.
 *
 * The RENT API docs live behind the partner login at
 * https://developers.sixt.com/app/docs/rent/ — once your application is
 * approved (see docs/SIXT_API_ACCESS.md), you will receive credentials and
 * the exact endpoint paths. Update the ENDPOINTS map and the two mapping
 * functions below; nothing else in the app needs to change.
 */
import { config } from "../config.js";

// ─── Update these from the official docs after approval ────────────────────
const ENDPOINTS = {
  token: "/oauth/token",                 // OAuth2 client-credentials exchange
  branches: "/rent/v1/locations",        // branch/station search
  offers: "/rent/v1/offers",             // rental offers for location + dates
  protections: "/rent/v1/protections",   // protection/insurance packages
};
// ────────────────────────────────────────────────────────────────────────────

let tokenCache = { token: null, expiresAt: 0 };

async function getAccessToken() {
  const { baseUrl, clientId, clientSecret, apiKey } = config.sixt;
  if (apiKey) return apiKey; // some partner setups use a static API key
  if (Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.token;

  const res = await fetch(baseUrl + ENDPOINTS.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`Sixt auth failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return tokenCache.token;
}

async function sixtGet(path, params = {}) {
  const token = await getAccessToken();
  const url = new URL(config.sixt.baseUrl + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Sixt API ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── Mapping layer: adjust field names to match the real response schema ───

function mapBranch(raw) {
  return {
    id: raw.id ?? raw.stationId,
    name: raw.title ?? raw.name,
    city: raw.city,
    country: raw.countryCode ?? raw.country,
    lat: raw.coordinates?.latitude ?? raw.lat,
    lng: raw.coordinates?.longitude ?? raw.lng,
    airport: Boolean(raw.isAirport ?? raw.airport),
    priceFactor: 1,
  };
}

function mapOffer(raw) {
  return {
    vehicleId: raw.id ?? raw.offerId,
    model: raw.vehicle?.name ?? raw.carModel,
    category: (raw.vehicle?.category ?? raw.category ?? "").toLowerCase(),
    acriss: raw.vehicle?.acrissCode ?? raw.acriss,
    guaranteed: Boolean(raw.vehicle?.isGuaranteedModel ?? raw.guaranteedModel),
    perDayBase: Number(raw.price?.perDay?.amount ?? raw.dailyRate),
  };
}

// ─── Provider interface (same shape as mockProvider) ───────────────────────

export const sixtProvider = {
  name: "sixt",

  ready() {
    const { baseUrl, apiKey, clientId, clientSecret } = config.sixt;
    if (!baseUrl) return { ok: false, reason: "SIXT_API_BASE_URL is not set" };
    if (!apiKey && !(clientId && clientSecret)) {
      return { ok: false, reason: "Set SIXT_API_KEY or SIXT_CLIENT_ID + SIXT_CLIENT_SECRET" };
    }
    return { ok: true };
  },

  async getBranches() {
    const data = await sixtGet(ENDPOINTS.branches);
    return (data.locations ?? data.items ?? data).map(mapBranch);
  },

  async getOffers({ branch, pickup, dropoff }) {
    const data = await sixtGet(ENDPOINTS.offers, {
      pickupStation: branch.id,
      returnStation: branch.id,
      pickupDate: `${pickup}T10:00`,
      returnDate: `${dropoff}T10:00`,
    });
    return (data.offers ?? data.items ?? data).map(mapOffer);
  },
};
