import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "./config.js";
import { getProvider } from "./providers/index.js";
import { runSearch } from "./lib/search.js";
import { CATEGORIES, PROTECTION_PACKAGES, EXTRAS } from "./providers/catalog.js";
import { SUPPORTED_CURRENCIES } from "./lib/currency.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "..", "public")));

// ── Meta ────────────────────────────────────────────────────────────────────
app.get("/api/status", (_req, res) => {
  const provider = getProvider();
  const ready = provider.ready();
  res.json({ provider: provider.name, ready: ready.ok, reason: ready.reason ?? null });
});

app.get("/api/catalog", (_req, res) => {
  res.json({ categories: CATEGORIES, protections: PROTECTION_PACKAGES, extras: EXTRAS, currencies: SUPPORTED_CURRENCIES });
});

// ── Geocoding proxy (OpenStreetMap Nominatim; keeps their usage policy) ────
const geocodeCache = new Map();
app.get("/api/geocode", async (req, res) => {
  const query = String(req.query.q || "").trim();
  if (query.length < 2) return res.status(400).json({ error: "Query too short" });
  if (geocodeCache.has(query)) return res.json(geocodeCache.get(query));
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "5");
    const r = await fetch(url, { headers: { "User-Agent": "sixt-deal-finder/1.0 (personal project)" } });
    if (!r.ok) throw new Error(`Nominatim ${r.status}`);
    const data = (await r.json()).map((p) => ({
      label: p.display_name,
      lat: Number(p.lat),
      lng: Number(p.lon),
    }));
    geocodeCache.set(query, data);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: `Geocoding failed: ${err.message}` });
  }
});

// ── Search ──────────────────────────────────────────────────────────────────
app.post("/api/search", async (req, res) => {
  const q = req.body ?? {};
  if (!q.location?.lat || !q.location?.lng) {
    return res.status(400).json({ error: "location.lat and location.lng are required" });
  }
  if (!q.pickupDate || !q.dropoffDate) {
    return res.status(400).json({ error: "pickupDate and dropoffDate are required" });
  }
  const provider = getProvider();
  const ready = provider.ready();
  if (!ready.ok) {
    return res.status(503).json({
      error: `Provider "${provider.name}" is not configured: ${ready.reason}. See docs/SIXT_API_ACCESS.md, or set PROVIDER=mock in .env.`,
    });
  }
  try {
    const out = await runSearch(provider, q);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(config.port, () => {
  const provider = getProvider();
  console.log(`Sixt Deal Finder running at http://localhost:${config.port}`);
  console.log(`Provider: ${provider.name} (${provider.ready().ok ? "ready" : "NOT CONFIGURED — " + provider.ready().reason})`);
});
