/* Sixt Deal Finder — frontend */

const state = {
  location: null,        // {lat, lng, label}
  catalog: null,         // {categories, protections, extras}
  selectedCategories: new Set(),
  selectedProtection: "basic",
  selectedExtras: new Set(),
  currency: "EUR",
  lastResults: null,
};

const $ = (id) => document.getElementById(id);
const fmt = (n) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: state.currency }).format(n);

// ── Map ─────────────────────────────────────────────────────────────────────
const map = L.map("map").setView([48.1374, 11.5755], 10); // default: Munich
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

let marker = null;
let circle = null;
let branchLayer = L.layerGroup().addTo(map);

function setLocation(lat, lng, label) {
  state.location = { lat, lng, label };
  $("geo-chosen").textContent = "📍 " + (label || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  if (marker) marker.remove();
  marker = L.marker([lat, lng], { draggable: true }).addTo(map);
  marker.on("dragend", () => {
    const p = marker.getLatLng();
    setLocation(p.lat, p.lng, `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`);
  });
  drawCircle();
  map.setView([lat, lng], zoomForRadius(radiusKm()));
}

function radiusKm() { return Number($("radius").value); }
function zoomForRadius(km) {
  if (km <= 15) return 11;
  if (km <= 40) return 10;
  if (km <= 90) return 9;
  if (km <= 180) return 8;
  return 7;
}

function drawCircle() {
  if (!state.location) return;
  if (circle) circle.remove();
  circle = L.circle([state.location.lat, state.location.lng], {
    radius: radiusKm() * 1000,
    color: "#ff5000",
    fillColor: "#ff5000",
    fillOpacity: 0.07,
    weight: 1.5,
  }).addTo(map);
}

map.on("click", (e) => setLocation(e.latlng.lat, e.latlng.lng, `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`));

$("radius").addEventListener("input", () => {
  $("radius-label").textContent = `${radiusKm()} km`;
  drawCircle();
});

// ── Geocoding ───────────────────────────────────────────────────────────────
async function geocode() {
  const q = $("geo-input").value.trim();
  if (q.length < 2) return;
  const box = $("geo-results");
  box.classList.remove("hidden");
  box.innerHTML = "<div>Searching…</div>";
  try {
    const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    const places = await r.json();
    if (!r.ok) throw new Error(places.error || "Geocoding failed");
    box.innerHTML = "";
    if (!places.length) { box.innerHTML = "<div>No matches found</div>"; return; }
    for (const p of places) {
      const div = document.createElement("div");
      div.textContent = p.label;
      div.onclick = () => { box.classList.add("hidden"); setLocation(p.lat, p.lng, p.label.split(",").slice(0, 2).join(",")); };
      box.appendChild(div);
    }
  } catch (err) {
    box.innerHTML = `<div>${err.message}</div>`;
  }
}
$("geo-btn").onclick = geocode;
$("geo-input").addEventListener("keydown", (e) => { if (e.key === "Enter") geocode(); });

// ── Catalog & status ────────────────────────────────────────────────────────
async function init() {
  const [catalogRes, statusRes] = await Promise.all([fetch("/api/catalog"), fetch("/api/status")]);
  state.catalog = await catalogRes.json();
  const status = await statusRes.json();

  const badge = $("provider-badge");
  badge.classList.remove("hidden");
  if (status.provider === "mock") {
    badge.textContent = "DEMO DATA — mock Sixt provider";
  } else {
    badge.textContent = status.ready ? "LIVE — Sixt RENT API" : "Sixt API not configured";
    if (status.ready) badge.classList.add("ready");
  }

  // Currency selector
  const curSel = $("currency");
  for (const c of state.catalog.currencies ?? ["EUR", "USD"]) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    if (c === state.currency) opt.selected = true;
    curSel.appendChild(opt);
  }
  curSel.onchange = () => {
    state.currency = curSel.value;
    // Prices are converted server-side, so re-run the search if we have results
    if (state.lastResults) $("search-btn").click();
  };

  // Category chips
  const chips = $("category-chips");
  for (const c of state.catalog.categories) {
    const el = document.createElement("span");
    el.className = "chip";
    el.textContent = c.name;
    el.onclick = () => {
      el.classList.toggle("active");
      el.classList.contains("active") ? state.selectedCategories.add(c.id) : state.selectedCategories.delete(c.id);
    };
    chips.appendChild(el);
  }

  // Protection packages
  const plist = $("protection-list");
  for (const p of state.catalog.protections) {
    const el = document.createElement("div");
    el.className = "protection" + (p.id === state.selectedProtection ? " active" : "");
    el.dataset.id = p.id;
    el.innerHTML = `<div class="p-name">${p.name}</div><div class="p-desc">${p.description}</div>`;
    el.onclick = () => {
      state.selectedProtection = p.id;
      document.querySelectorAll(".protection").forEach((n) => n.classList.toggle("active", n.dataset.id === p.id));
      rerender();
    };
    plist.appendChild(el);
  }

  // Extras
  const xlist = $("extras-list");
  for (const x of state.catalog.extras) {
    const lab = document.createElement("label");
    lab.className = "check-row";
    lab.innerHTML = `<input type="checkbox" data-id="${x.id}"> ${x.name} <span class="muted-note" data-note="${x.id}"></span>`;
    lab.querySelector("input").onchange = (e) => {
      e.target.checked ? state.selectedExtras.add(x.id) : state.selectedExtras.delete(x.id);
      rerender();
    };
    xlist.appendChild(lab);
  }

  // Default dates: 2 weeks out, 5-day rental
  const today = new Date();
  const p = new Date(today.getTime() + 14 * 864e5);
  const d = new Date(today.getTime() + 19 * 864e5);
  $("pickup-date").value = p.toISOString().slice(0, 10);
  $("dropoff-date").value = d.toISOString().slice(0, 10);
}

// ── Pricing helpers (client-side re-pricing on protection/extras toggle) ───
function offerTotal(o) {
  let total = o.baseTotal + (o.protectionOptions[state.selectedProtection] ?? 0);
  for (const exId of state.selectedExtras) {
    const ex = state.catalog.extras.find((x) => x.id === exId);
    if (ex?.includedIn?.includes(state.selectedProtection)) continue; // already covered
    total += o.extrasOptions[exId] ?? 0;
  }
  return Math.round(total * 100) / 100;
}

function breakdown(o) {
  const lines = [`${o.days} days × ${fmt(o.perDayBase)} = ${fmt(o.baseTotal)}`];
  const prot = o.protectionOptions[state.selectedProtection] ?? 0;
  const pkg = state.catalog.protections.find((p) => p.id === state.selectedProtection);
  if (prot > 0) lines.push(`${pkg.name}: +${fmt(prot)}`);
  for (const exId of state.selectedExtras) {
    const ex = state.catalog.extras.find((x) => x.id === exId);
    if (ex?.includedIn?.includes(state.selectedProtection)) { lines.push(`${ex.name}: included`); continue; }
    lines.push(`${ex.name}: +${fmt(o.extrasOptions[exId] ?? 0)}`);
  }
  return lines.join("\n");
}

// ── Search ──────────────────────────────────────────────────────────────────
$("search-btn").onclick = async () => {
  const note = $("search-note");
  note.className = "note";
  if (!state.location) { note.className = "note error"; note.textContent = "Pick a location first (search or click the map)."; return; }

  const btn = $("search-btn");
  btn.disabled = true;
  note.textContent = "Searching branches and date combinations…";

  try {
    const r = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: state.location,
        radiusKm: radiusKm(),
        pickupDate: $("pickup-date").value,
        dropoffDate: $("dropoff-date").value,
        flexDays: Number($("flex-days").value),
        minDays: Number($("min-days").value),
        categories: [...state.selectedCategories],
        guaranteedOnly: $("guaranteed-only").checked,
        currency: state.currency,
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Search failed");
    state.lastResults = data;
    note.textContent =
      `Tried ${data.combosTried} date combination(s) across ${data.branches.length} branch(es). Prices in ${data.currency}` +
      (data.currency !== "USD" && !data.fxLive ? " (offline exchange rate)." : ".");
    renderBranches(data.branches);
    rerender();
  } catch (err) {
    note.className = "note error";
    note.textContent = err.message;
    $("results").innerHTML = `<div class="empty">${err.message}</div>`;
  } finally {
    btn.disabled = false;
  }
};

function renderBranches(branches) {
  branchLayer.clearLayers();
  for (const b of branches) {
    L.circleMarker([b.lat, b.lng], { radius: 7, color: "#ff5000", fillColor: "#ff5000", fillOpacity: 0.85, weight: 1 })
      .bindPopup(`<strong>${b.name}</strong><br>${b.distanceKm} km away`)
      .addTo(branchLayer);
  }
}

// ── Rendering ───────────────────────────────────────────────────────────────
function rerender() {
  const data = state.lastResults;
  if (!data) return;
  const root = $("results");
  root.innerHTML = "";

  if (!data.results.length) {
    root.innerHTML = `<div class="empty">${data.message || "No cars found — try a bigger radius, more flex days, or more categories."}</div>`;
    return;
  }

  const summary = document.createElement("div");
  summary.className = "summary-line";
  const pkg = state.catalog.protections.find((p) => p.id === state.selectedProtection);
  summary.textContent = `Prices include: ${pkg.name}${state.selectedExtras.size ? " + " + [...state.selectedExtras].map((id) => state.catalog.extras.find((x) => x.id === id)?.name).join(", ") : ""}. Sorted cheapest first per category.`;
  root.appendChild(summary);

  for (const group of data.results) {
    const sec = document.createElement("div");
    sec.className = "cat-section";
    sec.innerHTML = `<div class="cat-title">${group.categoryName}</div>`;

    const sorted = [...group.offers].sort((a, b) => offerTotal(a) - offerTotal(b));
    sorted.forEach((o, i) => {
      const total = offerTotal(o);
      const el = document.createElement("div");
      el.className = "offer" + (i === 0 ? " best" : "");
      el.innerHTML = `
        <div>
          <span class="o-model">${o.model}</span>
          <span class="o-tags">
            ${i === 0 ? '<span class="tag best-tag">BEST PRICE</span>' : ""}
            ${o.guaranteed ? '<span class="tag guaranteed">Guaranteed model</span>' : ""}
            <span class="tag">${o.acriss}</span>
          </span>
          <div class="o-meta">
            ${o.branchName} · ${o.distanceKm} km away<br>
            ${o.pickupDate} → ${o.dropoffDate} (${o.days} days)
          </div>
        </div>
        <div class="o-price">
          <div class="o-total">${fmt(total)}</div>
          <div class="o-breakdown">${breakdown(o)}</div>
        </div>`;
      sec.appendChild(el);
    });
    root.appendChild(sec);
  }
}

init();
