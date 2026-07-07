# How to Get Access to the Sixt RENT API

The app is built against a provider interface, so once you have credentials you only
edit `.env` and (if needed) the endpoint constants in `server/providers/sixtProvider.js`.
Everything else — the UI, flex-date search, radius filtering, protection pricing — stays the same.

## The official route: Sixt Developer Portal

1. **Register**: Go to [developers.sixt.com/register](https://developers.sixt.com/register/) and request access to the API solutions. You'll describe your use case; for this app that's the **RENT API** (branch network + rental offers).
2. **What Sixt looks for**: The RENT API is a B2B partner product. Approval typically requires one of:
   - Travel-industry accreditation: **IATA**, **TIDS** (free and easiest to obtain — apply at [iata.org/tids](https://www.iata.org/en/services/accreditation/tids/)), **ABTA**, or similar
   - An existing commercial relationship or affiliate agreement with Sixt
   - A business entity with a plausible booking volume (they may ask about financials)
3. **Tip — start with TIDS**: If you don't have industry credentials, a TIDS code is the lowest-friction path. It's free, aimed at travel sellers without IATA accreditation, and is accepted by most car rental partner programs.
4. **After approval**: You get a partner login for [developers.sixt.com/app/docs/rent](https://developers.sixt.com/app/docs/rent/), API credentials, and the exact endpoint documentation. Then:
   - Fill in `SIXT_API_BASE_URL` and either `SIXT_API_KEY` or `SIXT_CLIENT_ID`/`SIXT_CLIENT_SECRET` in `.env`
   - Set `PROVIDER=sixt`
   - Compare the docs against the `ENDPOINTS` map and the `mapBranch`/`mapOffer` functions in `server/providers/sixtProvider.js` and adjust field names — that file is the only integration point.

## Plan B: aggregator APIs (much easier to get)

If Sixt approval stalls, several aggregators resell Sixt inventory (alongside other brands) with far lighter onboarding. The same provider interface works — you'd add a new file in `server/providers/`:

- **CarTrawler** — large car-rental aggregator, includes Sixt inventory
- **Carnect (part of TUI)** — car rental API with Sixt coverage
- **Lyko** ([lyko.tech](https://lyko.tech/en/portfolio/car-rental-api/sixt-api/)) — mobility API hub that wraps the Sixt API and handles the partnership layer for you; often the fastest way for small projects
- **Booking.com / Expedia (Rapid) affiliate programs** — include car rental with commission models

## Plan C: Sixt affiliate program

If you mainly want to *earn from* deals rather than build a booking flow, the [Sixt partner/affiliate program](https://www.sixt.com/sixt-partners/) gives you deep links with your affiliate ID — no API, but you can send users from this app's results straight to Sixt checkout with tracking.

## What not to do

Scraping sixt.com or calling its internal website/app endpoints violates Sixt's Terms & Conditions and will get IP-blocked quickly — not a stable base for the app.

## Checklist once you have credentials

- [ ] `.env`: set `PROVIDER=sixt`, `SIXT_API_BASE_URL`, and your credentials
- [ ] `server/providers/sixtProvider.js`: verify `ENDPOINTS` paths against the real docs
- [ ] Same file: align `mapBranch()` / `mapOffer()` field names with real responses
- [ ] Mind rate limits: flex search multiplies requests (branches × date combos). Consider lowering `maxDateCombos` in `server/config.js` or caching offers.
- [ ] Run `npm start` and check the header badge says **LIVE — Sixt RENT API**
