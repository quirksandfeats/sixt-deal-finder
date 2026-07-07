# Sixt Deal Finder

Full-stack app that finds the best-priced Sixt rental cars near you. Pick a location and
search radius, set your dates with a ± flex window and a minimum rental length, choose
vehicle categories (including guaranteed models only), and select protection packages —
prices update instantly.

Runs today on a realistic **mock Sixt provider**; swaps to the **real Sixt RENT API** with
a config change once you have partner credentials (see `docs/SIXT_API_ACCESS.md`).

## Quick start

```bash
npm install
npm start          # → http://localhost:3000
```

Requires Node 18+. Optional: copy `.env.example` to `.env` to change port or provider.

## Features

- **Radius search** — pick any point (geocode search, or click/drag on the map) and a 5–300 km radius; only Sixt branches inside the circle are searched.
- **Flexible dates** — ±0–5 days around your pickup and drop-off dates; every valid combination is priced and the cheapest wins. A minimum-days constraint filters out combos that are too short.
- **Best price per category** — results grouped by category (Convertible, SUV, Luxury, Electric…), cheapest first, with a "guaranteed model only" filter.
- **Protection packages** — Basic / Loss Damage Waiver / Smart / All-Inclusive plus extras; totals re-price live, and extras already included in a package show as "included".
- **Provider adapter** — `mock` today, `sixt` when you have credentials; identical interface.

## Architecture

```
server/
  index.js               Express app + REST API
  config.js              .env loader + limits
  lib/dates.js           flex-date expansion (± flex, min days)
  lib/geo.js             haversine distance
  lib/search.js          orchestrator: branches × date combos → ranked offers
  providers/
    index.js             provider selection (PROVIDER env var)
    catalog.js           categories, protection packages, extras
    mockProvider.js      deterministic realistic pricing (seasonal, weekend, duration)
    sixtProvider.js      real RENT API skeleton (auth + endpoint mapping)
    data/                real Sixt branch locations + ACRISS-coded fleet
public/                  single-page frontend (Leaflet map, no build step)
test/                    node:test unit tests (npm test)
docs/SIXT_API_ACCESS.md  how to get real API credentials
```

## REST API

| Endpoint | Description |
|---|---|
| `GET /api/status` | Active provider + readiness |
| `GET /api/catalog` | Categories, protection packages, extras |
| `GET /api/geocode?q=` | Location search (OpenStreetMap Nominatim proxy) |
| `POST /api/search` | Main search — body: `location{lat,lng}`, `radiusKm`, `pickupDate`, `dropoffDate`, `flexDays`, `minDays`, `categories[]`, `guaranteedOnly` |

## Switching to the real Sixt API

1. Get credentials — full guide in [`docs/SIXT_API_ACCESS.md`](docs/SIXT_API_ACCESS.md)
2. `.env`: `PROVIDER=sixt` + base URL + credentials
3. Align endpoint paths/field names in `server/providers/sixtProvider.js` with the docs you receive

## Tests

```bash
npm test
```
